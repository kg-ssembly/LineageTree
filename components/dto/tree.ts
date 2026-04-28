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
  personAssignments: Record<string, string>;
  approvalWindowHours: number;
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

export function getAssignedPersonId(tree: FamilyTree, userId?: string | null) {
  if (!userId) {
    return null;
  }

  return tree.personAssignments[userId] ?? null;
}

export function getAssignedUserIdForPerson(tree: FamilyTree, personId?: string | null) {
  if (!personId) {
    return null;
  }

  return Object.entries(tree.personAssignments).find(([, assignedPersonId]) => assignedPersonId === personId)?.[0] ?? null;
}

export function isAssignedPersonForUser(tree: FamilyTree, personId?: string | null, userId?: string | null) {
  return !!personId && getAssignedPersonId(tree, userId) === personId;
}

export function getUnlinkedCollaborators(tree: FamilyTree) {
  const linkedUserIds = new Set(Object.keys(tree.personAssignments));
  return tree.collaborators.filter((collaborator) => !linkedUserIds.has(collaborator.userId));
}

export function getTreeApprovalWindowHours(tree?: Pick<FamilyTree, 'approvalWindowHours'> | null) {
  const nextValue = Number(tree?.approvalWindowHours ?? 24);
  if (!Number.isFinite(nextValue)) {
    return 24;
  }

  return Math.max(1, Math.min(168, Math.round(nextValue)));
}

