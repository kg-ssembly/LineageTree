import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { PersonLifeEvent, PersonRecord } from '../components/dto/person';
import type { UserProfile } from '../components/dto/user';
import { formatPersonName, mapLifeEvent, mapPerson, mapRelationship, mapTreeData, mergeUniqueById, normaliseLifeEvents } from './family-tree-mappers';
import { db } from './firebase-provider';
import { nowIso } from './family-tree-shared';

export const TREES_COLLECTION = 'trees';
export const PEOPLE_COLLECTION = 'persons';
export const RELATIONSHIPS_COLLECTION = 'relationships';
export const APPROVAL_REQUESTS_COLLECTION = 'approvalRequests';
export const MERGE_REQUESTS_COLLECTION = 'mergeRequests';
export const MERGE_HISTORY_COLLECTION = 'mergeHistory';
export const NOTIFICATIONS_COLLECTION = 'notifications';
export const NOTIFICATION_ACTIVITY_COLLECTION = 'notificationActivity';
export const USERS_COLLECTION = 'users';

export type ResolvedUserAccount = {
  id: string;
  email: string;
  displayName: string;
  username: string;
  defaultTreeId?: string;
};

function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

function normaliseDisplayName(displayName: string) {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function needsTreeMembershipBackfill(data: DocumentData, treeId: string) {
  return !(Array.isArray(data.treeMembershipIds) && data.treeMembershipIds.includes(treeId));
}

export async function getLegacyPeopleNeedingBackfill(treeId: string) {
  const snapshot = await getDocs(query(collection(db, PEOPLE_COLLECTION), where('treeId', '==', treeId)));
  return snapshot.docs
    .filter((docSnapshot) => needsTreeMembershipBackfill(docSnapshot.data(), treeId))
    .map(mapPerson);
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

export async function updateParentLifeEventsForChild(
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

export async function getParentIdsForChild(treeId: string, childId: string) {
  const relationshipSnapshot = await getDocs(query(
    collection(db, RELATIONSHIPS_COLLECTION),
    where('treeId', '==', treeId),
    where('type', '==', 'parent-child'),
    where('toPersonId', '==', childId),
  ));
  return relationshipSnapshot.docs
    .map(mapRelationship)
    .map((relationship) => relationship.fromPersonId);
}

export async function getRelationshipsTouchingPerson(treeId: string, personId: string) {
  const [outgoingSnapshot, incomingSnapshot] = await Promise.all([
    getDocs(query(
      collection(db, RELATIONSHIPS_COLLECTION),
      where('treeId', '==', treeId),
      where('fromPersonId', '==', personId),
    )),
    getDocs(query(
      collection(db, RELATIONSHIPS_COLLECTION),
      where('treeId', '==', treeId),
      where('toPersonId', '==', personId),
    )),
  ]);

  return mergeUniqueById([
    ...outgoingSnapshot.docs.map(mapRelationship),
    ...incomingSnapshot.docs.map(mapRelationship),
  ]);
}

export function buildSpouseRelationshipId(personAId: string, personBId: string) {
  const [firstId, secondId] = [personAId, personBId].sort();
  return `spouse_${firstId}_${secondId}`;
}

export function buildParentChildRelationshipId(parentId: string, childId: string) {
  return `parent_${parentId}_${childId}`;
}

export async function getRelationshipsForTree(treeId: string) {
  const relationshipSnapshot = await getDocs(
    query(collection(db, RELATIONSHIPS_COLLECTION), where('treeId', '==', treeId)),
  );
  return relationshipSnapshot.docs.map(mapRelationship);
}

export async function ensurePeopleBelongToTree(treeId: string, personIds: string[]) {
  const uniqueIds = [...new Set(personIds)];
  const snapshots = await Promise.all(uniqueIds.map((personId) => getDoc(doc(db, PEOPLE_COLLECTION, personId))));

  snapshots.forEach((snapshot) => {
    if (!snapshot.exists()) {
      throw new Error('One of the selected family members no longer exists.');
    }

    const membershipIds = Array.isArray(snapshot.data().treeMembershipIds)
      ? snapshot.data().treeMembershipIds
      : [snapshot.data().treeId].filter(Boolean);
    if (!membershipIds.includes(treeId)) {
      throw new Error('Family members must belong to the selected tree.');
    }
  });
}

export async function getPeopleForValidation(treeId: string) {
  const membershipSnapshot = await getDocs(
    query(collection(db, PEOPLE_COLLECTION), where('treeMembershipIds', 'array-contains', treeId)),
  );
  const legacyPeople = await getLegacyPeopleNeedingBackfill(treeId);

  return mergeUniqueById([
    ...membershipSnapshot.docs.map(mapPerson),
    ...legacyPeople,
  ]);
}

export async function deleteDocumentRefs(refs: Array<ReturnType<typeof doc>>) {
  for (let index = 0; index < refs.length; index += 450) {
    const batch = writeBatch(db);
    refs.slice(index, index + 450).forEach((currentRef) => batch.delete(currentRef));
    await batch.commit();
  }
}

export async function findUserByEmail(email: string) {
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

export async function findUserByIdentifier(identifier: string) {
  const trimmedIdentifier = identifier.trim();
  const normalizedEmail = normaliseEmail(trimmedIdentifier);
  const normalizedDisplayName = normaliseDisplayName(trimmedIdentifier);
  const normalizedUsername = trimmedIdentifier.trim().toLowerCase().replace(/\s+/g, '');

  let userSnapshot = await getDocs(
    query(collection(db, USERS_COLLECTION), where('normalizedEmail', '==', normalizedEmail), limit(1)),
  );

  if (!userSnapshot.empty) {
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    return {
      id: userDoc.id,
      email: userData.email,
      displayName: userData.displayName ?? '',
      username: userData.username ?? '',
      defaultTreeId: userData.defaultTreeId ?? '',
    };
  }

  userSnapshot = await getDocs(
    query(collection(db, USERS_COLLECTION), where('username', '==', normalizedUsername), limit(2)),
  );

  if (userSnapshot.empty) {
    userSnapshot = await getDocs(
      query(collection(db, USERS_COLLECTION), where('normalizedDisplayName', '==', normalizedDisplayName), limit(2)),
    );
  }

  if (userSnapshot.empty) {
    throw new Error('No registered account was found with that email address or username.');
  }

  if (userSnapshot.docs.length > 1) {
    throw new Error('More than one user matches that username. Ask them for their tree ID or email address instead.');
  }

  const userDoc = userSnapshot.docs[0];
  const userData = userDoc.data();
  return {
    id: userDoc.id,
    email: userData.email,
    displayName: userData.displayName ?? '',
    username: userData.username ?? '',
    defaultTreeId: userData.defaultTreeId ?? '',
  };
}

export async function findUserByUsernameExact(username: string) {
  const normalizedUsername = username.trim().toLowerCase().replace(/\s+/g, '');
  if (!normalizedUsername) {
    throw new Error('Username is required.');
  }

  const userSnapshot = await getDocs(
    query(collection(db, USERS_COLLECTION), where('username', '==', normalizedUsername), limit(2)),
  );

  if (userSnapshot.empty) {
    throw new Error('No registered account was found with that username.');
  }

  if (userSnapshot.docs.length > 1) {
    throw new Error('More than one user matches that username. Ask them for their tree ID or email address instead.');
  }

  const userDoc = userSnapshot.docs[0];
  const userData = userDoc.data();
  return {
    id: userDoc.id,
    email: userData.email,
    displayName: userData.displayName ?? '',
    username: userData.username ?? '',
    defaultTreeId: userData.defaultTreeId ?? '',
  };
}

export async function getTreeById(treeId: string) {
  const treeSnapshot = await getDoc(doc(db, TREES_COLLECTION, treeId));
  if (!treeSnapshot.exists()) {
    throw new Error('That family tree no longer exists.');
  }

  return mapTreeData(treeSnapshot.id, treeSnapshot.data());
}

export async function getPeopleByTreeId(treeId: string) {
  const [membershipSnapshot, legacyPeople] = await Promise.all([
    getDocs(query(collection(db, PEOPLE_COLLECTION), where('treeMembershipIds', 'array-contains', treeId))),
    getLegacyPeopleNeedingBackfill(treeId),
  ]);

  return mergeUniqueById([
    ...membershipSnapshot.docs.map(mapPerson),
    ...legacyPeople,
  ]);
}

export async function getRelationshipsByTreeId(treeId: string) {
  return getRelationshipsForTree(treeId);
}

export async function getTreeBundle(treeId: string) {
  const [tree, people, relationships] = await Promise.all([
    getTreeById(treeId),
    getPeopleByTreeId(treeId),
    getRelationshipsByTreeId(treeId),
  ]);

  return { tree, people, relationships };
}

export async function getUserProfileById(userId: string): Promise<Pick<UserProfile, 'id' | 'email' | 'displayName' | 'username' | 'defaultTreeId'>> {
  const userSnapshot = await getDoc(doc(db, USERS_COLLECTION, userId));
  if (!userSnapshot.exists()) {
    throw new Error('That user account no longer exists.');
  }

  const userData = userSnapshot.data();
  return {
    id: userSnapshot.id,
    email: userData.email ?? '',
    displayName: userData.displayName ?? '',
    username: userData.username ?? '',
    defaultTreeId: userData.defaultTreeId ?? '',
  };
}

export async function getUserProfileByIdOptional(userId: string) {
  try {
    return await getUserProfileById(userId);
  } catch {
    return null;
  }
}
