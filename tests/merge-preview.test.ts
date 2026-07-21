import test from 'node:test';
import assert from 'node:assert/strict';

import type { MergePreview } from '../components/dto/merge';
import type { PersonRecord } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';
import type { FamilyTree } from '../components/dto/tree';
import { buildMergePreview } from '../providers/merge-intelligence';

function makeTree(
  id: string,
  name: string,
  ownerId: string,
  surnameVariants: FamilyTree['surnameVariantGroups'] = [],
): FamilyTree {
  return {
    id,
    ownerId,
    name,
    discoverable: true,
    searchKeywords: [],
    memberIds: [ownerId],
    editorIds: [ownerId],
    collaborators: [{
      userId: ownerId,
      email: `${ownerId}@example.com`,
      displayName: `${ownerId} Owner`,
      role: 'owner',
    }],
    personAssignments: {},
    approvalWindowHours: 24,
    surnameVariantGroups: surnameVariants,
    connectedTreeIds: [],
    membershipHistory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makePerson(
  id: string,
  firstName: string,
  lastName: string,
  overrides: Partial<PersonRecord> = {},
): PersonRecord {
  return {
    id,
    treeId: overrides.treeId ?? 'tree-1',
    treeMembershipIds: [overrides.treeId ?? 'tree-1'],
    treeMemberships: [],
    ownerId: 'user-1',
    firstName,
    middleNames: '',
    lastName,
    maidenName: '',
    nicknames: [],
    clanName: '',
    familyBranch: '',
    hometown: '',
    birthPlace: '',
    surnameVariantHints: [],
    canonicalPersonId: '',
    duplicatePersonIds: [],
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

function findMatch(preview: MergePreview, sourcePersonId: string, targetPersonId: string) {
  return preview.matches.find((match) => (
    match.sourcePersonId === sourcePersonId && match.targetPersonId === targetPersonId
  ));
}

test('buildMergePreview promotes strong duplicate matches and reports aggregate stats', () => {
  const sourceTree = makeTree('source-tree', 'Khumalo Family', 'owner-a', [{
    id: 'surname-group',
    primarySurname: 'Khumalo',
    variants: ['Cumalo'],
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }]);
  const targetTree = makeTree('target-tree', 'Cumalo Branch', 'owner-b', [{
    id: 'surname-group',
    primarySurname: 'Cumalo',
    variants: ['Khumalo'],
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }]);

  const sourceParent = makePerson('source-parent', 'Nomsa', 'Khumalo', {
    treeId: 'source-tree',
    birthDate: '1960-03-10',
    gender: 'female',
  });
  const sourceSpouse = makePerson('source-spouse', 'Themba', 'Khumalo', {
    treeId: 'source-tree',
    birthDate: '1958-11-05',
    gender: 'male',
  });
  const sourceChild = makePerson('source-child', 'Lindiwe', 'Khumalo', {
    treeId: 'source-tree',
    birthDate: '1985-06-01',
    gender: 'female',
    middleNames: 'Grace',
    hometown: 'Soweto',
    birthPlace: 'Johannesburg',
    clanName: 'Zulu',
    photos: [{
      id: 'source-photo',
      url: 'https://example.com/source.jpg',
      path: '/source.jpg',
      createdAt: '2026-01-01T00:00:00.000Z',
    }],
    lifeEvents: [{
      id: 'source-event',
      type: 'graduated',
      title: 'Graduated',
      date: '2007-01-01',
      description: '',
    }],
  });

  const targetParent = makePerson('target-parent', 'Nomsa', 'Khumalo', {
    treeId: 'target-tree',
    birthDate: '1960-03-10',
    gender: 'female',
  });
  const targetSpouse = makePerson('target-spouse', 'Themba', 'Khumalo', {
    treeId: 'target-tree',
    birthDate: '1983-09-09',
    gender: 'male',
  });
  const targetChild = makePerson('target-child', 'Lindiwe', 'Cumalo', {
    treeId: 'target-tree',
    birthDate: '1986-06-01',
    gender: 'female',
    middleNames: 'Grace',
    hometown: 'Soweto',
    birthPlace: 'Johannesburg',
    clanName: 'Zulu',
    surnameVariantHints: ['Khumalo'],
    photos: [{
      id: 'target-photo',
      url: 'https://example.com/target.jpg',
      path: '/target.jpg',
      createdAt: '2026-01-01T00:00:00.000Z',
    }],
    lifeEvents: [{
      id: 'target-event',
      type: 'moved',
      title: 'Moved',
      date: '2010-01-01',
      description: '',
    }],
  });

  const preview = buildMergePreview(
    {
      tree: sourceTree,
      people: [sourceParent, sourceSpouse, sourceChild],
      relationships: [
        makeRelationship('source-parent-child', 'parent-child', 'source-parent', 'source-child'),
        makeRelationship('source-spouse-link', 'spouse', 'source-child', 'source-spouse'),
      ],
    },
    {
      tree: targetTree,
      people: [targetParent, targetSpouse, targetChild],
      relationships: [
        makeRelationship('target-parent-child', 'parent-child', 'target-parent', 'target-child'),
        makeRelationship('target-spouse-link', 'spouse', 'target-child', 'target-spouse'),
      ],
    },
  );

  const strongMatch = findMatch(preview, 'source-child', 'target-child');

  assert.ok(strongMatch);
  assert.equal(strongMatch?.confidenceLabel, 'Very likely same person');
  assert.ok((strongMatch?.confidenceScore ?? 0) >= 85);
  assert.ok(strongMatch?.signals.some((signal) => signal.label === 'Surname variants' && signal.matched));
  assert.ok(strongMatch?.signals.some((signal) => signal.label === 'Parents' && signal.matched));
  assert.ok(strongMatch?.signals.some((signal) => signal.label === 'Spouse' && signal.matched));
  assert.deepEqual(strongMatch?.conflicts, [
    {
      matchId: 'source-child:target-child',
      field: 'birthDate',
      sourceValue: '1985-06-01',
      targetValue: '1986-06-01',
    },
    {
      matchId: 'source-child:target-child',
      field: 'surname',
      sourceValue: 'Khumalo',
      targetValue: 'Cumalo',
    },
  ]);

  assert.equal(preview.sourceTree.treeId, 'source-tree');
  assert.equal(preview.targetTree.treeId, 'target-tree');
  assert.equal(preview.duplicateCount, 1);
  assert.ok(preview.connectedRelationshipCount > 0);
  assert.equal(preview.newBranchCount, 0);
  assert.equal(preview.combinedAssetCount, 4);
});

test('buildMergePreview filters out low-confidence pairs that do not meet the preview threshold', () => {
  const preview = buildMergePreview(
    {
      tree: makeTree('source-tree', 'Source Tree', 'owner-a'),
      people: [
        makePerson('source-1', 'Ava', 'Smith', {
          treeId: 'source-tree',
          birthDate: '1980-01-01',
          gender: 'female',
        }),
      ],
      relationships: [],
    },
    {
      tree: makeTree('target-tree', 'Target Tree', 'owner-b'),
      people: [
        makePerson('target-1', 'Noah', 'Dlamini', {
          treeId: 'target-tree',
          birthDate: '2005-01-01',
          gender: 'male',
        }),
      ],
      relationships: [],
    },
  );

  assert.deepEqual(preview.matches, []);
  assert.equal(preview.duplicateCount, 0);
  assert.equal(preview.connectedRelationshipCount, 0);
  assert.equal(preview.newBranchCount, 1);
  assert.equal(preview.conflicts.length, 0);
});

test('buildMergePreview includes guided questions and aggregates conflicts across matches', () => {
  const sharedSourceTree = makeTree('source-tree', 'Source Tree', 'owner-a');
  const sharedTargetTree = makeTree('target-tree', 'Target Tree', 'owner-b');

  const preview = buildMergePreview(
    {
      tree: sharedSourceTree,
      people: [
        makePerson('source-1', 'Jordan', 'Example', {
          treeId: 'source-tree',
          birthDate: '1980-01-01',
          hometown: 'Durban',
          gender: 'male',
        }),
        makePerson('source-2', 'Ava', 'Example', {
          treeId: 'source-tree',
          birthDate: '1982-01-01',
          gender: 'female',
        }),
      ],
      relationships: [],
    },
    {
      tree: sharedTargetTree,
      people: [
        makePerson('target-1', 'Jordan', 'Mismatch', {
          treeId: 'target-tree',
          birthDate: '1980-01-01',
          hometown: 'Cape Town',
          gender: 'male',
        }),
        makePerson('target-2', 'Ava', 'Variant', {
          treeId: 'target-tree',
          birthDate: '1982-01-01',
          gender: 'female',
          surnameVariantHints: ['Example'],
        }),
      ],
      relationships: [],
    },
  );

  const first = findMatch(preview, 'source-1', 'target-1');
  const second = findMatch(preview, 'source-2', 'target-2');

  assert.ok(first);
  assert.ok(second);
  assert.deepEqual(first?.guidedQuestions.map((question) => question.id), [
    'same-person-source-1-target-1',
    'same-parent-source-1-target-1',
  ]);
  assert.ok(preview.conflicts.some((conflict) => (
    conflict.field === 'surname' && conflict.sourceValue === 'Example' && conflict.targetValue === 'Mismatch'
  )));
  assert.ok(preview.conflicts.some((conflict) => (
    conflict.field === 'hometown' && conflict.sourceValue === 'Durban' && conflict.targetValue === 'Cape Town'
  )));
  assert.ok(preview.matches.every((match) => match.confidenceScore <= 99 && match.confidenceScore >= 35));
});

test('buildMergePreview keeps matches that land exactly on the preview threshold', () => {
  const preview = buildMergePreview(
    {
      tree: makeTree('source-tree', 'Source Tree', 'owner-a'),
      people: [
        makePerson('source-1', 'Jordan', 'Example', {
          treeId: 'source-tree',
          gender: 'male',
        }),
        makePerson('shared-child-source', 'Jamie', 'Example', {
          treeId: 'source-tree',
        }),
      ],
      relationships: [
        makeRelationship('source-parent-child', 'parent-child', 'source-1', 'shared-child-source'),
      ],
    },
    {
      tree: makeTree('target-tree', 'Target Tree', 'owner-b'),
      people: [
        makePerson('target-1', 'Jordan', 'Other', {
          treeId: 'target-tree',
          gender: 'male',
        }),
        makePerson('shared-child-target', 'Jamie', 'Example', {
          treeId: 'target-tree',
        }),
      ],
      relationships: [
        makeRelationship('target-parent-child', 'parent-child', 'target-1', 'shared-child-target'),
      ],
    },
  );

  const match = findMatch(preview, 'source-1', 'target-1');

  assert.ok(match);
  assert.equal(match?.confidenceScore, 35);
  assert.equal(match?.confidenceLabel, 'Weak match');
});

test('buildMergePreview caps confidence scores at 99 even when all signals match', () => {
  const sourceTree = makeTree('source-tree', 'Source Tree', 'owner-a', [{
    id: 'surname-group',
    primarySurname: 'Example',
    variants: ['Sample'],
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }]);
  const targetTree = makeTree('target-tree', 'Target Tree', 'owner-b', [{
    id: 'surname-group',
    primarySurname: 'Sample',
    variants: ['Example'],
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }]);

  const sourceParent = makePerson('source-parent', 'Alex', 'Example', {
    treeId: 'source-tree',
    gender: 'male',
  });
  const sourceChild = makePerson('source-child', 'Jordan', 'Example', {
    treeId: 'source-tree',
    middleNames: 'Lee',
    surnameVariantHints: ['Sample'],
    birthDate: '1980-01-01',
    gender: 'female',
    birthPlace: 'Durban',
    hometown: 'Durban',
    clanName: 'Zulu',
    familyBranch: 'North',
    photos: [{
      id: 'source-photo',
      url: 'https://example.com/source.jpg',
      path: '/source.jpg',
      createdAt: '2026-01-01T00:00:00.000Z',
    }],
  });
  const sourceSpouse = makePerson('source-spouse', 'Morgan', 'Example', {
    treeId: 'source-tree',
  });
  const sourceGrandchild = makePerson('source-grandchild', 'Jamie', 'Example', {
    treeId: 'source-tree',
  });

  const targetParent = makePerson('target-parent', 'Alex', 'Example', {
    treeId: 'target-tree',
    gender: 'male',
  });
  const targetChild = makePerson('target-child', 'Jordan', 'Sample', {
    treeId: 'target-tree',
    middleNames: 'Lee',
    surnameVariantHints: ['Example'],
    birthDate: '1980-01-01',
    gender: 'female',
    birthPlace: 'Durban',
    hometown: 'Durban',
    clanName: 'Zulu',
    familyBranch: 'North',
    photos: [{
      id: 'target-photo',
      url: 'https://example.com/target.jpg',
      path: '/target.jpg',
      createdAt: '2026-01-01T00:00:00.000Z',
    }],
  });
  const targetSpouse = makePerson('target-spouse', 'Morgan', 'Example', {
    treeId: 'target-tree',
  });
  const targetGrandchild = makePerson('target-grandchild', 'Jamie', 'Example', {
    treeId: 'target-tree',
  });

  const preview = buildMergePreview(
    {
      tree: sourceTree,
      people: [sourceParent, sourceChild, sourceSpouse, sourceGrandchild],
      relationships: [
        makeRelationship('source-parent-child', 'parent-child', 'source-parent', 'source-child'),
        makeRelationship('source-spouse-link', 'spouse', 'source-child', 'source-spouse'),
        makeRelationship('source-child-link', 'parent-child', 'source-child', 'source-grandchild'),
      ],
    },
    {
      tree: targetTree,
      people: [targetParent, targetChild, targetSpouse, targetGrandchild],
      relationships: [
        makeRelationship('target-parent-child', 'parent-child', 'target-parent', 'target-child'),
        makeRelationship('target-spouse-link', 'spouse', 'target-child', 'target-spouse'),
        makeRelationship('target-child-link', 'parent-child', 'target-child', 'target-grandchild'),
      ],
    },
  );

  const match = findMatch(preview, 'source-child', 'target-child');

  assert.ok(match);
  assert.equal(match?.confidenceScore, 99);
  assert.equal(match?.confidenceLabel, 'Very likely same person');
});
