import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  IconButton,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import {
  CollaboratorDialog,
  ConfirmDialog,
  FamilyTreeCanvas,
  PersonFormDialog,
  RelationshipDialog,
  RelationshipInsightCard,
} from '../components';
import type { PersonFormSubmission } from '../components/PersonFormDialog';
import { useAuthStore } from '../store/authStore';
import { useTreeStore } from '../store/treeStore';
import type { PersonGender, PersonRecord } from '../types/person';
import { getPersonPresenceLabel, getPreferredPersonPhoto, isPersonDeceased } from '../types/person';
import type { RelationshipRecord } from '../types/relationship';
import type { RootStackParamList, TreeDetailTabParamList } from '../types/navigation';
import {
  canEditTreeContent,
  canManageTree,
  getTreeRole,
  type CollaboratorRole,
  type FamilyTree,
} from '../types/tree';

type Props = NativeStackScreenProps<RootStackParamList, 'TreeDetail'>;

type PersonDialogState = {
  visible: boolean;
  mode: 'create' | 'edit';
  person: PersonRecord | null;
};

type ConfirmState = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  action: (() => Promise<void>) | null;
};

interface SharedTabProps {
  selectedTree: FamilyTree;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  peopleById: Map<string, PersonRecord>;
  canEdit: boolean;
  isOwner: boolean;
  role: string | null;
  userId?: string;
  mutating: boolean;
  loadingTreeData: boolean;
  openConfirm: (title: string, message: string, confirmLabel: string, action: () => Promise<void>) => void;
  openPersonProfile: (person: PersonRecord) => void;
  onOpenAddPerson: () => void;
  onOpenRelationshipDialog: () => void;
  onOpenCollaboratorDialog: () => void;
  onEditPerson: (person: PersonRecord) => void;
  onDeletePerson: (person: PersonRecord) => Promise<void>;
  onRemoveRelationship: (relationshipId: string, label: string) => Promise<void>;
  onRemoveCollaborator: (collaboratorUserId: string) => Promise<void>;
}

const Tab = createBottomTabNavigator<TreeDetailTabParamList>();

