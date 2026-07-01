import type { ApprovalRequest } from '../../../../components/dto/approval';
import type { PersonRecord } from '../../../../components/dto/person';
import type { RelationshipRecord } from '../../../../components/dto/relationship';
import { formatPersonDate } from '../../../../components/dto/person';
import { formatPersonGender, formatPersonName } from '../../../../components/person-formatting';
import { translate } from '../../../../i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import type { SharedTabProps } from '../shared';

export type TreeManagementTabKey = 'overview' | 'collaborators' | 'approvals' | 'merges' | 'trees';
export type TreeHelperDialogKey =
  | 'tree-management'
  | 'surname-variants'
  | 'my-place'
  | 'approval-settings'
  | 'collaborators'
  | 'pending-approvals'
  | 'merge-guidance'
  | 'merge-invitations'
  | 'maiden-surname-trees'
  | 'my-trees';

export const TREE_MANAGEMENT_TABS: Array<{ key: TreeManagementTabKey; label: string }> = [
  { key: 'overview', label: K.treeSettings.overviewTab },
  { key: 'collaborators', label: K.treeSettings.collaboratorsTab },
  { key: 'approvals', label: K.treeSettings.approvalsTab },
  { key: 'merges', label: K.treeSettings.mergesTab },
  { key: 'trees', label: K.treeSettings.myTreesTab },
];

export const TREE_HELPER_COPY: Record<TreeHelperDialogKey, { title: string; message: string }> = {
  'tree-management': {
    title: K.treeSettings.treeHomeTitle,
    message: K.treeSettings.treeHomeMessage,
  },
  'surname-variants': {
    title: K.treeSettings.surnameVariantsTitle,
    message: K.treeSettings.surnameVariantsMessage,
  },
  'my-place': {
    title: K.treeSettings.myPlaceInThisTreeTitle,
    message: K.treeSettings.myPlaceInThisTreeMessage,
  },
  'approval-settings': {
    title: K.treeSettings.reviewRhythmTitle,
    message: K.treeSettings.reviewRhythmMessage,
  },
  collaborators: {
    title: K.treeSettings.familyCircleTitle,
    message: K.treeSettings.familyCircleMessage,
  },
  'pending-approvals': {
    title: K.treeSettings.waitingForALookTitle,
    message: K.treeSettings.waitingForALookMessage,
  },
  'merge-guidance': {
    title: K.treeSettings.collaborativeMergesTitle,
    message: K.treeSettings.collaborativeMergesMessage,
  },
  'merge-invitations': {
    title: K.treeSettings.mergeInvitationsTitle,
    message: K.treeSettings.mergeInvitationsMessage,
  },
  'maiden-surname-trees': {
    title: K.treeSettings.suggestedMaidenSurnameTreesTitle,
    message: K.treeSettings.suggestedMaidenSurnameTreesMessage,
  },
  'my-trees': {
    title: K.treeSettings.myFamilyTreesTitle,
    message: K.treeSettings.myFamilyTreesMessage,
  },
};

