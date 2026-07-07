import test from 'node:test';
import assert from 'node:assert/strict';

import type { PersonRecord } from '../components/dto/person';
import { formatPersonName } from '../components/person-formatting';

function makePerson(overrides: Partial<PersonRecord> = {}): PersonRecord {
  return {
    id: 'person-1',
    treeId: 'tree-1',
    treeMembershipIds: ['tree-1'],
    treeMemberships: [],
    ownerId: 'user-1',
    firstName: 'Jordan',
    middleNames: '',
    lastName: 'Example',
    maidenName: '',
    birthDate: '',
    deathDate: '',
    gender: 'unspecified',
    notes: '',
    lifeEvents: [],
    photos: [],
    preferredPhotoId: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('formats maiden names without inserting an extra leading space when no surname exists', () => {
  const person = makePerson({
    lastName: '',
    maidenName: 'Khumalo',
  });

  assert.equal(formatPersonName(person), 'Jordan (Khumalo)');
});

test('formats a maiden name by appending it to the base name when a surname exists', () => {
  const person = makePerson({
    maidenName: 'Khumalo',
  });

  assert.equal(formatPersonName(person), 'Jordan Example (Khumalo)');
});
