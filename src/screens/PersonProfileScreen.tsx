import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  IconButton,
  Portal,
  SegmentedButtons,
  Snackbar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { ConfirmDialog, FamilyTreeCanvas, LifeEventDialog, PersonFormDialog, PersonRelationshipDialog, RelationshipInsightCard } from '../components';
import type { PersonRelationshipMode } from '../components/PersonRelationshipDialog';
import { useAuthStore } from '../store/authStore';
import { useTreeStore } from '../store/treeStore';
import type { PersonGender, PersonLifeEvent, PersonMutationPayload, PersonRecord } from '../types/person';
import {
  formatPersonDate,
  getLifeEventTypeLabel,
  getPersonLifeSpanLabel,
  getPersonPresenceLabel,
  getPreferredPersonPhoto,
  isPersonDeceased,
} from '../types/person';
import type { RelationshipRecord } from '../types/relationship';
import type { RootStackParamList } from '../types/navigation';
import { canEditTreeContent, getAssignedPersonId, getAssignedUserIdForPerson } from '../types/tree';
import { formatPersonGender, formatPersonName } from '../lib/personFormatting';
import { GlobalStyles } from '../styles/global-styles';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonProfile'>;

type ConfirmState = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  action: (() => Promise<void>) | null;
};

type RelationshipDialogState = {
  visible: boolean;
  relationship: RelationshipRecord | null;
};

type LifeEventDialogState = {
  visible: boolean;
  event: PersonLifeEvent | null;
};

type HelperDialogKey = 'tabs' | 'member-profile' | 'relationships' | 'descendant-tree' | 'ascendant-tree' | 'memories-gallery';

type PersonProfileTabKey = 'member-profile' | 'relationships' | 'descendant-tree' | 'ascendant-tree' | 'memories-gallery';

function getRelationshipModeForPerson(personId: string, relationship: RelationshipRecord): PersonRelationshipMode {
  if (relationship.type === 'spouse') {
    return 'spouse-of';
  }

  return relationship.fromPersonId === personId ? 'parent-of' : 'child-of';
}

function buildPersonMutationPayload(
  person: PersonRecord,
  overrides: Partial<PersonMutationPayload> = {},
): PersonMutationPayload {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    birthDate: person.birthDate,
    deathDate: person.deathDate,
    gender: person.gender,
    notes: person.notes,
    lifeEvents: person.lifeEvents,
    preferredPhotoRef: person.preferredPhotoId,
    existingPhotos: person.photos,
    removedPhotos: [],
    newPhotoUris: [],
    ...overrides,
  };
}

function getDescendantIds(rootPersonId: string, relationships: RelationshipRecord[]) {
  const childIdsByParentId = new Map<string, Set<string>>();

  relationships.forEach((relationship) => {
    if (relationship.type !== 'parent-child') {
      return;
    }

    if (!childIdsByParentId.has(relationship.fromPersonId)) {
      childIdsByParentId.set(relationship.fromPersonId, new Set());
    }

    childIdsByParentId.get(relationship.fromPersonId)!.add(relationship.toPersonId);
  });

  const descendantIds = new Set<string>();
  const queue = [...(childIdsByParentId.get(rootPersonId) ?? new Set<string>())];

  while (queue.length > 0) {
    const currentPersonId = queue.shift()!;
    if (descendantIds.has(currentPersonId)) {
      continue;
    }

    descendantIds.add(currentPersonId);
    queue.push(...(childIdsByParentId.get(currentPersonId) ?? new Set<string>()));
  }

  return [...descendantIds];
}

function getAscendantIds(rootPersonId: string, relationships: RelationshipRecord[]) {
  const parentIdsByChildId = new Map<string, Set<string>>();

  relationships.forEach((relationship) => {
    if (relationship.type !== 'parent-child') {
      return;
    }

    if (!parentIdsByChildId.has(relationship.toPersonId)) {
      parentIdsByChildId.set(relationship.toPersonId, new Set());
    }

    parentIdsByChildId.get(relationship.toPersonId)!.add(relationship.fromPersonId);
  });

  const ascendantIds = new Set<string>();
  const queue = [...(parentIdsByChildId.get(rootPersonId) ?? new Set<string>())];

  while (queue.length > 0) {
    const currentPersonId = queue.shift()!;
    if (ascendantIds.has(currentPersonId)) {
      continue;
    }

    ascendantIds.add(currentPersonId);
    queue.push(...(parentIdsByChildId.get(currentPersonId) ?? new Set<string>()));
  }

  return [...ascendantIds];
}

