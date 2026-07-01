import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ApprovalRequest } from '../components/dto/approval';
import type { MergeConflictChoice, MergeHistoryRecord, MergeRequestRecord } from '../components/dto/merge';
import type { AppNotification, NotificationActivityState } from '../components/dto/notification';
import type { NewPersonPhotoInput, PersonInput, PersonMutationPayload, PersonRecord } from '../components/dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from '../components/dto/relationship';
import type { CollaboratorRole, FamilyTree, SurnameVariantGroup } from '../components/dto/tree';
import type { UserProfile } from '../components/dto/user';
import {
  addCollaboratorToTree,
  assignTreePersonToUser,
  clearTreePersonAssignment,
  cancelTreeAccessRequest,
  createSuggestedSurnameTree,
  createMergeRequest,
  createParentChildRelationship,
  createPerson,
  createSpouseRelationship,
  createTree,
  decideApprovalRequest,
  deletePerson,
  deleteRelationship,
  deleteTree,
  getMergePreview,
  grantMergeRequesterViewerAccess,
  markNotificationActivityActioned,
  markNotificationOpened,
  markNotificationSeen,
  processExpiredApprovalRequests,
  requestAccessFromIdentifier,
  requestAccessToTree,
  removeCollaboratorFromTree,
  respondToTreeAccessRequest,
  respondToMergeInvite,
  reviewMergeRequest,
  searchDiscoverableTrees,
  searchDiscoverableTreesByOwnerUsername,
  sendMergeInviteByIdentifier,
  type DiscoverableTreeSummary,
  subscribeToApprovalRequests,
  subscribeToMergeHistory,
  subscribeToMergeRequests,
  subscribeToNotifications,
  subscribeToNotificationActivityStates,
  subscribeToPeople,
  subscribeToRelationships,
  subscribeToTrees,
  undoMergeRequest,
  updateRelationship,
  updatePerson,
  updateSurnameVariantGroups,
  updateTreeApprovalWindow,
  updateTreeDiscoverability,
  updateTreeName,
} from '../providers/family-tree-service';

let unsubscribeTrees: (() => void) | null = null;
let unsubscribePeople: (() => void) | null = null;
let unsubscribeRelationships: (() => void) | null = null;
let unsubscribeApprovalRequests: (() => void) | null = null;
let unsubscribeMergeRequests: (() => void) | null = null;
let unsubscribeMergeHistory: (() => void) | null = null;
let unsubscribeNotifications: (() => void) | null = null;
let unsubscribeNotificationActivity: (() => void) | null = null;
let subscribedTreeId: string | null = null;
const expiryProcessingTreeIds = new Set<string>();
const TREE_STORE_STORAGE_KEY = 'lineagetree-tree-store';
const TREE_STORE_CACHE_VERSION = 2;

function normaliseError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

function haveSameRecordVersions<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  currentRecords: T[],
  nextRecords: T[],
  getVersion = (record: T) => record.updatedAt ?? record.createdAt ?? '',
) {
  if (currentRecords.length !== nextRecords.length) {
    return false;
  }

  return currentRecords.every((currentRecord, index) => {
    const nextRecord = nextRecords[index];
    return currentRecord.id === nextRecord.id && getVersion(currentRecord) === getVersion(nextRecord);
  });
}

function getRelationshipVersion(relationship: RelationshipRecord) {
  return [
    relationship.createdAt,
    relationship.type,
    relationship.fromPersonId,
    relationship.toPersonId,
    relationship.relationshipStatus ?? '',
    relationship.parentChildKind ?? '',
  ].join(':');
}

function stopTreeSubscriptions() {
  unsubscribePeople?.();
  unsubscribeRelationships?.();
  unsubscribeApprovalRequests?.();
  unsubscribeMergeRequests?.();
  unsubscribeMergeHistory?.();
  unsubscribePeople = null;
  unsubscribeRelationships = null;
  unsubscribeApprovalRequests = null;
  unsubscribeMergeRequests = null;
  unsubscribeMergeHistory = null;
  if (subscribedTreeId) {
    expiryProcessingTreeIds.delete(subscribedTreeId);
  }
  subscribedTreeId = null;
}

