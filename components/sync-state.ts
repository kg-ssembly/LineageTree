export type SyncSource = { source: 'connecting' | 'server' | 'cache' | 'error'; pendingWrites: boolean };
export function aggregateSyncSources(sources: Record<string, SyncSource>): SyncSource {
  const values = Object.values(sources);
  const source = values.some((entry) => entry.source === 'error') ? 'error'
    : !values.length || values.some((entry) => entry.source === 'connecting') ? 'connecting'
      : values.some((entry) => entry.source === 'cache') ? 'cache' : 'server';
  return { source, pendingWrites: values.some((entry) => entry.pendingWrites) };
}
