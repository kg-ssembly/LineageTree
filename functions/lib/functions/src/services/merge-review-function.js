"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MergeReviewFunction = void 0;
const https_1 = require("firebase-functions/v2/https");
const merge_intelligence_1 = require("../../../providers/merge-intelligence");
const admin_family_tree_utils_1 = require("../shared/admin-family-tree-utils");
function normalizeRelationshipEndpoints(type, fromPersonId, toPersonId) {
    if (type !== 'spouse') {
        return { fromPersonId, toPersonId };
    }
    const [firstId, secondId] = [fromPersonId, toPersonId].sort();
    return { fromPersonId: firstId, toPersonId: secondId };
}
function getMergeSelectedMatches(request) {
    const selectedMatchIds = new Set(request.selectedMatchIds);
    return request.preview.matches.filter((match) => selectedMatchIds.has(match.id));
}
function validateSelectedMergeMatches(request) {
    const sourcePersonIds = new Set();
    const targetPersonIds = new Set();
    getMergeSelectedMatches(request).forEach((match) => {
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
function mapPhoto(photo, index) {
    return {
        id: photo?.id ?? `${photo?.path ?? photo?.url ?? 'photo'}-${index}`,
        url: photo?.url ?? '',
        path: photo?.path ?? '',
        displayUrl: photo?.displayUrl ?? '',
        displayPath: photo?.displayPath ?? '',
        description: photo?.description ?? '',
        linkedLifeEventId: photo?.linkedLifeEventId ?? '',
        createdAt: photo?.createdAt ?? (0, admin_family_tree_utils_1.nowIso)(),
    };
}
function mapLifeEvent(event, index) {
    return {
        id: event?.id ?? `event-${index}`,
        type: event?.type ?? 'custom',
        title: event?.title ?? '',
        date: event?.date ?? '',
        description: event?.description ?? '',
    };
}
function normaliseLifeEvents(lifeEvents) {
    return lifeEvents.map((event, index) => ({
        id: event.id?.trim() || `event-${Date.now()}-${index}`,
        type: event.type ?? 'custom',
        title: event.title.trim(),
        date: event.date.trim(),
        description: event.description.trim(),
    }));
}
function asStringArray(value) {
    return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}
function mergeUniqueStrings(...values) {
    return [...new Set(values.flatMap(asStringArray).map((value) => value.trim()).filter(Boolean))];
}
function mergeTextBlocks(targetValue, sourceValue) {
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
function mergeLifeEvents(targetEvents, sourceEvents) {
    const eventsByKey = new Map();
    const addEvent = (event, prefix = '') => {
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
function mergePhotos(targetPhotos, sourcePhotos, sourcePersonId) {
    const photosByKey = new Map();
    const usedIds = new Set();
    const addPhoto = (photo, fromSource = false) => {
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
function resolveMergeConflictValue(matchId, field, request, sourceSnapshot, targetSnapshot) {
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
function buildMergedTargetPersonUpdate(request, match, sourceSnapshot, targetSnapshot, timestamp) {
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
function getRelationshipCanonicalKey(relationship) {
    const normalized = normalizeRelationshipEndpoints(relationship.type, relationship.fromPersonId, relationship.toPersonId);
    return [
        relationship.type,
        normalized.fromPersonId,
        normalized.toPersonId,
        relationship.type === 'spouse' ? relationship.relationshipStatus ?? '' : '',
        relationship.type === 'parent-child' ? relationship.parentChildKind ?? '' : '',
    ].join(':');
}
function buildMergeApprovalLabel(tree, userId) {
    const collaborator = tree.collaborators.find((entry) => entry.userId === userId);
    return collaborator?.displayName || collaborator?.email || 'An editor';
}
function canApproveMergeForTree(tree, userId) {
    return tree.editorIds.includes(userId);
}
function buildMergeReviewUpdate(options) {
    const nextSelectedMatchIds = options.selectedMatchIds
        ? [...new Set(options.selectedMatchIds.filter((matchId) => options.currentRequest.preview.matches.some((match) => match.id === matchId)))]
        : options.currentRequest.selectedMatchIds;
    if (options.decision === 'approve' && nextSelectedMatchIds.length === 0) {
        throw new Error('Select at least one person match before approving this merge.');
    }
    validateSelectedMergeMatches({
        ...options.currentRequest,
        selectedMatchIds: nextSelectedMatchIds,
    });
    const approvals = [
        ...options.currentRequest.approvals.filter((entry) => !options.nextApprovals.some((approval) => approval.treeId === entry.treeId && approval.editorUserId === entry.editorUserId)),
        ...options.nextApprovals,
    ];
    const reviewerComments = options.comment?.trim()
        ? [...options.currentRequest.reviewerComments, options.comment.trim()]
        : options.currentRequest.reviewerComments;
    let status = options.currentRequest.status;
    if (options.decision === 'reject') {
        status = 'rejected';
    }
    else if (options.decision === 'request-changes') {
        status = 'changes-requested';
    }
    else {
        const approvedTreeIds = new Set(approvals.filter((entry) => entry.decision === 'approve').map((entry) => entry.treeId));
        status = approvedTreeIds.has(options.sourceTreeId) && approvedTreeIds.has(options.targetTreeId) ? 'approved' : 'pending';
    }
    return {
        approvals,
        reviewerComments,
        conflictChoices: options.conflictChoices ?? [],
        selectedMatchIds: nextSelectedMatchIds,
        status,
        shouldApply: status === 'approved' && options.currentRequest.status !== 'approved',
    };
}
class MergeReviewFunction {
    db;
    constructor(db) {
        this.db = db;
    }
    async review(actorUserId, input) {
        const requestRef = this.db.collection(admin_family_tree_utils_1.MERGE_REQUESTS_COLLECTION).doc(input.requestId);
        const requestSnapshot = await requestRef.get();
        if (!requestSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'That merge request no longer exists.');
        }
        const request = (0, admin_family_tree_utils_1.mapMergeRequestData)(requestSnapshot.id, requestSnapshot.data() ?? {});
        if (request.status !== 'pending' && request.status !== 'changes-requested') {
            throw new https_1.HttpsError('failed-precondition', 'Only pending merge requests can be reviewed.');
        }
        const [sourceTree, targetTree] = await Promise.all([
            (0, admin_family_tree_utils_1.getTreeById)(this.db, request.sourceTreeId),
            (0, admin_family_tree_utils_1.getTreeById)(this.db, request.targetTreeId),
        ]);
        const approvableTrees = [sourceTree, targetTree].filter((tree) => canApproveMergeForTree(tree, actorUserId));
        if (approvableTrees.length === 0) {
            throw new https_1.HttpsError('permission-denied', 'Only an editor from an affected tree can review this merge.');
        }
        const nextApprovals = input.decision === 'approve'
            ? approvableTrees.map((tree) => ({
                treeId: tree.id,
                editorUserId: actorUserId,
                editorLabel: buildMergeApprovalLabel(tree, actorUserId),
                decision: input.decision,
                comment: input.comment,
                decidedAt: (0, admin_family_tree_utils_1.nowIso)(),
            }))
            : [{
                    treeId: approvableTrees[0].id,
                    editorUserId: actorUserId,
                    editorLabel: buildMergeApprovalLabel(approvableTrees[0], actorUserId),
                    decision: input.decision,
                    comment: input.comment,
                    decidedAt: (0, admin_family_tree_utils_1.nowIso)(),
                }];
        const transactionResult = await this.db.runTransaction(async (transaction) => {
            const latestSnapshot = await transaction.get(requestRef);
            if (!latestSnapshot.exists) {
                throw new https_1.HttpsError('not-found', 'That merge request no longer exists.');
            }
            const latestRequest = (0, admin_family_tree_utils_1.mapMergeRequestData)(latestSnapshot.id, latestSnapshot.data() ?? {});
            if (latestRequest.status !== 'pending' && latestRequest.status !== 'changes-requested') {
                throw new https_1.HttpsError('failed-precondition', 'Only pending merge requests can be reviewed.');
            }
            const update = buildMergeReviewUpdate({
                currentRequest: latestRequest,
                decision: input.decision,
                nextApprovals,
                comment: input.comment,
                conflictChoices: input.conflictChoices,
                selectedMatchIds: input.selectedMatchIds,
                sourceTreeId: sourceTree.id,
                targetTreeId: targetTree.id,
            });
            transaction.update(requestRef, {
                approvals: update.approvals,
                reviewerComments: update.reviewerComments,
                conflictChoices: update.conflictChoices,
                selectedMatchIds: update.selectedMatchIds,
                status: update.status,
                updatedAt: (0, admin_family_tree_utils_1.nowIso)(),
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
    async captureMergeSnapshot(sourceTreeId, targetTreeId, matches) {
        const personIds = [...new Set(matches.flatMap((match) => [match.sourcePersonId, match.targetPersonId]))];
        const personIdSet = new Set(personIds);
        const [sourceRelationships, targetRelationships] = await Promise.all([
            (0, admin_family_tree_utils_1.getRelationshipsByTreeId)(this.db, sourceTreeId),
            (0, admin_family_tree_utils_1.getRelationshipsByTreeId)(this.db, targetTreeId),
        ]);
        const sourceRelationshipIds = sourceRelationships
            .filter((relationship) => personIdSet.has(relationship.fromPersonId) || personIdSet.has(relationship.toPersonId))
            .map((relationship) => relationship.id);
        const targetRelationshipIds = targetRelationships
            .filter((relationship) => personIdSet.has(relationship.fromPersonId) || personIdSet.has(relationship.toPersonId))
            .map((relationship) => relationship.id);
        const [treeSnapshots, personSnapshots, sourceTreeRelationshipSnapshots, targetTreeRelationshipSnapshots] = await Promise.all([
            Promise.all([
                this.db.collection(admin_family_tree_utils_1.TREES_COLLECTION).doc(sourceTreeId).get(),
                this.db.collection(admin_family_tree_utils_1.TREES_COLLECTION).doc(targetTreeId).get(),
            ]),
            Promise.all(personIds.map((personId) => this.db.collection(admin_family_tree_utils_1.PEOPLE_COLLECTION).doc(personId).get())),
            Promise.all(sourceRelationshipIds.map((relationshipId) => this.db.collection(admin_family_tree_utils_1.RELATIONSHIPS_COLLECTION).doc(relationshipId).get())),
            Promise.all(targetRelationshipIds.map((relationshipId) => this.db.collection(admin_family_tree_utils_1.RELATIONSHIPS_COLLECTION).doc(relationshipId).get())),
        ]);
        return {
            trees: treeSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => ({ id: snapshot.id, data: snapshot.data() ?? {} })),
            people: personSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => ({ id: snapshot.id, data: snapshot.data() ?? {} })),
            relationships: [...sourceTreeRelationshipSnapshots, ...targetTreeRelationshipSnapshots]
                .filter((snapshot) => snapshot.exists)
                .map((snapshot) => ({ id: snapshot.id, data: snapshot.data() ?? {} })),
        };
    }
    async ensureMergePreviewStillMatches(request) {
        const [source, target] = await Promise.all([
            (0, admin_family_tree_utils_1.getTreeBundle)(this.db, request.sourceTreeId),
            (0, admin_family_tree_utils_1.getTreeBundle)(this.db, request.targetTreeId),
        ]);
        const currentPreview = (0, merge_intelligence_1.buildMergePreview)(source, target);
        const currentMatchIds = new Set(currentPreview.matches.map((match) => match.id));
        const missingMatch = request.selectedMatchIds.find((matchId) => !currentMatchIds.has(matchId));
        if (missingMatch) {
            throw new https_1.HttpsError('failed-precondition', 'This merge preview is out of date. Refresh the preview and review the matches again before applying.');
        }
    }
    async applyMergeRequest(mergeRequestId, request) {
        const latestRequestSnapshot = await this.db.collection(admin_family_tree_utils_1.MERGE_REQUESTS_COLLECTION).doc(mergeRequestId).get();
        if (!latestRequestSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'That merge request no longer exists.');
        }
        const latestRequest = (0, admin_family_tree_utils_1.mapMergeRequestData)(latestRequestSnapshot.id, latestRequestSnapshot.data() ?? {});
        if (latestRequest.status === 'applied') {
            return;
        }
        if (latestRequest.status !== 'approved') {
            throw new https_1.HttpsError('failed-precondition', 'Only approved merge requests can be applied.');
        }
        const timestamp = (0, admin_family_tree_utils_1.nowIso)();
        validateSelectedMergeMatches(request);
        await this.ensureMergePreviewStillMatches(request);
        const snapshotBeforeMerge = await this.captureMergeSnapshot(request.sourceTreeId, request.targetTreeId, request.preview.matches);
        const batch = this.db.batch();
        const changedPersonIds = new Set();
        const sourceRelationships = await (0, admin_family_tree_utils_1.getRelationshipsByTreeId)(this.db, request.sourceTreeId);
        const targetRelationships = await (0, admin_family_tree_utils_1.getRelationshipsByTreeId)(this.db, request.targetTreeId);
        const selectedMatches = getMergeSelectedMatches(request);
        const canonicalPersonIdBySourceId = new Map(selectedMatches.map((match) => [match.sourcePersonId, match.targetPersonId]));
        const snapshotPeopleById = new Map(snapshotBeforeMerge.people.map((entry) => [entry.id, entry.data]));
        selectedMatches.forEach((match) => {
            const sourcePersonRef = this.db.collection(admin_family_tree_utils_1.PEOPLE_COLLECTION).doc(match.sourcePersonId);
            const targetPersonRef = this.db.collection(admin_family_tree_utils_1.PEOPLE_COLLECTION).doc(match.targetPersonId);
            const sourceSnapshot = snapshotPeopleById.get(match.sourcePersonId) ?? {};
            const targetSnapshot = snapshotPeopleById.get(match.targetPersonId) ?? {};
            const sourceTreeMembershipIds = Array.isArray(sourceSnapshot.treeMembershipIds) ? sourceSnapshot.treeMembershipIds : [sourceSnapshot.treeId].filter(Boolean);
            const targetTreeMembershipIds = Array.isArray(targetSnapshot.treeMembershipIds) ? targetSnapshot.treeMembershipIds : [targetSnapshot.treeId].filter(Boolean);
            const targetDuplicatePersonIds = Array.isArray(targetSnapshot.duplicatePersonIds) ? targetSnapshot.duplicatePersonIds : [];
            const sourceTreeMemberships = Array.isArray(sourceSnapshot.treeMemberships) ? sourceSnapshot.treeMemberships : [];
            const targetTreeMemberships = Array.isArray(targetSnapshot.treeMemberships) ? targetSnapshot.treeMemberships : [];
            const mergedMembershipsByTreeId = new Map();
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
        const seenRelationshipIdsByKey = new Map();
        [...targetRelationships, ...sourceRelationships].forEach((relationship) => {
            const fromPersonId = canonicalPersonIdBySourceId.get(relationship.fromPersonId) ?? relationship.fromPersonId;
            const toPersonId = canonicalPersonIdBySourceId.get(relationship.toPersonId) ?? relationship.toPersonId;
            const relationshipRef = this.db.collection(admin_family_tree_utils_1.RELATIONSHIPS_COLLECTION).doc(relationship.id);
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
        batch.update(this.db.collection(admin_family_tree_utils_1.TREES_COLLECTION).doc(request.sourceTreeId), {
            connectedTreeIds: [...new Set([...sourceConnectedTreeIds, request.targetTreeId])],
            updatedAt: timestamp,
        });
        batch.update(this.db.collection(admin_family_tree_utils_1.TREES_COLLECTION).doc(request.targetTreeId), {
            connectedTreeIds: [...new Set([...targetConnectedTreeIds, request.sourceTreeId])],
            updatedAt: timestamp,
        });
        batch.update(this.db.collection(admin_family_tree_utils_1.MERGE_REQUESTS_COLLECTION).doc(mergeRequestId), {
            status: 'applied',
            selectedMatchIds: request.selectedMatchIds,
            snapshotBeforeMerge,
            appliedAt: timestamp,
            updatedAt: timestamp,
        });
        batch.set(this.db.collection(admin_family_tree_utils_1.MERGE_HISTORY_COLLECTION).doc(mergeRequestId), {
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
}
exports.MergeReviewFunction = MergeReviewFunction;
