import assert from 'node:assert/strict';
import test from 'node:test';
import { remainingRelativeIds } from '../components/hidden-relative-ids';

test('missing pagination metadata never invents hidden parents or children', () => {
  assert.deepEqual(remainingRelativeIds([], undefined, new Set()), []);
  assert.deepEqual(remainingRelativeIds([], [], new Set()), []);
});

test('remaining count includes unloaded children, deduplicates shared records and falls as children appear', () => {
  const recorded = ['a', 'b', 'c', 'd'];
  assert.deepEqual(remainingRelativeIds(['c'], recorded, new Set(['a', 'b'])), ['c', 'd']);
  assert.deepEqual(remainingRelativeIds([], recorded, new Set(recorded)), []);
});

test('already visible parents are excluded while loaded hidden parents stay available', () => {
  assert.deepEqual(remainingRelativeIds(['mother'], ['father', 'mother'], new Set(['father'])), ['mother']);
});
