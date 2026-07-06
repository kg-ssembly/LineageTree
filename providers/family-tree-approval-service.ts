import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { ApprovalRequest, ApprovalRequestPayload, ApprovalSubmissionResult } from '../components/dto/approval';
import type { PersonMutationPayload, PersonRecord } from '../components/dto/person';
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
import { db } from './firebase-provider';
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
import { nowIso } from './family-tree-shared';

function getRequesterLabel(tree: FamilyTree, userId: string) {
  const collaborator = tree.collaborators.find((entry) => entry.userId === userId);
  return collaborator?.displayName || collaborator?.email || 'A collaborator';
}

function normaliseSurnameKey(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? '';
}

function buildSurnameCanonicalLookup(tree: FamilyTree) {
  const lookup = new Map<string, string>();

  tree.surnameVariantGroups.forEach((group) => {
    const primaryKey = normaliseSurnameKey(group.primarySurname);
    if (!primaryKey) {
      return;
    }

    lookup.set(primaryKey, primaryKey);
    group.variants.forEach((variant) => {
      const variantKey = normaliseSurnameKey(variant);
      if (variantKey) {
        lookup.set(variantKey, primaryKey);
      }
    });
  });

  return lookup;
}

function getCanonicalSurnameKeysForPerson(
  person: Pick<PersonRecord, 'lastName'> | null | undefined,
  surnameLookup: Map<string, string>,
) {
  const keys = new Set<string>();
  [person?.lastName].forEach((value) => {
    const rawKey = normaliseSurnameKey(value);
    if (!rawKey) {
      return;
    }
    keys.add(surnameLookup.get(rawKey) ?? rawKey);
  });

  return keys;
}

function intersectsSurnames(left: Set<string>, right: Set<string>) {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }
  return false;
}

function getApprovalScopeSurnames(
  tree: FamilyTree,
  peopleById: Map<string, PersonRecord>,
  payload: ApprovalRequestPayload,
) {
  const surnameLookup = buildSurnameCanonicalLookup(tree);
  const scope = new Set<string>();
  const peopleToInspect = [
    payload.beforePerson,
    payload.afterPerson,
    payload.deletedPerson,
  ].filter(Boolean) as PersonRecord[];

  if (payload.relationship) {
    const fromPerson = peopleById.get(payload.relationship.fromPersonId);
    const toPerson = peopleById.get(payload.relationship.toPersonId);
    if (fromPerson) {
      peopleToInspect.push(fromPerson);
    }
    if (toPerson) {
      peopleToInspect.push(toPerson);
    }
  }

  peopleToInspect.forEach((person) => {
    getCanonicalSurnameKeysForPerson(person, surnameLookup).forEach((surname) => scope.add(surname));
  });

  return { scope, surnameLookup };
}

async function getEligibleApproverIds(
  tree: FamilyTree,
  requesterUserId: string,
  payload: ApprovalRequestPayload,
) {
  const people = await getPeopleByTreeId(tree.id);
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const { scope, surnameLookup } = getApprovalScopeSurnames(tree, peopleById, payload);

  const nonContributorApprovers = tree.collaborators
    .filter((collaborator) => collaborator.userId !== requesterUserId)
    .filter((collaborator) => collaborator.role === 'owner' || collaborator.role === 'editor')
    .map((collaborator) => collaborator.userId);

  const contributorApprovers = tree.collaborators
    .filter((collaborator) => collaborator.userId !== requesterUserId)
    .filter((collaborator) => collaborator.role === 'contributor');

  const matchingContributorIds = scope.size === 0
    ? contributorApprovers.map((collaborator) => collaborator.userId)
    : contributorApprovers
      .filter((collaborator) => {
        const assignedPersonId = tree.personAssignments[collaborator.userId];
        const assignedPerson = assignedPersonId ? peopleById.get(assignedPersonId) ?? null : null;
        if (!assignedPerson) {
          return false;
        }

        const contributorSurnames = getCanonicalSurnameKeysForPerson(assignedPerson, surnameLookup);
        return intersectsSurnames(scope, contributorSurnames);
      })
      .map((collaborator) => collaborator.userId);

  return {
    eligibleApproverIds: [...new Set([...nonContributorApprovers, ...matchingContributorIds])],
    autoApproveBecauseNoSameSurnameContributor: scope.size > 0 && matchingContributorIds.length === 0,
  };
}

