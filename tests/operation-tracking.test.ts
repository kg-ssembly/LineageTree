import assert from 'node:assert/strict';
import test from 'node:test';
import { trackOperation, useOperationStore } from '../stores/operation-store';
import { selectiveStorage } from '../stores/selective-storage';

test('finishing one concurrent operation cannot clear the pending state of another', async () => {
  let release!: () => void;
  let busy = false;
  const first = trackOperation('first', () => new Promise<void>((resolve) => { release = resolve; }), (pending) => { busy = pending; });
  await trackOperation('second', async () => {}, (pending) => { busy = pending; });
  assert.equal(busy, true);
  release(); await first;
  assert.equal(busy, false);
  await assert.rejects(trackOperation('failure', async () => { throw new Error('offline'); }, () => {}));
  assert.equal(useOperationStore.getState().pending.failure, 0);
});
test('cache avoids rewriting family data on transient changes but persists selection and logout', async () => {
  let writes = 0;
  const storage = selectiveStorage<{ people: object[]; user: string | null }>({ getItem: () => null, removeItem: () => {}, setItem: () => { writes += 1; } });
  const people = [{}];
  await storage.setItem('cache', { state: { people, user: 'a' } });
  await storage.setItem('cache', { state: { people, user: 'a' } });
  assert.equal(writes, 1);
  await storage.setItem('cache', { state: { people: [], user: null } });
  assert.equal(writes, 2);
});
