import test from 'node:test';
import assert from 'node:assert/strict';
import { personDateBounds, isDefinitelyBefore } from '../components/person-date';
import { getPersonLifeStatus, getPersonPresenceLabel, formatPersonDate, parsePersonDate, type PersonRecord } from '../components/dto/person';
import { getPersonValidationFeedback } from '../components/family-tree-validation';
import { buildTreeInvitationLink, parseTreeInvitationIdentifier } from '../components/tree-invitation-link';

test('partial genealogy dates preserve precision and validate real calendar days', () => {
  assert.deepEqual(personDateBounds('1940'), { earliest: '1940-01-01', latest: '1940-12-31' });
  assert.deepEqual(personDateBounds('~1940'), { earliest: '1935-01-01', latest: '1945-12-31' });
  assert.equal(personDateBounds('1940-02-30'), null);
  assert.equal(personDateBounds('1941-02-29'), null);
  assert.ok(personDateBounds('1940-02-29'));
  assert.equal(personDateBounds('0000'), null);
  assert.equal(parsePersonDate('1940'), null);
  assert.equal(parsePersonDate('~1940'), null);
  assert.equal(formatPersonDate('~1940'), 'About 1940');
  assert.equal(isDefinitelyBefore('1940', '1940-06-01'), false);
  assert.equal(isDefinitelyBefore('~1940', '1943'), false);
  assert.equal(isDefinitelyBefore('1940', '1941'), true);
});

test('a deceased person with an unknown date remains deceased after serialization', () => {
  const person = JSON.parse(JSON.stringify({ lifeStatus: 'deceased', deathDate: '' })) as PersonRecord;
  assert.equal(getPersonLifeStatus(person), 'deceased');
  assert.equal(getPersonPresenceLabel(person), 'In memory');
  assert.equal(getPersonLifeStatus({ deathDate: '1940' }), 'deceased');
  assert.equal(getPersonLifeStatus({ deathDate: '', lifeStatus: 'unknown' }), 'unknown');
});

test('unknown dates and overlapping partial lifespan dates are accepted', () => {
  const person = { firstName: 'Test', lastName: 'Family', birthDate: '1940', deathDate: '1940-06-01', lifeStatus: 'deceased' as const, notes: '', lifeEvents: [] };
  assert.equal(getPersonValidationFeedback({ people: [], person }).errors.length, 0);
  assert.equal(getPersonValidationFeedback({ people: [], person: { ...person, birthDate: '', deathDate: '' } }).errors.length, 0);
  assert.ok(getPersonValidationFeedback({ people: [], person: { ...person, birthDate: '1941-02-29' } }).errors.length);
});

test('invitation links round trip and reject unexpected hosts or path injection', () => {
  assert.equal(parseTreeInvitationIdentifier(buildTreeInvitationLink('tree-123')), 'tree-123');
  assert.equal(parseTreeInvitationIdentifier('lineagetree://join/tree-123'), 'tree-123');
  assert.equal(parseTreeInvitationIdentifier('  person@example.com  '), 'person@example.com');
  assert.throws(() => parseTreeInvitationIdentifier('https://example.com/join/tree-123'));
  assert.throws(() => parseTreeInvitationIdentifier('https://lineagetree.web.app/join/a%2Fb'));
});