export function formatRole(role: string | null | undefined) {
  if (!role) {
    return translate(K.treeSettings.sharedRole);
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

type ApprovalPreviewField = {
  label: string;
  before?: string | null;
  after?: string | null;
};

function formatApprovalValue(value?: string | null, emptyLabel: string = K.treeSettings.notProvided) {
  if (!value?.trim()) {
    return translate(emptyLabel);
  }

  return value.trim();
}

function formatApprovalList(values?: string[] | null, emptyLabel: string = K.common.none) {
  if (!values?.length) {
    return translate(emptyLabel);
  }

  return values.join(', ');
}

function formatApprovalLifeEvents(person?: PersonRecord | null) {
  if (!person?.lifeEvents?.length) {
    return translate(K.common.none);
  }

  return translate(K.treeSettings.countRecorded, { count: person.lifeEvents.length });
}

function formatApprovalPhotos(person?: PersonRecord | null) {
  if (!person?.photos?.length) {
    return translate(K.common.none);
  }

  return translate(K.treeSettings.countPhotos, { count: person.photos.length });
}

export function buildPersonApprovalPreviewFields(beforePerson?: PersonRecord | null, afterPerson?: PersonRecord | null): ApprovalPreviewField[] {
  if (!beforePerson && !afterPerson) {
    return [];
  }

  const fields: ApprovalPreviewField[] = [
    { label: translate(K.common.name), before: beforePerson ? formatPersonName(beforePerson) : null, after: afterPerson ? formatPersonName(afterPerson) : null },
    { label: translate(K.treeSettings.middleNames), before: formatApprovalValue(beforePerson?.middleNames), after: formatApprovalValue(afterPerson?.middleNames) },
    { label: translate(K.personForm.maidenName), before: formatApprovalValue(beforePerson?.maidenName), after: formatApprovalValue(afterPerson?.maidenName) },
    { label: translate(K.treeSettings.nicknames), before: formatApprovalList(beforePerson?.nicknames), after: formatApprovalList(afterPerson?.nicknames) },
    { label: translate(K.personForm.gender), before: beforePerson ? formatPersonGender(beforePerson.gender) : null, after: afterPerson ? formatPersonGender(afterPerson.gender) : null },
    { label: translate(K.personForm.birthDate), before: beforePerson?.birthDate ? formatPersonDate(beforePerson.birthDate) : translate(K.common.unknown), after: afterPerson?.birthDate ? formatPersonDate(afterPerson.birthDate) : translate(K.common.unknown) },
    { label: translate(K.treeSettings.deathDate), before: beforePerson?.deathDate ? formatPersonDate(beforePerson.deathDate) : translate(K.common.present), after: afterPerson?.deathDate ? formatPersonDate(afterPerson.deathDate) : translate(K.common.present) },
    { label: translate(K.treeSettings.birthPlace), before: formatApprovalValue(beforePerson?.birthPlace), after: formatApprovalValue(afterPerson?.birthPlace) },
    { label: translate(K.treeSettings.hometown), before: formatApprovalValue(beforePerson?.hometown), after: formatApprovalValue(afterPerson?.hometown) },
    { label: translate(K.treeSettings.clanName), before: formatApprovalValue(beforePerson?.clanName), after: formatApprovalValue(afterPerson?.clanName) },
    { label: translate(K.treeSettings.familyBranch), before: formatApprovalValue(beforePerson?.familyBranch), after: formatApprovalValue(afterPerson?.familyBranch) },
    { label: translate(K.treeSettings.lifeEvents), before: formatApprovalLifeEvents(beforePerson), after: formatApprovalLifeEvents(afterPerson) },
    { label: translate(K.treeSettings.photos), before: formatApprovalPhotos(beforePerson), after: formatApprovalPhotos(afterPerson) },
    { label: translate(K.treeSettings.notes), before: formatApprovalValue(beforePerson?.notes, translate(K.treeSettings.noNotes)), after: formatApprovalValue(afterPerson?.notes, translate(K.treeSettings.noNotes)) },
  ];

  if (!beforePerson || !afterPerson) {
    return fields;
  }

  return fields.filter((field) => field.before !== field.after);
}

function formatRelationshipType(type: RelationshipRecord['type']) {
  return type === 'spouse' ? translate(K.treeSettings.spouseLabel) : translate(K.treeSettings.parentChild);
}

function formatRelationshipStatus(value?: RelationshipRecord['relationshipStatus']) {
  if (!value) {
    return translate(K.treeSettings.notSet);
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatParentChildKind(value?: RelationshipRecord['parentChildKind']) {
  if (!value) {
    return translate(K.treeSettings.notSet);
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRelationshipPeople(
  relationship: RelationshipRecord | null | undefined,
  peopleById: Map<string, PersonRecord>,
) {
  if (!relationship) {
    return translate(K.treeSettings.unknownPeople);
  }

  const fromPerson = peopleById.get(relationship.fromPersonId);
  const toPerson = peopleById.get(relationship.toPersonId);

  if (relationship.type === 'spouse') {
    return `${formatPersonName(fromPerson)} and ${formatPersonName(toPerson)}`;
  }

  return `${formatPersonName(fromPerson)} -> ${formatPersonName(toPerson)}`;
}

export function buildRelationshipApprovalPreviewFields(
  beforeRelationship: RelationshipRecord | null | undefined,
  afterRelationship: RelationshipRecord | null | undefined,
  peopleById: Map<string, PersonRecord>,
): ApprovalPreviewField[] {
  if (!beforeRelationship && !afterRelationship) {
    return [];
  }

  const fields: ApprovalPreviewField[] = [
    {
      label: translate(K.treeSettings.relationshipType),
      before: beforeRelationship ? formatRelationshipType(beforeRelationship.type) : null,
      after: afterRelationship ? formatRelationshipType(afterRelationship.type) : null,
    },
    {
      label: beforeRelationship?.type === 'spouse' || afterRelationship?.type === 'spouse' ? translate(K.treeSettings.people) : translate(K.treeSettings.parentToChildLabel),
      before: formatRelationshipPeople(beforeRelationship, peopleById),
      after: formatRelationshipPeople(afterRelationship, peopleById),
    },
    {
      label: translate(K.treeSettings.spouseStatus),
      before: formatRelationshipStatus(beforeRelationship?.relationshipStatus),
      after: formatRelationshipStatus(afterRelationship?.relationshipStatus),
    },
    {
      label: translate(K.treeSettings.parentChildKind),
      before: formatParentChildKind(beforeRelationship?.parentChildKind),
      after: formatParentChildKind(afterRelationship?.parentChildKind),
    },
  ];

  if (!beforeRelationship || !afterRelationship) {
    return fields;
  }

  return fields.filter((field) => field.before !== field.after);
}

export function getApprovalOperationLabel(operation: ApprovalRequest['operation']) {
  switch (operation) {
    case 'update-person':
      return translate(K.treeSettings.updateProfileOperation);
    case 'delete-person':
      return translate(K.treeSettings.deleteProfileOperation);
    case 'create-relationship':
      return translate(K.treeSettings.createRelationshipOperation);
    case 'update-relationship':
      return translate(K.treeSettings.updateRelationshipOperation);
    case 'delete-relationship':
      return translate(K.treeSettings.deleteRelationshipOperation);
    default:
      return operation;
  }
}

export type OverviewSectionProps = {
  selectedTree: SharedTabProps['selectedTree'];
  people: SharedTabProps['people'];
  role: SharedTabProps['role'];
  isOwner: SharedTabProps['isOwner'];
  currentUserLabel: SharedTabProps['currentUserLabel'];
  currentAssignedPerson: SharedTabProps['currentAssignedPerson'];
  currentSelfAssignmentSuggestions: SharedTabProps['currentSelfAssignmentSuggestions'];
  canCreateSelfProfile: SharedTabProps['canCreateSelfProfile'];
  mutating: SharedTabProps['mutating'];
  userId: SharedTabProps['userId'];
  treeSurnameVariants: string[];
  unlinkedCollaboratorCount: number;
  showLinkChooser: boolean;
  linkSearchQuery: string;
  filteredLinkPeople: SharedTabProps['people'];
  onOpenHelperDialog: (key: TreeHelperDialogKey) => void;
  onOpenSurnameVariantDialog: () => void;
  onOpenAddSelf: SharedTabProps['onOpenAddSelf'];
  openPersonProfile: SharedTabProps['openPersonProfile'];
  onAssignPersonToUser: SharedTabProps['onAssignPersonToUser'];
  openConfirm: SharedTabProps['openConfirm'];
  onClearSelfAssignment: SharedTabProps['onClearSelfAssignment'];
  setShowLinkChooser: (visible: boolean) => void;
  setLinkSearchQuery: (value: string) => void;
};

export type CollaboratorsSectionProps = {
  selectedTree: SharedTabProps['selectedTree'];
  people: SharedTabProps['people'];
  assignedPersonByUserId: SharedTabProps['assignedPersonByUserId'];
  assignedUserIdByPersonId: SharedTabProps['assignedUserIdByPersonId'];
  role: SharedTabProps['role'];
  isOwner: SharedTabProps['isOwner'];
  userId: SharedTabProps['userId'];
  mutating: SharedTabProps['mutating'];
  ownerLinkTargetUserId: string | null;
  ownerLinkSearchQuery: string;
  filteredOwnerLinkPeople: SharedTabProps['people'];
  ownerLinkPage: number;
  ownerLinkTotalPages: number;
  onOpenHelperDialog: (key: TreeHelperDialogKey) => void;
  onOpenCollaboratorDialog: SharedTabProps['onOpenCollaboratorDialog'];
  openConfirm: SharedTabProps['openConfirm'];
  onRemoveCollaborator: SharedTabProps['onRemoveCollaborator'];
  onAssignPersonToUser: SharedTabProps['onAssignPersonToUser'];
  setOwnerLinkSearchQuery: (value: string) => void;
  setOwnerLinkPage: React.Dispatch<React.SetStateAction<number>>;
  toggleOwnerLinkChooser: (targetUserId: string) => void;
  clearOwnerLinkChooser: () => void;
};

export type ApprovalsSectionProps = {
  pendingApprovalRequests: SharedTabProps['approvalRequests'];
  approvalWindowHours: number;
  approvalWindowValue: string;
  approvalsDisabled: boolean;
  isOwner: SharedTabProps['isOwner'];
  userId: SharedTabProps['userId'];
  mutating: SharedTabProps['mutating'];
  onOpenHelperDialog: (key: TreeHelperDialogKey) => void;
  onSetApprovalWindowHours: SharedTabProps['onSetApprovalWindowHours'];
  onApproveApprovalRequest: SharedTabProps['onApproveApprovalRequest'];
  onRejectApprovalRequest: SharedTabProps['onRejectApprovalRequest'];
  setPreviewApprovalRequest: (request: ApprovalRequest | null) => void;
};

export type MergesSectionProps = {
  selectedTree: SharedTabProps['selectedTree'];
  notifications: SharedTabProps['notifications'];
  trees: SharedTabProps['trees'];
  mergePreview: SharedTabProps['mergePreview'];
  pendingMergeRequests: SharedTabProps['mergeRequests'];
  highlightedMergeRequestId: string | null;
  mergeSelectionDrafts: Record<string, string[]>;
  mergeInviteIdentifier: string;
  mergeInviteSourceTreeId: string;
  availableMergeSourceTrees: NonNullable<SharedTabProps['trees']>;
  canEdit: SharedTabProps['canEdit'];
  mutating: SharedTabProps['mutating'];
  onOpenHelperDialog: (key: TreeHelperDialogKey) => void;
  setMergeInviteIdentifier: (value: string) => void;
  setMergeInviteSourceTreeId: (value: string) => void;
  setMergePreviewVisible: (visible: boolean) => void;
  setMergeHistoryVisible: (visible: boolean) => void;
  toggleMergeSelection: (requestId: string, matchId: string) => void;
  onSendMergeInvite: SharedTabProps['onSendMergeInvite'];
  onRespondToMergeInvite: SharedTabProps['onRespondToMergeInvite'];
  onLoadMergePreview: SharedTabProps['onLoadMergePreview'];
  onApproveMergeRequest: SharedTabProps['onApproveMergeRequest'];
  onRequestMergeChanges: SharedTabProps['onRequestMergeChanges'];
  onRejectMergeRequest: SharedTabProps['onRejectMergeRequest'];
};

export type TreesSectionProps = {
  selectedTree: SharedTabProps['selectedTree'];
  trees: SharedTabProps['trees'];
  defaultTreeId: SharedTabProps['defaultTreeId'];
  loadingTrees: SharedTabProps['loadingTrees'];
  userId: SharedTabProps['userId'];
  mutating: SharedTabProps['mutating'];
  maidenSurnameSuggestions: Array<{ surname: string; count: number; existingTree: SharedTabProps['selectedTree'] | null }>;
  onOpenHelperDialog: (key: TreeHelperDialogKey) => void;
  onCreateSurnameTree: SharedTabProps['onCreateSurnameTree'];
  onCreateTree: SharedTabProps['onCreateTree'];
  onEditTree: SharedTabProps['onEditTree'];
  onToggleDefaultTree: SharedTabProps['onToggleDefaultTree'];
  onSwitchTree: SharedTabProps['onSwitchTree'];
  onCopyTreeId: (treeId: string) => Promise<void>;
};
