import { aggregateSyncSources, type SyncSource } from '../components/sync-state';
import { setSyncSource } from '../stores/sync-status-store';
import { trackedSubscription } from './tracked-subscription';
import { subscribeToActivity } from './activity-subscription';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  or,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from './firebase-provider';
import { functionsApi } from './firebase-provider';
import type { ApprovalRequest, ApprovalSubmissionResult } from '../components/dto/approval';
import type { MergeHistoryRecord, MergeRequestRecord } from '../components/dto/merge';
import type { AppNotification, NotificationActivityState } from '../components/dto/notification';
import type { NewPersonPhotoInput, PersonInput, PersonMutationPayload, PersonPhoto, PersonRecord } from '../components/dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from '../components/dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from '../components/dto/relationship';
import type { FamilyTree, KinshipSystem, SurnameVariantGroup } from '../components/dto/tree';
import type { UserProfile } from '../components/dto/user';
import {
  buildOwnerCollaborator,
  clampApprovalWindowHours,
  mapApprovalRequest,
  mapMergeHistory,
  mapMergeRequest,
  mapNotification,
  mapNotificationActivityState,
  mapPerson,
  mapRelationship,
  mapTree,
  mapTreeData,
  mergeUniqueById,
  normaliseLifeEvents,
  asSafeString,
  sortByNewest,
  sortCollaborators,
} from './family-tree-mappers';
import {
  applyPreferredPhotoDisplayVariant,
  deletePhotos,
  resolvePreferredPhotoId,
  resolvePreferredPhotoSourceUri,
  uploadPersonPhotos,
  uploadPreferredPhotoDisplayVariant,
} from './family-tree-photo-service';
import { addCollaboratorToTree, assignTreePersonToUser, clearTreePersonAssignment, removeCollaboratorFromTree } from './family-tree-collaboration-service';
import {
  APPROVAL_REQUESTS_COLLECTION,
  MERGE_HISTORY_COLLECTION,
  MERGE_REQUESTS_COLLECTION,
  NOTIFICATION_ACTIVITY_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  PEOPLE_COLLECTION,
  RELATIONSHIPS_COLLECTION,
  TREES_COLLECTION,
  findUserByUsernameExact,
  getLegacyPeopleNeedingBackfill,
  getPeopleByTreeId,
  getRelationshipsByTreeId,
  getTreeBundle,
  getTreeById,
  getUserProfileByIdOptional,
  deleteDocumentRefs,
} from './family-tree-data';
import {
  type CreatePersonApprovalResult,
  decideApprovalRequest,
  processExpiredApprovalRequests,
  submitCreatePersonApproval,
  submitCreateRelationshipApproval,
  submitDeletePersonApproval,
  submitDeleteRelationshipApproval,
  submitPersonUpdateApproval,
  submitUpdateRelationshipApproval,
  validatePersonCreation,
} from './family-tree-approval-service';
import {
  cancelTreeAccessRequest,
  deleteAllNotifications,
  deleteNotification,
  deleteNotificationActivity,
  grantMergeRequesterViewerAccess,
  markNotificationActivityActioned,
  markNotificationOpened,
  markNotificationSeen,
  requestAccessFromIdentifier,
  requestAccessToTree,
  respondToMergeInvite,
  respondToTreeAccessRequest,
  sendMergeInviteByIdentifier,
} from './family-tree-access-service';
import { createMergeRequest, getMergePreview, reviewMergeRequest, undoMergeRequest } from './family-tree-merge-service';
import { nowIso } from './family-tree-shared';

export interface DiscoverableTreeSummary {
  id: string;
  name: string;
  ownerId: string;
  ownerDisplayName: string;
  ownerUsername: string;
  discoverable: boolean;
  matchedBy: 'tree-name' | 'surname' | 'username';
  matchedLabel: string;
}