function buildApprovalExpiry(tree: FamilyTree) {
  const approvalWindowHours = clampApprovalWindowHours(tree.approvalWindowHours);
  const expiresAtMillis = Date.now() + approvalWindowHours * 60 * 60 * 1000;
  return {
    expiresAtMillis,
    expiresAt: new Date(expiresAtMillis).toISOString(),
  };
}

function areApprovalsDisabled(tree: FamilyTree) {
  return clampApprovalWindowHours(tree.approvalWindowHours) === 0;
}

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
    hometown: input.hometown?.trim() ?? '',
    birthPlace: input.birthPlace?.trim() ?? '',
    birthDate: input.birthDate.trim(),
    deathDate: input.deathDate.trim(),
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

async function applyApprovedPersonUpdate(payload: ApprovalRequestPayload) {
  const nextPerson = payload.afterPerson;
  if (!nextPerson) {
    throw new Error('The approved family member update is missing its target data.');
  }

  await updateDoc(doc(db, PEOPLE_COLLECTION, nextPerson.id), {
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

  await deletePhotos(payload.removedPhotos ?? []);
  await deletePhotos(payload.cleanupPhotos ?? []);

  const parentIds = await getParentIdsForChild(nextPerson.treeId, nextPerson.id);
  await updateParentLifeEventsForChild(parentIds, {
    id: nextPerson.id,
    treeId: nextPerson.treeId,
    firstName: nextPerson.firstName,
    lastName: nextPerson.lastName,
    birthDate: nextPerson.birthDate,
  });
}

async function rejectApprovedPersonUpdate(payload: ApprovalRequestPayload) {
  await deletePhotos(payload.uploadedPhotos ?? []);
  await deletePhotos(payload.cleanupPhotos ?? []);
}

async function deletePersonDirect(person: PersonRecord) {
  await deletePhotos(person.photos);

  const relationships = await getRelationshipsTouchingPerson(person.treeId, person.id);
  const parentIds = relationships
    .filter((relationship) => relationship.type === 'parent-child' && relationship.toPersonId === person.id)
    .map((relationship) => relationship.fromPersonId);

  await updateParentLifeEventsForChild(parentIds, {
    id: person.id,
    treeId: person.treeId,
    firstName: person.firstName,
    lastName: person.lastName,
    birthDate: '',
  });

  const refsToDelete = relationships.map((relationship) => doc(db, RELATIONSHIPS_COLLECTION, relationship.id));
  refsToDelete.push(doc(db, PEOPLE_COLLECTION, person.id));
  await deleteDocumentRefs(refsToDelete);
}

async function applyApprovedDeletePerson(payload: ApprovalRequestPayload) {
  const person = payload.deletedPerson;
  if (!person) {
    throw new Error('The approved family member deletion is missing its target data.');
  }

  await deletePersonDirect(person);
}

async function createRelationshipDirect(relationship: RelationshipRecord): Promise<RelationshipRecord> {
  const relationshipRef = doc(db, RELATIONSHIPS_COLLECTION, relationship.id);
  await setDoc(relationshipRef, {
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
    const childSnapshot = await getDoc(doc(db, PEOPLE_COLLECTION, relationship.toPersonId));
    if (childSnapshot.exists()) {
      const childData = childSnapshot.data();
      await updateParentLifeEventsForChild([relationship.fromPersonId], {
        id: childSnapshot.id,
        treeId: relationship.treeId,
        firstName: childData.firstName ?? '',
        lastName: childData.lastName ?? '',
        birthDate: childData.birthDate ?? '',
      });
    }
  }

  return relationship;
}

async function applyApprovedCreateRelationship(payload: ApprovalRequestPayload) {
  const relationship = payload.relationship;
  if (!relationship) {
    throw new Error('The approved relationship is missing its target data.');
  }

  await createRelationshipDirect(relationship);
}

async function applyApprovedUpdateRelationship(payload: ApprovalRequestPayload) {
  const relationship = payload.relationship;
  if (!relationship) {
    throw new Error('The approved relationship update is missing its target data.');
  }

  await updateDoc(doc(db, RELATIONSHIPS_COLLECTION, relationship.id), {
    relationshipStatus: relationship.type === 'spouse'
      ? relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS
      : '',
    parentChildKind: relationship.type === 'parent-child'
      ? relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND
      : '',
  });
}

async function deleteRelationshipDirect(relationshipId: string) {
  const relationshipRef = doc(db, RELATIONSHIPS_COLLECTION, relationshipId);
  const relationshipSnapshot = await getDoc(relationshipRef);

  if (relationshipSnapshot.exists()) {
    const relationshipData = relationshipSnapshot.data();
    if (relationshipData.type === 'parent-child') {
      const childSnapshot = await getDoc(doc(db, PEOPLE_COLLECTION, relationshipData.toPersonId));
      if (childSnapshot.exists()) {
        const childData = childSnapshot.data();
        await updateParentLifeEventsForChild([relationshipData.fromPersonId], {
          id: childSnapshot.id,
          treeId: childData.treeId ?? relationshipData.treeId,
          firstName: childData.firstName ?? '',
          lastName: childData.lastName ?? '',
          birthDate: '',
        });
      }
    }
  }

  await deleteDoc(relationshipRef);
}

async function applyApprovedDeleteRelationship(payload: ApprovalRequestPayload) {
  const relationship = payload.relationship;
  if (!relationship) {
    throw new Error('The approved relationship deletion is missing its target data.');
  }

  await deleteRelationshipDirect(relationship.id);
}

async function applyApprovedRequest(request: ApprovalRequest) {
  switch (request.operation) {
    case 'update-person':
      await applyApprovedPersonUpdate(request.payload);
      return;
    case 'delete-person':
      await applyApprovedDeletePerson(request.payload);
      return;
    case 'create-relationship':
      await applyApprovedCreateRelationship(request.payload);
      return;
    case 'update-relationship':
      await applyApprovedUpdateRelationship(request.payload);
      return;
    case 'delete-relationship':
      await applyApprovedDeleteRelationship(request.payload);
      return;
    default:
      throw new Error('Unsupported approval request.');
  }
}

async function handleRejectedRequest(request: ApprovalRequest) {
  if (request.operation === 'update-person') {
    await rejectApprovedPersonUpdate(request.payload);
  }
}

async function createApprovalRequest(request: Omit<ApprovalRequest, 'id'>) {
  const requestRef = doc(collection(db, APPROVAL_REQUESTS_COLLECTION));
  await setDoc(requestRef, stripUndefinedDeep(request));
  return requestRef.id;
}

function buildImmediateApprovalReason(
  noSameSurnameContributor: boolean,
  eligibleApproverIds: string[],
) {
  if (noSameSurnameContributor) {
    return 'no contributor linked to the same surname could review it';
  }
  if (eligibleApproverIds.length === 0) {
    return 'no other collaborator could review it';
  }
  return 'approvals are turned off for this tree';
}

export async function submitPersonUpdateApproval(
  actorUserId: string,
  person: PersonRecord,
  input: PersonMutationPayload,
): Promise<ApprovalSubmissionResult> {
  const tree = await getTreeById(person.treeId);
  const requesterLabel = getRequesterLabel(tree, actorUserId);
  const { nextPerson, uploadedPhotos, removedPhotos, cleanupPhotos } = await preparePersonUpdatePreview(actorUserId, person, input);
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = {
    beforePerson: person,
    afterPerson: nextPerson,
    removedPhotos,
    uploadedPhotos,
    cleanupPhotos,
  };
  const { eligibleApproverIds, autoApproveBecauseNoSameSurnameContributor } = await getEligibleApproverIds(tree, actorUserId, payload);

  if (eligibleApproverIds.length === 0 || areApprovalsDisabled(tree) || autoApproveBecauseNoSameSurnameContributor) {
    await applyApprovedPersonUpdate(payload);
    const appliedAt = nowIso();
    await createApprovalRequest({
      treeId: tree.id,
      entityType: 'person',
      operation: 'update-person',
      targetId: person.id,
      title: `Updated ${formatPersonName(person)}`,
      description: `${requesterLabel} updated this family member profile and it was applied immediately because ${buildImmediateApprovalReason(autoApproveBecauseNoSameSurnameContributor, eligibleApproverIds)}.`,
      status: 'applied',
      decisionMode: 'immediate',
      requestedByUserId: actorUserId,
      requestedByLabel: requesterLabel,
      eligibleApproverIds: [],
      payload,
      expiresAt: appliedAt,
      expiresAtMillis: Date.now(),
      createdAt: timestamp,
      updatedAt: appliedAt,
      decidedAt: appliedAt,
      decidedByUserId: actorUserId,
      decidedByLabel: requesterLabel,
      appliedAt,
    });

    return {
      status: 'applied',
      message: 'Family member changes were applied immediately.',
    };
  }

  const expiry = buildApprovalExpiry(tree);
  const requestId = await createApprovalRequest({
    treeId: tree.id,
    entityType: 'person',
    operation: 'update-person',
    targetId: person.id,
    title: `Update ${formatPersonName(person)}`,
    description: `${requesterLabel} requested changes to this family member profile.`,
    status: 'pending',
    decisionMode: 'manual',
    requestedByUserId: actorUserId,
    requestedByLabel: requesterLabel,
    eligibleApproverIds,
    payload,
    expiresAt: expiry.expiresAt,
    expiresAtMillis: expiry.expiresAtMillis,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return {
    status: 'queued',
    requestId,
    message: 'Family member changes were submitted for approval.',
  };
}

export async function submitDeletePersonApproval(
  actorUserId: string,
  person: PersonRecord,
): Promise<ApprovalSubmissionResult> {
  const tree = await getTreeById(person.treeId);
  const requesterLabel = getRequesterLabel(tree, actorUserId);
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = { deletedPerson: person };
  const { eligibleApproverIds, autoApproveBecauseNoSameSurnameContributor } = await getEligibleApproverIds(tree, actorUserId, payload);

  if (eligibleApproverIds.length === 0 || areApprovalsDisabled(tree) || autoApproveBecauseNoSameSurnameContributor) {
    await applyApprovedDeletePerson(payload);
    const appliedAt = nowIso();
    await createApprovalRequest({
      treeId: tree.id,
      entityType: 'person',
      operation: 'delete-person',
      targetId: person.id,
      title: `Delete ${formatPersonName(person)}`,
      description: `${requesterLabel} deleted this family member and it was applied immediately because ${buildImmediateApprovalReason(autoApproveBecauseNoSameSurnameContributor, eligibleApproverIds)}.`,
      status: 'applied',
      decisionMode: 'immediate',
      requestedByUserId: actorUserId,
      requestedByLabel: requesterLabel,
      eligibleApproverIds: [],
      payload,
      expiresAt: appliedAt,
      expiresAtMillis: Date.now(),
      createdAt: timestamp,
      updatedAt: appliedAt,
      decidedAt: appliedAt,
      decidedByUserId: actorUserId,
      decidedByLabel: requesterLabel,
      appliedAt,
    });

    return { status: 'applied', message: 'The family member was deleted immediately.' };
  }

  const expiry = buildApprovalExpiry(tree);
  const requestId = await createApprovalRequest({
    treeId: tree.id,
    entityType: 'person',
    operation: 'delete-person',
    targetId: person.id,
    title: `Delete ${formatPersonName(person)}`,
    description: `${requesterLabel} requested removal of this family member.`,
    status: 'pending',
    decisionMode: 'manual',
    requestedByUserId: actorUserId,
    requestedByLabel: requesterLabel,
    eligibleApproverIds,
    payload,
    expiresAt: expiry.expiresAt,
    expiresAtMillis: expiry.expiresAtMillis,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { status: 'queued', requestId, message: 'The family member deletion was submitted for approval.' };
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
  const requesterLabel = getRequesterLabel(tree, actorUserId);
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
  const relationshipRef = doc(db, RELATIONSHIPS_COLLECTION, relationshipId);
  const existingRelationship = await getDoc(relationshipRef);
  if (existingRelationship.exists()) {
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
  const { eligibleApproverIds, autoApproveBecauseNoSameSurnameContributor } = await getEligibleApproverIds(tree, actorUserId, payload);

  if (eligibleApproverIds.length === 0 || areApprovalsDisabled(tree) || autoApproveBecauseNoSameSurnameContributor) {
    await applyApprovedCreateRelationship(payload);
    const appliedAt = nowIso();
    await createApprovalRequest({
      treeId: tree.id,
      entityType: 'relationship',
      operation: 'create-relationship',
      targetId: relationship.id,
      title: `Create ${relationLabel}`,
      description: `${requesterLabel} added a ${relationLabel} and it was applied immediately because ${buildImmediateApprovalReason(autoApproveBecauseNoSameSurnameContributor, eligibleApproverIds)}.`,
      status: 'applied',
      decisionMode: 'immediate',
      requestedByUserId: actorUserId,
      requestedByLabel: requesterLabel,
      eligibleApproverIds: [],
      payload,
      expiresAt: appliedAt,
      expiresAtMillis: Date.now(),
      createdAt: timestamp,
      updatedAt: appliedAt,
      decidedAt: appliedAt,
      decidedByUserId: actorUserId,
      decidedByLabel: requesterLabel,
      appliedAt,
    });

    return { status: 'applied', message: 'The relationship was added immediately.' };
  }

  const expiry = buildApprovalExpiry(tree);
  const requestId = await createApprovalRequest({
    treeId: tree.id,
    entityType: 'relationship',
    operation: 'create-relationship',
    targetId: relationship.id,
    title: `Create ${relationLabel}`,
    description: `${requesterLabel} requested a new ${relationLabel}.`,
    status: 'pending',
    decisionMode: 'manual',
    requestedByUserId: actorUserId,
    requestedByLabel: requesterLabel,
    eligibleApproverIds,
    payload,
    expiresAt: expiry.expiresAt,
    expiresAtMillis: expiry.expiresAtMillis,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { status: 'queued', requestId, message: 'The relationship was submitted for approval.' };
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
  const requesterLabel = getRequesterLabel(tree, actorUserId);
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = { relationship: nextRelationship };
  const relationLabel = relationship.type === 'spouse' ? 'spouse relationship' : 'parent-child relationship';
  const { eligibleApproverIds, autoApproveBecauseNoSameSurnameContributor } = await getEligibleApproverIds(tree, actorUserId, payload);

  if (eligibleApproverIds.length === 0 || areApprovalsDisabled(tree) || autoApproveBecauseNoSameSurnameContributor) {
    await applyApprovedUpdateRelationship(payload);
    const appliedAt = nowIso();
    await createApprovalRequest({
      treeId: tree.id,
      entityType: 'relationship',
      operation: 'update-relationship',
      targetId: relationship.id,
      title: `Update ${relationLabel}`,
      description: `${requesterLabel} updated a ${relationLabel} and it was applied immediately because ${buildImmediateApprovalReason(autoApproveBecauseNoSameSurnameContributor, eligibleApproverIds)}.`,
      status: 'applied',
      decisionMode: 'immediate',
      requestedByUserId: actorUserId,
      requestedByLabel: requesterLabel,
      eligibleApproverIds: [],
      payload,
      expiresAt: appliedAt,
      expiresAtMillis: Date.now(),
      createdAt: timestamp,
      updatedAt: appliedAt,
      decidedAt: appliedAt,
      decidedByUserId: actorUserId,
      decidedByLabel: requesterLabel,
      appliedAt,
    });

    return { status: 'applied', message: 'The relationship was updated immediately.' };
  }

  const expiry = buildApprovalExpiry(tree);
  const requestId = await createApprovalRequest({
    treeId: tree.id,
    entityType: 'relationship',
    operation: 'update-relationship',
    targetId: relationship.id,
    title: `Update ${relationLabel}`,
    description: `${requesterLabel} requested updates to a ${relationLabel}.`,
    status: 'pending',
    decisionMode: 'manual',
    requestedByUserId: actorUserId,
    requestedByLabel: requesterLabel,
    eligibleApproverIds,
    payload,
    expiresAt: expiry.expiresAt,
    expiresAtMillis: expiry.expiresAtMillis,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { status: 'queued', requestId, message: 'The relationship update was submitted for approval.' };
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
  const requesterLabel = getRequesterLabel(tree, actorUserId);
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = { relationship };
  const relationLabel = relationship.type === 'spouse' ? 'spouse relationship' : 'parent-child relationship';
  const { eligibleApproverIds, autoApproveBecauseNoSameSurnameContributor } = await getEligibleApproverIds(tree, actorUserId, payload);

  if (eligibleApproverIds.length === 0 || areApprovalsDisabled(tree) || autoApproveBecauseNoSameSurnameContributor) {
    await applyApprovedDeleteRelationship(payload);
    const appliedAt = nowIso();
    await createApprovalRequest({
      treeId: tree.id,
      entityType: 'relationship',
      operation: 'delete-relationship',
      targetId: relationship.id,
      title: `Delete ${relationLabel}`,
      description: `${requesterLabel} removed a ${relationLabel} and it was applied immediately because ${buildImmediateApprovalReason(autoApproveBecauseNoSameSurnameContributor, eligibleApproverIds)}.`,
      status: 'applied',
      decisionMode: 'immediate',
      requestedByUserId: actorUserId,
      requestedByLabel: requesterLabel,
      eligibleApproverIds: [],
      payload,
      expiresAt: appliedAt,
      expiresAtMillis: Date.now(),
      createdAt: timestamp,
      updatedAt: appliedAt,
      decidedAt: appliedAt,
      decidedByUserId: actorUserId,
      decidedByLabel: requesterLabel,
      appliedAt,
    });

    return { status: 'applied', message: 'The relationship was removed immediately.' };
  }

  const expiry = buildApprovalExpiry(tree);
  const requestId = await createApprovalRequest({
    treeId: tree.id,
    entityType: 'relationship',
    operation: 'delete-relationship',
    targetId: relationship.id,
    title: `Delete ${relationLabel}`,
    description: `${requesterLabel} requested removal of a ${relationLabel}.`,
    status: 'pending',
    decisionMode: 'manual',
    requestedByUserId: actorUserId,
    requestedByLabel: requesterLabel,
    eligibleApproverIds,
    payload,
    expiresAt: expiry.expiresAt,
    expiresAtMillis: expiry.expiresAtMillis,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { status: 'queued', requestId, message: 'The relationship removal was submitted for approval.' };
}

export async function decideApprovalRequest(
  actorUserId: string,
  requestId: string,
  decision: 'approve' | 'reject',
  options?: { auto?: boolean },
) {
  const requestRef = doc(db, APPROVAL_REQUESTS_COLLECTION, requestId);
  const requestSnapshot = await getDoc(requestRef);
  if (!requestSnapshot.exists()) {
    throw new Error('That approval request no longer exists.');
  }

  const request = mapApprovalRequestData(requestSnapshot.id, requestSnapshot.data());
  if (request.status !== 'pending') {
    return;
  }

  if (!options?.auto && !request.eligibleApproverIds.includes(actorUserId)) {
    throw new Error('You cannot review this approval request.');
  }

  const decisionTime = nowIso();
  if (decision === 'reject') {
    await handleRejectedRequest(request);
    await updateDoc(requestRef, {
      status: 'rejected',
      decisionMode: options?.auto ? 'auto' : 'manual',
      decidedAt: decisionTime,
      decidedByUserId: options?.auto ? '' : actorUserId,
      decidedByLabel: options?.auto ? 'Automatic approval timer' : getRequesterLabel(await getTreeById(request.treeId), actorUserId),
      updatedAt: decisionTime,
    });
    return;
  }

  await applyApprovedRequest(request);
  const appliedAt = nowIso();
  await updateDoc(requestRef, {
    status: 'applied',
    decisionMode: options?.auto ? 'auto' : 'manual',
    decidedAt: decisionTime,
    decidedByUserId: options?.auto ? '' : actorUserId,
    decidedByLabel: options?.auto ? 'Automatic approval timer' : getRequesterLabel(await getTreeById(request.treeId), actorUserId),
    appliedAt,
    updatedAt: appliedAt,
  });
}

export async function processExpiredApprovalRequests(actorUserId: string, treeId: string) {
  const snapshot = await getDocs(query(
    collection(db, APPROVAL_REQUESTS_COLLECTION),
    where('treeId', '==', treeId),
    where('status', '==', 'pending'),
  ));
  const requests = snapshot.docs.map(mapApprovalRequest);
  const now = Date.now();

  for (const request of requests) {
    if (request.status === 'pending' && request.expiresAtMillis <= now) {
      await decideApprovalRequest(actorUserId, request.id, 'approve', { auto: true });
    }
  }
}

export async function validatePersonCreation(treeId: string, person: {
  firstName: string;
  middleNames?: string;
  lastName: string;
  maidenName?: string;
  birthDate: string;
  deathDate: string;
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
