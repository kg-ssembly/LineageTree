import { subscribeToTreeGraph } from '../providers/tree-graph-service';
import { trackOperation } from './operation-store';
import { selectiveStorage } from './selective-storage';
import { startMetric, finishMetric } from '../components/performance-metrics';
import { useSyncStatusStore } from './sync-status-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { createJSONStorage as createJSONStorageFn, persist as persistFn } from 'zustand/middleware';
import type { ApprovalRequest } from '../components/dto/approval';
import type { MergeConflictChoice, MergeHistoryRecord, MergeRequestRecord } from '../components/dto/merge';
import type { AppNotification, NotificationActivityState } from '../components/dto/notification';
import type { NewPersonPhotoInput, PersonInput, PersonMutationPayload, PersonRecord } from '../components/dto/person';
import type { PendingRelationshipSubmission } from '../components/person-form-dialog';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from '../components/dto/relationship';
import type { CollaboratorRole, FamilyTree, KinshipSystem, SurnameVariantGroup } from '../components/dto/tree';
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
  createPersonWithRelationships,
  createSpouseRelationship,
  createTree,
  decideApprovalRequest,
  deletePerson,
  deleteAllNotifications,
  deleteNotification,
  deleteNotificationActivity,
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
  updateTreeKinshipSystem,
  updateTreeName,
} from '../providers/family-tree-service';

const { createJSONStorage, persist } = require('zustand/middleware') as {
  createJSONStorage: typeof createJSONStorageFn;
  persist: typeof persistFn;
};

let unsubscribeTrees: (() => void) | null = null;
let unsubscribePeople: (() => void) | null = null;
let unsubscribeRelationships: (() => void) | null = null;
let unsubscribeApprovalRequests: (() => void) | null = null;
let unsubscribeMergeRequests: (() => void) | null = null;
let unsubscribeMergeHistory: (() => void) | null = null;
let unsubscribeNotifications: (() => void) | null = null;
let unsubscribeNotificationActivity: (() => void) | null = null;
let subscribedTreeId: string | null = null;
let subscribedPrimaryIds = '';
let subscribedTreeAuxiliaryId: string | null = null;
const expiryProcessingTreeIds = new Set<string>();
const TREE_STORE_STORAGE_KEY = 'lineagetree-tree-store';
const TREE_STORE_CACHE_VERSION = 3;

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
  subscribedTreeAuxiliaryId = null;
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
  graphMore: Record<string, string | null>;
  graphRelatives: Record<string, { parents: string[]; children: string[] }>;
  graphTotalPeople: number;
  graphComplete: boolean;
  trees: FamilyTree[];
  selectedTreeId: string | null;
  currentUserId: string | null;
  people: PersonRecord[];
  treeDataTreeId: string | null;
  relationships: RelationshipRecord[];
  approvalRequests: ApprovalRequest[];
  mergeRequests: MergeRequestRecord[];
  mergeHistory: MergeHistoryRecord[];
  notifications: AppNotification[];
  notificationActivityStates: NotificationActivityState[];
  mergePreview: Awaited<ReturnType<typeof getMergePreview>> | null;
  loadingTrees: boolean;
  loadingTreeData: boolean;
  loadingNotifications: boolean;
  mutating: boolean;
  error: string | null;
  notice: string | null;
  syncFamilyData: (userId: string | null) => void;
  ensureTreeAuxiliaryData: (treeId: string | null) => void;
  selectTree: (treeId: string | null) => void;
  createTree: (owner: Pick<UserProfile, 'id' | 'email' | 'displayName'>, name: string) => Promise<FamilyTree>;
  createTreeFromSurname: (owner: Pick<UserProfile, 'id' | 'email' | 'displayName'>, sourceTreeId: string, surname: string) => Promise<FamilyTree>;
  renameTree: (treeId: string, name: string) => Promise<void>;
  setTreeDiscoverability: (treeId: string, discoverable: boolean) => Promise<void>;
  setApprovalWindowHours: (treeId: string, hours: number) => Promise<void>;
  setTreeKinshipSystem: (treeId: string, kinshipSystem: KinshipSystem) => Promise<void>;
  setSurnameVariantGroups: (treeId: string, groups: SurnameVariantGroup[]) => Promise<void>;
  addCollaborator: (actorUserId: string, treeId: string, email: string, role: CollaboratorRole) => Promise<void>;
  removeCollaborator: (actorUserId: string, treeId: string, collaboratorUserId: string) => Promise<void>;
  removeTree: (tree: FamilyTree) => Promise<void>;
  createPerson: (ownerId: string, treeId: string, input: PersonInput, newPhotos: NewPersonPhotoInput[]) => Promise<PersonRecord>;
  createPersonWithRelationships: (
    ownerId: string,
    treeId: string,
    input: PersonInput,
    newPhotos: NewPersonPhotoInput[],
    pendingRelationships: PendingRelationshipSubmission[],
    options?: {
      forceImmediateApproval?: boolean;
    },
  ) => Promise<PersonRecord | null>;
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
  deleteNotification: (actorUserId: string, notificationId: string) => Promise<void>;
  deleteNotificationActivity: (actorUserId: string, sourceKind: NotificationActivityState['sourceKind'], sourceId: string) => Promise<void>;
  deleteAllNotifications: (
    actorUserId: string,
    notificationIds: string[],
    activityTargets: Array<{ sourceKind: NotificationActivityState['sourceKind']; sourceId: string }>,
  ) => Promise<void>;
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
  'currentUserId' | 'trees' | 'selectedTreeId' | 'treeDataTreeId' | 'people' | 'relationships'
