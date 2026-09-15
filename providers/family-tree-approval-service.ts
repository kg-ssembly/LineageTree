import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { ApprovalRequest, ApprovalRequestPayload, ApprovalSubmissionResult } from '../components/dto/approval';
import type { NewPersonPhotoInput, PersonInput, PersonMutationPayload, PersonPhoto, PersonRecord } from '../components/dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from '../components/dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from '../components/dto/relationship';
import type { FamilyTree } from '../components/dto/tree';
import { getPersonValidationFeedback, normalizeRelationshipEndpoints, validateProposedRelationship } from '../components/family-tree-validation';
import {
  APPROVAL_REQUESTS_COLLECTION,
  PEOPLE_COLLECTION,
  RELATIONSHIPS_COLLECTION,
  buildParentChildRelationshipId,
  buildSpouseRelationshipId,
  deleteDocumentRefs,
  ensurePeopleBelongToTree,
  getParentIdsForChild,
  getPeopleByTreeId,
  getPeopleForValidation,
  getRelationshipsForTree,
  getRelationshipsTouchingPerson,
  getTreeById,
  updateParentLifeEventsForChild,
} from './family-tree-data';
import { db, functionsApi } from './firebase-provider';
import {
  formatPersonName,
  clampApprovalWindowHours,
  mapApprovalRequest,
  mapApprovalRequestData,
  mapRelationshipData,
  normaliseLifeEvents,
  stripUndefinedDeep,
} from './family-tree-mappers';
import {
  applyPreferredPhotoDisplayVariant,
  deletePhotos,
  normaliseNewPhotoInputs,
  resolvePreferredPhotoId,
  resolvePreferredPhotoSourceUri,
  uploadPersonPhotos,
  uploadPreferredPhotoDisplayVariant,
} from './family-tree-photo-service';
import { shouldApplyApprovalImmediately } from './family-tree-approval-policy';
import { nowIso } from './family-tree-shared';

type PendingCreateRelationshipInput = {
  mode: 'parent-of' | 'child-of' | 'spouse-of';
  relatedPersonId: string;
  parentChildKind?: ParentChildRelationshipKind;
  relationshipStatus?: SpouseRelationshipStatus;
};

export type CreatePersonApprovalResult = ApprovalSubmissionResult & {
  person?: PersonRecord | null;
};

async function preparePersonUpdatePreview(
  actorUserId: string,
  person: PersonRecord,
  input: PersonMutationPayload,
) {
  const newPhotoInputs = normaliseNewPhotoInputs(input.newPhotoUris, input.newPhotos);
  const uploadedPhotos = await uploadPersonPhotos(actorUserId, person.treeId, person.id, newPhotoInputs);
  const preferredPhotoId = resolvePreferredPhotoId(
    input.preferredPhotoRef,
    input.existingPhotos,
    input.newPhotoUris,
    uploadedPhotos,
  );
  const preferredPhotoSourceUri = resolvePreferredPhotoSourceUri(
    input.preferredPhotoRef,
    input.existingPhotos,
    newPhotoInputs,
  );
  const preferredDisplayPhoto = preferredPhotoId && preferredPhotoSourceUri && input.cropPreferredPhotoRef === input.preferredPhotoRef
    ? await uploadPreferredPhotoDisplayVariant(actorUserId, person.treeId, person.id, preferredPhotoId, preferredPhotoSourceUri)
    : null;
  const nextPhotos = applyPreferredPhotoDisplayVariant(
    [...input.existingPhotos, ...uploadedPhotos],
    preferredPhotoId,
    preferredDisplayPhoto,
  );
  const timestamp = nowIso();

  const nextPerson: PersonRecord = {
    ...person,
    firstName: input.firstName.trim(),
    middleNames: input.middleNames?.trim() ?? person.middleNames ?? '',
    lastName: input.lastName.trim(),
    maidenName: input.maidenName?.trim() ?? person.maidenName ?? '',
    birthSurnameStatus: input.birthSurnameStatus ?? (input.maidenName === undefined
      ? person.birthSurnameStatus ?? (person.maidenName?.trim() ? 'different' : 'unknown')
      : input.maidenName.trim() ? 'different' : person.birthSurnameStatus === 'same' ? 'same' : 'unknown'),
    hometown: input.hometown?.trim() ?? '',
    birthPlace: input.birthPlace?.trim() ?? '',
    birthDate: input.birthDate.trim(),
    deathDate: input.deathDate.trim(),
    lifeStatus: input.lifeStatus ?? (input.deathDate ? 'deceased' : 'living'),
    gender: input.gender,
    notes: input.notes.trim(),
    lifeEvents: normaliseLifeEvents(input.lifeEvents),
    photos: nextPhotos,
    preferredPhotoId: nextPhotos.some((photo) => photo.id === preferredPhotoId) ? preferredPhotoId : '',
    updatedAt: timestamp,
  };

  return {
    nextPerson,
    uploadedPhotos,
    removedPhotos: input.removedPhotos,
    cleanupPhotos: input.existingPhotos
      .filter((photo) => photo.displayPath)
      .filter((photo) => photo.id !== preferredPhotoId)
      .map((photo) => ({
        ...photo,
        url: '',
        path: '',
      })),
  };
}

