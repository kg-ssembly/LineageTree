import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { db, storage } from './firebase-provider';
import type { ApprovalRequest, ApprovalRequestPayload, ApprovalSubmissionResult } from '../components/dto/approval';
import type { PersonInput, PersonLifeEvent, PersonMutationPayload, PersonPhoto, PersonRecord } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';
import type { CollaboratorRole, FamilyTree, TreeCollaborator, TreeRole } from '../components/dto/tree';
import type { UserProfile } from '../components/dto/user';

const TREES_COLLECTION = 'trees';
const PEOPLE_COLLECTION = 'persons';
const RELATIONSHIPS_COLLECTION = 'relationships';
const APPROVAL_REQUESTS_COLLECTION = 'approvalRequests';
const USERS_COLLECTION = 'users';

function nowIso() {
  return new Date().toISOString();
}

function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

function asSafeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function clampApprovalWindowHours(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 24;
  }

  return Math.max(1, Math.min(168, Math.round(parsed)));
}

function isTreeRole(value: unknown): value is TreeRole {
  return value === 'owner' || value === 'editor' || value === 'viewer';
}

function buildOwnerCollaborator(user: Pick<UserProfile, 'id' | 'email' | 'displayName'>): TreeCollaborator {
  return {
    userId: user.id,
    email: asSafeString(user.email),
    displayName: asSafeString(user.displayName),
    role: 'owner',
  };
}

function sortCollaborators(collaborators: TreeCollaborator[]) {
  return [...collaborators].sort((left, right) => {
    if (left.role === 'owner') {
      return -1;
    }

    if (right.role === 'owner') {
      return 1;
    }

    return `${left.displayName}${left.email}`.localeCompare(`${right.displayName}${right.email}`);
  });
}

function mapCollaborator(rawCollaborator: any): TreeCollaborator | null {
  if (!rawCollaborator?.userId || !rawCollaborator?.email || !isTreeRole(rawCollaborator?.role)) {
    return null;
  }

  return {
    userId: rawCollaborator.userId,
    email: rawCollaborator.email,
    displayName: rawCollaborator.displayName ?? '',
    role: rawCollaborator.role,
  };
}

function mapPersonAssignments(rawAssignments: unknown) {
  if (!rawAssignments || typeof rawAssignments !== 'object') {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(rawAssignments as Record<string, unknown>)
      .flatMap(([userId, personId]) => {
        if (!userId || typeof personId !== 'string' || personId.trim().length === 0) {
          return [];
        }

        return [[userId, personId.trim()] as const];
      }),
  );
}

function mapTreeData(id: string, data: DocumentData): FamilyTree {
  const ownerCollaborator = buildOwnerCollaborator({
    id: data.ownerId,
    email: data.ownerEmail ?? '',
    displayName: data.ownerDisplayName ?? '',
  });
  const collaborators = Array.isArray(data.collaborators)
    ? data.collaborators.map(mapCollaborator).filter(Boolean) as TreeCollaborator[]
    : [ownerCollaborator];
  const hasOwner = collaborators.some((collaborator) => collaborator.userId === data.ownerId);
  const normalizedCollaborators = hasOwner
    ? collaborators
    : [ownerCollaborator, ...collaborators];
  const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [data.ownerId];
  const editorIds = Array.isArray(data.editorIds) ? data.editorIds : [data.ownerId];

  return {
    id,
    ownerId: data.ownerId,
    name: data.name,
    memberIds,
    editorIds,
    collaborators: sortCollaborators(normalizedCollaborators),
    personAssignments: mapPersonAssignments(data.personAssignments),
    approvalWindowHours: clampApprovalWindowHours(data.approvalWindowHours),
    createdAt: data.createdAt ?? nowIso(),
    updatedAt: data.updatedAt ?? data.createdAt ?? nowIso(),
  };
}

function mapTree(snapshot: QueryDocumentSnapshot): FamilyTree {
  return mapTreeData(snapshot.id, snapshot.data());
}

