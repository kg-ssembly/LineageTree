/** Reading a notification never resolves the underlying family decision. */
export function needsNotificationAction(item: { kind: string; status?: string; canReview?: boolean }) {
  if (item.canReview === false) return false;
  if (item.kind === 'approval' || item.kind === 'merge-invite' || item.kind === 'tree-access-request') return item.status === 'pending';
  if (item.kind === 'merge-request') return item.status === 'pending' || item.status === 'changes-requested';
  return false;
}