function stopAllSubscriptions() {
  unsubscribeTrees?.();
  unsubscribeTrees = null;
  unsubscribeNotifications?.();
  unsubscribeNotifications = null;
  unsubscribeNotificationActivity?.();
  unsubscribeNotificationActivity = null;
  stopTreeSubscriptions();
}

interface TreeState {
  trees: FamilyTree[];
  selectedTreeId: string | null;
  currentUserId: string | null;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  approvalRequests: ApprovalRequest[];
  mergeRequests: MergeRequestRecord[];
  mergeHistory: MergeHistoryRecord[];
  notifications: AppNotification[];
  notificationActivityStates: NotificationActivityState[];
  mergePreview: Awaited<ReturnType<typeof getMergePreview>> | null;
  loadingTrees: boolean;
  loadingTreeData: boolean;
  mutating: boolean;
  error: string | null;
  notice: string | null;
  syncFamilyData: (userId: string | null) => void;
  selectTree: (treeId: string | null) => void;
  createTree: (owner: Pick<UserProfile, 'id' | 'email' | 'displayName'>, name: string) => Promise<FamilyTree>;
  createTreeFromSurname: (owner: Pick<UserProfile, 'id' | 'email' | 'displayName'>, sourceTreeId: string, surname: string) => Promise<FamilyTree>;
  renameTree: (treeId: string, name: string) => Promise<void>;
  setTreeDiscoverability: (treeId: string, discoverable: boolean) => Promise<void>;
  setApprovalWindowHours: (treeId: string, hours: number) => Promise<void>;
  setSurnameVariantGroups: (treeId: string, groups: SurnameVariantGroup[]) => Promise<void>;
  addCollaborator: (treeId: string, email: string, role: CollaboratorRole) => Promise<void>;
  removeCollaborator: (treeId: string, collaboratorUserId: string) => Promise<void>;
  removeTree: (tree: FamilyTree) => Promise<void>;
  createPerson: (ownerId: string, treeId: string, input: PersonInput, newPhotos: NewPersonPhotoInput[]) => Promise<PersonRecord>;
  updatePerson: (ownerId: string, person: PersonRecord, input: PersonMutationPayload) => Promise<void>;
  removePerson: (actorUserId: string, person: PersonRecord) => Promise<void>;
  addParentChildRelationship: (ownerId: string, treeId: string, parentId: string, childId: string, parentChildKind?: ParentChildRelationshipKind) => Promise<void>;
  addSpouseRelationship: (ownerId: string, treeId: string, personAId: string, personBId: string, relationshipStatus?: SpouseRelationshipStatus) => Promise<void>;
  editRelationship: (actorUserId: string, relationship: RelationshipRecord, updates: { relationshipStatus?: SpouseRelationshipStatus; parentChildKind?: ParentChildRelationshipKind }) => Promise<void>;
  removeRelationship: (actorUserId: string, relationshipId: string) => Promise<void>;
  approveApprovalRequest: (actorUserId: string, requestId: string) => Promise<void>;
  rejectApprovalRequest: (actorUserId: string, requestId: string) => Promise<void>;
  createMergeRequest: (actorUserId: string, sourceTreeId: string, targetTreeId: string) => Promise<void>;
  sendMergeInvite: (actorUserId: string, sourceTreeId: string, identifier: string) => Promise<void>;
  respondToMergeInvite: (actorUserId: string, notificationId: string, status: 'accepted' | 'dismissed') => Promise<void>;
  requestTreeAccess: (actorUserId: string, treeId: string) => Promise<void>;
  requestTreeAccessByIdentifier: (actorUserId: string, identifier: string) => Promise<void>;
  cancelTreeAccessRequest: (actorUserId: string, notificationId: string) => Promise<void>;
  respondToTreeAccessRequest: (actorUserId: string, notificationId: string, status: 'accepted' | 'rejected') => Promise<void>;
  searchDiscoverableTrees: (searchTerm: string, actorUserId: string) => Promise<DiscoverableTreeSummary[]>;
  searchDiscoverableTreesByUsername: (username: string, actorUserId: string) => Promise<DiscoverableTreeSummary[]>;
  markNotificationSeen: (actorUserId: string, notificationId: string) => Promise<void>;
  markNotificationOpened: (actorUserId: string, notificationId: string) => Promise<void>;
  markNotificationActivityActioned: (actorUserId: string, sourceKind: NotificationActivityState['sourceKind'], sourceId: string) => Promise<void>;
  loadMergePreview: (sourceTreeId: string, targetTreeId: string) => Promise<void>;
  approveMergeRequest: (actorUserId: string, requestId: string, comment?: string, selectedMatchIds?: string[], conflictChoices?: MergeConflictChoice[]) => Promise<void>;
  rejectMergeRequest: (actorUserId: string, requestId: string, comment?: string) => Promise<void>;
  requestMergeChanges: (actorUserId: string, requestId: string, comment?: string, selectedMatchIds?: string[], conflictChoices?: MergeConflictChoice[]) => Promise<void>;
  undoMerge: (actorUserId: string, requestId: string) => Promise<void>;
  grantMergeViewerAccess: (actorUserId: string, requestId: string, treeId: string) => Promise<void>;
  assignPersonToUser: (actorUserId: string, treeId: string, targetUserId: string, personId: string) => Promise<void>;
  assignSelfToPerson: (treeId: string, userId: string, personId: string) => Promise<void>;
  clearSelfAssignment: (treeId: string, userId: string) => Promise<void>;
  clearError: () => void;
  clearNotice: () => void;
  reset: () => void;
}

