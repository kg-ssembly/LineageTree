import {
  collection,
  doc,
  getDoc,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { MergeApproval, MergeConflictChoice, MergePreview, MergeRequestRecord, MergeRequestSnapshot, MergeReviewDecision } from '../components/dto/merge';
import type { FamilyTree } from '../components/dto/tree';
import { normalizeRelationshipEndpoints } from '../components/family-tree-validation';
import {
  MERGE_HISTORY_COLLECTION,
  MERGE_REQUESTS_COLLECTION,
  PEOPLE_COLLECTION,
  RELATIONSHIPS_COLLECTION,
  TREES_COLLECTION,
  getRelationshipsByTreeId,
  getTreeBundle,
  getTreeById,
} from './family-tree-data';
import { db } from './firebase-provider';
import {
  buildMergedTargetPersonUpdate,
  getMergeSelectedMatches,
  getRelationshipCanonicalKey,
  validateSelectedMergeMatches,
} from './family-tree-merge-application';
import { buildMergeReviewUpdate } from './family-tree-merge-review-workflow';
import { mapMergeRequest } from './family-tree-mappers';
import { nowIso } from './family-tree-shared';
import { buildMergePreview } from './merge-intelligence';

function buildMergeApprovalLabel(tree: FamilyTree, userId: string) {
  const collaborator = tree.collaborators.find((entry) => entry.userId === userId);
  return collaborator?.displayName || collaborator?.email || 'An editor';
}

function canApproveMergeForTree(tree: FamilyTree, userId: string) {
  return tree.editorIds.includes(userId);
}

async function captureMergeSnapshot(sourceTreeId: string, targetTreeId: string, matches: MergePreview['matches']): Promise<MergeRequestSnapshot> {
  const personIds = [...new Set(matches.flatMap((match) => [match.sourcePersonId, match.targetPersonId]))];
  const personIdSet = new Set(personIds);
  const relationshipIdsByTree = new Map<string, string[]>();

  const [sourceRelationships, targetRelationships] = await Promise.all([
    getRelationshipsByTreeId(sourceTreeId),
    getRelationshipsByTreeId(targetTreeId),
  ]);

  relationshipIdsByTree.set(
    sourceTreeId,
    sourceRelationships
      .filter((relationship) => personIdSet.has(relationship.fromPersonId) || personIdSet.has(relationship.toPersonId))
      .map((relationship) => relationship.id),
  );
  relationshipIdsByTree.set(
    targetTreeId,
    targetRelationships
      .filter((relationship) => personIdSet.has(relationship.fromPersonId) || personIdSet.has(relationship.toPersonId))
      .map((relationship) => relationship.id),
  );

  const [treeSnapshots, personSnapshots, sourceTreeRelationshipSnapshots, targetTreeRelationshipSnapshots] = await Promise.all([
    Promise.all([getDoc(doc(db, TREES_COLLECTION, sourceTreeId)), getDoc(doc(db, TREES_COLLECTION, targetTreeId))]),
    Promise.all(personIds.map((personId) => getDoc(doc(db, PEOPLE_COLLECTION, personId)))),
    Promise.all((relationshipIdsByTree.get(sourceTreeId) ?? []).map((relationshipId) => getDoc(doc(db, RELATIONSHIPS_COLLECTION, relationshipId)))),
    Promise.all((relationshipIdsByTree.get(targetTreeId) ?? []).map((relationshipId) => getDoc(doc(db, RELATIONSHIPS_COLLECTION, relationshipId)))),
  ]);

  return {
    trees: treeSnapshots.filter((snapshot) => snapshot.exists()).map((snapshot) => ({ id: snapshot.id, data: snapshot.data() })),
    people: personSnapshots.filter((snapshot) => snapshot.exists()).map((snapshot) => ({ id: snapshot.id, data: snapshot.data() })),
    relationships: [...sourceTreeRelationshipSnapshots, ...targetTreeRelationshipSnapshots]
      .filter((snapshot) => snapshot.exists())
      .map((snapshot) => ({ id: snapshot.id, data: snapshot.data() })),
  };
}

async function ensureMergePreviewStillMatches(request: MergeRequestRecord) {
  const [source, target] = await Promise.all([getTreeBundle(request.sourceTreeId), getTreeBundle(request.targetTreeId)]);
  const currentPreview = buildMergePreview(source, target);
  const currentMatchIds = new Set(currentPreview.matches.map((match) => match.id));
  const missingMatch = request.selectedMatchIds.find((matchId) => !currentMatchIds.has(matchId));

  if (missingMatch) {
    throw new Error('This merge preview is out of date. Refresh the preview and review the matches again before applying.');
  }
}

async function applyMergeRequest(mergeRequestId: string, request: MergeRequestRecord) {
  const latestRequestSnapshot = await getDoc(doc(db, MERGE_REQUESTS_COLLECTION, mergeRequestId));
  if (!latestRequestSnapshot.exists()) {
    throw new Error('That merge request no longer exists.');
  }

  const latestRequest = mapMergeRequest(latestRequestSnapshot as QueryDocumentSnapshot);
  if (latestRequest.status === 'applied') {
    return;
  }
  if (latestRequest.status !== 'approved') {
    throw new Error('Only approved merge requests can be applied.');
  }

  const timestamp = nowIso();
  validateSelectedMergeMatches(request);
  await ensureMergePreviewStillMatches(request);
  const snapshotBeforeMerge = await captureMergeSnapshot(request.sourceTreeId, request.targetTreeId, request.preview.matches);
  const batch = writeBatch(db);
  const changedPersonIds = new Set<string>();
  const sourceRelationships = await getRelationshipsByTreeId(request.sourceTreeId);
  const targetRelationships = await getRelationshipsByTreeId(request.targetTreeId);
  const selectedMatches = getMergeSelectedMatches(request);
  const canonicalPersonIdBySourceId = new Map(selectedMatches.map((match) => [match.sourcePersonId, match.targetPersonId] as const));
  const snapshotPeopleById = new Map(snapshotBeforeMerge.people.map((entry) => [entry.id, entry.data] as const));

  selectedMatches.forEach((match) => {
    const sourcePersonRef = doc(db, PEOPLE_COLLECTION, match.sourcePersonId);
    const targetPersonRef = doc(db, PEOPLE_COLLECTION, match.targetPersonId);
    const sourceSnapshot = snapshotPeopleById.get(match.sourcePersonId) ?? {};
    const targetSnapshot = snapshotPeopleById.get(match.targetPersonId) ?? {};
    const sourceTreeMembershipIds = Array.isArray(sourceSnapshot.treeMembershipIds) ? sourceSnapshot.treeMembershipIds : [sourceSnapshot.treeId].filter(Boolean);
    const targetTreeMembershipIds = Array.isArray(targetSnapshot.treeMembershipIds) ? targetSnapshot.treeMembershipIds : [targetSnapshot.treeId].filter(Boolean);
    const targetDuplicatePersonIds = Array.isArray(targetSnapshot.duplicatePersonIds) ? targetSnapshot.duplicatePersonIds : [];
    const sourceTreeMemberships = Array.isArray(sourceSnapshot.treeMemberships) ? sourceSnapshot.treeMemberships : [];
    const targetTreeMemberships = Array.isArray(targetSnapshot.treeMemberships) ? targetSnapshot.treeMemberships : [];
    const mergedMembershipsByTreeId = new Map<string, any>();

    [...sourceTreeMemberships, ...targetTreeMemberships].forEach((membership) => {
      if (membership?.treeId) {
        mergedMembershipsByTreeId.set(membership.treeId, membership);
      }
    });
    [request.sourceTreeId, request.targetTreeId].forEach((treeId) => {
      if (!mergedMembershipsByTreeId.has(treeId)) {
        mergedMembershipsByTreeId.set(treeId, {
          treeId,
          role: treeId === request.targetTreeId ? 'canonical' : 'subject',
          joinedAt: timestamp,
          source: 'merge',
        });
      }
    });
    changedPersonIds.add(match.sourcePersonId);
    changedPersonIds.add(match.targetPersonId);

    batch.update(sourcePersonRef, {
      canonicalPersonId: match.targetPersonId,
      updatedAt: timestamp,
    });
    batch.update(targetPersonRef, {
      ...buildMergedTargetPersonUpdate(request, match, sourceSnapshot, targetSnapshot, timestamp),
      treeMembershipIds: [...new Set([...sourceTreeMembershipIds, ...targetTreeMembershipIds, request.sourceTreeId, request.targetTreeId])],
      treeMemberships: [...mergedMembershipsByTreeId.values()],
      duplicatePersonIds: [...new Set([...targetDuplicatePersonIds, match.sourcePersonId])],
    });
  });

  const seenRelationshipIdsByKey = new Map<string, string>();
  [...targetRelationships, ...sourceRelationships].forEach((relationship) => {
    const fromPersonId = canonicalPersonIdBySourceId.get(relationship.fromPersonId) ?? relationship.fromPersonId;
    const toPersonId = canonicalPersonIdBySourceId.get(relationship.toPersonId) ?? relationship.toPersonId;
    const relationshipRef = doc(db, RELATIONSHIPS_COLLECTION, relationship.id);

    if (fromPersonId === toPersonId) {
      batch.delete(relationshipRef);
      return;
    }

    const nextRelationship = { ...relationship, fromPersonId, toPersonId };
    const canonicalKey = getRelationshipCanonicalKey(nextRelationship);
    if (seenRelationshipIdsByKey.has(canonicalKey)) {
      batch.delete(relationshipRef);
      return;
    }

    seenRelationshipIdsByKey.set(canonicalKey, relationship.id);
    if (fromPersonId !== relationship.fromPersonId || toPersonId !== relationship.toPersonId) {
      const normalized = normalizeRelationshipEndpoints(relationship.type, fromPersonId, toPersonId);
      batch.update(relationshipRef, {
        fromPersonId: normalized.fromPersonId,
        toPersonId: normalized.toPersonId,
      });
    }
  });

  const sourceTreeSnapshot = snapshotBeforeMerge.trees.find((entry) => entry.id === request.sourceTreeId)?.data ?? {};
  const targetTreeSnapshot = snapshotBeforeMerge.trees.find((entry) => entry.id === request.targetTreeId)?.data ?? {};
  const sourceConnectedTreeIds = Array.isArray(sourceTreeSnapshot.connectedTreeIds) ? sourceTreeSnapshot.connectedTreeIds : [];
  const targetConnectedTreeIds = Array.isArray(targetTreeSnapshot.connectedTreeIds) ? targetTreeSnapshot.connectedTreeIds : [];

  batch.update(doc(db, TREES_COLLECTION, request.sourceTreeId), {
    connectedTreeIds: [...new Set([...sourceConnectedTreeIds, request.targetTreeId])],
    updatedAt: timestamp,
  });
  batch.update(doc(db, TREES_COLLECTION, request.targetTreeId), {
    connectedTreeIds: [...new Set([...targetConnectedTreeIds, request.sourceTreeId])],
    updatedAt: timestamp,
  });
  batch.update(doc(db, MERGE_REQUESTS_COLLECTION, mergeRequestId), {
    status: 'applied',
    selectedMatchIds: request.selectedMatchIds,
    snapshotBeforeMerge,
    appliedAt: timestamp,
    updatedAt: timestamp,
  });

  const historyRef = doc(db, MERGE_HISTORY_COLLECTION, mergeRequestId);
  batch.set(historyRef, {
    mergeRequestId,
    involvedTreeIds: request.involvedTreeIds,
    summary: `${request.preview.duplicateCount} duplicate relatives merged between ${request.preview.sourceTree.treeName} and ${request.preview.targetTree.treeName}.`,
    status: 'applied',
    preview: request.preview,
    changedPersonIds: [...changedPersonIds],
    approvals: request.approvals,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await batch.commit();
}

export async function getMergePreview(sourceTreeId: string, targetTreeId: string) {
  const [source, target] = await Promise.all([getTreeBundle(sourceTreeId), getTreeBundle(targetTreeId)]);
  return buildMergePreview(source, target);
}

export async function createMergeRequest(
  actorUserId: string,
  sourceTreeId: string,
  targetTreeId: string,
) {
  if (sourceTreeId === targetTreeId) {
    throw new Error('Choose two different trees before starting a merge.');
  }

  const [source, target] = await Promise.all([getTreeBundle(sourceTreeId), getTreeBundle(targetTreeId)]);
  if (!canApproveMergeForTree(source.tree, actorUserId) || !canApproveMergeForTree(target.tree, actorUserId)) {
    throw new Error('You need editor access to both trees before starting a merge.');
  }

  const preview = buildMergePreview(source, target);
  if (preview.matches.length === 0) {
    throw new Error('No likely person matches were found between these trees yet.');
  }

  const mergeRequestRef = doc(collection(db, MERGE_REQUESTS_COLLECTION));
  const timestamp = nowIso();
  const suggestedByLabel = buildMergeApprovalLabel(source.tree, actorUserId);
  const selectedMatchIds = preview.matches
    .filter((match) => match.confidenceScore >= 65)
    .map((match) => match.id);

  await setDoc(mergeRequestRef, {
    sourceTreeId,
    targetTreeId,
    involvedTreeIds: [sourceTreeId, targetTreeId],
    suggestedByUserId: actorUserId,
    suggestedByLabel,
    status: 'pending',
    preview,
    selectedMatchIds,
    approvals: [],
    reviewerComments: [],
    conflictChoices: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { id: mergeRequestRef.id, preview };
}

export async function reviewMergeRequest(
  actorUserId: string,
  requestId: string,
  decision: MergeReviewDecision,
  comment = '',
  conflictChoices: MergeConflictChoice[] = [],
  selectedMatchIds?: string[],
) {
  const requestRef = doc(db, MERGE_REQUESTS_COLLECTION, requestId);
  const requestSnapshot = await getDoc(requestRef);
  if (!requestSnapshot.exists()) {
    throw new Error('That merge request no longer exists.');
  }

  const request = mapMergeRequest(requestSnapshot as QueryDocumentSnapshot);
  if (request.status !== 'pending' && request.status !== 'changes-requested') {
    throw new Error('Only pending merge requests can be reviewed.');
  }

  const [sourceTree, targetTree] = await Promise.all([getTreeById(request.sourceTreeId), getTreeById(request.targetTreeId)]);
  const approvableTrees = [sourceTree, targetTree].filter((tree) => canApproveMergeForTree(tree, actorUserId));
  if (approvableTrees.length === 0) {
    throw new Error('Only an editor from an affected tree can review this merge.');
  }

  const nextApprovals = decision === 'approve'
    ? approvableTrees.map<MergeApproval>((tree) => ({
      treeId: tree.id,
      editorUserId: actorUserId,
      editorLabel: buildMergeApprovalLabel(tree, actorUserId),
      decision,
      comment,
      decidedAt: nowIso(),
    }))
    : [{
      treeId: approvableTrees[0].id,
      editorUserId: actorUserId,
      editorLabel: buildMergeApprovalLabel(approvableTrees[0], actorUserId),
      decision,
      comment,
      decidedAt: nowIso(),
    } satisfies MergeApproval];

  const nextSelectedMatchIds = selectedMatchIds
    ? [...new Set(selectedMatchIds.filter((matchId) => request.preview.matches.some((match) => match.id === matchId)))]
    : request.selectedMatchIds;

  const transactionResult = await runTransaction(db, async (transaction) => {
    const latestSnapshot = await transaction.get(requestRef);
    if (!latestSnapshot.exists()) {
      throw new Error('That merge request no longer exists.');
    }

    const latestRequest = mapMergeRequest(latestSnapshot as QueryDocumentSnapshot);
    if (latestRequest.status !== 'pending' && latestRequest.status !== 'changes-requested') {
      throw new Error('Only pending merge requests can be reviewed.');
    }

    const update = buildMergeReviewUpdate({
      currentRequest: latestRequest,
      decision,
      nextApprovals,
      comment,
      conflictChoices,
      selectedMatchIds: nextSelectedMatchIds,
      sourceTreeId: sourceTree.id,
      targetTreeId: targetTree.id,
    });

    transaction.update(requestRef, {
      approvals: update.approvals,
      reviewerComments: update.reviewerComments,
      conflictChoices: update.conflictChoices,
      selectedMatchIds: update.selectedMatchIds,
      status: update.status,
      updatedAt: nowIso(),
    });

    return update;
  });

  if (transactionResult.shouldApply) {
    await applyMergeRequest(requestId, {
      ...request,
      approvals: transactionResult.approvals,
      reviewerComments: transactionResult.reviewerComments,
      conflictChoices: transactionResult.conflictChoices,
      selectedMatchIds: transactionResult.selectedMatchIds,
      status: transactionResult.status,
    });
  }
}

export async function undoMergeRequest(actorUserId: string, requestId: string) {
  const requestRef = doc(db, MERGE_REQUESTS_COLLECTION, requestId);
  const requestSnapshot = await getDoc(requestRef);
  if (!requestSnapshot.exists()) {
    throw new Error('That merge request no longer exists.');
  }

  const request = mapMergeRequest(requestSnapshot as QueryDocumentSnapshot);
  if (request.status !== 'applied' || !request.snapshotBeforeMerge) {
    throw new Error('Only applied merges with snapshots can be undone.');
  }

  const [sourceTree, targetTree] = await Promise.all([getTreeById(request.sourceTreeId), getTreeById(request.targetTreeId)]);
  if (!canApproveMergeForTree(sourceTree, actorUserId) && !canApproveMergeForTree(targetTree, actorUserId)) {
    throw new Error('Only an editor from an affected tree can undo this merge.');
  }

  const batch = writeBatch(db);
  request.snapshotBeforeMerge.trees.forEach((entry) => batch.set(doc(db, TREES_COLLECTION, entry.id), entry.data));
  request.snapshotBeforeMerge.people.forEach((entry) => batch.set(doc(db, PEOPLE_COLLECTION, entry.id), entry.data));
  request.snapshotBeforeMerge.relationships.forEach((entry) => batch.set(doc(db, RELATIONSHIPS_COLLECTION, entry.id), entry.data));
  batch.update(requestRef, {
    status: 'undone',
    undoneAt: nowIso(),
    updatedAt: nowIso(),
  });
  await batch.commit();
}
