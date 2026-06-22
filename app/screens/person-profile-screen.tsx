import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, Image, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  BottomNavigation,
  Button,
  Card,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { ConfirmDialog, FamilyTreeCanvas, HorizontalTabStrip, LifeEventDialog, PersonFormDialog, PersonRelationshipDialog, RelationshipInsightCard } from '../../components';
import type { PersonRelationshipMode } from '../../components/person-relationship-dialog';
import { useAuthStore } from '../../stores/auth-store';
import { useTreeStore } from '../../stores/tree-store';
import type { PersonLifeEvent, PersonMutationPayload, PersonPhoto, PersonRecord } from '../../components/dto/person';
import {
  formatPersonDate,
  getLifeEventTypeLabel,
  getPersonLifeSpanLabel,
  getPersonPresenceLabel,
  getPersonTreeMembershipIds,
  getPreferredPersonPhoto,
  isPersonDeceased,
} from '../../components/dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from '../../components/dto/relationship';
import type { RootStackParamList } from '../../components/dto/navigation';
import { canEditTreeContent, getAssignedPersonId, getAssignedUserIdForPerson } from '../../components/dto/tree';
import { formatPersonGender, formatPersonName } from '../../components/person-formatting';
import { GlobalStyles } from '../../constants/styles';
import { useI18n } from '../../hooks/use-i18n';
const dialogChrome = GlobalStyles.dialogChrome;

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
type RelationshipSectionTabKey = 'insight' | 'list';
type MemorySectionTabKey = 'notes' | 'photos' | 'events';

const RELATIONSHIP_SECTION_TABS: Array<{ key: RelationshipSectionTabKey; label: string }> = [
  { key: 'insight', label: 'How Related' },
  { key: 'list', label: 'All Links' },
];

