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
import type { MergeApproval, MergeConflictChoice, MergeHistoryRecord, MergePreview, MergeRequestRecord, MergeRequestSnapshot, MergeReviewDecision } from '../components/dto/merge';
import type { AppNotification, NotificationActivityState } from '../components/dto/notification';
import type { PersonInput, PersonLifeEvent, PersonMutationPayload, PersonPhoto, PersonRecord } from '../components/dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from '../components/dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from '../components/dto/relationship';
import type { CollaboratorRole, FamilyTree, SurnameVariantGroup, TreeCollaborator, TreeMembershipHistoryEntry, TreeRole } from '../components/dto/tree';
import type { UserProfile } from '../components/dto/user';
import { normalizeRelationshipEndpoints, validateProposedRelationship } from '../components/family-tree-validation';
import { buildMergePreview } from './merge-intelligence';

const TREES_COLLECTION = 'trees';
const PEOPLE_COLLECTION = 'persons';
const RELATIONSHIPS_COLLECTION = 'relationships';
const APPROVAL_REQUESTS_COLLECTION = 'approvalRequests';
const MERGE_REQUESTS_COLLECTION = 'mergeRequests';
const MERGE_HISTORY_COLLECTION = 'mergeHistory';
const NOTIFICATIONS_COLLECTION = 'notifications';
const NOTIFICATION_ACTIVITY_COLLECTION = 'notificationActivity';
const USERS_COLLECTION = 'users';

function nowIso() {
  return new Date().toISOString();
}

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

function asSafeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function clampApprovalWindowHours(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 24;
  }

  return Math.max(0, Math.min(168, Math.round(parsed)));
}

