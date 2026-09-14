import type { RelationshipRecord } from './dto/relationship';
import type { PersonRecord } from './dto/person';

export type TreePersonActions = {
  relationshipSentences: string[];
  hasConnection: boolean;
  showRelationshipInitially?: boolean;
  onTrace: () => void;
  onCompare: () => void;
  onClose: () => void;
  onFocusBranch?: () => void;
  branchCollapsed: boolean;
  canCollapse: boolean;
  onToggleBranch: () => void;
  siblings: Array<{ label: string; onPress: () => void }>;
};

export function naturalRelationship(relation: string, gender: PersonRecord['gender']) {
  const parent = gender === 'male' ? 'father' : gender === 'female' ? 'mother' : 'parent';
  const child = gender === 'male' ? 'son' : gender === 'female' ? 'daughter' : 'child';
  if (relation === 'spouse') return gender === 'male' ? 'husband' : gender === 'female' ? 'wife' : 'spouse';
  if (relation === 'step parent') return gender === 'male' ? 'stepfather' : gender === 'female' ? 'stepmother' : 'stepparent';
  if (relation === 'step child') return gender === 'male' ? 'stepson' : gender === 'female' ? 'stepdaughter' : 'stepchild';
  if (relation === 'guardian parent') return 'guardian';
  if (relation === 'guardian child') return 'child in their care';
  if (relation.endsWith('parent')) return relation.replace(/parent$/, parent).replace(/^adopted /, 'adoptive ');
  if (relation.endsWith('child')) return relation.replace(/child$/, child);
  return relation;
}

export function describeFamilyStep(step: FamilyPathStep, people: Map<string, Pick<PersonRecord, 'id' | 'firstName' | 'gender'>>, t: (message: string, params?: Record<string, string | number | null | undefined>) => string = message => message) {
  const from = people.get(step.from);
  const to = people.get(step.to);
  if (!from || !to) return '';
  if (step.relation === 'guardian child') {
    return t("{person} is in {relative}'s care.", { person: to.firstName, relative: from.firstName }).replace('{person}', to.firstName).replace('{relative}', from.firstName);
  }
  const relation = t(naturalRelationship(step.relation, to.gender));
  // Translate complete sentences so languages can choose their own word order.
  const template = t("{person} is {relative}'s {relationship}.", { person: to.firstName, relative: from.firstName, relationship: relation });
  return template.replace('{person}', to.firstName).replace('{relative}', from.firstName).replace('{relationship}', relation);
}

export type TreeScope = 'full' | 'close' | 'branch' | 'ancestors' | 'descendants';

/** Start with two generations in each direction; keep wide child sets expandable. */
export function branchIds(root: string, relationships: RelationshipRecord[], direction: 'branch' | 'ancestors' | 'descendants' = 'branch') {
  const ids = new Set([root]);
  for (const way of ['ancestors', 'descendants'] as const) {
    if (direction !== 'branch' && direction !== way) continue;
    let frontier = [root];
    const visited = new Set(frontier);
    for (let depth = 0; depth < 2; depth++) {
      const next: string[] = [];
      for (const id of frontier) {
        const neighbours = [...new Set(relationships.filter(r => r.type === 'parent-child' &&
          (way === 'ancestors' ? r.toPersonId : r.fromPersonId) === id)
          .map(r => way === 'ancestors' ? r.fromPersonId : r.toPersonId))].sort();
        for (const neighbour of way === 'descendants' ? neighbours.slice(0, 4) : neighbours) {
          ids.add(neighbour);
          if (!visited.has(neighbour)) { visited.add(neighbour); next.push(neighbour); }
        }
      }
      frontier = next;
    }
  }
  if (direction === 'branch') {
    const parents = new Set(relationships.filter(r => r.type === 'parent-child' && r.toPersonId === root).map(r => r.fromPersonId));
    relationships.forEach(r => {
      if (r.type === 'parent-child' && parents.has(r.fromPersonId)) ids.add(r.toPersonId);
    });
  }
  // Partners supply family context without recursively importing their ancestry.
  const lineage = new Set(ids);
  relationships.filter(r => r.type === 'spouse').forEach(r => {
    if (lineage.has(r.fromPersonId)) ids.add(r.toPersonId);
    if (lineage.has(r.toPersonId)) ids.add(r.fromPersonId);
  });
  return ids;
}

