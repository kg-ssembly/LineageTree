import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  Snackbar,
  Surface,
  Text,
} from 'react-native-paper';
import {
  CollaboratorDialog,
  ConfirmDialog,
  FamilyTreeCanvas,
  PersonFormDialog,
  RelationshipDialog,
  RelationshipInsightCard,
} from '../components';
import { theme } from '../lib/theme';
import { useAuthStore } from '../store/authStore';
import { useTreeStore } from '../store/treeStore';
import type { PersonGender, PersonMutationPayload, PersonRecord } from '../types/person';
import type { RelationshipRecord } from '../types/relationship';
import type { RootStackParamList } from '../types/navigation';
import {
  canEditTreeContent,
  canManageTree,
  getTreeRole,
  type CollaboratorRole,
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

function formatRelationshipLabel(relationship: RelationshipRecord, peopleById: Map<string, PersonRecord>) {
  const fromPerson = peopleById.get(relationship.fromPersonId);
  const toPerson = peopleById.get(relationship.toPersonId);

  if (relationship.type === 'spouse') {
    return `${formatPersonName(fromPerson)} ↔ ${formatPersonName(toPerson)}`;
  }

  return `${formatPersonName(fromPerson)} → ${formatPersonName(toPerson)}`;
}

function formatRole(role: string | null | undefined) {
  if (!role) {
    return 'Shared';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function TreeDetailScreen({ navigation, route }: Props) {
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

  const handlePersonSubmit = async (payload: PersonMutationPayload) => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      if (personDialog.mode === 'create') {
        await createPerson(
          user.id,
          selectedTree.id,
          {
            firstName: payload.firstName,
            lastName: payload.lastName,
            birthDate: payload.birthDate,
            gender: payload.gender,
            notes: payload.notes,
          },
          payload.newPhotoUris,
        );
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

  const getPersonRelationships = (personId: string) => {
    const spouses = relationships
      .filter((relationship) => relationship.type === 'spouse' && (relationship.fromPersonId === personId || relationship.toPersonId === personId))
      .map((relationship) => peopleById.get(relationship.fromPersonId === personId ? relationship.toPersonId : relationship.fromPersonId))
      .filter(Boolean) as PersonRecord[];

    const parents = relationships
      .filter((relationship) => relationship.type === 'parent-child' && relationship.toPersonId === personId)
      .map((relationship) => peopleById.get(relationship.fromPersonId))
      .filter(Boolean) as PersonRecord[];

    const children = relationships
      .filter((relationship) => relationship.type === 'parent-child' && relationship.fromPersonId === personId)
      .map((relationship) => peopleById.get(relationship.toPersonId))
      .filter(Boolean) as PersonRecord[];

    return { spouses, parents, children };
  };

  if (!selectedTree) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Surface style={styles.sectionCard} elevation={1}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWrap}>
              <Text variant="headlineSmall">{selectedTree.name}</Text>
              <Text variant="bodyMedium" style={styles.sectionSubtitle}>
                Explore the tree visually, open person profiles, and understand how relatives connect.
              </Text>
            </View>
            <View style={styles.headerChips}>
              <Chip icon="account-key">{formatRole(role)}</Chip>
              {!canEdit ? <Chip icon="eye">Read only</Chip> : null}
            </View>
          </View>

          <View style={styles.summaryChipRow}>
            <Chip icon="account-group">{people.length} people</Chip>
            <Chip icon="graph-outline">{relationships.length} relationships</Chip>
            <Chip icon="account-multiple">{selectedTree.collaborators.length} collaborators</Chip>
          </View>
        </Surface>

        <Surface style={styles.sectionCard} elevation={1}>
          <Text variant="titleLarge">Tree visualization</Text>
          <Text variant="bodyMedium" style={styles.sectionSubtitle}>
            Nodes represent people and edges represent parent-child or spouse relationships. Tap a node to open the person profile.
          </Text>
          {people.length > 0 ? (
            <FamilyTreeCanvas
              people={people}
              relationships={relationships}
              onPressPerson={openPersonProfile}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">No visual tree yet</Text>
              <Text variant="bodyMedium" style={styles.stateText}>
                Add people and relationships to see the family graph render here.
              </Text>
            </View>
          )}
        </Surface>

        <Surface style={styles.sectionCard} elevation={1}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWrap}>
              <Text variant="titleLarge">Collaborators</Text>
              <Text variant="bodyMedium" style={styles.sectionSubtitle}>
                Owners manage access. Editors can update people and relationships. Viewers can browse the tree.
              </Text>
            </View>
            {isOwner ? (
              <Button mode="contained" icon="account-plus" onPress={() => setCollaboratorDialogVisible(true)} disabled={mutating}>
                Add collaborator
              </Button>
            ) : null}
          </View>

          <View style={styles.collaboratorList}>
            {selectedTree.collaborators.map((collaborator) => (
              <Card key={collaborator.userId} mode="outlined" style={styles.collaboratorCard}>
                <Card.Content>
                  <View style={styles.collaboratorRow}>
                    <View style={styles.collaboratorTextWrap}>
                      <Text variant="titleMedium">{collaborator.displayName || collaborator.email}</Text>
                      <Text variant="bodySmall" style={styles.collaboratorMeta}>{collaborator.email}</Text>
                      <View style={styles.collaboratorChipRow}>
                        <Chip compact>{formatRole(collaborator.role)}</Chip>
                        {collaborator.userId === user?.id ? <Chip compact icon="account">You</Chip> : null}
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
                          async () => {
                            await removeCollaborator(selectedTree.id, collaborator.userId);
                          },
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

        <RelationshipInsightCard people={people} relationships={relationships} />

        <Surface style={styles.sectionCard} elevation={1}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWrap}>
              <Text variant="titleLarge">People</Text>
              <Text variant="bodyMedium" style={styles.sectionSubtitle}>
                Profiles keep notes and photo memories together. Tap a card to open the profile and gallery.
              </Text>
            </View>
            <View style={styles.actionButtonsWrap}>
              <Button
                mode="contained-tonal"
                icon="account-plus"
                onPress={() => setPersonDialog({ visible: true, mode: 'create', person: null })}
                disabled={mutating || !canEdit}
              >
                Add person
              </Button>
              <Button
                mode="contained"
                icon="family-tree"
                onPress={() => setRelationshipDialogVisible(true)}
                disabled={mutating || !canEdit || people.length < 2}
              >
                Add relationship
              </Button>
            </View>
          </View>

          {loadingTreeData ? (
            <View style={styles.centeredState}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text variant="bodyMedium" style={styles.stateText}>Loading tree details…</Text>
            </View>
          ) : (
            <>
              {people.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text variant="titleMedium">No people in this tree yet</Text>
                  <Text variant="bodyMedium" style={styles.stateText}>
                    {canEdit
                      ? 'Add a person to start building this family tree.'
                      : 'This shared tree does not have any people yet.'}
                  </Text>
                </View>
              ) : (
                people.map((person) => {
                  const { spouses, parents, children } = getPersonRelationships(person.id);
                  return (
                    <Card key={person.id} style={styles.personCard} mode="outlined" onPress={() => openPersonProfile(person)}>
                      <Card.Content>
                        <View style={styles.personHeader}>
                          <View style={styles.personHeaderText}>
                            <Text variant="titleLarge">{formatPersonName(person)}</Text>
                            <View style={styles.metadataRow}>
                              {person.gender !== 'unspecified' ? <Chip compact>{formatGender(person.gender)}</Chip> : null}
                              {person.birthDate ? <Chip compact icon="calendar">{person.birthDate}</Chip> : null}
                              <Chip compact icon="image-multiple">{person.photos.length} photos</Chip>
                            </View>
                          </View>
                          <View style={styles.cardActions}>
                            <IconButton icon="open-in-new" onPress={() => openPersonProfile(person)} />
                            {canEdit ? (
                              <>
                                <IconButton
                                  icon="pencil"
                                  onPress={() => setPersonDialog({ visible: true, mode: 'edit', person })}
                                  disabled={mutating}
                                />
                                <IconButton
                                  icon="delete"
                                  iconColor="#C62828"
                                  onPress={() => openConfirm(
                                    'Delete person',
                                    `Delete ${formatPersonName(person)} and remove every relationship connected to this person?`,
                                    'Delete',
                                    async () => {
                                      await removePerson(person);
                                    },
                                  )}
                                  disabled={mutating}
                                />
                              </>
                            ) : null}
                          </View>
                        </View>

                        {person.notes ? (
                          <Text variant="bodyMedium" style={styles.personNotes}>{person.notes}</Text>
                        ) : (
                          <Text variant="bodyMedium" style={styles.personNotes}>No notes added yet.</Text>
                        )}

                        <View style={styles.relationshipGroup}>
                          {parents.length > 0 ? (
                            <Text variant="bodySmall" style={styles.relationshipText}>
                              Parents: {parents.map((currentPerson) => formatPersonName(currentPerson)).join(', ')}
                            </Text>
                          ) : null}
                          {children.length > 0 ? (
                            <Text variant="bodySmall" style={styles.relationshipText}>
                              Children: {children.map((currentPerson) => formatPersonName(currentPerson)).join(', ')}
                            </Text>
                          ) : null}
                          {spouses.length > 0 ? (
                            <Text variant="bodySmall" style={styles.relationshipText}>
                              Spouses: {spouses.map((currentPerson) => formatPersonName(currentPerson)).join(', ')}
                            </Text>
                          ) : null}
                        </View>
                      </Card.Content>
                    </Card>
                  );
                })
              )}

              <Divider style={styles.sectionDivider} />
              <Text variant="titleLarge" style={styles.subsectionTitle}>Relationships</Text>
              {relationships.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text variant="titleMedium">No relationships yet</Text>
                  <Text variant="bodyMedium" style={styles.stateText}>
                    {canEdit
                      ? 'Add parent-child or spouse connections to bring the tree to life.'
                      : 'Relationships will appear here when editors add them.'}
                  </Text>
                </View>
              ) : (
                relationships.map((relationship) => (
                  <Card key={relationship.id} style={styles.relationshipCard} mode="outlined">
                    <Card.Title
                      title={formatRelationshipLabel(relationship, peopleById)}
                      subtitle={relationship.type === 'spouse' ? 'Mutual spouse relationship' : 'Directional parent → child relationship'}
                      right={() => (canEdit ? (
                        <IconButton
                          icon="delete"
                          iconColor="#C62828"
                          onPress={() => openConfirm(
                            'Remove relationship',
                            `Remove ${formatRelationshipLabel(relationship, peopleById)}?`,
                            'Remove',
                            async () => {
                              await removeRelationship(relationship.id);
                            },
                          )}
                          disabled={mutating}
                        />
                      ) : null)}
                    />
                  </Card>
                ))
              )}
            </>
          )}
        </Surface>
      </ScrollView>

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
  headerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  relationshipGroup: {
    marginTop: 12,
  },
  relationshipText: {
    color: '#4E4E58',
    marginBottom: 4,
  },
  sectionDivider: {
    marginVertical: 20,
  },
  subsectionTitle: {
    fontWeight: '700',
    marginBottom: 12,
  },
  relationshipCard: {
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