function isTreeRole(value: unknown): value is TreeRole {
  return value === 'owner' || value === 'editor' || value === 'contributor' || value === 'viewer';
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
  const membershipHistory = Array.isArray(data.membershipHistory)
    ? data.membershipHistory
      .filter((entry) => entry?.id && entry?.userId && entry?.role && entry?.action && entry?.createdAt)
      .map((entry) => entry as TreeMembershipHistoryEntry)
    : [];
  const surnameVariantGroups = Array.isArray(data.surnameVariantGroups)
    ? data.surnameVariantGroups
      .filter((entry) => entry?.id && entry?.primarySurname)
      .map((entry) => ({
        id: entry.id,
        primarySurname: entry.primarySurname,
        variants: Array.isArray(entry.variants) ? entry.variants.filter((value: unknown): value is string => typeof value === 'string') : [],
        notes: entry.notes ?? '',
        createdAt: entry.createdAt ?? nowIso(),
        updatedAt: entry.updatedAt ?? entry.createdAt ?? nowIso(),
      } satisfies SurnameVariantGroup))
    : [];

  return {
    id,
    ownerId: data.ownerId,
    name: data.name,
    memberIds,
    editorIds,
    collaborators: sortCollaborators(normalizedCollaborators),
    personAssignments: mapPersonAssignments(data.personAssignments),
    approvalWindowHours: clampApprovalWindowHours(data.approvalWindowHours),
    surnameVariantGroups,
    connectedTreeIds: Array.isArray(data.connectedTreeIds) ? data.connectedTreeIds.filter((value) => typeof value === 'string') : [],
    membershipHistory,
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
    treeMembershipIds: Array.isArray(data.treeMembershipIds) ? data.treeMembershipIds.filter((value) => typeof value === 'string') : [data.treeId].filter(Boolean),
    treeMemberships: Array.isArray(data.treeMemberships) ? data.treeMemberships : [],
    ownerId: data.ownerId,
    firstName: data.firstName ?? '',
    middleNames: data.middleNames ?? '',
    lastName: data.lastName ?? '',
    maidenName: data.maidenName ?? '',
    nicknames: Array.isArray(data.nicknames) ? data.nicknames.filter((value) => typeof value === 'string') : [],
    clanName: data.clanName ?? '',
    familyBranch: data.familyBranch ?? '',
    hometown: data.hometown ?? '',
    birthPlace: data.birthPlace ?? '',
    surnameVariantHints: Array.isArray(data.surnameVariantHints) ? data.surnameVariantHints.filter((value) => typeof value === 'string') : [],
    canonicalPersonId: data.canonicalPersonId ?? '',
    duplicatePersonIds: Array.isArray(data.duplicatePersonIds) ? data.duplicatePersonIds.filter((value) => typeof value === 'string') : [],
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

function formatPersonName(person: Pick<PersonRecord, 'firstName' | 'middleNames' | 'lastName'>) {
  return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim() || 'A child';
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
    relationshipStatus: data.type === 'spouse'
      ? data.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS
      : undefined,
    parentChildKind: data.type === 'parent-child'
      ? data.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND
      : undefined,
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

function mapMergePreview(data: any): MergePreview {
  return {
    sourceTree: data?.sourceTree,
    targetTree: data?.targetTree,
    matches: Array.isArray(data?.matches) ? data.matches : [],
    duplicateCount: Number(data?.duplicateCount ?? 0),
    connectedRelationshipCount: Number(data?.connectedRelationshipCount ?? 0),
    newBranchCount: Number(data?.newBranchCount ?? 0),
    conflicts: Array.isArray(data?.conflicts) ? data.conflicts : [],
    combinedAssetCount: Number(data?.combinedAssetCount ?? 0),
  };
}

function mapMergeApproval(rawApproval: any): MergeApproval | null {
  if (!rawApproval?.treeId || !rawApproval?.editorUserId || !rawApproval?.editorLabel || !rawApproval?.decision || !rawApproval?.decidedAt) {
    return null;
  }

  return {
    treeId: rawApproval.treeId,
    editorUserId: rawApproval.editorUserId,
    editorLabel: rawApproval.editorLabel,
    decision: rawApproval.decision,
    comment: rawApproval.comment ?? '',
    decidedAt: rawApproval.decidedAt,
  };
}

function mapMergeSnapshot(rawSnapshot: any): MergeRequestSnapshot | undefined {
  if (!rawSnapshot?.trees || !rawSnapshot?.people || !rawSnapshot?.relationships) {
    return undefined;
  }

  return {
    trees: Array.isArray(rawSnapshot.trees) ? rawSnapshot.trees : [],
    people: Array.isArray(rawSnapshot.people) ? rawSnapshot.people : [],
    relationships: Array.isArray(rawSnapshot.relationships) ? rawSnapshot.relationships : [],
  };
}

function mapMergeRequest(snapshot: QueryDocumentSnapshot): MergeRequestRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    sourceTreeId: data.sourceTreeId ?? '',
    targetTreeId: data.targetTreeId ?? '',
    involvedTreeIds: Array.isArray(data.involvedTreeIds) ? data.involvedTreeIds.filter((value) => typeof value === 'string') : [],
    suggestedByUserId: data.suggestedByUserId ?? '',
    suggestedByLabel: data.suggestedByLabel ?? '',
    status: data.status ?? 'pending',
    preview: mapMergePreview(data.preview ?? {}),
    selectedMatchIds: Array.isArray(data.selectedMatchIds) ? data.selectedMatchIds.filter((value) => typeof value === 'string') : [],
    approvals: Array.isArray(data.approvals) ? data.approvals.map(mapMergeApproval).filter(Boolean) as MergeApproval[] : [],
    reviewerComments: Array.isArray(data.reviewerComments) ? data.reviewerComments.filter((value) => typeof value === 'string') : [],
    conflictChoices: Array.isArray(data.conflictChoices) ? data.conflictChoices as MergeConflictChoice[] : [],
    snapshotBeforeMerge: mapMergeSnapshot(data.snapshotBeforeMerge),
    appliedAt: data.appliedAt ?? undefined,
    undoneAt: data.undoneAt ?? undefined,
    createdAt: data.createdAt ?? nowIso(),
    updatedAt: data.updatedAt ?? data.createdAt ?? nowIso(),
  };
}

function mapMergeHistory(snapshot: QueryDocumentSnapshot): MergeHistoryRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    mergeRequestId: data.mergeRequestId ?? '',
    involvedTreeIds: Array.isArray(data.involvedTreeIds) ? data.involvedTreeIds.filter((value) => typeof value === 'string') : [],
    summary: data.summary ?? '',
    status: data.status ?? 'pending',
    preview: mapMergePreview(data.preview ?? {}),
    changedPersonIds: Array.isArray(data.changedPersonIds) ? data.changedPersonIds.filter((value) => typeof value === 'string') : [],
    approvals: Array.isArray(data.approvals) ? data.approvals.map(mapMergeApproval).filter(Boolean) as MergeApproval[] : [],
    createdAt: data.createdAt ?? nowIso(),
    updatedAt: data.updatedAt ?? data.createdAt ?? nowIso(),
  };
}

