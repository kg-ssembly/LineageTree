import test from 'node:test';
import assert from 'node:assert/strict';

import type { MergeRequestRecord } from '../components/dto/merge';
import { buildMergedTargetPersonUpdate, getRelationshipCanonicalKey } from '../providers/family-tree-merge-application';

function makeRequest(overrides: Partial<MergeRequestRecord> = {}): MergeRequestRecord {
  return {
    id: 'merge-1',
    sourceTreeId: 'source-tree',
    targetTreeId: 'target-tree',
    involvedTreeIds: ['source-tree', 'target-tree'],
    suggestedByUserId: 'user-1',
    suggestedByLabel: 'User 1',
    status: 'approved',
    preview: {
      sourceTree: { treeId: 'source-tree', treeName: 'Source', personCount: 2 },
      targetTree: { treeId: 'target-tree', treeName: 'Target', personCount: 2 },
      matches: [
        {
          id: 'match-a',
          sourcePersonId: 'source-a',
          targetPersonId: 'target-a',
          confidenceScore: 90,
          confidenceLabel: 'Very likely same person',
          signals: [],
          guidedQuestions: [],
          conflicts: [],
        },
        {
          id: 'match-b',
          sourcePersonId: 'source-b',
          targetPersonId: 'target-b',
          confidenceScore: 88,
          confidenceLabel: 'Very likely same person',
          signals: [],
          guidedQuestions: [],
          conflicts: [],
        },
      ],
      duplicateCount: 2,
      connectedRelationshipCount: 0,
      newBranchCount: 0,
      conflicts: [],
      combinedAssetCount: 0,
    },
    selectedMatchIds: ['match-a', 'match-b'],
    approvals: [],
    reviewerComments: [],
    conflictChoices: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('buildMergedTargetPersonUpdate applies conflict choices to the matching person only', () => {
  const request = makeRequest({
    conflictChoices: [
      { matchId: 'match-a', field: 'birthDate', keep: 'source' },
      { matchId: 'match-b', field: 'birthDate', keep: 'target' },
    ],
  });

  const matchA = request.preview.matches[0];
  const matchB = request.preview.matches[1];
  const timestamp = '2026-02-02T00:00:00.000Z';

  const mergedA = buildMergedTargetPersonUpdate(
    request,
    matchA,
    { firstName: 'Nomsa', birthDate: '1970-01-01', photos: [], lifeEvents: [] },
    { firstName: 'Nomsa', birthDate: '1980-01-01', photos: [], lifeEvents: [] },
    timestamp,
  );
  const mergedB = buildMergedTargetPersonUpdate(
    request,
    matchB,
    { firstName: 'Themba', birthDate: '1965-01-01', photos: [], lifeEvents: [] },
    { firstName: 'Themba', birthDate: '1975-01-01', photos: [], lifeEvents: [] },
    timestamp,
  );

  assert.equal(mergedA.birthDate, '1970-01-01');
  assert.equal(mergedB.birthDate, '1975-01-01');
});

test('getRelationshipCanonicalKey preserves relationship metadata differences', () => {
  const married = getRelationshipCanonicalKey({
    type: 'spouse',
    fromPersonId: 'a',
    toPersonId: 'b',
    relationshipStatus: 'married',
  });
  const divorced = getRelationshipCanonicalKey({
    type: 'spouse',
    fromPersonId: 'b',
    toPersonId: 'a',
    relationshipStatus: 'divorced',
  });
  const biological = getRelationshipCanonicalKey({
    type: 'parent-child',
    fromPersonId: 'parent',
    toPersonId: 'child',
    parentChildKind: 'biological',
  });
  const adopted = getRelationshipCanonicalKey({
    type: 'parent-child',
    fromPersonId: 'parent',
    toPersonId: 'child',
    parentChildKind: 'adopted',
  });

  assert.notEqual(married, divorced);
  assert.notEqual(biological, adopted);
});
