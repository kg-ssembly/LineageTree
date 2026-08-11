import { getStorage } from 'firebase-admin/storage';
import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { ApprovalRequest } from '../../../components/dto/approval';
import type { MergeConflictChoice, MergeRequestRecord, MergeRequestSnapshot } from '../../../components/dto/merge';
import type { PersonLifeEvent, PersonPhoto, PersonRecord } from '../../../components/dto/person';
import type { RelationshipRecord } from '../../../components/dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from '../../../components/dto/relationship';
import type { FamilyTree, SurnameVariantGroup, TreeCollaborator, TreeMembershipHistoryEntry } from '../../../components/dto/tree';

export const TREES_COLLECTION = 'trees';
export const PEOPLE_COLLECTION = 'persons';
export const RELATIONSHIPS_COLLECTION = 'relationships';
export const APPROVAL_REQUESTS_COLLECTION = 'approvalRequests';
export const MERGE_REQUESTS_COLLECTION = 'mergeRequests';
export const MERGE_HISTORY_COLLECTION = 'mergeHistory';

function asSafeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function clampApprovalWindowHours(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 24;
  }

  return Math.max(0, Math.min(168, Math.round(parsed)));
}

function buildOwnerCollaborator(ownerId: string, ownerEmail: string, ownerDisplayName: string): TreeCollaborator {
  return {
    userId: ownerId,
    email: ownerEmail,
    displayName: ownerDisplayName,
    role: 'owner',
  };
}

