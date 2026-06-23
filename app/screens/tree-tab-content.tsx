import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  Chip,
  Dialog,
  IconButton,
  ProgressBar,
  Portal,
  Searchbar,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { HorizontalTabStrip } from '../../components';
import { canUserReviewApprovalRequest, isApprovalExpired, type ApprovalRequest } from '../../components/dto/approval';
import type { MergeHistoryRecord, MergeRequestRecord } from '../../components/dto/merge';
import { FamilyTreeCanvas } from '../../components';
import type { PersonGender, PersonRecord } from '../../components/dto/person';
import {
  formatPersonDate,
  getPersonFallbackAvatarIcon,
  getPersonPresenceLabel,
  getPreferredPersonPhoto,
  isPersonDeceased,
  parsePersonDate,
} from '../../components/dto/person';
import type { RelationshipRecord } from '../../components/dto/relationship';
import { getUserNameParts, type UserProfile } from '../../components/dto/user';
import { formatPersonGender, formatPersonName } from '../../components/person-formatting';
import { DatePickerModal } from 'react-native-paper-dates';
import {
  getTreeApprovalWindowHours,
  getTreeRole,
  getUnlinkedCollaborators,
  type FamilyTree,
  type SurnameVariantGroup,
} from '../../components/dto/tree';
import { GlobalStyles } from '../../constants/styles';
import { translate } from '../../i18n';
import { useI18n } from '../../hooks/use-i18n';
const dialogChrome = GlobalStyles.dialogChrome;

type SelfAssignmentSuggestion = {
  person: PersonRecord;
  tone: 'exact' | 'likely';
  reason: string;
};

type TreeManagementTabKey = 'overview' | 'collaborators' | 'approvals' | 'merges' | 'trees';
type TreeHelperDialogKey = 'tree-management' | 'surname-variants' | 'my-place' | 'approval-settings';

const TREE_MANAGEMENT_TABS: Array<{ key: TreeManagementTabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'collaborators', label: 'Collaborators' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'merges', label: 'Merges' },
  { key: 'trees', label: 'My Trees' },
];

const TREE_HELPER_COPY: Record<TreeHelperDialogKey, { title: string; message: string }> = {
  'tree-management': {
    title: 'Tree management',
    message: 'Overview shows key stats and your account link in this tree. Collaborators manages who has access. Approvals shows pending edits awaiting review and lets you adjust the auto-approve window.',
  },
  'surname-variants': {
    title: 'Surname variants',
    message: 'Surname variants belong to this tree as one shared list. Add alternate spellings or related surnames here so search and merge suggestions can recognize them across the whole tree.',
  },
  'my-place': {
    title: 'My place in this tree',
    message: 'Link your account to the family member profile that represents you in this tree. Once linked, you can open that profile quickly and the app can show you where you appear in the family network.',
  },
  'approval-settings': {
    title: 'Approval settings',
    message: 'Choose how collaborator profile and relationship edits are handled in this tree. Off applies changes immediately. 12, 24, and 48 hours create an approval window, and pending edits auto-approve if nobody reviews them before the deadline. Single-collaborator trees still apply changes immediately.',
  },
};

const settingsTabStripStyles = StyleSheet.create({
  card: {
    borderRadius: 28,
    marginTop: 8,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#1F2C1B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  content: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 2,
  },
});

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
  onLoadMergePreview: (targetTreeId: string) => Promise<void>;
  onApproveMergeRequest: (requestId: string, comment?: string) => Promise<void>;
  onRejectMergeRequest: (requestId: string, comment?: string) => Promise<void>;
  onRequestMergeChanges: (requestId: string, comment?: string) => Promise<void>;
  onUndoMerge: (requestId: string) => Promise<void>;
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

const styles = GlobalStyles.treeDetail;

