import { limit, onSnapshot, orderBy, query, type DocumentData, type Query, type QueryDocumentSnapshot, type QueryConstraint } from 'firebase/firestore';
import { setActivityPage } from '../stores/activity-pagination-store';

/** Expand the live history window so edits/deletes and moving page boundaries stay consistent.
 * Pending work is independent of the history window, including older pending requests.
 */
export function subscribeToActivity<T extends { id: string; updatedAt: string }>(
  key: string, base: Query<DocumentData>, map: (doc: QueryDocumentSnapshot) => T,
  onChange: (records: T[]) => void, onError: ((error: Error) => void) | undefined,
  pageSize: number, pending?: QueryConstraint,
) {
  let active = true;
  let count = pageSize;
  let recent: T[] = [];
  let outstanding: T[] = [];
  let recentReady = false;
  let pendingReady = !pending;
  let stopRecent: (() => void) | undefined;
  const emit = () => {
    if (!active || !recentReady || !pendingReady) return;
    const records = new Map([...recent, ...outstanding].map((record) => [record.id, record]));
    onChange([...records.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)));
  };
  const listen = () => {
    stopRecent?.();
    setActivityPage(key, { hasMore: true, loading: true, loadMore });
    stopRecent = onSnapshot(query(base, orderBy('updatedAt', 'desc'), limit(count + 1)), (snapshot) => {
      if (!active) return;
      recent = snapshot.docs.slice(0, count).map(map);
      recentReady = true;
      setActivityPage(key, { hasMore: snapshot.size > count, loading: false, loadMore });
      emit();
    }, (error) => {
      if (!active) return;
      setActivityPage(key, { hasMore: true, loading: false, loadMore });
      onError?.(error);
    });
  };
  function loadMore() { if (active) { count += pageSize; listen(); } }
  const stopPending = pending ? onSnapshot(query(base, pending), (snapshot) => {
    if (!active) return;
    outstanding = snapshot.docs.map(map);
    pendingReady = true;
    emit();
  }, (error) => { if (active) onError?.(error); }) : undefined;
  listen();
  return () => { active = false; stopRecent?.(); stopPending?.(); setActivityPage(key, null); };
}