export {
  addCollaboratorToTree,
  assignTreePersonToUser,
  clearTreePersonAssignment,
  removeCollaboratorFromTree,
  decideApprovalRequest,
  processExpiredApprovalRequests,
  submitCreatePersonApproval,
  submitCreateRelationshipApproval,
  submitDeletePersonApproval,
  submitDeleteRelationshipApproval,
  submitPersonUpdateApproval,
  submitUpdateRelationshipApproval,
  cancelTreeAccessRequest,
  deleteAllNotifications,
  deleteNotification,
  deleteNotificationActivity,
  grantMergeRequesterViewerAccess,
  markNotificationActivityActioned,
  markNotificationOpened,
  markNotificationSeen,
  requestAccessFromIdentifier,
  requestAccessToTree,
  respondToMergeInvite,
  respondToTreeAccessRequest,
  sendMergeInviteByIdentifier,
  createMergeRequest,
  getMergePreview,
  reviewMergeRequest,
  undoMergeRequest,
  getTreeBundle,
};

function normaliseSearchValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]+/gu, ' ')
    .replace(/\s+/g, ' ');
}

function buildSearchKeywordSet(values: string[]) {
  const keywords = new Set<string>();

  values.forEach((value) => {
    const normalizedValue = normaliseSearchValue(value);
    if (!normalizedValue) {
      return;
    }

    keywords.add(normalizedValue);
    normalizedValue
      .split(' ')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => keywords.add(part));
  });

  return [...keywords];
}

function buildTreeSearchKeywords(name: string, surnameVariantGroups: SurnameVariantGroup[]) {
  return buildSearchKeywordSet([
    name,
    ...surnameVariantGroups.flatMap((group) => [group.primarySurname, ...group.variants]),
  ]);
}

function pickPrimarySearchKeyword(value: string) {
  return buildSearchKeywordSet([value]).sort((left, right) => right.length - left.length)[0] ?? '';
}

function normaliseSurnameKey(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? '';
}

export function subscribeToTrees(
  userId: string,
  onChange: (trees: FamilyTree[]) => void,
  onError?: (error: Error) => void,
) {
  const treesQuery = query(collection(db, TREES_COLLECTION), where('memberIds', 'array-contains', userId));
  return trackedSubscription(
    'trees', treesQuery,
    (snapshot) => {
      onChange(sortByNewest(snapshot.docs.map(mapTree)));
    },
    onError,
  );
}

export function subscribeToPeople(
  treeId: string,
  onChange: (people: PersonRecord[]) => void,
  onError?: (error: Error) => void,
  accessiblePrimaryTreeIds: string[] = [treeId],
) {
  let membershipPeople: PersonRecord[] = [];
  let legacyPeople: PersonRecord[] = [];
  let active = true;
  let membershipReady = false;
  let legacyReady = false;

  const emit = () => {
    if (!active || !membershipReady || !legacyReady) {
      return;
    }

    onChange(sortByNewest(mergeUniqueById([...membershipPeople, ...legacyPeople])));
  };

  const primaryIds = [...new Set([treeId, ...accessiblePrimaryTreeIds])];
  const chunks = Array.from({ length: Math.ceil(primaryIds.length / 10) }, (_, i) => primaryIds.slice(i * 10, (i + 1) * 10));
  const records = new Map<number, PersonRecord[]>();
  const statuses: Record<string, SyncSource> = Object.fromEntries(chunks.map((_, i) => [i, { source: 'connecting', pendingWrites: false }]));
  setSyncSource('people', aggregateSyncSources(statuses));
  const stops = chunks.map((ids, index) => onSnapshot(
    query(collection(db, PEOPLE_COLLECTION), where('treeMembershipIds', 'array-contains', treeId), where('treeId', 'in', ids)),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!active) return;
      statuses[index] = { source: snapshot.metadata.fromCache ? 'cache' : 'server', pendingWrites: snapshot.metadata.hasPendingWrites };
      setSyncSource('people', aggregateSyncSources(statuses));
      records.set(index, snapshot.docs.map(mapPerson));
      if (records.size !== chunks.length) return;
      membershipReady = true;
      membershipPeople = [...records.values()].flat();
      const membershipIds = new Set(membershipPeople.map((person) => person.id));
      legacyPeople = legacyPeople.filter((person) => !membershipIds.has(person.id));
      emit();
    }, (error) => {
      if (!active) return;
      statuses[index] = { source: 'error', pendingWrites: false };
      setSyncSource('people', aggregateSyncSources(statuses)); onError?.(error);
    },
  ));
  const unsubscribeMembership = () => { stops.forEach((stop) => stop()); setSyncSource('people', null); };

  void (process.env.EXPO_PUBLIC_MEMBERSHIP_MIGRATED === 'true' ? Promise.resolve([]) : getLegacyPeopleNeedingBackfill(treeId))
    .then((peopleNeedingBackfill) => {
      if (!active) {
        return;
      }

      legacyReady = true;
      const membershipIds = new Set(membershipPeople.map((person) => person.id));
      legacyPeople = peopleNeedingBackfill.filter((person) => !membershipIds.has(person.id));
      emit();
    })
    .catch((error) => {
      if (!active) return;
      setSyncSource('people', { source: 'error', pendingWrites: false });
      onError?.(error as Error);
    });

  return () => {
    active = false;
    unsubscribeMembership();
  };
}

