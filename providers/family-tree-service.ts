import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase-provider';
import type { ApprovalRequest, ApprovalSubmissionResult } from '../components/dto/approval';
import type { MergeHistoryRecord, MergeRequestRecord } from '../components/dto/merge';
import type { AppNotification, NotificationActivityState } from '../components/dto/notification';
import type { NewPersonPhotoInput, PersonInput, PersonMutationPayload, PersonPhoto, PersonRecord } from '../components/dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from '../components/dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from '../components/dto/relationship';
import type { FamilyTree, SurnameVariantGroup } from '../components/dto/tree';
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
  let active = true;

  const emit = () => {
    if (!active) {
      return;
    }

    onChange(sortByNewest(mergeUniqueById([...membershipPeople, ...legacyPeople])));
  };

  const unsubscribeMembership = onSnapshot(
    query(collection(db, PEOPLE_COLLECTION), where('treeMembershipIds', 'array-contains', treeId)),
    (snapshot) => {
      membershipPeople = snapshot.docs.map(mapPerson);
      if (legacyPeople.length > 0) {
        const membershipIds = new Set(membershipPeople.map((person) => person.id));
        legacyPeople = legacyPeople.filter((person) => !membershipIds.has(person.id));
      }
      emit();
    },
    onError,
  );

  void getLegacyPeopleNeedingBackfill(treeId)
    .then((peopleNeedingBackfill) => {
      if (!active || peopleNeedingBackfill.length === 0) {
        return;
      }

      const membershipIds = new Set(membershipPeople.map((person) => person.id));
      legacyPeople = peopleNeedingBackfill.filter((person) => !membershipIds.has(person.id));
      emit();
    })
    .catch((error) => onError?.(error as Error));

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
  const trimmedName = name.trim();
  const ownerEmail = asSafeString(owner.email);
  const ownerDisplayName = asSafeString(owner.displayName);
  const ownerCollaborator = buildOwnerCollaborator(owner);
  const tree: Omit<FamilyTree, 'id'> & { ownerEmail: string; ownerDisplayName: string } = {
    ownerId: owner.id,
    ownerEmail,
    ownerDisplayName,
    name: trimmedName,
    discoverable: true,
    searchKeywords: buildTreeSearchKeywords(trimmedName, []),
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

export async function createSuggestedSurnameTree(
  owner: Pick<UserProfile, 'id' | 'email' | 'displayName'>,
  sourceTreeId: string,
  surname: string,
) {
  const trimmedSurname = surname.trim();
  const surnameKey = normaliseSurnameKey(trimmedSurname);
  if (!surnameKey) {
    throw new Error('Surname is required.');
  }

  const [sourceTree, sourcePeople, sourceRelationships] = await Promise.all([
    getTreeById(sourceTreeId),
    getPeopleByTreeId(sourceTreeId),
    getRelationshipsByTreeId(sourceTreeId),
  ]);

  const connectedTrees = (await Promise.all(
    sourceTree.connectedTreeIds.map(async (treeId) => {
      try {
        return await getTreeById(treeId);
      } catch {
        return null;
      }
    }),
  )).filter((tree): tree is FamilyTree => Boolean(tree));
  const existingConnectedTree = connectedTrees.find((tree) => treeMatchesSurname(tree, trimmedSurname));

  if (existingConnectedTree) {
    return existingConnectedTree;
  }

  const bridgePeople = sourcePeople.filter((person) => normaliseSurnameKey(person.maidenName ?? '') === surnameKey);
  const surnameMembers = sourcePeople.filter((person) => normaliseSurnameKey(person.lastName) === surnameKey);
  const newTreePersonIds = new Set([...bridgePeople, ...surnameMembers].map((person) => person.id));
  const bridgePersonIds = new Set(bridgePeople.map((person) => person.id));
  const movedPersonIds = new Set(
    surnameMembers
      .map((person) => person.id)
      .filter((personId) => !bridgePersonIds.has(personId)),
  );

  const createdTree = await createTree(owner, trimmedSurname);
  const createdAt = nowIso();
  const newTreeRef = doc(db, TREES_COLLECTION, createdTree.id);
  const sourceTreeRef = doc(db, TREES_COLLECTION, sourceTree.id);
  const batch = writeBatch(db);
  const copiedCollaborators = sortCollaborators([
    buildOwnerCollaborator(owner),
    ...sourceTree.collaborators
      .filter((collaborator) => collaborator.userId !== owner.id)
      .map((collaborator) => ({
        ...collaborator,
        role: collaborator.role === 'owner' ? 'editor' : collaborator.role,
      })),
  ]);
  const copiedMemberIds = [...new Set([owner.id, ...sourceTree.memberIds])];
  const copiedEditorIds = [...new Set([owner.id, ...sourceTree.editorIds])];

  const copiedAssignments = Object.fromEntries(
    Object.entries(sourceTree.personAssignments).filter(([, personId]) => newTreePersonIds.has(personId)),
  );
  const retainedAssignments = Object.fromEntries(
    Object.entries(sourceTree.personAssignments).filter(([, personId]) => !movedPersonIds.has(personId)),
  );

  batch.update(newTreeRef, {
    collaborators: copiedCollaborators,
    memberIds: copiedMemberIds,
    editorIds: copiedEditorIds,
    personAssignments: copiedAssignments,
    approvalWindowHours: sourceTree.approvalWindowHours,
    surnameVariantGroups: [{
      id: `${createdTree.id}-surname-variants`,
      primarySurname: trimmedSurname,
      variants: [],
      notes: '',
      createdAt,
      updatedAt: createdAt,
    }],
    connectedTreeIds: [...new Set([...(createdTree.connectedTreeIds ?? []), sourceTree.id])],
    updatedAt: createdAt,
  });

  batch.update(sourceTreeRef, {
    connectedTreeIds: [...new Set([...(sourceTree.connectedTreeIds ?? []), createdTree.id])],
    personAssignments: retainedAssignments,
    updatedAt: createdAt,
  });

  sourcePeople.forEach((person) => {
    if (!newTreePersonIds.has(person.id)) {
      return;
    }

    const nextMembershipIds = person.treeMembershipIds.filter((treeId) => treeId !== sourceTree.id);
    const nextMemberships = person.treeMemberships.filter((membership) => membership.treeId !== sourceTree.id);
    const personRef = doc(db, PEOPLE_COLLECTION, person.id);

    if (bridgePersonIds.has(person.id)) {
      batch.update(personRef, {
        treeMembershipIds: [...new Set([...person.treeMembershipIds, createdTree.id])],
        treeMemberships: upsertTreeMembership(
          person.treeMemberships,
          buildTreeMembershipEntry(createdTree.id, 'branch-member', owner.id),
        ),
        updatedAt: createdAt,
      });
      return;
    }

    const replacedMembershipIds = [...new Set([...nextMembershipIds, createdTree.id])];
    const replacedMemberships = upsertTreeMembership(
      nextMemberships,
      buildTreeMembershipEntry(createdTree.id, 'subject', owner.id),
    );
    batch.update(personRef, {
      treeId: person.treeId === sourceTree.id ? createdTree.id : person.treeId,
      treeMembershipIds: replacedMembershipIds,
      treeMemberships: replacedMemberships,
      updatedAt: createdAt,
    });
  });

  sourceRelationships.forEach((relationship) => {
    const endpointsInNewTree = newTreePersonIds.has(relationship.fromPersonId) && newTreePersonIds.has(relationship.toPersonId);
    const endpointsRemainInSource = !movedPersonIds.has(relationship.fromPersonId) && !movedPersonIds.has(relationship.toPersonId);

    if (endpointsInNewTree) {
      const relationshipRef = doc(collection(db, RELATIONSHIPS_COLLECTION));
      batch.set(relationshipRef, {
        type: relationship.type,
        treeId: createdTree.id,
        ownerId: owner.id,
        fromPersonId: relationship.fromPersonId,
        toPersonId: relationship.toPersonId,
        relationshipStatus: relationship.type === 'spouse'
          ? relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS
          : null,
        parentChildKind: relationship.type === 'parent-child'
          ? relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND
          : null,
        createdAt,
      });
    }

    if (!endpointsRemainInSource) {
      batch.delete(doc(db, RELATIONSHIPS_COLLECTION, relationship.id));
    }
  });

  await batch.commit();
  return {
    ...createdTree,
    collaborators: copiedCollaborators,
    memberIds: copiedMemberIds,
    editorIds: copiedEditorIds,
    personAssignments: copiedAssignments,
    approvalWindowHours: sourceTree.approvalWindowHours,
    surnameVariantGroups: [{
      id: `${createdTree.id}-surname-variants`,
      primarySurname: trimmedSurname,
      variants: [],
      notes: '',
      createdAt,
      updatedAt: createdAt,
    }],
    connectedTreeIds: [...new Set([...(createdTree.connectedTreeIds ?? []), sourceTree.id])],
    updatedAt: createdAt,
  };
}

export async function updateTreeApprovalWindow(treeId: string, approvalWindowHours: number) {
  await updateDoc(doc(db, TREES_COLLECTION, treeId), {
    approvalWindowHours: clampApprovalWindowHours(approvalWindowHours),
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
  const trimmedSearchTerm = searchTerm.trim();
  const keyword = pickPrimarySearchKeyword(trimmedSearchTerm);
  if (!keyword) {
    return [] as DiscoverableTreeSummary[];
  }

  const snapshot = await getDocs(query(
    collection(db, TREES_COLLECTION),
    where('discoverable', '==', true),
    where('searchKeywords', 'array-contains', keyword),
    limit(12),
  ));

  const trees = snapshot.docs
    .map(mapTree)
    .filter((tree) => tree.ownerId !== actorUserId && !tree.memberIds.includes(actorUserId));
  const owners = await Promise.all(trees.map((tree) => getUserProfileByIdOptional(tree.ownerId)));
  const normalizedSearch = normaliseSearchValue(trimmedSearchTerm);

  return trees
    .map((tree, index) => {
      const candidateValues = [
        tree.name,
        ...tree.surnameVariantGroups.flatMap((group) => [group.primarySurname, ...group.variants]),
      ];
      const matchedLabel = candidateValues.find((value) => normaliseSearchValue(value).includes(normalizedSearch)) ?? tree.name;
      const matchedBy = normaliseSearchValue(tree.name).includes(normalizedSearch) ? 'tree-name' : 'surname';
      return buildDiscoverableTreeSummary(tree, owners[index], matchedBy, matchedLabel);
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function searchDiscoverableTreesByOwnerUsername(username: string, actorUserId: string) {
  const trimmedUsername = username.trim().toLowerCase();
  if (!trimmedUsername) {
    return [] as DiscoverableTreeSummary[];
  }

  const targetUser = await findUserByUsernameExact(trimmedUsername);
  const treeSnapshot = await getDocs(query(
    collection(db, TREES_COLLECTION),
    where('ownerId', '==', targetUser.id),
    where('discoverable', '==', true),
    limit(12),
  ));

  return treeSnapshot.docs
    .map(mapTree)
    .filter((tree) => tree.ownerId !== actorUserId && !tree.memberIds.includes(actorUserId))
    .map((tree) => buildDiscoverableTreeSummary(tree, targetUser, 'username', targetUser.username?.trim() || trimmedUsername))
    .sort((left, right) => left.name.localeCompare(right.name));
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

  await Promise.all(
    tree.connectedTreeIds.map(async (connectedTreeId) => {
      const connectedTreeRef = doc(db, TREES_COLLECTION, connectedTreeId);
      const connectedTreeSnapshot = await getDoc(connectedTreeRef);
      if (!connectedTreeSnapshot.exists()) {
        return;
      }

      const connectedTree = mapTreeData(connectedTreeSnapshot.id, connectedTreeSnapshot.data());
      await updateDoc(connectedTreeRef, {
        connectedTreeIds: connectedTree.connectedTreeIds.filter((treeId) => treeId !== tree.id),
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
  newPhotos: NewPersonPhotoInput[],
): Promise<PersonRecord> {
  const personRef = doc(collection(db, PEOPLE_COLLECTION));
  const timestamp = nowIso();
  const newPhotoUris = newPhotos.map((photo) => photo.uri);
  await validatePersonCreation(treeId, {
    firstName: input.firstName,
    middleNames: input.middleNames ?? '',
    lastName: input.lastName,
    maidenName: input.maidenName ?? '',
    birthDate: input.birthDate,
    deathDate: input.deathDate,
    notes: input.notes,
    lifeEvents: input.lifeEvents,
  }, newPhotoUris);

  let uploadedPhotos: PersonPhoto[] = [];
  let preferredDisplayPhoto: { url: string; path: string } | null = null;

  try {
    uploadedPhotos = await uploadPersonPhotos(actorUserId, treeId, personRef.id, newPhotos);
    const preferredPhotoId = resolvePreferredPhotoId(input.preferredPhotoRef, [], newPhotoUris, uploadedPhotos);
    const preferredPhotoSourceUri = resolvePreferredPhotoSourceUri(input.preferredPhotoRef, [], newPhotos);
    preferredDisplayPhoto = preferredPhotoId && preferredPhotoSourceUri && input.cropPreferredPhotoRef === input.preferredPhotoRef
      ? await uploadPreferredPhotoDisplayVariant(actorUserId, treeId, personRef.id, preferredPhotoId, preferredPhotoSourceUri)
      : null;
    const nextPhotos = applyPreferredPhotoDisplayVariant(uploadedPhotos, preferredPhotoId, preferredDisplayPhoto);

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
      hometown: input.hometown?.trim() ?? '',
      birthPlace: input.birthPlace?.trim() ?? '',
      surnameVariantHints: Array.isArray(input.surnameVariantHints)
        ? [...new Set(input.surnameVariantHints.map((value) => value.trim()).filter(Boolean))]
        : [],
      canonicalPersonId: '',
      duplicatePersonIds: [],
      birthDate: input.birthDate.trim(),
      deathDate: input.deathDate.trim(),
      gender: input.gender,
      notes: input.notes.trim(),
      lifeEvents: normaliseLifeEvents(input.lifeEvents),
      photos: nextPhotos,
      preferredPhotoId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await setDoc(personRef, person);
    return { id: personRef.id, ...person };
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
