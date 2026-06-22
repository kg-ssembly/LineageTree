import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, Image, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Dialog,
  IconButton,
  Portal,
  SegmentedButtons,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import {
  ConfirmDialog,
  FamilyTreeCanvas,
  HorizontalTabStrip,
  LifeEventDialog,
  PersonFormDialog,
  PersonRelationshipDialog,
  RelationshipInsightCard,
} from '../../components';
import type { PersonRelationshipMode } from '../../components/person-relationship-dialog';
import type { RootStackParamList } from '../../components/dto/navigation';
import type { PersonLifeEvent, PersonMutationPayload, PersonPhoto, PersonRecord } from '../../components/dto/person';
import {
  formatDate,
  formatPersonDate,
  getLifeEventTypeLabel,
  getPersonLifeSpanLabel,
  getPersonPresenceLabel,
  getPersonTreeMembershipIds,
  getPreferredPersonPhoto,
  isPersonDeceased,
} from '../../components/dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from '../../components/dto/relationship';
import { canEditTreeContent, getAssignedPersonId } from '../../components/dto/tree';
import { formatPersonGender, formatPersonName } from '../../components/person-formatting';
import type { ThemePreference } from '../../constants/theme';
import { GlobalStyles } from '../../constants/styles';
import { useAuthStore } from '../../stores/auth-store';
import { useThemeStore } from '../../stores/theme-store';
import { useTreeStore } from '../../stores/tree-store';

const dialogChrome = GlobalStyles.dialogChrome;
const treeDetailStyles = GlobalStyles.treeDetail;
const homeStyles = GlobalStyles.home;
const personProfileStyles = GlobalStyles.personProfile;

type UserProfileTabProps = {
  onSignOut: () => void;
  authLoading: boolean;
};

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

type ProfileTabKey = 'profile' | 'relationships' | 'memories' | 'descendants' | 'ascendants' | 'app-settings';
type MemorySectionTabKey = 'events' | 'photos' | 'notes';
type RelationshipSectionTabKey = 'insight' | 'list';

const PROFILE_TABS: Array<{ key: ProfileTabKey; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'memories', label: 'Memories' },
  { key: 'descendants', label: 'Descendants' },
  { key: 'ascendants', label: 'Ascendants' },
  { key: 'app-settings', label: 'App settings' },
];

const MEMORY_SECTION_TABS: Array<{ key: MemorySectionTabKey; label: string }> = [
  { key: 'events', label: 'Life Events' },
  { key: 'photos', label: 'Photos' },
  { key: 'notes', label: 'Notes' },
];

const RELATIONSHIP_SECTION_TABS: Array<{ key: RelationshipSectionTabKey; label: string }> = [
  { key: 'insight', label: 'How Related' },
  { key: 'list', label: 'All Links' },
];

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
    middleNames: person.middleNames ?? '',
    lastName: person.lastName,
    maidenName: person.maidenName ?? '',
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