function buildPendingCreateRelationships(
  actorUserId: string,
  treeId: string,
  personId: string,
  pendingRelationships: PendingCreateRelationshipInput[],
) {
  return pendingRelationships
    .filter((relationship) => relationship.relatedPersonId.trim())
    .map<RelationshipRecord>((relationship) => {
      const relationshipType = relationship.mode === 'spouse-of' ? 'spouse' : 'parent-child';
      const rawFromPersonId = relationship.mode === 'child-of' ? relationship.relatedPersonId : personId;
      const rawToPersonId = relationship.mode === 'child-of' ? personId : relationship.relatedPersonId;
      const normalized = normalizeRelationshipEndpoints(relationshipType, rawFromPersonId, rawToPersonId);
      const relationshipId = relationshipType === 'spouse'
        ? buildSpouseRelationshipId(normalized.fromPersonId, normalized.toPersonId)
        : buildParentChildRelationshipId(normalized.fromPersonId, normalized.toPersonId);

      return {
        id: relationshipId,
        treeId,
        ownerId: actorUserId,
        type: relationshipType,
        fromPersonId: normalized.fromPersonId,
        toPersonId: normalized.toPersonId,
        relationshipStatus: relationshipType === 'spouse'
          ? relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS
          : undefined,
        parentChildKind: relationshipType === 'parent-child'
          ? relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND
          : undefined,
        createdAt: nowIso(),
      };
    });
}

async function validatePendingCreateRelationships(
  treeId: string,
  person: PersonRecord,
  pendingRelationships: RelationshipRecord[],
) {
  if (pendingRelationships.length === 0) {
    return;
  }

  await ensurePeopleBelongToTree(treeId, pendingRelationships.flatMap((relationship) => {
    const relatedPersonId = relationship.fromPersonId === person.id
      ? relationship.toPersonId
      : relationship.fromPersonId;
    return [relatedPersonId];
  }));

  const validationPeople = [
    person,
    ...await getPeopleForValidation(treeId),
  ];
  const existingRelationships = await getRelationshipsForTree(treeId);
  const allRelationships = [...existingRelationships, ...pendingRelationships];

  for (const relationship of pendingRelationships) {
    const validationMessage = validateProposedRelationship({
      people: validationPeople,
      relationships: allRelationships,
      type: relationship.type,
      fromPersonId: relationship.fromPersonId,
      toPersonId: relationship.toPersonId,
      parentChildKind: relationship.parentChildKind,
      relationshipStatus: relationship.relationshipStatus,
      ignoreRelationshipId: relationship.id,
    });

    if (validationMessage) {
      throw new Error(validationMessage);
    }

    // Missing documents have no treeId for the read rules to authorize.
    // The tree-scoped snapshot above already contains existing connections.
    if (existingRelationships.some((existing) => existing.id === relationship.id)) {
      throw new Error(relationship.type === 'spouse'
        ? 'That spouse relationship already exists.'
        : 'That parent-child relationship already exists.');
    }
  }
}

