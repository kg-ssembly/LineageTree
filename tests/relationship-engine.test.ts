import test from 'node:test';
import assert from 'node:assert/strict';

import type { PersonRecord } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';
import { computeRelationshipInsight } from '../providers/relationship-intelligence';
import { getPersonValidationFeedback, getRelationshipValidationFeedback, validateProposedRelationship } from '../components/family-tree-validation';

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

test('warns when adding a third biological parent', () => {
  const people = [
    makePerson('parent-a', 'Alex', 'male'),
    makePerson('parent-b', 'Blair', 'female'),
    makePerson('parent-c', 'Casey', 'female'),
    makePerson('child', 'Jordan', 'male'),
  ];
  const relationships = [
    { ...makeRelationship('a-child', 'parent-child', 'parent-a', 'child'), parentChildKind: 'biological' as const },
    { ...makeRelationship('b-child', 'parent-child', 'parent-b', 'child'), parentChildKind: 'biological' as const },
  ];

  const feedback = getRelationshipValidationFeedback({
    people,
    relationships,
    type: 'parent-child',
    fromPersonId: 'parent-c',
    toPersonId: 'child',
    parentChildKind: 'biological',
  });

  assert.ok(feedback.warnings.includes('This child would have more than two biological parents recorded. Please double-check the relationship type.'));
});

test('warns when child birth is after recorded parent death', () => {
  const parent = { ...makePerson('parent', 'Alex', 'male'), deathDate: '2000-01-01' };
  const child = { ...makePerson('child', 'Jordan', 'male'), birthDate: '2001-01-01' };

  const feedback = getRelationshipValidationFeedback({
    people: [parent, child],
    relationships: [],
    type: 'parent-child',
    fromPersonId: 'parent',
    toPersonId: 'child',
    parentChildKind: 'biological',
  });

  assert.ok(feedback.errors.includes('This child was recorded as born after the parent died. Please double-check the dates.'));
});

test('blocks biological parent-child relationships without birth dates for both people', () => {
  const parent = makePerson('parent', 'Alex', 'male');
  const child = { ...makePerson('child', 'Jordan', 'male'), birthDate: '2001-01-01' };

  const feedback = getRelationshipValidationFeedback({
    people: [parent, child],
    relationships: [],
    type: 'parent-child',
    fromPersonId: 'parent',
    toPersonId: 'child',
    parentChildKind: 'biological',
  });

  assert.ok(feedback.errors.includes('Birth dates are required for both family members before adding a biological parent-child relationship.'));
});

test('warns when spouse shared-child timelines are implausible', () => {
  const parentA = { ...makePerson('parent-a', 'Alex', 'male'), birthDate: '1995-01-01' };
  const parentB = { ...makePerson('parent-b', 'Blair', 'female'), birthDate: '1995-01-01' };
  const child = { ...makePerson('child', 'Jordan', 'male'), birthDate: '2005-01-01' };
  const relationships = [
    { ...makeRelationship('a-child', 'parent-child', 'parent-a', 'child'), parentChildKind: 'biological' as const },
    { ...makeRelationship('b-child', 'parent-child', 'parent-b', 'child'), parentChildKind: 'biological' as const },
  ];

  const feedback = getRelationshipValidationFeedback({
    people: [parentA, parentB, child],
    relationships,
    type: 'spouse',
    fromPersonId: 'parent-a',
    toPersonId: 'parent-b',
  });

  assert.ok(feedback.warnings.includes('These spouses have shared children whose recorded timelines look implausible. Please double-check the parents and birth dates.'));
});

test('warns on near-duplicate names including nickname variants', () => {
  const existing = { ...makePerson('john', 'John', 'male'), lastName: 'Example' };

  const feedback = getPersonValidationFeedback({
    people: [existing],
    person: {
      firstName: 'Jon',
      middleNames: '',
      lastName: 'Example',
      maidenName: '',
      birthDate: '',
      deathDate: '',
      notes: '',
      lifeEvents: [],
    },
  });

  assert.ok(feedback.warnings.includes('This looks very similar to an existing family member name. Please check for a near-duplicate before saving.'));
});

