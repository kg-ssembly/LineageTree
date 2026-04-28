// Orthogonal connector routing with lane allocation.
//
// Because the tidy-tree layout guarantees no node overlaps, we no
// longer need obstacle dodging. Each parent group gets its own
// horizontal "lane" in the gap between generations, and each
// non-adjacent spouse pair gets its own lane above their row.
// This eliminates overlapping connectors entirely.

import type { RelationshipRecord } from './dto/relationship';
import {
  Connector,
  LayoutConstants,
  LayoutResult,
} from './family-tree-types';

type FamilyEntry = {
  parentGroupId: string;
  childPersonIds: string[];
  parentCenterX: number;
  parentBottomY: number;
};

function pointsToRoundedPath(points: { x: number; y: number }[], radius: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[i + 1];

    const d1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const d2 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
    if (d1 === 0 || d2 === 0) {
      d += ` L ${p2.x} ${p2.y}`;
      continue;
    }
    const r = Math.min(radius, d1 / 2, d2 / 2);

    const sx = p2.x + ((p1.x - p2.x) / d1) * r;
    const sy = p2.y + ((p1.y - p2.y) / d1) * r;
    const ex = p2.x + ((p3.x - p2.x) / d2) * r;
    const ey = p2.y + ((p3.y - p2.y) / d2) * r;

    d += ` L ${sx} ${sy} Q ${p2.x} ${p2.y} ${ex} ${ey}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function boundsOf(points: { x: number; y: number }[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function buildConnectors(
  relationships: RelationshipRecord[],
  layout: LayoutResult,
  C: LayoutConstants,
  colors: { parentChild: string; spouse: string; secondaryParent: string },
): { spouseConnectors: Connector[]; parentChildConnectors: Connector[] } {
  const { positionsByPersonId, spouseGroupIdByPersonId, spouseGroupsById, levelBySpouseGroupId } = layout;

  // ---- Spouse connectors ----
  // Adjacent spouses (same group, side-by-side): straight horizontal line.
  // Non-adjacent spouses (rare — e.g. remarriage drawn far away): routed
  // ABOVE the row in a dedicated lane.
  const spouseConnectors: Connector[] = [];

  // Group non-adjacent spouse pairs by row to allocate lanes.
  type SpousePair = { rel: RelationshipRecord; leftX: number; rightX: number; rowY: number; adjacent: boolean };
  const allPairs: SpousePair[] = [];

  relationships.forEach((r) => {
    if (r.type !== 'spouse') return;
    const a = positionsByPersonId.get(r.fromPersonId);
    const b = positionsByPersonId.get(r.toPersonId);
    if (!a || !b) return;
    const left = a.x < b.x ? a : b;
    const right = a.x < b.x ? b : a;
    const adjacent =
      Math.abs(left.y - right.y) < 1 &&
      Math.abs(right.x - left.x) <= C.NODE_WIDTH + C.SPOUSE_GAP + 4;
    allPairs.push({
      rel: r,
      leftX: left.x,
      rightX: right.x,
      rowY: Math.min(left.y, right.y),
      adjacent,
    });
  });

  // Lane allocation for non-adjacent spouse pairs sharing a row.
  const nonAdjacentByRow = new Map<number, SpousePair[]>();
  allPairs.forEach((p) => {
    if (p.adjacent) return;
    if (!nonAdjacentByRow.has(p.rowY)) nonAdjacentByRow.set(p.rowY, []);
    nonAdjacentByRow.get(p.rowY)!.push(p);
  });
  const laneByPairKey = new Map<string, number>();
  nonAdjacentByRow.forEach((pairs) => {
    // Sort by span size desc — bigger spans get outer lanes.
    pairs
      .sort((l, r) => (r.rightX - r.leftX) - (l.rightX - l.leftX))
      .forEach((p, i) => laneByPairKey.set(p.rel.id, i + 1));
  });

  allPairs.forEach((pair) => {
    const a = positionsByPersonId.get(pair.rel.fromPersonId)!;
    const b = positionsByPersonId.get(pair.rel.toPersonId)!;
    const left = a.x < b.x ? a : b;
    const right = a.x < b.x ? b : a;

    let pts: { x: number; y: number }[];
    if (pair.adjacent) {
      pts = [
        { x: left.x + C.NODE_WIDTH, y: left.y + C.NODE_HEIGHT / 2 },
        { x: right.x, y: right.y + C.NODE_HEIGHT / 2 },
      ];
    } else {
      const lane = laneByPairKey.get(pair.rel.id) ?? 1;
      const yTop = left.y - 14 - lane * 8;
      const startX = left.x + C.NODE_WIDTH / 2;
      const endX = right.x + C.NODE_WIDTH / 2;
      pts = [
        { x: startX, y: left.y },
        { x: startX, y: yTop },
        { x: endX, y: yTop },
        { x: endX, y: right.y },
      ];
    }

    spouseConnectors.push({
      key: `spouse-${pair.rel.id}`,
      d: pointsToRoundedPath(pts, 12),
      stroke: colors.spouse,
      strokeWidth: 3,
      bounds: boundsOf(pts),
    });
  });

  // ---- Parent-child connectors ----
  // Aggregate by (parentGroup, childLevel). Each entry uses one trunk
  // emitted once + N drops, in its own lane.
  const familiesByLevel = new Map<number, FamilyEntry[]>();

  // Pre-compute spouse-group bounds so we know parent center & bottom.
  const groupBounds = new Map<string, { centerX: number; bottomY: number; topY: number; left: number; right: number }>();
  spouseGroupsById.forEach((g) => {
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    g.memberIds.forEach((id) => {
      const p = positionsByPersonId.get(id);
      if (!p) return;
      if (p.x < left) left = p.x;
      if (p.x + C.NODE_WIDTH > right) right = p.x + C.NODE_WIDTH;
      if (p.y < top) top = p.y;
      if (p.y + C.NODE_HEIGHT > bottom) bottom = p.y + C.NODE_HEIGHT;
    });
    if (left !== Infinity) {
      groupBounds.set(g.id, { centerX: (left + right) / 2, bottomY: bottom, topY: top, left, right });
    }
  });

  relationships.forEach((r) => {
    if (r.type !== 'parent-child') return;
    const parentGid = spouseGroupIdByPersonId.get(r.fromPersonId);
    const childGid = spouseGroupIdByPersonId.get(r.toPersonId);
    if (!parentGid || !childGid) return;
    const childLevel = levelBySpouseGroupId.get(childGid);
    if (typeof childLevel !== 'number') return;
    const parentBounds = groupBounds.get(parentGid);
    if (!parentBounds) return;

    if (!familiesByLevel.has(childLevel)) familiesByLevel.set(childLevel, []);
    const entries = familiesByLevel.get(childLevel)!;
    let entry = entries.find((e) => e.parentGroupId === parentGid);
    if (!entry) {
      entry = {
        parentGroupId: parentGid,
        childPersonIds: [],
        parentCenterX: parentBounds.centerX,
        parentBottomY: parentBounds.bottomY,
      };
      entries.push(entry);
    }
    if (!entry.childPersonIds.includes(r.toPersonId)) {
      entry.childPersonIds.push(r.toPersonId);
    }
  });

  const parentChildConnectors: Connector[] = [];

  familiesByLevel.forEach((entries, childLevel) => {
    // Sort by parent center X to allocate lanes left → right.
    entries.sort((a, b) => a.parentCenterX - b.parentCenterX);

    // Determine the band between this level's parents bottom and child top.
    const childTopYs = entries.flatMap((e) =>
      e.childPersonIds.map((id) => positionsByPersonId.get(id)?.y ?? Infinity),
    );
    const childTopY = Math.min(...childTopYs);
    const parentBottomMax = Math.max(...entries.map((e) => e.parentBottomY));
    const bandTop = parentBottomMax + 14;
    const bandBottom = childTopY - 14;
    const usable = Math.max(20, bandBottom - bandTop);
    const laneCount = entries.length;
    const laneStep = usable / (laneCount + 1);

    entries.forEach((entry, i) => {
      const junctionY = bandTop + (i + 1) * laneStep;
      const childCenters = entry.childPersonIds
        .map((id) => positionsByPersonId.get(id))
        .filter((p): p is { x: number; y: number } => Boolean(p))
        .map((p) => ({ cx: p.x + C.NODE_WIDTH / 2, topY: p.y }))
        .sort((a, b) => a.cx - b.cx);

      if (childCenters.length === 0) return;

      const trunkPts = [
        { x: entry.parentCenterX, y: entry.parentBottomY },
        { x: entry.parentCenterX, y: junctionY },
      ];

      // Horizontal bus from leftmost child x → rightmost child x at junctionY.
      const busLeft = Math.min(entry.parentCenterX, childCenters[0].cx);
      const busRight = Math.max(entry.parentCenterX, childCenters[childCenters.length - 1].cx);
      const busPts = [
        { x: busLeft, y: junctionY },
        { x: busRight, y: junctionY },
      ];

      // Trunk
      parentChildConnectors.push({
        key: `pc-trunk-${childLevel}-${entry.parentGroupId}`,
        d: pointsToRoundedPath(trunkPts, 12),
        stroke: colors.parentChild,
        strokeWidth: 2.5,
        bounds: boundsOf(trunkPts),
      });

      // Bus
      if (busLeft !== busRight) {
        parentChildConnectors.push({
          key: `pc-bus-${childLevel}-${entry.parentGroupId}`,
          d: pointsToRoundedPath(busPts, 12),
          stroke: colors.parentChild,
          strokeWidth: 2.5,
          bounds: boundsOf(busPts),
        });
      }

      // Drops to each child
      childCenters.forEach((child) => {
        const dropPts = [
          { x: child.cx, y: junctionY },
          { x: child.cx, y: child.topY },
        ];
        parentChildConnectors.push({
          key: `pc-drop-${childLevel}-${entry.parentGroupId}-${child.cx}`,
          d: pointsToRoundedPath(dropPts, 12),
          stroke: colors.parentChild,
          strokeWidth: 2.5,
          bounds: boundsOf(dropPts),
        });
      });
    });
  });

  // ---- Secondary parent edges (multi-parent children) ----
  // Drawn as a thin dashed-style straight line from secondary parent's
  // bottom-center to child's top-center. (Dashes are not used; we just
  // render a thinner stroke + lower opacity via a dedicated color.)
  relationships.forEach((r) => {
    if (r.type !== 'parent-child') return;
    const childGid = spouseGroupIdByPersonId.get(r.toPersonId);
    if (!childGid) return;
    // Determine if this parent is the primary one used in the trunk above.
    const parentGid = spouseGroupIdByPersonId.get(r.fromPersonId);
    if (!parentGid) return;
    const familyEntries = familiesByLevel.get(layout.levelBySpouseGroupId.get(childGid) ?? -1) ?? [];
    const isPrimary = familyEntries.some((e) => e.parentGroupId === parentGid && e.childPersonIds.includes(r.toPersonId));
    if (isPrimary) return;

    const parentBounds = groupBounds.get(parentGid);
    const childPos = positionsByPersonId.get(r.toPersonId);
    if (!parentBounds || !childPos) return;

    const pts = [
      { x: parentBounds.centerX, y: parentBounds.bottomY },
      { x: parentBounds.centerX, y: parentBounds.bottomY + 12 },
      { x: childPos.x + C.NODE_WIDTH / 2, y: parentBounds.bottomY + 12 },
      { x: childPos.x + C.NODE_WIDTH / 2, y: childPos.y },
    ];
    parentChildConnectors.push({
      key: `pc-secondary-${r.id}`,
      d: pointsToRoundedPath(pts, 10),
      stroke: colors.secondaryParent,
      strokeWidth: 1.5,
      bounds: boundsOf(pts),
    });
  });

  return { spouseConnectors, parentChildConnectors };
}