const PERSON_PROFILE_TABS: Array<{ key: PersonProfileTabKey; label: string }> = [
  { key: 'member-profile', label: 'Member profile' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'descendant-tree', label: 'Descendant tree' },
  { key: 'ascendant-tree', label: 'Ascendant tree' },
  { key: 'memories-gallery', label: 'Memories & gallery' },
];

const PERSON_PROFILE_TAB_GROUPS: PersonProfileTabKey[][] = [
  ['member-profile', 'relationships', 'descendant-tree'],
  ['ascendant-tree', 'memories-gallery'],
];

const helperDialogCopy: Record<HelperDialogKey, { title: string; message: string }> = {
  tabs: {
    title: 'Family member sections',
    message: 'Switch between profile details, relationships, lineage trees, and memories from these tabs.',
  },
  'member-profile': {
    title: 'Member profile',
    message: 'Core identity details and personal notes for this family member are shown here.',
  },
  relationships: {
    title: 'Relationships',
    message: 'Manage parents, children, and spouse connections and review relationship insights from this section.',
  },
  'descendant-tree': {
    title: 'Descendant tree',
    message: 'This view starts from the current family member and follows children and younger generations downward.',
  },
  'ascendant-tree': {
    title: 'Ascendant tree',
    message: 'This view starts from the current family member and follows parents and older generations upward.',
  },
  'memories-gallery': {
    title: 'Memories & gallery',
    message: 'Browse notes, photo memories, and life events that form this family member timeline.',
  },
};

const styles = GlobalStyles.personProfile;

