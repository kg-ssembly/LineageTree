import { create } from 'zustand';
import { aggregateSyncSources, type SyncSource } from '../components/sync-state';

type UploadProgress = { label: string; progress: number; paused: boolean; pause: () => void; resume: () => void; cancel: () => void };
export const useSyncStatusStore = create<{
  source: SyncSource['source'];
  sources: Record<string, SyncSource>;
  pendingWrites: boolean;
  upload: UploadProgress | null;
}>()(() => ({ source: 'connecting', sources: {}, pendingWrites: false, upload: null }));

export function setSyncSource(key: string, value: SyncSource | null) {
  useSyncStatusStore.setState((state) => {
    const sources = { ...state.sources };
    if (value) sources[key] = value;
    else delete sources[key];
    return { sources, ...aggregateSyncSources(sources) };
  });
}