function formatPersonName(person?: PersonRecord | null) {
  if (!person) {
    return 'Unknown person';
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


function PeopleRelationshipsTabContent({
  people,
  canEdit,
  mutating,
  loadingTreeData,
  openPersonProfile,
  onOpenAddPerson,
  onOpenRelationshipDialog,
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
            <Text variant="titleLarge">People</Text>
            <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Profiles keep notes and photo memories together. Tap a card to open the profile and gallery.
            </Text>
          </View>
          <View style={styles.actionButtonsWrap}>
            <Button mode="contained-tonal" icon="account-plus" onPress={onOpenAddPerson} disabled={mutating || !canEdit}>
              Add person
            </Button>
            <Button mode="contained" icon="family-tree" onPress={onOpenRelationshipDialog} disabled={mutating || !canEdit || people.length < 2}>
              Add relationship
            </Button>
          </View>
        </View>

        <TextInput
          mode="outlined"
          label="Search people"
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
          <Chip selected={assetFilter === 'all'} onPress={() => setAssetFilter('all')}>All people</Chip>
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
                <Text variant="titleMedium">No matching people</Text>
                  <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}> 
                  {people.length === 0
                    ? (canEdit ? 'Add a person to start building this family tree.' : 'This shared tree does not have any people yet.')
                    : 'Try adjusting the search or filters to find a person.'}
                </Text>
              </View>
            ) : (
              filteredPeople.map((person) => {
                const preferredPhoto = getPreferredPersonPhoto(person);
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
                          <Text variant="titleLarge">{formatPersonName(person)}</Text>
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
                                  'Delete person',
                                  `Delete ${formatPersonName(person)} and remove every relationship connected to this person?`,
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

function CollaboratorsTabContent({
  selectedTree,
  isOwner,
  userId,
  mutating,
  onOpenCollaboratorDialog,
  openConfirm,
  onRemoveCollaborator,
}: SharedTabProps) {
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.sectionHeader}>
          <View style={styles.titleWrap}>
            <Text variant="titleLarge">Collaborators</Text>
            <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Owners manage access. Editors can update people and relationships. Viewers can browse the tree.
            </Text>
          </View>
          {isOwner ? (
            <Button mode="contained" icon="account-plus" onPress={onOpenCollaboratorDialog} disabled={mutating}>
              Add collaborator
            </Button>
          ) : null}
        </View>

        <View style={styles.collaboratorList}>
          {selectedTree.collaborators.map((collaborator) => (
            <Card key={collaborator.userId} mode="outlined" style={[styles.collaboratorCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
              <Card.Content>
                <View style={styles.collaboratorRow}>
                  <View style={styles.collaboratorTextWrap}>
                    <Text variant="titleMedium">{collaborator.displayName || collaborator.email}</Text>
                    <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{collaborator.email}</Text>
                    <View style={styles.collaboratorChipRow}>
                      <Chip compact>{formatRole(collaborator.role)}</Chip>
                      {collaborator.userId === userId ? <Chip compact icon="account">You</Chip> : null}
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
              </Card.Content>
            </Card>
          ))}
        </View>
      </Surface>
    </ScrollView>
  );
}

function VisualisationTabContent({ people, relationships, openPersonProfile }: SharedTabProps) {
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="titleLarge">Tree visualization</Text>
        <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Nodes represent people and edges represent parent-child or spouse relationships. Tap a node to open the person profile.
        </Text>
        {people.length > 0 ? (
          <FamilyTreeCanvas people={people} relationships={relationships} onPressPerson={openPersonProfile} />
        ) : (
          <View style={styles.emptyState}>
            <Text variant="titleMedium">No visual tree yet</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
              Add people and relationships to see the family graph render here.
            </Text>
          </View>
        )}
      </Surface>
    </ScrollView>
  );
}

function ProfileTabContent({ selectedTree, people, relationships, role }: SharedTabProps) {
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall">{selectedTree.name}</Text>
        <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Review the current tree at a glance and use the intelligence tool to understand relationships between members.
        </Text>

        <View style={styles.summaryChipRow}>
          <Chip icon="account-key">{formatRole(role)}</Chip>
          <Chip icon="account-group">{people.length} people</Chip>
          <Chip icon="graph-outline">{relationships.length} relationships</Chip>
          <Chip icon="account-multiple">{selectedTree.collaborators.length} collaborators</Chip>
        </View>

        <View style={styles.profileMetricsWrap}>
            <Card mode="outlined" style={[styles.metricCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
            <Card.Content>
              <Text variant="titleSmall">People with notes</Text>
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
      </Surface>

      <RelationshipInsightCard people={people} relationships={relationships} />
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
    loadingTrees,
    loadingTreeData,
    mutating,
    error,
    selectTree,
    addCollaborator,
    removeCollaborator,
    createPerson,
    updatePerson,
    removePerson,
    addParentChildRelationship,
    addSpouseRelationship,
    removeRelationship,
    clearError,
  } = useTreeStore();

  const [personDialog, setPersonDialog] = useState<PersonDialogState>({ visible: false, mode: 'create', person: null });
  const [relationshipDialogVisible, setRelationshipDialogVisible] = useState(false);
  const [collaboratorDialogVisible, setCollaboratorDialogVisible] = useState(false);
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

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const existingLastNames = useMemo(
    () => [...new Set(people.map((person) => person.lastName.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [people],
  );

  const role = selectedTree ? getTreeRole(selectedTree, user?.id) : null;
  const isOwner = selectedTree ? canManageTree(selectedTree, user?.id) : false;
  const canEdit = selectedTree ? canEditTreeContent(selectedTree, user?.id) : false;

  useEffect(() => {
    selectTree(route.params.treeId);
  }, [route.params.treeId, selectTree]);

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
      personName: formatPersonName(person),
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

  const handlePersonSubmit = async (payload: PersonFormSubmission) => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      if (personDialog.mode === 'create') {
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
      } else if (personDialog.person) {
        await updatePerson(user.id, personDialog.person, payload);
      }

      setPersonDialog({ visible: false, mode: 'create', person: null });
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
    peopleById,
    canEdit,
    isOwner,
    role,
    userId: user?.id,
    mutating,
    loadingTreeData,
    openConfirm,
    openPersonProfile,
    onOpenAddPerson: () => setPersonDialog({ visible: true, mode: 'create', person: null }),
    onOpenRelationshipDialog: () => setRelationshipDialogVisible(true),
    onOpenCollaboratorDialog: () => setCollaboratorDialogVisible(true),
    onEditPerson: (person) => setPersonDialog({ visible: true, mode: 'edit', person }),
    onDeletePerson: async (person) => removePerson(person),
    onRemoveRelationship: async (relationshipId) => removeRelationship(relationshipId),
    onRemoveCollaborator: async (collaboratorUserId) => removeCollaborator(selectedTree.id, collaboratorUserId),
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Tab.Navigator
        screenOptions={({ route: currentRoute }) => ({
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          tabBarStyle: [styles.tabBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }],
          sceneStyle: [styles.tabScene, { backgroundColor: theme.colors.background }],
          tabBarIcon: ({ color, size }) => {
            const iconName = currentRoute.name === 'PeopleRelationshipsTab'
              ? 'account-group-outline'
              : currentRoute.name === 'CollaboratorsTab'
                ? 'account-multiple-outline'
                : currentRoute.name === 'VisualisationTab'
                  ? 'family-tree'
                  : 'card-account-details-outline';
            return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="PeopleRelationshipsTab"
          options={{ title: 'People' }}
        >
          {() => <PeopleRelationshipsTabContent {...sharedTabProps} />}
        </Tab.Screen>
        <Tab.Screen
          name="CollaboratorsTab"
          options={{ title: 'Collaborators' }}
        >
          {() => <CollaboratorsTabContent {...sharedTabProps} />}
        </Tab.Screen>
        <Tab.Screen
          name="VisualisationTab"
          options={{ title: 'Visualise' }}
        >
          {() => <VisualisationTabContent {...sharedTabProps} />}
        </Tab.Screen>
        <Tab.Screen
          name="ProfileTab"
          options={{ title: 'Profile' }}
        >
          {() => <ProfileTabContent {...sharedTabProps} />}
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
        loading={mutating}
        existingLastNames={existingLastNames}
        relationshipCandidates={people.filter((candidate) => candidate.id !== personDialog.person?.id)}
        onDismiss={() => setPersonDialog({ visible: false, mode: 'create', person: null })}
        onSubmit={handlePersonSubmit}
      />

      <RelationshipDialog
        visible={relationshipDialogVisible}
        people={people}
        relationships={relationships}
        loading={mutating}
        onDismiss={() => setRelationshipDialogVisible(false)}
        onSubmit={handleRelationshipSubmit}
      />

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
        }}
        duration={5000}
        action={{
          label: 'Dismiss',
          onPress: () => {
            setSnackVisible(false);
            clearError();
          },
        }}
      >
        {error}
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
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    borderRadius: 20,
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
});
