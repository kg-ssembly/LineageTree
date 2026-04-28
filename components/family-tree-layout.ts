// Tidy-tree (Walker / Reingold–Tilford) layout for a family graph.
//
// We treat each spouse-group (a couple, or solo person) as one virtual
// node whose width = (memberCount * NODE_WIDTH) + (memberCount-1) * SPOUSE_GAP.
// Subtree non-overlap is guaranteed by the algorithm.
//
// Multi-parent children: a child is attached to a single "primary" parent
// group (the one with the most descendants in common with the child's
// siblings, falling back to the first parent encountered). Secondary
// parent edges are still emitted by the connector module so both parents
// visually point at the child.

import type { PersonRecord } from './dto/person';
import type { RelationshipRecord } from './dto/relationship';
import {
  DEFAULT_LAYOUT_CONSTANTS,
  LayoutConstants,
  LayoutResult,
  NodePosition,
  SpouseGroup,
} from './family-tree-types';

type GroupNode = {
  id: string;
  members: string[];          // person ids, ordered
  width: number;              // visual width including spouse gaps
  children: GroupNode[];
  parents: GroupNode[];       // all parent groups (>=1 means multi-parent)
  primaryParentId?: string;
  // Walker scratch fields:
  prelim: number;
  modifier: number;
  thread?: GroupNode;
  ancestor: GroupNode;
  shift: number;
  change: number;
  number: number;             // index among siblings
  level: number;
  x: number;
  y: number;
};

function unionFind(personIds: string[], spousePairs: [string, string][]) {
  const parent = new Map<string, string>();
  personIds.forEach((id) => parent.set(id, id));

  const find = (id: string): string => {
    let root = id;
    while (parent.get(root)! !== root) root = parent.get(root)!;
    let cur = id;
    while (parent.get(cur)! !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };

  spousePairs.forEach(([a, b]) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      const [keep, drop] = [ra, rb].sort();
      parent.set(drop, keep);
    }
  });

  return { find };
}

function buildSpouseGroups(
  people: PersonRecord[],
  relationships: RelationshipRecord[],
): { groups: Map<string, SpouseGroup>; groupIdByPerson: Map<string, string> } {
  const personIds = people.map((p) => p.id);
  const spousePairs: [string, string][] = relationships
    .filter((r) => r.type === 'spouse')
    .map((r) => [r.fromPersonId, r.toPersonId]);

  const { find } = unionFind(personIds, spousePairs);

  const groupMembers = new Map<string, string[]>();
  const groupIdByPerson = new Map<string, string>();

  people.forEach((p) => {
    const gid = find(p.id);
    groupIdByPerson.set(p.id, gid);
    if (!groupMembers.has(gid)) groupMembers.set(gid, []);
    groupMembers.get(gid)!.push(p.id);
  });

  // Stable ordering inside a group (alpha by name id for determinism).
  const groups = new Map<string, SpouseGroup>();
  groupMembers.forEach((members, id) => {
    members.sort();
    groups.set(id, { id, memberIds: members });
  });

  return { groups, groupIdByPerson };
}

function buildGroupGraph(
  people: PersonRecord[],
  relationships: RelationshipRecord[],
  groups: Map<string, SpouseGroup>,
  groupIdByPerson: Map<string, string>,
  C: LayoutConstants,
): { nodesById: Map<string, GroupNode>; roots: GroupNode[] } {
  const nodesById = new Map<string, GroupNode>();

  groups.forEach((g) => {
    const w = g.memberIds.length * C.NODE_WIDTH + Math.max(0, g.memberIds.length - 1) * C.SPOUSE_GAP;
    const node: GroupNode = {
      id: g.id,
      members: g.memberIds,
      width: w,
      children: [],
      parents: [],
      prelim: 0,
      modifier: 0,
      ancestor: undefined as any,
      shift: 0,
      change: 0,
      number: 0,
      level: 0,
      x: 0,
      y: 0,
    };
    node.ancestor = node;
    nodesById.set(g.id, node);
  });

  // Build parent->child group relationships and pick a "primary" parent
  // for each child group (the one that is the parent of the most members).
  const parentVotes = new Map<string, Map<string, number>>(); // childGid -> parentGid -> votes

  relationships.forEach((r) => {
    if (r.type !== 'parent-child') return;
    const parentGid = groupIdByPerson.get(r.fromPersonId);
    const childGid = groupIdByPerson.get(r.toPersonId);
    if (!parentGid || !childGid || parentGid === childGid) return;

    if (!parentVotes.has(childGid)) parentVotes.set(childGid, new Map());
    const m = parentVotes.get(childGid)!;
    m.set(parentGid, (m.get(parentGid) ?? 0) + 1);
  });

  parentVotes.forEach((votes, childGid) => {
    const childNode = nodesById.get(childGid)!;
    const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const primaryParentGid = sorted[0][0];
    childNode.primaryParentId = primaryParentGid;

    sorted.forEach(([parentGid]) => {
      const parentNode = nodesById.get(parentGid)!;
      childNode.parents.push(parentNode);
      if (parentGid === primaryParentGid) {
        parentNode.children.push(childNode);
      }
    });
  });

  // Roots: nodes with no parent at all.
  const roots = [...nodesById.values()].filter((n) => n.parents.length === 0);
  // Stable sort of roots & children so layout is deterministic.
  roots.sort((a, b) => a.id.localeCompare(b.id));
  nodesById.forEach((n) => n.children.sort((a, b) => a.id.localeCompare(b.id)));

  return { nodesById, roots };
}

