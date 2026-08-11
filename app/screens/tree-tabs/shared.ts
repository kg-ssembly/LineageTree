import type { ApprovalRequest } from '../../../components/dto/approval';
import type { MergeHistoryRecord, MergeRequestRecord } from '../../../components/dto/merge';
import type { AppNotification, NotificationActivityState } from '../../../components/dto/notification';
import type { PersonRecord } from '../../../components/dto/person';
import type { PersonProfileRouteMemorySection, PersonProfileRouteTab } from '../../../components/dto/navigation';
import type { PendingRelationshipMode } from '../../../components/person-form-dialog';
import type { RelationshipRecord } from '../../../components/dto/relationship';
import {
  type FamilyTree,
  type KinshipSystem,
  getAssignedPersonId,
  type SurnameVariantGroup,
} from '../../../components/dto/tree';
import { getUserNameParts, type UserProfile } from '../../../components/dto/user';
import { formatPersonName } from '../../../components/person-formatting';
import type { DiscoverableTreeSummary } from '../../../providers/family-tree-service';

export type SelfAssignmentSuggestion = {
  person: PersonRecord;
  tone: 'exact' | 'likely';
  reason: string;
};

export interface SharedTabProps {
  selectedTree: FamilyTree;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  approvalRequests: ApprovalRequest[];
  mergeRequests: MergeRequestRecord[];
  mergeHistory: MergeHistoryRecord[];
  mergePreview: MergeRequestRecord['preview'] | null;
  peopleById: Map<string, PersonRecord>;
  canEdit: boolean;
  isOwner: boolean;
  role: string | null;
  userId?: string;
  currentUserLabel: string;
  currentAssignedPerson: PersonRecord | null;
  currentSelfAssignmentSuggestions: SelfAssignmentSuggestion[];
  followUpTreePromptsPending: boolean;
  availableSelfLinkPeople: PersonRecord[];
  notifications: AppNotification[];
  notificationActivityStates: NotificationActivityState[];
  assignedPersonByUserId: Map<string, PersonRecord>;
  assignedUserIdByPersonId: Map<string, string>;
  canCreateSelfProfile: boolean;
  mutating: boolean;
  loadingTreeData: boolean;
  onEnsureTreeAuxiliaryData?: (treeId: string) => void;
  openConfirm: (title: string, message: string, confirmLabel: string, action: () => Promise<void>) => void;
  openPersonProfile: (
    person: PersonRecord,
    options?: {
      initialTab?: PersonProfileRouteTab;
      initialMemorySectionTab?: PersonProfileRouteMemorySection;
    },
  ) => void;
  onOpenAddPerson: () => void;
  onOpenAddPersonForRelationship: (mode: PendingRelationshipMode, relatedPerson: PersonRecord) => void;
  onOpenRelationshipDialog: () => void;
  onOpenPersonQuickActions: (person: PersonRecord) => void;
  onOpenCollaboratorDialog: () => void;
  onOpenAddSelf: () => void;
  onConsumeFollowUpTreePrompts: () => void;
  onEditPerson: (person: PersonRecord) => void;
  onDeletePerson: (person: PersonRecord) => Promise<void>;
  onRemoveCollaborator: (collaboratorUserId: string) => Promise<void>;
  onAssignPersonToUser: (targetUserId: string, personId: string) => Promise<void>;
  onClearSelfAssignment: () => Promise<void>;
  onApproveApprovalRequest: (requestId: string) => Promise<void>;
  onRejectApprovalRequest: (requestId: string) => Promise<void>;
  onSetTreeDiscoverability: (discoverable: boolean) => Promise<void>;
  onSetApprovalWindowHours: (hours: number) => Promise<void>;
  onSetTreeKinshipSystem: (kinshipSystem: KinshipSystem) => Promise<void>;
  onSetSurnameVariantGroups: (groups: SurnameVariantGroup[]) => Promise<void>;
  onCreateMergeRequest: (sourceTreeId: string, targetTreeId: string) => Promise<void>;
  onSendMergeInvite: (sourceTreeId: string, identifier: string) => Promise<void>;
  onRespondToMergeInvite: (notificationId: string, status: 'accepted' | 'dismissed') => Promise<void>;
  onRequestTreeAccess: (treeId: string) => Promise<void>;
  onRequestTreeAccessByIdentifier: (identifier: string) => Promise<void>;
  onRespondToTreeAccessRequest: (notificationId: string, status: 'accepted' | 'rejected') => Promise<void>;
  onSearchDiscoverableTrees: (searchTerm: string) => Promise<DiscoverableTreeSummary[]>;
  onSearchDiscoverableTreesByUsername: (username: string) => Promise<DiscoverableTreeSummary[]>;
  onMarkNotificationSeen: (notificationId: string) => Promise<void>;
  onMarkNotificationOpened: (notificationId: string) => Promise<void>;
  onMarkNotificationActivityActioned: (sourceKind: NotificationActivityState['sourceKind'], sourceId: string) => Promise<void>;
  onDeleteNotification: (notificationId: string) => Promise<void>;
  onDeleteNotificationActivity: (sourceKind: NotificationActivityState['sourceKind'], sourceId: string) => Promise<void>;
  onDeleteAllNotifications: (
    notificationIds: string[],
    activityTargets: Array<{ sourceKind: NotificationActivityState['sourceKind']; sourceId: string }>,
  ) => Promise<void>;
  onLoadMergePreview: (sourceTreeId: string, targetTreeId: string) => Promise<void>;
  onApproveMergeRequest: (requestId: string, comment?: string, selectedMatchIds?: string[]) => Promise<void>;
  onRejectMergeRequest: (requestId: string, comment?: string) => Promise<void>;
  onRequestMergeChanges: (requestId: string, comment?: string, selectedMatchIds?: string[]) => Promise<void>;
  onUndoMerge: (requestId: string) => Promise<void>;
  onGrantMergeViewerAccess: (requestId: string, treeId: string) => Promise<void>;
  onCreateSurnameTree: (surname: string) => Promise<void>;
  treeSettingsFocus?: { tab: 'approvals' | 'merges'; itemId: string; mode: 'approval' | 'merge'; token: number } | null;
  onOpenTreeSettingsTarget?: (target: { tab: 'approvals' | 'merges'; itemId: string; mode: 'approval' | 'merge' }) => void;
  trees?: FamilyTree[];
  defaultTreeId?: string | null;
  loadingTrees?: boolean;
  onCreateTree?: () => void;
  onEditTree?: (tree: FamilyTree) => void;
  onConfirmDeleteTree?: (tree: FamilyTree) => void;
  onToggleDefaultTree?: (tree: FamilyTree) => void;
  onSwitchTree?: (tree: FamilyTree) => void;
  familySwitchRef?: React.MutableRefObject<((surname: string) => void) | null>;
  activeFamilyRef?: React.MutableRefObject<string | null>;
}

