import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  IconButton,
  List,
  Portal,
  SegmentedButtons,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { canUserReviewApprovalRequest, isApprovalExpired, type ApprovalRequest } from '../types/approval';
import {
  CollaboratorDialog,
  ConfirmDialog,
  FamilyTreeCanvas,
  PersonFormDialog,
  RelationshipDialog,
} from '../components';
import type { PersonFormSubmission } from '../components/PersonFormDialog';
import { useAuthStore } from '../store/authStore';
import { useTreeStore } from '../store/treeStore';
import type { PersonGender, PersonRecord } from '../types/person';
import { getPersonPresenceLabel, getPreferredPersonPhoto, isPersonDeceased } from '../types/person';
import type { RelationshipRecord } from '../types/relationship';
import type { RootStackParamList, TreeDetailTabParamList } from '../types/navigation';
import { getUserDisplayLabel, getUserNameParts, type UserProfile } from '../types/user';
import {
  canEditTreeContent,
  canManageTree,
  getAssignedPersonId,
  getUnlinkedCollaborators,
  getTreeRole,
  type CollaboratorRole,
  type FamilyTree,
} from '../types/tree';
import type { PendingRelationshipSubmission } from '../components/PersonFormDialog';

type Props = NativeStackScreenProps<RootStackParamList, 'TreeDetail'>;

type PersonDialogState = {
  visible: boolean;
  mode: 'create' | 'edit';
  person: PersonRecord | null;
  initialPendingRelationships: PendingRelationshipSubmission[];
};

type NodeQuickActionState = {
  visible: boolean;
  person: PersonRecord | null;
};

type ConfirmState = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  action: (() => Promise<void>) | null;
};

type SelfAssignmentSuggestion = {
  person: PersonRecord;
  tone: 'exact' | 'likely';
  reason: string;
};

type TreeManagementTabKey = 'overview' | 'collaborators' | 'approvals';

const TREE_MANAGEMENT_TABS: Array<{ key: TreeManagementTabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'collaborators', label: 'Collaborators' },
  { key: 'approvals', label: 'Approvals' },
];

interface SharedTabProps {
  selectedTree: FamilyTree;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  approvalRequests: ApprovalRequest[];
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
}

const Tab = createMaterialTopTabNavigator<TreeDetailTabParamList>();

function formatPersonName(person?: PersonRecord | null) {
  if (!person) {
    return 'Unknown family member';
  }

  return `${person.firstName} ${person.lastName}`.trim();
}