function mapNotification(snapshot: QueryDocumentSnapshot): AppNotification {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    userId: data.userId ?? '',
    type: data.type ?? 'merge-invite',
    status: data.status ?? 'pending',
    requestedByUserId: data.requestedByUserId ?? '',
    requestedByLabel: data.requestedByLabel ?? '',
    sourceTreeId: data.sourceTreeId ?? '',
    sourceTreeName: data.sourceTreeName ?? '',
    targetIdentifier: data.targetIdentifier ?? '',
    message: data.message ?? '',
    createdAt: data.createdAt ?? nowIso(),
    updatedAt: data.updatedAt ?? data.createdAt ?? nowIso(),
    respondedAt: data.respondedAt ?? undefined,
    seenAt: data.seenAt ?? undefined,
    openedAt: data.openedAt ?? undefined,
  };
}

function mapNotificationActivityState(snapshot: QueryDocumentSnapshot): NotificationActivityState {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    userId: data.userId ?? '',
    sourceKind: data.sourceKind ?? 'approval',
    sourceId: data.sourceId ?? '',
    actionedAt: data.actionedAt ?? undefined,
    createdAt: data.createdAt ?? nowIso(),
    updatedAt: data.updatedAt ?? data.createdAt ?? nowIso(),
  };
}

function sortByNewest<T extends { updatedAt?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftValue = left.updatedAt ?? left.createdAt ?? '';
    const rightValue = right.updatedAt ?? right.createdAt ?? '';
    return rightValue.localeCompare(leftValue);
  });
}

function mergeUniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function buildSpouseRelationshipId(personAId: string, personBId: string) {
  const [firstId, secondId] = [personAId, personBId].sort();
  return `spouse_${firstId}_${secondId}`;
}

function buildParentChildRelationshipId(parentId: string, childId: string) {
  return `parent_${parentId}_${childId}`;
}

async function getRelationshipsForTree(treeId: string) {
  const relationshipSnapshot = await getDocs(
    query(collection(db, RELATIONSHIPS_COLLECTION), where('treeId', '==', treeId)),
  );
  return relationshipSnapshot.docs.map(mapRelationship);
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

    const membershipIds = Array.isArray(snapshot.data().treeMembershipIds)
      ? snapshot.data().treeMembershipIds
      : [snapshot.data().treeId].filter(Boolean);
    if (!membershipIds.includes(treeId)) {
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

async function findUserByIdentifier(identifier: string) {
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
  let membershipPeople: PersonRecord[] = [];
  let legacyPeople: PersonRecord[] = [];

  const emit = () => {
    onChange(sortByNewest(mergeUniqueById([...membershipPeople, ...legacyPeople])));
  };

  const unsubscribeMembership = onSnapshot(
    query(collection(db, PEOPLE_COLLECTION), where('treeMembershipIds', 'array-contains', treeId)),
    (snapshot) => {
      membershipPeople = snapshot.docs.map(mapPerson);
      emit();
    },
    onError,
  );

  const unsubscribeLegacy = onSnapshot(
    query(collection(db, PEOPLE_COLLECTION), where('treeId', '==', treeId)),
    (snapshot) => {
      legacyPeople = snapshot.docs.map(mapPerson);
      emit();
    },
    onError,
  );

  return () => {
    unsubscribeMembership();
    unsubscribeLegacy();
  };
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

export function subscribeToMergeRequests(
  treeId: string,
  onChange: (requests: MergeRequestRecord[]) => void,
  onError?: (error: Error) => void,
) {
  const mergeRequestsQuery = query(collection(db, MERGE_REQUESTS_COLLECTION), where('involvedTreeIds', 'array-contains', treeId));
  return onSnapshot(
    mergeRequestsQuery,
    (snapshot) => onChange(snapshot.docs.map(mapMergeRequest).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))),
    onError,
  );
}

export function subscribeToMergeHistory(
  treeId: string,
  onChange: (history: MergeHistoryRecord[]) => void,
  onError?: (error: Error) => void,
) {
  const mergeHistoryQuery = query(collection(db, MERGE_HISTORY_COLLECTION), where('involvedTreeIds', 'array-contains', treeId));
  return onSnapshot(
    mergeHistoryQuery,
    (snapshot) => onChange(snapshot.docs.map(mapMergeHistory).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))),
    onError,
  );
}

export function subscribeToNotifications(
  userId: string,
  onChange: (notifications: AppNotification[]) => void,
  onError?: (error: Error) => void,
) {
  const notificationsQuery = query(collection(db, NOTIFICATIONS_COLLECTION), where('userId', '==', userId));
  return onSnapshot(
    notificationsQuery,
    (snapshot) => onChange(snapshot.docs.map(mapNotification).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))),
    onError,
  );
}

