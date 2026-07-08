import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldApplyApprovalImmediately } from '../providers/family-tree-approval-policy';
import { personRecordBelongsToTree } from '../providers/family-tree-membership';

test('shouldApplyApprovalImmediately requires no reviewers unless forced or approvals are disabled', () => {
  assert.equal(shouldApplyApprovalImmediately({
    eligibleApproverIds: ['editor-1'],
    approvalsDisabled: false,
  }), false);

  assert.equal(shouldApplyApprovalImmediately({
    eligibleApproverIds: [],
    approvalsDisabled: false,
  }), true);

  assert.equal(shouldApplyApprovalImmediately({
    eligibleApproverIds: ['editor-1'],
    approvalsDisabled: true,
  }), true);

  assert.equal(shouldApplyApprovalImmediately({
    eligibleApproverIds: ['editor-1'],
    approvalsDisabled: false,
    forceImmediateApproval: true,
  }), true);
});

test('personRecordBelongsToTree respects tree memberships before falling back to treeId', () => {
  assert.equal(personRecordBelongsToTree({
    treeMembershipIds: ['tree-a', 'tree-b'],
    treeId: 'legacy-tree',
  }, 'tree-b'), true);

  assert.equal(personRecordBelongsToTree({
    treeMembershipIds: [],
    treeId: 'legacy-tree',
  }, 'legacy-tree'), false);

  assert.equal(personRecordBelongsToTree({
    treeId: 'legacy-tree',
  }, 'legacy-tree'), true);
});