function mapPhoto(photo: any, index: number): PersonPhoto {
  return {
    id: photo?.id ?? `${photo?.path ?? photo?.url ?? 'photo'}-${index}`,
    url: photo?.url ?? '',
    path: photo?.path ?? '',
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

function mapPerson(snapshot: QueryDocumentSnapshot): PersonRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    treeId: data.treeId,
    ownerId: data.ownerId,
    firstName: data.firstName ?? '',
    lastName: data.lastName ?? '',
    birthDate: data.birthDate ?? '',
    deathDate: data.deathDate ?? '',
    gender: data.gender ?? 'unspecified',
    notes: data.notes ?? '',
    lifeEvents: Array.isArray(data.lifeEvents) ? data.lifeEvents.map(mapLifeEvent) : [],
    photos: Array.isArray(data.photos) ? data.photos.map(mapPhoto) : [],
    preferredPhotoId: data.preferredPhotoId ?? '',
    createdAt: data.createdAt ?? nowIso(),
    updatedAt: data.updatedAt ?? data.createdAt ?? nowIso(),
  };
}

function formatPersonName(person: Pick<PersonRecord, 'firstName' | 'lastName'>) {
  return `${person.firstName} ${person.lastName}`.trim() || 'A child';
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

function buildChildBornLifeEvent(child: Pick<PersonRecord, 'id' | 'firstName' | 'lastName' | 'birthDate'>): PersonLifeEvent | null {
  const birthDate = child.birthDate.trim();
  if (!birthDate) {
    return null;
  }

  const childName = formatPersonName(child);
  return {
    id: `child-born-${child.id}`,
    type: 'child-born',
    title: `Welcomed ${childName}`,
    date: birthDate,
    description: `${childName} was born on ${birthDate}.`,
  };
}

async function updateParentLifeEventsForChild(
  parentIds: string[],
  child: Pick<PersonRecord, 'id' | 'treeId' | 'firstName' | 'lastName' | 'birthDate'>,
) {
  const uniqueParentIds = [...new Set(parentIds)];
  if (uniqueParentIds.length === 0) {
    return;
  }

  const childBirthEvent = buildChildBornLifeEvent(child);
  const eventId = `child-born-${child.id}`;
  const parentSnapshots = await Promise.all(uniqueParentIds.map((parentId) => getDoc(doc(db, PEOPLE_COLLECTION, parentId))));

  await Promise.all(parentSnapshots.map(async (parentSnapshot) => {
    if (!parentSnapshot.exists()) {
      return;
    }

    const parentData = parentSnapshot.data();
    if (parentData.treeId !== child.treeId) {
      return;
    }

    const currentLifeEvents = Array.isArray(parentData.lifeEvents) ? parentData.lifeEvents.map(mapLifeEvent) : [];
    const nextLifeEvents = childBirthEvent
      ? [...currentLifeEvents.filter((event) => event.id !== eventId), childBirthEvent]
      : currentLifeEvents.filter((event) => event.id !== eventId);

    await updateDoc(parentSnapshot.ref, {
      lifeEvents: normaliseLifeEvents(nextLifeEvents),
      updatedAt: nowIso(),
    });
  }));
}

async function getParentIdsForChild(treeId: string, childId: string) {
  const relationshipSnapshot = await getDocs(query(collection(db, RELATIONSHIPS_COLLECTION), where('treeId', '==', treeId)));
  return relationshipSnapshot.docs
    .map(mapRelationship)
    .filter((relationship) => relationship.type === 'parent-child' && relationship.toPersonId === childId)
    .map((relationship) => relationship.fromPersonId);
}

function resolvePreferredPhotoId(
  preferredPhotoRef: string | undefined,
  existingPhotos: PersonPhoto[],
  newPhotoUris: string[],
  uploadedPhotos: PersonPhoto[],
) {
  if (!preferredPhotoRef) {
    return '';
  }

  const existingPhoto = existingPhotos.find((photo) => photo.id === preferredPhotoRef);
  if (existingPhoto) {
    return existingPhoto.id;
  }

  const uploadedPhotoIndex = newPhotoUris.findIndex((uri) => uri === preferredPhotoRef);
  if (uploadedPhotoIndex >= 0) {
    return uploadedPhotos[uploadedPhotoIndex]?.id ?? '';
  }

  return '';
}

function mapRelationshipData(id: string, data: DocumentData): RelationshipRecord {
  return {
    id,
    treeId: data.treeId,
    ownerId: data.ownerId,
    type: data.type,
    fromPersonId: data.fromPersonId,
    toPersonId: data.toPersonId,
    createdAt: data.createdAt ?? nowIso(),
  };
}

function mapRelationship(snapshot: QueryDocumentSnapshot): RelationshipRecord {
  return mapRelationshipData(snapshot.id, snapshot.data());
}

function mapApprovalRequestData(id: string, data: DocumentData): ApprovalRequest {
  const payload = (data.payload ?? {}) as ApprovalRequestPayload;

  return {
    id,
    treeId: data.treeId,
    entityType: data.entityType,
    operation: data.operation,
    targetId: data.targetId,
    title: data.title ?? 'Approval request',
    description: data.description ?? '',
    status: data.status ?? 'pending',
    decisionMode: data.decisionMode ?? 'manual',
    requestedByUserId: data.requestedByUserId ?? '',
    requestedByLabel: data.requestedByLabel ?? '',
    eligibleApproverIds: Array.isArray(data.eligibleApproverIds) ? data.eligibleApproverIds.filter((value) => typeof value === 'string') : [],
    payload,
    expiresAt: data.expiresAt ?? nowIso(),
    expiresAtMillis: Number(data.expiresAtMillis ?? 0),
    createdAt: data.createdAt ?? nowIso(),
    updatedAt: data.updatedAt ?? data.createdAt ?? nowIso(),
    decidedAt: data.decidedAt ?? undefined,
    decidedByUserId: data.decidedByUserId ?? undefined,
    decidedByLabel: data.decidedByLabel ?? undefined,
    appliedAt: data.appliedAt ?? undefined,
  };
}

function mapApprovalRequest(snapshot: QueryDocumentSnapshot): ApprovalRequest {
  return mapApprovalRequestData(snapshot.id, snapshot.data());
}

function sortByNewest<T extends { updatedAt?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftValue = left.updatedAt ?? left.createdAt ?? '';
    const rightValue = right.updatedAt ?? right.createdAt ?? '';
    return rightValue.localeCompare(leftValue);
  });
}