// ---- Walker's algorithm (Buchheim, Jünger, Leipert improved O(n) version) ----

function distance(a: GroupNode, b: GroupNode, C: LayoutConstants) {
  return (a.width + b.width) / 2 + C.HORIZONTAL_GAP;
}

function leftSibling(v: GroupNode, parent: GroupNode | null): GroupNode | null {
  if (!parent) return null;
  const idx = parent.children.indexOf(v);
  return idx > 0 ? parent.children[idx - 1] : null;
}

function leftmostSibling(v: GroupNode, parent: GroupNode | null): GroupNode | null {
  if (!parent || parent.children.length === 0) return null;
  return parent.children[0] === v ? null : parent.children[0];
}

function nextLeft(v: GroupNode): GroupNode | null {
  return v.children.length > 0 ? v.children[0] : v.thread ?? null;
}
function nextRight(v: GroupNode): GroupNode | null {
  return v.children.length > 0 ? v.children[v.children.length - 1] : v.thread ?? null;
}

function moveSubtree(wm: GroupNode, wp: GroupNode, shift: number, parent: GroupNode) {
  const subtrees = wp.number - wm.number;
  if (subtrees === 0) return;
  wp.change -= shift / subtrees;
  wp.shift += shift;
  wm.change += shift / subtrees;
  wp.prelim += shift;
  wp.modifier += shift;
}

function executeShifts(v: GroupNode) {
  let shift = 0;
  let change = 0;
  for (let i = v.children.length - 1; i >= 0; i--) {
    const w = v.children[i];
    w.prelim += shift;
    w.modifier += shift;
    change += w.change;
    shift += w.shift + change;
  }
}

function ancestorOf(vim: GroupNode, v: GroupNode, parent: GroupNode, defaultAncestor: GroupNode) {
  return parent.children.includes(vim.ancestor) ? vim.ancestor : defaultAncestor;
}

function apportion(v: GroupNode, defaultAncestor: GroupNode, parent: GroupNode, C: LayoutConstants) {
  const w = leftSibling(v, parent);
  if (!w) return defaultAncestor;

  let vip: GroupNode = v;
  let vop: GroupNode = v;
  let vim: GroupNode = w;
  let vom: GroupNode = leftmostSibling(v, parent)!;

  let sip = vip.modifier;
  let sop = vop.modifier;
  let sim = vim.modifier;
  let som = vom.modifier;

  while (nextRight(vim) && nextLeft(vip)) {
    vim = nextRight(vim)!;
    vip = nextLeft(vip)!;
    vom = nextLeft(vom)!;
    vop = nextRight(vop)!;
    vop.ancestor = v;
    const shift = vim.prelim + sim - (vip.prelim + sip) + distance(vim, vip, C);
    if (shift > 0) {
      moveSubtree(ancestorOf(vim, v, parent, defaultAncestor), v, shift, parent);
      sip += shift;
      sop += shift;
    }
    sim += vim.modifier;
    sip += vip.modifier;
    som += vom.modifier;
    sop += vop.modifier;
  }

  if (nextRight(vim) && !nextRight(vop)) {
    vop.thread = nextRight(vim)!;
    vop.modifier += sim - sop;
  }
  if (nextLeft(vip) && !nextLeft(vom)) {
    vom.thread = nextLeft(vip)!;
    vom.modifier += sip - som;
    defaultAncestor = v;
  }

  return defaultAncestor;
}

