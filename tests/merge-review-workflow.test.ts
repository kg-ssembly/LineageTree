import test from 'node:test';
import assert from 'node:assert/strict';

import type { MergeApproval, MergeRequestRecord } from '../components/dto/merge';
import { buildMergeReviewUpdate } from '../providers/family-tree-merge-review-workflow';

function makeRequest(overrides: Partial<MergeRequestRecord> = {}): MergeRequestRecord {
  return {
    id: 'merge-1',
    sourceTreeId: 'source-tree',
    targetTreeId: 'target-tree',
    involvedTreeIds: ['source-tree', 'target-tree'],
    suggestedByUserId: 'owner-a',
    suggestedByLabel: 'Owner A',
    status: 'pending',
    preview: {
      sourceTree: { treeId: 'source-tree', treeName: 'Source Tree', personCount: 1 },
      targetTree: { treeId: 'target-tree', treeName: 'Target Tree', personCount: 1 },
      matches: [{
        id: 'match-1',
        sourcePersonId: 'source-person',
        targetPersonId: 'target-person',
        confidenceScore: 92,
        confidenceLabel: 'Very likely same person',
        signals: [],
        guidedQuestions: [],
        conflicts: [],
      }],
      duplicateCount: 1,
      connectedRelationshipCount: 0,
      newBranchCount: 0,
      conflicts: [],
      combinedAssetCount: 0,
    },
    selectedMatchIds: ['match-1'],
    approvals: [],
    reviewerComments: [],
    conflictChoices: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeApproval(treeId: string, editorUserId: string): MergeApproval {
  return {
    treeId,
    editorUserId,
    editorLabel: editorUserId,
    decision: 'approve',
    comment: '',
    decidedAt: '2026-01-01T00:00:00.000Z',
  };
}

test('buildMergeReviewUpdate preserves earlier approvals when a second tree approves later', () => {
  const initialRequest = makeRequest();

  const firstReview = buildMergeReviewUpdate({
    currentRequest: initialRequest,
    decision: 'approve',
    nextApprovals: [makeApproval('source-tree', 'editor-a')],
    sourceTreeId: 'source-tree',
    targetTreeId: 'target-tree',
  });

  assert.equal(firstReview.status, 'pending');
  assert.equal(firstReview.shouldApply, false);
  assert.equal(firstReview.approvals.length, 1);
  assert.equal(firstReview.approvals[0]?.treeId, 'source-tree');

  const requestAfterFirstApproval = {
    ...initialRequest,
    approvals: firstReview.approvals,
    reviewerComments: firstReview.reviewerComments,
    conflictChoices: firstReview.conflictChoices,
    selectedMatchIds: firstReview.selectedMatchIds,
    status: firstReview.status,
  };

  const secondReview = buildMergeReviewUpdate({
    currentRequest: requestAfterFirstApproval,
    decision: 'approve',
    nextApprovals: [makeApproval('target-tree', 'editor-b')],
    sourceTreeId: 'source-tree',
    targetTreeId: 'target-tree',
  });

  assert.equal(secondReview.status, 'approved');
  assert.equal(secondReview.shouldApply, true);
  assert.deepEqual(
    secondReview.approvals.map((approval) => approval.treeId).sort(),
    ['source-tree', 'target-tree'],
  );
});

test('buildMergeReviewUpdate keeps only one approval entry per editor-tree pair while updating latest decision', () => {
  const currentRequest = makeRequest({
    approvals: [{
      treeId: 'source-tree',
      editorUserId: 'editor-a',
      editorLabel: 'editor-a',
      decision: 'request-changes',
      comment: 'please review',
      decidedAt: '2026-01-01T00:00:00.000Z',
    }],
    status: 'changes-requested',
  });

  const reviewUpdate = buildMergeReviewUpdate({
    currentRequest,
    decision: 'approve',
    nextApprovals: [makeApproval('source-tree', 'editor-a')],
    sourceTreeId: 'source-tree',
    targetTreeId: 'target-tree',
  });

  assert.equal(reviewUpdate.approvals.length, 1);
  assert.equal(reviewUpdate.approvals[0]?.decision, 'approve');
  assert.equal(reviewUpdate.status, 'pending');
});