export function subscribeToRelationships(
  treeId: string,
  onChange: (relationships: RelationshipRecord[]) => void,
  onError?: (error: Error) => void,
) {
  const relationshipsQuery = query(collection(db, RELATIONSHIPS_COLLECTION), where('treeId', '==', treeId));
  return trackedSubscription(
    'relationships', relationshipsQuery,
    (snapshot) => {
      const relationships = snapshot.docs.map(mapRelationship).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      onChange(relationships);
    },
    onError,
  );
}

export function subscribeToApprovalRequests(treeId: string, onChange: (records: ApprovalRequest[]) => void, onError?: (error: Error) => void) {
  return subscribeToActivity('ApprovalRequests', query(collection(db, APPROVAL_REQUESTS_COLLECTION), where('treeId', '==', treeId)), mapApprovalRequest, onChange, onError, 80, where('status', '==', 'pending'));
}

export function subscribeToMergeRequests(treeId: string, onChange: (records: MergeRequestRecord[]) => void, onError?: (error: Error) => void) {
  return subscribeToActivity('MergeRequests', query(collection(db, MERGE_REQUESTS_COLLECTION), or(where('sourceTreeId', '==', treeId), where('targetTreeId', '==', treeId))), mapMergeRequest, onChange, onError, 80, where('status', 'in', ['pending', 'changes-requested', 'approved']));
}

export function subscribeToMergeHistory(treeId: string, onChange: (records: MergeHistoryRecord[]) => void, onError?: (error: Error) => void) {
  return subscribeToActivity('MergeHistory', query(collection(db, MERGE_HISTORY_COLLECTION), or(where('sourceTreeId', '==', treeId), where('targetTreeId', '==', treeId))), mapMergeHistory, onChange, onError, 80);
}

export function subscribeToNotifications(userId: string, onChange: (records: AppNotification[]) => void, onError?: (error: Error) => void) {
  return subscribeToActivity('Notifications', query(collection(db, NOTIFICATIONS_COLLECTION), where('userId', '==', userId)), mapNotification, onChange, onError, 120, where('status', '==', 'pending'));
}

export function subscribeToNotificationActivityStates(
  userId: string,
  onChange: (states: NotificationActivityState[]) => void,
  onError?: (error: Error) => void,
) {
  const activityQuery = query(
    collection(db, NOTIFICATION_ACTIVITY_COLLECTION),
    where('userId', '==', userId),
  );
  return onSnapshot(
    activityQuery,
    (snapshot) => onChange(snapshot.docs.map(mapNotificationActivityState).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))),
    onError,
  );
}

export async function createTree(owner: Pick<UserProfile, 'id' | 'email' | 'displayName'>, name: string): Promise<FamilyTree> {
 const operationId = doc(collection(db, TREES_COLLECTION)).id;
 return (await httpsCallable<object, FamilyTree>(functionsApi, 'createTreeServer')({name, operationId})).data;
}