const MEMORY_SECTION_TABS: Array<{ key: MemorySectionTabKey; label: string }> = [
  { key: 'events', label: 'Life Events' },
  { key: 'photos', label: 'Photos' },
  { key: 'notes', label: 'Notes' },
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


const helperDialogCopy: Record<HelperDialogKey, { title: string; message: string }> = {
  tabs: {
    title: 'Family member sections',
    message: 'Profile shows core identity details and notes. Relationships lets you add and review parent, child, and spouse connections. Descendant tree follows children downward through generations. Ascendant tree follows parents upward. Memories & gallery holds chronological life events, notes, and a photo gallery.',
  },
  'member-profile': {
    title: 'Member profile',
    message: 'Displays the first name, last name, birth date, gender, presence status, and photo count for this family member. Personal notes are shown at the bottom of this section. Use the floating pencil button to update these details.',
  },
  relationships: {
    title: 'Relationships',
    message: 'Add new parent, child, or spouse connections with the button above. Open a relationship in edit mode to change or delete it. The Relationship insight tool lets you search for the path between any two family members in the tree.',
  },
  'descendant-tree': {
    title: 'Descendant tree',
    message: 'The canvas starts at this family member and draws children, grandchildren, and every subsequent generation downward. Tap any node to open that person\'s full profile. Pinch or use the zoom buttons to navigate a large tree.',
  },
  'ascendant-tree': {
    title: 'Ascendant tree',
    message: 'The canvas starts at this family member and draws parents, grandparents, and every prior generation upward. Tap any node to open that person\'s full profile. Pinch or use the zoom buttons to navigate a large tree.',
  },
  'memories-gallery': {
    title: 'Memories & gallery',
    message: 'Notes capture free-form details about this family member. The photo gallery shows all uploaded images — tap any photo to open the full-screen viewer and swipe through. Life events form a date-ordered timeline of milestones such as marriage, graduation, a move, retirement, or any custom family memory. Open an event in edit mode to update or delete it.',
  },
};

const styles = GlobalStyles.personProfile;

const TAB_ROUTES: Array<{ key: PersonProfileTabKey; title: string; focusedIcon: string; unfocusedIcon: string }> = [
  { key: 'member-profile', title: 'Profile', focusedIcon: 'account', unfocusedIcon: 'account-outline' },
  { key: 'relationships', title: 'Relationships', focusedIcon: 'family-tree', unfocusedIcon: 'family-tree' },
  { key: 'descendant-tree', title: 'Descendants', focusedIcon: 'arrow-down-thick', unfocusedIcon: 'arrow-down-thick' },
  { key: 'ascendant-tree', title: 'Ancestors', focusedIcon: 'arrow-up-thick', unfocusedIcon: 'arrow-up-thick' },
  { key: 'memories-gallery', title: 'Memories', focusedIcon: 'image-multiple', unfocusedIcon: 'image-multiple-outline' },
];

export default function PersonProfileScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
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
    removePerson,
    addParentChildRelationship,
    addSpouseRelationship,
    editRelationship,
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
  const [relationshipPage, setRelationshipPage] = useState(1);
  const [relationshipSectionTab, setRelationshipSectionTab] = useState<RelationshipSectionTabKey>('insight');
  const [memorySectionTab, setMemorySectionTab] = useState<MemorySectionTabKey>('events');
  const [notesDialogVisible, setNotesDialogVisible] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [photosDialogVisible, setPhotosDialogVisible] = useState(false);
  const [photoEditorExistingPhotos, setPhotoEditorExistingPhotos] = useState<PersonPhoto[]>([]);
  const [photoEditorRemovedPhotos, setPhotoEditorRemovedPhotos] = useState<PersonPhoto[]>([]);
  const [photoEditorNewPhotoUris, setPhotoEditorNewPhotoUris] = useState<string[]>([]);
  const [photoEditorPreferredPhotoRef, setPhotoEditorPreferredPhotoRef] = useState('');
  const relationshipPageSize = 3;

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
  const photoEditorCount = useMemo(
    () => photoEditorExistingPhotos.length + photoEditorNewPhotoUris.length,
    [photoEditorExistingPhotos, photoEditorNewPhotoUris],
  );

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
  const showClaimBox = Boolean(user?.id && (isCurrentUsersPerson || linkedCollaborator || canClaimPerson));

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

  const totalRelationshipPages = Math.ceil(relationshipEntries.length / relationshipPageSize);
  const paginatedRelationships = useMemo(() => {
    const start = (relationshipPage - 1) * relationshipPageSize;
    return relationshipEntries.slice(start, start + relationshipPageSize);
  }, [relationshipEntries, relationshipPage]);

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
    setRelationshipPage(1);
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

  const openNotesDialog = () => {
    if (!person) {
      return;
    }

    setNotesDraft(person.notes ?? '');
    setNotesDialogVisible(true);
  };

  const handleSaveNotes = async () => {
    if (!user?.id || !person) {
      return;
    }

    try {
      await updatePerson(user.id, person, buildPersonMutationPayload(person, { notes: notesDraft }));
      setNotesDialogVisible(false);
    } catch {
      // surfaced by store snackbar
    }
  };

  const openPhotosDialog = () => {
    if (!person) {
      return;
    }

    setPhotoEditorExistingPhotos(person.photos);
    setPhotoEditorRemovedPhotos([]);
    setPhotoEditorNewPhotoUris([]);
    setPhotoEditorPreferredPhotoRef(person.preferredPhotoId ?? '');
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
    if (!user?.id || !person) {
      return;
    }

    try {
      await updatePerson(
        user.id,
        person,
        buildPersonMutationPayload(person, {
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
        await addSpouseRelationship(user.id, selectedTree.id, person.id, relatedPersonId, relationshipStatus);
      } else if (mode === 'parent-of') {
        await addParentChildRelationship(user.id, selectedTree.id, person.id, relatedPersonId, parentChildKind);
      } else {
        await addParentChildRelationship(user.id, selectedTree.id, relatedPersonId, person.id, parentChildKind);
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

  // ─── Back button ──────────────────────────────────────────────────────────────
  // Navigate back to the main tab screen (PersonProfile is a stack screen on top of Main).
  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  if (!selectedTree || !person || loadingTreeData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const viewerWidth = Dimensions.get('window').width;
  const viewerHeight = Dimensions.get('window').height;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Surface style={[styles.heroCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <IconButton
            icon="home-outline"
            mode="contained-tonal"
            size={22}
            onPress={handleGoBack}
            style={[styles.heroFloatingButton, styles.heroFloatingButtonLeft]}
            accessibilityLabel={t('Go back')}
          />
          {canEdit ? (
            <IconButton
              icon="pencil"
              mode="contained-tonal"
              size={22}
                onPress={() => setEditorVisible(true)}
                style={[styles.heroFloatingButton, styles.heroFloatingButtonRight]}
                accessibilityLabel={t('Edit family member')}
              />
          ) : null}
          <View style={styles.heroHeader}>
            <View style={styles.heroAvatarRow}>
              {preferredPhoto ? (
                <Image source={{ uri: preferredPhoto.url }} style={styles.heroAvatar} />
              ) : (
                <View style={styles.heroAvatarFallback}>
                  <MaterialCommunityIcons
                    name={isPersonDeceased(person) ? 'flower-outline' : 'account-heart-outline'}
                    size={38}
                    color={theme.colors.primary}
                  />
                </View>
              )}
              <View style={styles.heroIdentityWrap}>
                <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                  {t('Family profile')}
                </Text>
                <View style={styles.heroNameRow}>
                  <Text variant="headlineMedium">{formatPersonName(person)}</Text>
                  {isCurrentUsersPerson ? <Chip compact icon="account">{t('You')}</Chip> : null}
                </View>
                <Text variant="bodyMedium" style={[styles.heroSubtext, { color: theme.colors.onSurfaceVariant }]}>
                  {getPersonLifeSpanLabel(person)}
                </Text>
              </View>
            </View>
          </View>

          {showClaimBox ? (
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
                    {t('Unclaim myself')}
                  </Button>
                </View>
              ) : linkedCollaborator ? (
                <>
                  <Text variant="titleSmall">Already linked to someone else</Text>
                  <Text variant="bodySmall" style={[styles.claimText, { color: theme.colors.onSurfaceVariant }]}>
                    This profile is already linked to {linkedCollaborator.displayName || linkedCollaborator.email}.
                  </Text>
                </>
              ) : canClaimPerson ? (
                <View style={styles.claimRow}>
                  <View style={styles.claimTextWrap}>
                    <Text variant="titleSmall">Is this you?</Text>
                    <Text variant="bodySmall" style={[styles.claimText, { color: theme.colors.onSurfaceVariant }]}>
                      Tap once to link your account to this family member profile.
                    </Text>
                  </View>
                  <Button mode="contained" icon="account-check" onPress={handleClaimPerson} disabled={mutating}>
                    {t('Claim this family member as me')}
                  </Button>
                </View>
              ) : null}
            </View>
          ) : null}
        </Surface>


        {activeTab === 'member-profile' ? (
          <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleLarge">{t('Member profile')}</Text>
              <IconButton
                icon="information-outline"
                size={20}
                style={styles.helperIconButton}
                onPress={() => openHelperDialog('member-profile')}
                accessibilityLabel="About member profile"
              />
            </View>

            <View style={styles.metadataRow}>
              {person.gender !== 'unspecified' ? <Chip compact>{formatPersonGender(person.gender)}</Chip> : null}
              <Chip compact icon={isPersonDeceased(person) ? 'flower-outline' : 'heart-pulse'}>{getPersonPresenceLabel(person)}</Chip>
              <Chip compact icon="image-multiple">{person.photos.length} photos</Chip>
              <Chip compact icon="source-branch">{getPersonTreeMembershipIds(person).length} tree memberships</Chip>
              {preferredPhoto ? <Chip compact icon="star">{t('Preferred photo selected')}</Chip> : null}
              {linkedCollaborator && !isCurrentUsersPerson ? <Chip compact icon="link-variant">{t('Linked')}</Chip> : null}
              {person.canonicalPersonId?.trim() ? <Chip compact icon="merge">{t('Merged canonical profile')}</Chip> : null}
            </View>

            <View style={styles.detailGrid}>
              <View style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('First name')}</Text>
                <Text variant="titleMedium">{person.firstName || t('Unknown')}</Text>
              </View>
              {person.middleNames?.trim() ? (
                <View style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                  <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('Second / middle names')}</Text>
                  <Text variant="titleMedium">{person.middleNames.trim()}</Text>
                </View>
              ) : null}
              <View style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('Last name')}</Text>
                <Text variant="titleMedium">{person.lastName || t('Unknown')}</Text>
              </View>
              {person.maidenName?.trim() ? (
                <View style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                  <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('Maiden name')}</Text>
                  <Text variant="titleMedium">{person.maidenName.trim()}</Text>
                </View>
              ) : null}
              <View style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('Birth date')}</Text>
                <Text variant="titleMedium">{person.birthDate ? formatPersonDate(person.birthDate) : t('Unknown')}</Text>
              </View>
              <View style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
                <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('Tree memberships')}</Text>
                <Text variant="titleMedium">{getPersonTreeMembershipIds(person).join(', ') || t('Current tree only')}</Text>
              </View>
            </View>

            <View style={[styles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="titleSmall">{t('Notes')}</Text>
              <Text variant="bodyMedium" style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}>
                {person.notes || t('No notes added yet.')}
              </Text>
            </View>
          </Surface>
        ) : null}

        {activeTab === 'relationships' ? (
          <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderText}>
                <View style={styles.titleWithHelperRow}>
                  <Text variant="titleLarge">{t('Relationships')}</Text>
                  <IconButton
                    icon="information-outline"
                    size={20}
                    style={styles.helperIconButton}
                    onPress={() => openHelperDialog('relationships')}
                    accessibilityLabel="About relationships"
                  />
                </View>
              </View>
              {canEdit ? (
                <Button mode="contained" icon="family-tree" onPress={() => setRelationshipDialog({ visible: true, relationship: null })}>
                  {t('Add relationship')}
                </Button>
              ) : null}
            </View>

            <HorizontalTabStrip
              items={RELATIONSHIP_SECTION_TABS}
              activeKey={relationshipSectionTab}
              onChange={setRelationshipSectionTab}
              containerStyle={[styles.tabStripCard, styles.relationshipTabStripCard, { backgroundColor: theme.colors.surface }]}
              contentContainerStyle={styles.tabStripContent}
              itemStyle={styles.tabStripItem}
            />

            {relationshipSectionTab === 'insight' ? (
              <RelationshipInsightCard
                people={people}
                relationships={relationships}
                lockedFromPersonId={person.id}
                title={`How does ${formatPersonName(person)} relate to...`}
              />
            ) : relationshipEntries.length > 0 ? (
              <>
                <View style={styles.relationshipList}>
                  {paginatedRelationships.map((entry) => (
                    <View key={entry.relationship.id} style={[styles.relationshipCard, { backgroundColor: theme.colors.surface }]}>
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
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>

                {totalRelationshipPages > 1 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <IconButton
                      icon="chevron-left"
                      onPress={() => setRelationshipPage((p) => Math.max(1, p - 1))}
                      disabled={relationshipPage === 1}
                    />
                    <Text variant="bodyMedium">{relationshipPage} / {totalRelationshipPages}</Text>
                    <IconButton
                      icon="chevron-right"
                      onPress={() => setRelationshipPage((p) => Math.min(totalRelationshipPages, p + 1))}
                      disabled={relationshipPage === totalRelationshipPages}
                    />
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text variant="titleMedium">{t('No relationships yet')}</Text>
                <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>Add parents, children, or spouses from this family member to grow the story around them.</Text>
              </View>
            )}
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
                {descendantIds.length > 0 ? (
                  <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {descendantIds.length} {descendantIds.length === 1 ? 'descendant' : 'descendants'}
                  </Text>
                ) : null}
              </View>
            </View>
            <FamilyTreeCanvas
              people={people}
              relationships={relationships}
              onPressPerson={openFamilyMemberProfile}
              currentUserPersonId={currentAssignedPerson?.id ?? undefined}
              initialFocusPersonId={person.id}
              descendantRootPersonId={person.id}
              showMaidenFamilyInNodeTitle
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
                {ascendantIds.length > 0 ? (
                  <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {ascendantIds.length} {ascendantIds.length === 1 ? 'ancestor' : 'ancestors'}
                  </Text>
                ) : null}
              </View>
            </View>
            <FamilyTreeCanvas
              people={people}
              relationships={relationships}
              onPressPerson={openFamilyMemberProfile}
              currentUserPersonId={currentAssignedPerson?.id ?? undefined}
              initialFocusPersonId={person.id}
              ascendantRootPersonId={person.id}
              showMaidenFamilyInNodeTitle
            />
          </Surface>
        ) : null}

        {activeTab === 'memories-gallery' ? (
          <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <View style={styles.titleWithHelperRow}>
                  <Text variant="titleLarge">{t('Memories & gallery')}</Text>
              <IconButton
                icon="information-outline"
                size={20}
                style={styles.helperIconButton}
                onPress={() => openHelperDialog('memories-gallery')}
                accessibilityLabel="About memories and gallery"
              />
            </View>

            <HorizontalTabStrip
              items={MEMORY_SECTION_TABS}
              activeKey={memorySectionTab}
              onChange={setMemorySectionTab}
              containerStyle={[styles.tabStripCard, { backgroundColor: theme.colors.surface }]}
              contentContainerStyle={styles.tabStripContent}
              itemStyle={styles.tabStripItem}
            />

            {memorySectionTab === 'notes' ? (
              <View style={[styles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderText}>
                    <Text variant="titleSmall">{t('Notes')}</Text>
                  </View>
                  {canEdit ? (
                    <Button mode="contained-tonal" icon="pencil" onPress={openNotesDialog}>
                      {person.notes ? t('Edit notes') : t('Add notes')}
                    </Button>
                  ) : null}
                </View>
                <Text variant="bodyMedium" style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}>
                  {person.notes || t('No notes added yet.')}
                </Text>
              </View>
            ) : null}

            {memorySectionTab === 'photos' ? (
              <View style={styles.gallerySection}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderText}>
                    <Text variant="titleSmall">{t('Photo gallery ({count})', { count: person.photos.length })}</Text>
                  </View>
                  {canEdit ? (
                    <Button mode="contained-tonal" icon="image-plus" onPress={openPhotosDialog}>
                      {person.photos.length > 0 ? t('Manage photos') : t('Add photos')}
                    </Button>
                  ) : null}
                </View>
                {person.photos.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                    {person.photos.map((photo, index) => (
                      <Pressable key={photo.id} onPress={() => setViewerIndex(index)}>
                        <Card mode="elevated" style={[styles.photoCard, preferredPhoto?.id === photo.id && styles.photoCardPreferred]}>
                          <Image source={{ uri: photo.url }} style={styles.photo} />
                        </Card>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.emptyState}>
                    <Text variant="titleMedium">{t('No photos yet')}</Text>
                    <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>Photos and scanned keepsakes will show up here.</Text>
                  </View>
                )}
              </View>
            ) : null}

            {memorySectionTab === 'events' ? (
              <View style={styles.lifeEventsSection}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderText}>
                    <Text variant="titleSmall">{t('Life events ({count})', { count: memoryTimeline.length })}</Text>
                  </View>
                  {canEdit ? (
                    <Button mode="contained-tonal" icon="plus" onPress={() => setLifeEventDialog({ visible: true, event: null })}>
                      {t('Add event')}
                    </Button>
                  ) : null}
                </View>

                {memoryTimeline.length > 0 ? (
                  <View style={styles.relationshipList}>
                    {memoryTimeline.map((item) => {
                      const editableEvent = !item.system
                        ? person.lifeEvents.find((event) => event.id === item.id) ?? null
                        : null;
                      return (
                        <View key={item.id} style={[styles.relationshipCard, { backgroundColor: theme.colors.surface }]}>
                          <View style={styles.relationshipRow}>
                            <View style={styles.relationshipTextWrap}>
                              <View style={styles.timelineChipRow}>
                                <Chip compact>{item.badgeLabel}</Chip>
                                <Chip compact icon="calendar">{formatPersonDate(item.date)}</Chip>
                              </View>
                              <Text variant="titleMedium" style={styles.relationshipTitle}>{item.title}</Text>
                              <Text variant="bodySmall" style={[styles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>{item.description}</Text>
                            </View>
                            {canEdit && editableEvent ? (
                              <View style={styles.rowActions}>
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
                  <View style={styles.emptyState}>
                    <Text variant="titleMedium">{t('No memories yet')}</Text>
                    <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>Start with major milestones like marriage, divorce, moving house, graduation, or a treasured family story.</Text>
                  </View>
                )}
              </View>
            ) : null}
          </Surface>
        ) : null}
      </ScrollView>

      <BottomNavigation.Bar
        navigationState={{
          index: TAB_ROUTES.findIndex((r) => r.key === activeTab),
          routes: TAB_ROUTES,
        }}
        onTabPress={({ route }) => setActiveTab(route.key as PersonProfileTabKey)}
        labeled={false}
        style={{
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.outlineVariant,
          height: 76,
          paddingTop: 8,
        }}
        activeColor={theme.colors.primary}
        inactiveColor={theme.colors.onSurfaceVariant}
      />

      <PersonFormDialog
        visible={editorVisible}
        mode="edit"
        person={person}
        loading={mutating}
        existingLastNames={existingLastNames}
        relationshipCandidates={people.filter((candidate) => candidate.id !== person.id)}
        onDismiss={() => setEditorVisible(false)}
        onSubmit={handlePersonSubmit}
        onDelete={canEdit ? async () => {
          if (!user?.id) return;
          await removePerson(user.id, person);
          setEditorVisible(false);
          if (navigation.canGoBack()) navigation.goBack();
        } : undefined}
      />

      <PersonRelationshipDialog
        visible={relationshipDialog.visible}
        person={person}
        people={people}
        relationships={relationships}
        loading={mutating}
        editingRelationship={relationshipDialog.relationship}
        onDismiss={() => setRelationshipDialog({ visible: false, relationship: null })}
        onDelete={relationshipDialog.relationship ? async () => {
          openConfirm(
            t('Remove relationship'),
            t('Remove this family connection?'),
            t('Remove'),
            async () => {
              if (!user?.id) return;
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
        onDelete={lifeEventDialog.event ? async () => {
          openConfirm(
            t('Delete life event'),
            t('Delete the "{title}" memory from {name}?', { title: lifeEventDialog.event!.title, name: formatPersonName(person) }),
            t('Delete'),
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
          style={[dialogChrome.dialog, styles.memoryDialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>{t('Notes')}</Dialog.Title>
          <Dialog.ScrollArea style={styles.memoryDialogScrollArea}>
            <ScrollView contentContainerStyle={styles.memoryDialogContent} keyboardShouldPersistTaps="handled">
              <TextInput
                mode="outlined"
                label={t('Family notes')}
                value={notesDraft}
                onChangeText={setNotesDraft}
                multiline
                numberOfLines={6}
                style={styles.memoryDialogInput}
                disabled={mutating}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button onPress={() => setNotesDialogVisible(false)} disabled={mutating}>{t('Cancel')}</Button>
            <Button mode="contained" onPress={handleSaveNotes} disabled={mutating}>{t('Save notes')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={photosDialogVisible}
          onDismiss={mutating ? undefined : () => setPhotosDialogVisible(false)}
          style={[dialogChrome.dialog, styles.memoryDialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>{t('Manage photos')}</Dialog.Title>
          <Dialog.ScrollArea style={styles.memoryDialogScrollArea}>
            <ScrollView contentContainerStyle={styles.memoryDialogContent} keyboardShouldPersistTaps="handled">
              <View style={styles.memoryDialogPhotoActions}>
                <Button mode="outlined" icon="image-plus" onPress={handleAddPhotoFromLibrary} disabled={mutating}>
                  Library
                </Button>
                <Button mode="outlined" icon="camera" onPress={handleCapturePhoto} disabled={mutating}>
                  Camera
                </Button>
              </View>
              <Text variant="bodySmall" style={styles.memoryDialogHint}>
                Add photos from the library or camera, then tap the star on one image to make it the main profile photo.
              </Text>

              {photoEditorCount > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memoryDialogPhotoList}>
                  {photoEditorExistingPhotos.map((photo) => (
                    <View key={photo.id} style={styles.memoryDialogPhotoCard}>
                      <Image source={{ uri: photo.url }} style={styles.memoryDialogPhoto} />
                      <IconButton
                        icon={photoEditorPreferredPhotoRef === photo.id ? 'star' : 'star-outline'}
                        size={18}
                        style={[styles.memoryDialogPhotoButton, styles.memoryDialogPhotoPrimaryButton]}
                        onPress={() => setPhotoEditorPreferredPhotoRef((current) => current === photo.id ? '' : photo.id)}
                        disabled={mutating}
                      />
                      <IconButton
                        icon="close"
                        size={16}
                        style={[styles.memoryDialogPhotoButton, styles.memoryDialogPhotoRemoveButton]}
                        onPress={() => handleRemoveExistingPhoto(photo)}
                        disabled={mutating}
                      />
                    </View>
                  ))}
                  {photoEditorNewPhotoUris.map((uri) => (
                    <View key={uri} style={styles.memoryDialogPhotoCard}>
                      <Image source={{ uri }} style={styles.memoryDialogPhoto} />
                      <IconButton
                        icon={photoEditorPreferredPhotoRef === uri ? 'star' : 'star-outline'}
                        size={18}
                        style={[styles.memoryDialogPhotoButton, styles.memoryDialogPhotoPrimaryButton]}
                        onPress={() => setPhotoEditorPreferredPhotoRef((current) => current === uri ? '' : uri)}
                        disabled={mutating}
                      />
                      <IconButton
                        icon="close"
                        size={16}
                        style={[styles.memoryDialogPhotoButton, styles.memoryDialogPhotoRemoveButton]}
                        onPress={() => handleRemoveNewPhoto(uri)}
                        disabled={mutating}
                      />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text variant="bodySmall" style={styles.memoryDialogHint}>
                  No photos added yet.
                </Text>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button onPress={() => setPhotosDialogVisible(false)} disabled={mutating}>{t('Cancel')}</Button>
            <Button mode="contained" onPress={handleSavePhotos} disabled={mutating}>{t('Save photos')}</Button>
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
        <View style={styles.viewerBackdrop}>
          <IconButton icon="close" iconColor="#FFFFFF" size={28} style={styles.viewerCloseButton} onPress={() => setViewerIndex(null)} />
          {person.photos.length > 1 && viewerIndex !== null ? (
            <>
              <IconButton
                icon="chevron-left"
                iconColor="#FFFFFF"
                size={32}
                style={[styles.viewerNavButton, styles.viewerNavButtonLeft]}
                onPress={() => setViewerIndex((current) => current === null ? current : Math.max(0, current - 1))}
              />
              <IconButton
                icon="chevron-right"
                iconColor="#FFFFFF"
                size={32}
                style={[styles.viewerNavButton, styles.viewerNavButtonRight]}
                onPress={() => setViewerIndex((current) => current === null ? current : Math.min(person.photos.length - 1, current + 1))}
              />
            </>
          ) : null}
          {person.photos.length > 0 ? (
            <ScrollView
              key={viewerIndex ?? 0}
              style={{ flex: 1 }}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{ x: (viewerIndex ?? 0) * viewerWidth, y: 0 }}
            >
              {person.photos.map((photo) => (
                <View key={`viewer-${photo.id}`} style={[styles.viewerSlide, { width: viewerWidth, height: viewerHeight }]}>
                  <Image source={{ uri: photo.url }} style={styles.viewerImage} resizeMode="contain" />
                </View>
              ))}
            </ScrollView>
          ) : null}
          {person.photos.length > 1 && viewerIndex !== null ? (
            <View style={styles.viewerCounter}>
              <Text variant="labelLarge" style={{ color: '#FFFFFF' }}>
                {viewerIndex + 1} / {person.photos.length}
              </Text>
            </View>
          ) : null}
        </View>
      </Modal>

      <Portal>
        <Dialog
          visible={helperDialog.visible}
          onDismiss={() => setHelperDialog((current) => ({ ...current, visible: false }))}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>{helperDialogCopy[helperDialog.key].title}</Dialog.Title>
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium">{helperDialogCopy[helperDialog.key].message}</Text>
          </Dialog.Content>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
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
