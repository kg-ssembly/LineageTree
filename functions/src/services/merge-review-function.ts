import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import type { MergeApproval, MergeConflictChoice, MergePreview, MergeRequestRecord, MergeReviewDecision } from '../../../components/dto/merge';
import type { PersonLifeEvent, PersonPhoto } from '../../../components/dto/person';
import type { RelationshipRecord } from '../../../components/dto/relationship';
import { buildMergeReviewUpdate, validateSelectedMergeMatches } from '../../../providers/family-tree-merge-review-workflow';
import { assertTreesMergeCompatible } from '../../../providers/tree-merge-eligibility';
import { buildMergePreview } from '../../../providers/merge-intelligence';
import {
  MERGE_HISTORY_COLLECTION,
  MERGE_REQUESTS_COLLECTION,
  PEOPLE_COLLECTION,
  RELATIONSHIPS_COLLECTION,
  TREES_COLLECTION,
  getRelationshipsByTreeId,
  getPeopleByTreeId,
  getTreeBundle,
  getTreeById,
  mapMergeRequestData,
  nowIso,
} from '../shared/admin-family-tree-utils';

function normalizeRelationshipEndpoints(type: RelationshipRecord['type'], fromPersonId: string, toPersonId: string) {
  if (type !== 'spouse') {
    return { fromPersonId, toPersonId };
  }

  const [firstId, secondId] = [fromPersonId, toPersonId].sort();
  return { fromPersonId: firstId, toPersonId: secondId };
}

function getMergeSelectedMatches(request: MergeRequestRecord) {
  const selectedMatchIds = new Set(request.selectedMatchIds);
  return request.preview.matches.filter((match) => selectedMatchIds.has(match.id));
}

function mapPhoto(photo: any, index: number): PersonPhoto {
  return {
    id: photo?.id ?? `${photo?.path ?? photo?.url ?? 'photo'}-${index}`,
    url: photo?.url ?? '',
    path: photo?.path ?? '',
    displayUrl: photo?.displayUrl ?? '',
    displayPath: photo?.displayPath ?? '',
    description: photo?.description ?? '',
    linkedLifeEventId: photo?.linkedLifeEventId ?? '',
    createdAt: photo?.createdAt ?? nowIso(),
  };
}

function mapLifeEvent(event: any, index: number): PersonLifeEvent {
  return {
    id: event?.id ?? `event-${index}`,
    type: event?.type ?? 'custom',
    title: event?.title ?? '',
    date: event?.date ?? '',
    description: event?.description ?? '',
  };
}