function sortCollaborators(collaborators: TreeCollaborator[]) {
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

function mapPersonAssignments(rawAssignments: unknown) {
  if (!rawAssignments || typeof rawAssignments !== 'object') {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(rawAssignments as Record<string, unknown>)
      .flatMap(([userId, personId]) => (
        userId && typeof personId === 'string' && personId.trim()
          ? [[userId, personId.trim()] as const]
          : []
      )),
  );
}

export function nowIso() {
  return new Date().toISOString();
}

function personRecordBelongsToTree(data: { treeMembershipIds?: unknown; treeId?: unknown }, treeId: string) {
  const membershipIds = Array.isArray(data.treeMembershipIds)
    ? data.treeMembershipIds.filter((value): value is string => typeof value === 'string')
    : [data.treeId].filter((value): value is string => typeof value === 'string');
  return membershipIds.includes(treeId);
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

export function normaliseLifeEvents(lifeEvents: PersonLifeEvent[]) {
  return lifeEvents.map((event, index) => ({
    id: event.id?.trim() || `event-${Date.now()}-${index}`,
    type: event.type ?? 'custom',
    title: event.title.trim(),
    date: event.date.trim(),
    description: event.description.trim(),
  }));
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

export function mapTreeData(id: string, data: DocumentData): FamilyTree {
  const ownerCollaborator = buildOwnerCollaborator(
    asSafeString(data.ownerId),
    asSafeString(data.ownerEmail),
    asSafeString(data.ownerDisplayName),
  );
  const collaborators = Array.isArray(data.collaborators)
    ? data.collaborators
      .filter((entry) => entry?.userId && entry?.email && entry?.role)
      .map((entry) => ({
        userId: entry.userId,
        email: entry.email,
        displayName: entry.displayName ?? '',
        role: entry.role,
      } satisfies TreeCollaborator))
    : [ownerCollaborator];
  const hasOwner = collaborators.some((collaborator) => collaborator.userId === data.ownerId);
  const normalizedCollaborators = hasOwner ? collaborators : [ownerCollaborator, ...collaborators];
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
    ownerId: asSafeString(data.ownerId),
    name: asSafeString(data.name),
    kinshipSystem: data.kinshipSystem ?? 'auto',
    discoverable: typeof data.discoverable === 'boolean' ? data.discoverable : undefined,
    searchKeywords: Array.isArray(data.searchKeywords) ? data.searchKeywords.filter((value): value is string => typeof value === 'string') : [],
    memberIds: Array.isArray(data.memberIds) ? data.memberIds.filter((value): value is string => typeof value === 'string') : [asSafeString(data.ownerId)].filter(Boolean),
    editorIds: Array.isArray(data.editorIds) ? data.editorIds.filter((value): value is string => typeof value === 'string') : [asSafeString(data.ownerId)].filter(Boolean),
    collaborators: sortCollaborators(normalizedCollaborators),
    personAssignments: mapPersonAssignments(data.personAssignments),
    approvalWindowHours: clampApprovalWindowHours(data.approvalWindowHours),
    surnameVariantGroups,
    connectedTreeIds: Array.isArray(data.connectedTreeIds) ? data.connectedTreeIds.filter((value): value is string => typeof value === 'string') : [],
    membershipHistory,
    createdAt: data.createdAt ?? nowIso(),
    updatedAt: data.updatedAt ?? data.createdAt ?? nowIso(),
  };
}

export function mapPersonData(id: string, data: DocumentData): PersonRecord {
  return {
    id,
    treeId: asSafeString(data.treeId),
    treeMembershipIds: Array.isArray(data.treeMembershipIds) ? data.treeMembershipIds.filter((value): value is string => typeof value === 'string') : [asSafeString(data.treeId)].filter(Boolean),
    treeMemberships: Array.isArray(data.treeMemberships) ? data.treeMemberships : [],
    ownerId: asSafeString(data.ownerId),
    firstName: asSafeString(data.firstName),
    middleNames: asSafeString(data.middleNames),
    lastName: asSafeString(data.lastName),
    maidenName: asSafeString(data.maidenName),
    nicknames: Array.isArray(data.nicknames) ? data.nicknames.filter((value): value is string => typeof value === 'string') : [],
    clanName: asSafeString(data.clanName),
    familyBranch: asSafeString(data.familyBranch),
    hometown: asSafeString(data.hometown),
    birthPlace: asSafeString(data.birthPlace),
    surnameVariantHints: Array.isArray(data.surnameVariantHints) ? data.surnameVariantHints.filter((value): value is string => typeof value === 'string') : [],
    canonicalPersonId: asSafeString(data.canonicalPersonId),
    duplicatePersonIds: Array.isArray(data.duplicatePersonIds) ? data.duplicatePersonIds.filter((value): value is string => typeof value === 'string') : [],
    birthDate: asSafeString(data.birthDate),
    deathDate: asSafeString(data.deathDate),
    gender: data.gender ?? 'unspecified',
    notes: asSafeString(data.notes),
    lifeEvents: Array.isArray(data.lifeEvents) ? data.lifeEvents.map(mapLifeEvent) : [],
    photos: Array.isArray(data.photos) ? data.photos.map(mapPhoto) : [],
    preferredPhotoId: asSafeString(data.preferredPhotoId),
    createdAt: data.createdAt ?? nowIso(),
    updatedAt: data.updatedAt ?? data.createdAt ?? nowIso(),
  };
}

export function mapRelationshipData(id: string, data: DocumentData): RelationshipRecord {
  return {
    id,
    treeId: asSafeString(data.treeId),
    ownerId: asSafeString(data.ownerId),
    type: data.type,
    fromPersonId: asSafeString(data.fromPersonId),
    toPersonId: asSafeString(data.toPersonId),
    relationshipStatus: data.type === 'spouse' ? data.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS : undefined,
    parentChildKind: data.type === 'parent-child' ? data.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND : undefined,
    createdAt: data.createdAt ?? nowIso(),
  };
}

function mapMergeConflictChoice(rawChoice: any): MergeConflictChoice | null {
  if (!rawChoice || typeof rawChoice !== 'object') {
    return null;
  }

  const keep = rawChoice.keep;
  if (
    typeof rawChoice.matchId !== 'string'
    || typeof rawChoice.field !== 'string'
    || (keep !== 'source' && keep !== 'target' && keep !== 'both' && keep !== 'later')
  ) {
    return null;
  }

  const resolvedValue = Array.isArray(rawChoice.resolvedValue)
    ? rawChoice.resolvedValue.filter((value: unknown): value is string => typeof value === 'string')
    : typeof rawChoice.resolvedValue === 'string'
      ? rawChoice.resolvedValue
      : undefined;

  return {
    matchId: rawChoice.matchId,
    field: rawChoice.field,
    keep,
    resolvedValue,
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

export function mapApprovalRequestData(id: string, data: DocumentData): ApprovalRequest {
  return {
    id,
    treeId: asSafeString(data.treeId),
    entityType: data.entityType,
    operation: data.operation,
    targetId: asSafeString(data.targetId),
    title: asSafeString(data.title) || 'Approval request',
    description: asSafeString(data.description),
    status: data.status ?? 'pending',
    decisionMode: data.decisionMode ?? 'manual',
    requestedByUserId: asSafeString(data.requestedByUserId),
    requestedByLabel: asSafeString(data.requestedByLabel),
    eligibleApproverIds: Array.isArray(data.eligibleApproverIds) ? data.eligibleApproverIds.filter((value): value is string => typeof value === 'string') : [],
    payload: (data.payload ?? {}) as ApprovalRequest['payload'],
    expiresAt: asSafeString(data.expiresAt) || nowIso(),
    expiresAtMillis: Number(data.expiresAtMillis ?? 0),
    createdAt: data.createdAt ?? nowIso(),
    updatedAt: data.updatedAt ?? data.createdAt ?? nowIso(),
    decidedAt: data.decidedAt ?? undefined,
    decidedByUserId: data.decidedByUserId ?? undefined,
    decidedByLabel: data.decidedByLabel ?? undefined,
    appliedAt: data.appliedAt ?? undefined,
  };
}

export function mapMergeRequestData(id: string, data: DocumentData): MergeRequestRecord {
  return {
    id,
    sourceTreeId: asSafeString(data.sourceTreeId),
    targetTreeId: asSafeString(data.targetTreeId),
    involvedTreeIds: Array.isArray(data.involvedTreeIds) ? data.involvedTreeIds.filter((value): value is string => typeof value === 'string') : [],
    suggestedByUserId: asSafeString(data.suggestedByUserId),
    suggestedByLabel: asSafeString(data.suggestedByLabel),
    status: data.status ?? 'pending',
    preview: data.preview,
    selectedMatchIds: Array.isArray(data.selectedMatchIds) ? data.selectedMatchIds.filter((value): value is string => typeof value === 'string') : [],
    approvals: Array.isArray(data.approvals) ? data.approvals.filter(Boolean) : [],
    reviewerComments: Array.isArray(data.reviewerComments) ? data.reviewerComments.filter((value): value is string => typeof value === 'string') : [],
    conflictChoices: Array.isArray(data.conflictChoices)
      ? data.conflictChoices.map(mapMergeConflictChoice).filter(Boolean) as MergeConflictChoice[]
      : [],
    snapshotBeforeMerge: mapMergeSnapshot(data.snapshotBeforeMerge),
    appliedAt: data.appliedAt ?? undefined,
    undoneAt: data.undoneAt ?? undefined,
    createdAt: data.createdAt ?? nowIso(),
    updatedAt: data.updatedAt ?? data.createdAt ?? nowIso(),
  };
}

export async function getTreeById(db: Firestore, treeId: string) {
  const treeSnapshot = await db.collection(TREES_COLLECTION).doc(treeId).get();
  if (!treeSnapshot.exists) {
    throw new Error('That family tree no longer exists.');
  }

  return mapTreeData(treeSnapshot.id, treeSnapshot.data() ?? {});
}

async function getLegacyPeopleNeedingBackfill(db: Firestore, treeId: string) {
  const snapshot = await db.collection(PEOPLE_COLLECTION).where('treeId', '==', treeId).get();
  return snapshot.docs
    .filter((docSnapshot) => !personRecordBelongsToTree(docSnapshot.data(), treeId))
    .map((docSnapshot) => mapPersonData(docSnapshot.id, docSnapshot.data()));
}

export function mergeUniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export async function getPeopleByTreeId(db: Firestore, treeId: string) {
  const [membershipSnapshot, legacyPeople] = await Promise.all([
    db.collection(PEOPLE_COLLECTION).where('treeMembershipIds', 'array-contains', treeId).get(),
    getLegacyPeopleNeedingBackfill(db, treeId),
  ]);

  return mergeUniqueById([
    ...membershipSnapshot.docs.map((snapshot) => mapPersonData(snapshot.id, snapshot.data())),
    ...legacyPeople,
  ]);
}

export async function getRelationshipsByTreeId(db: Firestore, treeId: string) {
  const relationshipSnapshot = await db.collection(RELATIONSHIPS_COLLECTION).where('treeId', '==', treeId).get();
  return relationshipSnapshot.docs.map((snapshot) => mapRelationshipData(snapshot.id, snapshot.data()));
}

export async function getTreeBundle(db: Firestore, treeId: string) {
  const [tree, people, relationships] = await Promise.all([
    getTreeById(db, treeId),
    getPeopleByTreeId(db, treeId),
    getRelationshipsByTreeId(db, treeId),
  ]);

  return { tree, people, relationships };
}

function buildChildBornLifeEvent(child: Pick<PersonRecord, 'id' | 'firstName' | 'lastName' | 'birthDate'>): PersonLifeEvent | null {
  if (!child.birthDate.trim()) {
    return null;
  }

  const childName = formatPersonName(child);
  return {
    id: `child-born-${child.id}`,
    type: 'child-born',
    title: `Welcomed ${childName}`,
    date: child.birthDate,
    description: `${childName} was born on ${child.birthDate}.`,
  };
}

export function formatPersonName(person: Pick<PersonRecord, 'firstName' | 'middleNames' | 'lastName'>) {
  return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim() || 'A child';
}

export async function updateParentLifeEventsForChild(
  db: Firestore,
  parentIds: string[],
  child: Pick<PersonRecord, 'id' | 'treeId' | 'firstName' | 'lastName' | 'birthDate'>,
) {
  const uniqueParentIds = [...new Set(parentIds)];
  if (uniqueParentIds.length === 0) {
    return;
  }

  const childBirthEvent = buildChildBornLifeEvent(child);
  const eventId = `child-born-${child.id}`;
  const parentSnapshots = await Promise.all(uniqueParentIds.map((parentId) => db.collection(PEOPLE_COLLECTION).doc(parentId).get()));

  await Promise.all(parentSnapshots.map(async (parentSnapshot) => {
    if (!parentSnapshot.exists) {
      return;
    }

    const parentData = parentSnapshot.data() ?? {};
    if (!personRecordBelongsToTree(parentData, child.treeId)) {
      return;
    }

    const currentLifeEvents = Array.isArray(parentData.lifeEvents) ? parentData.lifeEvents.map(mapLifeEvent) : [];
    const nextLifeEvents = childBirthEvent
      ? [...currentLifeEvents.filter((event) => event.id !== eventId), childBirthEvent]
      : currentLifeEvents.filter((event) => event.id !== eventId);

    await parentSnapshot.ref.update({
      lifeEvents: normaliseLifeEvents(nextLifeEvents),
      updatedAt: nowIso(),
    });
  }));
}

export async function getParentIdsForChild(db: Firestore, treeId: string, childId: string) {
  const relationshipSnapshot = await db.collection(RELATIONSHIPS_COLLECTION)
    .where('treeId', '==', treeId)
    .where('type', '==', 'parent-child')
    .where('toPersonId', '==', childId)
    .get();

  return relationshipSnapshot.docs
    .map((snapshot) => mapRelationshipData(snapshot.id, snapshot.data()))
    .map((relationship) => relationship.fromPersonId);
}

export async function getRelationshipsTouchingPerson(db: Firestore, treeId: string, personId: string) {
  const [outgoingSnapshot, incomingSnapshot] = await Promise.all([
    db.collection(RELATIONSHIPS_COLLECTION).where('treeId', '==', treeId).where('fromPersonId', '==', personId).get(),
    db.collection(RELATIONSHIPS_COLLECTION).where('treeId', '==', treeId).where('toPersonId', '==', personId).get(),
  ]);

  return mergeUniqueById([
    ...outgoingSnapshot.docs.map((snapshot) => mapRelationshipData(snapshot.id, snapshot.data())),
    ...incomingSnapshot.docs.map((snapshot) => mapRelationshipData(snapshot.id, snapshot.data())),
  ]);
}

export async function deleteStoragePhotos(photos: PersonPhoto[]) {
  const bucket = getStorage().bucket();
  await Promise.all(
    photos
      .flatMap((photo) => [photo.path, photo.displayPath].filter(Boolean))
      .map(async (path) => {
        try {
          await bucket.file(path!).delete();
        } catch {
          // Ignore missing objects so a partially deleted tree can still be cleaned up.
        }
      }),
  );
}

export async function deleteDocumentRefs(db: Firestore, refs: DocumentReference[]) {
  for (let index = 0; index < refs.length; index += 450) {
    const batch = db.batch();
    refs.slice(index, index + 450).forEach((currentRef) => batch.delete(currentRef));
    await batch.commit();
  }
}
