import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Button,
  Dialog,
  List,
  Portal,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';
import {
  CollaboratorDialog,
  ConfirmDialog,
  PersonFormDialog,
  RelationshipDialog,
} from '../../components';
import type { PersonFormSubmission } from '../../components/person-form-dialog';
import type { PendingRelationshipSubmission } from '../../components/person-form-dialog';
import { useAuthStore } from '../../stores/auth-store';
import { useTreeStore } from '../../stores/tree-store';
import type { PersonRecord } from '../../components/dto/person';
import type { RootStackParamList, TreeDetailTabParamList } from '../../components/dto/navigation';
import { getUserDisplayLabel, getUserNameParts } from '../../components/dto/user';
import { formatPersonName } from '../../components/person-formatting';
import { canEditTreeContent, canManageTree, getAssignedPersonId, getTreeRole, type CollaboratorRole } from '../../components/dto/tree';
import { GlobalStyles } from '../../constants/styles';
import {
  buildSelfAssignmentSuggestions,
  PeopleRelationshipsTabContent,
  TreeSettingsTabContent,
  VisualisationTabContent,
  type SharedTabProps,
} from './tree-tab-content';
const dialogChrome = GlobalStyles.dialogChrome;

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

const Tab = createBottomTabNavigator<TreeDetailTabParamList>();
const styles = GlobalStyles.treeDetail;

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
        navigation.navigate('Main');
      }
    }
  }, [loadingTrees, navigation, route.params.treeId, selectedTree, selectedTreeId]);

  useEffect(() => {
    if (error || notice) {
      setSnackVisible(true);
    }
  }, [error, notice]);

  const openConfirm = useCallback((title: string, message: string, confirmLabel: string, action: () => Promise<void>) => {
    setConfirmState({ visible: true, title, message, confirmLabel, action });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState({ visible: false, title: '', message: '', confirmLabel: 'Confirm', action: null });
  }, []);

  const openPersonProfile = useCallback((person: PersonRecord) => {
    navigation.navigate('PersonProfile', {
      treeId: route.params.treeId,
      personId: person.id,
    });
  }, [navigation, route.params.treeId]);

  const closePersonDialog = useCallback(() => {
    setPersonDialog({ visible: false, mode: 'create', person: null, initialPendingRelationships: [] });
  }, []);

  const closeNodeQuickActions = useCallback(() => {
    setNodeQuickActionState({ visible: false, person: null });
  }, []);

  const openCreateRelativeDialog = useCallback((mode: PendingRelationshipSubmission['mode'], relatedPerson: PersonRecord) => {
    setNodeQuickActionState({ visible: false, person: null });
    setPersonDialog({
      visible: true,
      mode: 'create',
      person: null,
      initialPendingRelationships: [{ mode, relatedPersonId: relatedPerson.id }],
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!confirmState.action) {
      return;
    }

    try {
      await confirmState.action();
      closeConfirm();
    } catch {
      // surfaced by store snackbar
    }
  }, [closeConfirm, confirmState.action]);

  const handleCollaboratorSubmit = useCallback(async ({ email, role: collaboratorRole }: { email: string; role: CollaboratorRole }) => {
    if (!selectedTree) {
      return;
    }

    try {
      await addCollaborator(selectedTree.id, email, collaboratorRole);
      setCollaboratorDialogVisible(false);
    } catch {
      // surfaced by store snackbar
    }
  }, [addCollaborator, selectedTree]);

  const createPersonFromPayload = useCallback(async (payload: PersonFormSubmission) => {
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
  }, [addParentChildRelationship, addSpouseRelationship, createPerson, selectedTree, user?.id]);

  const handlePersonSubmit = useCallback(async (payload: PersonFormSubmission) => {
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
  }, [closePersonDialog, createPersonFromPayload, personDialog.mode, personDialog.person, selectedTree, updatePerson, user?.id]);

  const handleSelfPersonSubmit = useCallback(async (payload: PersonFormSubmission) => {
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
  }, [assignPersonToUser, createPersonFromPayload, selectedTree, user?.id]);

  const handleAssignPersonToUser = useCallback(async (targetUserId: string, personId: string) => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      await assignPersonToUser(user.id, selectedTree.id, targetUserId, personId);
    } catch {
      // surfaced by store snackbar
    }
  }, [assignPersonToUser, selectedTree, user?.id]);

  const handleClearSelfAssignment = useCallback(async () => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      await clearSelfAssignment(selectedTree.id, user.id);
    } catch {
      // surfaced by store snackbar
    }
  }, [clearSelfAssignment, selectedTree, user?.id]);

  const handleRelationshipSubmit = useCallback(async ({
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
  }, [addParentChildRelationship, addSpouseRelationship, selectedTree, user?.id]);

  const personDialogRelationshipCandidates = useMemo(
    () => people.filter((candidate) => candidate.id !== personDialog.person?.id),
    [people, personDialog.person?.id],
  );

  const selfUserNameParts = useMemo(() => getUserNameParts(user), [user]);

  const onOpenAddPerson = useCallback(() => setPersonDialog({ visible: true, mode: 'create', person: null, initialPendingRelationships: [] }), []);
  const onOpenRelationshipDialog = useCallback(() => setRelationshipDialogVisible(true), []);
  const onOpenPersonQuickActions = useCallback((person: PersonRecord) => setNodeQuickActionState({ visible: true, person }), []);
  const onOpenCollaboratorDialog = useCallback(() => setCollaboratorDialogVisible(true), []);
  const onOpenAddSelf = useCallback(() => setSelfPersonDialogVisible(true), []);
  const onEditPerson = useCallback((person: PersonRecord) => setPersonDialog({ visible: true, mode: 'edit', person, initialPendingRelationships: [] }), []);
  const onDeletePerson = useCallback(async (person: PersonRecord) => {
    if (!user?.id) {
      return;
    }
    await removePerson(user.id, person);
  }, [removePerson, user?.id]);
  const onRemoveCollaborator = useCallback(async (collaboratorUserId: string) => {
    if (!selectedTree) return;
    await removeCollaborator(selectedTree.id, collaboratorUserId);
  }, [removeCollaborator, selectedTree]);
  const onSetApprovalWindowHours = useCallback(async (hours: number) => {
    if (!selectedTree) return;
    await setApprovalWindowHours(selectedTree.id, hours);
  }, [setApprovalWindowHours, selectedTree]);
  const onApproveApprovalRequest = useCallback(async (requestId: string) => {
    if (!user?.id) return;
    await approveApprovalRequest(user.id, requestId);
  }, [approveApprovalRequest, user?.id]);
  const onRejectApprovalRequest = useCallback(async (requestId: string) => {
    if (!user?.id) return;
    await rejectApprovalRequest(user.id, requestId);
  }, [rejectApprovalRequest, user?.id]);

  const sharedTabProps: SharedTabProps | null = useMemo(() => {
    if (!selectedTree) return null;
    return {
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
      onOpenAddPerson,
      onOpenRelationshipDialog,
      onOpenPersonQuickActions,
      onOpenCollaboratorDialog,
      onOpenAddSelf,
      onEditPerson,
      onDeletePerson,
      onRemoveCollaborator,
      onAssignPersonToUser: handleAssignPersonToUser,
      onClearSelfAssignment: handleClearSelfAssignment,
      onApproveApprovalRequest,
      onRejectApprovalRequest,
      onSetApprovalWindowHours,
    };
  }, [
    selectedTree, people, relationships, approvalRequests, peopleById, canEdit, isOwner, role,
    user?.id, currentUserLabel, currentAssignedPerson, currentSelfAssignmentSuggestions,
    availableSelfLinkPeople, assignedPersonByUserId, assignedUserIdByPersonId, mutating, loadingTreeData,
    openConfirm, openPersonProfile, onOpenAddPerson, onOpenRelationshipDialog, onOpenPersonQuickActions,
    onOpenCollaboratorDialog, onOpenAddSelf, onEditPerson, onDeletePerson, onRemoveCollaborator,
    handleAssignPersonToUser, handleClearSelfAssignment, onApproveApprovalRequest, onRejectApprovalRequest,
    onSetApprovalWindowHours,
  ]);

  if (!selectedTree || !sharedTabProps) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Tab.Navigator
        key={`${route.params.treeId}-${initialTab}`}
        initialRouteName={initialTab}
        screenOptions={({ route: currentRoute }) => ({
          lazy: true,
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          tabBarShowIcon: true,
          tabBarStyle: [styles.tabBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }],
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          sceneStyle: [styles.tabScene, { backgroundColor: theme.colors.background }],
          tabBarIcon: ({ color, size }) => {
            const iconName = currentRoute.name === 'PeopleRelationshipsTab'
              ? 'account-group-outline'
              : currentRoute.name === 'VisualisationTab'
                ? 'family-tree'
                : currentRoute.name === 'ProfileTab'
                  ? 'card-account-details-outline'
                  : 'home-outline';
            return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="PeopleRelationshipsTab" options={{ title: 'Family members' }}>
          {() => <PeopleRelationshipsTabContent {...sharedTabProps} />}
        </Tab.Screen>
        <Tab.Screen name="VisualisationTab" options={{ title: 'Tree' }}>
          {() => <VisualisationTabContent {...sharedTabProps} />}
        </Tab.Screen>
        <Tab.Screen name="ProfileTab" options={{ title: 'Profile' }}>
          {() => <TreeSettingsTabContent {...sharedTabProps} />}
        </Tab.Screen>
        <Tab.Screen
          name="HomeTab"
          options={{ title: 'Home' }}
          listeners={() => ({
            tabPress: (event) => {
              event.preventDefault();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
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
        relationshipCandidates={personDialogRelationshipCandidates}
        relationships={relationships}
        onDismiss={closePersonDialog}
        onSubmit={handlePersonSubmit}
        onDelete={personDialog.mode === 'edit' && personDialog.person ? async () => {
          const person = personDialog.person;
          if (!person) {
            return;
          }
          await onDeletePerson(person);
          closePersonDialog();
        } : undefined}
      />

      <PersonFormDialog
        visible={selfPersonDialogVisible}
        mode="create"
        initialValues={useMemo(() => ({
          firstName: selfUserNameParts.firstName,
          lastName: selfUserNameParts.lastName,
          gender: 'unspecified' as const,
          birthDate: '',
          deathDate: '',
          notes: '',
          lifeEvents: [],
          existingPhotos: [],
          removedPhotos: [],
          newPhotoUris: [],
          preferredPhotoRef: '',
        }), [selfUserNameParts.firstName, selfUserNameParts.lastName])}
        loading={mutating}
        existingLastNames={existingLastNames}
        relationshipCandidates={people}
        onDismiss={useCallback(() => setSelfPersonDialogVisible(false), [])}
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
        <Dialog
          visible={nodeQuickActionState.visible}
          onDismiss={closeNodeQuickActions}
          style={[dialogChrome.dialog, styles.quickActionDialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>{nodeQuickActionState.person ? formatPersonName(nodeQuickActionState.person) : 'Quick actions'}</Dialog.Title>
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium" style={[styles.quickActionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Choose what you want to do with this family member in the tree.
            </Text>
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
                  onPress={() => {
                    const person = nodeQuickActionState.person;
                    if (!person) {
                      return;
                    }
                    openCreateRelativeDialog('parent-of', person);
                  }}
                  disabled={mutating}
                />
                <List.Item
                  title="Add child"
                  description={`Create a new child for ${formatPersonName(nodeQuickActionState.person)}`}
                  left={(props) => <List.Icon {...props} icon="account-arrow-down-outline" />}
                  onPress={() => {
                    const person = nodeQuickActionState.person;
                    if (!person) {
                      return;
                    }
                    openCreateRelativeDialog('child-of', person);
                  }}
                  disabled={mutating}
                />
                <List.Item
                  title="Add spouse"
                  description={`Create a spouse for ${formatPersonName(nodeQuickActionState.person)}`}
                  left={(props) => <List.Icon {...props} icon="account-heart-outline" />}
                  onPress={() => {
                    const person = nodeQuickActionState.person;
                    if (!person) {
                      return;
                    }
                    openCreateRelativeDialog('spouse-of', person);
                  }}
                  disabled={mutating}
                />
              </>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
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