function firstWalk(v: GroupNode, parent: GroupNode | null, C: LayoutConstants) {
  if (v.children.length === 0) {
    const ls = leftSibling(v, parent);
    v.prelim = ls ? ls.prelim + distance(ls, v, C) : 0;
    return;
  }

  let defaultAncestor = v.children[0];
  v.children.forEach((w, i) => {
    w.number = i;
    firstWalk(w, v, C);
    defaultAncestor = apportion(w, defaultAncestor, v, C);
  });
  executeShifts(v);

  const midpoint = (v.children[0].prelim + v.children[v.children.length - 1].prelim) / 2;
  const ls = leftSibling(v, parent);
  if (ls) {
    v.prelim = ls.prelim + distance(ls, v, C);
    v.modifier = v.prelim - midpoint;
  } else {
    v.prelim = midpoint;
  }
}

function secondWalk(v: GroupNode, m: number, level: number, C: LayoutConstants) {
  v.x = v.prelim + m;
  v.y = level * (C.NODE_HEIGHT + C.VERTICAL_GAP);
  v.level = level;
  v.children.forEach((w) => secondWalk(w, m + v.modifier, level + 1, C));
}

// ---- Public API ----

export function layoutFamilyTree(
  people: PersonRecord[],
  relationships: RelationshipRecord[],
  constants: LayoutConstants = DEFAULT_LAYOUT_CONSTANTS,
): LayoutResult {
  const C = constants;
  const { groups, groupIdByPerson } = buildSpouseGroups(people, relationships);
  const { nodesById, roots } = buildGroupGraph(people, relationships, groups, groupIdByPerson, C);

  // Lay out each root tree side-by-side with HORIZONTAL_GAP between them.
  let cursorX = 0;
  let maxLevel = 0;

  roots.forEach((root) => {
    firstWalk(root, null, C);
    secondWalk(root, 0, 0, C);

    // Compute bounding box of this rooted tree, normalize to start at cursorX.
    let minX = Infinity;
    let maxX = -Infinity;
    const stack = [root];
    while (stack.length) {
      const n = stack.pop()!;
      const left = n.x - n.width / 2;
      const right = n.x + n.width / 2;
      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (n.level > maxLevel) maxLevel = n.level;
      n.children.forEach((c) => stack.push(c));
    }

    const offset = cursorX - minX;
    const stack2 = [root];
    while (stack2.length) {
      const n = stack2.pop()!;
      n.x += offset;
      n.children.forEach((c) => stack2.push(c));
    }
    cursorX += (maxX - minX) + C.HORIZONTAL_GAP;
  });

  // Build position map (person-level coordinates inside each group).
  const positionsByPersonId = new Map<string, NodePosition>();
  const levelBySpouseGroupId = new Map<string, number>();
  let contentWidth = 0;
  let contentHeight = 0;

  nodesById.forEach((n) => {
    levelBySpouseGroupId.set(n.id, n.level);
    let cursor = n.x - n.width / 2;
    n.members.forEach((personId, idx) => {
      const x = cursor;
      const y = n.y;
      positionsByPersonId.set(personId, { x, y });
      cursor += C.NODE_WIDTH;
      if (idx < n.members.length - 1) cursor += C.SPOUSE_GAP;
      if (x + C.NODE_WIDTH > contentWidth) contentWidth = x + C.NODE_WIDTH;
      if (y + C.NODE_HEIGHT > contentHeight) contentHeight = y + C.NODE_HEIGHT;
    });
  });

  // Shift everything by PADDING so coords are positive with margin.
  positionsByPersonId.forEach((p) => {
    p.x += C.PADDING;
    p.y += C.PADDING;
  });
  contentWidth += C.PADDING * 2;
  contentHeight += C.PADDING * 2;

  return {
    positionsByPersonId,
    spouseGroupsById: groups,
    spouseGroupIdByPersonId: groupIdByPerson,
    levelBySpouseGroupId,
    contentWidth,
    contentHeight,
  };
}

