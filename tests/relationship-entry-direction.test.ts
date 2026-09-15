import assert from 'node:assert/strict';
import test from 'node:test';
import { entrySubmissionMode, oppositeEntryMode } from '../components/relationship-entry-direction';

test('adding a parent from Members selects a child but adding a parent inside a profile selects a parent', () => {
  const newParent = entrySubmissionMode('parent-of', 'new-person');
  assert.equal(newParent, 'parent-of');
  assert.equal(oppositeEntryMode(newParent), 'child-of');
  const existingParent = entrySubmissionMode('parent-of', 'anchor-person');
  assert.equal(existingParent, 'child-of');
  assert.equal(oppositeEntryMode(existingParent), 'parent-of');
});

test('child selection reverses with perspective and spouse selection stays symmetric', () => {
  assert.equal(entrySubmissionMode('child-of', 'new-person'), 'child-of');
  assert.equal(entrySubmissionMode('child-of', 'anchor-person'), 'parent-of');
  for (const perspective of ['new-person', 'anchor-person'] as const) {
    assert.equal(entrySubmissionMode('spouse-of', perspective), 'spouse-of');
    assert.equal(oppositeEntryMode(entrySubmissionMode('spouse-of', perspective)), 'spouse-of');
  }
});
