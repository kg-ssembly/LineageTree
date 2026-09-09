"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSelectedMergeMatches = validateSelectedMergeMatches;
exports.buildMergeReviewUpdate = buildMergeReviewUpdate;
function validateSelectedMergeMatches(request) {
    const sourcePersonIds = new Set();
    const targetPersonIds = new Set();
    request.preview.matches.filter((match) => request.selectedMatchIds.includes(match.id)).forEach((match) => {
        if (sourcePersonIds.has(match.sourcePersonId)) {
            throw new Error('Each source family member can only be matched once in a merge.');
        }
        if (targetPersonIds.has(match.targetPersonId)) {
            throw new Error('Each target family member can only be matched once in a merge.');
        }
        sourcePersonIds.add(match.sourcePersonId);
        targetPersonIds.add(match.targetPersonId);
    });
}
function buildMergeReviewUpdate({ currentRequest, decision, nextApprovals, comment = '', conflictChoices = [], selectedMatchIds, sourceTreeId, targetTreeId, }) {
    const nextSelectedMatchIds = selectedMatchIds
        ? [...new Set(selectedMatchIds.filter((matchId) => currentRequest.preview.matches.some((match) => match.id === matchId)))]
        : currentRequest.selectedMatchIds;
    if (decision === 'approve' && nextSelectedMatchIds.length === 0) {
        throw new Error('Select at least one person match before approving this merge.');
    }
    if (decision === 'approve') {
        validateSelectedMergeMatches({
            ...currentRequest,
            selectedMatchIds: nextSelectedMatchIds,
        });
    }
    const approvals = [
        ...currentRequest.approvals.filter((entry) => !nextApprovals.some((approval) => approval.treeId === entry.treeId && approval.editorUserId === entry.editorUserId)),
        ...nextApprovals,
    ];
    const reviewerComments = comment.trim() ? [...currentRequest.reviewerComments, comment.trim()] : currentRequest.reviewerComments;
    let status = currentRequest.status;
    if (decision === 'reject') {
        status = 'rejected';
    }
    else if (decision === 'request-changes') {
        status = 'changes-requested';
    }
    else {
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
