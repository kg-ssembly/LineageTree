export type TreeRole = 'owner' | 'editor' | 'contributor' | 'viewer';
export type CollaboratorRole = Exclude<TreeRole, 'owner'>;

export interface TreeMembershipHistoryEntry {
  id: string;
  userId: string;
  role: TreeRole;
  action: 'invited' | 'joined' | 'role-changed' | 'left' | 'linked-person' | 'merge-added' | 'merge-removed';
  note?: string;
  createdAt: string;
}

export interface SurnameVariantGroup {
  id: string;
  primarySurname: string;
  variants: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

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
  discoverable?: boolean;
  searchKeywords: string[];
  memberIds: string[];
  editorIds: string[];
  collaborators: TreeCollaborator[];
  personAssignments: Record<string, string>;
  approvalWindowHours: number;
  surnameVariantGroups: SurnameVariantGroup[];
  connectedTreeIds: string[];
  membershipHistory: TreeMembershipHistoryEntry[];
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

export function canSetDefaultTree(tree: FamilyTree, userId?: string | null) {
  const role = getTreeRole(tree, userId);
  return role !== null && role !== 'viewer';
}

export function isTreeDiscoverable(tree?: Pick<FamilyTree, 'discoverable'> | null) {
  return tree?.discoverable === true;
}

export function treeNeedsDiscoverabilityChoice(tree?: Pick<FamilyTree, 'discoverable'> | null) {
  return tree?.discoverable == null;
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

  return Math.max(0, Math.min(168, Math.round(nextValue)));
}
