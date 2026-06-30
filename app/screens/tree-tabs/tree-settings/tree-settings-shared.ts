import type { ApprovalRequest } from '../../../../components/dto/approval';
import type { PersonRecord } from '../../../../components/dto/person';
import type { RelationshipRecord } from '../../../../components/dto/relationship';
import { formatPersonDate } from '../../../../components/dto/person';
import { formatPersonGender, formatPersonName } from '../../../../components/person-formatting';
import { translate } from '../../../../i18n';
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
  { key: 'overview', label: 'Overview' },
  { key: 'collaborators', label: 'Collaborators' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'merges', label: 'Merges' },
  { key: 'trees', label: 'My Trees' },
];

export const TREE_HELPER_COPY: Record<TreeHelperDialogKey, { title: string; message: string }> = {
  'tree-management': {
    title: 'Tree home',
    message: 'Overview brings together the tree-wide setup pieces such as surname variants and your linked place in this family space. Collaborators shows who is part of the circle. Approvals and merges help shared work move forward smoothly.',
  },
  'surname-variants': {
    title: 'Surname variants',
    message: 'Surname variants belong to this tree as one shared list. Add alternate spellings or related surnames here so search and merge suggestions can recognize them across the whole tree.',
  },
  'my-place': {
    title: 'My place in this tree',
    message: 'Link your account to the family member profile that represents you in this tree. Once connected, you can jump into your branch quickly and see how your story connects with the wider family.',
  },
  'approval-settings': {
    title: 'Review rhythm',
    message: 'Choose how shared edits move through this tree. Turning review off lets changes land right away. A 12, 24, or 48 hour window gives everyone a chance to look before changes settle in automatically.',
  },
  collaborators: {
    title: 'Family circle',
    message: 'This is the circle of people helping shape the tree. Editors can add and refine stories, viewers can explore, and owners can help everyone find the right linked profile.',
  },
  'pending-approvals': {
    title: 'Waiting for a look',
    message: 'Shared profile and relationship edits that need a quick review appear here. If no one responds before the review window ends, they settle in automatically.',
  },
  'merge-guidance': {
    title: 'Collaborative merges',
    message: 'Choose which of your trees to offer for merge, then invite a registered user by email or username. They will preview the merge after choosing their own tree. Each merge needs at least one editor approval from each affected tree before anything is applied.',
  },
  'merge-invitations': {
    title: 'Merge invitations',
    message: 'When another user invites you to merge, choose which of your trees should participate, then load that invitation into the merge review flow.',
  },
  'maiden-surname-trees': {
    title: 'Suggested maiden surname trees',
    message: 'These maiden surnames appear in this tree but are not part of its surname identity. Create a separate tree for later merge review.',
  },
  'my-trees': {
    title: 'My family trees',
    message: 'Move between your family spaces here, copy a tree ID when you need to share it, and jump into the tree that feels most relevant right now.',
  },
};

