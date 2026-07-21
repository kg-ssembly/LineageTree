import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import type { ApprovalRequest, ApprovalRequestPayload } from '../../../components/dto/approval';
import type { PersonRecord, PersonPhoto } from '../../../components/dto/person';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from '../../../components/dto/relationship';
import {
  APPROVAL_REQUESTS_COLLECTION,
  PEOPLE_COLLECTION,
  RELATIONSHIPS_COLLECTION,
  TREES_COLLECTION,
  deleteDocumentRefs,
  deleteStoragePhotos,
  formatPersonName,
  getParentIdsForChild,
  getRelationshipsTouchingPerson,
  getTreeById,
  mapApprovalRequestData,
  normaliseLifeEvents,
  nowIso,
  updateParentLifeEventsForChild,
} from '../shared/admin-family-tree-utils';

export class ApprovalDecisionFunction {
  constructor(private readonly db: Firestore) {}

  async decide(actorUserId: string, requestId: string, decision: 'approve' | 'reject', auto = false) {
    const requestRef = this.db.collection(APPROVAL_REQUESTS_COLLECTION).doc(requestId);
    const requestSnapshot = await requestRef.get();
    if (!requestSnapshot.exists) {
      throw new HttpsError('not-found', 'That approval request no longer exists.');
    }

    const request = mapApprovalRequestData(requestSnapshot.id, requestSnapshot.data() ?? {});
    if (request.status !== 'pending') {
      return { ok: true };
    }

    if (!auto && !request.eligibleApproverIds.includes(actorUserId)) {
      throw new HttpsError('permission-denied', 'You cannot review this approval request.');
    }

    const decisionTime = nowIso();
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
    const appliedAt = nowIso();
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

  async processExpired(actorUserId: string, treeId: string) {
    const tree = await getTreeById(this.db, treeId);
    if (!tree.editorIds.includes(actorUserId)) {
      throw new HttpsError('permission-denied', 'Only a tree editor can process expired approvals.');
    }

    const snapshot = await this.db.collection(APPROVAL_REQUESTS_COLLECTION)
      .where('treeId', '==', treeId)
      .where('status', '==', 'pending')
      .get();
    const now = Date.now();

    for (const docSnapshot of snapshot.docs) {
      const request = mapApprovalRequestData(docSnapshot.id, docSnapshot.data());
      if (request.status === 'pending' && request.expiresAtMillis <= now) {
        await this.decide(actorUserId, request.id, 'approve', true);
      }
    }

    return { ok: true };
  }

  private async getRequesterLabel(treeId: string, userId: string) {
    const tree = await getTreeById(this.db, treeId);
    const collaborator = tree.collaborators.find((entry) => entry.userId === userId);
    return collaborator?.displayName || collaborator?.email || 'A collaborator';
  }

  private async applyApprovedCreatePerson(payload: ApprovalRequestPayload) {
    const person = payload.afterPerson;
    if (!person) {
      throw new HttpsError('failed-precondition', 'The approved family member creation is missing its target data.');
    }

    const bundledRelationships = payload.relationships ?? [];
    const batch = this.db.batch();
    batch.set(this.db.collection(PEOPLE_COLLECTION).doc(person.id), {
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
      lifeEvents: normaliseLifeEvents(person.lifeEvents),
      photos: person.photos,
      preferredPhotoId: person.preferredPhotoId,
      createdAt: person.createdAt,
      updatedAt: nowIso(),
    });

    bundledRelationships.forEach((relationship) => {
      batch.set(this.db.collection(RELATIONSHIPS_COLLECTION).doc(relationship.id), {
        treeId: relationship.treeId,
        ownerId: relationship.ownerId,
        type: relationship.type,
        fromPersonId: relationship.fromPersonId,
        toPersonId: relationship.toPersonId,
        relationshipStatus: relationship.type === 'spouse'
          ? relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS
          : '',
        parentChildKind: relationship.type === 'parent-child'
          ? relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND
          : '',
        createdAt: relationship.createdAt,
      });
    });

    await batch.commit();

    const parentIds = bundledRelationships
      .filter((relationship) => relationship.type === 'parent-child' && relationship.toPersonId === person.id)
      .map((relationship) => relationship.fromPersonId);
    await updateParentLifeEventsForChild(this.db, parentIds, {
      id: person.id,
      treeId: person.treeId,
      firstName: person.firstName,
      lastName: person.lastName,
      birthDate: person.birthDate,
    });
  }

  private async rejectApprovedCreatePerson(payload: ApprovalRequestPayload) {
    await deleteStoragePhotos(payload.uploadedPhotos ?? []);
    await deleteStoragePhotos(payload.cleanupPhotos ?? []);
  }

  private async applyApprovedPersonUpdate(payload: ApprovalRequestPayload) {
    const nextPerson = payload.afterPerson;
    if (!nextPerson) {
      throw new HttpsError('failed-precondition', 'The approved family member update is missing its target data.');
    }

    await this.db.collection(PEOPLE_COLLECTION).doc(nextPerson.id).update({
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
      lifeEvents: normaliseLifeEvents(nextPerson.lifeEvents),
      photos: nextPerson.photos,
      preferredPhotoId: nextPerson.preferredPhotoId,
      updatedAt: nowIso(),
    });

    await deleteStoragePhotos(payload.removedPhotos ?? []);
    await deleteStoragePhotos(payload.cleanupPhotos ?? []);

    const parentIds = await getParentIdsForChild(this.db, nextPerson.treeId, nextPerson.id);
    await updateParentLifeEventsForChild(this.db, parentIds, {
      id: nextPerson.id,
      treeId: nextPerson.treeId,
      firstName: nextPerson.firstName,
      lastName: nextPerson.lastName,
      birthDate: nextPerson.birthDate,
    });
  }

  private async rejectApprovedPersonUpdate(payload: ApprovalRequestPayload) {
    await deleteStoragePhotos(payload.uploadedPhotos ?? []);
    await deleteStoragePhotos(payload.cleanupPhotos ?? []);
  }

  private async deletePersonDirect(person: PersonRecord) {
    await deleteStoragePhotos(person.photos);

    const relationships = await getRelationshipsTouchingPerson(this.db, person.treeId, person.id);
    const parentIds = relationships
      .filter((relationship) => relationship.type === 'parent-child' && relationship.toPersonId === person.id)
      .map((relationship) => relationship.fromPersonId);

    await updateParentLifeEventsForChild(this.db, parentIds, {
      id: person.id,
      treeId: person.treeId,
      firstName: person.firstName,
      lastName: person.lastName,
      birthDate: '',
    });

    const refsToDelete = relationships.map((relationship) => this.db.collection(RELATIONSHIPS_COLLECTION).doc(relationship.id));
    refsToDelete.push(this.db.collection(PEOPLE_COLLECTION).doc(person.id));
    await deleteDocumentRefs(this.db, refsToDelete);
  }

  private async applyApprovedDeletePerson(payload: ApprovalRequestPayload) {
    const person = payload.deletedPerson;
    if (!person) {
      throw new HttpsError('failed-precondition', 'The approved family member deletion is missing its target data.');
    }

    await this.deletePersonDirect(person);
  }

  private async createRelationshipDirect(relationship: NonNullable<ApprovalRequestPayload['relationship']>) {
    await this.db.collection(RELATIONSHIPS_COLLECTION).doc(relationship.id).set({
      treeId: relationship.treeId,
      ownerId: relationship.ownerId,
      type: relationship.type,
      fromPersonId: relationship.fromPersonId,
      toPersonId: relationship.toPersonId,
      relationshipStatus: relationship.type === 'spouse'
        ? relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS
        : '',
      parentChildKind: relationship.type === 'parent-child'
        ? relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND
        : '',
      createdAt: relationship.createdAt,
    });

    if (relationship.type === 'parent-child') {
      const childSnapshot = await this.db.collection(PEOPLE_COLLECTION).doc(relationship.toPersonId).get();
      if (childSnapshot.exists) {
        const childData = childSnapshot.data() ?? {};
        await updateParentLifeEventsForChild(this.db, [relationship.fromPersonId], {
          id: childSnapshot.id,
          treeId: childData.treeId ?? relationship.treeId,
          firstName: childData.firstName ?? '',
          lastName: childData.lastName ?? '',
          birthDate: childData.birthDate ?? '',
        });
      }
    }
  }

  private async applyApprovedCreateRelationship(payload: ApprovalRequestPayload) {
    const relationship = payload.relationship;
    if (!relationship) {
      throw new HttpsError('failed-precondition', 'The approved relationship is missing its target data.');
    }

    await this.createRelationshipDirect(relationship);
  }

  private async applyApprovedUpdateRelationship(payload: ApprovalRequestPayload) {
    const relationship = payload.relationship;
    if (!relationship) {
      throw new HttpsError('failed-precondition', 'The approved relationship update is missing its target data.');
    }

    await this.db.collection(RELATIONSHIPS_COLLECTION).doc(relationship.id).update({
      relationshipStatus: relationship.type === 'spouse'
        ? relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS
        : '',
      parentChildKind: relationship.type === 'parent-child'
        ? relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND
        : '',
    });
  }

  private async deleteRelationshipDirect(relationshipId: string) {
    const relationshipRef = this.db.collection(RELATIONSHIPS_COLLECTION).doc(relationshipId);
    const relationshipSnapshot = await relationshipRef.get();

    if (relationshipSnapshot.exists) {
      const relationshipData = relationshipSnapshot.data() ?? {};
      if (relationshipData.type === 'parent-child') {
        const childSnapshot = await this.db.collection(PEOPLE_COLLECTION).doc(relationshipData.toPersonId).get();
        if (childSnapshot.exists) {
          const childData = childSnapshot.data() ?? {};
          await updateParentLifeEventsForChild(this.db, [relationshipData.fromPersonId], {
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

  private async applyApprovedDeleteRelationship(payload: ApprovalRequestPayload) {
    const relationship = payload.relationship;
    if (!relationship) {
      throw new HttpsError('failed-precondition', 'The approved relationship deletion is missing its target data.');
    }

    await this.deleteRelationshipDirect(relationship.id);
  }

  private async applyApprovedRequest(request: ApprovalRequest) {
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
        throw new HttpsError('invalid-argument', 'Unsupported approval request.');
    }
  }

  private async handleRejectedRequest(request: ApprovalRequest) {
    if (request.operation === 'create-person') {
      await this.rejectApprovedCreatePerson(request.payload);
      return;
    }

    if (request.operation === 'update-person') {
      await this.rejectApprovedPersonUpdate(request.payload);
    }
  }
}