export function hiddenChildIds(personId: string, relationships: RelationshipRecord[], visible: Set<string>) {
  return [...new Set(relationships.filter(r => r.type === 'parent-child' && r.fromPersonId === personId)
    .map(r => r.toPersonId))].filter(id => !visible.has(id)).sort();
}

export function hiddenParentIds(personId: string, relationships: RelationshipRecord[], visible: Set<string>) {
  return [...new Set(relationships.filter(r => r.type === 'parent-child' && r.toPersonId === personId)
    .map(r => r.fromPersonId))].filter(id => !visible.has(id)).sort();
}

export function lineageIds(root: string, relationships: RelationshipRecord[], direction: 'ancestors' | 'descendants') {
  const neighbours = new Map<string, string[]>();
  for (const edge of relationships) {
    if (edge.type !== 'parent-child') continue;
    const from = direction === 'ancestors' ? edge.toPersonId : edge.fromPersonId;
    const to = direction === 'ancestors' ? edge.fromPersonId : edge.toPersonId;
    neighbours.set(from, [...(neighbours.get(from) ?? []), to]);
  }
  const ids = new Set([root]);
  const queue = [root];
  for (let i = 0; i < queue.length; i++) {
    for (const to of neighbours.get(queue[i]) ?? []) {
      if (!ids.has(to)) { ids.add(to); queue.push(to); }
    }
  }
  return ids;
}

/** Shared connector runs can represent several relationships; retain a run if
 * it contains consecutive people in the traced path, not just two path members. */
export function connectorOnPath(personIds: string[] | undefined, path: string[]) {
  if (!personIds) return false;
  const ids = new Set(personIds);
  return path.some((id, index) => index > 0 && ids.has(path[index - 1]) && ids.has(id));
}

export function scopeIds(root: string, relationships: RelationshipRecord[], scope: TreeScope): Set<string> | null {
  if (scope === 'full') return null;
  if (scope === 'branch') return branchIds(root, relationships);
  if (scope !== 'close') return lineageIds(root, relationships, scope);
  const ids = new Set([root]);
  const parents = new Set(relationships.filter(r => r.type === 'parent-child' && r.toPersonId === root).map(r => r.fromPersonId));
  relationships.forEach(r => {
    if (r.fromPersonId === root) ids.add(r.toPersonId);
    if (r.toPersonId === root) ids.add(r.fromPersonId);
    if (r.type === 'parent-child' && parents.has(r.fromPersonId)) ids.add(r.toPersonId);
  });
  return ids;
}

export type FamilyPathStep = { from: string; to: string; relation: string };
export function relationshipPath(from: string, to: string, relationships: RelationshipRecord[]): FamilyPathStep[] | null {
  if (from === to) return [];
  const visited = new Set([from]);
  const queue: Array<{ id: string; path: FamilyPathStep[] }> = [{ id: from, path: [] }];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const r of relationships) {
      const next = r.fromPersonId === current.id ? r.toPersonId : r.toPersonId === current.id ? r.fromPersonId : null;
      if (!next || visited.has(next)) continue;
      visited.add(next);
      const kind = r.parentChildKind && r.parentChildKind !== 'biological' ? `${r.parentChildKind} ` : '';
      const relation = r.type === 'spouse' ? (r.relationshipStatus === 'divorced' || r.relationshipStatus === 'separated' ? 'former partner' : r.relationshipStatus === 'married' ? 'spouse' : 'partner') : `${kind}${r.fromPersonId === current.id ? 'child' : 'parent'}`;
      const path = [...current.path, { from: current.id, to: next, relation }];
      if (next === to) return path;
      queue.push({ id: next, path });
    }
  }
  return null;
}
