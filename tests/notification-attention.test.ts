import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsNotificationAction } from '../components/notification-attention';

test('completed changes and access responses are updates, not tasks', () => {
  for (const kind of ['approval', 'merge-request', 'merge-history', 'membership', 'tree-access-response']) {
    assert.equal(needsNotificationAction({ kind, status: 'applied' }), false);
  }
});
test('pending decisions stay actionable until resolved', () => {
  for (const kind of ['approval', 'merge-request', 'merge-invite', 'tree-access-request']) {
    assert.equal(needsNotificationAction({ kind, status: 'pending' }), true);
    assert.equal(needsNotificationAction({ kind, status: 'pending', canReview: false }), false);
  }
  assert.equal(needsNotificationAction({ kind: 'merge-request', status: 'changes-requested' }), true);
});

 test('opening or marking a pending request read cannot resolve it', () => {
  const pending = { kind: 'approval', status: 'pending', canReview: true, seen: true, opened: true, actioned: true };
  assert.equal(needsNotificationAction(pending), true);
  assert.equal(needsNotificationAction({ ...pending, status: 'applied' }), false);
 });
