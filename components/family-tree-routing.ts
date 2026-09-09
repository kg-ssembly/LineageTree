import type { Connector, NodePosition } from './family-tree-types';

export type ConnectorRoute = Omit<Connector, 'd' | 'bounds'> & {
  points: NodePosition[];
  /** Only relationships with the same recorded parents and kind share a bus. */
  networkId: string;
  /** Explicit junction with a recorded couple connector. */
  junctions?: NodePosition[];
};
type Segment = { horizontal: boolean; fixed: number; start: number; end: number; cuts: [number, number][]; route: ConnectorRoute };

function roundedRuns(lines: NodePosition[][], canRound: (point: NodePosition) => boolean) {
  const key = (p: NodePosition) => `${p.x},${p.y}`;
  const at = new Map<string, number[]>();
  lines.forEach((line, index) => line.forEach((point) => {
    const ids = at.get(key(point)) ?? []; ids.push(index); at.set(key(point), ids);
  }));
  const used = new Set<number>();
  const paths: string[] = [];
  const trace = (index: number, start: NodePosition) => {
    const points = [start];
    let current = index;
    while (!used.has(current)) {
      used.add(current);
      const line = lines[current];
      const next = key(line[0]) === key(points[points.length - 1]) ? line[1] : line[0];
      points.push(next);
      const incident = at.get(key(next))!;
      if (incident.length !== 2) break;
      const following = incident.find((id) => !used.has(id));
      if (following === undefined) break;
      current = following;
    }
    let d = `M ${start.x} ${start.y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i - 1], b = points[i], c = points[i + 1];
      const ab = Math.hypot(a.x - b.x, a.y - b.y), bc = Math.hypot(c.x - b.x, c.y - b.y);
      const radius = canRound(b) ? Math.min(12, ab / 2, bc / 2) : 0;
      d += ` L ${b.x + (a.x - b.x) * radius / ab} ${b.y + (a.y - b.y) * radius / ab}`;
      d += ` Q ${b.x} ${b.y} ${b.x + (c.x - b.x) * radius / bc} ${b.y + (c.y - b.y) * radius / bc}`;
    }
    const end = points[points.length - 1];
    paths.push(`${d} L ${end.x} ${end.y}`);
  };
  // Begin with open runs; handle any remaining cycles afterwards.
  lines.forEach((line, i) => {
    const start = line.find((p) => at.get(key(p))!.length !== 2);
    if (start && !used.has(i)) trace(i, start);
  });
  lines.forEach((line, i) => { if (!used.has(i)) trace(i, line[0]); });
  return paths.join(' ');
}

/** Consolidate shared runs before opening gaps at unrelated intersections.
 * Gaps mean “passes behind”, never a family junction. No background-colour
 * masks are used, so this works on both light and dark/translucent canvases.
 */
export function buildConnectorPaths(routes: ConnectorRoute[]): Connector[] {
  const runs = new Map<string, Segment[]>();
  const peopleByNetwork = new Map<string, Set<string>>();
  for (const route of routes) {
    const people = peopleByNetwork.get(route.networkId) ?? new Set<string>();
    route.personIds?.forEach((id) => people.add(id));
    peopleByNetwork.set(route.networkId, people);
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i];
      if (a.x === b.x && a.y === b.y) continue;
      const horizontal = a.y === b.y;
      const fixed = horizontal ? a.y : a.x;
      const start = Math.min(horizontal ? a.x : a.y, horizontal ? b.x : b.y);
      const end = Math.max(horizontal ? a.x : a.y, horizontal ? b.x : b.y);
      const key = JSON.stringify([route.networkId, route.stroke, route.strokeWidth, route.dashArray, horizontal, fixed]);
      const list = runs.get(key) ?? [];
      list.push({ horizontal, fixed, start, end, cuts: [], route });
      runs.set(key, list);
    }
  }
  const segments: Segment[] = [];
  for (const list of runs.values()) {
    list.sort((a, b) => a.start - b.start);
    let previous: Segment | undefined;
    for (const segment of list) {
      if (previous && segment.start <= previous.end) previous.end = Math.max(previous.end, segment.end);
      else { segments.push(segment); previous = segment; }
    }
  }

  // Index horizontal runs by row band, avoiding an all-pairs scan on large trees.
  const bands = new Map<number, Segment[]>();
  const bandSize = 64;
  for (const segment of segments) {
    if (!segment.horizontal) continue;
    const band = Math.floor(segment.fixed / bandSize);
    const list = bands.get(band) ?? [];
    list.push(segment);
    bands.set(band, list);
  }
  const verticalBands = new Map<number, Segment[]>();
  for (const segment of segments) {
    if (segment.horizontal) continue;
    const band = Math.floor(segment.fixed / bandSize);
    const list = verticalBands.get(band) ?? [];
    list.push(segment); verticalBands.set(band, list);
  }
  const canRound = (point: NodePosition, network: string) => {
    // Rounding cuts inside a corner. Keep a square elbow when another
    // relationship is nearby, so the curve cannot introduce a new crossing.
    for (const horizontal of [true, false]) {
      const axis = horizontal ? point.y : point.x;
      const along = horizontal ? point.x : point.y;
      const index = horizontal ? bands : verticalBands;
      for (let band = Math.floor((axis - 16) / bandSize); band <= Math.floor((axis + 16) / bandSize); band++) {
        if ((index.get(band) ?? []).some((s) => s.route.networkId !== network && Math.abs(s.fixed - axis) <= 16 && s.start <= along + 16 && s.end >= along - 16)) return false;
      }
    }
    return true;
  };
  for (const vertical of segments) {
    if (vertical.horizontal) continue;
    for (let band = Math.floor(vertical.start / bandSize); band <= Math.floor(vertical.end / bandSize); band++) {
      for (const horizontal of bands.get(band) ?? []) {
        if (horizontal.route.networkId === vertical.route.networkId) continue;
        if (vertical.fixed < horizontal.start || vertical.fixed > horizontal.end || horizontal.fixed < vertical.start || horizontal.fixed > vertical.end) continue;
        if (horizontal.route.relationshipType === 'spouse' && vertical.route.junctions?.some((p) => p.x === vertical.fixed && p.y === horizontal.fixed)) continue;
        const gap = 5 + (horizontal.route.strokeWidth + vertical.route.strokeWidth) / 2;
        horizontal.cuts.push([vertical.fixed - gap, vertical.fixed + gap]);
      }
    }
  }

  const groups = new Map<string, { route: ConnectorRoute; points: NodePosition[][] }>();
  for (const segment of segments) {
    const key = JSON.stringify([segment.route.networkId, segment.route.stroke, segment.route.strokeWidth, segment.route.dashArray]);
    let group = groups.get(key);
    if (!group) { group = { route: segment.route, points: [] }; groups.set(key, group); }
    let cursor = segment.start;
    const emit = (start: number, end: number) => {
      if (end <= start) return;
      group.points.push(segment.horizontal
        ? [{ x: start, y: segment.fixed }, { x: end, y: segment.fixed }]
        : [{ x: segment.fixed, y: start }, { x: segment.fixed, y: end }]);
    };
    for (const [start, end] of segment.cuts.sort((a, b) => a[0] - b[0])) {
      emit(cursor, Math.min(segment.end, start));
      cursor = Math.max(cursor, end);
    }
    emit(cursor, segment.end);
  }
  return [...groups.entries()].map(([key, { route, points }]) => {
    const all = points.flat();
    const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return {
      key, stroke: route.stroke, strokeWidth: route.strokeWidth, dashArray: route.dashArray,
      personIds: [...peopleByNetwork.get(route.networkId)!],
      relationshipType: route.relationshipType,
      d: roundedRuns(points, (point) => canRound(point, route.networkId)),
      bounds: { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY },
      label: route.label, labelPosition: route.labelPosition,
    };
  }).filter((connector) => connector.d);
}
