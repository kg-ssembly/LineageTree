type Metric = { name: string; value: number; at: number };
const samples: Metric[] = [];
const starts = new Map<string, number>();
const clock = () => globalThis.performance?.now() ?? Date.now();

/** Bounded, local diagnostics. Never record names, identifiers, photos or profile content. */
export function recordMetric(name: string, value: number) {
  samples.push({ name, value, at: Date.now() });
  if (samples.length > 300) samples.shift();
}
export function startMetric(name: string) { starts.set(name, clock()); }
export function finishMetric(name: string) {
  const start = starts.get(name);
  if (start === undefined) return;
  recordMetric(name, clock() - start);
  starts.delete(name);
}
export function measureWork<T>(name: string, work: () => T): T {
  const start = clock();
  try { return work(); } finally { recordMetric(name, clock() - start); }
}
export function getPerformanceMetrics() { return samples.map((sample) => ({ ...sample })); }