export function getTreeById(trees: FamilyTree[], treeId?: string | null) {
  if (!treeId) {
    return null;
  }

  return trees.find((tree) => tree.id === treeId) ?? null;
}

export function buildPeopleDirectory(people: PersonRecord[]) {
  return {
    peopleById: new Map(people.map((person) => [person.id, person])),
    existingLastNames: [...new Set(people.map((person) => person.lastName.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
  };
}

export function buildTreeAssignmentContext(
  selectedTree: FamilyTree | null,
  peopleById: Map<string, PersonRecord>,
  userId?: string,
) {
  const assignedUserIdByPersonId = new Map<string, string>();
  const assignedPersonByUserId = new Map<string, PersonRecord>();

  Object.entries(selectedTree?.personAssignments ?? {}).forEach(([assignedUserId, personId]) => {
    assignedUserIdByPersonId.set(personId, assignedUserId);
    const linkedPerson = peopleById.get(personId);
    if (linkedPerson) {
      assignedPersonByUserId.set(assignedUserId, linkedPerson);
    }
  });

  const currentAssignedPersonId = selectedTree ? getAssignedPersonId(selectedTree, userId) : null;

  return {
    assignedUserIdByPersonId,
    assignedPersonByUserId,
    currentAssignedPersonId,
    currentAssignedPerson: currentAssignedPersonId ? peopleById.get(currentAssignedPersonId) ?? null : null,
  };
}

type ActivityNotificationCountInput = {
  approvalRequests: ApprovalRequest[];
  mergeRequests: MergeRequestRecord[];
  mergeHistory: MergeHistoryRecord[];
  notifications: AppNotification[];
  notificationActivityStates: NotificationActivityState[];
  trees?: FamilyTree[];
  userId?: string;
};

export function getActivityNotificationCount({
  approvalRequests,
  mergeRequests,
  mergeHistory,
  notifications,
  notificationActivityStates,
  trees,
  userId,
}: ActivityNotificationCountInput) {
  const actionedStateKeys = new Set(
    notificationActivityStates
      .filter((state) => Boolean(state.actionedAt) && !state.deletedAt)
      .map((state) => `${state.sourceKind}:${state.sourceId}`),
  );
  const deletedStateKeys = new Set(
    notificationActivityStates
      .filter((state) => Boolean(state.deletedAt))
      .map((state) => `${state.sourceKind}:${state.sourceId}`),
  );

  let unseenDirectCount = 0;
  for (const notification of notifications) {
    if (!notification.seenAt) {
      unseenDirectCount += 1;
    }
  }

  let unactionedApprovalCount = 0;
  for (const request of approvalRequests) {
    if (!actionedStateKeys.has(`approval:${request.id}`)) {
      if (deletedStateKeys.has(`approval:${request.id}`)) {
        continue;
      }
      unactionedApprovalCount += 1;
    }
  }

  let unactionedMergeRequestCount = 0;
  for (const request of mergeRequests) {
    if (!actionedStateKeys.has(`merge-request:${request.id}`)) {
      if (deletedStateKeys.has(`merge-request:${request.id}`)) {
        continue;
      }
      unactionedMergeRequestCount += 1;
    }
  }

  let unactionedMergeHistoryCount = 0;
  for (const entry of mergeHistory) {
    if (!actionedStateKeys.has(`merge-history:${entry.id}`)) {
      if (deletedStateKeys.has(`merge-history:${entry.id}`)) {
        continue;
      }
      unactionedMergeHistoryCount += 1;
    }
  }

  let unactionedMembershipCount = 0;
  for (const tree of trees ?? []) {
    for (const entry of tree.membershipHistory) {
      const canSeeEntry = !userId || entry.userId === userId || entry.action === 'invited' || entry.action === 'role-changed';
      if (!canSeeEntry) {
        continue;
      }

      if (deletedStateKeys.has(`membership:${tree.id}-${entry.id}`)) {
        continue;
      }

      if (!actionedStateKeys.has(`membership:${tree.id}-${entry.id}`)) {
        unactionedMembershipCount += 1;
      }
    }
  }

  return unseenDirectCount
    + unactionedApprovalCount
    + unactionedMergeRequestCount
    + unactionedMergeHistoryCount
    + unactionedMembershipCount;
}

function normaliseComparableName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.'’_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function buildSelfAssignmentSuggestions(
  user: Pick<UserProfile, 'displayName' | 'email'> | null | undefined,
  people: PersonRecord[],
  assignedUserIdByPersonId: Map<string, string>,
  currentUserId?: string,
) {
  const { displayLabel, firstName, lastName } = getUserNameParts(user);
  const normalizedDisplayLabel = normaliseComparableName(displayLabel);
  const normalizedFirstName = normaliseComparableName(firstName);
  const normalizedLastName = normaliseComparableName(lastName);

  return people
    .flatMap<SelfAssignmentSuggestion>((person) => {
      const assignedUserId = assignedUserIdByPersonId.get(person.id);
      if (assignedUserId && assignedUserId !== currentUserId) {
        return [];
      }

      const normalizedPersonFirstName = normaliseComparableName(person.firstName);
      const normalizedPersonLastName = normaliseComparableName(person.lastName);
      const normalizedPersonFullName = normaliseComparableName(formatPersonName(person));
      const isExactMatch = Boolean(
        normalizedFirstName
        && normalizedLastName
        && normalizedPersonFirstName === normalizedFirstName
        && normalizedPersonLastName === normalizedLastName,
      );

      if (isExactMatch) {
        return [{ person, tone: 'exact', reason: `Exact first-name and surname match for ${displayLabel}.` }];
      }

      const isLikelyMatch = Boolean(
        normalizedDisplayLabel
        && (
          normalizedPersonFullName === normalizedDisplayLabel
          || (
            normalizedLastName
            && normalizedPersonLastName === normalizedLastName
            && normalizedFirstName
            && (
              normalizedPersonFirstName.startsWith(normalizedFirstName)
              || normalizedFirstName.startsWith(normalizedPersonFirstName)
            )
          )
        ),
      );

      if (isLikelyMatch) {
        return [{ person, tone: 'likely', reason: `Likely match from your display name, ${displayLabel}.` }];
      }

      return [];
    })
    .sort((left, right) => {
      if (left.tone !== right.tone) {
        return left.tone === 'exact' ? -1 : 1;
      }

      return formatPersonName(left.person).localeCompare(formatPersonName(right.person));
    });
}
