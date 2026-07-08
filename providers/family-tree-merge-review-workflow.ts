import type { MergeApproval, MergeConflictChoice, MergeRequestRecord, MergeReviewDecision } from '../components/dto/merge';
import { validateSelectedMergeMatches } from './family-tree-merge-application';

type BuildMergeReviewUpdateInput = {
  currentRequest: MergeRequestRecord;
  decision: MergeReviewDecision;
  nextApprovals: MergeApproval[];
  comment?: string;
  conflictChoices?: MergeConflictChoice[];
  selectedMatchIds?: string[];
  sourceTreeId: string;
  targetTreeId: string;
};

export type MergeReviewUpdate = {
  approvals: MergeApproval[];
  reviewerComments: string[];
  conflictChoices: MergeConflictChoice[];
  selectedMatchIds: string[];
  status: MergeRequestRecord['status'];
  shouldApply: boolean;
};

export function buildMergeReviewUpdate({
  currentRequest,
  decision,
  nextApprovals,
  comment = '',
  conflictChoices = [],
  selectedMatchIds,
  sourceTreeId,
  targetTreeId,
}: BuildMergeReviewUpdateInput): MergeReviewUpdate {
  const nextSelectedMatchIds = selectedMatchIds
    ? [...new Set(selectedMatchIds.filter((matchId) => currentRequest.preview.matches.some((match) => match.id === matchId)))]
    : currentRequest.selectedMatchIds;

  if (decision === 'approve' && nextSelectedMatchIds.length === 0) {
    throw new Error('Select at least one person match before approving this merge.');
  }

  validateSelectedMergeMatches({
    ...currentRequest,
    selectedMatchIds: nextSelectedMatchIds,
  });

  const approvals = [
    ...currentRequest.approvals.filter((entry) => !nextApprovals.some((approval) => approval.treeId === entry.treeId && approval.editorUserId === entry.editorUserId)),
    ...nextApprovals,
  ];
  const reviewerComments = comment.trim() ? [...currentRequest.reviewerComments, comment.trim()] : currentRequest.reviewerComments;

  let status: MergeRequestRecord['status'] = currentRequest.status;
  if (decision === 'reject') {
    status = 'rejected';
  } else if (decision === 'request-changes') {
    status = 'changes-requested';
  } else {
    const approvedTreeIds = new Set(approvals.filter((entry) => entry.decision === 'approve').map((entry) => entry.treeId));
    status = approvedTreeIds.has(sourceTreeId) && approvedTreeIds.has(targetTreeId) ? 'approved' : 'pending';
  }

  return {
    approvals,
    reviewerComments,
    conflictChoices,
    selectedMatchIds: nextSelectedMatchIds,
    status,
    shouldApply: status === 'approved' && currentRequest.status !== 'approved',
  };
}
