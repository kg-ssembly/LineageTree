import { onSnapshot, type DocumentData, type Query, type QuerySnapshot } from 'firebase/firestore';
import { setSyncSource } from '../stores/sync-status-store';
import { recordMetric } from '../components/performance-metrics';

export function trackedSubscription(key: string, source: Query<DocumentData>, onChange: (snapshot: QuerySnapshot<DocumentData>) => void, onError?: (error: Error) => void) {
  setSyncSource(key, { source: 'connecting', pendingWrites: false });
  let active = true;
  const stop = onSnapshot(source, { includeMetadataChanges: true }, (snapshot) => {
    if (!active) return;
    setSyncSource(key, { source: snapshot.metadata.fromCache ? 'cache' : 'server', pendingWrites: snapshot.metadata.hasPendingWrites });
    recordMetric('subscription.documents', snapshot.docChanges().length);
    onChange(snapshot);
  }, (error) => {
    if (!active) return;
    setSyncSource(key, { source: 'error', pendingWrites: false });
    onError?.(error);
  });
  return () => { active = false; stop(); setSyncSource(key, null); };
}
