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
import { db, storage } from '../lib/firebase';
import type { PersonInput, PersonLifeEvent, PersonMutationPayload, PersonPhoto, PersonRecord } from '../types/person';
import type { RelationshipRecord } from '../types/relationship';
import type { CollaboratorRole, FamilyTree, TreeCollaborator, TreeRole } from '../types/tree';
import type { UserProfile } from '../types/user';

const TREES_COLLECTION = 'trees';
const PEOPLE_COLLECTION = 'persons';
const RELATIONSHIPS_COLLECTION = 'relationships';
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

function mapRelationship(snapshot: QueryDocumentSnapshot): RelationshipRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    treeId: data.treeId,
    ownerId: data.ownerId,
    type: data.type,
    fromPersonId: data.fromPersonId,
    toPersonId: data.toPersonId,
    createdAt: data.createdAt ?? nowIso(),
  };
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
      throw new Error('One of the selected people no longer exists.');
    }

    if (snapshot.data().treeId !== treeId) {
      throw new Error('People must belong to the selected tree.');
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
      throw new Error('Only the tree owner can link another collaborator to a person.');
    }

    if (!tree.memberIds.includes(userId)) {
      throw new Error('You are no longer a collaborator on this tree.');
    }

    if (!personSnapshot.exists()) {
      throw new Error('That person no longer exists.');
    }

    if (personSnapshot.data().treeId !== treeId) {
      throw new Error('That person belongs to a different family tree.');
    }

    const currentAssignedPersonId = tree.personAssignments[userId] ?? null;
    if (currentAssignedPersonId === personId) {
      return;
    }

    if (actorUserId === userId && currentAssignedPersonId) {
      throw new Error('Unlink your current claimed profile before claiming another person.');
    }

    const assignedUserId = Object.entries(tree.personAssignments).find(
      ([currentUserId, currentPersonId]) => currentPersonId === personId && currentUserId !== userId,
    )?.[0];
    if (assignedUserId) {
      throw new Error('That person is already linked to another collaborator.');
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
): Promise<void> {
  await deletePhotos(input.removedPhotos);
  const uploadedPhotos = await uploadPersonPhotos(actorUserId, person.treeId, person.id, input.newPhotoUris);
  const nextPhotos = [...input.existingPhotos, ...uploadedPhotos];
  const preferredPhotoId = resolvePreferredPhotoId(
    input.preferredPhotoRef,
    input.existingPhotos,
    input.newPhotoUris,
    uploadedPhotos,
  );

  await updateDoc(doc(db, PEOPLE_COLLECTION, person.id), {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    birthDate: input.birthDate.trim(),
    deathDate: input.deathDate.trim(),
    gender: input.gender,
    notes: input.notes.trim(),
    lifeEvents: normaliseLifeEvents(input.lifeEvents),
    photos: nextPhotos,
    preferredPhotoId: nextPhotos.some((photo) => photo.id === preferredPhotoId) ? preferredPhotoId : '',
    updatedAt: nowIso(),
  });

  const parentIds = await getParentIdsForChild(person.treeId, person.id);
  await updateParentLifeEventsForChild(parentIds, {
    id: person.id,
    treeId: person.treeId,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    birthDate: input.birthDate.trim(),
  });
}

export async function deletePerson(person: PersonRecord) {
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

export async function createParentChildRelationship(
  actorUserId: string,
  treeId: string,
  parentId: string,
  childId: string,
): Promise<RelationshipRecord> {
  if (parentId === childId) {
    throw new Error('A person cannot be their own parent or child.');
  }

  await ensurePeopleBelongToTree(treeId, [parentId, childId]);

  const relationshipId = buildParentChildRelationshipId(parentId, childId);
  const relationshipRef = doc(db, RELATIONSHIPS_COLLECTION, relationshipId);
  const existingRelationship = await getDoc(relationshipRef);

  if (existingRelationship.exists()) {
    throw new Error('That parent-child relationship already exists.');
  }

  const relationship: Omit<RelationshipRecord, 'id'> = {
    treeId,
    ownerId: actorUserId,
    type: 'parent-child',
    fromPersonId: parentId,
    toPersonId: childId,
    createdAt: nowIso(),
  };

  await setDoc(relationshipRef, relationship);

  const childSnapshot = await getDoc(doc(db, PEOPLE_COLLECTION, childId));
  if (childSnapshot.exists()) {
    const childData = childSnapshot.data();
    await updateParentLifeEventsForChild([parentId], {
      id: childSnapshot.id,
      treeId,
      firstName: childData.firstName ?? '',
      lastName: childData.lastName ?? '',
      birthDate: childData.birthDate ?? '',
    });
  }

  return { id: relationshipId, ...relationship };
}

export async function createSpouseRelationship(
  actorUserId: string,
  treeId: string,
  personAId: string,
  personBId: string,
): Promise<RelationshipRecord> {
  if (personAId === personBId) {
    throw new Error('A person cannot be their own spouse.');
  }

  await ensurePeopleBelongToTree(treeId, [personAId, personBId]);

  const [fromPersonId, toPersonId] = [personAId, personBId].sort();
  const relationshipId = buildSpouseRelationshipId(fromPersonId, toPersonId);
  const relationshipRef = doc(db, RELATIONSHIPS_COLLECTION, relationshipId);
  const existingRelationship = await getDoc(relationshipRef);

  if (existingRelationship.exists()) {
    throw new Error('That spouse relationship already exists.');
  }

  const relationship: Omit<RelationshipRecord, 'id'> = {
    treeId,
    ownerId: actorUserId,
    type: 'spouse',
    fromPersonId,
    toPersonId,
    createdAt: nowIso(),
  };

  await setDoc(relationshipRef, relationship);
  return { id: relationshipId, ...relationship };
}

export async function deleteRelationship(relationshipId: string) {
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
