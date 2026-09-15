import {
  doc,
  getDoc,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { MergeConflictChoice, MergePreview, MergeReviewDecision } from '../components/dto/merge';
import type { FamilyTree } from '../components/dto/tree';
import {
  MERGE_REQUESTS_COLLECTION,
  PEOPLE_COLLECTION,
  RELATIONSHIPS_COLLECTION,
  TREES_COLLECTION,
  getTreeBundle,
  getTreeById,
} from './family-tree-data';
import { db, functionsApi } from './firebase-provider';
import { mapMergeRequest } from './family-tree-mappers';
import { nowIso } from './family-tree-shared';
import { assertTreesMergeCompatible } from './tree-merge-eligibility';
import { buildMergePreview } from './merge-intelligence';

function canApproveMergeForTree(tree: FamilyTree, userId: string) {
  return tree.editorIds.includes(userId);
}

export async function getMergePreview(sourceTreeId: string, targetTreeId: string) {
  const [source, target] = await Promise.all([getTreeBundle(sourceTreeId), getTreeBundle(targetTreeId)]);
  assertTreesMergeCompatible(source.tree, target.tree, source.people, target.people);
  return buildMergePreview(source, target);
}

export async function createMergeRequest(
  actorUserId: string,
  sourceTreeId: string,
  targetTreeId: string,
) {
  const result = await httpsCallable<
    { sourceTreeId: string; targetTreeId: string },
    { id: string; preview: MergePreview }
  >(functionsApi, 'createMergeRequestServer')({ sourceTreeId, targetTreeId });
  return result.data;
}

export async function reviewMergeRequest(
  actorUserId: string,
  requestId: string,
  decision: MergeReviewDecision,
  comment = '',
  conflictChoices: MergeConflictChoice[] = [],
  selectedMatchIds?: string[],
) {
  await httpsCallable<
    {
      requestId: string;
      decision: MergeReviewDecision;
      comment?: string;
      conflictChoices?: MergeConflictChoice[];
      selectedMatchIds?: string[];
    },
    { ok: boolean }
  >(functionsApi, 'reviewMergeRequestServer')({
    requestId,
    decision,
    comment,
    conflictChoices,
    selectedMatchIds,
  });
}

export async function undoMergeRequest(actorUserId: string, requestId: string) {
 await httpsCallable(functionsApi, 'unlinkProfilesServer')({requestId});
}
