import { buildConnectorPaths, type ConnectorRoute } from './family-tree-routing';
// Orthogonal family buses with card avoidance and explicit crossing gaps.

import type { RelationshipRecord } from './dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from './dto/relationship';
import {
  Connector,
  LayoutConstants,
  LayoutResult,
} from './family-tree-types';

type HorizontalInterval = { start: number; end: number };

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
  laneFraction: number,
  occupiedRoutes: { x: number; top: number; bottom: number; network: string }[],
  network: string,
  minimumExitY = startY,
) {
  const totalGap = endY - startY;
  const laneInset = Math.max(16, Math.min(32, totalGap / 4));
  let exitY = startY + laneInset + Math.max(0, Math.min(totalGap, 100) - 2 * laneInset) * laneFraction;
  exitY = Math.max(exitY, minimumExitY);
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
    mergeIntervals([
      ...blockedAcrossLevels,
      ...occupiedRoutes.filter((run) => run.network !== network && run.top < approachY && run.bottom > exitY)
        .map((run) => ({ start: run.x - 8, end: run.x + 8 })),
    ]),
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

function getSpouseConnectorStyle(
  relationship: RelationshipRecord,
  colors: { spouse: string; secondaryParent: string },
  isBridge?: boolean,
) {
  const status = relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS;
  if (isBridge) {
    return { stroke: colors.secondaryParent, strokeWidth: 2, dashArray: '8,5' };
  }

  switch (status) {
    case 'married':
      return { stroke: colors.spouse, strokeWidth: 3, dashArray: undefined };
    case 'separated':
    case 'divorced':
      return { stroke: colors.secondaryParent, strokeWidth: 2, dashArray: '10,6' };
    case 'widowed':
      return { stroke: colors.secondaryParent, strokeWidth: 2.5, dashArray: undefined };
    case 'partner':
    default:
      return { stroke: colors.spouse, strokeWidth: 2.5, dashArray: '2,6' };
  }
}

function getParentChildConnectorStyle(
  relationship: RelationshipRecord,
  colors: { parentChild: string; secondaryParent: string; stepChild: string; adoptedChild: string; guardianChild: string },
  isPrimary: boolean,
) {
  const kind = relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND;
  switch (kind) {
    case 'step':
      return { stroke: colors.stepChild, strokeWidth: isPrimary ? 2.2 : 1.5, dashArray: '8,5' };
    case 'adopted':
      return { stroke: colors.adoptedChild, strokeWidth: isPrimary ? 2.4 : 1.6, dashArray: undefined };
    case 'foster':
    case 'guardian':
      return { stroke: colors.guardianChild, strokeWidth: isPrimary ? 2 : 1.4, dashArray: '3,5' };
    case 'biological':
    default:
      return { stroke: isPrimary ? colors.parentChild : colors.secondaryParent, strokeWidth: isPrimary ? 2.5 : 1.5, dashArray: undefined };
  }
}

export function buildConnectors(
  relationships: RelationshipRecord[],
  layout: LayoutResult,
  C: LayoutConstants,
  colors: { parentChild: string; spouse: string; secondaryParent: string; stepChild: string; adoptedChild: string; guardianChild: string },
  ghostPersonIds?: Set<string>,
): { spouseConnectors: Connector[]; parentChildConnectors: Connector[] } {
  const { positionsByPersonId, spouseGroupIdByPersonId, spouseGroupsById, levelBySpouseGroupId, contentWidth } = layout;

  // ---- Spouse connectors ----
  // Adjacent spouses (same group, side-by-side): straight horizontal line.
  // Non-adjacent same-row spouses use separate lanes below the cards.
  // Cross-row bridges retain their route above the cards.
  const spouseRoutes: ConnectorRoute[] = [];
  const marriageJunctions = new Map<string, { x: number; y: number }>();
  const pairKey = (ids: string[]) => [...ids].sort().join('|');
  const spousePorts = new Map<string, string[]>();
  relationships.filter((r) => r.type === 'spouse').forEach((r) => {
    for (const id of [r.fromPersonId, r.toPersonId]) {
      const ports = spousePorts.get(id) ?? [];
      ports.push(r.id);
      spousePorts.set(id, ports);
    }
  });
  spousePorts.forEach((ports) => ports.sort());
  const marriagePort = (id: string, relationshipId: string) => {
    const ports = spousePorts.get(id)!;
    return (ports.indexOf(relationshipId) - (ports.length - 1) / 2) * Math.min(14, 80 / ports.length);
  };

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
      .sort((l, r) => (l.rightX - l.leftX) - (r.rightX - r.leftX))
      .forEach((p, i) => laneByPairKey.set(p.rel.id, i + 1));
  });

  allPairs.forEach((pair) => {
    const a = positionsByPersonId.get(pair.rel.fromPersonId)!;
    const b = positionsByPersonId.get(pair.rel.toPersonId)!;
    const left = a.x < b.x ? a : b;
    const right = a.x < b.x ? b : a;

    // Determine if this is a cross-family bridge (one end is a ghost).
    const isBridge = ghostPersonIds &&
      (ghostPersonIds.has(pair.rel.fromPersonId) || ghostPersonIds.has(pair.rel.toPersonId));

    let pts: { x: number; y: number }[];
    if (pair.adjacent) {
      pts = [
        { x: left.x + C.NODE_WIDTH, y: left.y + C.NODE_HEIGHT / 2 },
        { x: right.x, y: right.y + C.NODE_HEIGHT / 2 },
      ];
      marriageJunctions.set(pairKey([pair.rel.fromPersonId, pair.rel.toPersonId]), {
        x: (left.x + C.NODE_WIDTH + right.x) / 2, y: left.y + C.NODE_HEIGHT / 2,
      });
    } else {
      const lane = laneByPairKey.get(pair.rel.id) ?? 1;
      // Same-row marriages run below their cards, leaving ancestry above.
      // Separate card ports prevent several marriages sharing a false trunk.
      const sameRow = a.y === b.y;
      const laneY = sameRow ? left.y + C.NODE_HEIGHT + 16 + lane * 14 : Math.min(a.y, b.y) - 14 - lane * 8;
      const startX = a.x + C.NODE_WIDTH / 2 + marriagePort(pair.rel.fromPersonId, pair.rel.id);
      const endX = b.x + C.NODE_WIDTH / 2 + marriagePort(pair.rel.toPersonId, pair.rel.id);
      pts = [
        { x: startX, y: a.y + (sameRow ? C.NODE_HEIGHT : 0) },
        { x: startX, y: laneY },
        { x: endX, y: laneY },
        { x: endX, y: b.y + (sameRow ? C.NODE_HEIGHT : 0) },
      ];
      if (sameRow) marriageJunctions.set(pairKey([pair.rel.fromPersonId, pair.rel.toPersonId]), {
        x: (startX + endX) / 2, y: laneY,
      });
    }

    // Compute label midpoint for bridge connectors.
    const midIdx = Math.floor(pts.length / 2);
    const labelPos = pts.length >= 2
      ? { x: (pts[midIdx - 1].x + pts[midIdx].x) / 2, y: (pts[midIdx - 1].y + pts[midIdx].y) / 2 }
      : { x: pts[0].x, y: pts[0].y };
    const connectorStyle = getSpouseConnectorStyle(pair.rel, colors, isBridge);

    spouseRoutes.push({
      key: `spouse-${pair.rel.id}`,
      points: pts,
      networkId: `spouse-${pair.rel.id}`,
      relationshipType: 'spouse',
      personIds: [pair.rel.fromPersonId, pair.rel.toPersonId],
      stroke: connectorStyle.stroke,
      strokeWidth: connectorStyle.strokeWidth,

      dashArray: connectorStyle.dashArray,
      label: isBridge ? '⬌ married into family' : undefined,
      labelPosition: isBridge ? labelPos : undefined,
    });
  });

  // ---- Parent-child connectors ----
  // Aggregate by (parentGroup, childLevel). Each entry uses one trunk
  // emitted once + N drops, in its own lane.


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

  // Match the *recorded* parent set, not every partner in a spouse group.
  // A solo parent's child must never appear to belong to their other partner.
  const parentsByChildKind = new Map<string, Set<string>>();
  const parentRelationships = relationships.filter((r) => r.type === 'parent-child');
  for (const r of parentRelationships) {
    const key = `${r.toPersonId}:${r.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND}`;
    const parents = parentsByChildKind.get(key) ?? new Set<string>();
    parents.add(r.fromPersonId);
    parentsByChildKind.set(key, parents);
  }
  const networkByRelationship = new Map<string, string>();
  const networksByLevel = new Map<number, string[]>();
  for (const r of parentRelationships) {
    const kind = r.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND;
    const parents = [...parentsByChildKind.get(`${r.toPersonId}:${kind}`)!].sort();
    const network = JSON.stringify([parents, kind]);
    networkByRelationship.set(r.id, network);
    const childGroup = spouseGroupIdByPersonId.get(r.toPersonId);
    const level = childGroup ? levelBySpouseGroupId.get(childGroup) : undefined;
    if (level === undefined) continue;
    const networks = networksByLevel.get(level) ?? [];
    if (!networks.includes(network)) networks.push(network);
    networksByLevel.set(level, networks);
  }
  const portsByPerson = new Map<string, string[]>();
  for (const r of parentRelationships) {
    for (const id of [r.fromPersonId, r.toPersonId]) {
      const portKey = `${id}:${id === r.fromPersonId ? 'out' : 'in'}`;
      const ports = portsByPerson.get(portKey) ?? [];
      const network = networkByRelationship.get(r.id)!;
      if (!ports.includes(network)) ports.push(network);
      portsByPerson.set(portKey, ports);
    }
  }
  const portOffset = (id: string, direction: 'in' | 'out', network: string) => {
    const ports = portsByPerson.get(`${id}:${direction}`)!;
    return (ports.indexOf(network) - (ports.length - 1) / 2) * Math.min(12, 80 / ports.length);
  };
  const occupiedRoutes: { x: number; top: number; bottom: number; network: string }[] = [];
  const parentRoutes: ConnectorRoute[] = [];
  for (const r of parentRelationships) {
    const parentGid = spouseGroupIdByPersonId.get(r.fromPersonId);
    const childGid = spouseGroupIdByPersonId.get(r.toPersonId);
    if (!parentGid || !childGid) continue;
    const childLevel = levelBySpouseGroupId.get(childGid);
    const parentLevel = levelBySpouseGroupId.get(parentGid);
    const parentBounds = groupBounds.get(parentGid);
    const parentPos = positionsByPersonId.get(r.fromPersonId);
    const childPos = positionsByPersonId.get(r.toPersonId);
    if (childLevel === undefined || parentLevel === undefined || !parentBounds || !parentPos || !childPos) continue;
    const kind = r.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND;
    const parents = parentsByChildKind.get(`${r.toPersonId}:${kind}`)!;
    const wholeCouple = spouseGroupsById.get(parentGid)!.memberIds.length <= 2
      && spouseGroupsById.get(parentGid)!.memberIds.every((id) => parents.has(id));
    const marriage = parents.size === 2 ? marriageJunctions.get(pairKey([...parents])) : undefined;
    const network = networkByRelationship.get(r.id)!;
    const lanes = networksByLevel.get(childLevel)!;
    const routePoints = buildParentChildRoute(
      marriage?.x ?? (wholeCouple ? parentBounds.centerX : parentPos.x + C.NODE_WIDTH / 2 + portOffset(r.fromPersonId, 'out', network)),
      Math.max(parentBounds.bottomY, marriage?.y ?? 0), parentLevel,
      childPos.x + C.NODE_WIDTH / 2 + portOffset(r.toPersonId, 'in', network), childPos.y, childLevel,
      occupiedIntervalsByLevel, contentWidth,
      lanes.indexOf(network) / Math.max(1, lanes.length - 1),
      occupiedRoutes, network,
      parentBounds.bottomY + (nonAdjacentByRow.has(parentPos.y)
        ? 36 + nonAdjacentByRow.get(parentPos.y)!.length * 14 : 0),
    );
    for (let i = 1; i < routePoints.length; i++) {
      const a = routePoints[i - 1], b = routePoints[i];
      if (a.x === b.x) occupiedRoutes.push({ x: a.x, top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y), network });
    }
    if (marriage && marriage.y < parentBounds.bottomY) {
      routePoints.unshift(marriage);
    } else if (!marriage && wholeCouple && spouseGroupsById.get(parentGid)!.memberIds.length === 2) {
      routePoints.unshift({ x: parentBounds.centerX, y: parentPos.y + C.NODE_HEIGHT / 2 });
    }
    const connectorStyle = getParentChildConnectorStyle(r, colors, true);
    parentRoutes.push({
      key: `pc-${r.id}`, networkId: network, relationshipType: 'parent-child',
      personIds: [r.fromPersonId, r.toPersonId], points: routePoints,
      junctions: marriage || (wholeCouple && spouseGroupsById.get(parentGid)!.memberIds.length === 2) ? [routePoints[0]] : [],
      ...connectorStyle,
    });
  }
  const connectors = buildConnectorPaths([...parentRoutes, ...spouseRoutes]);
  return {
    spouseConnectors: connectors.filter((c) => c.relationshipType === 'spouse'),
    parentChildConnectors: connectors.filter((c) => c.relationshipType !== 'spouse'),
  };
}
