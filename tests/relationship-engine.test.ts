import test from 'node:test';
import assert from 'node:assert/strict';

import type { PersonRecord } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';
import { computeRelationshipInsight } from '../providers/relationship-intelligence';
import { validateProposedRelationship } from '../components/family-tree-validation';

function makePerson(id: string, firstName: string, gender: PersonRecord['gender']): PersonRecord {
  return {
    id,
    treeId: 'tree-1',
    treeMembershipIds: ['tree-1'],
    treeMemberships: [],
    ownerId: 'user-1',
    firstName,
    lastName: 'Example',
    birthDate: '',
    deathDate: '',
    gender,
    notes: '',
    lifeEvents: [],
    photos: [],
    preferredPhotoId: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeRelationship(
  id: string,
  type: RelationshipRecord['type'],
  fromPersonId: string,
  toPersonId: string,
): RelationshipRecord {
  return {
    id,
    treeId: 'tree-1',
    ownerId: 'user-1',
    type,
    fromPersonId,
    toPersonId,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

test('returns child-oriented labels from the selected source person perspective', () => {
  const people = [
    makePerson('parent', 'Alex', 'male'),
    makePerson('child', 'Jamie', 'female'),
  ];
  const relationships = [makeRelationship('parent-child', 'parent-child', 'parent', 'child')];

  const parentToChild = computeRelationshipInsight(people, relationships, 'parent', 'child');
  const childToParent = computeRelationshipInsight(people, relationships, 'child', 'parent');

  assert.equal(parentToChild?.relationship, 'Daughter');
  assert.equal(childToParent?.relationship, 'Father');
});

test('returns sibling labels using the compared person gender', () => {
  const people = [
    makePerson('parent', 'Morgan', 'other'),
    makePerson('a', 'Taylor', 'male'),
    makePerson('b', 'Casey', 'female'),
  ];
  const relationships = [
    makeRelationship('p-a', 'parent-child', 'parent', 'a'),
    makeRelationship('p-b', 'parent-child', 'parent', 'b'),
  ];

  const insight = computeRelationshipInsight(people, relationships, 'a', 'b');
  assert.equal(insight?.relationship, 'sister');
});

test('returns in-law labels from the selected source person perspective', () => {
  const people = [
    makePerson('parent', 'Robin', 'female'),
    makePerson('child', 'Jordan', 'male'),
    makePerson('inlaw', 'Avery', 'female'),
  ];
  const relationships = [
    makeRelationship('p-c', 'parent-child', 'parent', 'child'),
    makeRelationship('c-i', 'spouse', 'child', 'inlaw'),
  ];

  const insight = computeRelationshipInsight(people, relationships, 'parent', 'inlaw');
  assert.equal(insight?.relationship, 'Daughter-in-law');
});

test('blocks spouse relationships between ancestors and descendants', () => {
  const relationships = [makeRelationship('p-c', 'parent-child', 'parent', 'child')];

  const message = validateProposedRelationship({
    relationships,
    type: 'spouse',
    fromPersonId: 'parent',
    toPersonId: 'child',
  });

  assert.equal(message, 'A spouse relationship cannot be added between an ancestor and descendant.');
});

test('blocks spouse relationships between siblings', () => {
  const relationships = [
    makeRelationship('p-a', 'parent-child', 'parent', 'a'),
    makeRelationship('p-b', 'parent-child', 'parent', 'b'),
  ];

  const message = validateProposedRelationship({
    relationships,
    type: 'spouse',
    fromPersonId: 'a',
    toPersonId: 'b',
  });

  assert.equal(message, 'A spouse relationship cannot be added between siblings.');
});

test('blocks parent-child links for existing spouses', () => {
  const relationships = [makeRelationship('spouse', 'spouse', 'a', 'b')];

  const message = validateProposedRelationship({
    relationships,
    type: 'parent-child',
    fromPersonId: 'a',
    toPersonId: 'b',
  });

  assert.equal(message, 'A parent-child relationship cannot also be a spouse relationship.');
});