export function subscribeToNotificationActivityStates(
  userId: string,
  onChange: (states: NotificationActivityState[]) => void,
  onError?: (error: Error) => void,
) {
  const activityQuery = query(collection(db, NOTIFICATION_ACTIVITY_COLLECTION), where('userId', '==', userId));
  return onSnapshot(
    activityQuery,
    (snapshot) => onChange(snapshot.docs.map(mapNotificationActivityState).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))),
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
    surnameVariantGroups: [],
    connectedTreeIds: [],
    membershipHistory: [{
      id: `${treeRef.id}-owner-joined`,
      userId: owner.id,
      role: 'owner',
      action: 'joined',
      createdAt: timestamp,
    }],
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

export async function createTreeWithPrimarySurname(
  owner: Pick<UserProfile, 'id' | 'email' | 'displayName'>,
  surname: string,
) {
  const trimmedSurname = surname.trim();
  if (!trimmedSurname) {
    throw new Error('Surname is required.');
  }

  const tree = await createTree(owner, trimmedSurname);
  await updateSurnameVariantGroups(tree.id, [{
    id: `${tree.id}-surname-variants`,
    primarySurname: trimmedSurname,
    variants: [],
    notes: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }]);

  return tree;
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
      membershipHistory: [
        ...tree.membershipHistory,
        {
          id: `${treeId}-${collaboratorUser.id}-${Date.now()}`,
          userId: collaboratorUser.id,
          role,
          action: 'invited',
          note: `Added as ${role}`,
          createdAt: nowIso(),
        },
      ],
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
      membershipHistory: [
        ...tree.membershipHistory,
        {
          id: `${treeId}-${collaboratorUserId}-${Date.now()}`,
          userId: collaboratorUserId,
          role: 'viewer',
          action: 'left',
          createdAt: nowIso(),
        },
      ],
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

    const personMembershipIds = Array.isArray(personSnapshot.data().treeMembershipIds)
      ? personSnapshot.data().treeMembershipIds
      : [personSnapshot.data().treeId].filter(Boolean);
    if (!personMembershipIds.includes(treeId)) {
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

async function getPeopleByTreeId(treeId: string) {
  const [membershipSnapshot, legacySnapshot] = await Promise.all([
    getDocs(query(collection(db, PEOPLE_COLLECTION), where('treeMembershipIds', 'array-contains', treeId))),
    getDocs(query(collection(db, PEOPLE_COLLECTION), where('treeId', '==', treeId))),
  ]);

  return mergeUniqueById([
    ...membershipSnapshot.docs.map(mapPerson),
    ...legacySnapshot.docs.map(mapPerson),
  ]);
}

async function getRelationshipsByTreeId(treeId: string) {
  const relationshipSnapshot = await getDocs(query(collection(db, RELATIONSHIPS_COLLECTION), where('treeId', '==', treeId)));
  return relationshipSnapshot.docs.map(mapRelationship);
}

export async function getTreeBundle(treeId: string) {
  const [tree, people, relationships] = await Promise.all([
    getTreeById(treeId),
    getPeopleByTreeId(treeId),
    getRelationshipsByTreeId(treeId),
  ]);

  return { tree, people, relationships };
}

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
    middleNames: input.middleNames?.trim() ?? person.middleNames ?? '',
    lastName: input.lastName.trim(),
    maidenName: input.maidenName?.trim() ?? person.maidenName ?? '',
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
    middleNames: nextPerson.middleNames ?? '',
    lastName: nextPerson.lastName,
    maidenName: nextPerson.maidenName ?? '',
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
  const { nextPerson, uploadedPhotos, removedPhotos } = await preparePersonUpdatePreview(actorUserId, person, input);
  const timestamp = nowIso();
  const payload: ApprovalRequestPayload = {
    beforePerson: person,
    afterPerson: nextPerson,
    removedPhotos,
    uploadedPhotos,
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
      description: `${requesterLabel} updated this family member profile and it was applied immediately because ${autoApproveBecauseNoSameSurnameContributor ? 'no contributor linked to the same surname could review it' : eligibleApproverIds.length === 0 ? 'no other collaborator could review it' : 'approvals are turned off for this tree'}.`,
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
      description: `${requesterLabel} deleted this family member and it was applied immediately because ${autoApproveBecauseNoSameSurnameContributor ? 'no contributor linked to the same surname could review it' : eligibleApproverIds.length === 0 ? 'no other collaborator could review it' : 'approvals are turned off for this tree'}.`,
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
  const validationMessage = validateProposedRelationship({
    relationships: existingRelationships,
    type,
    fromPersonId,
    toPersonId,
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
      description: `${requesterLabel} added a ${relationLabel} and it was applied immediately because ${autoApproveBecauseNoSameSurnameContributor ? 'no contributor linked to the same surname could review it' : eligibleApproverIds.length === 0 ? 'no other collaborator could review it' : 'approvals are turned off for this tree'}.`,
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
      description: `${requesterLabel} updated a ${relationLabel} and it was applied immediately because ${autoApproveBecauseNoSameSurnameContributor ? 'no contributor linked to the same surname could review it' : eligibleApproverIds.length === 0 ? 'no other collaborator could review it' : 'approvals are turned off for this tree'}.`,
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
      description: `${requesterLabel} removed a ${relationLabel} and it was applied immediately because ${autoApproveBecauseNoSameSurnameContributor ? 'no contributor linked to the same surname could review it' : eligibleApproverIds.length === 0 ? 'no other collaborator could review it' : 'approvals are turned off for this tree'}.`,
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

export async function updateSurnameVariantGroups(treeId: string, surnameVariantGroups: SurnameVariantGroup[]) {
  await updateDoc(doc(db, TREES_COLLECTION, treeId), {
    surnameVariantGroups: surnameVariantGroups.map((group) => ({
      id: group.id,
      primarySurname: group.primarySurname.trim(),
      variants: [...new Set(group.variants.map((value) => value.trim()).filter(Boolean))],
      notes: group.notes?.trim() ?? '',
      createdAt: group.createdAt,
      updatedAt: nowIso(),
    })),
    updatedAt: nowIso(),
  });
}

export async function getMergePreview(sourceTreeId: string, targetTreeId: string) {
  const [source, target] = await Promise.all([getTreeBundle(sourceTreeId), getTreeBundle(targetTreeId)]);
  return buildMergePreview(source, target);
}

function buildMergeApprovalLabel(tree: FamilyTree, userId: string) {
  const collaborator = tree.collaborators.find((entry) => entry.userId === userId);
  return collaborator?.displayName || collaborator?.email || 'An editor';
}

function canApproveMergeForTree(tree: FamilyTree, userId: string) {
  return tree.editorIds.includes(userId);
}

async function captureMergeSnapshot(sourceTreeId: string, targetTreeId: string, matches: MergePreview['matches']): Promise<MergeRequestSnapshot> {
  const personIds = [...new Set(matches.flatMap((match) => [match.sourcePersonId, match.targetPersonId]))];
  const relationshipIdsByTree = new Map<string, string[]>();

  const [sourceRelationships, targetRelationships] = await Promise.all([
    getRelationshipsByTreeId(sourceTreeId),
    getRelationshipsByTreeId(targetTreeId),
  ]);

  relationshipIdsByTree.set(sourceTreeId, sourceRelationships.filter((relationship) => personIds.includes(relationship.fromPersonId) || personIds.includes(relationship.toPersonId)).map((relationship) => relationship.id));
  relationshipIdsByTree.set(targetTreeId, targetRelationships.filter((relationship) => personIds.includes(relationship.fromPersonId) || personIds.includes(relationship.toPersonId)).map((relationship) => relationship.id));

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

async function applyMergeRequest(mergeRequestId: string, request: MergeRequestRecord) {
  const timestamp = nowIso();
  const snapshotBeforeMerge = await captureMergeSnapshot(request.sourceTreeId, request.targetTreeId, request.preview.matches);
  const batch = writeBatch(db);
  const changedPersonIds = new Set<string>();
  const sourceRelationships = await getRelationshipsByTreeId(request.sourceTreeId);
  const targetRelationships = await getRelationshipsByTreeId(request.targetTreeId);
  const relationships = [...sourceRelationships, ...targetRelationships];

  request.preview.matches
    .filter((match) => request.selectedMatchIds.includes(match.id))
    .forEach((match) => {
      const sourcePersonRef = doc(db, PEOPLE_COLLECTION, match.sourcePersonId);
      const targetPersonRef = doc(db, PEOPLE_COLLECTION, match.targetPersonId);
      const sourceSnapshot = snapshotBeforeMerge.people.find((entry) => entry.id === match.sourcePersonId)?.data ?? {};
      const targetSnapshot = snapshotBeforeMerge.people.find((entry) => entry.id === match.targetPersonId)?.data ?? {};
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
        treeMembershipIds: [...new Set([...sourceTreeMembershipIds, ...targetTreeMembershipIds, request.sourceTreeId, request.targetTreeId])],
        treeMemberships: [...mergedMembershipsByTreeId.values()],
        duplicatePersonIds: [...new Set([...targetDuplicatePersonIds, match.sourcePersonId])],
        updatedAt: timestamp,
      });

      relationships
        .filter((relationship) => relationship.fromPersonId === match.sourcePersonId || relationship.toPersonId === match.sourcePersonId)
        .forEach((relationship) => {
          batch.update(doc(db, RELATIONSHIPS_COLLECTION, relationship.id), {
            fromPersonId: relationship.fromPersonId === match.sourcePersonId ? match.targetPersonId : relationship.fromPersonId,
            toPersonId: relationship.toPersonId === match.sourcePersonId ? match.targetPersonId : relationship.toPersonId,
          });
        });
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

  const historyRef = doc(collection(db, MERGE_HISTORY_COLLECTION));
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

async function getUserProfileById(userId: string) {
  const userSnapshot = await getDoc(doc(db, USERS_COLLECTION, userId));
  if (!userSnapshot.exists()) {
    throw new Error('That user account no longer exists.');
  }

  const userData = userSnapshot.data();
  return {
    id: userSnapshot.id,
    email: userData.email ?? '',
    displayName: userData.displayName ?? '',
  };
}

export async function grantMergeRequesterViewerAccess(
  actorUserId: string,
  requestId: string,
  treeId: string,
) {
  const requestRef = doc(db, MERGE_REQUESTS_COLLECTION, requestId);
  const requestSnapshot = await getDoc(requestRef);
  if (!requestSnapshot.exists()) {
    throw new Error('That merge request no longer exists.');
  }

  const request = mapMergeRequest(requestSnapshot as QueryDocumentSnapshot);
  if (request.status !== 'applied') {
    throw new Error('Viewer access can only be granted after a merge is applied.');
  }

  if (!request.involvedTreeIds.includes(treeId)) {
    throw new Error('That tree was not part of the selected merge.');
  }

  const treeRef = doc(db, TREES_COLLECTION, treeId);
  const requester = await getUserProfileById(request.suggestedByUserId);

  await runTransaction(db, async (transaction) => {
    const treeSnapshot = await transaction.get(treeRef);
    if (!treeSnapshot.exists()) {
      throw new Error('That family tree no longer exists.');
    }

    const tree = mapTreeData(treeSnapshot.id, treeSnapshot.data());
    if (!canApproveMergeForTree(tree, actorUserId)) {
      throw new Error('Only an editor from this tree can grant viewer access.');
    }

    if (requester.id === tree.ownerId) {
      return;
    }

    if (tree.memberIds.includes(requester.id)) {
      return;
    }

    const collaborators = sortCollaborators([
      ...tree.collaborators,
      {
        userId: requester.id,
        email: requester.email,
        displayName: requester.displayName,
        role: 'viewer',
      },
    ]);

    transaction.update(treeRef, {
      collaborators,
      memberIds: [...tree.memberIds, requester.id],
      membershipHistory: [
        ...tree.membershipHistory,
        {
          id: `${tree.id}-${requester.id}-${Date.now()}`,
          userId: requester.id,
          role: 'viewer',
          action: 'joined',
          note: `Granted viewer access after merge ${requestId}`,
          createdAt: nowIso(),
        },
      ],
      updatedAt: nowIso(),
    });
  });
}

export async function sendMergeInviteByIdentifier(
  actorUserId: string,
  sourceTreeId: string,
  identifier: string,
) {
  const [sourceTree, targetUser] = await Promise.all([
    getTreeById(sourceTreeId),
    findUserByIdentifier(identifier),
  ]);

  if (!sourceTree.editorIds.includes(actorUserId)) {
    throw new Error('Only an editor can send merge invitations for this tree.');
  }

  if (targetUser.id === actorUserId) {
    throw new Error('You already have access to this account. Use tree IDs to merge your own trees directly.');
  }

  const notificationRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
  const timestamp = nowIso();
  const requestedByLabel = buildMergeApprovalLabel(sourceTree, actorUserId);

  await setDoc(notificationRef, {
    userId: targetUser.id,
    type: 'merge-invite',
    status: 'pending',
    requestedByUserId: actorUserId,
    requestedByLabel,
    sourceTreeId: sourceTree.id,
    sourceTreeName: sourceTree.name,
    targetIdentifier: identifier.trim(),
    message: `${requestedByLabel} asked you to review a tree merge with ${sourceTree.name}.`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function respondToMergeInvite(
  actorUserId: string,
  notificationId: string,
  status: 'accepted' | 'dismissed',
) {
  const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  const notificationSnapshot = await getDoc(notificationRef);
  if (!notificationSnapshot.exists()) {
    throw new Error('That merge invitation no longer exists.');
  }

  const notification = mapNotification(notificationSnapshot as QueryDocumentSnapshot);
  if (notification.userId !== actorUserId) {
    throw new Error('That merge invitation belongs to another user.');
  }

  await updateDoc(notificationRef, {
    status,
    respondedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export async function markNotificationSeen(actorUserId: string, notificationId: string) {
  const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  const notificationSnapshot = await getDoc(notificationRef);
  if (!notificationSnapshot.exists()) {
    throw new Error('That notification no longer exists.');
  }

  const notification = mapNotification(notificationSnapshot as QueryDocumentSnapshot);
  if (notification.userId !== actorUserId) {
    throw new Error('That notification belongs to another user.');
  }

  await updateDoc(notificationRef, {
    seenAt: notification.seenAt ?? nowIso(),
    updatedAt: nowIso(),
  });
}

export async function markNotificationOpened(actorUserId: string, notificationId: string) {
  const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  const notificationSnapshot = await getDoc(notificationRef);
  if (!notificationSnapshot.exists()) {
    throw new Error('That notification no longer exists.');
  }

  const notification = mapNotification(notificationSnapshot as QueryDocumentSnapshot);
  if (notification.userId !== actorUserId) {
    throw new Error('That notification belongs to another user.');
  }

  await updateDoc(notificationRef, {
    seenAt: notification.seenAt ?? nowIso(),
    openedAt: notification.openedAt ?? nowIso(),
    updatedAt: nowIso(),
  });
}

export async function markNotificationActivityActioned(
  actorUserId: string,
  sourceKind: NotificationActivityState['sourceKind'],
  sourceId: string,
) {
  const activityRef = doc(db, NOTIFICATION_ACTIVITY_COLLECTION, `${actorUserId}-${sourceKind}-${sourceId}`);
  const snapshot = await getDoc(activityRef);
  const timestamp = nowIso();

  if (snapshot.exists()) {
    await updateDoc(activityRef, {
      actionedAt: timestamp,
      updatedAt: timestamp,
    });
    return;
  }

  await setDoc(activityRef, {
    userId: actorUserId,
    sourceKind,
    sourceId,
    actionedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function createMergeRequest(
  actorUserId: string,
  sourceTreeId: string,
  targetTreeId: string,
) {
  const [source, target] = await Promise.all([getTreeBundle(sourceTreeId), getTreeBundle(targetTreeId)]);
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

  const approvals = [
    ...request.approvals.filter((entry) => !nextApprovals.some((approval) => approval.treeId === entry.treeId && approval.editorUserId === entry.editorUserId)),
    ...nextApprovals,
  ];
  const reviewerComments = comment.trim() ? [...request.reviewerComments, comment.trim()] : request.reviewerComments;
  const nextSelectedMatchIds = selectedMatchIds
    ? [...new Set(selectedMatchIds.filter((matchId) => request.preview.matches.some((match) => match.id === matchId)))]
    : request.selectedMatchIds;
  if (decision === 'approve' && nextSelectedMatchIds.length === 0) {
    throw new Error('Select at least one person match before approving this merge.');
  }

  let status: MergeRequestRecord['status'] = request.status;
  if (decision === 'reject') {
    status = 'rejected';
  } else if (decision === 'request-changes') {
    status = 'changes-requested';
  } else {
    const approvedTreeIds = new Set(approvals.filter((entry) => entry.decision === 'approve').map((entry) => entry.treeId));
    status = approvedTreeIds.has(sourceTree.id) && approvedTreeIds.has(targetTree.id) ? 'approved' : 'pending';
  }

  await updateDoc(requestRef, {
    approvals,
    reviewerComments,
    conflictChoices,
    selectedMatchIds: nextSelectedMatchIds,
    status,
    updatedAt: nowIso(),
  });

  if (status === 'approved') {
    await applyMergeRequest(requestId, {
      ...request,
      approvals,
      reviewerComments,
      conflictChoices,
      selectedMatchIds: nextSelectedMatchIds,
      status,
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

export async function deleteTree(tree: FamilyTree) {
  const people = await getPeopleByTreeId(tree.id);
  const relationshipSnapshot = await getDocs(query(collection(db, RELATIONSHIPS_COLLECTION), where('treeId', '==', tree.id)));
  const approvalRequestsSnapshot = await getDocs(query(collection(db, APPROVAL_REQUESTS_COLLECTION), where('treeId', '==', tree.id)));
  const mergeRequestsSnapshot = await getDocs(query(collection(db, MERGE_REQUESTS_COLLECTION), where('involvedTreeIds', 'array-contains', tree.id)));
  const mergeHistorySnapshot = await getDocs(query(collection(db, MERGE_HISTORY_COLLECTION), where('involvedTreeIds', 'array-contains', tree.id)));

  const peopleToDelete = people.filter((person) => person.treeMembershipIds.length <= 1);
  await deletePhotos(peopleToDelete.flatMap((person) => person.photos));

  await Promise.all(
    people
      .filter((person) => person.treeMembershipIds.length > 1)
      .map((person) => updateDoc(doc(db, PEOPLE_COLLECTION, person.id), {
        treeMembershipIds: person.treeMembershipIds.filter((membershipTreeId) => membershipTreeId !== tree.id),
        treeMemberships: person.treeMemberships.filter((membership) => membership.treeId !== tree.id),
        updatedAt: nowIso(),
      })),
  );

  const treeDeletionTimestamp = nowIso();
  await Promise.all(
    mergeRequestsSnapshot.docs.map(async (snapshot) => {
      const request = mapMergeRequest(snapshot as QueryDocumentSnapshot);
      const remainingTreeIds = request.involvedTreeIds.filter((treeId) => treeId !== tree.id);

      if (remainingTreeIds.length === 0) {
        return;
      }

      await updateDoc(snapshot.ref, {
        involvedTreeIds: remainingTreeIds,
        status: request.status === 'pending' || request.status === 'changes-requested' || request.status === 'approved'
          ? 'rejected'
          : request.status,
        reviewerComments: [
          ...request.reviewerComments,
          `${tree.name} was deleted on ${treeDeletionTimestamp}.`,
        ],
        updatedAt: treeDeletionTimestamp,
      });
    }),
  );

  await Promise.all(
    mergeHistorySnapshot.docs.map(async (snapshot) => {
      const history = mapMergeHistory(snapshot as QueryDocumentSnapshot);
      const remainingTreeIds = history.involvedTreeIds.filter((treeId) => treeId !== tree.id);

      if (remainingTreeIds.length === 0) {
        return;
      }

      await updateDoc(snapshot.ref, {
        involvedTreeIds: remainingTreeIds,
        updatedAt: treeDeletionTimestamp,
      });
    }),
  );

  const refsToDelete = [
    ...peopleToDelete.map((person) => doc(db, PEOPLE_COLLECTION, person.id)),
    ...relationshipSnapshot.docs.map((snapshot) => snapshot.ref),
    ...approvalRequestsSnapshot.docs.map((snapshot) => snapshot.ref),
    ...mergeRequestsSnapshot.docs
      .filter((snapshot) => {
        const request = mapMergeRequest(snapshot as QueryDocumentSnapshot);
        return request.involvedTreeIds.filter((treeId) => treeId !== tree.id).length === 0;
      })
      .map((snapshot) => snapshot.ref),
    ...mergeHistorySnapshot.docs
      .filter((snapshot) => {
        const history = mapMergeHistory(snapshot as QueryDocumentSnapshot);
        return history.involvedTreeIds.filter((treeId) => treeId !== tree.id).length === 0;
      })
      .map((snapshot) => snapshot.ref),
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
    treeMembershipIds: [treeId],
    treeMemberships: [{ treeId, role: 'subject', joinedAt: timestamp, addedByUserId: actorUserId, source: 'manual' }],
    ownerId: actorUserId,
    firstName: input.firstName.trim(),
    middleNames: input.middleNames?.trim() ?? '',
    lastName: input.lastName.trim(),
    maidenName: input.maidenName?.trim() ?? '',
    nicknames: [],
    clanName: '',
    familyBranch: '',
    hometown: '',
    birthPlace: '',
    surnameVariantHints: [],
    canonicalPersonId: '',
    duplicatePersonIds: [],
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

export async function createParentChildRelationship(
  actorUserId: string,
  treeId: string,
  parentId: string,
  childId: string,
  parentChildKind: ParentChildRelationshipKind = DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
): Promise<ApprovalSubmissionResult> {
  return submitCreateRelationshipApproval(actorUserId, treeId, 'parent-child', parentId, childId, { parentChildKind });
}

export async function createSpouseRelationship(
  actorUserId: string,
  treeId: string,
  personAId: string,
  personBId: string,
  relationshipStatus: SpouseRelationshipStatus = DEFAULT_SPOUSE_RELATIONSHIP_STATUS,
): Promise<ApprovalSubmissionResult> {
  return submitCreateRelationshipApproval(actorUserId, treeId, 'spouse', personAId, personBId, { relationshipStatus });
}

export async function updateRelationship(
  actorUserId: string,
  relationship: RelationshipRecord,
  updates: {
    relationshipStatus?: SpouseRelationshipStatus;
    parentChildKind?: ParentChildRelationshipKind;
  },
): Promise<ApprovalSubmissionResult> {
  return submitUpdateRelationshipApproval(actorUserId, relationship, updates);
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