export default function PersonProfileScreen({ navigation, route }: Props) {
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
    notice,
    selectTree,
    assignPersonToUser,
    clearSelfAssignment,
    updatePerson,
    addParentChildRelationship,
    addSpouseRelationship,
    removeRelationship,
    clearError,
    clearNotice,
  } = useTreeStore();

  const [editorVisible, setEditorVisible] = useState(false);
  const [relationshipDialog, setRelationshipDialog] = useState<RelationshipDialogState>({ visible: false, relationship: null });
  const [lifeEventDialog, setLifeEventDialog] = useState<LifeEventDialogState>({ visible: false, event: null });
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    action: null,
  });
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [snackVisible, setSnackVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<PersonProfileTabKey>('member-profile');
  const [helperDialog, setHelperDialog] = useState<{ visible: boolean; key: HelperDialogKey }>({
    visible: false,
    key: 'tabs',
  });

  const selectedTree = useMemo(
    () => trees.find((tree) => tree.id === route.params.treeId) ?? null,
    [route.params.treeId, trees],
  );

  const person = useMemo(
    () => people.find((currentPerson) => currentPerson.id === route.params.personId) ?? null,
    [people, route.params.personId],
  );

  const canEdit = selectedTree ? canEditTreeContent(selectedTree, user?.id) : false;
  const preferredPhoto = getPreferredPersonPhoto(person);

  const peopleById = useMemo(
    () => new Map(people.map((currentPerson) => [currentPerson.id, currentPerson])),
    [people],
  );

  const existingLastNames = useMemo(
    () => [...new Set(people.map((currentPerson) => currentPerson.lastName.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [people],
  );

  const currentAssignedPersonId = useMemo(
    () => (selectedTree ? getAssignedPersonId(selectedTree, user?.id) : null),
    [selectedTree, user?.id],
  );

  const currentAssignedPerson = useMemo(
    () => (currentAssignedPersonId ? peopleById.get(currentAssignedPersonId) ?? null : null),
    [currentAssignedPersonId, peopleById],
  );

  const linkedUserIdForPerson = useMemo(
    () => (selectedTree && person ? getAssignedUserIdForPerson(selectedTree, person.id) : null),
    [person, selectedTree],
  );

  const linkedCollaborator = useMemo(
    () => selectedTree?.collaborators.find((collaborator) => collaborator.userId === linkedUserIdForPerson) ?? null,
    [linkedUserIdForPerson, selectedTree],
  );

  const isCurrentUsersPerson = useMemo(
    () => Boolean(person && currentAssignedPersonId === person.id),
    [currentAssignedPersonId, person],
  );

  const canClaimPerson = Boolean(
    user?.id
    && selectedTree
    && person
    && !isCurrentUsersPerson
    && !currentAssignedPerson
    && (!linkedUserIdForPerson || linkedUserIdForPerson === user.id),
  );

  const relationshipEntries = useMemo(() => {
    if (!person) {
      return [] as Array<{
        relationship: RelationshipRecord;
        mode: PersonRelationshipMode;
        relatedPerson: PersonRecord | null;
        title: string;
        subtitle: string;
      }>;
    }

    return relationships
      .filter((relationship) => relationship.fromPersonId === person.id || relationship.toPersonId === person.id)
      .map((relationship) => {
        const mode = getRelationshipModeForPerson(person.id, relationship);
        const relatedPersonId = mode === 'parent-of'
          ? relationship.toPersonId
          : mode === 'child-of'
            ? relationship.fromPersonId
            : relationship.fromPersonId === person.id
              ? relationship.toPersonId
              : relationship.fromPersonId;
        const relatedPerson = peopleById.get(relatedPersonId) ?? null;
        const title = mode === 'parent-of'
          ? `Parent of ${formatPersonName(relatedPerson)}`
          : mode === 'child-of'
            ? `Child of ${formatPersonName(relatedPerson)}`
            : `Spouse of ${formatPersonName(relatedPerson)}`;
        const subtitle = relationship.type === 'spouse'
          ? 'Partner connection'
          : mode === 'parent-of'
            ? 'Parent → child connection'
            : 'Child → parent connection';

        return {
          relationship,
          mode,
          relatedPerson,
          title,
          subtitle,
        };
      })
      .sort((left, right) => right.relationship.createdAt.localeCompare(left.relationship.createdAt));
  }, [peopleById, person, relationships]);

  const memoryTimeline = useMemo(() => {
    if (!person) {
      return [] as Array<{
        id: string;
        date: string;
        title: string;
        description: string;
        badgeLabel: string;
        system: boolean;
      }>;
    }

    const items = person.lifeEvents.map((event) => ({
      id: event.id,
      date: event.date,
      title: event.title,
      description: event.description,
      badgeLabel: getLifeEventTypeLabel(event.type),
      system: false,
    }));
    const hasManualDeathEvent = person.lifeEvents.some((event) => event.type === 'death');

    if (person.birthDate) {
      items.push({
        id: `birth-${person.id}`,
        date: person.birthDate,
        title: 'Birth',
        description: `${formatPersonName(person)} was born.`,
        badgeLabel: 'Birth',
        system: true,
      });
    }

    if (person.deathDate && !hasManualDeathEvent) {
      items.push({
        id: `death-${person.id}`,
        date: person.deathDate,
        title: 'In memory',
        description: `${formatPersonName(person)} passed away.`,
        badgeLabel: 'In memory',
        system: true,
      });
    }

    return items.sort((left, right) => left.date.localeCompare(right.date));
  }, [person]);

  const descendantIds = useMemo(
    () => (person ? getDescendantIds(person.id, relationships) : []),
    [person, relationships],
  );

  const ascendantIds = useMemo(
    () => (person ? getAscendantIds(person.id, relationships) : []),
    [person, relationships],
  );

  const openFamilyMemberProfile = (targetPerson: PersonRecord) => {
    if (!person || targetPerson.id === person.id) {
      return;
    }

    navigation.push('PersonProfile', {
      treeId: route.params.treeId,
      personId: targetPerson.id,
    });
  };

  useEffect(() => {
    if (selectedTreeId !== route.params.treeId || !selectedTree) {
      selectTree(route.params.treeId);
    }
  }, [route.params.treeId, selectTree, selectedTree, selectedTreeId]);

  useEffect(() => {
    if (person) {
      navigation.setOptions({ title: formatPersonName(person) });
    }
  }, [navigation, person]);

  useEffect(() => {
    setActiveTab('member-profile');
  }, [route.params.personId]);

  useEffect(() => {
    if (!loadingTrees && !selectedTree) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  }, [loadingTrees, navigation, selectedTree]);

  useEffect(() => {
    if (!loadingTreeData && selectedTree && !person && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [loadingTreeData, navigation, person, selectedTree]);

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

  const handlePersonSubmit = async (payload: PersonMutationPayload) => {
    if (!user?.id || !person) {
      return;
    }

    try {
      await updatePerson(user.id, person, payload);
      setEditorVisible(false);
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleRelationshipSubmit = async ({
    mode,
    relatedPersonId,
  }: {
    mode: PersonRelationshipMode;
    relatedPersonId: string;
  }) => {
    if (!user?.id || !selectedTree || !person) {
      return;
    }

    const currentRelationship = relationshipDialog.relationship;
    const currentMode = currentRelationship ? getRelationshipModeForPerson(person.id, currentRelationship) : null;
    const currentRelatedPersonId = !currentRelationship
      ? null
      : currentMode === 'parent-of'
        ? currentRelationship.toPersonId
        : currentMode === 'child-of'
          ? currentRelationship.fromPersonId
          : currentRelationship.fromPersonId === person.id
            ? currentRelationship.toPersonId
            : currentRelationship.fromPersonId;

    if (currentRelationship && currentMode === mode && currentRelatedPersonId === relatedPersonId) {
      setRelationshipDialog({ visible: false, relationship: null });
      return;
    }

    try {
      if (mode === 'spouse-of') {
        await addSpouseRelationship(user.id, selectedTree.id, person.id, relatedPersonId);
      } else if (mode === 'parent-of') {
        await addParentChildRelationship(user.id, selectedTree.id, person.id, relatedPersonId);
      } else {
        await addParentChildRelationship(user.id, selectedTree.id, relatedPersonId, person.id);
      }

      if (currentRelationship) {
        await removeRelationship(user.id, currentRelationship.id);
      }

      setRelationshipDialog({ visible: false, relationship: null });
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleLifeEventSubmit = async (payload: Omit<PersonLifeEvent, 'id'>) => {
    if (!user?.id || !person) {
      return;
    }

    const nextLifeEvents = lifeEventDialog.event
      ? person.lifeEvents.map((event) => (event.id === lifeEventDialog.event?.id ? { ...event, ...payload } : event))
      : [...person.lifeEvents, { id: `life-event-${Date.now()}`, ...payload }];

    try {
      await updatePerson(user.id, person, buildPersonMutationPayload(person, { lifeEvents: nextLifeEvents }));
      setLifeEventDialog({ visible: false, event: null });
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleDeleteLifeEvent = async (event: PersonLifeEvent) => {
    if (!user?.id || !person) {
      return;
    }

    await updatePerson(
      user.id,
      person,
      buildPersonMutationPayload(person, {
        lifeEvents: person.lifeEvents.filter((currentEvent) => currentEvent.id !== event.id),
      }),
    );
  };

  const handleClaimPerson = async () => {
    if (!user?.id || !selectedTree || !person) {
      return;
    }

    try {
      await assignPersonToUser(user.id, selectedTree.id, user.id, person.id);
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleUnclaimPerson = async () => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      await clearSelfAssignment(selectedTree.id, user.id);
    } catch {
      // surfaced by store snackbar
    }
  };

  const openHelperDialog = (key: HelperDialogKey) => {
    setHelperDialog({ visible: true, key });
  };

  if (!selectedTree || !person || loadingTreeData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const viewerWidth = Dimensions.get('window').width;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Surface style={[styles.heroCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.heroToolbar}>
            <Button
              mode="text"
              icon="arrow-left"
              onPress={() => navigation.navigate('TreeDetail', {
                treeId: route.params.treeId,
                initialTab: 'ProfileTab',
              })}
              contentStyle={styles.heroToolbarButtonContent}
            >
              Back to tree management
            </Button>
          </View>
          <View style={styles.heroHeader}>
            <View style={styles.heroIdentityWrap}>
              <View style={styles.heroNameRow}>
                <Text variant="headlineMedium">{formatPersonName(person)}</Text>
                {isCurrentUsersPerson ? <Chip compact icon="account">You</Chip> : null}
              </View>
              <Text variant="bodyMedium" style={[styles.heroSubtext, { color: theme.colors.onSurfaceVariant }]}>{getPersonLifeSpanLabel(person)}</Text>
            </View>
            {canEdit ? (
              <Button mode="contained-tonal" icon="pencil" onPress={() => setEditorVisible(true)}>
                Edit family member
              </Button>
            ) : null}
          </View>

          <View style={styles.metadataRow}>
            {person.gender !== 'unspecified' ? <Chip compact>{formatPersonGender(person.gender)}</Chip> : null}
            <Chip compact icon={isPersonDeceased(person) ? 'flower-outline' : 'heart-pulse'}>{getPersonPresenceLabel(person)}</Chip>
            <Chip compact icon="image-multiple">{person.photos.length} photos</Chip>
            {preferredPhoto ? <Chip compact icon="star">Preferred photo selected</Chip> : null}
            {linkedCollaborator && !isCurrentUsersPerson ? <Chip compact icon="link-variant">Linked</Chip> : null}
          </View>

          {user?.id ? (
            <View style={[styles.claimBox, { backgroundColor: theme.colors.elevation.level1 }]}> 
              {isCurrentUsersPerson ? (
                <View style={styles.claimRow}>
                  <View style={styles.claimTextWrap}>
                    <Text variant="titleSmall">This is your linked profile</Text>
                    <Text variant="bodySmall" style={[styles.claimText, { color: theme.colors.onSurfaceVariant }]}> 
                      Anywhere this family member appears in the tree, you will now see a You badge. Unlink this profile first if you want to claim someone else.
                    </Text>
                  </View>
                  <Button mode="outlined" icon="link-off" onPress={handleUnclaimPerson} disabled={mutating}>
                    Unclaim myself
                  </Button>
                </View>
              ) : linkedCollaborator ? (
                <>
                  <Text variant="titleSmall">Already linked to someone else</Text>
                  <Text variant="bodySmall" style={[styles.claimText, { color: theme.colors.onSurfaceVariant }]}> 
                    This profile is already linked to {linkedCollaborator.displayName || linkedCollaborator.email}.
                  </Text>
                </>
              ) : currentAssignedPerson ? (
                <View style={styles.claimRow}>
                  <View style={styles.claimTextWrap}>
                    <Text variant="titleSmall">You already claimed another profile</Text>
                    <Text variant="bodySmall" style={[styles.claimText, { color: theme.colors.onSurfaceVariant }]}> 
                      Unclaim yourself from {formatPersonName(currentAssignedPerson)} before claiming a different family member.
                    </Text>
                  </View>
                  <Button mode="outlined" icon="open-in-new" onPress={() => navigation.push('PersonProfile', {
                    treeId: route.params.treeId,
                    personId: currentAssignedPerson.id,
                  })} disabled={mutating}>
                    Open current family member
                  </Button>
                </View>
              ) : canClaimPerson ? (
                <View style={styles.claimRow}>
                  <View style={styles.claimTextWrap}>
                    <Text variant="titleSmall">Is this you?</Text>
                    <Text variant="bodySmall" style={[styles.claimText, { color: theme.colors.onSurfaceVariant }]}> 
                      Tap once to link your account to this family member profile.
                    </Text>
                  </View>
                  <Button mode="contained" icon="account-check" onPress={handleClaimPerson} disabled={mutating}>
                    Claim this family member as me
                  </Button>
                </View>
              ) : null}
            </View>
          ) : null}
        </Surface>

        <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.titleWithHelperRow}>
            <Text variant="titleMedium">Family member tabs</Text>
            <IconButton
              icon="information-outline"
              size={20}
              style={styles.helperIconButton}
              onPress={() => openHelperDialog('tabs')}
              accessibilityLabel="About family member tabs"
            />
          </View>
          <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>Tap a tab to switch between overview details, relationships, lineage trees, and memories.</Text>
          {PERSON_PROFILE_TAB_GROUPS.map((group, index) => (
            <SegmentedButtons
              key={`person-profile-tab-group-${group.join('-')}`}
              value={group.includes(activeTab) ? activeTab : ''}
              onValueChange={(value) => setActiveTab(value as PersonProfileTabKey)}
              buttons={group.map((key) => ({
                value: key,
                label: PERSON_PROFILE_TABS.find((tab) => tab.key === key)?.label ?? key,
              }))}
              style={index === 0 ? styles.managementSegmentedButtons : styles.managementSegmentedButtonsSecondary}
            />
          ))}
        </Surface>

        {activeTab === 'member-profile' ? (
          <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleLarge">Member profile</Text>
              <IconButton
                icon="information-outline"
                size={20}
                style={styles.helperIconButton}
                onPress={() => openHelperDialog('member-profile')}
                accessibilityLabel="About member profile"
              />
            </View>
            <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>Core details and notes for this family member.</Text>

            <View style={styles.detailGrid}>
              <Card mode="outlined" style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
                <Card.Content>
                  <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>First name</Text>
                  <Text variant="titleMedium">{person.firstName || 'Unknown'}</Text>
                </Card.Content>
              </Card>
              <Card mode="outlined" style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
                <Card.Content>
                  <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Last name</Text>
                  <Text variant="titleMedium">{person.lastName || 'Unknown'}</Text>
                </Card.Content>
              </Card>
              <Card mode="outlined" style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
                <Card.Content>
                  <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Birth date</Text>
                  <Text variant="titleMedium">{person.birthDate ? formatPersonDate(person.birthDate) : 'Unknown'}</Text>
                </Card.Content>
              </Card>
              <Card mode="outlined" style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
                <Card.Content>
                  <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Status</Text>
                  <Text variant="titleMedium">{getPersonPresenceLabel(person)}</Text>
                </Card.Content>
              </Card>
              <Card mode="outlined" style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
                <Card.Content>
                  <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Gender</Text>
                  <Text variant="titleMedium">{person.gender === 'unspecified' ? 'Unspecified' : formatPersonGender(person.gender)}</Text>
                </Card.Content>
              </Card>
              <Card mode="outlined" style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
                <Card.Content>
                  <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Photos</Text>
                  <Text variant="titleMedium">{person.photos.length}</Text>
                </Card.Content>
              </Card>
            </View>

            <View style={[styles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}> 
              <Text variant="titleSmall">Notes</Text>
              <Text variant="bodyMedium" style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}> 
                {person.notes || 'No notes added yet.'}
              </Text>
            </View>
          </Surface>
        ) : null}

        {activeTab === 'relationships' ? (
          <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderText}>
                <View style={styles.titleWithHelperRow}>
                  <Text variant="titleLarge">Relationships</Text>
                  <IconButton
                    icon="information-outline"
                    size={20}
                    style={styles.helperIconButton}
                    onPress={() => openHelperDialog('relationships')}
                    accessibilityLabel="About relationships"
                  />
                </View>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>Add, edit, or remove family connections directly from this family member.</Text>
              </View>
              {canEdit ? (
                <Button mode="contained" icon="family-tree" onPress={() => setRelationshipDialog({ visible: true, relationship: null })}>
                  Add relationship
                </Button>
              ) : null}
            </View>

            {relationshipEntries.length > 0 ? (
              <View style={styles.relationshipList}>
                {relationshipEntries.map((entry) => (
                  <Card key={entry.relationship.id} mode="outlined" style={[styles.relationshipCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
                    <Card.Content>
                      <View style={styles.relationshipRow}>
                        <View style={styles.relationshipTextWrap}>
                          <Chip compact style={styles.relationshipChip}>
                            {entry.mode === 'parent-of' ? 'Parent of' : entry.mode === 'child-of' ? 'Child of' : 'Spouse of'}
                          </Chip>
                          <Text variant="titleMedium" style={styles.relationshipTitle}>{formatPersonName(entry.relatedPerson)}</Text>
                          <Text variant="bodySmall" style={[styles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>{entry.subtitle}</Text>
                        </View>
                        {canEdit ? (
                          <View style={styles.rowActions}>
                            <IconButton
                              icon="pencil"
                              onPress={() => setRelationshipDialog({ visible: true, relationship: entry.relationship })}
                              disabled={mutating}
                            />
                            <IconButton
                              icon="delete"
                              iconColor="#C62828"
                              onPress={() => openConfirm(
                                'Remove relationship',
                                `Remove the ${entry.title.toLowerCase()} connection?`,
                                'Remove',
                                async () => {
                                  if (!user?.id) {
                                    return;
                                  }

                                  await removeRelationship(user.id, entry.relationship.id);
                                },
                              )}
                              disabled={mutating}
                            />
                          </View>
                        ) : null}
                      </View>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text variant="titleMedium">No relationships yet</Text>
                <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>Add parents, children, or spouses from this family member to grow the story around them.</Text>
              </View>
            )}

            <RelationshipInsightCard
              people={people}
              relationships={relationships}
              lockedFromPersonId={person.id}
              title="How this family member relates to others"
              subtitle={`Pick another family member to see how they connect to ${formatPersonName(person)}.`}
            />
          </Surface>
        ) : null}

        {activeTab === 'descendant-tree' ? (
          <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderText}>
                <View style={styles.titleWithHelperRow}>
                  <Text variant="titleLarge">Descendant tree</Text>
                  <IconButton
                    icon="information-outline"
                    size={20}
                    style={styles.helperIconButton}
                    onPress={() => openHelperDialog('descendant-tree')}
                    accessibilityLabel="About descendant tree"
                  />
                </View>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {descendantIds.length > 0
                    ? `Start with ${formatPersonName(person)} and follow ${descendantIds.length} ${descendantIds.length === 1 ? 'younger family member' : 'younger family members'} through children and grandchildren.`
                    : `No children or grandchildren are linked yet. Add family relationships to start ${formatPersonName(person)}’s branch.`}
                </Text>
              </View>
            </View>

            <FamilyTreeCanvas
              people={people}
              relationships={relationships}
              onPressPerson={openFamilyMemberProfile}
              currentUserPersonId={currentAssignedPerson?.id ?? undefined}
              initialFocusPersonId={person.id}
              descendantRootPersonId={person.id}
            />
          </Surface>
        ) : null}

        {activeTab === 'ascendant-tree' ? (
          <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderText}>
                <View style={styles.titleWithHelperRow}>
                  <Text variant="titleLarge">Ascendant tree</Text>
                  <IconButton
                    icon="information-outline"
                    size={20}
                    style={styles.helperIconButton}
                    onPress={() => openHelperDialog('ascendant-tree')}
                    accessibilityLabel="About ascendant tree"
                  />
                </View>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {ascendantIds.length > 0
                    ? `Look upward from ${formatPersonName(person)} to ${ascendantIds.length === 1 ? '1 older family member' : `${ascendantIds.length} older family members`} through parents and grandparents.`
                    : `No parents or grandparents are linked yet. Add family relationships to build ${formatPersonName(person)}’s earlier generations.`}
                </Text>
              </View>
            </View>

            <FamilyTreeCanvas
              people={people}
              relationships={relationships}
              onPressPerson={openFamilyMemberProfile}
              currentUserPersonId={currentAssignedPerson?.id ?? undefined}
              initialFocusPersonId={person.id}
              ascendantRootPersonId={person.id}
            />
          </Surface>
        ) : null}

        {activeTab === 'memories-gallery' ? (
          <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleLarge">Memories & gallery</Text>
              <IconButton
                icon="information-outline"
                size={20}
                style={styles.helperIconButton}
                onPress={() => openHelperDialog('memories-gallery')}
                accessibilityLabel="About memories and gallery"
              />
            </View>
            <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>Notes, life events, and photos help this family member feel like a living timeline.</Text>

            <View style={[styles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}> 
              <Text variant="titleSmall">Notes</Text>
              <Text variant="bodyMedium" style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}> 
                {person.notes || 'No notes added yet.'}
              </Text>
            </View>

            <Divider style={styles.sectionDivider} />

            <View style={styles.gallerySection}>
              <Text variant="titleSmall">Photo gallery</Text>
              <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>Tap any photo to open the full-screen viewer and scroll through the gallery.</Text>
              {person.photos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                  {person.photos.map((photo, index) => (
                    <Pressable key={photo.id} onPress={() => setViewerIndex(index)}>
                      <Card mode="outlined" style={[styles.photoCard, preferredPhoto?.id === photo.id && styles.photoCardPreferred]}>
                        <Image source={{ uri: photo.url }} style={styles.photo} />
                      </Card>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>No photos in the gallery yet.</Text>
              )}
            </View>

            <Divider style={styles.sectionDivider} />

            <View style={styles.lifeEventsSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderText}>
                  <Text variant="titleSmall">Life events</Text>
                  <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>Add milestones like married, divorced, moved, graduated, or custom family memories.</Text>
                </View>
                {canEdit ? (
                  <Button mode="contained-tonal" icon="plus" onPress={() => setLifeEventDialog({ visible: true, event: null })}>
                    Add event
                  </Button>
                ) : null}
              </View>

              {memoryTimeline.length > 0 ? (
                <View style={styles.timelineWrap}>
                  {memoryTimeline.map((item) => {
                    const editableEvent = !item.system
                      ? person.lifeEvents.find((event) => event.id === item.id) ?? null
                      : null;

                    return (
                      <Card key={item.id} mode="outlined" style={[styles.timelineCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
                        <Card.Content>
                          <View style={styles.timelineRow}>
                            <View style={styles.timelineTextWrap}>
                              <View style={styles.timelineChipRow}>
                                <Chip compact>{item.badgeLabel}</Chip>
                                <Chip compact icon="calendar">{formatPersonDate(item.date)}</Chip>
                              </View>
                              <Text variant="titleMedium" style={styles.timelineTitle}>{item.title}</Text>
                              <Text variant="bodyMedium" style={[styles.timelineDescription, { color: theme.colors.onSurfaceVariant }]}>{item.description}</Text>
                            </View>
                            {canEdit && editableEvent ? (
                              <View style={styles.rowActions}>
                                <IconButton
                                  icon="pencil"
                                  onPress={() => setLifeEventDialog({ visible: true, event: editableEvent })}
                                  disabled={mutating}
                                />
                                <IconButton
                                  icon="delete"
                                  iconColor="#C62828"
                                  onPress={() => openConfirm(
                                    'Delete life event',
                                    `Delete the “${editableEvent.title}” memory from ${formatPersonName(person)}?`,
                                    'Delete',
                                    async () => handleDeleteLifeEvent(editableEvent),
                                  )}
                                  disabled={mutating}
                                />
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
                  <Text variant="titleMedium">No memories yet</Text>
                  <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>Start with major milestones like marriage, divorce, moving house, graduation, or a treasured family story.</Text>
                </View>
              )}
            </View>
          </Surface>
        ) : null}
      </ScrollView>

      <PersonFormDialog
        visible={editorVisible}
        mode="edit"
        person={person}
        loading={mutating}
        existingLastNames={existingLastNames}
        relationshipCandidates={people.filter((candidate) => candidate.id !== person.id)}
        onDismiss={() => setEditorVisible(false)}
        onSubmit={handlePersonSubmit}
      />

      <PersonRelationshipDialog
        visible={relationshipDialog.visible}
        person={person}
        people={people}
        relationships={relationships}
        loading={mutating}
        editingRelationship={relationshipDialog.relationship}
        onDismiss={() => setRelationshipDialog({ visible: false, relationship: null })}
        onSubmit={handleRelationshipSubmit}
      />

      <LifeEventDialog
        visible={lifeEventDialog.visible}
        loading={mutating}
        event={lifeEventDialog.event}
        onDismiss={() => setLifeEventDialog({ visible: false, event: null })}
        onSubmit={handleLifeEventSubmit}
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

      <Modal
        visible={viewerIndex !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setViewerIndex(null)}
      >
        <View style={styles.viewerBackdrop}>
          <IconButton icon="close" iconColor="#FFFFFF" size={28} style={styles.viewerCloseButton} onPress={() => setViewerIndex(null)} />
          {person.photos.length > 0 ? (
            <ScrollView
              key={viewerIndex ?? 0}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: (viewerIndex ?? 0) * viewerWidth, y: 0 }}
            >
              {person.photos.map((photo) => (
                <View key={`viewer-${photo.id}`} style={[styles.viewerSlide, { width: viewerWidth }]}> 
                  <Image source={{ uri: photo.url }} style={styles.viewerImage} resizeMode="contain" />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      <Portal>
        <Dialog
          visible={helperDialog.visible}
          onDismiss={() => setHelperDialog((current) => ({ ...current, visible: false }))}
        >
          <Dialog.Title>{helperDialogCopy[helperDialog.key].title}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{helperDialogCopy[helperDialog.key].message}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setHelperDialog((current) => ({ ...current, visible: false }))}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => {
          setSnackVisible(false);
          clearError();
          clearNotice();
        }}
        duration={5000}
      >
        {error ?? notice}
      </Snackbar>
    </View>
  );
}


