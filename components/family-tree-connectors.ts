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

type HorizontalInterval = { start: number; end: number };

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

function simplifyOrthogonalPoints(points: { x: number; y: number }[]) {
  const deduped = points.filter((point, index) => (
    index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y
  ));

  const simplified: { x: number; y: number }[] = [];
  deduped.forEach((point) => {
    const prev = simplified[simplified.length - 1];
    const prevPrev = simplified[simplified.length - 2];
    if (
      prev &&
      prevPrev &&
      ((prevPrev.x === prev.x && prev.x === point.x) ||
        (prevPrev.y === prev.y && prev.y === point.y))
    ) {
      simplified[simplified.length - 1] = point;
      return;
    }
    simplified.push(point);
  });

  return simplified;
}

function mergeIntervals(intervals: HorizontalInterval[]) {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: HorizontalInterval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function isBlockedAtX(x: number, intervals: HorizontalInterval[]) {
  return intervals.some((interval) => x >= interval.start && x <= interval.end);
}

function findNearestFreeX(
  preferredX: number,
  intervals: HorizontalInterval[],
  minX: number,
  maxX: number,
) {
  const clampedPreferred = Math.max(minX, Math.min(maxX, preferredX));
  if (!isBlockedAtX(clampedPreferred, intervals)) return clampedPreferred;

  const candidates = new Set<number>([minX, maxX]);
  intervals.forEach((interval) => {
    candidates.add(Math.max(minX, Math.min(maxX, interval.start - 1)));
    candidates.add(Math.max(minX, Math.min(maxX, interval.end + 1)));
  });

  let best = clampedPreferred;
  let bestDistance = Infinity;
  candidates.forEach((candidate) => {
    if (isBlockedAtX(candidate, intervals)) return;
    const distance = Math.abs(candidate - clampedPreferred);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  });

  return best;
}

function buildParentChildRoute(
  startX: number,
  startY: number,
  startLevel: number,
  endX: number,
  endY: number,
  endLevel: number,
  occupiedIntervalsByLevel: Map<number, HorizontalInterval[]>,
  contentWidth: number,
  C: LayoutConstants,
) {
  const totalGap = endY - startY;
  const laneInset = Math.max(16, Math.min(32, totalGap / 4));
  let exitY = startY + laneInset;
  let approachY = endY - laneInset;
  if (exitY > approachY) {
    const midY = (startY + endY) / 2;
    exitY = midY;
    approachY = midY;
  }

  const blockedAcrossLevels = mergeIntervals(
    Array.from({ length: Math.max(0, endLevel - startLevel - 1) }, (_, index) => startLevel + index + 1)
      .flatMap((level) => occupiedIntervalsByLevel.get(level) ?? []),
  );

  const laneX = findNearestFreeX(
    endX,
    blockedAcrossLevels,
    1,
    Math.max(1, contentWidth - 1),
  );

  return simplifyOrthogonalPoints([
    { x: startX, y: startY },
    { x: startX, y: exitY },
    { x: laneX, y: exitY },
    { x: laneX, y: approachY },
    { x: endX, y: approachY },
    { x: endX, y: endY },
  ]);
}

export function buildConnectors(
  relationships: RelationshipRecord[],
  layout: LayoutResult,
  C: LayoutConstants,
  colors: { parentChild: string; spouse: string; secondaryParent: string },
): { spouseConnectors: Connector[]; parentChildConnectors: Connector[] } {
  const { positionsByPersonId, spouseGroupIdByPersonId, spouseGroupsById, levelBySpouseGroupId, contentWidth } = layout;

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
  const occupiedIntervalsByLevel = new Map<number, HorizontalInterval[]>();
  const laneClearance = 12;
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
      const level = levelBySpouseGroupId.get(g.id);
      if (typeof level === 'number') {
        if (!occupiedIntervalsByLevel.has(level)) occupiedIntervalsByLevel.set(level, []);
        occupiedIntervalsByLevel.get(level)!.push({
          start: left - laneClearance,
          end: right + laneClearance,
        });
      }
    }
  });
  occupiedIntervalsByLevel.forEach((intervals, level) => {
    occupiedIntervalsByLevel.set(level, mergeIntervals(intervals));
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
  const cornerRadius = 24;

  // ---- Parent-child connectors ----
  // Route every edge independently through card-free generation gaps.
  // The vertical "lane" is chosen outside all node bounds on the
  // intermediate levels so the connector can never pass through a card.
  relationships.forEach((r) => {
    if (r.type !== 'parent-child') return;
    const parentGid = spouseGroupIdByPersonId.get(r.fromPersonId);
    const childGid = spouseGroupIdByPersonId.get(r.toPersonId);
    if (!parentGid) return;
    if (!childGid) return;

    const childLevel = levelBySpouseGroupId.get(childGid);
    const parentLevel = levelBySpouseGroupId.get(parentGid);
    if (typeof childLevel !== 'number' || typeof parentLevel !== 'number') return;

    const familyEntries = familiesByLevel.get(layout.levelBySpouseGroupId.get(childGid) ?? -1) ?? [];
    const isPrimary = familyEntries.some((e) => e.parentGroupId === parentGid && e.childPersonIds.includes(r.toPersonId));
    const parentBounds = groupBounds.get(parentGid);
    const childPos = positionsByPersonId.get(r.toPersonId);
    if (!parentBounds || !childPos) return;

    const routePoints = buildParentChildRoute(
      parentBounds.centerX,
      parentBounds.bottomY,
      parentLevel,
      childPos.x + C.NODE_WIDTH / 2,
      childPos.y,
      childLevel,
      occupiedIntervalsByLevel,
      contentWidth,
      C,
    );

    parentChildConnectors.push({
      key: `pc-${isPrimary ? 'primary' : 'secondary'}-${r.id}`,
      d: pointsToRoundedPath(routePoints, cornerRadius),
      stroke: isPrimary ? colors.parentChild : colors.secondaryParent,
      strokeWidth: isPrimary ? 2.5 : 1.5,
      bounds: boundsOf(routePoints),
    });
  });

  return { spouseConnectors, parentChildConnectors };
}

