import { create } from 'zustand';
import type { PersonInput, PersonMutationPayload, PersonRecord } from '../types/person';
import type { RelationshipRecord } from '../types/relationship';
import type { CollaboratorRole, FamilyTree } from '../types/tree';
import type { UserProfile } from '../types/user';
import {
  addCollaboratorToTree,
  createParentChildRelationship,
  createPerson,
  createSpouseRelationship,
  createTree,
  deletePerson,
  deleteRelationship,
  deleteTree,
  removeCollaboratorFromTree,
  subscribeToPeople,
  subscribeToRelationships,
  subscribeToTrees,
  updatePerson,
  updateTreeName,
} from '../services/familyTreeService';

let unsubscribeTrees: (() => void) | null = null;
let unsubscribePeople: (() => void) | null = null;
let unsubscribeRelationships: (() => void) | null = null;

function normaliseError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

function stopTreeSubscriptions() {
  unsubscribePeople?.();
  unsubscribeRelationships?.();
  unsubscribePeople = null;
  unsubscribeRelationships = null;
}

function stopAllSubscriptions() {
  unsubscribeTrees?.();
  unsubscribeTrees = null;
  stopTreeSubscriptions();
}

interface TreeState {
  trees: FamilyTree[];
  selectedTreeId: string | null;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  loadingTrees: boolean;
  loadingTreeData: boolean;
  mutating: boolean;
  error: string | null;
  syncFamilyData: (userId: string | null) => void;
  selectTree: (treeId: string | null) => void;
  createTree: (owner: Pick<UserProfile, 'id' | 'email' | 'displayName'>, name: string) => Promise<FamilyTree>;
  renameTree: (treeId: string, name: string) => Promise<void>;
  addCollaborator: (treeId: string, email: string, role: CollaboratorRole) => Promise<void>;
  removeCollaborator: (treeId: string, collaboratorUserId: string) => Promise<void>;
  removeTree: (tree: FamilyTree) => Promise<void>;
  createPerson: (ownerId: string, treeId: string, input: PersonInput, newPhotoUris: string[]) => Promise<void>;
  updatePerson: (ownerId: string, person: PersonRecord, input: PersonMutationPayload) => Promise<void>;
  removePerson: (person: PersonRecord) => Promise<void>;
  addParentChildRelationship: (ownerId: string, treeId: string, parentId: string, childId: string) => Promise<void>;
  addSpouseRelationship: (ownerId: string, treeId: string, personAId: string, personBId: string) => Promise<void>;
  removeRelationship: (relationshipId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useTreeStore = create<TreeState>((set, get) => {
  const subscribeToTreeData = (treeId: string | null) => {
    stopTreeSubscriptions();

    if (!treeId) {
      set({ people: [], relationships: [], loadingTreeData: false });
      return;
    }

    set({ people: [], relationships: [], loadingTreeData: true });

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
  };

  return {
    trees: [],
    selectedTreeId: null,
    people: [],
    relationships: [],
    loadingTrees: true,
    loadingTreeData: false,
    mutating: false,
    error: null,

    syncFamilyData: (userId) => {
      stopAllSubscriptions();

      if (!userId) {
        set({
          trees: [],
          selectedTreeId: null,
          people: [],
          relationships: [],
          loadingTrees: false,
          loadingTreeData: false,
          mutating: false,
          error: null,
        });
        return;
      }

      set({ loadingTrees: true, loadingTreeData: false, error: null });

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
        await createPerson(ownerId, treeId, input, newPhotoUris);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    updatePerson: async (ownerId, person, input) => {
      set({ mutating: true, error: null });
      try {
        await updatePerson(ownerId, person, input);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    removePerson: async (person) => {
      set({ mutating: true, error: null });
      try {
        await deletePerson(person);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    addParentChildRelationship: async (ownerId, treeId, parentId, childId) => {
      set({ mutating: true, error: null });
      try {
        await createParentChildRelationship(ownerId, treeId, parentId, childId);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    addSpouseRelationship: async (ownerId, treeId, personAId, personBId) => {
      set({ mutating: true, error: null });
      try {
        await createSpouseRelationship(ownerId, treeId, personAId, personBId);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    removeRelationship: async (relationshipId) => {
      set({ mutating: true, error: null });
      try {
        await deleteRelationship(relationshipId);
        set({ mutating: false });
      } catch (error) {
        set({ mutating: false, error: normaliseError(error) });
        throw error;
      }
    },

    clearError: () => set({ error: null }),

    reset: () => {
      stopAllSubscriptions();
      set({
        trees: [],
        selectedTreeId: null,
        people: [],
        relationships: [],
        loadingTrees: false,
        loadingTreeData: false,
        mutating: false,
        error: null,
      });
    },
  };
});

