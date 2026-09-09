export type CanvasRect = { x: number; y: number; w: number; h: number };

/** Static spatial index, rebuilt only when layout changes, not while panning. */
export function createViewportIndex<T extends { bounds: CanvasRect }>(items: T[], cellSize = 512) {
  const cells = new Map<string, number[]>();
  const spanning: number[] = [];
  items.forEach((item, index) => {
    const b = item.bounds;
    const x1 = Math.floor(b.x / cellSize), x2 = Math.floor((b.x + b.w) / cellSize);
    const y1 = Math.floor(b.y / cellSize), y2 = Math.floor((b.y + b.h) / cellSize);
    if ((x2 - x1 + 1) * (y2 - y1 + 1) > 64) { spanning.push(index); return; }
    for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) {
      const key = `${x}:${y}`, bucket = cells.get(key) ?? [];
      bucket.push(index); cells.set(key, bucket);
    }
  });
  return (viewport: CanvasRect) => {
    if (!Object.values(viewport).every(Number.isFinite)) return items;
    const intersects = ({ bounds: b }: T) => b.x + b.w >= viewport.x && b.x <= viewport.x + viewport.w
      && b.y + b.h >= viewport.y && b.y <= viewport.y + viewport.h;
    const x1 = Math.floor(viewport.x / cellSize), x2 = Math.floor((viewport.x + viewport.w) / cellSize);
    const y1 = Math.floor(viewport.y / cellSize), y2 = Math.floor((viewport.y + viewport.h) / cellSize);
    // An overview can cover millions of empty cells: scanning the items is cheaper.
    if ((x2 - x1 + 1) * (y2 - y1 + 1) > cells.size) return items.filter(intersects);
    const candidates = new Set(spanning);
    for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) {
      cells.get(`${x}:${y}`)?.forEach((index) => candidates.add(index));
    }
    return [...candidates].sort((a, b) => a - b).map((index) => items[index]).filter(intersects);
  };
}
