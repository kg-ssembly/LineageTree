import { create } from 'zustand';
import { recordMetric } from '../components/performance-metrics';

export const useOperationStore = create<{ pending: Record<string, number> }>(() => ({ pending: {} }));
export const PERSON_OPERATIONS = ['createPerson', 'createPersonWithRelationships', 'updatePerson', 'removePerson'];
export const RELATIONSHIP_OPERATIONS = ['addParentChildRelationship', 'addSpouseRelationship', 'editRelationship', 'removeRelationship'];
export const ACTIVITY_OPERATIONS = ['markNotificationSeen', 'markNotificationOpened', 'markNotificationActivityActioned', 'deleteNotification', 'deleteNotificationActivity', 'deleteAllNotifications', 'respondToMergeInvite', 'respondToTreeAccessRequest'];
export function isOperationPending(pending: Record<string, number>, operations: string[]) {
  return operations.some((name) => (pending[name] ?? 0) > 0);
}
export async function trackOperation<T>(name: string, work: () => Promise<T>, onPending: (pending: boolean) => void): Promise<T> {
  const started = performance.now();
  const update = (delta: number) => {
    useOperationStore.setState(({ pending }) => ({ pending: { ...pending, [name]: Math.max(0, (pending[name] ?? 0) + delta) } }));
    onPending(Object.values(useOperationStore.getState().pending).some((count) => count > 0));
  };
  update(1);
  try { return await work(); }
  finally { update(-1); recordMetric(`operation.${name}.ms`, performance.now() - started); }
}
