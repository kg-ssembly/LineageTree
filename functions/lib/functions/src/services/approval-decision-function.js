"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalDecisionFunction = void 0;
const https_1 = require("firebase-functions/v2/https");
const relationship_1 = require("../../../components/dto/relationship");
const admin_family_tree_utils_1 = require("../shared/admin-family-tree-utils");
class ApprovalDecisionFunction {
    db;
    constructor(db) {
        this.db = db;
    }
    async decide(actorUserId, requestId, decision, auto = false) {
        const requestRef = this.db.collection(admin_family_tree_utils_1.APPROVAL_REQUESTS_COLLECTION).doc(requestId);
        const requestSnapshot = await requestRef.get();
        if (!requestSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'That approval request no longer exists.');
        }
        const request = (0, admin_family_tree_utils_1.mapApprovalRequestData)(requestSnapshot.id, requestSnapshot.data() ?? {});
        if (request.status !== 'pending') {
            return { ok: true };
        }
        if (!auto && !request.eligibleApproverIds.includes(actorUserId)) {
            throw new https_1.HttpsError('permission-denied', 'You cannot review this approval request.');
        }
        const decisionTime = (0, admin_family_tree_utils_1.nowIso)();
        if (decision === 'reject') {
            await this.handleRejectedRequest(request);
            await requestRef.update({
                status: 'rejected',
                decisionMode: auto ? 'auto' : 'manual',
                decidedAt: decisionTime,
                decidedByUserId: auto ? '' : actorUserId,
                decidedByLabel: auto ? 'Automatic approval timer' : await this.getRequesterLabel(request.treeId, actorUserId),
                updatedAt: decisionTime,
            });
            return { ok: true };
        }
        await this.applyApprovedRequest(request);
        const appliedAt = (0, admin_family_tree_utils_1.nowIso)();
        await requestRef.update({
            status: 'applied',
            decisionMode: auto ? 'auto' : 'manual',
            decidedAt: decisionTime,
            decidedByUserId: auto ? '' : actorUserId,
            decidedByLabel: auto ? 'Automatic approval timer' : await this.getRequesterLabel(request.treeId, actorUserId),
            appliedAt,
            updatedAt: appliedAt,
        });
        return { ok: true };
    }
    async processExpired(actorUserId, treeId) {
        const tree = await (0, admin_family_tree_utils_1.getTreeById)(this.db, treeId);
        if (!tree.editorIds.includes(actorUserId)) {
            throw new https_1.HttpsError('permission-denied', 'Only a tree editor can process expired approvals.');
        }
        const snapshot = await this.db.collection(admin_family_tree_utils_1.APPROVAL_REQUESTS_COLLECTION)
            .where('treeId', '==', treeId)
            .where('status', '==', 'pending')
            .get();
        const now = Date.now();
        for (const docSnapshot of snapshot.docs) {
            const request = (0, admin_family_tree_utils_1.mapApprovalRequestData)(docSnapshot.id, docSnapshot.data());
            if (request.status === 'pending' && request.expiresAtMillis <= now) {
                await this.decide(actorUserId, request.id, 'approve', true);
            }
        }
        return { ok: true };
    }
    async getRequesterLabel(treeId, userId) {
        const tree = await (0, admin_family_tree_utils_1.getTreeById)(this.db, treeId);
        const collaborator = tree.collaborators.find((entry) => entry.userId === userId);
        return collaborator?.displayName || collaborator?.email || 'A collaborator';
    }
    async applyApprovedCreatePerson(payload) {
        const person = payload.afterPerson;
        if (!person) {
            throw new https_1.HttpsError('failed-precondition', 'The approved family member creation is missing its target data.');
        }
        const bundledRelationships = payload.relationships ?? [];
        const batch = this.db.batch();
        batch.set(this.db.collection(admin_family_tree_utils_1.PEOPLE_COLLECTION).doc(person.id), {
            treeId: person.treeId,
            treeMembershipIds: person.treeMembershipIds,
            treeMemberships: person.treeMemberships,
            ownerId: person.ownerId,
            firstName: person.firstName,
            middleNames: person.middleNames ?? '',
            lastName: person.lastName,
            maidenName: person.maidenName ?? '',
            nicknames: person.nicknames ?? [],
            clanName: person.clanName ?? '',
            familyBranch: person.familyBranch ?? '',
            hometown: person.hometown ?? '',
            birthPlace: person.birthPlace ?? '',
            surnameVariantHints: person.surnameVariantHints ?? [],
            canonicalPersonId: person.canonicalPersonId ?? '',
            duplicatePersonIds: person.duplicatePersonIds ?? [],
            birthDate: person.birthDate,
            deathDate: person.deathDate,
            gender: person.gender,
            notes: person.notes,
            lifeEvents: (0, admin_family_tree_utils_1.normaliseLifeEvents)(person.lifeEvents),
            photos: person.photos,
            preferredPhotoId: person.preferredPhotoId,
            createdAt: person.createdAt,
            updatedAt: (0, admin_family_tree_utils_1.nowIso)(),
        });
        bundledRelationships.forEach((relationship) => {
            batch.set(this.db.collection(admin_family_tree_utils_1.RELATIONSHIPS_COLLECTION).doc(relationship.id), {
                treeId: relationship.treeId,
                ownerId: relationship.ownerId,
                type: relationship.type,
                fromPersonId: relationship.fromPersonId,
                toPersonId: relationship.toPersonId,
                relationshipStatus: relationship.type === 'spouse'
                    ? relationship.relationshipStatus ?? relationship_1.DEFAULT_SPOUSE_RELATIONSHIP_STATUS
                    : '',
                parentChildKind: relationship.type === 'parent-child'
                    ? relationship.parentChildKind ?? relationship_1.DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND
                    : '',
                createdAt: relationship.createdAt,
            });
        });
        await batch.commit();
        const parentIds = bundledRelationships
            .filter((relationship) => relationship.type === 'parent-child' && relationship.toPersonId === person.id)
            .map((relationship) => relationship.fromPersonId);
        await (0, admin_family_tree_utils_1.updateParentLifeEventsForChild)(this.db, parentIds, {
            id: person.id,
            treeId: person.treeId,
            firstName: person.firstName,
            lastName: person.lastName,
            birthDate: person.birthDate,
        });
    }
    async rejectApprovedCreatePerson(payload) {
        await (0, admin_family_tree_utils_1.deleteStoragePhotos)(payload.uploadedPhotos ?? []);
        await (0, admin_family_tree_utils_1.deleteStoragePhotos)(payload.cleanupPhotos ?? []);
    }
    async applyApprovedPersonUpdate(payload) {
        const nextPerson = payload.afterPerson;
        if (!nextPerson) {
            throw new https_1.HttpsError('failed-precondition', 'The approved family member update is missing its target data.');
        }
        await this.db.collection(admin_family_tree_utils_1.PEOPLE_COLLECTION).doc(nextPerson.id).update({
            firstName: nextPerson.firstName,
            middleNames: nextPerson.middleNames ?? '',
            lastName: nextPerson.lastName,
            maidenName: nextPerson.maidenName ?? '',
            hometown: nextPerson.hometown ?? '',
            birthPlace: nextPerson.birthPlace ?? '',
            birthDate: nextPerson.birthDate,
            deathDate: nextPerson.deathDate,
            gender: nextPerson.gender,
            notes: nextPerson.notes,
            lifeEvents: (0, admin_family_tree_utils_1.normaliseLifeEvents)(nextPerson.lifeEvents),
            photos: nextPerson.photos,
            preferredPhotoId: nextPerson.preferredPhotoId,
            updatedAt: (0, admin_family_tree_utils_1.nowIso)(),
        });
        await (0, admin_family_tree_utils_1.deleteStoragePhotos)(payload.removedPhotos ?? []);
        await (0, admin_family_tree_utils_1.deleteStoragePhotos)(payload.cleanupPhotos ?? []);
        const parentIds = await (0, admin_family_tree_utils_1.getParentIdsForChild)(this.db, nextPerson.treeId, nextPerson.id);
        await (0, admin_family_tree_utils_1.updateParentLifeEventsForChild)(this.db, parentIds, {
            id: nextPerson.id,
            treeId: nextPerson.treeId,
            firstName: nextPerson.firstName,
            lastName: nextPerson.lastName,
            birthDate: nextPerson.birthDate,
        });
    }
    async rejectApprovedPersonUpdate(payload) {
        await (0, admin_family_tree_utils_1.deleteStoragePhotos)(payload.uploadedPhotos ?? []);
        await (0, admin_family_tree_utils_1.deleteStoragePhotos)(payload.cleanupPhotos ?? []);
    }
    async deletePersonDirect(person) {
        await (0, admin_family_tree_utils_1.deleteStoragePhotos)(person.photos);
        const relationships = await (0, admin_family_tree_utils_1.getRelationshipsTouchingPerson)(this.db, person.treeId, person.id);
        const parentIds = relationships
            .filter((relationship) => relationship.type === 'parent-child' && relationship.toPersonId === person.id)
            .map((relationship) => relationship.fromPersonId);
        await (0, admin_family_tree_utils_1.updateParentLifeEventsForChild)(this.db, parentIds, {
            id: person.id,
            treeId: person.treeId,
            firstName: person.firstName,
            lastName: person.lastName,
            birthDate: '',
        });
        const refsToDelete = relationships.map((relationship) => this.db.collection(admin_family_tree_utils_1.RELATIONSHIPS_COLLECTION).doc(relationship.id));
        refsToDelete.push(this.db.collection(admin_family_tree_utils_1.PEOPLE_COLLECTION).doc(person.id));
        await (0, admin_family_tree_utils_1.deleteDocumentRefs)(this.db, refsToDelete);
    }
    async applyApprovedDeletePerson(payload) {
        const person = payload.deletedPerson;
        if (!person) {
            throw new https_1.HttpsError('failed-precondition', 'The approved family member deletion is missing its target data.');
        }
        await this.deletePersonDirect(person);
    }
    async createRelationshipDirect(relationship) {
        await this.db.collection(admin_family_tree_utils_1.RELATIONSHIPS_COLLECTION).doc(relationship.id).set({
            treeId: relationship.treeId,
            ownerId: relationship.ownerId,
            type: relationship.type,
            fromPersonId: relationship.fromPersonId,
            toPersonId: relationship.toPersonId,
            relationshipStatus: relationship.type === 'spouse'
                ? relationship.relationshipStatus ?? relationship_1.DEFAULT_SPOUSE_RELATIONSHIP_STATUS
                : '',
            parentChildKind: relationship.type === 'parent-child'
                ? relationship.parentChildKind ?? relationship_1.DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND
                : '',
            createdAt: relationship.createdAt,
        });
        if (relationship.type === 'parent-child') {
            const childSnapshot = await this.db.collection(admin_family_tree_utils_1.PEOPLE_COLLECTION).doc(relationship.toPersonId).get();
            if (childSnapshot.exists) {
                const childData = childSnapshot.data() ?? {};
                await (0, admin_family_tree_utils_1.updateParentLifeEventsForChild)(this.db, [relationship.fromPersonId], {
                    id: childSnapshot.id,
                    treeId: childData.treeId ?? relationship.treeId,
                    firstName: childData.firstName ?? '',
                    lastName: childData.lastName ?? '',
                    birthDate: childData.birthDate ?? '',
                });
            }
        }
    }
    async applyApprovedCreateRelationship(payload) {
        const relationship = payload.relationship;
        if (!relationship) {
            throw new https_1.HttpsError('failed-precondition', 'The approved relationship is missing its target data.');
        }
        await this.createRelationshipDirect(relationship);
    }
    async applyApprovedUpdateRelationship(payload) {
        const relationship = payload.relationship;
        if (!relationship) {
            throw new https_1.HttpsError('failed-precondition', 'The approved relationship update is missing its target data.');
        }
        await this.db.collection(admin_family_tree_utils_1.RELATIONSHIPS_COLLECTION).doc(relationship.id).update({
            relationshipStatus: relationship.type === 'spouse'
                ? relationship.relationshipStatus ?? relationship_1.DEFAULT_SPOUSE_RELATIONSHIP_STATUS
                : '',
            parentChildKind: relationship.type === 'parent-child'
                ? relationship.parentChildKind ?? relationship_1.DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND
                : '',
        });
    }
    async deleteRelationshipDirect(relationshipId) {
        const relationshipRef = this.db.collection(admin_family_tree_utils_1.RELATIONSHIPS_COLLECTION).doc(relationshipId);
        const relationshipSnapshot = await relationshipRef.get();
        if (relationshipSnapshot.exists) {
            const relationshipData = relationshipSnapshot.data() ?? {};
            if (relationshipData.type === 'parent-child') {
                const childSnapshot = await this.db.collection(admin_family_tree_utils_1.PEOPLE_COLLECTION).doc(relationshipData.toPersonId).get();
                if (childSnapshot.exists) {
                    const childData = childSnapshot.data() ?? {};
                    await (0, admin_family_tree_utils_1.updateParentLifeEventsForChild)(this.db, [relationshipData.fromPersonId], {
                        id: childSnapshot.id,
                        treeId: childData.treeId ?? relationshipData.treeId,
                        firstName: childData.firstName ?? '',
                        lastName: childData.lastName ?? '',
                        birthDate: '',
                    });
                }
            }
        }
        await relationshipRef.delete();
    }
    async applyApprovedDeleteRelationship(payload) {
        const relationship = payload.relationship;
        if (!relationship) {
            throw new https_1.HttpsError('failed-precondition', 'The approved relationship deletion is missing its target data.');
        }
        await this.deleteRelationshipDirect(relationship.id);
    }
    async applyApprovedRequest(request) {
        switch (request.operation) {
            case 'create-person':
                await this.applyApprovedCreatePerson(request.payload);
                return;
            case 'update-person':
                await this.applyApprovedPersonUpdate(request.payload);
                return;
            case 'delete-person':
                await this.applyApprovedDeletePerson(request.payload);
                return;
            case 'create-relationship':
                await this.applyApprovedCreateRelationship(request.payload);
                return;
            case 'update-relationship':
                await this.applyApprovedUpdateRelationship(request.payload);
                return;
            case 'delete-relationship':
                await this.applyApprovedDeleteRelationship(request.payload);
                return;
            default:
                throw new https_1.HttpsError('invalid-argument', 'Unsupported approval request.');
        }
    }
    async handleRejectedRequest(request) {
        if (request.operation === 'create-person') {
            await this.rejectApprovedCreatePerson(request.payload);
            return;
        }
        if (request.operation === 'update-person') {
            await this.rejectApprovedPersonUpdate(request.payload);
        }
    }
}
exports.ApprovalDecisionFunction = ApprovalDecisionFunction;