>;

export const useTreeStore = create<TreeState>()(persist((set, get) => {
  const notificationSourceLoaded = new Set<string>();
  const resetNotificationSourceLoadState = () => {
    notificationSourceLoaded.clear();
    set({ loadingNotifications: true });
  };
  const markNotificationSourceLoaded = (source: string) => {
    notificationSourceLoaded.add(source);
    if (['notifications', 'activity', 'approvalRequests', 'mergeRequests', 'mergeHistory'].every((key) => notificationSourceLoaded.has(key))) {
      set({ loadingNotifications: false });
    }
  };

  const subscribeToTreeAuxiliaryData = (treeId: string | null) => {
    if (!treeId || subscribedTreeId !== treeId || subscribedTreeAuxiliaryId === treeId) {
      return;
    }

    unsubscribeApprovalRequests?.();
    unsubscribeMergeRequests?.();
    unsubscribeMergeHistory?.();
    unsubscribeApprovalRequests = null;
    unsubscribeMergeRequests = null;
    unsubscribeMergeHistory = null;
    subscribedTreeAuxiliaryId = treeId;

    unsubscribeApprovalRequests = subscribeToApprovalRequests(
      treeId,
      (approvalRequests) => {
        markNotificationSourceLoaded('approvalRequests');
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
      (error) => { markNotificationSourceLoaded('approvalRequests'); set({ error: normaliseError(error) }); },
    );

    unsubscribeMergeRequests = subscribeToMergeRequests(
      treeId,
      (mergeRequests) => {
        markNotificationSourceLoaded('mergeRequests');
        if (!haveSameRecordVersions(get().mergeRequests, mergeRequests)) {
          set({ mergeRequests });
        }
      },
      (error) => { markNotificationSourceLoaded('mergeRequests'); set({ error: normaliseError(error) }); },
    );

    unsubscribeMergeHistory = subscribeToMergeHistory(
      treeId,
      (mergeHistory) => {
        markNotificationSourceLoaded('mergeHistory');
        if (!haveSameRecordVersions(get().mergeHistory, mergeHistory)) {
          set({ mergeHistory });
        }
      },
      (error) => { markNotificationSourceLoaded('mergeHistory'); set({ error: normaliseError(error) }); },
    );
  };

  const subscribeToTreeData = (treeId: string | null) => {
    const primaryIds = get().trees.map((tree) => tree.id).sort();
    if (treeId && subscribedTreeId === treeId && subscribedPrimaryIds === primaryIds.join(',') && get().trees.some((tree) => tree.id === treeId)) {
      set({ selectedTreeId: treeId, loadingTreeData: false });
      subscribeToTreeAuxiliaryData(treeId);
      return;
    }

    stopTreeSubscriptions();

    if (!treeId) {
      markNotificationSourceLoaded('approvalRequests');
      markNotificationSourceLoaded('mergeRequests');
      markNotificationSourceLoaded('mergeHistory');
      set({ people: [], relationships: [], approvalRequests: [], mergeRequests: [], mergeHistory: [], mergePreview: null, loadingTreeData: false });
      return;
    }

    subscribedTreeId = treeId;
    subscribedPrimaryIds = primaryIds.join(',');
    startMetric('tree.ready.ms');
    ['approvalRequests', 'mergeRequests', 'mergeHistory'].forEach((key) => notificationSourceLoaded.delete(key));
    set({ loadingNotifications: true });
    const keepCached = get().treeDataTreeId === treeId;
    set({ treeDataTreeId: treeId, people: keepCached ? get().people : [], relationships: keepCached ? get().relationships : [], approvalRequests: [], mergeRequests: [], mergeHistory: [], mergePreview: null, loadingTreeData: !keepCached });
    subscribeToTreeAuxiliaryData(treeId);
    set({graphMore: {}, graphRelatives: {}, graphTotalPeople: 0, graphComplete: false});
    unsubscribePeople = subscribeToTreeGraph(treeId, (page, complete) => {
      if (get().selectedTreeId !== treeId) return;
      set({ people: page.people, relationships: page.relationships, graphMore: page.more, graphRelatives: page.relatives ?? {}, graphTotalPeople: page.totalPeople ?? page.people.length, graphComplete: complete, loadingTreeData: false });
      finishMetric('tree.ready.ms');
    }, error => set({error: normaliseError(error), loadingTreeData: false}));

  };

  const initialState: TreeState = {
    graphMore: {}, graphRelatives: {}, graphTotalPeople: 0, graphComplete: false,
    trees: [],
    selectedTreeId: null,
    currentUserId: null,
    treeDataTreeId: null,
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
    loadingNotifications: true,
    mutating: false,
    error: null,
    notice: null,

    syncFamilyData: (userId) => {
      useSyncStatusStore.setState({ source: "connecting", sources: {}, pendingWrites: false });
      stopAllSubscriptions();

      if (!userId) {
        set({
          trees: [],
          selectedTreeId: null,
          currentUserId: null,
          treeDataTreeId: null,
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
          loadingNotifications: false,
          mutating: false,
          error: null,
          notice: null,
        });
        return;
      }

      const state = get();
      resetNotificationSourceLoadState();
      const hasCachedTrees = state.currentUserId === userId && state.trees.length > 0;
      const hasCachedTreeSelection = hasCachedTrees
        && Boolean(state.selectedTreeId)
        && state.people.length > 0;

      if (state.currentUserId !== userId) {
        set({
          currentUserId: userId,
          trees: [],
          selectedTreeId: null,
          treeDataTreeId: null,
    people: [],
          relationships: [],
          approvalRequests: [],
          mergeRequests: [],
          mergeHistory: [],
          mergePreview: null,
          loadingTrees: true,
          loadingTreeData: false,
          loadingNotifications: true,
          error: null,
          notice: null,
        });
      } else {
        set({
          currentUserId: userId,
          loadingTrees: !hasCachedTrees,
          loadingTreeData: false,
          loadingNotifications: true,
          error: null,
          notice: null,
        });
      }

      unsubscribeTrees = subscribeToTrees(
        userId,
        (trees) => {
          const currentState = get();
          if (useSyncStatusStore.getState().sources.trees?.source === 'cache' && !trees.length && currentState.trees.length) {
            set({ loadingTrees: false });
            if (currentState.selectedTreeId && !subscribedTreeId) subscribeToTreeData(currentState.selectedTreeId);
            return;
          }
          if (!trees.length) ['approvalRequests', 'mergeRequests', 'mergeHistory'].forEach(markNotificationSourceLoaded);
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

          if (nextSelectedTreeId !== previousSelectedTreeId || (nextSelectedTreeId && (subscribedTreeId !== nextSelectedTreeId || subscribedPrimaryIds !== trees.map((tree) => tree.id).sort().join(',')))) {
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
          markNotificationSourceLoaded('notifications');
          if (!haveSameRecordVersions(get().notifications, notifications)) {
            set({ notifications });
          }
        },
        (error) => { markNotificationSourceLoaded('notifications'); set({ error: normaliseError(error) }); },
      );
      unsubscribeNotificationActivity = subscribeToNotificationActivityStates(
        userId,
        (notificationActivityStates) => {
          markNotificationSourceLoaded('activity');
          if (!haveSameRecordVersions(get().notificationActivityStates, notificationActivityStates)) {
            set({ notificationActivityStates });
          }
        },
        (error) => { markNotificationSourceLoaded('activity'); set({ error: normaliseError(error) }); },
      );
    },

    ensureTreeAuxiliaryData: (treeId) => {
      subscribeToTreeAuxiliaryData(treeId);
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
      set({ error: null });
      try {
        const tree = await createTree(owner, name);
        set({ selectedTreeId: tree.id });
        subscribeToTreeData(tree.id);
        return tree;
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    createTreeFromSurname: async (owner, sourceTreeId, surname) => {
      set({ error: null });
      try {
        const tree = await createSuggestedSurnameTree(owner, sourceTreeId, surname);
        set({ notice: 'Surname tree created.' });
        return tree;
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    renameTree: async (treeId, name) => {
      set({ error: null });
      try {
        await updateTreeName(treeId, name);

      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    setTreeDiscoverability: async (treeId, discoverable) => {
      set({ error: null });
      try {
        await updateTreeDiscoverability(treeId, discoverable);
        set({ notice: discoverable ? 'Tree discoverability turned on.' : 'Tree discoverability turned off.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    setApprovalWindowHours: async (treeId, hours) => {
      set({ error: null });
      try {
        await updateTreeApprovalWindow(treeId, hours);
        set({ notice: 'Approval window updated.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    setTreeKinshipSystem: async (treeId, kinshipSystem) => {
      set({ error: null });
      try {
        await updateTreeKinshipSystem(treeId, kinshipSystem);
        set({ notice: 'Kinship terms updated.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    setSurnameVariantGroups: async (treeId, groups) => {
      set({ error: null });
      try {
        await updateSurnameVariantGroups(treeId, groups);
        set({ notice: 'Surname variants updated.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    addCollaborator: async (actorUserId, treeId, email, role) => {
      set({ error: null });
      try {
        await addCollaboratorToTree(actorUserId, treeId, email, role);
        set({ notice: 'Collaborator added. Invitation email sent.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    removeCollaborator: async (actorUserId, treeId, collaboratorUserId) => {
      set({ error: null });
      try {
        await removeCollaboratorFromTree(actorUserId, treeId, collaboratorUserId);

      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    removeTree: async (tree) => {
      set({ error: null });
      try {
        await deleteTree(tree);
        if (get().selectedTreeId === tree.id) {
          set({ selectedTreeId: null, people: [], relationships: [] });
          stopTreeSubscriptions();
        }

      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    createPerson: async (ownerId, treeId, input, newPhotos) => {
      set({ error: null });
      try {
        const person = await createPerson(ownerId, treeId, input, newPhotos);

        return person;
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    createPersonWithRelationships: async (ownerId, treeId, input, newPhotos, pendingRelationships, options) => {
      set({ error: null });
      try {
        const result = await createPersonWithRelationships(ownerId, treeId, input, newPhotos, pendingRelationships, options);
        set({ notice: result.message });
        return result.person ?? null;
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    updatePerson: async (ownerId, person, input) => {
      set({ error: null });
      try {
        const result = await updatePerson(ownerId, person, input);
        set({ notice: result.message });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    removePerson: async (actorUserId, person) => {
      set({ error: null });
      try {
        const result = await deletePerson(actorUserId, person);
        set({ notice: result.message });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    addParentChildRelationship: async (ownerId, treeId, parentId, childId, parentChildKind) => {
      set({ error: null });
      try {
        const result = await createParentChildRelationship(ownerId, treeId, parentId, childId, parentChildKind);
        set({ notice: result.message });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    addSpouseRelationship: async (ownerId, treeId, personAId, personBId, relationshipStatus) => {
      set({ error: null });
      try {
        const result = await createSpouseRelationship(ownerId, treeId, personAId, personBId, relationshipStatus);
        set({ notice: result.message });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    editRelationship: async (actorUserId, relationship, updates) => {
      set({ error: null });
      try {
        const result = await updateRelationship(actorUserId, relationship, updates);
        set({ notice: result.message });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    removeRelationship: async (actorUserId, relationshipId) => {
      set({ error: null });
      try {
        const result = await deleteRelationship(actorUserId, relationshipId);
        set({ notice: result.message });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    approveApprovalRequest: async (actorUserId, requestId) => {
      set({ error: null });
      try {
        await decideApprovalRequest(actorUserId, requestId, 'approve');
        set({ notice: 'Approval request approved.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    rejectApprovalRequest: async (actorUserId, requestId) => {
      set({ error: null });
      try {
        await decideApprovalRequest(actorUserId, requestId, 'reject');
        set({ notice: 'Approval request rejected.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    createMergeRequest: async (actorUserId, sourceTreeId, targetTreeId) => {
      set({ error: null });
      try {
        await createMergeRequest(actorUserId, sourceTreeId, targetTreeId);
        set({ notice: 'Merge request submitted for review.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    sendMergeInvite: async (actorUserId, sourceTreeId, identifier) => {
      set({ error: null });
      try {
        await sendMergeInviteByIdentifier(actorUserId, sourceTreeId, identifier);
        set({ notice: 'Merge invitation sent.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    requestTreeAccess: async (actorUserId, treeId) => {
      set({ error: null });
      try {
        await requestAccessToTree(actorUserId, treeId);
        set({ notice: 'Access request sent.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    requestTreeAccessByIdentifier: async (actorUserId, identifier) => {
      set({ error: null });
      try {
        await requestAccessFromIdentifier(actorUserId, identifier);
        set({ notice: 'Access request sent.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    cancelTreeAccessRequest: async (actorUserId, notificationId) => {
      set({ error: null });
      try {
        await cancelTreeAccessRequest(actorUserId, notificationId);
        set({ notice: 'Access request cancelled.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    respondToMergeInvite: async (actorUserId, notificationId, status) => {
      set({ error: null });
      try {
        await respondToMergeInvite(actorUserId, notificationId, status);
        set({ notice: status === 'accepted' ? 'Merge invitation accepted.' : 'Merge invitation dismissed.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    respondToTreeAccessRequest: async (actorUserId, notificationId, status) => {
      set({ error: null });
      try {
        await respondToTreeAccessRequest(actorUserId, notificationId, status);
        set({ notice: status === 'accepted' ? 'Access request approved.' : 'Access request declined.' });
      } catch (error) {
        set({ error: normaliseError(error) });
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
      set({ error: null });
      try {
        await markNotificationSeen(actorUserId, notificationId);

      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    markNotificationOpened: async (actorUserId, notificationId) => {
      set({ error: null });
      try {
        await markNotificationOpened(actorUserId, notificationId);

      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    markNotificationActivityActioned: async (actorUserId, sourceKind, sourceId) => {
      set({ error: null });
      try {
        await markNotificationActivityActioned(actorUserId, sourceKind, sourceId);

      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    deleteNotification: async (actorUserId, notificationId) => {
      set({ error: null });
      try {
        await deleteNotification(actorUserId, notificationId);
        set({ notice: 'Notification deleted.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    deleteNotificationActivity: async (actorUserId, sourceKind, sourceId) => {
      set({ error: null });
      try {
        await deleteNotificationActivity(actorUserId, sourceKind, sourceId);
        set({ notice: 'Notification deleted.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    deleteAllNotifications: async (actorUserId, notificationIds, activityTargets) => {
      set({ error: null });
      try {
        await deleteAllNotifications(actorUserId, notificationIds, activityTargets);
        set({ notice: 'Notifications deleted.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    loadMergePreview: async (sourceTreeId, targetTreeId) => {
      set({ error: null });
      try {
        const preview = await getMergePreview(sourceTreeId, targetTreeId);
        set({ mergePreview: preview });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    approveMergeRequest: async (actorUserId, requestId, comment, selectedMatchIds, conflictChoices) => {
      set({ error: null });
      try {
        await reviewMergeRequest(actorUserId, requestId, 'approve', comment, conflictChoices, selectedMatchIds);
        set({ notice: 'Merge request approved.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    rejectMergeRequest: async (actorUserId, requestId, comment) => {
      set({ error: null });
      try {
        await reviewMergeRequest(actorUserId, requestId, 'reject', comment);
        set({ notice: 'Merge request rejected.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    requestMergeChanges: async (actorUserId, requestId, comment, selectedMatchIds, conflictChoices) => {
      set({ error: null });
      try {
        await reviewMergeRequest(actorUserId, requestId, 'request-changes', comment, conflictChoices, selectedMatchIds);
        set({ notice: 'Changes requested for merge.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    undoMerge: async (actorUserId, requestId) => {
      set({ error: null });
      try {
        await undoMergeRequest(actorUserId, requestId);
        set({ notice: 'Merge undo applied.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    grantMergeViewerAccess: async (actorUserId, requestId, treeId) => {
      set({ error: null });
      try {
        await grantMergeRequesterViewerAccess(actorUserId, requestId, treeId);
        set({ notice: 'Viewer access granted.' });
      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    assignPersonToUser: async (actorUserId, treeId, targetUserId, personId) => {
      set({ error: null });
      try {
        await assignTreePersonToUser(actorUserId, treeId, targetUserId, personId);

      } catch (error) {
        set({ error: normaliseError(error) });
        throw error;
      }
    },

    assignSelfToPerson: async (treeId, userId, personId) => {
      await get().assignPersonToUser(userId, treeId, userId, personId);
    },

    clearSelfAssignment: async (treeId, userId) => {
      set({ error: null });
      try {
        await clearTreePersonAssignment(treeId, userId);

      } catch (error) {
        set({ error: normaliseError(error) });
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
        treeDataTreeId: null,
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
  const actions = initialState as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  for (const name of ["createTree","createTreeFromSurname","renameTree","setTreeDiscoverability","setApprovalWindowHours","setTreeKinshipSystem","setSurnameVariantGroups","addCollaborator","removeCollaborator","removeTree","createPerson","createPersonWithRelationships","updatePerson","removePerson","addParentChildRelationship","addSpouseRelationship","editRelationship","removeRelationship","approveApprovalRequest","rejectApprovalRequest","createMergeRequest","sendMergeInvite","requestTreeAccess","requestTreeAccessByIdentifier","cancelTreeAccessRequest","respondToMergeInvite","respondToTreeAccessRequest","searchDiscoverableTrees","searchDiscoverableTreesByUsername","markNotificationSeen","markNotificationOpened","markNotificationActivityActioned","deleteNotification","deleteNotificationActivity","deleteAllNotifications","loadMergePreview","approveMergeRequest","rejectMergeRequest","requestMergeChanges","undoMerge","grantMergeViewerAccess","assignPersonToUser","assignSelfToPerson","clearSelfAssignment"]) {
    const action = actions[name];
    actions[name] = (...args) => trackOperation(name, () => action(...args), (mutating) => set({ mutating }));
  }
  return initialState;
}, {
  name: TREE_STORE_STORAGE_KEY,
  version: TREE_STORE_CACHE_VERSION,
  storage: selectiveStorage(createJSONStorage<PersistedTreeState>(() => AsyncStorage)!),
  partialize: (state): PersistedTreeState => ({
    currentUserId: state.currentUserId,
    trees: state.trees,
    selectedTreeId: state.selectedTreeId,
    treeDataTreeId: state.treeDataTreeId,
    people: state.people,
    relationships: state.relationships,
  }),
}));