function formatGender(gender: PersonGender) {
  if (gender === 'non-binary') {
    return 'Non-binary';
  }

  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

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

function buildSelfAssignmentSuggestions(
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


function PeopleRelationshipsTabContent({
  people,
  currentAssignedPerson,
  canEdit,
  mutating,
  loadingTreeData,
  openPersonProfile,
  onEditPerson,
  openConfirm,
  onDeletePerson,
}: SharedTabProps) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | PersonGender>('all');
  const [assetFilter, setAssetFilter] = useState<'all' | 'with-photos' | 'with-notes'>('all');

  const filteredPeople = useMemo(
    () => people.filter((person) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const searchableText = [
        formatPersonName(person),
        person.birthDate,
        person.deathDate,
        person.notes,
        getPersonPresenceLabel(person),
      ].join(' ').toLowerCase();
      const matchesSearch = searchableText.includes(normalizedQuery);
      const matchesGender = genderFilter === 'all' || person.gender === genderFilter;
      const matchesAsset = assetFilter === 'all'
        || (assetFilter === 'with-photos' ? person.photos.length > 0 : person.notes.trim().length > 0);

      return matchesSearch && matchesGender && matchesAsset;
    }),
    [assetFilter, genderFilter, people, searchQuery],
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.sectionHeader}>
          <View style={styles.titleWrap}>
            <Text variant="titleLarge">Family members</Text>
            <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Profiles keep notes and photo memories together. Tap a card to open the family member profile and gallery.
            </Text>
          </View>
        </View>

        <TextInput
          mode="outlined"
          label="Search family members"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.filterInput}
          left={<TextInput.Icon icon="magnify" />}
        />

        <View style={styles.filterRow}>
          <Chip selected={genderFilter === 'all'} onPress={() => setGenderFilter('all')}>All genders</Chip>
          <Chip selected={genderFilter === 'unspecified'} onPress={() => setGenderFilter('unspecified')}>Unspecified</Chip>
          <Chip selected={genderFilter === 'female'} onPress={() => setGenderFilter('female')}>Female</Chip>
          <Chip selected={genderFilter === 'male'} onPress={() => setGenderFilter('male')}>Male</Chip>
          <Chip selected={genderFilter === 'non-binary'} onPress={() => setGenderFilter('non-binary')}>Non-binary</Chip>
          <Chip selected={genderFilter === 'other'} onPress={() => setGenderFilter('other')}>Other</Chip>
        </View>

        <View style={styles.filterRow}>
          <Chip selected={assetFilter === 'all'} onPress={() => setAssetFilter('all')}>All family members</Chip>
          <Chip selected={assetFilter === 'with-photos'} onPress={() => setAssetFilter('with-photos')}>Has photos</Chip>
          <Chip selected={assetFilter === 'with-notes'} onPress={() => setAssetFilter('with-notes')}>Has notes</Chip>
        </View>

        {loadingTreeData ? (
          <View style={styles.centeredState}>
            <ActivityIndicator color={theme.colors.primary} />
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>Loading tree details…</Text>
          </View>
        ) : (
          <>
            {filteredPeople.length === 0 ? (
              <View style={styles.emptyState}>
                <Text variant="titleMedium">No matching family members</Text>
                  <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}> 
                  {people.length === 0
                    ? (canEdit ? 'Add a family member to start building this family tree.' : 'This shared tree does not have any family members yet.')
                    : 'Try adjusting the search or filters to find a family member.'}
                </Text>
              </View>
            ) : (
              filteredPeople.map((person) => {
                const preferredPhoto = getPreferredPersonPhoto(person);
                const isCurrentUsersPerson = currentAssignedPerson?.id === person.id;
                return (
                  <Card key={person.id} style={[styles.personCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]} mode="outlined" onPress={() => openPersonProfile(person)}>
                    <Card.Content>
                      <View style={styles.personHeader}>
                        <View style={styles.personPhotoWrap}>
                          {preferredPhoto ? (
                            <Image source={{ uri: preferredPhoto.url }} style={styles.personPhoto} />
                          ) : (
                            <View style={styles.personPhotoFallback}>
                              <MaterialCommunityIcons name="account" size={30} color={theme.colors.primary} />
                            </View>
                          )}
                        </View>
                        <View style={styles.personHeaderText}>
                          <View style={styles.personNameRow}>
                            <Text variant="titleLarge">{formatPersonName(person)}</Text>
                            {isCurrentUsersPerson ? <Chip compact icon="account">You</Chip> : null}
                          </View>
                          <View style={styles.metadataRow}>
                            {person.gender !== 'unspecified' ? <Chip compact>{formatGender(person.gender)}</Chip> : null}
                            {person.birthDate ? <Chip compact icon="calendar">{person.birthDate}</Chip> : null}
                            <Chip compact icon={isPersonDeceased(person) ? 'flower-outline' : 'heart-pulse'}>
                              {getPersonPresenceLabel(person)}
                            </Chip>
                            <Chip compact icon="image-multiple">{person.photos.length} photos</Chip>
                          </View>
                        </View>
                        <View style={styles.cardActions}>
                          <IconButton icon="open-in-new" onPress={() => openPersonProfile(person)} />
                          {canEdit ? (
                            <>
                              <IconButton icon="pencil" onPress={() => onEditPerson(person)} disabled={mutating} />
                              <IconButton
                                icon="delete"
                                iconColor="#C62828"
                                onPress={() => openConfirm(
                                  'Delete family member',
                                  `Delete ${formatPersonName(person)} and remove every relationship connected to this family member?`,
                                  'Delete',
                                  async () => onDeletePerson(person),
                                )}
                                disabled={mutating}
                              />
                            </>
                          ) : null}
                        </View>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })
            )}
          </>
        )}
      </Surface>
    </ScrollView>
  );
}