function formatRole(role: string | null | undefined) {
  if (!role) {
    return translate('Shared');
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

function normaliseComparableName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.'’_-]+/g, ' ')
    .replace(/\s+/g, ' ');
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

function buildPersonApprovalPreviewFields(beforePerson?: PersonRecord | null, afterPerson?: PersonRecord | null): ApprovalPreviewField[] {
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

function buildRelationshipApprovalPreviewFields(
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

function getApprovalOperationLabel(operation: ApprovalRequest['operation']) {
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

type MemberFilters = {
  gender: 'all' | PersonGender;
  presence: 'all' | 'present' | 'deceased';
  hasNotes: boolean | null;
  hasParents: boolean | null;
  hasChildren: boolean | null;
  hasSpouse: boolean | null;
  birthDateFrom: string;
  birthDateTo: string;
};

const DEFAULT_FILTERS: MemberFilters = {
  gender: 'all',
  presence: 'all',
  hasNotes: null,
  hasParents: null,
  hasChildren: null,
  hasSpouse: null,
  birthDateFrom: '',
  birthDateTo: '',
};

const MEMBERS_PER_PAGE = 5;

function countActiveFilters(filters: MemberFilters): number {
  let count = 0;
  if (filters.gender !== 'all') count += 1;
  if (filters.presence !== 'all') count += 1;
  if (filters.hasNotes !== null) count += 1;
  if (filters.hasParents !== null) count += 1;
  if (filters.hasChildren !== null) count += 1;
  if (filters.hasSpouse !== null) count += 1;
  if (filters.birthDateFrom) count += 1;
  if (filters.birthDateTo) count += 1;
  return count;
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateFilterLabel(value: string, emptyLabel: string) {
  return value ? formatPersonDate(value) : emptyLabel;
}

function TriToggleChip({ label, value, onChange, disabled }: {
  label: string;
  value: boolean | null;
  onChange: (next: boolean | null) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const handlePress = () => onChange(value === null ? true : value === true ? false : null);
  const icon = value === true ? 'check' : value === false ? 'close' : undefined;
  const backgroundColor = value !== null ? (value ? theme.colors.primaryContainer : theme.colors.errorContainer) : undefined;
  const selectedColor = value !== null ? (value ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer) : undefined;

  return (
    <Chip
      selected={value !== null}
      icon={icon}
      onPress={handlePress}
      disabled={disabled}
      style={[{ marginRight: 8, marginBottom: 8 }, backgroundColor ? { backgroundColor } : undefined]}
      selectedColor={selectedColor}
    >
      {label}
    </Chip>
  );
}

export function PeopleRelationshipsTabContent({
  selectedTree,
  people,
  relationships,
  currentAssignedPerson,
  canEdit,
  mutating,
  loadingTreeData,
  openPersonProfile,
  onOpenAddPerson,
}: SharedTabProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [helperVisible, setHelperVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MemberFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<MemberFilters>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [birthDateFromPickerVisible, setBirthDateFromPickerVisible] = useState(false);
  const [birthDateToPickerVisible, setBirthDateToPickerVisible] = useState(false);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const selectedBirthDateFrom = useMemo(() => parsePersonDate(draftFilters.birthDateFrom) ?? undefined, [draftFilters.birthDateFrom]);
  const selectedBirthDateTo = useMemo(() => parsePersonDate(draftFilters.birthDateTo) ?? undefined, [draftFilters.birthDateTo]);

  const personRelStats = useMemo(() => {
    const parentOf = new Set<string>();
    const childOf = new Set<string>();
    const spouseOf = new Set<string>();
    relationships.forEach((relationship) => {
      if (relationship.type === 'parent-child') {
        parentOf.add(relationship.fromPersonId);
        childOf.add(relationship.toPersonId);
      } else if (relationship.type === 'spouse') {
        spouseOf.add(relationship.fromPersonId);
        spouseOf.add(relationship.toPersonId);
      }
    });
    return { parentOf, childOf, spouseOf };
  }, [relationships]);

  const filteredPeople = useMemo(
    () => people.filter((person) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (normalizedQuery) {
        const searchableText = [
          formatPersonName(person),
          person.middleNames ?? '',
          person.nicknames?.join(' ') ?? '',
          person.birthPlace ?? '',
          person.hometown ?? '',
          person.familyBranch ?? '',
          person.clanName ?? '',
          person.surnameVariantHints?.join(' ') ?? '',
          ...(selectedTree?.surnameVariantGroups.flatMap((group) => [group.primarySurname, ...group.variants]) ?? []),
          person.birthDate,
          person.deathDate,
          person.notes,
          getPersonPresenceLabel(person),
        ].join(' ').toLowerCase();
        if (!searchableText.includes(normalizedQuery)) {
          return false;
        }
      }

      if (filters.gender !== 'all' && person.gender !== filters.gender) return false;
      if (filters.presence === 'present' && person.deathDate) return false;
      if (filters.presence === 'deceased' && !person.deathDate) return false;
      if (filters.hasNotes === true && !person.notes.trim()) return false;
      if (filters.hasNotes === false && person.notes.trim()) return false;
      if (filters.hasParents === true && !personRelStats.childOf.has(person.id)) return false;
      if (filters.hasParents === false && personRelStats.childOf.has(person.id)) return false;
      if (filters.hasChildren === true && !personRelStats.parentOf.has(person.id)) return false;
      if (filters.hasChildren === false && personRelStats.parentOf.has(person.id)) return false;
      if (filters.hasSpouse === true && !personRelStats.spouseOf.has(person.id)) return false;
      if (filters.hasSpouse === false && personRelStats.spouseOf.has(person.id)) return false;

      if (filters.birthDateFrom || filters.birthDateTo) {
        if (!person.birthDate) return false;
        if (filters.birthDateFrom && person.birthDate < filters.birthDateFrom) return false;
        if (filters.birthDateTo && person.birthDate > filters.birthDateTo) return false;
      }

      return true;
    }),
    [filters, people, searchQuery, personRelStats, selectedTree?.surnameVariantGroups],
  );

  const totalPages = Math.max(1, Math.ceil(filteredPeople.length / MEMBERS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, people, selectedTree.id]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedPeople = useMemo(() => {
    const startIndex = (currentPage - 1) * MEMBERS_PER_PAGE;
    return filteredPeople.slice(startIndex, startIndex + MEMBERS_PER_PAGE);
  }, [currentPage, filteredPeople]);

  const openFilterModal = () => {
    setDraftFilters(filters);
    setFilterModalVisible(true);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setFilterModalVisible(false);
  };

  const renderMemberItem = ({ item: person }: { item: PersonRecord }) => {
    const preferredPhoto = getPreferredPersonPhoto(person);
    const isCurrentUsersPerson = currentAssignedPerson?.id === person.id;

    return (
      <Pressable
        onPress={() => openPersonProfile(person)}
        style={({ pressed }) => [{
          backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.surface,
          borderRadius: 18,
          opacity: pressed ? 0.92 : 1,
        }]}
      >
        <View style={styles.memberListRow}>
          <View style={styles.personPhotoWrap}>
            {preferredPhoto ? (
              <Image source={{ uri: preferredPhoto.url }} style={styles.personPhoto} />
            ) : (
              <View style={styles.personPhotoFallback}>
                <MaterialCommunityIcons name={getPersonFallbackAvatarIcon(person)} size={30} color={theme.colors.primary} />
              </View>
            )}
          </View>
          <View style={styles.memberListInfo}>
            <View style={styles.personNameRow}>
              <Text variant="titleMedium">{formatPersonName(person)}</Text>
              {isCurrentUsersPerson ? <Chip compact icon="account">{t('You')}</Chip> : null}
            </View>
            <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant, marginTop: 6 }]}>
              {[person.birthDate ? formatPersonDate(person.birthDate) : null, getPersonPresenceLabel(person)]
                .filter(Boolean)
                .join(' • ')}
            </Text>
          </View>
          <View style={styles.memberListTrailing}>
            <IconButton icon="chevron-right" onPress={() => openPersonProfile(person)} />
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.content, { flex: 1, paddingBottom: 0 }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.sectionHeader}>
          <View style={styles.titleWrap}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleLarge">{t('Family members')}</Text>
              <IconButton
                icon="information-outline"
                size={20}
                style={styles.helperIconButton}
                onPress={() => setHelperVisible(true)}
                accessibilityLabel={t('About family members')}
              />
            </View>
            <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {t('Tap a card to open a profile.')}
            </Text>
          </View>
          {canEdit ? (
            <Button mode="contained" icon="account-plus" onPress={onOpenAddPerson} disabled={mutating}>
              {t('Add')}
            </Button>
          ) : null}
        </View>

        <View style={styles.searchRow}>
          <Searchbar
            placeholder={t('Search family members')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
            inputStyle={{ minHeight: 0 }}
            elevation={0}
            iconColor={theme.colors.onSurfaceVariant}
            clearIcon="close"
            onClearIconPress={() => setSearchQuery('')}
          />
          <Button
            mode={activeFilterCount > 0 ? 'contained' : 'outlined'}
            icon="tune"
            onPress={openFilterModal}
            style={styles.filterButton}
            contentStyle={styles.filterButtonContent}
            labelStyle={styles.filterButtonLabel}
          >
            {activeFilterCount > 0 ? `(${activeFilterCount})` : null}
          </Button>
        </View>

        <View style={{ flex: 1 }}>
          {loadingTreeData ? (
          <View style={styles.centeredState}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
              {t('Loading tree details...')}
            </Text>
          </View>
        ) : filteredPeople.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="titleMedium">{t('No matching family members')}</Text>
            <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
              {people.length === 0
                ? (canEdit ? t('Add a family member to start building this family tree.') : t('This shared tree does not have any family members yet.'))
                : t('Try adjusting the search or filters.')}
            </Text>
            {activeFilterCount > 0 ? (
              <Button mode="outlined" onPress={() => setFilters(DEFAULT_FILTERS)} style={{ marginTop: 8 }}>
                {t('Clear filters')}
              </Button>
            ) : null}
          </View>
        ) : (
          <>
            <View style={[styles.resultsPill, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('{count} member(s)', { count: filteredPeople.length })}
              </Text>
            </View>
            <FlatList
              data={paginatedPeople}
              keyExtractor={(person) => person.id}
              renderItem={renderMemberItem}
              style={{ flex: 1 }}
              contentContainerStyle={[styles.memberList, { paddingBottom: 48 }]}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={8}
              removeClippedSubviews
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListFooterComponent={totalPages > 1 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 8 }}>
                  <IconButton
                    icon="chevron-left"
                    onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    accessibilityLabel={t('Previous page')}
                  />
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {t('Page {current} of {total}', { current: currentPage, total: totalPages })}
                  </Text>
                  <IconButton
                    icon="chevron-right"
                    onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    accessibilityLabel={t('Next page')}
                  />
                </View>
              ) : null}
            />
          </>
        )}
        </View>
      </View>

      <Portal>
        <Dialog
          visible={filterModalVisible}
          onDismiss={() => setFilterModalVisible(false)}
          style={[dialogChrome.dialog, { maxHeight: '85%', backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>{t('Filter members')}</Dialog.Title>
          <Dialog.ScrollArea style={dialogChrome.scrollArea}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={dialogChrome.content}>
              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t('Gender')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['all', 'female', 'male', 'non-binary', 'other', 'unspecified'] as const).map((gender) => (
                  <Chip
                    key={gender}
                    selected={draftFilters.gender === gender}
                    onPress={() => setDraftFilters((current) => ({ ...current, gender }))}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  >
                    {gender === 'all' ? t('All genders') : formatPersonGender(gender)}
                  </Chip>
                ))}
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t('Presence')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['all', 'present', 'deceased'] as const).map((presence) => (
                  <Chip
                    key={presence}
                    selected={draftFilters.presence === presence}
                    onPress={() => setDraftFilters((current) => ({ ...current, presence }))}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  >
                    {presence === 'all' ? t('Any') : t(presence.charAt(0).toUpperCase() + presence.slice(1))}
                  </Chip>
                ))}
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t('Birth date range')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <Button
                  mode="outlined"
                  icon="calendar-start"
                  onPress={() => setBirthDateFromPickerVisible(true)}
                >
                  {formatDateFilterLabel(draftFilters.birthDateFrom, t('From date'))}
                </Button>
                {draftFilters.birthDateFrom ? (
                  <Button onPress={() => setDraftFilters((current) => ({ ...current, birthDateFrom: '' }))}>
                    {t('Clear')}
                  </Button>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <Button
                  mode="outlined"
                  icon="calendar-end"
                  onPress={() => setBirthDateToPickerVisible(true)}
                >
                  {formatDateFilterLabel(draftFilters.birthDateTo, t('To date'))}
                </Button>
                {draftFilters.birthDateTo ? (
                  <Button onPress={() => setDraftFilters((current) => ({ ...current, birthDateTo: '' }))}>
                    {t('Clear')}
                  </Button>
                ) : null}
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t('Has notes')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <TriToggleChip label={t('Has notes')} value={draftFilters.hasNotes} onChange={(value) => setDraftFilters((current) => ({ ...current, hasNotes: value }))} />
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t('Relationships')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <TriToggleChip label={t('Has parents')} value={draftFilters.hasParents} onChange={(value) => setDraftFilters((current) => ({ ...current, hasParents: value }))} />
                <TriToggleChip label={t('Has children')} value={draftFilters.hasChildren} onChange={(value) => setDraftFilters((current) => ({ ...current, hasChildren: value }))} />
                <TriToggleChip label={t('Has spouse')} value={draftFilters.hasSpouse} onChange={(value) => setDraftFilters((current) => ({ ...current, hasSpouse: value }))} />
              </View>

              <Button mode="outlined" icon="filter-remove" onPress={() => setDraftFilters(DEFAULT_FILTERS)} style={{ marginTop: 12 }}>
                {t('Clear all filters')}
              </Button>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button mode="outlined" onPress={() => setFilterModalVisible(false)}>{t('Cancel')}</Button>
            <Button mode="contained" onPress={applyFilters}>{t('Apply')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <DatePickerModal
        locale="en"
        mode="single"
        visible={birthDateFromPickerVisible}
        date={selectedBirthDateFrom}
        onDismiss={() => setBirthDateFromPickerVisible(false)}
        onConfirm={({ date }) => {
          setBirthDateFromPickerVisible(false);
          if (date) {
            setDraftFilters((current) => ({ ...current, birthDateFrom: formatIsoDate(date) }));
          }
        }}
        saveLabel={t('Save')}
        label={t('Select earliest birth date')}
      />

      <DatePickerModal
        locale="en"
        mode="single"
        visible={birthDateToPickerVisible}
        date={selectedBirthDateTo}
        onDismiss={() => setBirthDateToPickerVisible(false)}
        onConfirm={({ date }) => {
          setBirthDateToPickerVisible(false);
          if (date) {
            setDraftFilters((current) => ({ ...current, birthDateTo: formatIsoDate(date) }));
          }
        }}
        saveLabel={t('Save')}
        label={t('Select latest birth date')}
      />

      <Portal>
        <Dialog
          visible={helperVisible}
          onDismiss={() => setHelperVisible(false)}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t('Family members')}</Dialog.Title>
          <IconButton
            icon="close"
            size={20}
            onPress={() => setHelperVisible(false)}
            style={dialogChrome.closeButton}
            accessibilityLabel={t('Close')}
          />
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium">
              {t('Each card represents one person in this family tree. Tap a card to open their full profile. Use the search bar and Filters button to narrow by name, gender, presence, birth date, photos, notes, or relationship status. The tri-state filter chips cycle through unset, must have, and must not have.')}
            </Text>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </View>
  );
}

export function VisualisationTabContent({
  people,
  relationships,
  onOpenPersonQuickActions,
  currentAssignedPerson,
  familySwitchRef,
  activeFamilyRef,
}: SharedTabProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={styles.visualisationTabContainer}>
      {people.length > 0 ? (
        <FamilyTreeCanvas
          people={people}
          relationships={relationships}
          onPressPerson={onOpenPersonQuickActions}
          currentUserPersonId={currentAssignedPerson?.id ?? undefined}
          initialFocusPersonId={currentAssignedPerson?.id ?? undefined}
          floatingControls
          fillAvailableSpace
          familySwitchRef={familySwitchRef}
          activeFamilyRef={activeFamilyRef}
        />
      ) : (
        <View style={[styles.visualisationEmptyState, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium">{t('No visual tree yet')}</Text>
          <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
            {t('Add the first family member from the profile tools or link yourself to begin drawing this tree.')}
          </Text>
        </View>
      )}
    </View>
  );
}

function ProfileTabContent({
  selectedTree,
  people,
  relationships,
  approvalRequests,
  mergeRequests,
  mergeHistory,
  mergePreview,
  peopleById,
  role,
  isOwner,
  userId,
  currentUserLabel,
  currentAssignedPerson,
  currentSelfAssignmentSuggestions,
  availableSelfLinkPeople,
  assignedPersonByUserId,
  assignedUserIdByPersonId,
  canCreateSelfProfile,
  mutating,
  onOpenCollaboratorDialog,
  openConfirm,
  onRemoveCollaborator,
  onOpenAddSelf,
  onAssignPersonToUser,
  onClearSelfAssignment,
  openPersonProfile,
  onApproveApprovalRequest,
  onRejectApprovalRequest,
  onSetApprovalWindowHours,
  onSetSurnameVariantGroups,
  onCreateMergeRequest,
  onLoadMergePreview,
  onApproveMergeRequest,
  onRejectMergeRequest,
  onRequestMergeChanges,
  onUndoMerge,
  trees,
  defaultTreeId,
  loadingTrees,
  onCreateTree,
  onEditTree,
  onConfirmDeleteTree,
  onToggleDefaultTree,
  onSwitchTree,
}: SharedTabProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [helperDialog, setHelperDialog] = useState<{ visible: boolean; key: TreeHelperDialogKey }>({
    visible: false,
    key: 'tree-management',
  });
  const [activeManagementTab, setActiveManagementTab] = useState<TreeManagementTabKey>('overview');
  const [showLinkChooser, setShowLinkChooser] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [ownerLinkTargetUserId, setOwnerLinkTargetUserId] = useState<string | null>(null);
  const [ownerLinkSearchQuery, setOwnerLinkSearchQuery] = useState('');
  const [mergeTargetTreeId, setMergeTargetTreeId] = useState('');
  const [surnameVariantDraft, setSurnameVariantDraft] = useState('');
  const [surnameVariantDrafts, setSurnameVariantDrafts] = useState<string[]>([]);
  const [surnameVariantDialogVisible, setSurnameVariantDialogVisible] = useState(false);
  const [previewApprovalRequest, setPreviewApprovalRequest] = useState<ApprovalRequest | null>(null);

  const treeSurnameVariants = useMemo(
    () => [...new Set(selectedTree.surnameVariantGroups.flatMap((group) => [group.primarySurname, ...group.variants]).map((value) => value.trim()).filter(Boolean))],
    [selectedTree.surnameVariantGroups],
  );

  const unlinkedCollaboratorCount = useMemo(
    () => getUnlinkedCollaborators(selectedTree).filter((collaborator) => collaborator.userId !== userId).length,
    [selectedTree, userId],
  );

  const filteredLinkPeople = useMemo(() => {
    const normalizedQuery = linkSearchQuery.trim().toLowerCase();

    return availableSelfLinkPeople
      .filter((person) => person.id !== currentAssignedPerson?.id)
      .filter((person) => {
        if (!normalizedQuery) {
          return true;
        }

        return [formatPersonName(person), person.birthDate, person.notes]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [availableSelfLinkPeople, currentAssignedPerson?.id, linkSearchQuery]);

  const ownerLinkTargetCollaborator = useMemo(
    () => selectedTree.collaborators.find((collaborator) => collaborator.userId === ownerLinkTargetUserId) ?? null,
    [ownerLinkTargetUserId, selectedTree.collaborators],
  );

  const filteredOwnerLinkPeople = useMemo(() => {
    if (!ownerLinkTargetUserId) {
      return [] as PersonRecord[];
    }

    const normalizedQuery = ownerLinkSearchQuery.trim().toLowerCase();

    return people
      .filter((person) => {
        const assignedUserId = assignedUserIdByPersonId.get(person.id);
        if (assignedUserId && assignedUserId !== ownerLinkTargetUserId) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [formatPersonName(person), person.birthDate, person.notes]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => formatPersonName(left).localeCompare(formatPersonName(right)))
      .slice(0, 8);
  }, [assignedUserIdByPersonId, ownerLinkSearchQuery, ownerLinkTargetUserId, people]);

  const pendingApprovalRequests = useMemo(
    () => approvalRequests.filter((request) => request.status === 'pending'),
    [approvalRequests],
  );

  const availableMergeTargetTrees = useMemo(
    () => (trees ?? []).filter((tree) => tree.id !== selectedTree.id),
    [selectedTree.id, trees],
  );

  const approvalWindowHours = useMemo(
    () => getTreeApprovalWindowHours(selectedTree),
    [selectedTree],
  );

  const approvalsDisabled = approvalWindowHours === 0;
  const approvalWindowValue = useMemo(() => {
    if (approvalWindowHours <= 0) {
      return '0';
    }
    if (approvalWindowHours <= 12) {
      return '12';
    }
    if (approvalWindowHours <= 24) {
      return '24';
    }
    return '48';
  }, [approvalWindowHours]);

  useEffect(() => {
    setSurnameVariantDrafts(treeSurnameVariants);
  }, [treeSurnameVariants]);

  const handleSelfLink = async (personId: string) => {
    if (!userId || currentAssignedPerson) {
      return;
    }

    await onAssignPersonToUser(userId, personId);
  };

  const handleOwnerLinkSuggestion = async (targetUserId: string, personId: string) => {
    await onAssignPersonToUser(targetUserId, personId);
    if (ownerLinkTargetUserId === targetUserId) {
      setOwnerLinkTargetUserId(null);
      setOwnerLinkSearchQuery('');
    }
  };

  const toggleOwnerLinkChooser = (targetUserId: string) => {
    setOwnerLinkTargetUserId((current) => (current === targetUserId ? null : targetUserId));
    setOwnerLinkSearchQuery('');
  };

  const handleSaveSurnameVariants = async () => {
    const normalizedVariants = [...new Set(surnameVariantDrafts.map((value) => value.trim()).filter(Boolean))];
    if (normalizedVariants.length === 0) {
      await onSetSurnameVariantGroups([]);
      setSurnameVariantDialogVisible(false);
      return;
    }

    const existingGroup = selectedTree.surnameVariantGroups[0];
    await onSetSurnameVariantGroups([
      {
        id: existingGroup?.id ?? `${selectedTree.id}-surname-variants`,
        primarySurname: normalizedVariants[0],
        variants: normalizedVariants.slice(1),
        notes: existingGroup?.notes ?? '',
        createdAt: existingGroup?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    setSurnameVariantDialogVisible(false);
  };

  const handleAddSurnameVariantDraft = () => {
    const nextVariant = surnameVariantDraft.trim();
    if (!nextVariant) {
      return;
    }

    if (surnameVariantDrafts.some((variant) => variant.toLowerCase() === nextVariant.toLowerCase())) {
      setSurnameVariantDraft('');
      return;
    }

    setSurnameVariantDrafts((current) => [...current, nextVariant]);
    setSurnameVariantDraft('');
  };

  const handleRemoveSurnameVariantDraft = (variantToRemove: string) => {
    setSurnameVariantDrafts((current) => current.filter((variant) => variant !== variantToRemove));
  };

  const pendingMergeRequests = mergeRequests.filter((request) => request.status === 'pending' || request.status === 'changes-requested');
  const previewRelationshipBefore = previewApprovalRequest
    ? relationships.find((relationship) => relationship.id === previewApprovalRequest.targetId) ?? null
    : null;
  const previewPersonFields = previewApprovalRequest?.entityType === 'person'
    ? buildPersonApprovalPreviewFields(
      previewApprovalRequest.payload.beforePerson ?? previewApprovalRequest.payload.deletedPerson ?? null,
      previewApprovalRequest.payload.afterPerson ?? null,
    )
    : [];
  const previewRelationshipFields = previewApprovalRequest?.entityType === 'relationship'
    ? buildRelationshipApprovalPreviewFields(
      previewApprovalRequest.operation === 'create-relationship' ? null : previewRelationshipBefore,
      previewApprovalRequest.operation === 'delete-relationship' ? null : previewApprovalRequest.payload.relationship ?? null,
      peopleById,
    )
    : [];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View>
        <View style={styles.titleWithHelperRow}>
          <Text variant="headlineSmall">{selectedTree.name}</Text>
          <IconButton
            icon="information-outline"
            size={20}
            style={styles.helperIconButton}
            onPress={() => setHelperDialog({ visible: true, key: 'tree-management' })}
            accessibilityLabel={t('About tree management')}
          />
        </View>

        <HorizontalTabStrip
          items={TREE_MANAGEMENT_TABS.map((tab) => ({ ...tab, label: t(tab.label) }))}
          activeKey={activeManagementTab}
          onChange={setActiveManagementTab}
          containerStyle={[settingsTabStripStyles.card, { backgroundColor: theme.colors.surface }]}
          contentContainerStyle={settingsTabStripStyles.content}
          itemStyle={settingsTabStripStyles.item}
        />

        {activeManagementTab === 'overview' ? (
          <>
            <View style={styles.summaryChipRow}>
              <Chip icon="account-key">{formatRole(role)}</Chip>
              <Chip icon="account-group">{t('{count} family members', { count: people.length })}</Chip>
              <Chip icon="graph-outline">{t('{count} relationships', { count: relationships.length })}</Chip>
              <Chip icon="account-multiple">{t('{count} collaborators', { count: selectedTree.collaborators.length })}</Chip>
              <Chip icon="link-variant">{t('{count} linked', { count: assignedPersonByUserId.size })}</Chip>
              {unlinkedCollaboratorCount > 0 ? <Chip icon="account-clock">{t('{count} awaiting link', { count: unlinkedCollaboratorCount })}</Chip> : null}
            </View>

            <Card mode="elevated" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.surface, marginBottom: 16 }]}>
              <Card.Content>
                <View style={styles.sectionHeader}>
                  <View style={styles.titleWrap}>
                    <View style={styles.titleWithHelperRow}>
                      <Text variant="titleLarge">{t('Surname variants')}</Text>
                      <IconButton
                        icon="information-outline"
                        size={18}
                        style={styles.helperIconButton}
                        onPress={() => setHelperDialog({ visible: true, key: 'surname-variants' })}
                        accessibilityLabel={t('About surname variants')}
                      />
                    </View>
                  </View>
                </View>

                {treeSurnameVariants.length > 0 ? (
                  <View style={styles.collaboratorChipRow}>
                    {treeSurnameVariants.map((variant) => <Chip key={`tree-variant-${variant}`} compact>{variant}</Chip>)}
                  </View>
                ) : (
                  <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                    {t('No surname variants have been added yet. Add them below so searches and merge suggestions can recognize related spellings.')}
                  </Text>
                )}

                {isOwner || role === 'editor' ? (
                  <View style={{ marginTop: 8 }}>
                    <Button
                      mode="outlined"
                      icon="shape-plus-outline"
                      onPress={() => {
                        setSurnameVariantDraft('');
                        setSurnameVariantDrafts(treeSurnameVariants);
                        setSurnameVariantDialogVisible(true);
                      }}
                      style={{ marginBottom: 8 }}
                    >
                      {treeSurnameVariants.length > 0 ? t('Manage variants ({count})', { count: treeSurnameVariants.length }) : t('Manage variants')}
                    </Button>
                    <View style={[styles.collaboratorChipRow, styles.surnameVariantDraftsRow]}>
                      {treeSurnameVariants.length > 0 ? treeSurnameVariants.map((variant) => (
                        <Chip
                          key={`saved-${variant}`}
                          compact
                        >
                          {variant}
                        </Chip>
                      )) : <Chip compact icon="information-outline">{t('No variants added yet')}</Chip>}
                    </View>
                  </View>
                ) : null}
              </Card.Content>
            </Card>

            <View style={styles.selfAssignmentSectionWrap}>
              <View style={styles.sectionHeader}>
                <View style={styles.titleWrap}>
                  <View style={styles.titleWithHelperRow}>
                    <Text variant="titleLarge">{t('My place in this tree')}</Text>
                    <IconButton
                      icon="information-outline"
                      size={18}
                      style={styles.helperIconButton}
                      onPress={() => setHelperDialog({ visible: true, key: 'my-place' })}
                      accessibilityLabel={t('About my place in this tree')}
                    />
                  </View>
                </View>
                {!currentAssignedPerson ? (
                  <Button mode="contained-tonal" icon="account-plus" onPress={onOpenAddSelf} disabled={mutating || !canCreateSelfProfile}>
                    {t('Add myself')}
                  </Button>
                ) : null}
              </View>

              <Card mode="elevated" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.surface }]}>
                <Card.Content>
                  <View style={styles.selfAssignmentHeader}>
                    <View style={styles.selfAssignmentTextWrap}>
                      <View style={styles.collaboratorChipRow}>
                        <Chip compact icon={currentAssignedPerson ? 'check-decagram' : 'link-variant-off'}>
                          {currentAssignedPerson ? t('Linked profile') : t('Not linked yet')}
                        </Chip>
                        <Chip compact icon="account">{currentUserLabel}</Chip>
                      </View>
                      <Text variant="titleMedium" style={styles.selfAssignmentTitle}>
                          {currentAssignedPerson ? formatPersonName(currentAssignedPerson) : t('Choose an existing family member or create your own profile')}
                      </Text>
                      <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                        {currentAssignedPerson
                          ? t('This linked family member represents you in the tree. Unlink first before claiming a different profile.')
                          : t('We will suggest name matches from your sign-in profile and let you link yourself manually if needed.')}
                      </Text>
                    </View>
                    {currentAssignedPerson ? (
                      <View style={styles.selfAssignmentActions}>
                        <Button mode="contained" icon="open-in-new" onPress={() => openPersonProfile(currentAssignedPerson)} disabled={mutating}>
                          {t('Open')}
                        </Button>
                        <Button
                          mode="text"
                          icon="link-off"
                          textColor={theme.colors.error}
                          onPress={() => openConfirm(
                            t('Unlink your profile'),
                            t('Remove the connection between your account and this family member profile?'),
                            t('Unlink'),
                            onClearSelfAssignment,
                          )}
                          disabled={mutating}
                        >
                          {t('Unlink')}
                        </Button>
                      </View>
                    ) : (
                      <View style={styles.selfAssignmentActions}>
                        <Button mode="contained" icon="account-search" onPress={() => setShowLinkChooser(true)} disabled={mutating}>
                          {t('Browse family members')}
                        </Button>
                        <Button mode="outlined" icon="account-plus" onPress={onOpenAddSelf} disabled={mutating || !canCreateSelfProfile}>
                          {t('Add myself')}
                        </Button>
                      </View>
                    )}
                  </View>

                  {!canCreateSelfProfile ? (
                    <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                      {t('You can link yourself to an existing person right now. Creating a new profile still requires editor access on this tree.')}
                    </Text>
                  ) : currentAssignedPerson ? (
                    <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                      {t('To claim a different person, unlink yourself from {name} first.', { name: formatPersonName(currentAssignedPerson) })}
                    </Text>
                  ) : null}
                </Card.Content>
              </Card>

              {!currentAssignedPerson ? (
                currentSelfAssignmentSuggestions.length > 0 ? (
                  <View style={styles.assignmentSuggestionList}>
                    {currentSelfAssignmentSuggestions.slice(0, 3).map((suggestion) => (
                      <Card
                        key={`suggestion-${suggestion.person.id}`}
                        mode="elevated"
                        style={[styles.assignmentSuggestionCard, { backgroundColor: theme.colors.surface }]}
                      >
                        <Card.Content>
                          <View style={styles.assignmentSuggestionRow}>
                            <View style={styles.assignmentSuggestionTextWrap}>
                              <View style={styles.collaboratorChipRow}>
                                <Chip compact icon={suggestion.tone === 'exact' ? 'star-four-points' : 'lightbulb-on-outline'}>
                                  {suggestion.tone === 'exact' ? t('Suggested match') : t('Likely match')}
                                </Chip>
                                {suggestion.person.birthDate ? <Chip compact icon="calendar">{suggestion.person.birthDate}</Chip> : null}
                              </View>
                              <Text variant="titleMedium" style={styles.selfAssignmentTitle}>{formatPersonName(suggestion.person)}</Text>
                              <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{suggestion.reason}</Text>
                            </View>
                            <Button mode="contained" onPress={() => handleSelfLink(suggestion.person.id)} disabled={mutating || !userId}>
                              {t('Link me')}
                            </Button>
                          </View>
                        </Card.Content>
                      </Card>
                    ))}
                  </View>
                ) : (
                  <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                    {t('No exact name-and-surname match was found yet, so you can browse the tree manually or create your own family member profile.')}
                  </Text>
                )
              ) : null}

              {!currentAssignedPerson && (showLinkChooser || !currentAssignedPerson) ? (
                <View style={styles.assignmentChooserWrap}>
                  <Text variant="titleMedium">{t('Link to an existing family member')}</Text>
                  <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {t('Search everyone in this tree and pick the profile that represents you best.')}
                  </Text>

                  <TextInput
                    mode="outlined"
                    label={t('Search existing family members')}
                    value={linkSearchQuery}
                    onChangeText={setLinkSearchQuery}
                    style={styles.assignmentSearchInput}
                    left={<TextInput.Icon icon="magnify" />}
                  />

                  {filteredLinkPeople.length > 0 ? (
                    <View style={styles.assignmentSuggestionList}>
                      {filteredLinkPeople.map((person) => (
                        <Card key={`assignable-${person.id}`} mode="elevated" style={[styles.assignmentSuggestionCard, { backgroundColor: theme.colors.surface }]}>
                          <Card.Content>
                            <View style={styles.assignmentSuggestionRow}>
                              <View style={styles.assignmentSuggestionTextWrap}>
                                <Text variant="titleMedium">{formatPersonName(person)}</Text>
                                <View style={styles.collaboratorChipRow}>
                                  {person.birthDate ? <Chip compact icon="calendar">{person.birthDate}</Chip> : null}
                                  <MaterialCommunityIcons
                                    name={isPersonDeceased(person) ? 'flower-outline' : 'heart-pulse'}
                                    size={18}
                                    color={theme.colors.onSurfaceVariant}
                                  />
                                </View>
                              </View>
                              <Button mode="contained-tonal" onPress={() => handleSelfLink(person.id)} disabled={mutating || !userId}>
                                {t('Link me')}
                              </Button>
                            </View>
                          </Card.Content>
                        </Card>
                      ))}
                    </View>
                  ) : (
                    <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                      {t('No available family members match that search yet.')}
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {activeManagementTab === 'collaborators' ? (
          <View style={styles.collaboratorSectionWrap}>
            <View style={styles.sectionHeader}>
              <View style={styles.titleWrap}>
                <Text variant="titleLarge">{t('Collaborators')}</Text>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {t('Owners manage access. Editors can update content. Viewers can browse.')}
                </Text>
              </View>
              {isOwner ? (
                <Button mode="contained" icon="account-plus" onPress={onOpenCollaboratorDialog} disabled={mutating}>
                  {t('Add collaborator')}
                </Button>
              ) : null}
            </View>

            <View style={styles.collaboratorList}>
              {selectedTree.collaborators.map((collaborator) => {
                const linkedPerson = assignedPersonByUserId.get(collaborator.userId) ?? null;
                const collaboratorSuggestions = !linkedPerson
                  ? buildSelfAssignmentSuggestions(collaborator, people, assignedUserIdByPersonId, collaborator.userId).slice(0, 2)
                  : [];
                const isOwnerSuggestionTarget = ownerLinkTargetUserId === collaborator.userId;

                return (
                  <Card key={collaborator.userId} mode="elevated" style={[styles.collaboratorCard, { backgroundColor: theme.colors.surface }]}>
                    <Card.Content>
                      <View style={styles.collaboratorRow}>
                        <View style={styles.collaboratorTextWrap}>
                          <Text variant="titleMedium">{collaborator.displayName || collaborator.email}</Text>
                          <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{collaborator.email}</Text>
                          <View style={styles.collaboratorChipRow}>
                            <Chip compact>{formatRole(collaborator.role)}</Chip>
                            {collaborator.userId === userId ? <Chip compact icon="account">{t('You')}</Chip> : null}
                            {linkedPerson ? <Chip compact icon="link-variant">{formatPersonName(linkedPerson)}</Chip> : null}
                          </View>
                        </View>
                        {isOwner && collaborator.role !== 'owner' ? (
                          <IconButton
                            icon="account-remove"
                            iconColor="#C62828"
                            onPress={() => openConfirm(
                              t('Remove collaborator'),
                              t('Remove {name} from this tree?', { name: collaborator.displayName || collaborator.email }),
                              t('Remove'),
                              async () => onRemoveCollaborator(collaborator.userId),
                            )}
                            disabled={mutating}
                          />
                        ) : null}
                      </View>

                      {isOwner && collaborator.userId !== userId && !linkedPerson ? (
                        <View style={styles.ownerSuggestionWrap}>
                          <Text variant="titleSmall">{t('Suggest a matching family member')}</Text>
                          <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                            {t('Help {name} get started by linking the family member that looks like them best.', { name: collaborator.displayName || collaborator.email })}
                          </Text>

                          {collaboratorSuggestions.length > 0 ? (
                            <View style={styles.assignmentSuggestionList}>
                              {collaboratorSuggestions.map((suggestion) => (
                                <Card
                                  key={`owner-suggestion-${collaborator.userId}-${suggestion.person.id}`}
                                  mode="elevated"
                                  style={[styles.assignmentSuggestionCard, { backgroundColor: theme.colors.surface }]}
                                >
                                  <Card.Content>
                                    <View style={styles.assignmentSuggestionRow}>
                                      <View style={styles.assignmentSuggestionTextWrap}>
                                        <View style={styles.collaboratorChipRow}>
                                          <Chip compact icon={suggestion.tone === 'exact' ? 'star-four-points' : 'lightbulb-on-outline'}>
                                            {suggestion.tone === 'exact' ? t('Suggested match') : t('Likely match')}
                                          </Chip>
                                          {suggestion.person.birthDate ? <Chip compact icon="calendar">{suggestion.person.birthDate}</Chip> : null}
                                        </View>
                                        <Text variant="titleMedium" style={styles.selfAssignmentTitle}>{formatPersonName(suggestion.person)}</Text>
                                        <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{suggestion.reason}</Text>
                                      </View>
                                      <Button mode="contained-tonal" onPress={() => handleOwnerLinkSuggestion(collaborator.userId, suggestion.person.id)} disabled={mutating}>
                                        {t('Suggest link')}
                                      </Button>
                                    </View>
                                  </Card.Content>
                                </Card>
                              ))}
                            </View>
                          ) : (
                            <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                              {t('No obvious name match yet, but you can still choose a family member manually.')}
                            </Text>
                          )}

                          <Button mode="outlined" icon="account-search" onPress={() => toggleOwnerLinkChooser(collaborator.userId)} disabled={mutating} style={styles.ownerSuggestionButton}>
                            {isOwnerSuggestionTarget ? t('Hide family members') : t('Choose family member')}
                          </Button>

                          {isOwnerSuggestionTarget ? (
                            <View style={styles.assignmentChooserWrap}>
                              <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                                {t('Search unlinked people and connect one to {name}.', { name: ownerLinkTargetCollaborator?.displayName || ownerLinkTargetCollaborator?.email || t('this collaborator') })}
                              </Text>

                              <TextInput
                                mode="outlined"
                                label={t('Search family members to suggest')}
                                value={ownerLinkSearchQuery}
                                onChangeText={setOwnerLinkSearchQuery}
                                style={styles.assignmentSearchInput}
                                left={<TextInput.Icon icon="magnify" />}
                              />

                              {filteredOwnerLinkPeople.length > 0 ? (
                                <View style={styles.assignmentSuggestionList}>
                                  {filteredOwnerLinkPeople.map((person) => (
                                    <Card key={`owner-assignable-${collaborator.userId}-${person.id}`} mode="elevated" style={[styles.assignmentSuggestionCard, { backgroundColor: theme.colors.surface }]}>
                                      <Card.Content>
                                        <View style={styles.assignmentSuggestionRow}>
                                          <View style={styles.assignmentSuggestionTextWrap}>
                                            <Text variant="titleMedium">{formatPersonName(person)}</Text>
                                            <View style={styles.collaboratorChipRow}>
                                              {person.birthDate ? <Chip compact icon="calendar">{person.birthDate}</Chip> : null}
                                              <MaterialCommunityIcons
                                                name={isPersonDeceased(person) ? 'flower-outline' : 'heart-pulse'}
                                                size={18}
                                                color={theme.colors.onSurfaceVariant}
                                              />
                                            </View>
                                          </View>
                                          <Button mode="contained-tonal" onPress={() => handleOwnerLinkSuggestion(collaborator.userId, person.id)} disabled={mutating}>
                                            {t('Suggest link')}
                                          </Button>
                                        </View>
                                      </Card.Content>
                                    </Card>
                                  ))}
                                </View>
                              ) : (
                                <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                                  {t('No available family members match that search yet.')}
                                </Text>
                              )}
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </Card.Content>
                  </Card>
                );
              })}
            </View>
          </View>
        ) : null}

        {activeManagementTab === 'approvals' ? (
          <View style={styles.collaboratorSectionWrap}>
            <View style={styles.treeSettingsWrap}>
              <View style={styles.titleWithHelperRow}>
                <Text variant="titleSmall">{t('Approval settings')}</Text>
                <IconButton
                  icon="information-outline"
                  size={18}
                  style={styles.helperIconButton}
                  onPress={() => setHelperDialog({ visible: true, key: 'approval-settings' })}
                  accessibilityLabel={t('About approval settings')}
                />
              </View>
              <View style={styles.summaryChipRow}>
                <Chip compact icon={approvalsDisabled ? 'flash-outline' : 'timer-outline'}>
                  {approvalsDisabled ? t('Approvals off') : t('Current window: {hours}h', { hours: approvalWindowHours })}
                </Chip>
              </View>
              <SegmentedButtons
                value={approvalWindowValue}
                onValueChange={(value) => {
                  if (!isOwner || mutating) {
                    return;
                  }
                  void onSetApprovalWindowHours(Number(value));
                }}
                buttons={[
                  { value: '0', label: t('Off'), disabled: !isOwner || mutating },
                  { value: '12', label: '12h', disabled: !isOwner || mutating },
                  { value: '24', label: '24h', disabled: !isOwner || mutating },
                  { value: '48', label: '48h', disabled: !isOwner || mutating },
                ]}
                style={styles.managementSegmentedButtons}
                density="small"
              />
            </View>

            <View style={styles.collaboratorSectionWrap}>
              <View style={styles.sectionHeader}>
                <View style={styles.titleWrap}>
                  <Text variant="titleLarge">{t('Pending approvals')}</Text>
                  <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {approvalsDisabled
                      ? t('Approvals are currently off. Any requests listed here were created before that change and can still be reviewed.')
                      : t('Collaborator edits awaiting review - they auto-approve if nobody acts before the deadline.')}
                  </Text>
                </View>
              </View>

              {pendingApprovalRequests.length > 0 ? (
                <View style={styles.collaboratorList}>
                  {pendingApprovalRequests.map((request) => {
                    const canReview = canUserReviewApprovalRequest(request, userId);
                    const expiresSoon = isApprovalExpired(request);

                    return (
                      <Card
                        key={request.id}
                        mode="elevated"
                        style={[styles.collaboratorCard, { backgroundColor: canReview ? theme.colors.surfaceVariant : theme.colors.surface }]}
                      >
                        <Card.Content>
                          <View style={styles.approvalRequestHeader}>
                            <View style={styles.collaboratorTextWrap}>
                              <View style={styles.collaboratorChipRow}>
                                <Chip compact icon={canReview ? 'clipboard-check-outline' : 'clock-outline'}>
                                  {canReview ? t('Needs your review') : t('Awaiting review')}
                                </Chip>
                                <Chip compact icon={expiresSoon ? 'timer-alert-outline' : 'timer-outline'}>
                                  {t('Auto-approves {date}', { date: request.expiresAt.slice(0, 16).replace('T', ' ') })}
                                </Chip>
                              </View>
                              <Text variant="titleMedium" style={styles.selfAssignmentTitle}>{request.title}</Text>
                              <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{request.description}</Text>
                              <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{t('Requested by {name}', { name: request.requestedByLabel })}</Text>
                            </View>
                            <View style={styles.approvalRequestActions}>
                              <Button mode="outlined" icon="eye-outline" onPress={() => setPreviewApprovalRequest(request)}>
                                {t('Preview change')}
                              </Button>
                              {canReview ? (
                                <>
                                  <Button mode="contained" onPress={() => onApproveApprovalRequest(request.id)} disabled={mutating}>
                                    {t('Approve')}
                                  </Button>
                                  <Button mode="outlined" textColor={theme.colors.error} onPress={() => onRejectApprovalRequest(request.id)} disabled={mutating}>
                                    {t('Reject')}
                                  </Button>
                                </>
                              ) : null}
                            </View>
                          </View>
                        </Card.Content>
                      </Card>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text variant="titleMedium">{t('No pending approvals')}</Text>
                  <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                    {t('Any collaborator-submitted family member or relationship edits waiting for review will appear here.')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {activeManagementTab === 'merges' ? (
          <View style={styles.collaboratorSectionWrap}>
            <View style={styles.sectionHeader}>
              <View style={styles.titleWrap}>
                <Text variant="titleLarge">{t('Collaborative merges')}</Text>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {t('Suggest a merge only when likely relatives exist, then collect editor approvals from both trees before anything is applied.')}
                </Text>
              </View>
            </View>

            <Card mode="elevated" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.surface, marginBottom: 16 }]}>
              <Card.Content>
                <Text variant="titleMedium" style={{ marginBottom: 8 }}>{t('Start a merge review')}</Text>
                <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {t('Enter another tree ID, preview likely person matches, then submit the merge suggestion for joint review.')}
                </Text>
                <TextInput
                  mode="outlined"
                  label={t('Target tree ID')}
                  value={mergeTargetTreeId}
                  onChangeText={setMergeTargetTreeId}
                  style={{ marginTop: 8 }}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Button mode="outlined" onPress={() => onLoadMergePreview(mergeTargetTreeId)} disabled={mutating || !mergeTargetTreeId.trim()}>
                    {t('Preview')}
                  </Button>
                  <Button mode="contained" onPress={() => onCreateMergeRequest(mergeTargetTreeId)} disabled={mutating || !mergeTargetTreeId.trim()}>
                    {t('Submit merge')}
                  </Button>
                </View>

                {availableMergeTargetTrees.length > 0 ? (
                  <View style={[styles.collaboratorChipRow, { marginTop: 12 }]}>
                    {availableMergeTargetTrees.slice(0, 6).map((tree) => (
                      <Chip key={tree.id} compact onPress={() => setMergeTargetTreeId(tree.id)}>
                        {tree.name}
                      </Chip>
                    ))}
                  </View>
                ) : null}
              </Card.Content>
            </Card>

            {mergePreview ? (
              <Card mode="elevated" style={[styles.collaboratorCard, { backgroundColor: theme.colors.surface, marginBottom: 16 }]}>
                <Card.Content>
                  <Text variant="titleMedium">{t('Merge preview')}</Text>
                  <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {t('{source} ({sourceCount}) to {target} ({targetCount})', {
                      source: mergePreview.sourceTree.treeName,
                      sourceCount: mergePreview.sourceTree.personCount,
                      target: mergePreview.targetTree.treeName,
                      targetCount: mergePreview.targetTree.personCount,
                    })}
                  </Text>
                  <View style={styles.summaryChipRow}>
                    <Chip compact icon="account-switch">{t('{count} possible matches', { count: mergePreview.matches.length })}</Chip>
                    <Chip compact icon="source-branch-plus">{t('{count} new branches', { count: mergePreview.newBranchCount })}</Chip>
                    <Chip compact icon="alert-circle-outline">{t('{count} conflicts', { count: mergePreview.conflicts.length })}</Chip>
                  </View>
                  {mergePreview.matches.slice(0, 6).map((match) => (
                    <View key={match.id} style={{ marginTop: 12 }}>
                      <View style={styles.collaboratorChipRow}>
                        <Chip compact icon="gauge">{match.confidenceScore}%</Chip>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{match.confidenceLabel}</Text>
                      </View>
                      <ProgressBar progress={match.confidenceScore / 100} style={{ marginTop: 6, height: 8, borderRadius: 999 }} />
                      <Text variant="bodySmall" style={{ marginTop: 6 }}>
                        {match.guidedQuestions[0]?.prompt}
                      </Text>
                      {match.conflicts.length > 0 ? (
                        <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>
                          {t('Conflicts: {fields}', { fields: match.conflicts.map((conflict) => conflict.field).join(', ') })}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </Card.Content>
              </Card>
            ) : null}

            <View style={styles.sectionHeader}>
              <View style={styles.titleWrap}>
                <Text variant="titleLarge">{t('Pending merge approvals')}</Text>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {t('Each merge needs at least one editor approval from each affected tree.')}
                </Text>
              </View>
            </View>

            {pendingMergeRequests.length > 0 ? (
              <View style={styles.collaboratorList}>
                {pendingMergeRequests.map((request) => (
                  <Card key={request.id} mode="elevated" style={[styles.collaboratorCard, { backgroundColor: theme.colors.surface }]}>
                    <Card.Content>
                      <Text variant="titleMedium">{request.preview.sourceTree.treeName} ↔ {request.preview.targetTree.treeName}</Text>
                      <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                        {t('Suggested by {name}. {duplicates} strong duplicate candidates, {conflicts} conflicts.', {
                          name: request.suggestedByLabel,
                          duplicates: request.preview.duplicateCount,
                          conflicts: request.preview.conflicts.length,
                        })}
                      </Text>
                      <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
                        {request.approvals.map((approval) => (
                          <Chip key={`${request.id}-${approval.treeId}-${approval.editorUserId}`} compact icon={approval.decision === 'approve' ? 'check-circle-outline' : approval.decision === 'reject' ? 'close-circle-outline' : 'message-text-outline'}>
                            {approval.editorLabel}
                          </Chip>
                        ))}
                      </View>
                      <View style={{ marginTop: 8 }}>
                        {request.preview.matches.slice(0, 3).map((match) => (
                          <View key={`${request.id}-${match.id}`} style={{ marginBottom: 8 }}>
                            <Text variant="bodySmall">{match.confidenceScore}% · {match.confidenceLabel}</Text>
                            <ProgressBar progress={match.confidenceScore / 100} style={{ marginTop: 4, height: 8, borderRadius: 999 }} />
                          </View>
                        ))}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <Button mode="contained" onPress={() => onApproveMergeRequest(request.id)} disabled={mutating}>{t('Approve')}</Button>
                        <Button mode="outlined" onPress={() => onRequestMergeChanges(request.id, t('Please review the highlighted conflicts before merging.'))} disabled={mutating}>{t('Request changes')}</Button>
                        <Button mode="text" textColor={theme.colors.error} onPress={() => onRejectMergeRequest(request.id)} disabled={mutating}>{t('Reject')}</Button>
                      </View>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text variant="titleMedium">{t('No pending merge reviews')}</Text>
                <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                  {t('Merge suggestions with likely relative matches will appear here for joint editor approval.')}
                </Text>
              </View>
            )}

            <Divider style={{ marginVertical: 16 }} />

            <View style={styles.sectionHeader}>
              <View style={styles.titleWrap}>
                <Text variant="titleLarge">{t('Merge history and undo')}</Text>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {t('Undo preserves the audit trail and restores the pre-merge snapshot where possible.')}
                </Text>
              </View>
            </View>

            {mergeHistory.length > 0 ? (
              <View style={styles.collaboratorList}>
                {mergeHistory.map((entry) => (
                  <Card key={entry.id} mode="elevated" style={[styles.collaboratorCard, { backgroundColor: theme.colors.surface }]}>
                    <Card.Content>
                      <Text variant="titleMedium">{entry.summary}</Text>
                      <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                        {t('{matches} reviewed matches · {approvals} approval actions · {people} people changed', {
                          matches: entry.preview.matches.length,
                          approvals: entry.approvals.length,
                          people: entry.changedPersonIds.length,
                        })}
                      </Text>
                      <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
                        <Chip compact icon="history">{entry.status}</Chip>
                        <Chip compact icon="calendar-clock">{entry.createdAt.slice(0, 16).replace('T', ' ')}</Chip>
                      </View>
                      <Button mode="outlined" icon="undo" onPress={() => onUndoMerge(entry.mergeRequestId)} disabled={mutating || entry.status !== 'applied'} style={{ marginTop: 8 }}>
                        {t('Preview and undo merge')}
                      </Button>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text variant="titleMedium">{t('No merge history yet')}</Text>
                <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                  {t('Applied or rejected merge activity, approval history, confidence scores, and undoable snapshots will appear here.')}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {activeManagementTab === 'trees' ? (
          <View>
            <View style={styles.sectionHeader}>
              <View style={styles.titleWrap}>
                <Text variant="titleMedium">{t('My Family Trees')}</Text>
                <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {t('Switch between trees or manage the one you are working in now.')}
                </Text>
              </View>
            </View>
            {loadingTrees ? (
              <View style={styles.centeredState}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : (trees ?? []).length === 0 ? (
              <View style={styles.emptyState}>
                <Text variant="titleMedium">{t('No trees yet')}</Text>
                <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                  {t('Create your first family tree to start building.')}
                </Text>
                {onCreateTree ? (
                  <Button mode="contained" icon="plus" onPress={onCreateTree} disabled={mutating} style={styles.emptyStateButton}>
                    {t('Create a tree')}
                  </Button>
                ) : null}
              </View>
            ) : (
              (trees ?? []).map((tree) => {
                const isDefault = tree.id === defaultTreeId;
                const isSelected = tree.id === selectedTree.id;
                const treeRole = getTreeRole(tree, userId);

                return (
                  <Card
                    key={tree.id}
                    style={[
                      styles.personCard,
                      {
                        backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.surface,
                      },
                    ]}
                    mode="elevated"
                  >
                    <Card.Content>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text variant="titleMedium" style={isSelected ? { color: theme.colors.onPrimaryContainer } : undefined}>
                              {tree.name}
                            </Text>
                            {isDefault ? <Chip compact icon="star" style={{ backgroundColor: theme.colors.secondaryContainer }}>{t('Default')}</Chip> : null}
                            {isSelected ? <Chip compact icon="check-circle" style={{ backgroundColor: theme.colors.primaryContainer }}>{t('Active')}</Chip> : null}
                          </View>
                          <Text variant="bodySmall" style={{ color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant, marginTop: 2 }}>
                            {t('{count} member(s) · {role}', { count: tree.memberIds?.length ?? 0, role: formatRole(treeRole) })}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          {onToggleDefaultTree ? (
                            <IconButton
                              icon={isDefault ? 'star' : 'star-outline'}
                              size={20}
                              iconColor={isDefault ? theme.colors.secondary : theme.colors.onSurfaceVariant}
                              onPress={() => onToggleDefaultTree(tree)}
                              disabled={mutating}
                            />
                          ) : null}
                          {!isSelected && onSwitchTree ? (
                            <IconButton
                              icon="swap-horizontal"
                              size={20}
                              onPress={() => onSwitchTree(tree)}
                              disabled={mutating}
                            />
                          ) : null}
                          {onEditTree ? (
                            <IconButton
                              icon="pencil-outline"
                              size={20}
                              onPress={() => onEditTree(tree)}
                              disabled={mutating}
                            />
                          ) : null}
                          {onConfirmDeleteTree && treeRole === 'owner' ? (
                            <IconButton
                              icon="delete-outline"
                              size={20}
                              iconColor={theme.colors.error}
                              onPress={() => onConfirmDeleteTree(tree)}
                              disabled={mutating}
                            />
                          ) : null}
                        </View>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })
            )}
          </View>
        ) : null}
      </View>

      <Portal>
        <Dialog
          visible={surnameVariantDialogVisible}
          onDismiss={() => {
            setSurnameVariantDraft('');
            setSurnameVariantDrafts(treeSurnameVariants);
            setSurnameVariantDialogVisible(false);
          }}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>{t('Manage surname variants')}</Dialog.Title>
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodySmall" style={{ marginBottom: 12, color: theme.colors.onSurfaceVariant }}>
              {t('Add every alternate spelling or related surname that should be recognized anywhere in this tree.')}
            </Text>
            <TextInput
              mode="outlined"
              label={t('Add variant')}
              value={surnameVariantDraft}
              onChangeText={setSurnameVariantDraft}
              onSubmitEditing={handleAddSurnameVariantDraft}
              style={{ marginBottom: 12 }}
            />
            <Button
              mode="contained-tonal"
              icon="plus"
              onPress={handleAddSurnameVariantDraft}
              disabled={!surnameVariantDraft.trim()}
              style={{ marginBottom: 12 }}
            >
              {t('Add variant')}
            </Button>
            <View style={styles.collaboratorChipRow}>
              {surnameVariantDrafts.length > 0 ? surnameVariantDrafts.map((variant) => (
                <Chip
                  key={`dialog-${variant}`}
                  compact
                  icon="close-circle-outline"
                  onPress={() => handleRemoveSurnameVariantDraft(variant)}
                >
                  {variant}
                </Chip>
              )) : <Chip compact icon="information-outline">{t('Variants will appear here as chips')}</Chip>}
            </View>
          </Dialog.Content>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button onPress={() => {
              setSurnameVariantDraft('');
              setSurnameVariantDrafts(treeSurnameVariants);
              setSurnameVariantDialogVisible(false);
            }}>
              {t('Cancel')}
            </Button>
            <Button mode="contained" onPress={handleSaveSurnameVariants} disabled={mutating}>
              {t('Save')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={helperDialog.visible}
          onDismiss={() => setHelperDialog((current) => ({ ...current, visible: false }))}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(TREE_HELPER_COPY[helperDialog.key].title)}</Dialog.Title>
          <IconButton
            icon="close"
            size={20}
            onPress={() => setHelperDialog((current) => ({ ...current, visible: false }))}
            style={dialogChrome.closeButton}
            accessibilityLabel={t('Close')}
          />
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium">{t(TREE_HELPER_COPY[helperDialog.key].message)}</Text>
          </Dialog.Content>
        </Dialog>

        <Dialog
          visible={!!previewApprovalRequest}
          onDismiss={() => setPreviewApprovalRequest(null)}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
            {previewApprovalRequest?.title ?? t('Approval preview')}
          </Dialog.Title>
          <IconButton
            icon="close"
            size={20}
            onPress={() => setPreviewApprovalRequest(null)}
            style={dialogChrome.closeButton}
            accessibilityLabel={t('Close')}
          />
          <Dialog.ScrollArea style={dialogChrome.scrollArea}>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
              {previewApprovalRequest ? (
                <View>
                  <View style={styles.collaboratorChipRow}>
                    <Chip compact icon="swap-horizontal">{getApprovalOperationLabel(previewApprovalRequest.operation)}</Chip>
                    <Chip compact icon="account">{previewApprovalRequest.requestedByLabel}</Chip>
                  </View>

                  {previewApprovalRequest.entityType === 'person' ? (
                    <View style={{ marginTop: 16, gap: 12 }}>
                      {previewPersonFields.length > 0 ? previewPersonFields.map((field) => (
                        <View key={`${previewApprovalRequest.id}-${field.label}`}>
                          <Text variant="labelLarge">{field.label}</Text>
                          {field.before !== undefined && field.before !== null ? (
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                              {t('Before: {value}', { value: field.before })}
                            </Text>
                          ) : null}
                          {field.after !== undefined && field.after !== null ? (
                            <Text variant="bodySmall" style={{ marginTop: 2 }}>
                              {t('After: {value}', { value: field.after })}
                            </Text>
                          ) : null}
                        </View>
                      )) : (
                        <Text variant="bodyMedium">{t('No field-level preview is available for this request.')}</Text>
                      )}
                    </View>
                  ) : (
                    <View style={{ marginTop: 16, gap: 12 }}>
                      {previewRelationshipFields.length > 0 ? previewRelationshipFields.map((field) => (
                        <View key={`${previewApprovalRequest.id}-${field.label}`}>
                          <Text variant="labelLarge">{field.label}</Text>
                          {field.before !== undefined && field.before !== null ? (
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                              {t('Before: {value}', { value: field.before })}
                            </Text>
                          ) : null}
                          {field.after !== undefined && field.after !== null ? (
                            <Text variant="bodySmall" style={{ marginTop: 2 }}>
                              {t('After: {value}', { value: field.after })}
                            </Text>
                          ) : null}
                        </View>
                      )) : (
                        <Text variant="bodyMedium">{t('No field-level preview is available for this request.')}</Text>
                      )}
                    </View>
                  )}
                </View>
              ) : null}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

export const TreeSettingsTabContent = ProfileTabContent;
