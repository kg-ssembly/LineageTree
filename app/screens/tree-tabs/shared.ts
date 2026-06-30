import type { ApprovalRequest } from '../../../components/dto/approval';
import type { MergeHistoryRecord, MergeRequestRecord } from '../../../components/dto/merge';
import type { AppNotification, NotificationActivityState } from '../../../components/dto/notification';
import type { PersonRecord } from '../../../components/dto/person';
import type { RelationshipRecord } from '../../../components/dto/relationship';
import {
  type FamilyTree,
  type SurnameVariantGroup,
} from '../../../components/dto/tree';
import { getUserNameParts, type UserProfile } from '../../../components/dto/user';
import { formatPersonName } from '../../../components/person-formatting';

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
  availableSelfLinkPeople: PersonRecord[];
  notifications: AppNotification[];
  notificationActivityStates: NotificationActivityState[];
  assignedPersonByUserId: Map<string, PersonRecord>;
  assignedUserIdByPersonId: Map<string, string>;
  canCreateSelfProfile: boolean;
  mutating: boolean;
  loadingTreeData: boolean;
  openConfirm: (title: string, message: string, confirmLabel: string, action: () => Promise<void>) => void;
  openPersonProfile: (person: PersonRecord) => void;
  onOpenAddPerson: () => void;
  onOpenRelationshipDialog: () => void;
  onOpenPersonQuickActions: (person: PersonRecord) => void;
  onOpenCollaboratorDialog: () => void;
  onOpenAddSelf: () => void;
  onEditPerson: (person: PersonRecord) => void;
  onDeletePerson: (person: PersonRecord) => Promise<void>;
  onRemoveCollaborator: (collaboratorUserId: string) => Promise<void>;
  onAssignPersonToUser: (targetUserId: string, personId: string) => Promise<void>;
  onClearSelfAssignment: () => Promise<void>;
  onApproveApprovalRequest: (requestId: string) => Promise<void>;
  onRejectApprovalRequest: (requestId: string) => Promise<void>;
  onSetApprovalWindowHours: (hours: number) => Promise<void>;
  onSetSurnameVariantGroups: (groups: SurnameVariantGroup[]) => Promise<void>;
  onCreateMergeRequest: (targetTreeId: string) => Promise<void>;
  onSendMergeInvite: (sourceTreeId: string, identifier: string) => Promise<void>;
  onRespondToMergeInvite: (notificationId: string, status: 'accepted' | 'dismissed') => Promise<void>;
  onMarkNotificationSeen: (notificationId: string) => Promise<void>;
  onMarkNotificationOpened: (notificationId: string) => Promise<void>;
  onMarkNotificationActivityActioned: (sourceKind: NotificationActivityState['sourceKind'], sourceId: string) => Promise<void>;
  onLoadMergePreview: (targetTreeId: string) => Promise<void>;
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
      .filter((state) => Boolean(state.actionedAt))
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
      unactionedApprovalCount += 1;
    }
  }

  let unactionedMergeRequestCount = 0;
  for (const request of mergeRequests) {
    if (!actionedStateKeys.has(`merge-request:${request.id}`)) {
      unactionedMergeRequestCount += 1;
    }
  }

  let unactionedMergeHistoryCount = 0;
  for (const entry of mergeHistory) {
    if (!actionedStateKeys.has(`merge-history:${entry.id}`)) {
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