function VisualisationTabContent({
  people,
  relationships,
  onOpenPersonQuickActions,
  currentAssignedPerson,
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
}: SharedTabProps) {
  const theme = useTheme();
  const [activeManagementTab, setActiveManagementTab] = useState<TreeManagementTabKey>('overview');
  const [showLinkChooser, setShowLinkChooser] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [ownerLinkTargetUserId, setOwnerLinkTargetUserId] = useState<string | null>(null);
  const [ownerLinkSearchQuery, setOwnerLinkSearchQuery] = useState('');
  const [approvalWindowInput, setApprovalWindowInput] = useState(`${selectedTree.approvalWindowHours}`);

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

        return [
          formatPersonName(person),
          person.birthDate,
          person.notes,
        ].join(' ').toLowerCase().includes(normalizedQuery);
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

        return [
          formatPersonName(person),
          person.birthDate,
          person.notes,
        ].join(' ').toLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) => formatPersonName(left).localeCompare(formatPersonName(right)))
      .slice(0, 8);
  }, [assignedUserIdByPersonId, ownerLinkSearchQuery, ownerLinkTargetUserId, people]);

  const pendingApprovalRequests = useMemo(
    () => approvalRequests.filter((request) => request.status === 'pending'),
    [approvalRequests],
  );

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

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall">{selectedTree.name}</Text>
        <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Review the current tree at a glance, manage collaborators, and keep profile links up to date.
        </Text>

        <SegmentedButtons
          value={activeManagementTab}
          onValueChange={(value) => setActiveManagementTab(value as TreeManagementTabKey)}
          buttons={TREE_MANAGEMENT_TABS.map((tab) => ({
            value: tab.key,
            label: tab.label,
          }))}
          style={styles.managementSegmentedButtons}
        />

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
              <Card mode="outlined" style={[styles.metricCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
                <Card.Content>
                  <Text variant="titleSmall">Family members with notes</Text>
                  <Text variant="headlineSmall">{people.filter((person) => person.notes.trim()).length}</Text>
                </Card.Content>
              </Card>
              <Card mode="outlined" style={[styles.metricCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
                <Card.Content>
                  <Text variant="titleSmall">Photos stored</Text>
                  <Text variant="headlineSmall">{people.reduce((count, person) => count + person.photos.length, 0)}</Text>
                </Card.Content>
              </Card>
            </View>

            <View style={styles.selfAssignmentSectionWrap}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWrap}>
              <Text variant="titleLarge">My place in this tree</Text>
              <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}> 
                Link your account to your family member profile so the tree can recognise you and suggest likely matches.
              </Text>
            </View>
            {!currentAssignedPerson ? (
              <Button mode="contained-tonal" icon="account-plus" onPress={onOpenAddSelf} disabled={mutating || !canCreateSelfProfile}>
                Add myself
              </Button>
            ) : null}
          </View>

          <Card mode="outlined" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}> 
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
                  <Text variant="bodyMedium" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}> 
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
                  <Card key={`suggestion-${suggestion.person.id}`} mode="outlined" style={[styles.assignmentSuggestionCard, { backgroundColor: theme.colors.elevation.level1, borderColor: suggestion.tone === 'exact' ? theme.colors.primary : theme.colors.outlineVariant }]}> 
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
                    <Card key={`assignable-${person.id}`} mode="outlined" style={[styles.assignmentSuggestionCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}> 
                      <Card.Content>
                        <View style={styles.assignmentSuggestionRow}>
                          <View style={styles.assignmentSuggestionTextWrap}>
                            <Text variant="titleMedium">{formatPersonName(person)}</Text>
                            <View style={styles.collaboratorChipRow}>
                              {person.birthDate ? <Chip compact icon="calendar">{person.birthDate}</Chip> : null}
                              <Chip compact icon={isPersonDeceased(person) ? 'flower-outline' : 'heart-pulse'}>{getPersonPresenceLabel(person)}</Chip>
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
              <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>Owners manage access. Editors can update family members and relationships. Viewers can browse the tree.</Text>
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
                <Card key={collaborator.userId} mode="outlined" style={[styles.collaboratorCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}> 
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
                              <Card key={`owner-suggestion-${collaborator.userId}-${suggestion.person.id}`} mode="outlined" style={[styles.assignmentSuggestionCard, { backgroundColor: theme.colors.surface, borderColor: suggestion.tone === 'exact' ? theme.colors.primary : theme.colors.outlineVariant }]}> 
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
                                  <Card key={`owner-assignable-${collaborator.userId}-${person.id}`} mode="outlined" style={[styles.assignmentSuggestionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}> 
                                    <Card.Content>
                                      <View style={styles.assignmentSuggestionRow}>
                                        <View style={styles.assignmentSuggestionTextWrap}>
                                          <Text variant="titleMedium">{formatPersonName(person)}</Text>
                                          <View style={styles.collaboratorChipRow}>
                                            {person.birthDate ? <Chip compact icon="calendar">{person.birthDate}</Chip> : null}
                                            <Chip compact icon={isPersonDeceased(person) ? 'flower-outline' : 'heart-pulse'}>{getPersonPresenceLabel(person)}</Chip>
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
            <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>Family member profile edits and relationship changes auto-approve after this many hours if no one reviews them. Single-collaborator trees still approve immediately.</Text>
            <View style={styles.approvalWindowRow}>
              <TextInput
                mode="outlined"
                label="Hours"
                value={approvalWindowInput}
                onChangeText={setApprovalWindowInput}
                keyboardType="number-pad"
                style={styles.approvalWindowInput}
                disabled={mutating || !isOwner}
              />
              {isOwner ? (
                <Button
                  mode="contained-tonal"
                  onPress={() => onSetApprovalWindowHours(Number(approvalWindowInput) || selectedTree.approvalWindowHours)}
                  disabled={mutating}
                >
                  Save window
                </Button>
              ) : null}
            </View>
          </View>

          <View style={styles.collaboratorSectionWrap}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWrap}>
              <Text variant="titleLarge">Pending approvals</Text>
              <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>One other collaborator can approve or reject family member and relationship changes. If nobody reviews them before the deadline, they auto-approve.</Text>
            </View>
          </View>

          {pendingApprovalRequests.length > 0 ? (
            <View style={styles.collaboratorList}>
              {pendingApprovalRequests.map((request) => {
                const canReview = canUserReviewApprovalRequest(request, userId);
                const expiresSoon = isApprovalExpired(request);

                return (
                  <Card key={request.id} mode="outlined" style={[styles.collaboratorCard, { backgroundColor: theme.colors.elevation.level1, borderColor: canReview ? theme.colors.primary : theme.colors.outlineVariant }]}>
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
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>Any collaborator-submitted family member or relationship edits waiting for review will appear here.</Text>
            </View>
          )}
          </View>
          </View>
        ) : null}
      </Surface>
    </ScrollView>
  );
}

export default function TreeDetailScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { user } = useAuthStore();
  const {
    trees,
    selectedTreeId,
    people,
    relationships,
    approvalRequests,
    loadingTrees,
    loadingTreeData,
    mutating,
    error,
    notice,
    selectTree,
    addCollaborator,
    removeCollaborator,
    createPerson,
    assignPersonToUser,
    clearSelfAssignment,
    updatePerson,
    removePerson,
    addParentChildRelationship,
    addSpouseRelationship,
    approveApprovalRequest,
    rejectApprovalRequest,
    setApprovalWindowHours,
    clearError,
    clearNotice,
  } = useTreeStore();

  const [personDialog, setPersonDialog] = useState<PersonDialogState>({
    visible: false,
    mode: 'create',
    person: null,
    initialPendingRelationships: [],
  });
  const [selfPersonDialogVisible, setSelfPersonDialogVisible] = useState(false);
  const [relationshipDialogVisible, setRelationshipDialogVisible] = useState(false);
  const [collaboratorDialogVisible, setCollaboratorDialogVisible] = useState(false);
  const [nodeQuickActionState, setNodeQuickActionState] = useState<NodeQuickActionState>({ visible: false, person: null });
  const [snackVisible, setSnackVisible] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    action: null,
  });

  const selectedTree = useMemo(
    () => trees.find((tree) => tree.id === route.params.treeId) ?? null,
    [route.params.treeId, trees],
  );
  const initialTab = route.params.initialTab && route.params.initialTab !== 'HomeTab'
    ? route.params.initialTab
    : 'PeopleRelationshipsTab';

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const existingLastNames = useMemo(
    () => [...new Set(people.map((person) => person.lastName.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [people],
  );

  const currentUserLabel = useMemo(() => getUserDisplayLabel(user), [user]);

  const assignedUserIdByPersonId = useMemo(
    () => new Map(Object.entries(selectedTree?.personAssignments ?? {}).map(([assignedUserId, personId]) => [personId, assignedUserId])),
    [selectedTree?.personAssignments],
  );

  const assignedPersonByUserId = useMemo(
    () => new Map(
      Object.entries(selectedTree?.personAssignments ?? {})
        .map(([assignedUserId, personId]) => {
          const linkedPerson = peopleById.get(personId);
          return linkedPerson ? [assignedUserId, linkedPerson] as const : null;
        })
        .filter((entry): entry is readonly [string, PersonRecord] => Boolean(entry)),
    ),
    [peopleById, selectedTree?.personAssignments],
  );

  const currentAssignedPersonId = selectedTree ? getAssignedPersonId(selectedTree, user?.id) : null;

  const currentAssignedPerson = useMemo(
    () => (currentAssignedPersonId ? peopleById.get(currentAssignedPersonId) ?? null : null),
    [currentAssignedPersonId, peopleById],
  );

  const availableSelfLinkPeople = useMemo(
    () => people
      .filter((person) => {
        const assignedUserId = assignedUserIdByPersonId.get(person.id);
        return !assignedUserId || assignedUserId === user?.id;
      })
      .sort((left, right) => formatPersonName(left).localeCompare(formatPersonName(right))),
    [assignedUserIdByPersonId, people, user?.id],
  );

  const currentSelfAssignmentSuggestions = useMemo(
    () => (currentAssignedPerson
      ? []
      : buildSelfAssignmentSuggestions(user, people, assignedUserIdByPersonId, user?.id)),
    [assignedUserIdByPersonId, currentAssignedPerson, people, user],
  );

  const role = selectedTree ? getTreeRole(selectedTree, user?.id) : null;
  const isOwner = selectedTree ? canManageTree(selectedTree, user?.id) : false;
  const canEdit = selectedTree ? canEditTreeContent(selectedTree, user?.id) : false;

  useEffect(() => {
    if (selectedTreeId !== route.params.treeId || !selectedTree) {
      selectTree(route.params.treeId);
    }
  }, [route.params.treeId, selectTree, selectedTree, selectedTreeId]);

  useEffect(() => {
    if (selectedTree) {
      navigation.setOptions({ title: selectedTree.name });
    }
  }, [navigation, selectedTree]);

  useEffect(() => {
    if (!loadingTrees && !selectedTree && selectedTreeId !== route.params.treeId) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    }
  }, [loadingTrees, navigation, route.params.treeId, selectedTree, selectedTreeId]);

  useEffect(() => {
    if (error) {
      setSnackVisible(true);
    }
  }, [error]);

  useEffect(() => {
    if (notice) {
      setSnackVisible(true);
    }
  }, [notice]);

  const openConfirm = (title: string, message: string, confirmLabel: string, action: () => Promise<void>) => {
    setConfirmState({ visible: true, title, message, confirmLabel, action });
  };

  const closeConfirm = () => {
    setConfirmState({ visible: false, title: '', message: '', confirmLabel: 'Confirm', action: null });
  };

  const openPersonProfile = (person: PersonRecord) => {
    navigation.navigate('PersonProfile', {
      treeId: route.params.treeId,
      personId: person.id,
    });
  };

  const closePersonDialog = () => {
    setPersonDialog({ visible: false, mode: 'create', person: null, initialPendingRelationships: [] });
  };

  const closeNodeQuickActions = () => {
    setNodeQuickActionState({ visible: false, person: null });
  };

  const openCreateRelativeDialog = (mode: PendingRelationshipSubmission['mode'], relatedPerson: PersonRecord) => {
    closeNodeQuickActions();
    setPersonDialog({
      visible: true,
      mode: 'create',
      person: null,
      initialPendingRelationships: [{ mode, relatedPersonId: relatedPerson.id }],
    });
  };

  const handleConfirm = async () => {
    if (!confirmState.action) {
      return;
    }

    try {
      await confirmState.action();
      closeConfirm();
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleCollaboratorSubmit = async ({ email, role: collaboratorRole }: { email: string; role: CollaboratorRole }) => {
    if (!selectedTree) {
      return;
    }

    try {
      await addCollaborator(selectedTree.id, email, collaboratorRole);
      setCollaboratorDialogVisible(false);
    } catch {
      // surfaced by store snackbar
    }
  };

  const createPersonFromPayload = async (payload: PersonFormSubmission) => {
    if (!user?.id || !selectedTree) {
      return null;
    }

    const createdPerson = await createPerson(
      user.id,
      selectedTree.id,
      {
        firstName: payload.firstName,
        lastName: payload.lastName,
        birthDate: payload.birthDate,
        deathDate: payload.deathDate,
        gender: payload.gender,
        notes: payload.notes,
        lifeEvents: payload.lifeEvents,
        preferredPhotoRef: payload.preferredPhotoRef,
      },
      payload.newPhotoUris,
    );

    for (const pendingRelationship of payload.pendingRelationships) {
      if (pendingRelationship.mode === 'parent-of') {
        await addParentChildRelationship(user.id, selectedTree.id, createdPerson.id, pendingRelationship.relatedPersonId);
      } else if (pendingRelationship.mode === 'child-of') {
        await addParentChildRelationship(user.id, selectedTree.id, pendingRelationship.relatedPersonId, createdPerson.id);
      } else {
        await addSpouseRelationship(user.id, selectedTree.id, createdPerson.id, pendingRelationship.relatedPersonId);
      }
    }

    return createdPerson;
  };

  const handlePersonSubmit = async (payload: PersonFormSubmission) => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      if (personDialog.mode === 'create') {
        await createPersonFromPayload(payload);
      } else if (personDialog.person) {
        await updatePerson(user.id, personDialog.person, payload);
      }

      closePersonDialog();
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleSelfPersonSubmit = async (payload: PersonFormSubmission) => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      const createdPerson = await createPersonFromPayload(payload);
      if (createdPerson) {
        await assignPersonToUser(user.id, selectedTree.id, user.id, createdPerson.id);
      }
      setSelfPersonDialogVisible(false);
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleAssignPersonToUser = async (targetUserId: string, personId: string) => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      await assignPersonToUser(user.id, selectedTree.id, targetUserId, personId);
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleClearSelfAssignment = async () => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      await clearSelfAssignment(selectedTree.id, user.id);
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleRelationshipSubmit = async ({
    type,
    fromPersonId,
    toPersonId,
  }: {
    type: 'parent-child' | 'spouse';
    fromPersonId: string;
    toPersonId: string;
  }) => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      if (type === 'spouse') {
        await addSpouseRelationship(user.id, selectedTree.id, fromPersonId, toPersonId);
      } else {
        await addParentChildRelationship(user.id, selectedTree.id, fromPersonId, toPersonId);
      }

      setRelationshipDialogVisible(false);
    } catch {
      // surfaced by store snackbar
    }
  };

  if (!selectedTree) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const sharedTabProps: SharedTabProps = {
    selectedTree,
    people,
    relationships,
    approvalRequests,
    peopleById,
    canEdit,
    isOwner,
    role,
    userId: user?.id,
    currentUserLabel,
    currentAssignedPerson,
    currentSelfAssignmentSuggestions,
    availableSelfLinkPeople,
    assignedPersonByUserId,
    assignedUserIdByPersonId,
    canCreateSelfProfile: canEdit,
    mutating,
    loadingTreeData,
    openConfirm,
    openPersonProfile,
    onOpenAddPerson: () => setPersonDialog({ visible: true, mode: 'create', person: null, initialPendingRelationships: [] }),
    onOpenRelationshipDialog: () => setRelationshipDialogVisible(true),
    onOpenPersonQuickActions: (person) => setNodeQuickActionState({ visible: true, person }),
    onOpenCollaboratorDialog: () => setCollaboratorDialogVisible(true),
    onOpenAddSelf: () => setSelfPersonDialogVisible(true),
    onEditPerson: (person) => setPersonDialog({ visible: true, mode: 'edit', person, initialPendingRelationships: [] }),
    onDeletePerson: async (person) => {
      if (!user?.id) {
        return;
      }
      await removePerson(user.id, person);
    },
    onRemoveCollaborator: async (collaboratorUserId) => removeCollaborator(selectedTree.id, collaboratorUserId),
    onAssignPersonToUser: handleAssignPersonToUser,
    onClearSelfAssignment: handleClearSelfAssignment,
    onApproveApprovalRequest: async (requestId) => {
      if (!user?.id) {
        return;
      }
      await approveApprovalRequest(user.id, requestId);
    },
    onRejectApprovalRequest: async (requestId) => {
      if (!user?.id) {
        return;
      }
      await rejectApprovalRequest(user.id, requestId);
    },
    onSetApprovalWindowHours: async (hours) => setApprovalWindowHours(selectedTree.id, hours),
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Tab.Navigator
        key={`${route.params.treeId}-${initialTab}`}
        initialRouteName={initialTab}
        screenOptions={({ route: currentRoute }) => ({
          lazy: true,
          lazyPreloadDistance: 0,
          swipeEnabled: true,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          tabBarShowIcon: true,
          tabBarStyle: [styles.tabBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outlineVariant }],
          tabBarIndicatorStyle: [styles.tabIndicator, { backgroundColor: theme.colors.primary }],
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          tabBarPressColor: theme.colors.secondaryContainer,
          sceneStyle: [styles.tabScene, { backgroundColor: theme.colors.background }],
          tabBarIcon: ({ color }) => {
            const iconName = currentRoute.name === 'PeopleRelationshipsTab'
              ? 'account-group-outline'
              : currentRoute.name === 'VisualisationTab'
                ? 'family-tree'
                : currentRoute.name === 'ProfileTab'
                  ? 'card-account-details-outline'
                  : 'home-outline';
            return <MaterialCommunityIcons name={iconName} size={20} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="PeopleRelationshipsTab"
          options={{ title: 'Family members' }}
        >
          {() => <PeopleRelationshipsTabContent {...sharedTabProps} />}
        </Tab.Screen>
        <Tab.Screen
          name="VisualisationTab"
          options={{ title: 'Tree' }}
        >
          {() => <VisualisationTabContent {...sharedTabProps} />}
        </Tab.Screen>
        <Tab.Screen
          name="ProfileTab"
          options={{ title: 'Profile' }}
        >
          {() => <ProfileTabContent {...sharedTabProps} />}
        </Tab.Screen>
        <Tab.Screen
          name="HomeTab"
          options={{ title: 'Home' }}
          listeners={() => ({
            tabPress: (event) => {
              event.preventDefault();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home', params: { skipAutoOpen: true } }],
              });
            },
          })}
        >
          {() => null}
        </Tab.Screen>
      </Tab.Navigator>

      <CollaboratorDialog
        visible={collaboratorDialogVisible}
        loading={mutating}
        onDismiss={() => setCollaboratorDialogVisible(false)}
        onSubmit={handleCollaboratorSubmit}
      />

      <PersonFormDialog
        visible={personDialog.visible}
        mode={personDialog.mode}
        person={personDialog.person}
        initialPendingRelationships={personDialog.initialPendingRelationships}
        loading={mutating}
        existingLastNames={existingLastNames}
        relationshipCandidates={people.filter((candidate) => candidate.id !== personDialog.person?.id)}
        onDismiss={closePersonDialog}
        onSubmit={handlePersonSubmit}
      />

      <PersonFormDialog
        visible={selfPersonDialogVisible}
        mode="create"
        initialValues={{
          firstName: getUserNameParts(user).firstName,
          lastName: getUserNameParts(user).lastName,
          gender: 'unspecified',
          birthDate: '',
          deathDate: '',
          notes: '',
          lifeEvents: [],
          existingPhotos: [],
          removedPhotos: [],
          newPhotoUris: [],
          preferredPhotoRef: '',
        }}
        loading={mutating}
        existingLastNames={existingLastNames}
        relationshipCandidates={people}
        onDismiss={() => setSelfPersonDialogVisible(false)}
        onSubmit={handleSelfPersonSubmit}
      />

      <RelationshipDialog
        visible={relationshipDialogVisible}
        people={people}
        relationships={relationships}
        loading={mutating}
        onDismiss={() => setRelationshipDialogVisible(false)}
        onSubmit={handleRelationshipSubmit}
      />

      <Portal>
        <Dialog visible={nodeQuickActionState.visible} onDismiss={closeNodeQuickActions} style={styles.quickActionDialog}>
          <Dialog.Title>{nodeQuickActionState.person ? formatPersonName(nodeQuickActionState.person) : 'Quick actions'}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={[styles.quickActionSubtitle, { color: theme.colors.onSurfaceVariant }]}>Choose what you want to do with this family member in the tree.</Text>
            <List.Item
              title="Open profile"
              description="See photos, memories, and full relationship details"
              left={(props) => <List.Icon {...props} icon="account-arrow-right-outline" />}
              onPress={() => {
                const selectedPerson = nodeQuickActionState.person;
                if (!selectedPerson) {
                  return;
                }

                closeNodeQuickActions();
                openPersonProfile(selectedPerson);
              }}
            />
            {canEdit && nodeQuickActionState.person ? (
              <>
                <List.Item
                  title="Add parent"
                  description={`Create a new parent for ${formatPersonName(nodeQuickActionState.person)}`}
                  left={(props) => <List.Icon {...props} icon="account-arrow-up-outline" />}
                  onPress={() => openCreateRelativeDialog('parent-of', nodeQuickActionState.person!)}
                  disabled={mutating}
                />
                <List.Item
                  title="Add child"
                  description={`Create a new child for ${formatPersonName(nodeQuickActionState.person)}`}
                  left={(props) => <List.Icon {...props} icon="account-arrow-down-outline" />}
                  onPress={() => openCreateRelativeDialog('child-of', nodeQuickActionState.person!)}
                  disabled={mutating}
                />
                <List.Item
                  title="Add spouse"
                  description={`Create a spouse for ${formatPersonName(nodeQuickActionState.person)}`}
                  left={(props) => <List.Icon {...props} icon="account-heart-outline" />}
                  onPress={() => openCreateRelativeDialog('spouse-of', nodeQuickActionState.person!)}
                  disabled={mutating}
                />
              </>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeNodeQuickActions}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <ConfirmDialog
        visible={confirmState.visible}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        loading={mutating}
        onDismiss={closeConfirm}
        onConfirm={handleConfirm}
      />

      <Snackbar
        visible={snackVisible}
        onDismiss={() => {
          setSnackVisible(false);
          clearError();
          clearNotice();
        }}
        duration={5000}
        action={{
          label: 'Dismiss',
          onPress: () => {
            setSnackVisible(false);
            clearError();
            clearNotice();
          },
        }}
      >
        {error ?? notice}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7FF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F7FF',
  },
  tabScene: {
    backgroundColor: '#F8F7FF',
  },
  tabBar: {
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    minHeight: 64,
  },
  tabIndicator: {
    height: 3,
    borderRadius: 999,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'none',
  },
  tabItem: {
    minHeight: 64,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    borderRadius: 5,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    minWidth: 220,
  },
  sectionSubtitle: {
    marginTop: 4,
    color: '#6B6B74',
  },
  managementSegmentedButtons: {
    marginTop: 16,
  },
  treeSettingsWrap: {
    marginTop: 16,
  },
  approvalWindowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  approvalWindowInput: {
    minWidth: 120,
    flexBasis: 120,
  },
  summaryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  collaboratorList: {
    marginTop: 16,
  },
  collaboratorCard: {
    marginBottom: 12,
  },
  collaboratorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  approvalRequestHeader: {
    gap: 12,
  },
  approvalRequestActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  collaboratorTextWrap: {
    flex: 1,
  },
  collaboratorMeta: {
    color: '#6B6B74',
    marginTop: 4,
  },
  collaboratorChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionButtonsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  visualisationTabContainer: {
    flex: 1,
    padding: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  visualisationEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    paddingHorizontal: 24,
  },
  filterInput: {
    marginTop: 16,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  profileMetricsWrap: {
    marginTop: 16,
    gap: 12,
  },
  selfAssignmentSectionWrap: {
    marginTop: 20,
  },
  selfAssignmentCard: {
    marginTop: 16,
    borderRadius: 5,
  },
  selfAssignmentHeader: {
    gap: 12,
  },
  selfAssignmentTextWrap: {
    flex: 1,
  },
  selfAssignmentTitle: {
    marginTop: 10,
  },
  selfAssignmentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  assignmentHelperText: {
    marginTop: 12,
  },
  assignmentSuggestionList: {
    marginTop: 16,
    gap: 12,
  },
  assignmentSuggestionCard: {
    borderRadius: 5,
  },
  assignmentSuggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  assignmentSuggestionTextWrap: {
    flex: 1,
  },
  assignmentChooserWrap: {
    marginTop: 20,
  },
  assignmentSearchInput: {
    marginTop: 12,
  },
  collaboratorSectionWrap: {
    marginTop: 20,
  },
  metricCard: {
    marginBottom: 0,
  },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  stateText: {
    marginTop: 8,
    color: '#6B6B74',
    textAlign: 'center',
  },
  emptyStateButton: {
    marginTop: 16,
  },
  emptyStateActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
  },
  personCard: {
    marginTop: 16,
  },
  personHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  personPhotoWrap: {
    marginRight: 4,
  },
  personPhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#CFC5FF',
    backgroundColor: '#ECE8FF',
  },
  personPhotoFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#CFC5FF',
    backgroundColor: '#ECE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personHeaderText: {
    flex: 1,
  },
  personNameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  personNotes: {
    marginTop: 12,
    color: '#3E3E45',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ownerSuggestionWrap: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D7D1F9',
  },
  ownerSuggestionButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  quickActionDialog: {
    marginHorizontal: 16,
  },
  quickActionSubtitle: {
    marginBottom: 8,
  },
});
