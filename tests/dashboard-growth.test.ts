import test from 'node:test';
import assert from 'node:assert/strict';

import type { PersonRecord } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';
import { translate, setActiveLanguage } from '../i18n';
import { buildMissingDetailSuggestionForPerson, buildTreeSuggestions } from '../app/screens/profile-shared/suggestions';
import { buildBranchGrowth } from '../app/screens/tree-tabs/tree-settings/family-highlights-helpers';

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

function makeRelationship(overrides: Partial<RelationshipRecord> = {}): RelationshipRecord {
  return {
    id: 'relationship-1',
    treeId: 'tree-1',
    ownerId: 'user-1',
    type: 'parent-child',
    fromPersonId: 'person-1',
    toPersonId: 'person-2',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test.before(() => {
  setActiveLanguage('en');
});

test('buildMissingDetailSuggestionForPerson accumulates multiple gaps for the same person', () => {
  const person = makePerson({
    firstName: 'Ava',
    birthDate: '',
    photos: [],
  });

  const suggestion = buildMissingDetailSuggestionForPerson(person, [], translate);

  assert.ok(suggestion);
  assert.equal(suggestion.actionTarget.kind, 'edit-profile');
  assert.match(suggestion.description, /Missing birth date/i);
  assert.match(suggestion.description, /Missing profile photo/i);
  assert.match(suggestion.description, /Missing family connections/i);
});

test('buildTreeSuggestions keeps self-linking visible for small unlinked trees', () => {
  const people = [
    makePerson({ id: 'person-1', firstName: 'Ava' }),
    makePerson({ id: 'person-2', firstName: 'Sam', lastName: 'Branch' }),
  ];

  const suggestions = buildTreeSuggestions({
    people,
    currentAssignedPerson: null,
    currentSelfAssignmentSuggestionsCount: 1,
    relationships: [],
    canEdit: true,
    showFollowUpTreePrompts: true,
  }, translate);

  assert.ok(suggestions.storySuggestions.some((suggestion) => suggestion.id === 'link-self'));
});

test('buildTreeSuggestions shows profile detail prompts before a tree reaches ten people', () => {
  const currentAssignedPerson = makePerson({
    id: 'self',
    firstName: 'Ava',
    birthDate: '',
    photos: [],
    lifeEvents: [],
  });

  const suggestions = buildTreeSuggestions({
    people: [currentAssignedPerson],
    currentAssignedPerson,
    currentSelfAssignmentSuggestionsCount: 0,
    relationships: [],
    canEdit: true,
    showFollowUpTreePrompts: false,
  }, translate);

  assert.ok(suggestions.storySuggestions.some((suggestion) => suggestion.id === 'birth'));
  assert.ok(suggestions.storySuggestions.some((suggestion) => suggestion.id === 'photo'));
});

test('buildBranchGrowth prioritises recently growing branches over larger but stale surnames', () => {
  const people = [
    makePerson({ id: 'fresh-1', lastName: 'Fresh', createdAt: '2026-07-08T00:00:00.000Z' }),
    makePerson({ id: 'fresh-2', lastName: 'Fresh', createdAt: '2026-07-07T00:00:00.000Z' }),
    makePerson({ id: 'stale-1', lastName: 'Stale', createdAt: '2026-01-01T00:00:00.000Z' }),
    makePerson({ id: 'stale-2', lastName: 'Stale', createdAt: '2026-01-02T00:00:00.000Z' }),
    makePerson({ id: 'stale-3', lastName: 'Stale', createdAt: '2026-01-03T00:00:00.000Z' }),
  ];

  const branchGrowth = buildBranchGrowth(people, 'Unknown');

  assert.equal(branchGrowth[0]?.surname, 'Fresh');
  assert.equal(branchGrowth[0]?.fresh, 2);
  assert.equal(branchGrowth[0]?.representativePersonId, 'fresh-1');
  assert.equal(branchGrowth[1]?.surname, 'Stale');
});

test('buildMissingDetailSuggestionForPerson keeps photo-focused action when birth date exists', () => {
  const person = makePerson({
    id: 'photo-missing',
    firstName: 'Jordan',
    birthDate: '1990-01-01',
    photos: [],
  });
  const relationships = [makeRelationship({ fromPersonId: 'photo-missing', toPersonId: 'person-2' })];

  const suggestion = buildMissingDetailSuggestionForPerson(person, relationships, translate);

  assert.deepEqual(suggestion?.actionTarget, {
    kind: 'open-profile',
    personId: 'photo-missing',
    initialTab: 'memories-gallery',
    initialMemorySectionTab: 'photos',
  });
});