function buildSpouseRelationshipId(personAId: string, personBId: string) {
  const [firstId, secondId] = [personAId, personBId].sort();
  return `spouse_${firstId}_${secondId}`;
}

function buildParentChildRelationshipId(parentId: string, childId: string) {
  return `parent_${parentId}_${childId}`;
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

async function uploadPersonPhotos(
  actorUserId: string,
  treeId: string,
  personId: string,
  newPhotoUris: string[],
): Promise<PersonPhoto[]> {
  const uploadedPhotos: PersonPhoto[] = [];

  for (let index = 0; index < newPhotoUris.length; index += 1) {
    const uri = newPhotoUris[index];
    const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
    const safeExtension = extension === 'jpg' ? 'jpeg' : extension;
    const photoId = `${Date.now()}-${index}`;
    const path = `treePhotos/${treeId}/${personId}/${actorUserId}-${photoId}.${extension}`;
    const blob = await uriToBlob(uri);
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: `image/${safeExtension}` });
    const url = await getDownloadURL(storageRef);

    uploadedPhotos.push({
      id: photoId,
      url,
      path,
      createdAt: nowIso(),
    });
  }

  return uploadedPhotos;
}

async function deletePhotos(photos: PersonPhoto[]) {
  await Promise.all(
    photos
      .filter((photo) => photo.path)
      .map(async (photo) => {
        try {
          await deleteObject(ref(storage, photo.path));
        } catch {
          // Ignore missing objects so a partially deleted tree can still be cleaned up.
        }
      }),
  );
}

async function ensurePeopleBelongToTree(treeId: string, personIds: string[]) {
  const uniqueIds = [...new Set(personIds)];
  const snapshots = await Promise.all(uniqueIds.map((personId) => getDoc(doc(db, PEOPLE_COLLECTION, personId))));

  snapshots.forEach((snapshot) => {
    if (!snapshot.exists()) {
      throw new Error('One of the selected family members no longer exists.');
    }

    if (snapshot.data().treeId !== treeId) {
      throw new Error('Family members must belong to the selected tree.');
    }
  });
}

async function deleteDocumentRefs(refs: Array<ReturnType<typeof doc>>) {
  for (let index = 0; index < refs.length; index += 450) {
    const batch = writeBatch(db);
    refs.slice(index, index + 450).forEach((currentRef) => batch.delete(currentRef));
    await batch.commit();
  }
}