export function formatRole(role: string | null | undefined) {
  if (!role) {
    return translate('Shared');
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

function formatApprovalValue(value?: string | null, emptyLabel = 'Not provided') {
  if (!value?.trim()) {
    return translate(emptyLabel);
  }

  return value.trim();
}

function formatApprovalList(values?: string[] | null, emptyLabel = 'None') {
  if (!values?.length) {
    return translate(emptyLabel);
  }

  return values.join(', ');
}

function formatApprovalLifeEvents(person?: PersonRecord | null) {
  if (!person?.lifeEvents?.length) {
    return translate('None');
  }

  return translate('{count} recorded', { count: person.lifeEvents.length });
}

function formatApprovalPhotos(person?: PersonRecord | null) {
  if (!person?.photos?.length) {
    return translate('None');
  }

  return translate('{count} photo(s)', { count: person.photos.length });
}

export function buildPersonApprovalPreviewFields(beforePerson?: PersonRecord | null, afterPerson?: PersonRecord | null): ApprovalPreviewField[] {
  if (!beforePerson && !afterPerson) {
    return [];
  }

  const fields: ApprovalPreviewField[] = [
    { label: translate('Name'), before: beforePerson ? formatPersonName(beforePerson) : null, after: afterPerson ? formatPersonName(afterPerson) : null },
    { label: translate('Middle names'), before: formatApprovalValue(beforePerson?.middleNames), after: formatApprovalValue(afterPerson?.middleNames) },
    { label: translate('Maiden name'), before: formatApprovalValue(beforePerson?.maidenName), after: formatApprovalValue(afterPerson?.maidenName) },
    { label: translate('Nicknames'), before: formatApprovalList(beforePerson?.nicknames), after: formatApprovalList(afterPerson?.nicknames) },
    { label: translate('Gender'), before: beforePerson ? formatPersonGender(beforePerson.gender) : null, after: afterPerson ? formatPersonGender(afterPerson.gender) : null },
    { label: translate('Birth date'), before: beforePerson?.birthDate ? formatPersonDate(beforePerson.birthDate) : translate('Unknown'), after: afterPerson?.birthDate ? formatPersonDate(afterPerson.birthDate) : translate('Unknown') },
    { label: translate('Death date'), before: beforePerson?.deathDate ? formatPersonDate(beforePerson.deathDate) : translate('Present'), after: afterPerson?.deathDate ? formatPersonDate(afterPerson.deathDate) : translate('Present') },
    { label: translate('Birth place'), before: formatApprovalValue(beforePerson?.birthPlace), after: formatApprovalValue(afterPerson?.birthPlace) },
    { label: translate('Hometown'), before: formatApprovalValue(beforePerson?.hometown), after: formatApprovalValue(afterPerson?.hometown) },
    { label: translate('Clan name'), before: formatApprovalValue(beforePerson?.clanName), after: formatApprovalValue(afterPerson?.clanName) },
    { label: translate('Family branch'), before: formatApprovalValue(beforePerson?.familyBranch), after: formatApprovalValue(afterPerson?.familyBranch) },
    { label: translate('Life events'), before: formatApprovalLifeEvents(beforePerson), after: formatApprovalLifeEvents(afterPerson) },
    { label: translate('Photos'), before: formatApprovalPhotos(beforePerson), after: formatApprovalPhotos(afterPerson) },
    { label: translate('Notes'), before: formatApprovalValue(beforePerson?.notes, translate('No notes')), after: formatApprovalValue(afterPerson?.notes, translate('No notes')) },
  ];

  if (!beforePerson || !afterPerson) {
    return fields;
  }

  return fields.filter((field) => field.before !== field.after);
}

function formatRelationshipType(type: RelationshipRecord['type']) {
  return type === 'spouse' ? translate('Spouse') : translate('Parent-child');
}

function formatRelationshipStatus(value?: RelationshipRecord['relationshipStatus']) {
  if (!value) {
    return translate('Not set');
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatParentChildKind(value?: RelationshipRecord['parentChildKind']) {
  if (!value) {
    return translate('Not set');
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRelationshipPeople(
  relationship: RelationshipRecord | null | undefined,
  peopleById: Map<string, PersonRecord>,
) {
  if (!relationship) {
    return translate('Unknown people');
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
      label: translate('Relationship type'),
      before: beforeRelationship ? formatRelationshipType(beforeRelationship.type) : null,
      after: afterRelationship ? formatRelationshipType(afterRelationship.type) : null,
    },
    {
      label: beforeRelationship?.type === 'spouse' || afterRelationship?.type === 'spouse' ? translate('People') : translate('Parent -> child'),
      before: formatRelationshipPeople(beforeRelationship, peopleById),
      after: formatRelationshipPeople(afterRelationship, peopleById),
    },
    {
      label: translate('Spouse status'),
      before: formatRelationshipStatus(beforeRelationship?.relationshipStatus),
      after: formatRelationshipStatus(afterRelationship?.relationshipStatus),
    },
    {
      label: translate('Parent-child kind'),
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
      return translate('Update profile');
    case 'delete-person':
      return translate('Delete profile');
    case 'create-relationship':
      return translate('Create relationship');
    case 'update-relationship':
      return translate('Update relationship');
    case 'delete-relationship':
      return translate('Delete relationship');
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
  onOpenHelperDialog: (key: TreeHelperDialogKey) => void;
  onOpenCollaboratorDialog: SharedTabProps['onOpenCollaboratorDialog'];
  openConfirm: SharedTabProps['openConfirm'];
  onRemoveCollaborator: SharedTabProps['onRemoveCollaborator'];
  onAssignPersonToUser: SharedTabProps['onAssignPersonToUser'];
  setOwnerLinkSearchQuery: (value: string) => void;
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
  onSwitchTree: SharedTabProps['onSwitchTree'];
  onCopyTreeId: (treeId: string) => Promise<void>;
};
