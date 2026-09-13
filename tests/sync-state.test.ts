import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateSyncSources } from '../components/sync-state';

test('tree acknowledgement cannot hide pending person writes or an offline relationship source', () => {
  assert.deepEqual(aggregateSyncSources({
    trees: { source: 'server', pendingWrites: false },
    people: { source: 'server', pendingWrites: true },
    relationships: { source: 'cache', pendingWrites: false },
  }), { source: 'cache', pendingWrites: true });
});
test('all sources must acknowledge before the app reports connected', () => {
  assert.equal(aggregateSyncSources({ trees: { source: 'server', pendingWrites: false }, people: { source: 'connecting', pendingWrites: false } }).source, 'connecting');
  assert.equal(aggregateSyncSources({ people: { source: 'error', pendingWrites: false } }).source, 'error');
  assert.equal(aggregateSyncSources({}).source, 'connecting');
});