function AppSettingsSection({ onSignOut, authLoading }: UserProfileTabProps) {
  const theme = useTheme();
  const { user, updateDisplayName } = useAuthStore();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const [editName, setEditName] = useState(user?.displayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    setEditName(user?.displayName ?? '');
  }, [user?.displayName]);

  const isDirty = editName.trim() !== (user?.displayName ?? '').trim();
  const appearanceSummary =
    preference === 'dark'
      ? 'Dark mode is enabled for a cosy, low-light workspace.'
      : 'Light mode is enabled for a bright, airy workspace.';

  const handleSaveName = async () => {
    if (!editName.trim()) {
      setNameError('Display name cannot be empty.');
      return;
    }

    setNameError(null);
    setSavingName(true);
    try {
      await updateDisplayName(editName.trim());
    } catch {
      setNameError('Failed to update name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <>
      <Surface style={[homeStyles.profileHeroCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={2}>
        <View style={homeStyles.profileAvatarRow}>
          <Avatar.Text
            size={88}
            label={user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : '??'}
            style={{ backgroundColor: theme.colors.primaryContainer }}
            color={theme.colors.onPrimaryContainer}
          />
          <View style={homeStyles.profileNameWrap}>
            <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
              Personal profile
            </Text>
            <Text variant="headlineMedium" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
              {user?.displayName ?? 'Unknown'}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
              {user?.email}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
              Member since {user?.createdAt ? formatDate(new Date(user.createdAt)) : '—'}
            </Text>
          </View>
        </View>
      </Surface>

      <Surface style={[treeDetailStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>Edit profile</Text>
        <Text variant="bodySmall" style={[treeDetailStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Change the display name shown across your family trees.
        </Text>
        <View style={homeStyles.editNameRow}>
          <TextInput
            label="Display name"
            value={editName}
            onChangeText={(value) => { setEditName(value); setNameError(null); }}
            mode="outlined"
            style={homeStyles.editNameInput}
            error={!!nameError}
            disabled={savingName}
          />
          <Button
            mode="contained"
            icon="content-save-outline"
            onPress={handleSaveName}
            disabled={savingName || !isDirty}
            style={homeStyles.saveNameButton}
          >
            Save changes
          </Button>
        </View>
        {nameError ? (
          <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>{nameError}</Text>
        ) : null}
      </Surface>

      <Surface style={[treeDetailStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>Appearance</Text>
        <Text variant="bodySmall" style={[treeDetailStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Switch the app between light and dark viewing modes.
        </Text>
        <SegmentedButtons
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
          buttons={[
            { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
            { value: 'dark', label: 'Dark', icon: 'weather-night' },
          ]}
          style={homeStyles.themeSwitch}
        />
        <View style={[homeStyles.appearanceHint, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{appearanceSummary}</Text>
        </View>
      </Surface>

      <Button
        mode="contained-tonal"
        icon="logout"
        onPress={onSignOut}
        disabled={authLoading}
        contentStyle={homeStyles.signOutButtonContent}
        style={homeStyles.signOutButton}
      >
        Log out
      </Button>
    </>
  );
}

export function UserProfileTabContent({ onSignOut, authLoading }: UserProfileTabProps) {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
    updatePerson,
    removePerson,
    addParentChildRelationship,
    addSpouseRelationship,
    editRelationship,
    removeRelationship,
    clearError,
    clearNotice,
  } = useTreeStore();

  const [activeTab, setActiveTab] = useState<ProfileTabKey>('profile');
  const [memorySectionTab, setMemorySectionTab] = useState<MemorySectionTabKey>('events');
  const [relationshipSectionTab, setRelationshipSectionTab] = useState<RelationshipSectionTabKey>('insight');
  const [editorVisible, setEditorVisible] = useState(false);
  const [relationshipDialog, setRelationshipDialog] = useState<RelationshipDialogState>({ visible: false, relationship: null });
  const [lifeEventDialog, setLifeEventDialog] = useState<LifeEventDialogState>({ visible: false, event: null });
  const [notesDialogVisible, setNotesDialogVisible] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [photosDialogVisible, setPhotosDialogVisible] = useState(false);
  const [photoEditorExistingPhotos, setPhotoEditorExistingPhotos] = useState<PersonPhoto[]>([]);
  const [photoEditorRemovedPhotos, setPhotoEditorRemovedPhotos] = useState<PersonPhoto[]>([]);
  const [photoEditorNewPhotoUris, setPhotoEditorNewPhotoUris] = useState<string[]>([]);
  const [photoEditorPreferredPhotoRef, setPhotoEditorPreferredPhotoRef] = useState('');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [snackVisible, setSnackVisible] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    action: null,
  });

  const selectedTree = useMemo(
    () => trees.find((tree) => tree.id === selectedTreeId) ?? null,
    [selectedTreeId, trees],
  );

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
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

  const canEditLinkedProfile = useMemo(
    () => Boolean(selectedTree && canEditTreeContent(selectedTree, user?.id)),
    [selectedTree, user?.id],
  );

  const shouldShowLinkedProfileTabs = Boolean(
    selectedTree
    && user?.defaultTreeId
    && selectedTree.id === user.defaultTreeId
    && currentAssignedPerson,
  );

  const linkedPerson = currentAssignedPerson;
  const preferredPhoto = getPreferredPersonPhoto(linkedPerson);
  const existingLastNames = useMemo(
    () => [...new Set(people.map((person) => person.lastName.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [people],
  );
  const photoEditorCount = useMemo(
    () => photoEditorExistingPhotos.length + photoEditorNewPhotoUris.length,
    [photoEditorExistingPhotos, photoEditorNewPhotoUris],
  );

  const relationshipEntries = useMemo(() => {
    if (!linkedPerson) {
      return [];
    }

    return relationships
      .filter((relationship) => relationship.fromPersonId === linkedPerson.id || relationship.toPersonId === linkedPerson.id)
      .map((relationship) => {
        const mode = getRelationshipModeForPerson(linkedPerson.id, relationship);
        const relatedPersonId = mode === 'parent-of'
          ? relationship.toPersonId
          : mode === 'child-of'
            ? relationship.fromPersonId
            : relationship.fromPersonId === linkedPerson.id
              ? relationship.toPersonId
              : relationship.fromPersonId;
        const relatedPerson = peopleById.get(relatedPersonId) ?? null;
        const subtitle = relationship.type === 'spouse'
          ? 'Partner connection'
          : mode === 'parent-of'
            ? 'Parent → child connection'
            : 'Child → parent connection';

        return {
          relationship,
          mode,
          relatedPerson,
          subtitle,
        };
      })
      .sort((left, right) => right.relationship.createdAt.localeCompare(left.relationship.createdAt));
  }, [linkedPerson, peopleById, relationships]);

  const memoryTimeline = useMemo(() => {
    if (!linkedPerson) {
      return [];
    }

    const items = linkedPerson.lifeEvents.map((event) => ({
      id: event.id,
      date: event.date,
      title: event.title,
      description: event.description,
      badgeLabel: getLifeEventTypeLabel(event.type),
      system: false,
    }));
    const hasManualDeathEvent = linkedPerson.lifeEvents.some((event) => event.type === 'death');

    if (linkedPerson.birthDate) {
      items.push({
        id: `birth-${linkedPerson.id}`,
        date: linkedPerson.birthDate,
        title: 'Birth',
        description: `${formatPersonName(linkedPerson)} was born.`,
        badgeLabel: 'Birth',
        system: true,
      });
    }

    if (linkedPerson.deathDate && !hasManualDeathEvent) {
      items.push({
        id: `death-${linkedPerson.id}`,
        date: linkedPerson.deathDate,
        title: 'In memory',
        description: `${formatPersonName(linkedPerson)} passed away.`,
        badgeLabel: 'In memory',
        system: true,
      });
    }

    return items.sort((left, right) => left.date.localeCompare(right.date));
  }, [linkedPerson]);

  const descendantIds = useMemo(
    () => (linkedPerson ? getDescendantIds(linkedPerson.id, relationships) : []),
    [linkedPerson, relationships],
  );

  const ascendantIds = useMemo(
    () => (linkedPerson ? getAscendantIds(linkedPerson.id, relationships) : []),
    [linkedPerson, relationships],
  );

  useEffect(() => {
    if (error || notice) {
      setSnackVisible(true);
    }
  }, [error, notice]);

  useEffect(() => {
    if (!shouldShowLinkedProfileTabs && activeTab !== 'app-settings') {
      setActiveTab('app-settings');
    }
  }, [activeTab, shouldShowLinkedProfileTabs]);

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

  const openFamilyMemberProfile = (targetPerson: PersonRecord) => {
    if (!selectedTree || !linkedPerson || targetPerson.id === linkedPerson.id) {
      return;
    }

    navigation.navigate('PersonProfile', {
      treeId: selectedTree.id,
      personId: targetPerson.id,
    });
  };

  const handlePersonSubmit = async (payload: PersonMutationPayload) => {
    if (!user?.id || !linkedPerson) {
      return;
    }

    try {
      await updatePerson(user.id, linkedPerson, payload);
      setEditorVisible(false);
    } catch {
      // surfaced by store snackbar
    }
  };

  const openNotesDialog = () => {
    if (!linkedPerson) {
      return;
    }

    setNotesDraft(linkedPerson.notes ?? '');
    setNotesDialogVisible(true);
  };

  const handleSaveNotes = async () => {
    if (!user?.id || !linkedPerson) {
      return;
    }

    try {
      await updatePerson(user.id, linkedPerson, buildPersonMutationPayload(linkedPerson, { notes: notesDraft }));
      setNotesDialogVisible(false);
    } catch {
      // surfaced by store snackbar
    }
  };

  const openPhotosDialog = () => {
    if (!linkedPerson) {
      return;
    }

    setPhotoEditorExistingPhotos(linkedPerson.photos);
    setPhotoEditorRemovedPhotos([]);
    setPhotoEditorNewPhotoUris([]);
    setPhotoEditorPreferredPhotoRef(linkedPerson.preferredPhotoId ?? '');
    setPhotosDialogVisible(true);
  };

  const addPhotoFromPickerResult = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets.length > 0) {
      setPhotoEditorNewPhotoUris((current) => [...current, result.assets[0].uri]);
    }
  };

  const handleAddPhotoFromLibrary = async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow access to your photo library to add family photos.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    addPhotoFromPickerResult(result);
  };

  const handleCapturePhoto = async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow camera access to capture family photos.');
        return;
      }
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      addPhotoFromPickerResult(result);
    } catch {
      Alert.alert('Camera unavailable', 'The camera could not be opened on this device.');
    }
  };

  const handleRemoveExistingPhoto = (photo: PersonPhoto) => {
    setPhotoEditorExistingPhotos((current) => current.filter((currentPhoto) => currentPhoto.id !== photo.id));
    setPhotoEditorRemovedPhotos((current) => [...current, photo]);
    setPhotoEditorPreferredPhotoRef((current) => (current === photo.id ? '' : current));
  };

  const handleRemoveNewPhoto = (uri: string) => {
    setPhotoEditorNewPhotoUris((current) => current.filter((item) => item !== uri));
    setPhotoEditorPreferredPhotoRef((current) => (current === uri ? '' : current));
  };

  const handleSavePhotos = async () => {
    if (!user?.id || !linkedPerson) {
      return;
    }

    try {
      await updatePerson(
        user.id,
        linkedPerson,
        buildPersonMutationPayload(linkedPerson, {
          existingPhotos: photoEditorExistingPhotos,
          removedPhotos: photoEditorRemovedPhotos,
          newPhotoUris: photoEditorNewPhotoUris,
          preferredPhotoRef: photoEditorPreferredPhotoRef,
        }),
      );
      setPhotosDialogVisible(false);
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleRelationshipSubmit = async ({
    mode,
    relatedPersonId,
    relationshipStatus,
    parentChildKind,
  }: {
    mode: PersonRelationshipMode;
    relatedPersonId: string;
    relationshipStatus?: SpouseRelationshipStatus;
    parentChildKind?: ParentChildRelationshipKind;
  }) => {
    if (!user?.id || !selectedTree || !linkedPerson) {
      return;
    }

    const currentRelationship = relationshipDialog.relationship;
    const currentMode = currentRelationship ? getRelationshipModeForPerson(linkedPerson.id, currentRelationship) : null;
    const currentRelatedPersonId = !currentRelationship
      ? null
      : currentMode === 'parent-of'
        ? currentRelationship.toPersonId
        : currentMode === 'child-of'
          ? currentRelationship.fromPersonId
          : currentRelationship.fromPersonId === linkedPerson.id
            ? currentRelationship.toPersonId
            : currentRelationship.fromPersonId;
    const currentMetadataMatches = !currentRelationship
      ? false
      : currentRelationship.type === 'spouse'
        ? currentRelationship.relationshipStatus === relationshipStatus
        : currentRelationship.parentChildKind === parentChildKind;

    if (currentRelationship && currentMode === mode && currentRelatedPersonId === relatedPersonId && currentMetadataMatches) {
      setRelationshipDialog({ visible: false, relationship: null });
      return;
    }

    try {
      if (currentRelationship && currentMode === mode && currentRelatedPersonId === relatedPersonId) {
        await editRelationship(user.id, currentRelationship, {
          relationshipStatus: mode === 'spouse-of' ? relationshipStatus : undefined,
          parentChildKind: mode === 'spouse-of' ? undefined : parentChildKind,
        });
        setRelationshipDialog({ visible: false, relationship: null });
        return;
      }

      if (currentRelationship) {
        await removeRelationship(user.id, currentRelationship.id);
      }

      if (mode === 'spouse-of') {
        await addSpouseRelationship(user.id, selectedTree.id, linkedPerson.id, relatedPersonId, relationshipStatus);
      } else if (mode === 'parent-of') {
        await addParentChildRelationship(user.id, selectedTree.id, linkedPerson.id, relatedPersonId, parentChildKind);
      } else {
        await addParentChildRelationship(user.id, selectedTree.id, relatedPersonId, linkedPerson.id, parentChildKind);
      }

      setRelationshipDialog({ visible: false, relationship: null });
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleLifeEventSubmit = async (payload: Omit<PersonLifeEvent, 'id'>) => {
    if (!user?.id || !linkedPerson) {
      return;
    }

    const nextLifeEvents = lifeEventDialog.event
      ? linkedPerson.lifeEvents.map((event) => (event.id === lifeEventDialog.event?.id ? { ...event, ...payload } : event))
      : [...linkedPerson.lifeEvents, { id: `life-event-${Date.now()}`, ...payload }];

    try {
      await updatePerson(user.id, linkedPerson, buildPersonMutationPayload(linkedPerson, { lifeEvents: nextLifeEvents }));
      setLifeEventDialog({ visible: false, event: null });
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleDeleteLifeEvent = async (event: PersonLifeEvent) => {
    if (!user?.id || !linkedPerson) {
      return;
    }

    await updatePerson(
      user.id,
      linkedPerson,
      buildPersonMutationPayload(linkedPerson, {
        lifeEvents: linkedPerson.lifeEvents.filter((currentEvent) => currentEvent.id !== event.id),
      }),
    );
  };

  const viewerWidth = Dimensions.get('window').width;
  const viewerHeight = Dimensions.get('window').height;

  if (loadingTrees || loadingTreeData) {
    return (
      <View style={[personProfileStyles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[personProfileStyles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={personProfileStyles.content}>
        {shouldShowLinkedProfileTabs ? (
          <Surface style={[personProfileStyles.heroCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            {canEditLinkedProfile ? (
              <IconButton
                icon="pencil"
                mode="contained-tonal"
                size={22}
                onPress={() => setEditorVisible(true)}
                style={[personProfileStyles.heroFloatingButton, personProfileStyles.heroFloatingButtonRight]}
                accessibilityLabel="Edit my linked family profile"
              />
            ) : null}
            <View style={personProfileStyles.heroHeader}>
              <View style={personProfileStyles.heroAvatarRow}>
                {preferredPhoto ? (
                  <Image source={{ uri: preferredPhoto.url }} style={personProfileStyles.heroAvatar} />
                ) : (
                  <View style={personProfileStyles.heroAvatarFallback}>
                    <MaterialCommunityIcons
                      name={linkedPerson && isPersonDeceased(linkedPerson) ? 'flower-outline' : 'account-heart-outline'}
                      size={38}
                      color={theme.colors.primary}
                    />
                  </View>
                )}
                <View style={personProfileStyles.heroIdentityWrap}>
                  <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                    My linked family profile
                  </Text>
                  <View style={personProfileStyles.heroNameRow}>
                    <Text variant="headlineMedium">{linkedPerson ? formatPersonName(linkedPerson) : 'Unknown'}</Text>
                    <Chip compact icon="account">You</Chip>
                  </View>
                  <Text variant="bodyMedium" style={[personProfileStyles.heroSubtext, { color: theme.colors.onSurfaceVariant }]}>
                    {linkedPerson ? getPersonLifeSpanLabel(linkedPerson) : 'Link yourself in your default tree to manage your family profile here.'}
                  </Text>
                </View>
              </View>
            </View>
          </Surface>
        ) : (
          <Surface style={[homeStyles.profileHeroCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={2}>
            <View style={homeStyles.profileAvatarRow}>
              <Avatar.Text
                size={88}
                label={user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : '??'}
                style={{ backgroundColor: theme.colors.primaryContainer }}
                color={theme.colors.onPrimaryContainer}
              />
              <View style={homeStyles.profileNameWrap}>
                <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                  Profile workspace
                </Text>
                <Text variant="headlineMedium" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
                  {user?.displayName ?? 'Unknown'}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                  {user?.email}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  Create or join a family tree, then link or claim yourself there to unlock the rest of your profile workspace.
                </Text>
              </View>
            </View>
          </Surface>
        )}

        <Surface style={[treeDetailStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
            {shouldShowLinkedProfileTabs ? 'Your profile workspace' : 'Available right now'}
          </Text>
          <HorizontalTabStrip
            items={shouldShowLinkedProfileTabs ? PROFILE_TABS : PROFILE_TABS.filter((tab) => tab.key === 'app-settings')}
            activeKey={activeTab}
            onChange={setActiveTab}
            containerStyle={[personProfileStyles.tabStripCard, { backgroundColor: theme.colors.surface }]}
            contentContainerStyle={personProfileStyles.tabStripContent}
            itemStyle={personProfileStyles.tabStripItem}
          />
        </Surface>

        {!shouldShowLinkedProfileTabs ? (
          <Surface style={[treeDetailStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>Link your family profile</Text>
            <Text variant="bodyMedium" style={[treeDetailStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              You can access more of your profile here once you have a family tree and are linked to or have claimed your person in that tree.
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Open the tree settings tab to create a tree, choose your default tree, or link yourself to an existing family member profile.
            </Text>
          </Surface>
        ) : null}

        {shouldShowLinkedProfileTabs && activeTab === 'profile' && linkedPerson ? (
          <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text variant="titleLarge">Profile</Text>
            <View style={personProfileStyles.metadataRow}>
              {linkedPerson.gender !== 'unspecified' ? <Chip compact>{formatPersonGender(linkedPerson.gender)}</Chip> : null}
              <Chip compact icon={isPersonDeceased(linkedPerson) ? 'flower-outline' : 'heart-pulse'}>{getPersonPresenceLabel(linkedPerson)}</Chip>
              <Chip compact icon="image-multiple">{linkedPerson.photos.length} photos</Chip>
              <Chip compact icon="source-branch">{getPersonTreeMembershipIds(linkedPerson).length} tree memberships</Chip>
              {preferredPhoto ? <Chip compact icon="star">Preferred photo selected</Chip> : null}
            </View>

            <View style={personProfileStyles.detailGrid}>
              <View style={[personProfileStyles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>First name</Text>
                <Text variant="titleMedium">{linkedPerson.firstName || 'Unknown'}</Text>
              </View>
              {linkedPerson.middleNames?.trim() ? (
                <View style={[personProfileStyles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                  <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Second / middle names</Text>
                  <Text variant="titleMedium">{linkedPerson.middleNames.trim()}</Text>
                </View>
              ) : null}
              <View style={[personProfileStyles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Last name</Text>
                <Text variant="titleMedium">{linkedPerson.lastName || 'Unknown'}</Text>
              </View>
              {linkedPerson.maidenName?.trim() ? (
                <View style={[personProfileStyles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                  <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Maiden name</Text>
                  <Text variant="titleMedium">{linkedPerson.maidenName.trim()}</Text>
                </View>
              ) : null}
              <View style={[personProfileStyles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Birth date</Text>
                <Text variant="titleMedium">{linkedPerson.birthDate ? formatPersonDate(linkedPerson.birthDate) : 'Unknown'}</Text>
              </View>
              <View style={[personProfileStyles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>Tree memberships</Text>
                <Text variant="titleMedium">{getPersonTreeMembershipIds(linkedPerson).join(', ') || 'Current tree only'}</Text>
              </View>
            </View>

            <View style={[personProfileStyles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="titleSmall">Notes</Text>
              <Text variant="bodyMedium" style={[personProfileStyles.notesText, { color: theme.colors.onSurfaceVariant }]}>
                {linkedPerson.notes || 'No notes added yet.'}
              </Text>
            </View>
          </Surface>
        ) : null}

        {shouldShowLinkedProfileTabs && activeTab === 'relationships' && linkedPerson ? (
          <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={personProfileStyles.sectionHeader}>
              <View style={personProfileStyles.sectionHeaderText}>
                <Text variant="titleLarge">Relationships</Text>
              </View>
              {canEditLinkedProfile ? (
                <Button mode="contained" icon="family-tree" onPress={() => setRelationshipDialog({ visible: true, relationship: null })}>
                  Add relationship
                </Button>
              ) : null}
            </View>

            <HorizontalTabStrip
              items={RELATIONSHIP_SECTION_TABS}
              activeKey={relationshipSectionTab}
              onChange={setRelationshipSectionTab}
              containerStyle={[personProfileStyles.tabStripCard, personProfileStyles.relationshipTabStripCard, { backgroundColor: theme.colors.surface }]}
              contentContainerStyle={personProfileStyles.tabStripContent}
              itemStyle={personProfileStyles.tabStripItem}
            />

            {relationshipSectionTab === 'insight' ? (
              <RelationshipInsightCard
                people={people}
                relationships={relationships}
                lockedFromPersonId={linkedPerson.id}
                title={`How ${formatPersonName(linkedPerson)} relates to others`}
                subtitle={`Pick another family member to see how they connect to ${formatPersonName(linkedPerson)}.`}
              />
            ) : relationshipEntries.length > 0 ? (
              <View style={personProfileStyles.relationshipList}>
                {relationshipEntries.map((entry) => (
                  <View key={entry.relationship.id} style={[personProfileStyles.relationshipCard, { backgroundColor: theme.colors.surface }]}>
                    <View style={personProfileStyles.relationshipRow}>
                      <View style={personProfileStyles.relationshipTextWrap}>
                        <Chip compact style={personProfileStyles.relationshipChip}>
                          {entry.mode === 'parent-of' ? 'Parent of' : entry.mode === 'child-of' ? 'Child of' : 'Spouse of'}
                        </Chip>
                        <Text variant="titleMedium" style={personProfileStyles.relationshipTitle}>{formatPersonName(entry.relatedPerson)}</Text>
                        <Text variant="bodySmall" style={[personProfileStyles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                          {entry.subtitle}
                        </Text>
                      </View>
                      {canEditLinkedProfile ? (
                        <View style={personProfileStyles.rowActions}>
                          <IconButton
                            icon="pencil"
                            onPress={() => setRelationshipDialog({ visible: true, relationship: entry.relationship })}
                            disabled={mutating}
                          />
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={personProfileStyles.emptyState}>
                <Text variant="titleMedium">No relationships yet</Text>
                <Text variant="bodyMedium" style={[personProfileStyles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                  Add parents, children, or spouses from this family member to grow the story around them.
                </Text>
              </View>
            )}
          </Surface>
        ) : null}

        {shouldShowLinkedProfileTabs && activeTab === 'memories' && linkedPerson ? (
          <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text variant="titleLarge">Memories</Text>

            <HorizontalTabStrip
              items={MEMORY_SECTION_TABS}
              activeKey={memorySectionTab}
              onChange={setMemorySectionTab}
              containerStyle={[personProfileStyles.tabStripCard, { backgroundColor: theme.colors.surface }]}
              contentContainerStyle={personProfileStyles.tabStripContent}
              itemStyle={personProfileStyles.tabStripItem}
            />

            {memorySectionTab === 'notes' ? (
              <View style={[personProfileStyles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                <View style={personProfileStyles.sectionHeader}>
                  <View style={personProfileStyles.sectionHeaderText}>
                    <Text variant="titleSmall">Notes</Text>
                  </View>
                  {canEditLinkedProfile ? (
                    <Button mode="contained-tonal" icon="pencil" onPress={openNotesDialog}>
                      {linkedPerson.notes ? 'Edit notes' : 'Add notes'}
                    </Button>
                  ) : null}
                </View>
                <Text variant="bodyMedium" style={[personProfileStyles.notesText, { color: theme.colors.onSurfaceVariant }]}>
                  {linkedPerson.notes || 'No notes added yet.'}
                </Text>
              </View>
            ) : null}

            {memorySectionTab === 'photos' ? (
              <View style={personProfileStyles.gallerySection}>
                <View style={personProfileStyles.sectionHeader}>
                  <View style={personProfileStyles.sectionHeaderText}>
                    <Text variant="titleSmall">Photo gallery ({linkedPerson.photos.length})</Text>
                  </View>
                  {canEditLinkedProfile ? (
                    <Button mode="contained-tonal" icon="image-plus" onPress={openPhotosDialog}>
                      {linkedPerson.photos.length > 0 ? 'Manage photos' : 'Add photos'}
                    </Button>
                  ) : null}
                </View>
                {linkedPerson.photos.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={personProfileStyles.galleryRow}>
                    {linkedPerson.photos.map((photo, index) => (
                      <Pressable key={photo.id} onPress={() => setViewerIndex(index)}>
                        <Card mode="elevated" style={[personProfileStyles.photoCard, preferredPhoto?.id === photo.id && personProfileStyles.photoCardPreferred]}>
                          <Image source={{ uri: photo.url }} style={personProfileStyles.photo} />
                        </Card>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={personProfileStyles.emptyState}>
                    <Text variant="titleMedium">No photos yet</Text>
                    <Text variant="bodyMedium" style={[personProfileStyles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                      Photos and scanned keepsakes will show up here.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}

            {memorySectionTab === 'events' ? (
              <View style={personProfileStyles.lifeEventsSection}>
                <View style={personProfileStyles.sectionHeader}>
                  <View style={personProfileStyles.sectionHeaderText}>
                    <Text variant="titleSmall">Life events ({memoryTimeline.length})</Text>
                  </View>
                  {canEditLinkedProfile ? (
                    <Button mode="contained-tonal" icon="plus" onPress={() => setLifeEventDialog({ visible: true, event: null })}>
                      Add event
                    </Button>
                  ) : null}
                </View>

                {memoryTimeline.length > 0 ? (
                  <View style={personProfileStyles.relationshipList}>
                    {memoryTimeline.map((item) => {
                      const editableEvent = !item.system
                        ? linkedPerson.lifeEvents.find((event) => event.id === item.id) ?? null
                        : null;
                      return (
                        <View key={item.id} style={[personProfileStyles.relationshipCard, { backgroundColor: theme.colors.surface }]}>
                          <View style={personProfileStyles.relationshipRow}>
                            <View style={personProfileStyles.relationshipTextWrap}>
                              <View style={personProfileStyles.timelineChipRow}>
                                <Chip compact>{item.badgeLabel}</Chip>
                                <Chip compact icon="calendar">{formatPersonDate(item.date)}</Chip>
                              </View>
                              <Text variant="titleMedium" style={personProfileStyles.relationshipTitle}>{item.title}</Text>
                              <Text variant="bodySmall" style={[personProfileStyles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                                {item.description}
                              </Text>
                            </View>
                            {canEditLinkedProfile && editableEvent ? (
                              <View style={personProfileStyles.rowActions}>
                                <IconButton
                                  icon="pencil"
                                  onPress={() => setLifeEventDialog({ visible: true, event: editableEvent })}
                                  disabled={mutating}
                                />
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={personProfileStyles.emptyState}>
                    <Text variant="titleMedium">No memories yet</Text>
                    <Text variant="bodyMedium" style={[personProfileStyles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                      Start with major milestones like marriage, moving house, graduation, or a treasured family story.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </Surface>
        ) : null}

        {shouldShowLinkedProfileTabs && activeTab === 'descendants' && linkedPerson ? (
          <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={personProfileStyles.sectionHeader}>
              <View style={personProfileStyles.sectionHeaderText}>
                <Text variant="titleLarge">Descendants</Text>
                {descendantIds.length > 0 ? (
                  <Text variant="bodySmall" style={[personProfileStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {descendantIds.length} {descendantIds.length === 1 ? 'descendant' : 'descendants'}
                  </Text>
                ) : null}
              </View>
            </View>
            <FamilyTreeCanvas
              people={people}
              relationships={relationships}
              onPressPerson={openFamilyMemberProfile}
              currentUserPersonId={linkedPerson.id}
              initialFocusPersonId={linkedPerson.id}
              descendantRootPersonId={linkedPerson.id}
              showMaidenFamilyInNodeTitle
            />
          </Surface>
        ) : null}

        {shouldShowLinkedProfileTabs && activeTab === 'ascendants' && linkedPerson ? (
          <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={personProfileStyles.sectionHeader}>
              <View style={personProfileStyles.sectionHeaderText}>
                <Text variant="titleLarge">Ascendants</Text>
                {ascendantIds.length > 0 ? (
                  <Text variant="bodySmall" style={[personProfileStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {ascendantIds.length} {ascendantIds.length === 1 ? 'ancestor' : 'ancestors'}
                  </Text>
                ) : null}
              </View>
            </View>
            <FamilyTreeCanvas
              people={people}
              relationships={relationships}
              onPressPerson={openFamilyMemberProfile}
              currentUserPersonId={linkedPerson.id}
              initialFocusPersonId={linkedPerson.id}
              ascendantRootPersonId={linkedPerson.id}
              showMaidenFamilyInNodeTitle
            />
          </Surface>
        ) : null}

        {activeTab === 'app-settings' ? (
          <AppSettingsSection onSignOut={onSignOut} authLoading={authLoading} />
        ) : null}
      </ScrollView>

      <PersonFormDialog
        visible={editorVisible}
        mode="edit"
        person={linkedPerson}
        loading={mutating}
        existingLastNames={existingLastNames}
        relationshipCandidates={people.filter((candidate) => candidate.id !== linkedPerson?.id)}
        onDismiss={() => setEditorVisible(false)}
        onSubmit={handlePersonSubmit}
        onDelete={canEditLinkedProfile && linkedPerson ? async () => {
          if (!user?.id) {
            return;
          }

          await removePerson(user.id, linkedPerson);
          setEditorVisible(false);
        } : undefined}
      />

      <PersonRelationshipDialog
        visible={relationshipDialog.visible}
        person={linkedPerson}
        people={people}
        relationships={relationships}
        loading={mutating}
        editingRelationship={relationshipDialog.relationship}
        onDismiss={() => setRelationshipDialog({ visible: false, relationship: null })}
        onDelete={relationshipDialog.relationship ? async () => {
          openConfirm(
            'Remove relationship',
            'Remove this family connection?',
            'Remove',
            async () => {
              if (!user?.id) {
                return;
              }

              await removeRelationship(user.id, relationshipDialog.relationship!.id);
              setRelationshipDialog({ visible: false, relationship: null });
            },
          );
        } : undefined}
        onSubmit={handleRelationshipSubmit}
      />

      <LifeEventDialog
        visible={lifeEventDialog.visible}
        loading={mutating}
        event={lifeEventDialog.event}
        onDismiss={() => setLifeEventDialog({ visible: false, event: null })}
        onDelete={lifeEventDialog.event && linkedPerson ? async () => {
          openConfirm(
            'Delete life event',
            `Delete the "${lifeEventDialog.event!.title}" memory from ${formatPersonName(linkedPerson)}?`,
            'Delete',
            async () => {
              await handleDeleteLifeEvent(lifeEventDialog.event!);
              setLifeEventDialog({ visible: false, event: null });
            },
          );
        } : undefined}
        onSubmit={handleLifeEventSubmit}
      />

      <Portal>
        <Dialog
          visible={notesDialogVisible}
          onDismiss={mutating ? undefined : () => setNotesDialogVisible(false)}
          style={[dialogChrome.dialog, personProfileStyles.memoryDialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>Notes</Dialog.Title>
          <Dialog.ScrollArea style={personProfileStyles.memoryDialogScrollArea}>
            <ScrollView contentContainerStyle={personProfileStyles.memoryDialogContent} keyboardShouldPersistTaps="handled">
              <TextInput
                mode="outlined"
                label="Family notes"
                value={notesDraft}
                onChangeText={setNotesDraft}
                multiline
                numberOfLines={6}
                style={personProfileStyles.memoryDialogInput}
                disabled={mutating}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button onPress={() => setNotesDialogVisible(false)} disabled={mutating}>Cancel</Button>
            <Button mode="contained" onPress={handleSaveNotes} disabled={mutating}>Save notes</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={photosDialogVisible}
          onDismiss={mutating ? undefined : () => setPhotosDialogVisible(false)}
          style={[dialogChrome.dialog, personProfileStyles.memoryDialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>Manage photos</Dialog.Title>
          <Dialog.ScrollArea style={personProfileStyles.memoryDialogScrollArea}>
            <ScrollView contentContainerStyle={personProfileStyles.memoryDialogContent} keyboardShouldPersistTaps="handled">
              <View style={personProfileStyles.memoryDialogPhotoActions}>
                <Button mode="outlined" icon="image-plus" onPress={handleAddPhotoFromLibrary} disabled={mutating}>
                  Library
                </Button>
                <Button mode="outlined" icon="camera" onPress={handleCapturePhoto} disabled={mutating}>
                  Camera
                </Button>
              </View>
              <Text variant="bodySmall" style={personProfileStyles.memoryDialogHint}>
                Add photos from the library or camera, then tap the star on one image to make it the main profile photo.
              </Text>

              {photoEditorCount > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={personProfileStyles.memoryDialogPhotoList}>
                  {photoEditorExistingPhotos.map((photo) => (
                    <View key={photo.id} style={personProfileStyles.memoryDialogPhotoCard}>
                      <Image source={{ uri: photo.url }} style={personProfileStyles.memoryDialogPhoto} />
                      <IconButton
                        icon={photoEditorPreferredPhotoRef === photo.id ? 'star' : 'star-outline'}
                        size={18}
                        style={[personProfileStyles.memoryDialogPhotoButton, personProfileStyles.memoryDialogPhotoPrimaryButton]}
                        onPress={() => setPhotoEditorPreferredPhotoRef((current) => current === photo.id ? '' : photo.id)}
                        disabled={mutating}
                      />
                      <IconButton
                        icon="close"
                        size={16}
                        style={[personProfileStyles.memoryDialogPhotoButton, personProfileStyles.memoryDialogPhotoRemoveButton]}
                        onPress={() => handleRemoveExistingPhoto(photo)}
                        disabled={mutating}
                      />
                    </View>
                  ))}
                  {photoEditorNewPhotoUris.map((uri) => (
                    <View key={uri} style={personProfileStyles.memoryDialogPhotoCard}>
                      <Image source={{ uri }} style={personProfileStyles.memoryDialogPhoto} />
                      <IconButton
                        icon={photoEditorPreferredPhotoRef === uri ? 'star' : 'star-outline'}
                        size={18}
                        style={[personProfileStyles.memoryDialogPhotoButton, personProfileStyles.memoryDialogPhotoPrimaryButton]}
                        onPress={() => setPhotoEditorPreferredPhotoRef((current) => current === uri ? '' : uri)}
                        disabled={mutating}
                      />
                      <IconButton
                        icon="close"
                        size={16}
                        style={[personProfileStyles.memoryDialogPhotoButton, personProfileStyles.memoryDialogPhotoRemoveButton]}
                        onPress={() => handleRemoveNewPhoto(uri)}
                        disabled={mutating}
                      />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text variant="bodySmall" style={personProfileStyles.memoryDialogHint}>
                  No photos added yet.
                </Text>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button onPress={() => setPhotosDialogVisible(false)} disabled={mutating}>Cancel</Button>
            <Button mode="contained" onPress={handleSavePhotos} disabled={mutating}>Save photos</Button>
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

      <Modal
        visible={viewerIndex !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setViewerIndex(null)}
      >
        <View style={personProfileStyles.viewerBackdrop}>
          <IconButton icon="close" iconColor="#FFFFFF" size={28} style={personProfileStyles.viewerCloseButton} onPress={() => setViewerIndex(null)} />
          {linkedPerson && linkedPerson.photos.length > 1 && viewerIndex !== null ? (
            <>
              <IconButton
                icon="chevron-left"
                iconColor="#FFFFFF"
                size={32}
                style={[personProfileStyles.viewerNavButton, personProfileStyles.viewerNavButtonLeft]}
                onPress={() => setViewerIndex((current) => current === null ? current : Math.max(0, current - 1))}
              />
              <IconButton
                icon="chevron-right"
                iconColor="#FFFFFF"
                size={32}
                style={[personProfileStyles.viewerNavButton, personProfileStyles.viewerNavButtonRight]}
                onPress={() => setViewerIndex((current) => current === null ? current : Math.min(linkedPerson.photos.length - 1, current + 1))}
              />
            </>
          ) : null}
          {linkedPerson && linkedPerson.photos.length > 0 ? (
            <ScrollView
              key={viewerIndex ?? 0}
              style={{ flex: 1 }}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: (viewerIndex ?? 0) * viewerWidth, y: 0 }}
            >
              {linkedPerson.photos.map((photo) => (
                <View key={`viewer-${photo.id}`} style={[personProfileStyles.viewerSlide, { width: viewerWidth, height: viewerHeight }]}>
                  <Image source={{ uri: photo.url }} style={personProfileStyles.viewerImage} resizeMode="contain" />
                </View>
              ))}
            </ScrollView>
          ) : null}
          {linkedPerson && linkedPerson.photos.length > 1 && viewerIndex !== null ? (
            <View style={personProfileStyles.viewerCounter}>
              <Text variant="labelLarge" style={{ color: '#FFFFFF' }}>
                {viewerIndex + 1} / {linkedPerson.photos.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>

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