type PersistedTreeState = Pick<
  TreeState,
  'currentUserId' | 'trees' | 'selectedTreeId'
>;

export const useTreeStore = create<TreeState>()(persist((set, get) => {
  const subscribeToTreeData = (treeId: string | null) => {
    if (treeId && subscribedTreeId === treeId && get().trees.some((tree) => tree.id === treeId)) {
      set({ selectedTreeId: treeId, loadingTreeData: false });
      return;
    }

    stopTreeSubscriptions();

    if (!treeId) {
      set({ people: [], relationships: [], approvalRequests: [], mergeRequests: [], mergeHistory: [], mergePreview: null, loadingTreeData: false });
      return;
    }

    subscribedTreeId = treeId;
    set({ people: [], relationships: [], approvalRequests: [], mergeRequests: [], mergeHistory: [], mergePreview: null, loadingTreeData: true });
    let hasLoadedPeople = false;
    let hasLoadedRelationships = false;

    const updateInitialLoadState = () => {
      if (hasLoadedPeople && hasLoadedRelationships) {
        set({ loadingTreeData: false });
      }
    };

    unsubscribePeople = subscribeToPeople(
      treeId,
      (people) => {
        hasLoadedPeople = true;
        if (!haveSameRecordVersions(get().people, people)) {
          set({ people });
        }
        updateInitialLoadState();
      },
      (error) => set({ error: normaliseError(error), loadingTreeData: false }),
    );

    unsubscribeRelationships = subscribeToRelationships(
      treeId,
      (relationships) => {
        hasLoadedRelationships = true;
        if (!haveSameRecordVersions(get().relationships, relationships, getRelationshipVersion)) {
          set({ relationships });
        }
        updateInitialLoadState();
      },
      (error) => set({ error: normaliseError(error), loadingTreeData: false }),
    );

    unsubscribeApprovalRequests = subscribeToApprovalRequests(
      treeId,
      (approvalRequests) => {
        if (!haveSameRecordVersions(get().approvalRequests, approvalRequests)) {
          set({ approvalRequests });
        }
        const currentUserId = get().currentUserId;
        const currentTree = get().trees.find((tree) => tree.id === treeId) ?? null;
        const canProcessExpirations = Boolean(
          currentUserId
          && currentTree
          && Array.isArray(currentTree.editorIds)
          && currentTree.editorIds.includes(currentUserId),
        );
        const hasExpiredPendingRequests = approvalRequests.some(
          (request) => request.status === 'pending' && request.expiresAtMillis <= Date.now(),
        );

        if (currentUserId && canProcessExpirations && hasExpiredPendingRequests && !expiryProcessingTreeIds.has(treeId)) {
          expiryProcessingTreeIds.add(treeId);
          processExpiredApprovalRequests(currentUserId, treeId)
            .catch((error) => set({ error: normaliseError(error) }))
            .finally(() => {
              expiryProcessingTreeIds.delete(treeId);
            });
        }
      },
      (error) => set({ error: normaliseError(error) }),
    );

    unsubscribeMergeRequests = subscribeToMergeRequests(
      treeId,
      (mergeRequests) => {
        if (!haveSameRecordVersions(get().mergeRequests, mergeRequests)) {
          set({ mergeRequests });
        }
      },
      (error) => set({ error: normaliseError(error) }),
    );

    unsubscribeMergeHistory = subscribeToMergeHistory(
      treeId,
      (mergeHistory) => {
        if (!haveSameRecordVersions(get().mergeHistory, mergeHistory)) {
          set({ mergeHistory });
        }
      },
      (error) => set({ error: normaliseError(error) }),
    );
  };

  return {
    trees: [],
    selectedTreeId: null,
    currentUserId: null,
    people: [],
    relationships: [],
    approvalRequests: [],
    mergeRequests: [],
    mergeHistory: [],
    notifications: [],
    notificationActivityStates: [],
    mergePreview: null,
    loadingTrees: true,
    loadingTreeData: false,
    mutating: false,
    error: null,
    notice: null,

    syncFamilyData: (userId) => {
      stopAllSubscriptions();

      if (!userId) {
        set({
          trees: [],
          selectedTreeId: null,
          currentUserId: null,
          people: [],
          relationships: [],
          approvalRequests: [],
          mergeRequests: [],
          mergeHistory: [],
          notifications: [],
          notificationActivityStates: [],
          mergePreview: null,
          loadingTrees: false,
          loadingTreeData: false,
          mutating: false,
          error: null,
          notice: null,
        });
        return;
      }

      const state = get();
      const hasCachedTrees = state.currentUserId === userId && state.trees.length > 0;
      const hasCachedTreeSelection = hasCachedTrees
        && Boolean(state.selectedTreeId)
        && state.people.length > 0;

      if (state.currentUserId !== userId) {
        set({
          currentUserId: userId,
          trees: [],
          selectedTreeId: null,
          people: [],
          relationships: [],
          approvalRequests: [],
          mergeRequests: [],
          mergeHistory: [],
          mergePreview: null,
          loadingTrees: true,
          loadingTreeData: false,
          error: null,
          notice: null,
        });
      } else {
        set({
          currentUserId: userId,
          loadingTrees: !hasCachedTrees,
          loadingTreeData: false,
          error: null,
          notice: null,
        });
      }

      unsubscribeTrees = subscribeToTrees(
        userId,
        (trees) => {
          const currentState = get();
          const previousSelectedTreeId = currentState.selectedTreeId;
          const nextSelectedTreeId = trees.some((tree) => tree.id === previousSelectedTreeId)
            ? previousSelectedTreeId
            : trees[0]?.id ?? null;

          const nextState: Partial<TreeState> = {
            selectedTreeId: nextSelectedTreeId,
            loadingTrees: false,
          };

          if (!haveSameRecordVersions(currentState.trees, trees)) {
            nextState.trees = trees;
          }

          if (
            currentState.loadingTrees
            || currentState.selectedTreeId !== nextSelectedTreeId
            || nextState.trees
          ) {
            set(nextState);
          }

          if (nextSelectedTreeId !== previousSelectedTreeId || (nextSelectedTreeId && subscribedTreeId !== nextSelectedTreeId)) {
            subscribeToTreeData(nextSelectedTreeId);
          }
        },
        (error) => set({ error: normaliseError(error), loadingTrees: false }),
      );

      if (hasCachedTreeSelection && state.selectedTreeId) {
        set({ loadingTreeData: false });
      }

      unsubscribeNotifications = subscribeToNotifications(
        userId,
        (notifications) => {
          if (!haveSameRecordVersions(get().notifications, notifications)) {
            set({ notifications });
          }
        },
        (error) => set({ error: normaliseError(error) }),
      );
      unsubscribeNotificationActivity = subscribeToNotificationActivityStates(
        userId,
        (notificationActivityStates) => {
          if (!haveSameRecordVersions(get().notificationActivityStates, notificationActivityStates)) {
            set({ notificationActivityStates });
          }
        },
        (error) => set({ error: normaliseError(error) }),
      );
    },

    selectTree: (treeId) => {
      if (
        get().selectedTreeId === treeId
        && subscribedTreeId === treeId
        && (treeId === null || get().trees.some((tree) => tree.id === treeId))
      ) {
        return;
      }

      set({ selectedTreeId: treeId });
      subscribeToTreeData(treeId);
    },

    createTree: async (owner, name) => {
      set({ mutating: true, error: null });
      try {
        const tree = await createTree(owner, name);
        set({ selectedTreeId: tree.id, mutating: false });
        subscribeToTreeData(tree.id);
        return tree;
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    createTreeFromSurname: async (owner, sourceTreeId, surname) => {
      set({ mutating: true, error: null });
      try {
        const tree = await createSuggestedSurnameTree(owner, sourceTreeId, surname);
        set({ mutating: false, notice: 'Surname tree created.' });
        return tree;
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    renameTree: async (treeId, name) => {
      set({ mutating: true, error: null });
      try {
        await updateTreeName(treeId, name);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    setTreeDiscoverability: async (treeId, discoverable) => {
      set({ mutating: true, error: null });
      try {
        await updateTreeDiscoverability(treeId, discoverable);
        set({ mutating: false, notice: discoverable ? 'Tree discoverability turned on.' : 'Tree discoverability turned off.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    setApprovalWindowHours: async (treeId, hours) => {
      set({ mutating: true, error: null });
      try {
        await updateTreeApprovalWindow(treeId, hours);
        set({ mutating: false, notice: 'Approval window updated.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    setSurnameVariantGroups: async (treeId, groups) => {
      set({ mutating: true, error: null });
      try {
        await updateSurnameVariantGroups(treeId, groups);
        set({ mutating: false, notice: 'Surname variants updated.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    addCollaborator: async (treeId, email, role) => {
      set({ mutating: true, error: null });
      try {
        await addCollaboratorToTree(treeId, email, role);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    removeCollaborator: async (treeId, collaboratorUserId) => {
      set({ mutating: true, error: null });
      try {
        await removeCollaboratorFromTree(treeId, collaboratorUserId);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    removeTree: async (tree) => {
      set({ mutating: true, error: null });
      try {
        await deleteTree(tree);
        if (get().selectedTreeId === tree.id) {
          set({ selectedTreeId: null, people: [], relationships: [] });
          stopTreeSubscriptions();
        }
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    createPerson: async (ownerId, treeId, input, newPhotos) => {
      set({ mutating: true, error: null });
      try {
        const person = await createPerson(ownerId, treeId, input, newPhotos);
        set({ mutating: false });
        return person;
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    updatePerson: async (ownerId, person, input) => {
      set({ mutating: true, error: null });
      try {
        const result = await updatePerson(ownerId, person, input);
        set({ mutating: false, notice: result.message });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    removePerson: async (actorUserId, person) => {
      set({ mutating: true, error: null });
      try {
        const result = await deletePerson(actorUserId, person);
        set({ mutating: false, notice: result.message });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    addParentChildRelationship: async (ownerId, treeId, parentId, childId, parentChildKind) => {
      set({ mutating: true, error: null });
      try {
        const result = await createParentChildRelationship(ownerId, treeId, parentId, childId, parentChildKind);
        set({ mutating: false, notice: result.message });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    addSpouseRelationship: async (ownerId, treeId, personAId, personBId, relationshipStatus) => {
      set({ mutating: true, error: null });
      try {
        const result = await createSpouseRelationship(ownerId, treeId, personAId, personBId, relationshipStatus);
        set({ mutating: false, notice: result.message });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    editRelationship: async (actorUserId, relationship, updates) => {
      set({ mutating: true, error: null });
      try {
        const result = await updateRelationship(actorUserId, relationship, updates);
        set({ mutating: false, notice: result.message });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    removeRelationship: async (actorUserId, relationshipId) => {
      set({ mutating: true, error: null });
      try {
        const result = await deleteRelationship(actorUserId, relationshipId);
        set({ mutating: false, notice: result.message });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    approveApprovalRequest: async (actorUserId, requestId) => {
      set({ mutating: true, error: null });
      try {
        await decideApprovalRequest(actorUserId, requestId, 'approve');
        set({ mutating: false, notice: 'Approval request approved.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    rejectApprovalRequest: async (actorUserId, requestId) => {
      set({ mutating: true, error: null });
      try {
        await decideApprovalRequest(actorUserId, requestId, 'reject');
        set({ mutating: false, notice: 'Approval request rejected.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    createMergeRequest: async (actorUserId, sourceTreeId, targetTreeId) => {
      set({ mutating: true, error: null });
      try {
        await createMergeRequest(actorUserId, sourceTreeId, targetTreeId);
        set({ mutating: false, notice: 'Merge request submitted for review.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    sendMergeInvite: async (actorUserId, sourceTreeId, identifier) => {
      set({ mutating: true, error: null });
      try {
        await sendMergeInviteByIdentifier(actorUserId, sourceTreeId, identifier);
        set({ mutating: false, notice: 'Merge invitation sent.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    requestTreeAccess: async (actorUserId, treeId) => {
      set({ mutating: true, error: null });
      try {
        await requestAccessToTree(actorUserId, treeId);
        set({ mutating: false, notice: 'Access request sent.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    requestTreeAccessByIdentifier: async (actorUserId, identifier) => {
      set({ mutating: true, error: null });
      try {
        await requestAccessFromIdentifier(actorUserId, identifier);
        set({ mutating: false, notice: 'Access request sent.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    cancelTreeAccessRequest: async (actorUserId, notificationId) => {
      set({ mutating: true, error: null });
      try {
        await cancelTreeAccessRequest(actorUserId, notificationId);
        set({ mutating: false, notice: 'Access request cancelled.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    respondToMergeInvite: async (actorUserId, notificationId, status) => {
      set({ mutating: true, error: null });
      try {
        await respondToMergeInvite(actorUserId, notificationId, status);
        set({ mutating: false, notice: status === 'accepted' ? 'Merge invitation accepted.' : 'Merge invitation dismissed.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    respondToTreeAccessRequest: async (actorUserId, notificationId, status) => {
      set({ mutating: true, error: null });
      try {
        await respondToTreeAccessRequest(actorUserId, notificationId, status);
        set({ mutating: false, notice: status === 'accepted' ? 'Access request approved.' : 'Access request declined.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    searchDiscoverableTrees: async (searchTerm, actorUserId) => {
      set({ error: null });
      try {
        return await searchDiscoverableTrees(searchTerm, actorUserId);
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    searchDiscoverableTreesByUsername: async (username, actorUserId) => {
      set({ error: null });
      try {
        return await searchDiscoverableTreesByOwnerUsername(username, actorUserId);
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    markNotificationSeen: async (actorUserId, notificationId) => {
      set({ mutating: true, error: null });
      try {
        await markNotificationSeen(actorUserId, notificationId);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    markNotificationOpened: async (actorUserId, notificationId) => {
      set({ mutating: true, error: null });
      try {
        await markNotificationOpened(actorUserId, notificationId);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    markNotificationActivityActioned: async (actorUserId, sourceKind, sourceId) => {
      set({ mutating: true, error: null });
      try {
        await markNotificationActivityActioned(actorUserId, sourceKind, sourceId);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    loadMergePreview: async (sourceTreeId, targetTreeId) => {
      set({ mutating: true, error: null });
      try {
        const preview = await getMergePreview(sourceTreeId, targetTreeId);
        set({ mutating: false, mergePreview: preview });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    approveMergeRequest: async (actorUserId, requestId, comment, selectedMatchIds, conflictChoices) => {
      set({ mutating: true, error: null });
      try {
        await reviewMergeRequest(actorUserId, requestId, 'approve', comment, conflictChoices, selectedMatchIds);
        set({ mutating: false, notice: 'Merge request approved.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    rejectMergeRequest: async (actorUserId, requestId, comment) => {
      set({ mutating: true, error: null });
      try {
        await reviewMergeRequest(actorUserId, requestId, 'reject', comment);
        set({ mutating: false, notice: 'Merge request rejected.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    requestMergeChanges: async (actorUserId, requestId, comment, selectedMatchIds, conflictChoices) => {
      set({ mutating: true, error: null });
      try {
        await reviewMergeRequest(actorUserId, requestId, 'request-changes', comment, conflictChoices, selectedMatchIds);
        set({ mutating: false, notice: 'Changes requested for merge.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    undoMerge: async (actorUserId, requestId) => {
      set({ mutating: true, error: null });
      try {
        await undoMergeRequest(actorUserId, requestId);
        set({ mutating: false, notice: 'Merge undo applied.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    grantMergeViewerAccess: async (actorUserId, requestId, treeId) => {
      set({ mutating: true, error: null });
      try {
        await grantMergeRequesterViewerAccess(actorUserId, requestId, treeId);
        set({ mutating: false, notice: 'Viewer access granted.' });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    assignPersonToUser: async (actorUserId, treeId, targetUserId, personId) => {
      set({ mutating: true, error: null });
      try {
        await assignTreePersonToUser(actorUserId, treeId, targetUserId, personId);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    assignSelfToPerson: async (treeId, userId, personId) => {
      await get().assignPersonToUser(userId, treeId, userId, personId);
    },

    clearSelfAssignment: async (treeId, userId) => {
      set({ mutating: true, error: null });
      try {
        await clearTreePersonAssignment(treeId, userId);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    clearError: () => set({ error: null }),

    clearNotice: () => set({ notice: null }),

    reset: () => {
      stopAllSubscriptions();
      set({
        trees: [],
        selectedTreeId: null,
        currentUserId: null,
        people: [],
        relationships: [],
        approvalRequests: [],
        mergeRequests: [],
        mergeHistory: [],
        notifications: [],
        notificationActivityStates: [],
        mergePreview: null,
        loadingTrees: false,
        loadingTreeData: false,
        mutating: false,
        error: null,
        notice: null,
      });
    },
  };
}, {
  name: TREE_STORE_STORAGE_KEY,
  version: TREE_STORE_CACHE_VERSION,
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state): PersistedTreeState => ({
    currentUserId: state.currentUserId,
    trees: state.trees,
    selectedTreeId: state.selectedTreeId,
  }),
}));
