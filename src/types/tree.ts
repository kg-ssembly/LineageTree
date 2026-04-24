export type TreeRole = 'owner' | 'editor' | 'viewer';
export type CollaboratorRole = Exclude<TreeRole, 'owner'>;

export interface TreeCollaborator {
  userId: string;
  email: string;
  displayName: string;
  role: TreeRole;
}

export interface FamilyTree {
  id: string;
  ownerId: string;
  name: string;
  memberIds: string[];
  editorIds: string[];
  collaborators: TreeCollaborator[];
  createdAt: string;
  updatedAt: string;
}

export interface FamilyTreeInput {
  name: string;
}

export function getTreeRole(tree: FamilyTree, userId?: string | null): TreeRole | null {
  if (!userId) {
    return null;
  }

  if (tree.ownerId === userId) {
    return 'owner';
  }

  return tree.collaborators.find((collaborator) => collaborator.userId === userId)?.role ?? null;
}

export function canManageTree(tree: FamilyTree, userId?: string | null) {
  return !!userId && tree.ownerId === userId;
}

export function canEditTreeContent(tree: FamilyTree, userId?: string | null) {
  return !!userId && tree.editorIds.includes(userId);
}

