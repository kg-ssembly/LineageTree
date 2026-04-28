import { create } from 'zustand';
import type { ApprovalRequest } from '../components/dto/approval';
import type { PersonInput, PersonMutationPayload, PersonRecord } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';
import type { CollaboratorRole, FamilyTree } from '../components/dto/tree';
import type { UserProfile } from '../components/dto/user';
import {
  addCollaboratorToTree,
  assignTreePersonToUser,
  clearTreePersonAssignment,
  createParentChildRelationship,
  createPerson,
  createSpouseRelationship,
  createTree,
  decideApprovalRequest,
  deletePerson,
  deleteRelationship,
  deleteTree,
  processExpiredApprovalRequests,
  removeCollaboratorFromTree,
  subscribeToApprovalRequests,
  subscribeToPeople,
  subscribeToRelationships,
  subscribeToTrees,
  updatePerson,
  updateTreeApprovalWindow,
  updateTreeName,
} from '../providers/family-tree-service';

let unsubscribeTrees: (() => void) | null = null;
let unsubscribePeople: (() => void) | null = null;
let unsubscribeRelationships: (() => void) | null = null;
let unsubscribeApprovalRequests: (() => void) | null = null;
let subscribedTreeId: string | null = null;

function normaliseError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

function stopTreeSubscriptions() {
  unsubscribePeople?.();
  unsubscribeRelationships?.();
  unsubscribeApprovalRequests?.();
  unsubscribePeople = null;
  unsubscribeRelationships = null;
  unsubscribeApprovalRequests = null;
  subscribedTreeId = null;
}

function stopAllSubscriptions() {
  unsubscribeTrees?.();
  unsubscribeTrees = null;
  stopTreeSubscriptions();
}

interface TreeState {
  trees: FamilyTree[];
  selectedTreeId: string | null;
  currentUserId: string | null;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  approvalRequests: ApprovalRequest[];
  loadingTrees: boolean;
  loadingTreeData: boolean;
  mutating: boolean;
  error: string | null;
  notice: string | null;
  syncFamilyData: (userId: string | null) => void;
  selectTree: (treeId: string | null) => void;
  createTree: (owner: Pick<UserProfile, 'id' | 'email' | 'displayName'>, name: string) => Promise<FamilyTree>;
  renameTree: (treeId: string, name: string) => Promise<void>;
  setApprovalWindowHours: (treeId: string, hours: number) => Promise<void>;
  addCollaborator: (treeId: string, email: string, role: CollaboratorRole) => Promise<void>;
  removeCollaborator: (treeId: string, collaboratorUserId: string) => Promise<void>;
  removeTree: (tree: FamilyTree) => Promise<void>;
  createPerson: (ownerId: string, treeId: string, input: PersonInput, newPhotoUris: string[]) => Promise<PersonRecord>;
  updatePerson: (ownerId: string, person: PersonRecord, input: PersonMutationPayload) => Promise<void>;
  removePerson: (actorUserId: string, person: PersonRecord) => Promise<void>;
  addParentChildRelationship: (ownerId: string, treeId: string, parentId: string, childId: string) => Promise<void>;
  addSpouseRelationship: (ownerId: string, treeId: string, personAId: string, personBId: string) => Promise<void>;
  removeRelationship: (actorUserId: string, relationshipId: string) => Promise<void>;
  approveApprovalRequest: (actorUserId: string, requestId: string) => Promise<void>;
  rejectApprovalRequest: (actorUserId: string, requestId: string) => Promise<void>;
  assignPersonToUser: (actorUserId: string, treeId: string, targetUserId: string, personId: string) => Promise<void>;
  assignSelfToPerson: (treeId: string, userId: string, personId: string) => Promise<void>;
  clearSelfAssignment: (treeId: string, userId: string) => Promise<void>;
  clearError: () => void;
  clearNotice: () => void;
  reset: () => void;
}

export const useTreeStore = create<TreeState>((set, get) => {
  const subscribeToTreeData = (treeId: string | null) => {
    if (treeId && subscribedTreeId === treeId && get().trees.some((tree) => tree.id === treeId)) {
      set({ selectedTreeId: treeId, loadingTreeData: false });
      return;
    }

    stopTreeSubscriptions();

    if (!treeId) {
      set({ people: [], relationships: [], approvalRequests: [], loadingTreeData: false });
      return;
    }

    subscribedTreeId = treeId;
    set({ people: [], relationships: [], approvalRequests: [], loadingTreeData: true });

    unsubscribePeople = subscribeToPeople(
      treeId,
      (people) => {
        set((state) => ({
          people,
          loadingTreeData: state.loadingTreeData && state.relationships.length === 0,
        }));
      },
      (error) => set({ error: normaliseError(error), loadingTreeData: false }),
    );

    unsubscribeRelationships = subscribeToRelationships(
      treeId,
      (relationships) => {
        set({ relationships, loadingTreeData: false });
      },
      (error) => set({ error: normaliseError(error), loadingTreeData: false }),
    );

    unsubscribeApprovalRequests = subscribeToApprovalRequests(
      treeId,
      (approvalRequests) => {
        set({ approvalRequests });
        const currentUserId = get().currentUserId;
        if (currentUserId && approvalRequests.some((request) => request.status === 'pending' && request.expiresAtMillis <= Date.now())) {
          processExpiredApprovalRequests(currentUserId, treeId).catch((error) => set({ error: normaliseError(error) }));
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
          loadingTrees: false,
          loadingTreeData: false,
          mutating: false,
          error: null,
          notice: null,
        });
        return;
      }

      set({ currentUserId: userId, loadingTrees: true, loadingTreeData: false, error: null, notice: null });

      unsubscribeTrees = subscribeToTrees(
        userId,
        (trees) => {
          const previousSelectedTreeId = get().selectedTreeId;
          const nextSelectedTreeId = trees.some((tree) => tree.id === previousSelectedTreeId)
            ? previousSelectedTreeId
            : trees[0]?.id ?? null;

          set({ trees, selectedTreeId: nextSelectedTreeId, loadingTrees: false });

          if (nextSelectedTreeId !== previousSelectedTreeId) {
            subscribeToTreeData(nextSelectedTreeId);
          }
        },
        (error) => set({ error: normaliseError(error), loadingTrees: false }),
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

    createPerson: async (ownerId, treeId, input, newPhotoUris) => {
      set({ mutating: true, error: null });
      try {
        const person = await createPerson(ownerId, treeId, input, newPhotoUris);
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

    addParentChildRelationship: async (ownerId, treeId, parentId, childId) => {
      set({ mutating: true, error: null });
      try {
        const result = await createParentChildRelationship(ownerId, treeId, parentId, childId);
        set({ mutating: false, notice: result.message });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    addSpouseRelationship: async (ownerId, treeId, personAId, personBId) => {
      set({ mutating: true, error: null });
      try {
        const result = await createSpouseRelationship(ownerId, treeId, personAId, personBId);
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
        loadingTrees: false,
        loadingTreeData: false,
        mutating: false,
        error: null,
        notice: null,
      });
    },
  };
});

