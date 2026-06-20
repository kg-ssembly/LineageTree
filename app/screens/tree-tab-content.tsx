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
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
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
} from '../../components/dto/person';
import type { RelationshipRecord } from '../../components/dto/relationship';
import { getUserNameParts, type UserProfile } from '../../components/dto/user';
import { formatPersonName } from '../../components/person-formatting';
import {
  getAssignedPersonId,
  getTreeApprovalWindowHours,
  getTreeRole,
  getUnlinkedCollaborators,
  type FamilyTree,
  type SurnameVariantGroup,
} from '../../components/dto/tree';
import { GlobalStyles } from '../../constants/styles';
const dialogChrome = GlobalStyles.dialogChrome;

type SelfAssignmentSuggestion = {
  person: PersonRecord;
  tone: 'exact' | 'likely';
  reason: string;
};

type TreeManagementTabKey = 'overview' | 'collaborators' | 'approvals' | 'merges' | 'trees';

const TREE_MANAGEMENT_TABS: Array<{ key: TreeManagementTabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'collaborators', label: 'Collaborators' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'merges', label: 'Merges' },
  { key: 'trees', label: 'My Trees' },
];

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
    return 'Shared';
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
  birthYearFrom: string;
  birthYearTo: string;
};

const DEFAULT_FILTERS: MemberFilters = {
  gender: 'all',
  presence: 'all',
  hasNotes: null,
  hasParents: null,
  hasChildren: null,
  hasSpouse: null,
  birthYearFrom: '',
  birthYearTo: '',
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
  if (filters.birthYearFrom) count += 1;
  if (filters.birthYearTo) count += 1;
  return count;
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
  const [helperVisible, setHelperVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MemberFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<MemberFilters>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

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

      if (filters.birthYearFrom || filters.birthYearTo) {
        const birthYear = person.birthDate ? parseInt(person.birthDate.slice(0, 4), 10) : null;
        if (birthYear === null) return false;
        if (filters.birthYearFrom && birthYear < parseInt(filters.birthYearFrom, 10)) return false;
        if (filters.birthYearTo && birthYear > parseInt(filters.birthYearTo, 10)) return false;
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
              {isCurrentUsersPerson ? <Chip compact icon="account">You</Chip> : null}
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
              <Text variant="titleLarge">Family members</Text>
              <IconButton
                icon="information-outline"
                size={20}
                style={styles.helperIconButton}
                onPress={() => setHelperVisible(true)}
                accessibilityLabel="About family members"
              />
            </View>
            <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Tap a card to open a profile.
            </Text>
          </View>
          {canEdit ? (
            <Button mode="contained" icon="account-plus" onPress={onOpenAddPerson} disabled={mutating}>
              Add
            </Button>
          ) : null}
        </View>

        <View style={styles.searchRow}>
          <Searchbar
            placeholder="Search family members"
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
            contentStyle={{ flexDirection: 'row-reverse' }}
          >
            {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </Button>
        </View>

        <View style={{ flex: 1 }}>
          {loadingTreeData ? (
          <View style={styles.centeredState}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
              Loading tree details...
            </Text>
          </View>
        ) : filteredPeople.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="titleMedium">No matching family members</Text>
            <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
              {people.length === 0
                ? (canEdit ? 'Add a family member to start building this family tree.' : 'This shared tree does not have any family members yet.')
                : 'Try adjusting the search or filters.'}
            </Text>
            {activeFilterCount > 0 ? (
              <Button mode="outlined" onPress={() => setFilters(DEFAULT_FILTERS)} style={{ marginTop: 8 }}>
                Clear filters
              </Button>
            ) : null}
          </View>
        ) : (
          <>
            <View style={[styles.resultsPill, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {filteredPeople.length} member{filteredPeople.length !== 1 ? 's' : ''}
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
                  <Button
                    mode="outlined"
                    onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    Page {currentPage} of {totalPages}
                  </Text>
                  <Button
                    mode="outlined"
                    onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
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
          <Dialog.Title style={dialogChrome.dialogTitle}>Filter members</Dialog.Title>
          <Dialog.ScrollArea style={dialogChrome.scrollArea}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={dialogChrome.content}>
              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>Gender</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['all', 'female', 'male', 'non-binary', 'other', 'unspecified'] as const).map((gender) => (
                  <Chip
                    key={gender}
                    selected={draftFilters.gender === gender}
                    onPress={() => setDraftFilters((current) => ({ ...current, gender }))}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  >
                    {gender === 'all' ? 'All genders' : gender.charAt(0).toUpperCase() + gender.slice(1)}
                  </Chip>
                ))}
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>Presence</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['all', 'present', 'deceased'] as const).map((presence) => (
                  <Chip
                    key={presence}
                    selected={draftFilters.presence === presence}
                    onPress={() => setDraftFilters((current) => ({ ...current, presence }))}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  >
                    {presence === 'all' ? 'Any' : presence.charAt(0).toUpperCase() + presence.slice(1)}
                  </Chip>
                ))}
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>Birth year range</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  mode="outlined"
                  label="From"
                  value={draftFilters.birthYearFrom}
                  onChangeText={(value) => setDraftFilters((current) => ({ ...current, birthYearFrom: value.replace(/\D/g, '') }))}
                  keyboardType="numeric"
                  maxLength={4}
                  style={{ flex: 1 }}
                />
                <TextInput
                  mode="outlined"
                  label="To"
                  value={draftFilters.birthYearTo}
                  onChangeText={(value) => setDraftFilters((current) => ({ ...current, birthYearTo: value.replace(/\D/g, '') }))}
                  keyboardType="numeric"
                  maxLength={4}
                  style={{ flex: 1 }}
                />
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>Has notes</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <TriToggleChip label="Has notes" value={draftFilters.hasNotes} onChange={(value) => setDraftFilters((current) => ({ ...current, hasNotes: value }))} />
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>Relationships</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <TriToggleChip label="Has parents" value={draftFilters.hasParents} onChange={(value) => setDraftFilters((current) => ({ ...current, hasParents: value }))} />
                <TriToggleChip label="Has children" value={draftFilters.hasChildren} onChange={(value) => setDraftFilters((current) => ({ ...current, hasChildren: value }))} />
                <TriToggleChip label="Has spouse" value={draftFilters.hasSpouse} onChange={(value) => setDraftFilters((current) => ({ ...current, hasSpouse: value }))} />
              </View>

              <Button mode="outlined" icon="filter-remove" onPress={() => setDraftFilters(DEFAULT_FILTERS)} style={{ marginTop: 12 }}>
                Clear all filters
              </Button>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button mode="outlined" onPress={() => setFilterModalVisible(false)}>Cancel</Button>
            <Button mode="contained" onPress={applyFilters}>Apply</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={helperVisible}
          onDismiss={() => setHelperVisible(false)}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>Family members</Dialog.Title>
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium">
              Each card represents one person in this family tree. Tap a card to open their full profile. Use the search bar and Filters button to narrow by name, gender, presence, birth year, photos, notes, or relationship status. The tri-state filter chips cycle through unset, must have, and must not have.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button onPress={() => setHelperVisible(false)}>Close</Button>
          </Dialog.Actions>
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
          <Text variant="titleMedium">No visual tree yet</Text>
          <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
            Add the first family member from the profile tools or link yourself to begin drawing this tree.
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
  const [helperVisible, setHelperVisible] = useState(false);
  const [activeManagementTab, setActiveManagementTab] = useState<TreeManagementTabKey>('overview');
  const [showLinkChooser, setShowLinkChooser] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [ownerLinkTargetUserId, setOwnerLinkTargetUserId] = useState<string | null>(null);
  const [ownerLinkSearchQuery, setOwnerLinkSearchQuery] = useState('');
  const [approvalWindowInput, setApprovalWindowInput] = useState(`${selectedTree.approvalWindowHours}`);
  const [mergeTargetTreeId, setMergeTargetTreeId] = useState('');
  const [surnamePrimary, setSurnamePrimary] = useState('');
  const [surnameVariantsInput, setSurnameVariantsInput] = useState('');

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

  const approvalWindowDraft = useMemo(() => {
    const trimmed = approvalWindowInput.trim().toLowerCase();
    if (!trimmed) {
      return approvalWindowHours;
    }

    if (trimmed === 'off' || trimmed === '0') {
      return 0;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return approvalWindowHours;
    }

    return Math.max(0, Math.min(168, Math.round(parsed)));
  }, [approvalWindowHours, approvalWindowInput]);

  const approvalsDisabled = approvalWindowHours === 0;
  const approvalDraftDisabled = approvalWindowDraft === 0;
  const approvalSettingDirty = approvalWindowDraft !== approvalWindowHours;
  const approvalPreviewText = approvalDraftDisabled
    ? 'Preview: collaborator profile and relationship changes will apply immediately. No approval queue will be created.'
    : `Preview: collaborator changes will wait for review and auto-approve after ${approvalWindowDraft} hour${approvalWindowDraft === 1 ? '' : 's'} if nobody acts first.`;

  useEffect(() => {
    setApprovalWindowInput(`${selectedTree.approvalWindowHours}`);
  }, [selectedTree.approvalWindowHours]);

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

  const handleAddSurnameGroup = async () => {
    const primarySurname = surnamePrimary.trim();
    if (!primarySurname) {
      return;
    }

    const variants = surnameVariantsInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    await onSetSurnameVariantGroups([
      ...selectedTree.surnameVariantGroups,
      {
        id: `${selectedTree.id}-${Date.now()}`,
        primarySurname,
        variants,
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    setSurnamePrimary('');
    setSurnameVariantsInput('');
  };

  const pendingMergeRequests = mergeRequests.filter((request) => request.status === 'pending' || request.status === 'changes-requested');

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View>
        <View style={styles.titleWithHelperRow}>
          <Text variant="headlineSmall">{selectedTree.name}</Text>
          <IconButton
            icon="information-outline"
            size={20}
            style={styles.helperIconButton}
            onPress={() => setHelperVisible(true)}
            accessibilityLabel="About tree management"
          />
        </View>

        <Surface style={[settingsTabStripStyles.card, { backgroundColor: theme.colors.surface }]} elevation={0}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={settingsTabStripStyles.content}>
            {TREE_MANAGEMENT_TABS.map((tab) => {
              const isActive = activeManagementTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveManagementTab(tab.key)}
                  style={[
                    settingsTabStripStyles.item,
                    isActive && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 },
                  ]}
                >
                  <Text variant="labelLarge" style={{ color: isActive ? theme.colors.primary : theme.colors.onSurfaceVariant }}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Surface>

        {activeManagementTab === 'overview' ? (
          <>
            <View style={styles.summaryChipRow}>
              <Chip icon="account-key">{formatRole(role)}</Chip>
              <Chip icon="account-group">{people.length} family members</Chip>
              <Chip icon="graph-outline">{relationships.length} relationships</Chip>
              <Chip icon="account-multiple">{selectedTree.collaborators.length} collaborators</Chip>
              <Chip icon="link-variant">{assignedPersonByUserId.size} linked</Chip>
              {unlinkedCollaboratorCount > 0 ? <Chip icon="account-clock">{unlinkedCollaboratorCount} awaiting link</Chip> : null}
            </View>

            <View style={styles.profileMetricsWrap}>
              <View style={[styles.flatPanel, { backgroundColor: theme.colors.surface }]}>
                <Text variant="titleSmall">Family members with notes</Text>
                <Text variant="headlineSmall">{people.filter((person) => person.notes.trim()).length}</Text>
              </View>
              <View style={[styles.flatPanel, { backgroundColor: theme.colors.surface }]}>
                <Text variant="titleSmall">Photos stored</Text>
                <Text variant="headlineSmall">{people.reduce((count, person) => count + person.photos.length, 0)}</Text>
              </View>
            </View>

            <Card mode="elevated" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.surface, marginBottom: 16 }]}>
              <Card.Content>
                <View style={styles.sectionHeader}>
                  <View style={styles.titleWrap}>
                    <View style={styles.titleWithHelperRow}>
                      <Text variant="titleLarge">Surname variants</Text>
                      <IconButton
                        icon="information-outline"
                        size={18}
                        style={styles.helperIconButton}
                        onPress={() => setHelperVisible(true)}
                        accessibilityLabel="About surname variants"
                      />
                    </View>
                  </View>
                </View>

                {selectedTree.surnameVariantGroups.length > 0 ? (
                  <View style={styles.assignmentSuggestionList}>
                    {selectedTree.surnameVariantGroups.map((group) => (
                      <View key={group.id} style={{ marginBottom: 12 }}>
                        <Text variant="titleMedium">{group.primarySurname}</Text>
                        <View style={styles.collaboratorChipRow}>
                          {group.variants.map((variant) => <Chip key={`${group.id}-${variant}`} compact>{variant}</Chip>)}
                          {group.variants.length === 0 ? <Chip compact icon="information-outline">No variants yet</Chip> : null}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                    No surname families have been defined yet. Add them below so searches and merge suggestions can recognize related spellings.
                  </Text>
                )}

                {isOwner || role === 'editor' ? (
                  <View style={{ marginTop: 8 }}>
                    <TextInput
                      mode="outlined"
                      label="Primary surname"
                      value={surnamePrimary}
                      onChangeText={setSurnamePrimary}
                      style={{ marginBottom: 8 }}
                    />
                    <TextInput
                      mode="outlined"
                      label="Variants (comma separated)"
                      value={surnameVariantsInput}
                      onChangeText={setSurnameVariantsInput}
                      style={{ marginBottom: 8 }}
                    />
                    <Button mode="contained-tonal" icon="plus" onPress={handleAddSurnameGroup} disabled={mutating || !surnamePrimary.trim()}>
                      Add surname group
                    </Button>
                  </View>
                ) : null}
              </Card.Content>
            </Card>

            <View style={styles.selfAssignmentSectionWrap}>
              <View style={styles.sectionHeader}>
                <View style={styles.titleWrap}>
                  <View style={styles.titleWithHelperRow}>
                    <Text variant="titleLarge">My place in this tree</Text>
                    <IconButton
                      icon="information-outline"
                      size={18}
                      style={styles.helperIconButton}
                      onPress={() => setHelperVisible(true)}
                      accessibilityLabel="About my place in this tree"
                    />
                  </View>
                </View>
                {!currentAssignedPerson ? (
                  <Button mode="contained-tonal" icon="account-plus" onPress={onOpenAddSelf} disabled={mutating || !canCreateSelfProfile}>
                    Add myself
                  </Button>
                ) : null}
              </View>

              <Card mode="elevated" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.surface }]}>
                <Card.Content>
                  <View style={styles.selfAssignmentHeader}>
                    <View style={styles.selfAssignmentTextWrap}>
                      <View style={styles.collaboratorChipRow}>
                        <Chip compact icon={currentAssignedPerson ? 'check-decagram' : 'link-variant-off'}>
                          {currentAssignedPerson ? 'Linked profile' : 'Not linked yet'}
                        </Chip>
                        <Chip compact icon="account">{currentUserLabel}</Chip>
                      </View>
                      <Text variant="titleMedium" style={styles.selfAssignmentTitle}>
                        {currentAssignedPerson ? formatPersonName(currentAssignedPerson) : 'Choose an existing family member or create your own profile'}
                      </Text>
                      <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                        {currentAssignedPerson
                          ? 'This linked family member represents you in the tree. Unlink first before claiming a different profile.'
                          : 'We will suggest name matches from your sign-in profile and let you link yourself manually if needed.'}
                      </Text>
                    </View>
                    {currentAssignedPerson ? (
                      <View style={styles.selfAssignmentActions}>
                        <Button mode="contained" icon="open-in-new" onPress={() => openPersonProfile(currentAssignedPerson)} disabled={mutating}>
                          Open
                        </Button>
                        <Button
                          mode="text"
                          icon="link-off"
                          textColor={theme.colors.error}
                          onPress={() => openConfirm(
                            'Unlink your profile',
                            'Remove the connection between your account and this family member profile?',
                            'Unlink',
                            onClearSelfAssignment,
                          )}
                          disabled={mutating}
                        >
                          Unlink
                        </Button>
                      </View>
                    ) : (
                      <View style={styles.selfAssignmentActions}>
                        <Button mode="contained" icon="account-search" onPress={() => setShowLinkChooser(true)} disabled={mutating}>
                          Browse family members
                        </Button>
                        <Button mode="outlined" icon="account-plus" onPress={onOpenAddSelf} disabled={mutating || !canCreateSelfProfile}>
                          Add myself
                        </Button>
                      </View>
                    )}
                  </View>

                  {!canCreateSelfProfile ? (
                    <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                      You can link yourself to an existing person right now. Creating a new profile still requires editor access on this tree.
                    </Text>
                  ) : currentAssignedPerson ? (
                    <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                      To claim a different person, unlink yourself from {formatPersonName(currentAssignedPerson)} first.
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
                                  {suggestion.tone === 'exact' ? 'Suggested match' : 'Likely match'}
                                </Chip>
                                {suggestion.person.birthDate ? <Chip compact icon="calendar">{suggestion.person.birthDate}</Chip> : null}
                              </View>
                              <Text variant="titleMedium" style={styles.selfAssignmentTitle}>{formatPersonName(suggestion.person)}</Text>
                              <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{suggestion.reason}</Text>
                            </View>
                            <Button mode="contained" onPress={() => handleSelfLink(suggestion.person.id)} disabled={mutating || !userId}>
                              Link me
                            </Button>
                          </View>
                        </Card.Content>
                      </Card>
                    ))}
                  </View>
                ) : (
                  <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                    No exact name-and-surname match was found yet, so you can browse the tree manually or create your own family member profile.
                  </Text>
                )
              ) : null}

              {!currentAssignedPerson && (showLinkChooser || !currentAssignedPerson) ? (
                <View style={styles.assignmentChooserWrap}>
                  <Text variant="titleMedium">Link to an existing family member</Text>
                  <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Search everyone in this tree and pick the profile that represents you best.
                  </Text>

                  <TextInput
                    mode="outlined"
                    label="Search existing family members"
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
                                Link me
                              </Button>
                            </View>
                          </Card.Content>
                        </Card>
                      ))}
                    </View>
                  ) : (
                    <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                      No available family members match that search yet.
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
                <Text variant="titleLarge">Collaborators</Text>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  Owners manage access. Editors can update content. Viewers can browse.
                </Text>
              </View>
              {isOwner ? (
                <Button mode="contained" icon="account-plus" onPress={onOpenCollaboratorDialog} disabled={mutating}>
                  Add collaborator
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
                            {collaborator.userId === userId ? <Chip compact icon="account">You</Chip> : null}
                            {linkedPerson ? <Chip compact icon="link-variant">{formatPersonName(linkedPerson)}</Chip> : null}
                          </View>
                        </View>
                        {isOwner && collaborator.role !== 'owner' ? (
                          <IconButton
                            icon="account-remove"
                            iconColor="#C62828"
                            onPress={() => openConfirm(
                              'Remove collaborator',
                              `Remove ${collaborator.displayName || collaborator.email} from this tree?`,
                              'Remove',
                              async () => onRemoveCollaborator(collaborator.userId),
                            )}
                            disabled={mutating}
                          />
                        ) : null}
                      </View>

                      {isOwner && collaborator.userId !== userId && !linkedPerson ? (
                        <View style={styles.ownerSuggestionWrap}>
                          <Text variant="titleSmall">Suggest a matching family member</Text>
                          <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                            Help {collaborator.displayName || collaborator.email} get started by linking the family member that looks like them best.
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
                                            {suggestion.tone === 'exact' ? 'Suggested match' : 'Likely match'}
                                          </Chip>
                                          {suggestion.person.birthDate ? <Chip compact icon="calendar">{suggestion.person.birthDate}</Chip> : null}
                                        </View>
                                        <Text variant="titleMedium" style={styles.selfAssignmentTitle}>{formatPersonName(suggestion.person)}</Text>
                                        <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{suggestion.reason}</Text>
                                      </View>
                                      <Button mode="contained-tonal" onPress={() => handleOwnerLinkSuggestion(collaborator.userId, suggestion.person.id)} disabled={mutating}>
                                        Suggest link
                                      </Button>
                                    </View>
                                  </Card.Content>
                                </Card>
                              ))}
                            </View>
                          ) : (
                            <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                              No obvious name match yet, but you can still choose a family member manually.
                            </Text>
                          )}

                          <Button mode="outlined" icon="account-search" onPress={() => toggleOwnerLinkChooser(collaborator.userId)} disabled={mutating} style={styles.ownerSuggestionButton}>
                            {isOwnerSuggestionTarget ? 'Hide family members' : 'Choose family member'}
                          </Button>

                          {isOwnerSuggestionTarget ? (
                            <View style={styles.assignmentChooserWrap}>
                              <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                                Search unlinked people and connect one to {ownerLinkTargetCollaborator?.displayName || ownerLinkTargetCollaborator?.email || 'this collaborator'}.
                              </Text>

                              <TextInput
                                mode="outlined"
                                label="Search family members to suggest"
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
                                            Suggest link
                                          </Button>
                                        </View>
                                      </Card.Content>
                                    </Card>
                                  ))}
                                </View>
                              ) : (
                                <Text variant="bodySmall" style={[styles.assignmentHelperText, { color: theme.colors.onSurfaceVariant }]}>
                                  No available family members match that search yet.
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
              <Text variant="titleSmall">Approval settings</Text>
              <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Owners can require review for collaborator changes, or turn approvals off so updates apply immediately. Single-collaborator trees still apply immediately.
              </Text>
              <View style={styles.summaryChipRow}>
                <Chip compact icon={approvalsDisabled ? 'flash-outline' : 'timer-outline'}>
                  {approvalsDisabled ? 'Approvals off' : `Current window: ${approvalWindowHours}h`}
                </Chip>
              </View>
              <View style={styles.approvalWindowRow}>
                <TextInput
                  mode="outlined"
                  label="Hours or 0 for off"
                  value={approvalWindowInput}
                  onChangeText={setApprovalWindowInput}
                  keyboardType="number-pad"
                  style={styles.approvalWindowInput}
                  disabled={mutating || !isOwner}
                />
                {isOwner ? (
                  <Button
                    mode="contained-tonal"
                    onPress={() => onSetApprovalWindowHours(approvalWindowDraft)}
                    disabled={mutating || !approvalSettingDirty}
                  >
                    Save setting
                  </Button>
                ) : null}
              </View>
              <View style={[styles.approvalPreviewCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {approvalPreviewText}
                </Text>
              </View>
            </View>

            <View style={styles.collaboratorSectionWrap}>
              <View style={styles.sectionHeader}>
                <View style={styles.titleWrap}>
                  <Text variant="titleLarge">Pending approvals</Text>
                  <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {approvalsDisabled
                      ? 'Approvals are currently off. Any requests listed here were created before that change and can still be reviewed.'
                      : 'Collaborator edits awaiting review - they auto-approve if nobody acts before the deadline.'}
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
                                  {canReview ? 'Needs your review' : 'Awaiting review'}
                                </Chip>
                                <Chip compact icon={expiresSoon ? 'timer-alert-outline' : 'timer-outline'}>
                                  Auto-approves {request.expiresAt.slice(0, 16).replace('T', ' ')}
                                </Chip>
                              </View>
                              <Text variant="titleMedium" style={styles.selfAssignmentTitle}>{request.title}</Text>
                              <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{request.description}</Text>
                              <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>Requested by {request.requestedByLabel}</Text>
                            </View>
                            {canReview ? (
                              <View style={styles.approvalRequestActions}>
                                <Button mode="contained" onPress={() => onApproveApprovalRequest(request.id)} disabled={mutating}>
                                  Approve
                                </Button>
                                <Button mode="outlined" textColor={theme.colors.error} onPress={() => onRejectApprovalRequest(request.id)} disabled={mutating}>
                                  Reject
                                </Button>
                              </View>
                            ) : null}
                          </View>
                        </Card.Content>
                      </Card>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text variant="titleMedium">No pending approvals</Text>
                  <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                    Any collaborator-submitted family member or relationship edits waiting for review will appear here.
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
                <Text variant="titleLarge">Collaborative merges</Text>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  Suggest a merge only when likely relatives exist, then collect editor approvals from both trees before anything is applied.
                </Text>
              </View>
            </View>

            <Card mode="elevated" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.surface, marginBottom: 16 }]}>
              <Card.Content>
                <Text variant="titleMedium" style={{ marginBottom: 8 }}>Start a merge review</Text>
                <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  Enter another tree ID, preview likely person matches, then submit the merge suggestion for joint review.
                </Text>
                <TextInput
                  mode="outlined"
                  label="Target tree ID"
                  value={mergeTargetTreeId}
                  onChangeText={setMergeTargetTreeId}
                  style={{ marginTop: 8 }}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Button mode="outlined" onPress={() => onLoadMergePreview(mergeTargetTreeId)} disabled={mutating || !mergeTargetTreeId.trim()}>
                    Preview
                  </Button>
                  <Button mode="contained" onPress={() => onCreateMergeRequest(mergeTargetTreeId)} disabled={mutating || !mergeTargetTreeId.trim()}>
                    Submit merge
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
                  <Text variant="titleMedium">Merge preview</Text>
                  <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {mergePreview.sourceTree.treeName} ({mergePreview.sourceTree.personCount}) to {mergePreview.targetTree.treeName} ({mergePreview.targetTree.personCount})
                  </Text>
                  <View style={styles.summaryChipRow}>
                    <Chip compact icon="account-switch">{mergePreview.matches.length} possible matches</Chip>
                    <Chip compact icon="source-branch-plus">{mergePreview.newBranchCount} new branches</Chip>
                    <Chip compact icon="alert-circle-outline">{mergePreview.conflicts.length} conflicts</Chip>
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
                          Conflicts: {match.conflicts.map((conflict) => conflict.field).join(', ')}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </Card.Content>
              </Card>
            ) : null}

            <View style={styles.sectionHeader}>
              <View style={styles.titleWrap}>
                <Text variant="titleLarge">Pending merge approvals</Text>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  Each merge needs at least one editor approval from each affected tree.
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
                        Suggested by {request.suggestedByLabel}. {request.preview.duplicateCount} strong duplicate candidates, {request.preview.conflicts.length} conflicts.
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
                        <Button mode="contained" onPress={() => onApproveMergeRequest(request.id)} disabled={mutating}>Approve</Button>
                        <Button mode="outlined" onPress={() => onRequestMergeChanges(request.id, 'Please review the highlighted conflicts before merging.')} disabled={mutating}>Request changes</Button>
                        <Button mode="text" textColor={theme.colors.error} onPress={() => onRejectMergeRequest(request.id)} disabled={mutating}>Reject</Button>
                      </View>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text variant="titleMedium">No pending merge reviews</Text>
                <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                  Merge suggestions with likely relative matches will appear here for joint editor approval.
                </Text>
              </View>
            )}

            <Divider style={{ marginVertical: 16 }} />

            <View style={styles.sectionHeader}>
              <View style={styles.titleWrap}>
                <Text variant="titleLarge">Merge history and undo</Text>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  Undo preserves the audit trail and restores the pre-merge snapshot where possible.
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
                        {entry.preview.matches.length} reviewed matches · {entry.approvals.length} approval actions · {entry.changedPersonIds.length} people changed
                      </Text>
                      <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
                        <Chip compact icon="history">{entry.status}</Chip>
                        <Chip compact icon="calendar-clock">{entry.createdAt.slice(0, 16).replace('T', ' ')}</Chip>
                      </View>
                      <Button mode="outlined" icon="undo" onPress={() => onUndoMerge(entry.mergeRequestId)} disabled={mutating || entry.status !== 'applied'} style={{ marginTop: 8 }}>
                        Preview and undo merge
                      </Button>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text variant="titleMedium">No merge history yet</Text>
                <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                  Applied or rejected merge activity, approval history, confidence scores, and undoable snapshots will appear here.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {activeManagementTab === 'trees' ? (
          <View>
            <View style={styles.sectionHeader}>
              <View style={styles.titleWrap}>
                <Text variant="titleMedium">My Family Trees</Text>
                <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  Switch between trees or manage the one you are working in now.
                </Text>
              </View>
            </View>
            {loadingTrees ? (
              <View style={styles.centeredState}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : (trees ?? []).length === 0 ? (
              <View style={styles.emptyState}>
                <Text variant="titleMedium">No trees yet</Text>
                <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                  Create your first family tree to start building.
                </Text>
                {onCreateTree ? (
                  <Button mode="contained" icon="plus" onPress={onCreateTree} disabled={mutating} style={styles.emptyStateButton}>
                    Create a tree
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
                            {isDefault ? <Chip compact icon="star" style={{ backgroundColor: theme.colors.secondaryContainer }}>Default</Chip> : null}
                            {isSelected ? <Chip compact icon="check-circle" style={{ backgroundColor: theme.colors.primaryContainer }}>Active</Chip> : null}
                          </View>
                          <Text variant="bodySmall" style={{ color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant, marginTop: 2 }}>
                            {tree.memberIds?.length ?? 0} member{(tree.memberIds?.length ?? 0) !== 1 ? 's' : ''} · {formatRole(treeRole)}
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
          visible={helperVisible}
          onDismiss={() => setHelperVisible(false)}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>Tree management</Dialog.Title>
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium">
              Overview shows key stats and lets you link your account to a family member profile. Collaborators manages who has access - owners can add, remove, or change roles, and can suggest a person link for any unlinked member. Approvals shows pending edits awaiting another collaborator's review; you can also set the auto-approve window here.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button onPress={() => setHelperVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

export const TreeSettingsTabContent = ProfileTabContent;
