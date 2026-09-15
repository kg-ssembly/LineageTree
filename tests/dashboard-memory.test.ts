import test from 'node:test';
import assert from 'node:assert/strict';
import type { PersonRecord } from '../components/dto/person';
import { buildMemoryPayload, upcomingOccasions } from '../app/screens/tree-tabs/home/dashboard-helpers';
const person = {
  id: 'p', treeId: 't', firstName: 'Ava', lastName: 'Family', notes: 'Existing story',
  birthDate: '1980-09-20', deathDate: '', lifeStatus: 'living', gender: 'unspecified',
  maidenName: 'Birth', birthSurnameStatus: 'different', surnameVariantHints: ['Variant'],
  lifeEvents: [], photos: [{ id: 'photo', url: 'local', path: 'path', createdAt: '' }], preferredPhotoId: 'photo',
} as unknown as PersonRecord;

test('writing a dashboard memory appends notes and preserves recorded identity and photos', () => {
  const payload = buildMemoryPayload(person, '  New memory  ', '');
  assert.equal(payload.notes, 'Existing story\n\nNew memory');
  assert.equal(payload.birthSurnameStatus, 'different');
  assert.deepEqual(payload.surnameVariantHints, ['Variant']);
  assert.deepEqual(payload.existingPhotos, person.photos);
  assert.equal(payload.preferredPhotoRef, 'photo');
});

test('photo captions never replace biography notes', () => {
  const payload = buildMemoryPayload(person, '  Photo story  ', 'photo-uri');
  assert.equal(payload.notes, person.notes);
  assert.deepEqual(payload.newPhotos, [{ uri: 'photo-uri', description: 'Photo story' }]);
  assert.deepEqual(payload.removedPhotos, []);
});

test('occasions exclude partial dates and birthdays of deceased people', () => {
  const now = new Date(2026, 8, 15);
  assert.equal(upcomingOccasions([person], now)[0].daysUntil, 5);
  for (const birthDate of ['1980', '~1980', '1980-02-30']) {
    assert.deepEqual(upcomingOccasions([{ ...person, birthDate }], now), []);
  }
  assert.deepEqual(upcomingOccasions([{ ...person, lifeStatus: 'deceased' }], now), []);
});

test('occasions cross the year boundary and keep leap dates exact', () => {
  const next = upcomingOccasions([{ ...person, birthDate: '1980-01-02' }], new Date(2026, 11, 30))[0];
  assert.equal(next.next.getFullYear(), 2027);
  assert.equal(next.daysUntil, 3);
  assert.deepEqual(upcomingOccasions([{ ...person, birthDate: '1980-02-29' }], new Date(2027, 1, 1)), []);
  assert.equal(upcomingOccasions([{ ...person, birthDate: '1980-02-29' }], new Date(2028, 1, 1))[0].next.getDate(), 29);
});