export async function updateTreeName(treeId: string, name: string) {
  const tree = await getTreeById(treeId);
  const trimmedName = name.trim();

  await updateDoc(doc(db, TREES_COLLECTION, treeId), {
    name: trimmedName,
    searchKeywords: buildTreeSearchKeywords(trimmedName, tree.surnameVariantGroups),
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

function buildTreeMembershipEntry(
  treeId: string,
  role: 'member' | 'subject' | 'branch-member' | 'canonical',
  addedByUserId: string,
  source: 'manual' | 'merge' | 'invite' = 'manual',
) {
  return {
    treeId,
    role,
    joinedAt: nowIso(),
    addedByUserId,
    source,
  } as const;
}

function upsertTreeMembership(
  memberships: PersonRecord['treeMemberships'],
  nextMembership: PersonRecord['treeMemberships'][number],
) {
  const existing = Array.isArray(memberships) ? memberships : [];
  const filtered = existing.filter((membership) => membership.treeId !== nextMembership.treeId);
  return [...filtered, nextMembership];
}

function treeMatchesSurname(tree: FamilyTree, surname: string) {
  const key = normaliseSurnameKey(surname);
  if (!key) {
    return false;
  }

  if (normaliseSurnameKey(tree.name) === key) {
    return true;
  }

  return tree.surnameVariantGroups.some((group) => (
    [group.primarySurname, ...group.variants]
      .map(normaliseSurnameKey)
      .includes(key)
  ));
}

export async function createSuggestedSurnameTree(owner: Pick<UserProfile, 'id' | 'email' | 'displayName'>, sourceTreeId: string, surname: string) {
 return (await httpsCallable<object, FamilyTree>(functionsApi, 'createSurnameTreeServer')({sourceTreeId, surname})).data;
}

export async function updateTreeApprovalWindow(treeId: string, approvalWindowHours: number) {
  await updateDoc(doc(db, TREES_COLLECTION, treeId), {
    approvalWindowHours: clampApprovalWindowHours(approvalWindowHours),
    updatedAt: nowIso(),
  });
}

export async function updateTreeKinshipSystem(treeId: string, kinshipSystem: KinshipSystem) {
  await updateDoc(doc(db, TREES_COLLECTION, treeId), {
    kinshipSystem,
    updatedAt: nowIso(),
  });
}

export async function getTreeDeletionImpact(treeId: string) {
  const tree = await getTreeById(treeId);
  const people = await getPeopleByTreeId(tree.id);
  const relationshipSnapshot = await getDocs(query(collection(db, RELATIONSHIPS_COLLECTION), where('treeId', '==', tree.id)));
  const approvalRequestsSnapshot = await getDocs(query(collection(db, APPROVAL_REQUESTS_COLLECTION), where('treeId', '==', tree.id)));
  const mergeRequestsSnapshot = await getDocs(query(collection(db, MERGE_REQUESTS_COLLECTION), where('involvedTreeIds', 'array-contains', tree.id)));
  const mergeHistorySnapshot = await getDocs(query(collection(db, MERGE_HISTORY_COLLECTION), where('involvedTreeIds', 'array-contains', tree.id)));

  const peopleDeleted = people.filter((person) => person.treeMembershipIds.length <= 1);
  const peopleDetached = people.filter((person) => person.treeMembershipIds.length > 1);
  const photosDeleted = peopleDeleted.reduce((total, person) => total + person.photos.length, 0);

  return {
    tree,
    collaboratorsRemoved: Math.max(0, tree.collaborators.length - 1),
    linkedProfilesRemoved: Object.keys(tree.personAssignments).length,
    peopleDeleted: peopleDeleted.length,
    peopleDetached: peopleDetached.length,
    photosDeleted,
    relationshipsDeleted: relationshipSnapshot.size,
    approvalRequestsDeleted: approvalRequestsSnapshot.size,
    mergeRequestsAffected: mergeRequestsSnapshot.size,
    mergeHistoryAffected: mergeHistorySnapshot.size,
    connectedTreesDetached: tree.connectedTreeIds.length,
  };
}

export async function updateSurnameVariantGroups(treeId: string, surnameVariantGroups: SurnameVariantGroup[]) {
  const tree = await getTreeById(treeId);
  const normalizedGroups = surnameVariantGroups.map((group) => ({
    id: group.id,
    primarySurname: group.primarySurname.trim(),
    variants: [...new Set(group.variants.map((value) => value.trim()).filter(Boolean))],
    notes: group.notes?.trim() ?? '',
    createdAt: group.createdAt,
    updatedAt: nowIso(),
  }));

  await updateDoc(doc(db, TREES_COLLECTION, treeId), {
    surnameVariantGroups: normalizedGroups,
    searchKeywords: buildTreeSearchKeywords(tree.name, normalizedGroups),
    updatedAt: nowIso(),
  });
}

export async function updateTreeDiscoverability(treeId: string, discoverable: boolean) {
  const tree = await getTreeById(treeId);

  await updateDoc(doc(db, TREES_COLLECTION, treeId), {
    discoverable,
    searchKeywords: buildTreeSearchKeywords(tree.name, tree.surnameVariantGroups),
    updatedAt: nowIso(),
  });
}

function buildDiscoverableTreeSummary(
  tree: FamilyTree,
  ownerProfile: Pick<UserProfile, 'displayName' | 'username'> | null | undefined,
  matchedBy: DiscoverableTreeSummary['matchedBy'],
  matchedLabel: string,
): DiscoverableTreeSummary {
  return {
    id: tree.id,
    name: tree.name,
    ownerId: tree.ownerId,
    ownerDisplayName: ownerProfile?.displayName?.trim() || tree.collaborators.find((entry) => entry.userId === tree.ownerId)?.displayName || '',
    ownerUsername: ownerProfile?.username?.trim() || '',
    discoverable: tree.discoverable === true,
    matchedBy,
    matchedLabel,
  };
}

export async function searchDiscoverableTrees(searchTerm: string, actorUserId: string) {
 const result = await httpsCallable<{term: string}, {trees: DiscoverableTreeSummary[]}>(functionsApi, 'searchTreeDirectoryServer')({term: searchTerm});
 return result.data.trees;
}

export async function searchDiscoverableTreesByOwnerUsername(username: string, actorUserId: string) {
 const owner = await findUserByUsernameExact(username);
 const result = await httpsCallable<{ownerId: string}, {trees: DiscoverableTreeSummary[]}>(functionsApi, 'searchTreeDirectoryServer')({ownerId: owner.id});
 return result.data.trees;
}

export async function deleteTree(tree: FamilyTree) {
  await httpsCallable<{ treeId: string }, { ok: boolean }>(
    functionsApi,
    'deleteTreeServer',
  )({ treeId: tree.id });
}

export async function createPerson(actorUserId: string, treeId: string, input: PersonInput, newPhotos: NewPersonPhotoInput[]): Promise<PersonRecord> {
 const result = await submitCreatePersonApproval(actorUserId, treeId, input, newPhotos);
 if (!result.person) throw new Error(result.message);
 return result.person;
}

export async function createPersonWithRelationships(
  actorUserId: string,
  treeId: string,
  input: PersonInput,
  newPhotos: NewPersonPhotoInput[],
  pendingRelationships: Array<{
    mode: 'parent-of' | 'child-of' | 'spouse-of';
    relatedPersonId: string;
    parentChildKind?: ParentChildRelationshipKind;
    relationshipStatus?: SpouseRelationshipStatus;
  }> = [],
  options?: {
    forceImmediateApproval?: boolean;
  },
): Promise<CreatePersonApprovalResult> {
  return submitCreatePersonApproval(actorUserId, treeId, input, newPhotos, pendingRelationships, options);
}

export async function updatePerson(
  actorUserId: string,
  person: PersonRecord,
  input: PersonMutationPayload,
): Promise<ApprovalSubmissionResult> {
  return submitPersonUpdateApproval(actorUserId, person, input);
}

export async function deletePerson(actorUserId: string, person: PersonRecord): Promise<ApprovalSubmissionResult> {
  return submitDeletePersonApproval(actorUserId, person);
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

export async function deleteRelationship(actorUserId: string, relationshipId: string): Promise<ApprovalSubmissionResult> {
  return submitDeleteRelationshipApproval(actorUserId, relationshipId);
}