function normaliseLifeEvents(lifeEvents: PersonLifeEvent[]) {
  return lifeEvents.map((event, index) => ({
    id: event.id?.trim() || `event-${Date.now()}-${index}`,
    type: event.type ?? 'custom',
    title: event.title.trim(),
    date: event.date.trim(),
    description: event.description.trim(),
  }));
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function mergeUniqueStrings(...values: Array<unknown>) {
  return [...new Set(values.flatMap(asStringArray).map((value) => value.trim()).filter(Boolean))];
}

function mergeTextBlocks(targetValue: unknown, sourceValue: unknown) {
  const targetText = typeof targetValue === 'string' ? targetValue.trim() : '';
  const sourceText = typeof sourceValue === 'string' ? sourceValue.trim() : '';

  if (!targetText) {
    return sourceText;
  }

  if (!sourceText || targetText.includes(sourceText)) {
    return targetText;
  }

  return `${targetText}\n\nMerged note:\n${sourceText}`;
}

function mergeLifeEvents(targetEvents: unknown, sourceEvents: unknown) {
  const eventsByKey = new Map<string, PersonLifeEvent>();
  const addEvent = (event: any, prefix = '') => {
    if (!event) {
      return;
    }

    const normalized = mapLifeEvent(event, eventsByKey.size);
    const contentKey = [
      normalized.type,
      normalized.title.trim().toLowerCase(),
      normalized.date,
      normalized.description.trim().toLowerCase(),
    ].join('|');

    if (eventsByKey.has(contentKey)) {
      return;
    }

    const idInUse = [...eventsByKey.values()].some((existing) => existing.id === normalized.id);
    eventsByKey.set(contentKey, {
      ...normalized,
      id: idInUse ? `${prefix}${normalized.id}` : normalized.id,
    });
  };

  (Array.isArray(targetEvents) ? targetEvents : []).forEach((event) => addEvent(event));
  (Array.isArray(sourceEvents) ? sourceEvents : []).forEach((event) => addEvent(event, 'merged-'));

  return normaliseLifeEvents([...eventsByKey.values()]);
}

function mergePhotos(targetPhotos: unknown, sourcePhotos: unknown, sourcePersonId: string) {
  const photosByKey = new Map<string, PersonPhoto>();
  const usedIds = new Set<string>();
  const addPhoto = (photo: any, fromSource = false) => {
    if (!photo) {
      return;
    }

    const normalized = mapPhoto(photo, photosByKey.size);
    const key = normalized.path || normalized.url || normalized.displayPath || normalized.displayUrl || normalized.id;
    if (!key || photosByKey.has(key)) {
      return;
    }

    const nextId = usedIds.has(normalized.id) && fromSource
      ? `${sourcePersonId}-${normalized.id}`
      : normalized.id;
    usedIds.add(nextId);
    photosByKey.set(key, {
      ...normalized,
      id: nextId,
    });
  };

  (Array.isArray(targetPhotos) ? targetPhotos : []).forEach((photo) => addPhoto(photo));
  (Array.isArray(sourcePhotos) ? sourcePhotos : []).forEach((photo) => addPhoto(photo, true));

  return [...photosByKey.values()];
}

function resolveMergeConflictValue(
  matchId: string,
  field: string,
  request: MergeRequestRecord,
  sourceSnapshot: Record<string, any>,
  targetSnapshot: Record<string, any>,
) {
  const choice = request.conflictChoices.find((entry) => entry.matchId === matchId && entry.field === field);
  if (!choice) {
    return undefined;
  }

  if (choice.resolvedValue !== undefined) {
    return Array.isArray(choice.resolvedValue) ? choice.resolvedValue.join(', ') : choice.resolvedValue;
  }

  if (choice.keep === 'source') {
    return field === 'surname' ? sourceSnapshot.lastName : sourceSnapshot[field];
  }

  if (choice.keep === 'target') {
    return field === 'surname' ? targetSnapshot.lastName : targetSnapshot[field];
  }

  if (choice.keep === 'both') {
    const sourceValue = field === 'surname' ? sourceSnapshot.lastName : sourceSnapshot[field];
    const targetValue = field === 'surname' ? targetSnapshot.lastName : targetSnapshot[field];
    return [targetValue, sourceValue].map((value) => String(value ?? '').trim()).filter(Boolean).join(' / ');
  }

  return undefined;
}

function buildMergedTargetPersonUpdate(
  request: MergeRequestRecord,
  match: MergePreview['matches'][number],
  sourceSnapshot: Record<string, any>,
  targetSnapshot: Record<string, any>,
  timestamp: string,
) {
  const photos = mergePhotos(targetSnapshot.photos, sourceSnapshot.photos, match.sourcePersonId);
  const sourcePreferredPhotoId = typeof sourceSnapshot.preferredPhotoId === 'string' ? sourceSnapshot.preferredPhotoId : '';
  const copiedSourcePreferredPhoto = sourcePreferredPhotoId
    ? photos.find((photo) => photo.id === sourcePreferredPhotoId || photo.id === `${match.sourcePersonId}-${sourcePreferredPhotoId}`)
    : null;
  const targetPreferredPhotoId = typeof targetSnapshot.preferredPhotoId === 'string' ? targetSnapshot.preferredPhotoId : '';

  return {
    firstName: targetSnapshot.firstName || sourceSnapshot.firstName || '',
    middleNames: targetSnapshot.middleNames || sourceSnapshot.middleNames || '',
    lastName: resolveMergeConflictValue(match.id, 'surname', request, sourceSnapshot, targetSnapshot) ?? targetSnapshot.lastName ?? sourceSnapshot.lastName ?? '',
    maidenName: targetSnapshot.maidenName || sourceSnapshot.maidenName || '',
    birthSurnameStatus: targetSnapshot.maidenName || sourceSnapshot.maidenName ? 'different' : targetSnapshot.birthSurnameStatus ?? sourceSnapshot.birthSurnameStatus ?? 'unknown',
    nicknames: mergeUniqueStrings(targetSnapshot.nicknames, sourceSnapshot.nicknames),
    clanName: targetSnapshot.clanName || sourceSnapshot.clanName || '',
    familyBranch: targetSnapshot.familyBranch || sourceSnapshot.familyBranch || '',
    hometown: resolveMergeConflictValue(match.id, 'hometown', request, sourceSnapshot, targetSnapshot) ?? targetSnapshot.hometown ?? sourceSnapshot.hometown ?? '',
    birthPlace: targetSnapshot.birthPlace || sourceSnapshot.birthPlace || '',
    surnameVariantHints: mergeUniqueStrings(targetSnapshot.surnameVariantHints, sourceSnapshot.surnameVariantHints),
    birthDate: resolveMergeConflictValue(match.id, 'birthDate', request, sourceSnapshot, targetSnapshot) ?? targetSnapshot.birthDate ?? sourceSnapshot.birthDate ?? '',
    deathDate: targetSnapshot.deathDate || sourceSnapshot.deathDate || '',
    gender: targetSnapshot.gender && targetSnapshot.gender !== 'unspecified' ? targetSnapshot.gender : sourceSnapshot.gender ?? targetSnapshot.gender ?? 'unspecified',
    notes: mergeTextBlocks(targetSnapshot.notes, sourceSnapshot.notes),
    lifeEvents: mergeLifeEvents(targetSnapshot.lifeEvents, sourceSnapshot.lifeEvents),
    photos,
    preferredPhotoId: photos.some((photo) => photo.id === targetPreferredPhotoId)
      ? targetPreferredPhotoId
      : copiedSourcePreferredPhoto?.id ?? '',
    updatedAt: timestamp,
  };
}

function getRelationshipCanonicalKey(
  relationship: Pick<RelationshipRecord, 'type' | 'fromPersonId' | 'toPersonId' | 'relationshipStatus' | 'parentChildKind'>,
) {
  const normalized = normalizeRelationshipEndpoints(relationship.type, relationship.fromPersonId, relationship.toPersonId);
  return [
    relationship.type,
    normalized.fromPersonId,
    normalized.toPersonId,
    relationship.type === 'spouse' ? relationship.relationshipStatus ?? '' : '',
    relationship.type === 'parent-child' ? relationship.parentChildKind ?? '' : '',
  ].join(':');
}

function buildMergeApprovalLabel(tree: { collaborators: Array<{ userId: string; displayName: string; email: string }> }, userId: string) {
  const collaborator = tree.collaborators.find((entry) => entry.userId === userId);
  return collaborator?.displayName || collaborator?.email || 'An editor';
}

function canApproveMergeForTree(tree: { editorIds: string[] }, userId: string) {
  return tree.editorIds.includes(userId);
}

export class MergeReviewFunction {
  constructor(private readonly db: Firestore) {}

  async create(actorUserId: string, sourceTreeId: string, targetTreeId: string) {
    const [source, target] = await Promise.all([
      getTreeBundle(this.db, sourceTreeId),
      getTreeBundle(this.db, targetTreeId),
    ]);
    if (!canApproveMergeForTree(source.tree, actorUserId) || !canApproveMergeForTree(target.tree, actorUserId)) {
      throw new HttpsError('permission-denied', 'You need editor access to both trees before starting a merge.');
    }
    this.validateTreeEligibility(source.tree, target.tree, source.people, target.people);
    const preview = buildMergePreview(source, target);
    if (preview.matches.length === 0) {
      throw new HttpsError('failed-precondition', 'No likely person matches were found between these trees yet.');
    }
    const sourceIds = new Set<string>();
    const targetIds = new Set<string>();
    const selectedMatchIds = preview.matches.filter((match) => {
      if (match.confidenceScore < 65 || sourceIds.has(match.sourcePersonId) || targetIds.has(match.targetPersonId)) return false;
      sourceIds.add(match.sourcePersonId);
      targetIds.add(match.targetPersonId);
      return true;
    }).map((match) => match.id);
    const ref = this.db.collection(MERGE_REQUESTS_COLLECTION).doc();
    const timestamp = nowIso();
    await ref.set({
      sourceTreeId, targetTreeId, involvedTreeIds: [sourceTreeId, targetTreeId],
      suggestedByUserId: actorUserId,
      suggestedByLabel: buildMergeApprovalLabel(source.tree, actorUserId),
      status: 'pending', preview, selectedMatchIds,
      approvals: [], reviewerComments: [], conflictChoices: [],
      createdAt: timestamp, updatedAt: timestamp,
    });
    return { id: ref.id, preview };
  }

  private validateTreeEligibility(
    source: Parameters<typeof assertTreesMergeCompatible>[0],
    target: Parameters<typeof assertTreesMergeCompatible>[1],
    sourcePeople: { lastName: string }[],
    targetPeople: { lastName: string }[],
  ) {
    try {
      assertTreesMergeCompatible(source, target, sourcePeople, targetPeople);
    } catch (error) {
      throw new HttpsError('failed-precondition', (error as Error).message);
    }
  }

  async review(actorUserId: string, input: {
    requestId: string;
    decision: MergeReviewDecision;
    comment?: string;
    conflictChoices?: MergeConflictChoice[];
    selectedMatchIds?: string[];
  }) {
    const requestRef = this.db.collection(MERGE_REQUESTS_COLLECTION).doc(input.requestId);
    const requestSnapshot = await requestRef.get();
    if (!requestSnapshot.exists) {
      throw new HttpsError('not-found', 'That merge request no longer exists.');
    }

    const request = mapMergeRequestData(requestSnapshot.id, requestSnapshot.data() ?? {});
    if (request.status !== 'pending' && request.status !== 'changes-requested') {
      throw new HttpsError('failed-precondition', 'Only pending merge requests can be reviewed.');
    }

    const [sourceTree, targetTree] = await Promise.all([
      getTreeById(this.db, request.sourceTreeId),
      getTreeById(this.db, request.targetTreeId),
    ]);
    const approvableTrees = [sourceTree, targetTree].filter((tree) => canApproveMergeForTree(tree, actorUserId));
    if (approvableTrees.length === 0) {
      throw new HttpsError('permission-denied', 'Only an editor from an affected tree can review this merge.');
    }

    if (input.decision === 'approve') {
      const [sourcePeople, targetPeople] = await Promise.all([
        getPeopleByTreeId(this.db, sourceTree.id),
        getPeopleByTreeId(this.db, targetTree.id),
      ]);
      this.validateTreeEligibility(sourceTree, targetTree, sourcePeople, targetPeople);
    }

    const nextApprovals = input.decision === 'approve'
      ? approvableTrees.map<MergeApproval>((tree) => ({
        treeId: tree.id,
        editorUserId: actorUserId,
        editorLabel: buildMergeApprovalLabel(tree, actorUserId),
        decision: input.decision,
        comment: input.comment ?? '',
        decidedAt: nowIso(),
      }))
      : [{
        treeId: approvableTrees[0].id,
        editorUserId: actorUserId,
        editorLabel: buildMergeApprovalLabel(approvableTrees[0], actorUserId),
        decision: input.decision,
        comment: input.comment ?? '',
        decidedAt: nowIso(),
      } satisfies MergeApproval];

    const transactionResult = await this.db.runTransaction(async (transaction) => {
      const latestSnapshot = await transaction.get(requestRef);
      if (!latestSnapshot.exists) {
        throw new HttpsError('not-found', 'That merge request no longer exists.');
      }

      const latestRequest = mapMergeRequestData(latestSnapshot.id, latestSnapshot.data() ?? {});
      if (latestRequest.status !== 'pending' && latestRequest.status !== 'changes-requested') {
        throw new HttpsError('failed-precondition', 'Only pending merge requests can be reviewed.');
      }

      let update: ReturnType<typeof buildMergeReviewUpdate>;
      try {
        update = buildMergeReviewUpdate({
          currentRequest: latestRequest,
          decision: input.decision,
          nextApprovals,
          comment: input.comment ?? '',
          conflictChoices: input.conflictChoices,
          selectedMatchIds: input.selectedMatchIds,
          sourceTreeId: sourceTree.id,
          targetTreeId: targetTree.id,
        });
      } catch (error) {
        throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'Unable to review these matches.');
      }

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
      await this.applyMergeRequest(input.requestId, {
        ...request,
        approvals: transactionResult.approvals,
        reviewerComments: transactionResult.reviewerComments,
        conflictChoices: transactionResult.conflictChoices,
        selectedMatchIds: transactionResult.selectedMatchIds,
        status: transactionResult.status,
      });
    }

    return { ok: true };
  }

  private async applyMergeRequest(mergeRequestId: string, _request: MergeRequestRecord) {
    await this.db.runTransaction(async tx => {
      const ref = this.db.collection(MERGE_REQUESTS_COLLECTION).doc(mergeRequestId);
      const snapshot = await tx.get(ref);
      const request = mapMergeRequestData(snapshot.id, snapshot.data() ?? {});
      if (request.status === 'applied') return;
      if (request.status !== 'approved') throw new HttpsError('failed-precondition', 'Only reviewed matches can be linked.');
      validateSelectedMergeMatches(request);
      const trees = await Promise.all([request.sourceTreeId, request.targetTreeId].map(id => tx.get(this.db.collection(TREES_COLLECTION).doc(id))));
      for (const tree of trees) {
        const approval = request.approvals.find(a => a.treeId === tree.id && a.decision === 'approve');
        if (!tree.exists || tree.data()?.deleting || !approval || !tree.data()?.editorIds?.includes(approval.editorUserId)) throw new HttpsError('permission-denied', 'Both trees need approval from a current editor.');
      }
      const matches = getMergeSelectedMatches(request);
      const people = await Promise.all(matches.flatMap(m => [m.sourcePersonId, m.targetPersonId]).map(id => tx.get(this.db.collection(PEOPLE_COLLECTION).doc(id))));
      const timestamp = nowIso();
      matches.forEach((match, index) => {
        const source = people[index * 2], target = people[index * 2 + 1];
        if (!source.exists || !target.exists || source.data()?.treeId !== request.sourceTreeId || target.data()?.treeId !== request.targetTreeId) throw new HttpsError('failed-precondition', 'A matched profile moved or was removed. Refresh the review.');
        tx.set(this.db.collection('personLinks').doc(mergeRequestId + '-' + index), {
          sourceTreeId: request.sourceTreeId, targetTreeId: request.targetTreeId,
          sourcePersonId: source.id, targetPersonId: target.id, mergeRequestId,
          approvals: request.approvals, active: true, createdAt: timestamp, updatedAt: timestamp,
        });
      });
      tx.update(ref, { status: 'applied', mode: 'linked-profiles', appliedAt: timestamp, updatedAt: timestamp });
      tx.set(this.db.collection(MERGE_HISTORY_COLLECTION).doc(mergeRequestId), {
        mergeRequestId, involvedTreeIds: request.involvedTreeIds, sourceTreeId: request.sourceTreeId, targetTreeId: request.targetTreeId,
        summary: matches.length + ' profiles linked. Each tree keeps its own records.', status: 'applied',
        changedPersonIds: [], approvals: request.approvals, createdAt: timestamp, updatedAt: timestamp,
      });
    });
  }
}