test('blocks future birth dates', () => {
  const nextYear = new Date().getFullYear() + 1;
  const feedback = getPersonValidationFeedback({
    people: [],
    person: {
      firstName: 'Jordan',
      middleNames: '',
      lastName: 'Example',
      maidenName: '',
      birthDate: `${nextYear}-01-01`,
      deathDate: '',
      notes: '',
      lifeEvents: [],
    },
  });

  assert.ok(feedback.errors.includes('Birth date cannot be in the future.'));
});

test('requires a birth date when validating a person', () => {
  const feedback = getPersonValidationFeedback({
    people: [],
    person: {
      firstName: 'Jordan',
      middleNames: '',
      lastName: 'Example',
      maidenName: '',
      birthDate: '',
      deathDate: '',
      notes: '',
      lifeEvents: [],
    },
  });

  assert.ok(feedback.errors.includes('Birth date is required.'));
});

test('warns when child surname differs from both biological parents without context', () => {
  const parentA = { ...makePerson('parent-a', 'Alex', 'male'), lastName: 'Mokoena' };
  const parentB = { ...makePerson('parent-b', 'Blair', 'female'), lastName: 'Nkosi' };
  const child = { ...makePerson('child', 'Jordan', 'male'), lastName: 'Dlamini' };
  const relationships = [
    { ...makeRelationship('b-child', 'parent-child', 'parent-b', 'child'), parentChildKind: 'biological' as const },
  ];

  const feedback = getRelationshipValidationFeedback({
    people: [parentA, parentB, child],
    relationships,
    type: 'parent-child',
    fromPersonId: 'parent-a',
    toPersonId: 'child',
    parentChildKind: 'biological',
  });

  assert.ok(feedback.warnings.includes('This child surname differs from both biological parents and there is no maiden-name or non-biological context recorded.'));
});

test('blocks future death dates', () => {
  const nextYear = new Date().getFullYear() + 1;
  const feedback = getPersonValidationFeedback({
    people: [],
    person: {
      firstName: 'Jordan',
      middleNames: '',
      lastName: 'Example',
      maidenName: '',
      birthDate: '2000-01-01',
      deathDate: `${nextYear}-01-01`,
      notes: '',
      lifeEvents: [],
    },
  });

  assert.ok(feedback.errors.includes('Death date cannot be in the future.'));
});

test('blocks life events outside the recorded lifespan', () => {
  const feedback = getPersonValidationFeedback({
    people: [],
    person: {
      firstName: 'Jordan',
      middleNames: '',
      lastName: 'Example',
      maidenName: '',
      birthDate: '2000-01-01',
      deathDate: '2020-01-01',
      notes: '',
      lifeEvents: [
        { id: 'event-1', type: 'moved', title: 'Moved', date: '2021-01-01', description: '' },
      ],
    },
  });

  assert.ok(feedback.errors.includes('Life events cannot be later than the death date.'));
  assert.ok(feedback.warnings.includes('This deceased person has present-day life events recorded after death. Please review those dates.'));
});

test('warns when adding another current spouse or partner', () => {
  const people = [
    makePerson('a', 'Alex', 'male'),
    makePerson('b', 'Blair', 'female'),
    makePerson('c', 'Casey', 'female'),
  ];
  const relationships = [
    { ...makeRelationship('a-b', 'spouse', 'a', 'b'), relationshipStatus: 'married' as const },
  ];

  const feedback = getRelationshipValidationFeedback({
    people,
    relationships,
    type: 'spouse',
    fromPersonId: 'a',
    toPersonId: 'c',
    relationshipStatus: 'partner',
  });

  assert.ok(feedback.warnings.includes('One of these family members already has another current spouse or partner recorded. Please review before saving.'));
});

