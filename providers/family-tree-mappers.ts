import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import type { ApprovalRequest, ApprovalRequestPayload } from '../components/dto/approval';
import type { MergeApproval, MergeConflictChoice, MergeHistoryRecord, MergePreview, MergeRequestRecord, MergeRequestSnapshot } from '../components/dto/merge';
import type { AppNotification, NotificationActivityState } from '../components/dto/notification';
import type { PersonLifeEvent, PersonPhoto, PersonRecord } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from '../components/dto/relationship';
import type { FamilyTree, KinshipSystem, SurnameVariantGroup, TreeCollaborator, TreeMembershipHistoryEntry, TreeRole } from '../components/dto/tree';
import type { UserProfile } from '../components/dto/user';
import { nowIso } from './family-tree-shared';

export function asSafeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function clampApprovalWindowHours(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 24;
  }

  return Math.max(0, Math.min(168, Math.round(parsed)));
}

function isTreeRole(value: unknown): value is TreeRole {
  return value === 'owner' || value === 'editor' || value === 'contributor' || value === 'viewer';
}

function isKinshipSystem(value: unknown): value is KinshipSystem {
  return value === 'auto'
    || value === 'generic'
    || value === 'northern-sotho'
    || value === 'nso'
    || value === 'ss'
    || value === 'st'
    || value === 'tn'
    || value === 'ts'
    || value === 've'
    || value === 'zu';
}

function normalizeKinshipSystem(value: KinshipSystem): KinshipSystem {
  return value === 'northern-sotho' ? 'nso' : value;
}

export function buildOwnerCollaborator(user: Pick<UserProfile, 'id' | 'email' | 'displayName'>): TreeCollaborator {
  return {
    userId: user.id,
    email: asSafeString(user.email),
    displayName: asSafeString(user.displayName),
    role: 'owner',
  };
}

export function sortCollaborators(collaborators: TreeCollaborator[]) {
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

export function upsertCollaborator(
  collaborators: TreeCollaborator[],
  collaborator: TreeCollaborator,
) {
  return sortCollaborators([
    ...collaborators.filter((entry) => entry.userId !== collaborator.userId),
    collaborator,
  ]);
}

export function setCollaboratorRole(
  collaborators: TreeCollaborator[],
  userId: string,
  role: TreeRole,
) {
  return sortCollaborators(
    collaborators.map((collaborator) => (
      collaborator.userId === userId
        ? { ...collaborator, role }
        : collaborator
    )),
  );
}

export function appendUniqueId(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

export function buildMembershipHistoryEntry(
  treeId: string,
  userId: string,
  role: TreeRole,
  action: TreeMembershipHistoryEntry['action'],
  createdAt: string,
  note?: string,
): TreeMembershipHistoryEntry {
  return {
    id: `${treeId}-${userId}-${Date.now()}`,
    userId,
    role,
    action,
    note,
    createdAt,
  };
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

export function mapTreeData(id: string, data: DocumentData): FamilyTree {
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
    kinshipSystem: isKinshipSystem(data.kinshipSystem) ? normalizeKinshipSystem(data.kinshipSystem) : 'auto',
    discoverable: typeof data.discoverable === 'boolean' ? data.discoverable : undefined,
    searchKeywords: Array.isArray(data.searchKeywords) ? data.searchKeywords.filter((value) => typeof value === 'string') : [],
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

export function mapTree(snapshot: QueryDocumentSnapshot): FamilyTree {
  return mapTreeData(snapshot.id, snapshot.data());
}

export function mapPhoto(photo: any, index: number): PersonPhoto {
  return {
    id: photo?.id ?? `${photo?.path ?? photo?.url ?? 'photo'}-${index}`,
    url: photo?.url ?? '',
    path: photo?.path ?? '',
    displayUrl: photo?.displayUrl ?? '',
    displayPath: photo?.displayPath ?? '',
    description: photo?.description ?? '',
    linkedLifeEventId: photo?.linkedLifeEventId ?? '',
    createdAt: photo?.createdAt ?? nowIso(),
  };
}

export function mapLifeEvent(event: any, index: number): PersonLifeEvent {
  return {
    id: event?.id ?? `event-${index}`,
    type: event?.type ?? 'custom',
    title: event?.title ?? '',
    date: event?.date ?? '',
    description: event?.description ?? '',
  };
}

export function mapPerson(snapshot: QueryDocumentSnapshot): PersonRecord {
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

export function formatPersonName(person: Pick<PersonRecord, 'firstName' | 'middleNames' | 'lastName'>) {
  return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim() || 'A child';
}

export function normaliseLifeEvents(lifeEvents: PersonLifeEvent[]) {
  return lifeEvents.map((event, index) => ({
    id: event.id?.trim() || `event-${Date.now()}-${index}`,
    type: event.type ?? 'custom',
    title: event.title.trim(),
    date: event.date.trim(),
    description: event.description.trim(),
  }));
}

export function mapRelationshipData(id: string, data: DocumentData): RelationshipRecord {
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

export function mapRelationship(snapshot: QueryDocumentSnapshot): RelationshipRecord {
  return mapRelationshipData(snapshot.id, snapshot.data());
}

export function mapApprovalRequestData(id: string, data: DocumentData): ApprovalRequest {
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

export function mapApprovalRequest(snapshot: QueryDocumentSnapshot): ApprovalRequest {
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

export function mapMergeRequest(snapshot: QueryDocumentSnapshot): MergeRequestRecord {
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

export function mapMergeHistory(snapshot: QueryDocumentSnapshot): MergeHistoryRecord {
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

export function mapNotification(snapshot: QueryDocumentSnapshot): AppNotification {
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

export function mapNotificationActivityState(snapshot: QueryDocumentSnapshot): NotificationActivityState {
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

export function sortByNewest<T extends { updatedAt?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftValue = left.updatedAt ?? left.createdAt ?? '';
    const rightValue = right.updatedAt ?? right.createdAt ?? '';
    return rightValue.localeCompare(leftValue);
  });
}

export function mergeUniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefinedDeep(entry)]),
    ) as T;
  }

  return value;
}
