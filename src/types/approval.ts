import type { PersonPhoto, PersonRecord } from './person';
import type { RelationshipRecord } from './relationship';

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'applied';
export type ApprovalDecisionMode = 'manual' | 'auto' | 'immediate';
export type ApprovalEntityType = 'person' | 'relationship';
export type ApprovalOperation = 'update-person' | 'delete-person' | 'create-relationship' | 'delete-relationship';

export interface ApprovalRequestPayload {
  beforePerson?: PersonRecord | null;
  afterPerson?: PersonRecord | null;
  deletedPerson?: PersonRecord | null;
  relationship?: RelationshipRecord | null;
  removedPhotos?: PersonPhoto[];
  uploadedPhotos?: PersonPhoto[];
}

export interface ApprovalRequest {
  id: string;
  treeId: string;
  entityType: ApprovalEntityType;
  operation: ApprovalOperation;
  targetId: string;
  title: string;
  description: string;
  status: ApprovalRequestStatus;
  decisionMode: ApprovalDecisionMode;
  requestedByUserId: string;
  requestedByLabel: string;
  eligibleApproverIds: string[];
  payload: ApprovalRequestPayload;
  expiresAt: string;
  expiresAtMillis: number;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedByUserId?: string;
  decidedByLabel?: string;
  appliedAt?: string;
}

export interface ApprovalSubmissionResult {
  status: 'queued' | 'applied';
  requestId?: string;
  message: string;
}

export function canUserReviewApprovalRequest(request: ApprovalRequest, userId?: string | null) {
  return !!userId && request.status === 'pending' && request.requestedByUserId !== userId && request.eligibleApproverIds.includes(userId);
}

export function isApprovalExpired(request: ApprovalRequest, now = Date.now()) {
  return request.status === 'pending' && request.expiresAtMillis <= now;
}