async function findUserByEmail(email: string) {
  const trimmedEmail = email.trim();
  const normalizedEmail = normaliseEmail(trimmedEmail);

  let userSnapshot = await getDocs(
    query(collection(db, USERS_COLLECTION), where('normalizedEmail', '==', normalizedEmail), limit(1)),
  );

  if (userSnapshot.empty) {
    userSnapshot = await getDocs(
      query(collection(db, USERS_COLLECTION), where('email', '==', trimmedEmail), limit(1)),
    );
  }

  if (userSnapshot.empty) {
    throw new Error('No account was found with that email address.');
  }

  const userDoc = userSnapshot.docs[0];
  const userData = userDoc.data();

  return {
    id: userDoc.id,
    email: userData.email,
    displayName: userData.displayName ?? '',
  };
}

export function subscribeToTrees(
  userId: string,
  onChange: (trees: FamilyTree[]) => void,
  onError?: (error: Error) => void,
) {
  const treesQuery = query(collection(db, TREES_COLLECTION), where('memberIds', 'array-contains', userId));
  return onSnapshot(
    treesQuery,
    (snapshot) => onChange(sortByNewest(snapshot.docs.map(mapTree))),
    onError,
  );
}

export function subscribeToPeople(
  treeId: string,
  onChange: (people: PersonRecord[]) => void,
  onError?: (error: Error) => void,
) {
  const peopleQuery = query(collection(db, PEOPLE_COLLECTION), where('treeId', '==', treeId));
  return onSnapshot(
    peopleQuery,
    (snapshot) => onChange(sortByNewest(snapshot.docs.map(mapPerson))),
    onError,
  );
}

export function subscribeToRelationships(
  treeId: string,
  onChange: (relationships: RelationshipRecord[]) => void,
  onError?: (error: Error) => void,
) {
  const relationshipsQuery = query(collection(db, RELATIONSHIPS_COLLECTION), where('treeId', '==', treeId));
  return onSnapshot(
    relationshipsQuery,
    (snapshot) => {
      const relationships = snapshot.docs.map(mapRelationship).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      onChange(relationships);
    },
    onError,
  );
}

export function subscribeToApprovalRequests(
  treeId: string,
  onChange: (requests: ApprovalRequest[]) => void,
  onError?: (error: Error) => void,
) {
  const approvalRequestsQuery = query(collection(db, APPROVAL_REQUESTS_COLLECTION), where('treeId', '==', treeId));
  return onSnapshot(
    approvalRequestsQuery,
    (snapshot) => {
      const approvalRequests = snapshot.docs
        .map(mapApprovalRequest)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      onChange(approvalRequests);
    },
    onError,
  );
}

