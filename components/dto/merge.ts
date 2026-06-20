import type { PersonRecord } from './person';

export type MatchStrengthLabel = 'Very likely same person' | 'Possible match' | 'Weak match' | 'Unlikely match';
export type MergeRequestStatus = 'draft' | 'pending' | 'changes-requested' | 'approved' | 'rejected' | 'applied' | 'undone';
export type MergeReviewDecision = 'approve' | 'reject' | 'request-changes';
export type GuidedMatchAnswerValue = 'yes' | 'no' | 'not-sure';

export interface GuidedMatchQuestion {
  id: string;
  prompt: string;
  answer?: GuidedMatchAnswerValue;
}

export interface MergeConflictChoice {
  field: string;
  keep: 'source' | 'target' | 'both' | 'later';
  resolvedValue?: string | string[];
}

export interface MergeConflict {
  field: string;
  sourceValue: string;
  targetValue: string;
  resolution?: MergeConflictChoice;
}

export interface MergeMatchSignal {
  label: string;
  weight: number;
  matched: boolean;
  detail: string;
}

export interface MergePersonMatch {
  id: string;
  sourcePersonId: string;
  targetPersonId: string;
  confidenceScore: number;
  confidenceLabel: MatchStrengthLabel;
  signals: MergeMatchSignal[];
  guidedQuestions: GuidedMatchQuestion[];
  conflicts: MergeConflict[];
}

export interface MergeTreeSummary {
  treeId: string;
  treeName: string;
  personCount: number;
}

export interface MergePreview {
  sourceTree: MergeTreeSummary;
  targetTree: MergeTreeSummary;
  matches: MergePersonMatch[];
  duplicateCount: number;
  connectedRelationshipCount: number;
  newBranchCount: number;
  conflicts: MergeConflict[];
  combinedAssetCount: number;
}

export interface MergeApproval {
  treeId: string;
  editorUserId: string;
  editorLabel: string;
  decision: MergeReviewDecision;
  comment?: string;
  decidedAt: string;
}

export interface MergeRequestSnapshot {
  trees: Array<{ id: string; data: Record<string, unknown> }>;
  people: Array<{ id: string; data: Record<string, unknown> }>;
  relationships: Array<{ id: string; data: Record<string, unknown> }>;
}

export interface MergeRequestRecord {
  id: string;
  sourceTreeId: string;
  targetTreeId: string;
  involvedTreeIds: string[];
  suggestedByUserId: string;
  suggestedByLabel: string;
  status: MergeRequestStatus;
  preview: MergePreview;
  approvals: MergeApproval[];
  reviewerComments: string[];
  conflictChoices: MergeConflictChoice[];
  snapshotBeforeMerge?: MergeRequestSnapshot;
  appliedAt?: string;
  undoneAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MergeHistoryRecord {
  id: string;
  mergeRequestId: string;
  involvedTreeIds: string[];
  summary: string;
  status: MergeRequestStatus;
  preview: MergePreview;
  changedPersonIds: string[];
  approvals: MergeApproval[];
  createdAt: string;
  updatedAt: string;
}

export function getMatchStrengthLabel(score: number): MatchStrengthLabel {
  if (score >= 85) {
    return 'Very likely same person';
  }

  if (score >= 65) {
    return 'Possible match';
  }

  if (score >= 35) {
    return 'Weak match';
  }

  return 'Unlikely match';
}

export function getCanonicalPersonId(person?: Pick<PersonRecord, 'id' | 'canonicalPersonId'> | null) {
  return person?.canonicalPersonId?.trim() || person?.id || '';
}
