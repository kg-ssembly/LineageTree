"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canUserReviewApprovalRequest = canUserReviewApprovalRequest;
exports.isApprovalExpired = isApprovalExpired;
function canUserReviewApprovalRequest(request, userId) {
    return !!userId && request.status === 'pending' && request.requestedByUserId !== userId && request.eligibleApproverIds.includes(userId);
}
function isApprovalExpired(request, now = Date.now()) {
    return request.status === 'pending' && request.expiresAtMillis <= now;
}