export async function createTree(
  owner: Pick<UserProfile, 'id' | 'email' | 'displayName'>,
  name: string,
): Promise<FamilyTree> {
  const treeRef = doc(collection(db, TREES_COLLECTION));
  const timestamp = nowIso();
  const ownerEmail = asSafeString(owner.email);
  const ownerDisplayName = asSafeString(owner.displayName);
  const ownerCollaborator = buildOwnerCollaborator(owner);
  const tree: Omit<FamilyTree, 'id'> & { ownerEmail: string; ownerDisplayName: string } = {
    ownerId: owner.id,
    ownerEmail,
    ownerDisplayName,
    name: name.trim(),
    memberIds: [owner.id],
    editorIds: [owner.id],
    collaborators: [ownerCollaborator],
    personAssignments: {},
    approvalWindowHours: 24,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await setDoc(treeRef, tree);
  return { id: treeRef.id, ...tree };
}

export async function updateTreeName(treeId: string, name: string) {
  await updateDoc(doc(db, TREES_COLLECTION, treeId), {
    name: name.trim(),
    updatedAt: nowIso(),
  });
}

export async function updateTreeApprovalWindow(treeId: string, approvalWindowHours: number) {
  await updateDoc(doc(db, TREES_COLLECTION, treeId), {
    approvalWindowHours: clampApprovalWindowHours(approvalWindowHours),
    updatedAt: nowIso(),
  });
}

export async function addCollaboratorToTree(treeId: string, email: string, role: CollaboratorRole) {
  const collaboratorUser = await findUserByEmail(email);
  const treeRef = doc(db, TREES_COLLECTION, treeId);

  await runTransaction(db, async (transaction) => {
    const treeSnapshot = await transaction.get(treeRef);
    if (!treeSnapshot.exists()) {
      throw new Error('That family tree no longer exists.');
    }

    const tree = mapTreeData(treeSnapshot.id, treeSnapshot.data());
    if (collaboratorUser.id === tree.ownerId) {
      throw new Error('The owner already has access to this tree.');
    }

    if (tree.memberIds.includes(collaboratorUser.id)) {
      throw new Error('That collaborator already has access to this tree.');
    }

    const collaborators = sortCollaborators([
      ...tree.collaborators,
      {
        userId: collaboratorUser.id,
        email: collaboratorUser.email,
        displayName: collaboratorUser.displayName,
        role,
      },
    ]);

    transaction.update(treeRef, {
      collaborators,
      memberIds: [...tree.memberIds, collaboratorUser.id],
      editorIds: role === 'editor' ? [...tree.editorIds, collaboratorUser.id] : tree.editorIds,
      updatedAt: nowIso(),
    });
  });
}

export async function removeCollaboratorFromTree(treeId: string, collaboratorUserId: string) {
  const treeRef = doc(db, TREES_COLLECTION, treeId);

  await runTransaction(db, async (transaction) => {
    const treeSnapshot = await transaction.get(treeRef);
    if (!treeSnapshot.exists()) {
      throw new Error('That family tree no longer exists.');
    }

    const tree = mapTreeData(treeSnapshot.id, treeSnapshot.data());
    if (collaboratorUserId === tree.ownerId) {
      throw new Error('The owner cannot be removed from the tree.');
    }

    if (!tree.memberIds.includes(collaboratorUserId)) {
      throw new Error('That collaborator is no longer on this tree.');
    }

    const nextPersonAssignments = Object.fromEntries(
      Object.entries(tree.personAssignments).filter(([userId]) => userId !== collaboratorUserId),
    );

    transaction.update(treeRef, {
      collaborators: tree.collaborators.filter((collaborator) => collaborator.userId !== collaboratorUserId),
      memberIds: tree.memberIds.filter((memberId) => memberId !== collaboratorUserId),
      editorIds: tree.editorIds.filter((editorId) => editorId !== collaboratorUserId),
      personAssignments: nextPersonAssignments,
      updatedAt: nowIso(),
    });
  });
}

export async function assignTreePersonToUser(actorUserId: string, treeId: string, userId: string, personId: string) {
  const treeRef = doc(db, TREES_COLLECTION, treeId);
  const personRef = doc(db, PEOPLE_COLLECTION, personId);

  await runTransaction(db, async (transaction) => {
    const [treeSnapshot, personSnapshot] = await Promise.all([
      transaction.get(treeRef),
      transaction.get(personRef),
    ]);

    if (!treeSnapshot.exists()) {
      throw new Error('That family tree no longer exists.');
    }

    const tree = mapTreeData(treeSnapshot.id, treeSnapshot.data());
    if (!tree.memberIds.includes(actorUserId)) {
      throw new Error('You are no longer a collaborator on this tree.');
    }

    if (actorUserId !== userId && tree.ownerId !== actorUserId) {
      throw new Error('Only the tree owner can link another collaborator to a family member.');
    }

    if (!tree.memberIds.includes(userId)) {
      throw new Error('You are no longer a collaborator on this tree.');
    }

    if (!personSnapshot.exists()) {
      throw new Error('That family member no longer exists.');
    }

    if (personSnapshot.data().treeId !== treeId) {
      throw new Error('That family member belongs to a different family tree.');
    }

    const currentAssignedPersonId = tree.personAssignments[userId] ?? null;
    if (currentAssignedPersonId === personId) {
      return;
    }

    if (actorUserId === userId && currentAssignedPersonId) {
      throw new Error('Unlink your current claimed profile before claiming another family member.');
    }

    const assignedUserId = Object.entries(tree.personAssignments).find(
      ([currentUserId, currentPersonId]) => currentPersonId === personId && currentUserId !== userId,
    )?.[0];
    if (assignedUserId) {
      throw new Error('That family member is already linked to another collaborator.');
    }


    transaction.update(treeRef, {
      personAssignments: {
        ...tree.personAssignments,
        [userId]: personId,
      },
      updatedAt: nowIso(),
    });
  });
}

export async function clearTreePersonAssignment(treeId: string, userId: string) {
  const treeRef = doc(db, TREES_COLLECTION, treeId);

  await runTransaction(db, async (transaction) => {
    const treeSnapshot = await transaction.get(treeRef);
    if (!treeSnapshot.exists()) {
      throw new Error('That family tree no longer exists.');
    }

    const tree = mapTreeData(treeSnapshot.id, treeSnapshot.data());
    if (!tree.memberIds.includes(userId)) {
      throw new Error('You are no longer a collaborator on this tree.');
    }

    if (!tree.personAssignments[userId]) {
      return;
    }

    const nextAssignments = { ...tree.personAssignments };
    delete nextAssignments[userId];

    transaction.update(treeRef, {
      personAssignments: nextAssignments,
      updatedAt: nowIso(),
    });
  });
}

async function getTreeById(treeId: string) {
  const treeSnapshot = await getDoc(doc(db, TREES_COLLECTION, treeId));
  if (!treeSnapshot.exists()) {
    throw new Error('That family tree no longer exists.');
  }

  return mapTreeData(treeSnapshot.id, treeSnapshot.data());
}

function getRequesterLabel(tree: FamilyTree, userId: string) {
  const collaborator = tree.collaborators.find((entry) => entry.userId === userId);
  return collaborator?.displayName || collaborator?.email || 'A collaborator';
}

function getEligibleApproverIds(tree: FamilyTree, requesterUserId: string) {
  return tree.memberIds.filter((memberId) => memberId !== requesterUserId);
}

function buildApprovalExpiry(tree: FamilyTree) {
  const approvalWindowHours = clampApprovalWindowHours(tree.approvalWindowHours);
  const expiresAtMillis = Date.now() + approvalWindowHours * 60 * 60 * 1000;
  return {
    expiresAtMillis,
    expiresAt: new Date(expiresAtMillis).toISOString(),
  };
}

async function preparePersonUpdatePreview(
  actorUserId: string,
  person: PersonRecord,
  input: PersonMutationPayload,
) {
  const uploadedPhotos = await uploadPersonPhotos(actorUserId, person.treeId, person.id, input.newPhotoUris);
  const nextPhotos = [...input.existingPhotos, ...uploadedPhotos];
  const preferredPhotoId = resolvePreferredPhotoId(
    input.preferredPhotoRef,
    input.existingPhotos,
    input.newPhotoUris,
    uploadedPhotos,
  );
  const timestamp = nowIso();

  const nextPerson: PersonRecord = {
    ...person,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
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
  };
}

async function applyApprovedPersonUpdate(payload: ApprovalRequestPayload) {
  const nextPerson = payload.afterPerson;
  if (!nextPerson) {
    throw new Error('The approved family member update is missing its target data.');
  }

  await updateDoc(doc(db, PEOPLE_COLLECTION, nextPerson.id), {
    firstName: nextPerson.firstName,
    lastName: nextPerson.lastName,
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
}

async function applyApprovedDeletePerson(payload: ApprovalRequestPayload) {
  const person = payload.deletedPerson;
  if (!person) {
    throw new Error('The approved family member deletion is missing its target data.');
  }

  await deletePersonDirect(person);
}

async function applyApprovedCreateRelationship(payload: ApprovalRequestPayload) {
  const relationship = payload.relationship;
  if (!relationship) {
    throw new Error('The approved relationship is missing its target data.');
  }

  await createRelationshipDirect(relationship);
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

async function createApprovalRequest(
  request: Omit<ApprovalRequest, 'id'>,
) {
  const requestRef = doc(collection(db, APPROVAL_REQUESTS_COLLECTION));
  await setDoc(requestRef, request);
  return requestRef.id;
}

export async function submitPersonUpdateApproval(
  actorUserId: string,
  person: PersonRecord,
  input: PersonMutationPayload,
): Promise<ApprovalSubmissionResult> {
  const tree = await getTreeById(person.treeId);
  const requesterLabel = getRequesterLabel(tree, actorUserId);
  const eligibleApproverIds = getEligibleApproverIds(tree, actorUserId);
  const { nextPerson, uploadedPhotos, removedPhotos } = await preparePersonUpdatePreview(actorUserId, person, input);
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = {
    beforePerson: person,
    afterPerson: nextPerson,
    removedPhotos,
    uploadedPhotos,
  };

  if (eligibleApproverIds.length === 0) {
    await applyApprovedPersonUpdate(payload);
    const appliedAt = nowIso();
    await createApprovalRequest({
      treeId: tree.id,
      entityType: 'person',
      operation: 'update-person',
      targetId: person.id,
      title: `Updated ${formatPersonName(person)}`,
      description: `${requesterLabel} updated this family member profile and it was applied immediately because no other collaborator could review it.`,
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
  const eligibleApproverIds = getEligibleApproverIds(tree, actorUserId);
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = { deletedPerson: person };

  if (eligibleApproverIds.length === 0) {
    await applyApprovedDeletePerson(payload);
    const appliedAt = nowIso();
    await createApprovalRequest({
      treeId: tree.id,
      entityType: 'person',
      operation: 'delete-person',
      targetId: person.id,
      title: `Delete ${formatPersonName(person)}`,
      description: `${requesterLabel} deleted this family member and it was applied immediately because no other collaborator could review it.`,
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
): Promise<ApprovalSubmissionResult> {
  if (type === 'parent-child' && fromPersonId === toPersonId) {
    throw new Error('A family member cannot be their own parent or child.');
  }

  if (type === 'spouse' && fromPersonId === toPersonId) {
    throw new Error('A family member cannot be their own spouse.');
  }

  const tree = await getTreeById(treeId);
  const requesterLabel = getRequesterLabel(tree, actorUserId);
  const eligibleApproverIds = getEligibleApproverIds(tree, actorUserId);
  await ensurePeopleBelongToTree(treeId, [fromPersonId, toPersonId]);

  const relationshipId = type === 'spouse'
    ? buildSpouseRelationshipId(fromPersonId, toPersonId)
    : buildParentChildRelationshipId(fromPersonId, toPersonId);
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
    fromPersonId: type === 'spouse' ? [fromPersonId, toPersonId].sort()[0] : fromPersonId,
    toPersonId: type === 'spouse' ? [fromPersonId, toPersonId].sort()[1] : toPersonId,
    createdAt: nowIso(),
  };
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = { relationship };
  const relationLabel = type === 'spouse' ? 'spouse relationship' : 'parent-child relationship';

  if (eligibleApproverIds.length === 0) {
    await applyApprovedCreateRelationship(payload);
    const appliedAt = nowIso();
    await createApprovalRequest({
      treeId: tree.id,
      entityType: 'relationship',
      operation: 'create-relationship',
      targetId: relationship.id,
      title: `Create ${relationLabel}`,
      description: `${requesterLabel} added a ${relationLabel} and it was applied immediately because no other collaborator could review it.`,
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
  const eligibleApproverIds = getEligibleApproverIds(tree, actorUserId);
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = { relationship };
  const relationLabel = relationship.type === 'spouse' ? 'spouse relationship' : 'parent-child relationship';

  if (eligibleApproverIds.length === 0) {
    await applyApprovedDeleteRelationship(payload);
    const appliedAt = nowIso();
    await createApprovalRequest({
      treeId: tree.id,
      entityType: 'relationship',
      operation: 'delete-relationship',
      targetId: relationship.id,
      title: `Delete ${relationLabel}`,
      description: `${requesterLabel} removed a ${relationLabel} and it was applied immediately because no other collaborator could review it.`,
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
  const snapshot = await getDocs(query(collection(db, APPROVAL_REQUESTS_COLLECTION), where('treeId', '==', treeId)));
  const requests = snapshot.docs.map(mapApprovalRequest);
  const now = Date.now();

  for (const request of requests) {
    if (request.status === 'pending' && request.expiresAtMillis <= now) {
      await decideApprovalRequest(actorUserId, request.id, 'approve', { auto: true });
    }
  }
}

export async function deleteTree(tree: FamilyTree) {
  const peopleSnapshot = await getDocs(query(collection(db, PEOPLE_COLLECTION), where('treeId', '==', tree.id)));
  const relationshipSnapshot = await getDocs(query(collection(db, RELATIONSHIPS_COLLECTION), where('treeId', '==', tree.id)));

  const people = peopleSnapshot.docs.map(mapPerson);
  await deletePhotos(people.flatMap((person) => person.photos));

  const refsToDelete = [
    ...peopleSnapshot.docs.map((snapshot) => snapshot.ref),
    ...relationshipSnapshot.docs.map((snapshot) => snapshot.ref),
    doc(db, TREES_COLLECTION, tree.id),
  ];

  await deleteDocumentRefs(refsToDelete);
}

export async function createPerson(
  actorUserId: string,
  treeId: string,
  input: PersonInput,
  newPhotoUris: string[],
): Promise<PersonRecord> {
  const personRef = doc(collection(db, PEOPLE_COLLECTION));
  const timestamp = nowIso();
  const uploadedPhotos = await uploadPersonPhotos(actorUserId, treeId, personRef.id, newPhotoUris);

  const person: Omit<PersonRecord, 'id'> = {
    treeId,
    ownerId: actorUserId,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    birthDate: input.birthDate.trim(),
    deathDate: input.deathDate.trim(),
    gender: input.gender,
    notes: input.notes.trim(),
    lifeEvents: normaliseLifeEvents(input.lifeEvents),
    photos: uploadedPhotos,
    preferredPhotoId: resolvePreferredPhotoId(input.preferredPhotoRef, [], newPhotoUris, uploadedPhotos),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await setDoc(personRef, person);
  return { id: personRef.id, ...person };
}

export async function updatePerson(
  actorUserId: string,
  person: PersonRecord,
  input: PersonMutationPayload,
): Promise<ApprovalSubmissionResult> {
  return submitPersonUpdateApproval(actorUserId, person, input);
}

async function deletePersonDirect(person: PersonRecord) {
  await deletePhotos(person.photos);

  const relationshipSnapshot = await getDocs(query(collection(db, RELATIONSHIPS_COLLECTION), where('treeId', '==', person.treeId)));
  const parentIds = relationshipSnapshot.docs
    .map(mapRelationship)
    .filter((relationship) => relationship.type === 'parent-child' && relationship.toPersonId === person.id)
    .map((relationship) => relationship.fromPersonId);

  await updateParentLifeEventsForChild(parentIds, {
    id: person.id,
    treeId: person.treeId,
    firstName: person.firstName,
    lastName: person.lastName,
    birthDate: '',
  });

  const refsToDelete = relationshipSnapshot.docs
    .filter((snapshot) => {
      const data = snapshot.data();
      return data.fromPersonId === person.id || data.toPersonId === person.id;
    })
    .map((snapshot) => snapshot.ref);

  refsToDelete.push(doc(db, PEOPLE_COLLECTION, person.id));
  await deleteDocumentRefs(refsToDelete);
}

export async function deletePerson(actorUserId: string, person: PersonRecord): Promise<ApprovalSubmissionResult> {
  return submitDeletePersonApproval(actorUserId, person);
}

async function createRelationshipDirect(relationship: RelationshipRecord): Promise<RelationshipRecord> {
  const relationshipRef = doc(db, RELATIONSHIPS_COLLECTION, relationship.id);
  await setDoc(relationshipRef, {
    treeId: relationship.treeId,
    ownerId: relationship.ownerId,
    type: relationship.type,
    fromPersonId: relationship.fromPersonId,
    toPersonId: relationship.toPersonId,
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

export async function createParentChildRelationship(
  actorUserId: string,
  treeId: string,
  parentId: string,
  childId: string,
): Promise<ApprovalSubmissionResult> {
  return submitCreateRelationshipApproval(actorUserId, treeId, 'parent-child', parentId, childId);
}

export async function createSpouseRelationship(
  actorUserId: string,
  treeId: string,
  personAId: string,
  personBId: string,
): Promise<ApprovalSubmissionResult> {
  return submitCreateRelationshipApproval(actorUserId, treeId, 'spouse', personAId, personBId);
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

export async function deleteRelationship(actorUserId: string, relationshipId: string): Promise<ApprovalSubmissionResult> {
  return submitDeleteRelationshipApproval(actorUserId, relationshipId);
}