test('warns when sibling birth dates are implausibly close without twin context', () => {
  const parent = { ...makePerson('parent', 'Alex', 'male'), birthDate: '1980-01-01' };
  const sibling = { ...makePerson('sibling', 'Taylor', 'female'), birthDate: '2010-01-01', notes: '' };
  const child = { ...makePerson('child', 'Jordan', 'male'), birthDate: '2010-05-01', notes: '' };
  const relationships = [
    { ...makeRelationship('p-s', 'parent-child', 'parent', 'sibling'), parentChildKind: 'biological' as const },
  ];

  const feedback = getRelationshipValidationFeedback({
    people: [parent, sibling, child],
    relationships,
    type: 'parent-child',
    fromPersonId: 'parent',
    toPersonId: 'child',
    parentChildKind: 'biological',
  });

  assert.ok(feedback.warnings.includes('This child birth date is unusually close to a sibling. If they were twins or triplets, add that context in notes.'));
});

test('requires at least one additional identity detail when creating a person', () => {
  const feedback = getPersonValidationFeedback({
    people: [],
    person: {
      firstName: 'Jordan',
      middleNames: '',
      lastName: '',
      maidenName: '',
      birthDate: '',
      deathDate: '',
      notes: '',
      lifeEvents: [],
    },
    pendingRelationships: [],
    requireIdentityContext: true,
  });

  assert.ok(feedback.errors.includes('Add at least one identifying detail: surname, birth date, or a relationship.'));
});

test('requires a last name when creating a person', () => {
  const feedback = getPersonValidationFeedback({
    people: [],
    person: {
      firstName: 'Jordan',
      middleNames: '',
      lastName: '',
      maidenName: '',
      birthDate: '',
      deathDate: '',
      notes: '',
      lifeEvents: [],
    },
  });

  assert.ok(feedback.errors.includes('Last name is required.'));
});

test('requires a relationship anchor when the create flow is in connected mode', () => {
  const feedback = getPersonValidationFeedback({
    people: [makePerson('existing', 'Alex', 'male')],
    person: {
      firstName: 'Jordan',
      middleNames: '',
      lastName: 'Example',
      maidenName: '',
      birthDate: '',
      deathDate: '',
      notes: '',
      lifeEvents: [],
    },
    pendingRelationships: [],
    requireRelationshipContext: true,
  });

  assert.ok(feedback.errors.includes('Add at least one relationship so this family member stays connected to the tree.'));
});

test('blocks duplicate photos before saving', () => {
  const feedback = getPersonValidationFeedback({
    people: [],
    person: {
      firstName: 'Jordan',
      middleNames: '',
      lastName: 'Example',
      maidenName: '',
      birthDate: '',
      deathDate: '',
      notes: '',
      lifeEvents: [],
    },
    existingPhotos: [],
    removedPhotos: [],
    newPhotoUris: ['file:///photo-a.jpg', 'file:///photo-a.jpg'],
  });

  assert.ok(feedback.errors.includes('Remove duplicate photos before saving.'));
});

test('blocks duplicate imported people with same attached relationships', () => {
  const existing = { ...makePerson('existing', 'Jordan', 'male'), lastName: 'Example' };
  const parent = makePerson('parent', 'Alex', 'male');
  const relationships = [
    { ...makeRelationship('p-existing', 'parent-child', 'parent', 'existing'), parentChildKind: 'biological' as const },
  ];

  const feedback = getPersonValidationFeedback({
    people: [existing, parent],
    relationships,
    person: {
      firstName: 'Jordan',
      middleNames: '',
      lastName: 'Example',
      maidenName: '',
      birthDate: '',
      deathDate: '',
      notes: '',
      lifeEvents: [],
    },
    pendingRelationships: [
      { mode: 'child-of', relatedPersonId: 'parent', parentChildKind: 'biological' },
    ],
    requireIdentityContext: true,
  });

  assert.ok(feedback.errors.includes('A family member with the same name and attached relationships already exists. Please review before importing a duplicate.'));
});
