import { create } from 'zustand';

type UploadProgress = { label: string; progress: number; paused: boolean; pause: () => void; resume: () => void; cancel: () => void };
export const useSyncStatusStore = create<{
  source: 'connecting' | 'server' | 'cache';
  pendingWrites: boolean;
  upload: UploadProgress | null;
}>()(() => ({ source: 'connecting', pendingWrites: false, upload: null }));