async function submitToServer(treeId: string, operation: ApprovalRequest['operation'], payload: ApprovalRequestPayload): Promise<CreatePersonApprovalResult> {
 const operationId = doc(collection(db, APPROVAL_REQUESTS_COLLECTION)).id;
 const result = await httpsCallable<object, CreatePersonApprovalResult>(functionsApi, 'submitFamilyChangeServer')(stripUndefinedDeep({treeId, operation, payload, operationId}));
 return result.data;
}

export async function submitCreatePersonApproval(
  actorUserId: string,
  treeId: string,
  input: PersonInput,
  newPhotos: NewPersonPhotoInput[],
  pendingRelationships: PendingCreateRelationshipInput[] = [],
  options?: {
    forceImmediateApproval?: boolean;
  },
): Promise<CreatePersonApprovalResult> {
  const personRef = doc(collection(db, PEOPLE_COLLECTION));
  const timestamp = nowIso();
  const normalizedNewPhotos = normaliseNewPhotoInputs(
    newPhotos.map((photo) => photo.uri),
    newPhotos,
  );
  const newPhotoUris = normalizedNewPhotos.map((photo) => photo.uri);

  await validatePersonCreation(treeId, {
    firstName: input.firstName,
    middleNames: input.middleNames ?? '',
    lastName: input.lastName,
    maidenName: input.maidenName ?? '',
    birthSurnameStatus: input.birthSurnameStatus ?? (input.maidenName?.trim() ? 'different' : 'unknown'),
    birthDate: input.birthDate,
    deathDate: input.deathDate,
    lifeStatus: input.lifeStatus ?? (input.deathDate ? 'deceased' : 'living'),
    notes: input.notes,
    lifeEvents: input.lifeEvents,
  }, newPhotoUris);

  let uploadedPhotos: PersonPhoto[] = [];
  let preferredDisplayPhoto: { url: string; path: string } | null = null;

  try {
    uploadedPhotos = await uploadPersonPhotos(actorUserId, treeId, personRef.id, normalizedNewPhotos);
    const preferredPhotoId = resolvePreferredPhotoId(input.preferredPhotoRef, [], newPhotoUris, uploadedPhotos);
    const preferredPhotoSourceUri = resolvePreferredPhotoSourceUri(input.preferredPhotoRef, [], normalizedNewPhotos);
    preferredDisplayPhoto = preferredPhotoId && preferredPhotoSourceUri && input.cropPreferredPhotoRef === input.preferredPhotoRef
      ? await uploadPreferredPhotoDisplayVariant(actorUserId, treeId, personRef.id, preferredPhotoId, preferredPhotoSourceUri)
      : null;
    const nextPhotos = applyPreferredPhotoDisplayVariant(uploadedPhotos, preferredPhotoId, preferredDisplayPhoto);
    const person: PersonRecord = {
      id: personRef.id,
      treeId,
      treeMembershipIds: [treeId],
      treeMemberships: [{ treeId, role: 'subject', joinedAt: timestamp, addedByUserId: actorUserId, source: 'manual' }],
      ownerId: actorUserId,
      firstName: input.firstName.trim(),
      middleNames: input.middleNames?.trim() ?? '',
      lastName: input.lastName.trim(),
      maidenName: input.maidenName?.trim() ?? '',
      birthSurnameStatus: input.birthSurnameStatus ?? (input.maidenName?.trim() ? 'different' : 'unknown'),
      nicknames: [],
      clanName: '',
      familyBranch: '',
      hometown: input.hometown?.trim() ?? '',
      birthPlace: input.birthPlace?.trim() ?? '',
      surnameVariantHints: Array.isArray(input.surnameVariantHints)
        ? [...new Set(input.surnameVariantHints.map((value) => value.trim()).filter(Boolean))]
        : [],
      canonicalPersonId: '',
      duplicatePersonIds: [],
      birthDate: input.birthDate.trim(),
      deathDate: input.deathDate.trim(),
      lifeStatus: input.lifeStatus ?? (input.deathDate ? 'deceased' : 'living'),
      gender: input.gender,
      notes: input.notes.trim(),
      lifeEvents: normaliseLifeEvents(input.lifeEvents),
      photos: nextPhotos,
      preferredPhotoId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const bundledRelationships = buildPendingCreateRelationships(actorUserId, treeId, person.id, pendingRelationships);

    await validatePendingCreateRelationships(treeId, person, bundledRelationships);

    const tree = await getTreeById(treeId);
      const cleanupPhotos = preferredDisplayPhoto ? [{
      id: `${person.id}-preferred-cleanup`,
      url: preferredDisplayPhoto.url,
      path: preferredDisplayPhoto.path,
      createdAt: timestamp,
    } satisfies PersonPhoto] : [];
    const payload: ApprovalRequestPayload = {
      afterPerson: person,
      relationships: bundledRelationships,
      uploadedPhotos: nextPhotos,
      cleanupPhotos,
    };
    return await submitToServer(treeId, 'create-person', payload);

  } catch (error) {
    await deletePhotos([
      ...uploadedPhotos,
      ...(preferredDisplayPhoto ? [{
        id: `${personRef.id}-preferred-cleanup`,
        url: preferredDisplayPhoto.url,
        path: preferredDisplayPhoto.path,
        createdAt: timestamp,
      } satisfies PersonPhoto] : []),
    ]);
    throw error;
  }
}

export async function submitPersonUpdateApproval(
  actorUserId: string,
  person: PersonRecord,
  input: PersonMutationPayload,
): Promise<ApprovalSubmissionResult> {
  const tree = await getTreeById(person.treeId);
  const { nextPerson, uploadedPhotos, removedPhotos, cleanupPhotos } = await preparePersonUpdatePreview(actorUserId, person, input);
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = {
    beforePerson: person,
    afterPerson: nextPerson,
    removedPhotos,
    uploadedPhotos,
    cleanupPhotos,
  };
  return await submitToServer(person.treeId, 'update-person', payload);

}

export async function submitDeletePersonApproval(
  actorUserId: string,
  person: PersonRecord,
): Promise<ApprovalSubmissionResult> {
  const tree = await getTreeById(person.treeId);
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = { deletedPerson: person };
  return await submitToServer(person.treeId, 'delete-person', payload);

}

export async function submitCreateRelationshipApproval(
  actorUserId: string,
  treeId: string,
  type: RelationshipRecord['type'],
  fromPersonId: string,
  toPersonId: string,
  options: {
    relationshipStatus?: SpouseRelationshipStatus;
    parentChildKind?: ParentChildRelationshipKind;
  } = {},
): Promise<ApprovalSubmissionResult> {
  const tree = await getTreeById(treeId);
  await ensurePeopleBelongToTree(treeId, [fromPersonId, toPersonId]);
  const existingRelationships = await getRelationshipsForTree(treeId);
  const validationPeople = await getPeopleForValidation(treeId);
  const validationMessage = validateProposedRelationship({
    people: validationPeople,
    relationships: existingRelationships,
    type,
    fromPersonId,
    toPersonId,
    parentChildKind: options.parentChildKind,
    relationshipStatus: options.relationshipStatus,
  });
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  const normalizedEndpoints = normalizeRelationshipEndpoints(type, fromPersonId, toPersonId);
  const relationshipId = type === 'spouse'
    ? buildSpouseRelationshipId(normalizedEndpoints.fromPersonId, normalizedEndpoints.toPersonId)
    : buildParentChildRelationshipId(normalizedEndpoints.fromPersonId, normalizedEndpoints.toPersonId);
  // Reads of missing documents cannot satisfy the tree-scoped read rule.
  // Reuse the authorized tree query above rather than probing an absent ID.
  if (existingRelationships.some((relationship) => relationship.id === relationshipId)) {
    throw new Error(type === 'spouse' ? 'That spouse relationship already exists.' : 'That parent-child relationship already exists.');
  }

  const relationship: RelationshipRecord = {
    id: relationshipId,
    treeId,
    ownerId: actorUserId,
    type,
    fromPersonId: normalizedEndpoints.fromPersonId,
    toPersonId: normalizedEndpoints.toPersonId,
    relationshipStatus: type === 'spouse'
      ? options.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS
      : undefined,
    parentChildKind: type === 'parent-child'
      ? options.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND
      : undefined,
    createdAt: nowIso(),
  };
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = { relationship };
  const relationLabel = type === 'spouse' ? 'spouse relationship' : 'parent-child relationship';
  return await submitToServer(treeId, 'create-relationship', payload);

}

export async function submitUpdateRelationshipApproval(
  actorUserId: string,
  relationship: RelationshipRecord,
  updates: {
    relationshipStatus?: SpouseRelationshipStatus;
    parentChildKind?: ParentChildRelationshipKind;
  },
): Promise<ApprovalSubmissionResult> {
  const nextRelationship: RelationshipRecord = {
    ...relationship,
    relationshipStatus: relationship.type === 'spouse'
      ? updates.relationshipStatus ?? relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS
      : undefined,
    parentChildKind: relationship.type === 'parent-child'
      ? updates.parentChildKind ?? relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND
      : undefined,
  };
  await ensurePeopleBelongToTree(relationship.treeId, [nextRelationship.fromPersonId, nextRelationship.toPersonId]);
  const existingRelationships = await getRelationshipsForTree(relationship.treeId);
  const validationPeople = await getPeopleForValidation(relationship.treeId);
  const validationMessage = validateProposedRelationship({
    people: validationPeople,
    relationships: existingRelationships,
    type: nextRelationship.type,
    fromPersonId: nextRelationship.fromPersonId,
    toPersonId: nextRelationship.toPersonId,
    parentChildKind: nextRelationship.parentChildKind,
    relationshipStatus: nextRelationship.relationshipStatus,
    ignoreRelationshipId: nextRelationship.id,
  });
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  const tree = await getTreeById(relationship.treeId);
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = { relationship: nextRelationship };
  const relationLabel = relationship.type === 'spouse' ? 'spouse relationship' : 'parent-child relationship';
  return await submitToServer(relationship.treeId, 'update-relationship', payload);

}

export async function submitDeleteRelationshipApproval(
  actorUserId: string,
  relationshipId: string,
): Promise<ApprovalSubmissionResult> {
  const relationshipRef = doc(db, RELATIONSHIPS_COLLECTION, relationshipId);
  const relationshipSnapshot = await getDoc(relationshipRef);
  if (!relationshipSnapshot.exists()) {
    throw new Error('That relationship no longer exists.');
  }

  const relationship = mapRelationshipData(relationshipSnapshot.id, relationshipSnapshot.data());
  const tree = await getTreeById(relationship.treeId);
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = { relationship };
  const relationLabel = relationship.type === 'spouse' ? 'spouse relationship' : 'parent-child relationship';
  return await submitToServer(relationship.treeId, 'delete-relationship', payload);

}

export async function decideApprovalRequest(
  actorUserId: string,
  requestId: string,
  decision: 'approve' | 'reject',
  options?: { auto?: boolean },
) {
  await httpsCallable<
    { requestId: string; decision: 'approve' | 'reject'; auto?: boolean },
    { ok: boolean }
  >(functionsApi, 'decideApprovalRequestServer')({
    requestId,
    decision,
    auto: options?.auto === true,
  });
}

export async function processExpiredApprovalRequests(actorUserId: string, treeId: string) {
  await httpsCallable<{ treeId: string }, { ok: boolean }>(
    functionsApi,
    'processExpiredApprovalRequestsServer',
  )({ treeId });
}

export async function validatePersonCreation(treeId: string, person: {
  firstName: string;
  middleNames?: string;
  lastName: string;
  maidenName?: string;
  birthSurnameStatus?: PersonRecord['birthSurnameStatus'];
  birthDate: string;
  deathDate: string;
  lifeStatus?: PersonRecord['lifeStatus'];
  notes: string;
  lifeEvents: PersonRecord['lifeEvents'];
}, newPhotoUris: string[]) {
  const validationPeople = await getPeopleForValidation(treeId);
  const validationFeedback = getPersonValidationFeedback({
    people: validationPeople,
    person: {
      firstName: person.firstName,
      middleNames: person.middleNames ?? '',
      lastName: person.lastName,
      maidenName: person.maidenName ?? '',
      birthDate: person.birthDate,
      deathDate: person.deathDate,
      lifeStatus: person.lifeStatus ?? (person.deathDate ? 'deceased' : 'living'),
      notes: person.notes,
      lifeEvents: person.lifeEvents,
    },
    newPhotoUris,
    requireIdentityContext: true,
  });
  if (validationFeedback.errors.length > 0) {
    throw new Error(validationFeedback.errors[0]);
  }
}
