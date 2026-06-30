import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Button,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import {
  ConfirmDialog,
  FamilyTreeCanvas,
  HorizontalTabStrip,
  LifeEventDialog,
  PersonFormDialog,
  PersonRelationshipDialog,
} from '../../../components';
import type { PersonRelationshipMode } from '../../../components/person-relationship-dialog';
import type { RootStackParamList } from '../../../components/dto/navigation';
import type { NewPersonPhotoInput, PersonLifeEvent, PersonMutationPayload, PersonPhoto, PersonRecord } from '../../../components/dto/person';
import {
  formatPersonDate,
  getDisplayPersonPhoto,
  getLifeEventTypeLabel,
  getPersonLifeSpanLabel,
  getPersonPresenceLabel,
  getPersonTreeMembershipIds,
  isPersonDeceased,
} from '../../../components/dto/person';
import { MAX_PHOTOS_PER_PERSON, MAX_PHOTO_BYTES, preparePhotoForUpload } from '../../../components/photo-utils';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from '../../../components/dto/relationship';
import { canEditTreeContent, getAssignedPersonId } from '../../../components/dto/tree';
import { getPersonValidationFeedback } from '../../../components/family-tree-validation';
import { formatPersonName } from '../../../components/person-formatting';
import { GlobalStyles } from '../../../constants/styles';
import { useI18n } from '../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../i18n/keys';
import { useAuthStore } from '../../../stores/auth-store';
import { useTreeStore } from '../../../stores/tree-store';
import { NotesDialog } from './dialogs/notes-dialog';
import { PhotoViewerModal } from './dialogs/photo-viewer-modal';
import { AppSettingsSection, type UserProfileTabProps } from './sections/app-settings-section';
import { LineageSection } from './sections/lineage-section';
import { MemoriesSection, type MemorySectionTabKey } from './sections/memories-section';
import { ProfileOverviewSection } from './sections/profile-overview-section';
import { ProfileHeroSection } from './sections/profile-hero-section';
import { RelationshipsSection, type RelationshipSectionTabKey } from './sections/relationships-section';

const treeDetailStyles = GlobalStyles.treeDetail;
const personProfileStyles = GlobalStyles.personProfile;

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

type ProfileTabKey = 'biography' | 'relationships' | 'memories' | 'descendants' | 'ascendants' | 'app-settings';

const PROFILE_TABS: Array<{ key: ProfileTabKey; label: string }> = [
  { key: 'biography', label: K.personProfile.biography },
  { key: 'relationships', label: K.personProfile.relationships },
  { key: 'memories', label: K.memories.memories },
  { key: 'descendants', label: K.lineage.descendants },
  { key: 'ascendants', label: K.lineage.ascendants },
  { key: 'app-settings', label: K.personProfile.appSettings },
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
    cropPreferredPhotoRef: '',
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

export function UserProfileTabContent({ onSignOut, authLoading }: UserProfileTabProps) {
  const theme = useTheme();
  const { t } = useI18n();
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
    selectTree,
  } = useTreeStore();

  const [activeTab, setActiveTab] = useState<ProfileTabKey>('biography');
  const [memorySectionTab, setMemorySectionTab] = useState<MemorySectionTabKey>('events');
  const [relationshipSectionTab, setRelationshipSectionTab] = useState<RelationshipSectionTabKey>('insight');
  const [editorVisible, setEditorVisible] = useState(false);
  const [relationshipDialog, setRelationshipDialog] = useState<RelationshipDialogState>({ visible: false, relationship: null });
  const [lifeEventDialog, setLifeEventDialog] = useState<LifeEventDialogState>({ visible: false, event: null });
  const [notesDialogVisible, setNotesDialogVisible] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: t(K.common.confirm),
    action: null,
  });

  const profileTabs = useMemo(
    () => PROFILE_TABS.map((tab) => ({ ...tab, label: t(tab.label) })),
    [t],
  );

  const selectedTree = useMemo(
    () => trees.find((tree) => tree.id === selectedTreeId) ?? null,
    [selectedTreeId, trees],
  );

  const defaultTree = useMemo(
    () => trees.find((tree) => tree.id === user?.defaultTreeId) ?? null,
    [trees, user?.defaultTreeId],
  );

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const defaultAssignedPersonId = useMemo(
    () => (defaultTree ? getAssignedPersonId(defaultTree, user?.id) : null),
    [defaultTree, user?.id],
  );

  const currentAssignedPersonId = useMemo(
    () => (selectedTree ? getAssignedPersonId(selectedTree, user?.id) : null),
    [selectedTree, user?.id],
  );

  const profileTree = useMemo(
    () => {
      if (defaultTree && defaultAssignedPersonId) {
        return defaultTree;
      }

      if (selectedTree && currentAssignedPersonId) {
        return selectedTree;
      }

      return defaultTree ?? selectedTree ?? null;
    },
    [currentAssignedPersonId, defaultAssignedPersonId, defaultTree, selectedTree],
  );

  const profileAssignedPersonId = useMemo(
    () => {
      if (profileTree?.id === defaultTree?.id) {
        return defaultAssignedPersonId;
      }

      if (profileTree?.id === selectedTree?.id) {
        return currentAssignedPersonId;
      }

      return defaultAssignedPersonId ?? currentAssignedPersonId;
    },
    [currentAssignedPersonId, defaultAssignedPersonId, defaultTree?.id, profileTree?.id, selectedTree?.id],
  );

  const currentAssignedPerson = useMemo(
    () => (profileAssignedPersonId ? peopleById.get(profileAssignedPersonId) ?? null : null),
    [peopleById, profileAssignedPersonId],
  );

  const canEditLinkedProfile = useMemo(
    () => Boolean(profileTree && canEditTreeContent(profileTree, user?.id)),
    [profileTree, user?.id],
  );

  const needsDefaultTreeSelection = Boolean(
    user?.defaultTreeId
    && defaultTree
    && selectedTreeId !== user.defaultTreeId,
  );

  const needsAssignedPersonHydration = Boolean(
    profileTree
    && profileAssignedPersonId
    && (!selectedTreeId || selectedTreeId === profileTree.id)
    && !currentAssignedPerson,
  );

  const shouldShowLinkedProfileTabs = Boolean(
    profileTree
    && profileAssignedPersonId
    && currentAssignedPerson,
  );

  const fallbackProfileState = useMemo(() => {
    if (trees.length === 0) {
      return {
        title: t(K.profileState.createOrJoinTree),
        summary: t(K.profileState.createOrJoinTreeSummary),
        detail: t(K.profileState.createOrJoinTreeDetail),
      };
    }

    if (!user?.defaultTreeId) {
      return {
        title: t(K.profileState.chooseDefaultTree),
        summary: t(K.profileState.chooseDefaultTreeSummary),
        detail: t(K.profileState.chooseDefaultTreeDetail),
      };
    }

    if (!defaultTree) {
      if (selectedTree && currentAssignedPersonId) {
        return {
          title: t(K.profileState.linkedProfileAvailable),
          summary: t(K.profileState.linkedProfileAvailableSummary, { treeName: selectedTree.name }),
          detail: t(K.profileState.linkedProfileAvailableDetail),
        };
      }

      return {
        title: t(K.profileState.reconnectDefaultTree),
        summary: t(K.profileState.reconnectDefaultTreeSummary),
        detail: t(K.profileState.reconnectDefaultTreeDetail),
      };
    }

    if (!defaultAssignedPersonId && !currentAssignedPersonId) {
      return {
        title: t(K.profileState.linkOrClaimFamilyProfile),
        summary: t(
          defaultTree
            ? K.profileState.linkOrClaimFamilyProfileSummary
            : 'You have a tree ready, but your account is not linked to a family member profile yet.',
          { treeName: defaultTree?.name ?? '' },
        ),
        detail: t(K.profileState.linkOrClaimFamilyProfileDetail),
      };
    }

    if (!currentAssignedPerson) {
      return {
        title: t(K.profileState.loadingFamilyProfile),
        summary: t(
          profileTree
            ? K.profileState.loadingFamilyProfileSummary
            : 'Your account is linked, and we are still loading that family member profile.',
          { treeName: profileTree?.name ?? '' },
        ),
        detail: t(K.profileState.loadingFamilyProfileDetail),
      };
    }

    return {
      title: t(K.profileState.profileWorkspace),
      summary: t(K.profileState.profileWorkspaceSummary),
      detail: t(K.profileState.profileWorkspaceDetail),
    };
  }, [currentAssignedPerson, currentAssignedPersonId, defaultAssignedPersonId, defaultTree, profileTree, selectedTree, t, trees.length, user?.defaultTreeId]);

  const linkedPerson = currentAssignedPerson;
  const preferredPhoto = getDisplayPersonPhoto(linkedPerson);
  const existingLastNames = useMemo(
    () => [...new Set(people.map((person) => person.lastName.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [people],
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
          ? t(K.personProfile.partnerConnection)
          : mode === 'parent-of'
            ? t(K.personProfile.parentToChildConnection)
            : t(K.personProfile.childToParentConnection);

        return {
          relationship,
          mode,
          relatedPerson,
          subtitle,
        };
      })
      .sort((left, right) => right.relationship.createdAt.localeCompare(left.relationship.createdAt));
  }, [linkedPerson, peopleById, relationships, t]);

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
        title: t(K.personProfile.birth),
        description: t(K.personProfile.wasBorn, { name: formatPersonName(linkedPerson) }),
        badgeLabel: t(K.personProfile.birth),
        system: true,
      });
    }

    if (linkedPerson.deathDate && !hasManualDeathEvent) {
      items.push({
        id: `death-${linkedPerson.id}`,
        date: linkedPerson.deathDate,
        title: t(K.personProfile.inMemory),
        description: t(K.personProfile.passedAway, { name: formatPersonName(linkedPerson) }),
        badgeLabel: t(K.personProfile.inMemory),
        system: true,
      });
    }

    return items.sort((left, right) => left.date.localeCompare(right.date));
  }, [linkedPerson, t]);

  const descendantIds = useMemo(
    () => (linkedPerson ? getDescendantIds(linkedPerson.id, relationships) : []),
    [linkedPerson, relationships],
  );

  const ascendantIds = useMemo(
    () => (linkedPerson ? getAscendantIds(linkedPerson.id, relationships) : []),
    [linkedPerson, relationships],
  );

  useEffect(() => {
    if (!user?.defaultTreeId || selectedTreeId === user.defaultTreeId) {
      return;
    }

    if (!defaultTree) {
      return;
    }

    selectTree(user.defaultTreeId);
  }, [defaultTree, selectTree, selectedTreeId, user?.defaultTreeId]);

  useEffect(() => {
    if (!shouldShowLinkedProfileTabs && activeTab !== 'app-settings') {
      setActiveTab('app-settings');
    }
  }, [activeTab, shouldShowLinkedProfileTabs]);

  const openConfirm = (title: string, message: string, confirmLabel: string, action: () => Promise<void>) => {
    setConfirmState({ visible: true, title, message, confirmLabel, action });
  };

  const closeConfirm = () => {
    setConfirmState({ visible: false, title: '', message: '', confirmLabel: t(K.common.confirm), action: null });
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

  const addPhotoFromPickerResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || result.assets.length === 0) {
      return;
    }

    if (!user?.id || !linkedPerson) {
      return;
    }

    if (linkedPerson.photos.length >= MAX_PHOTOS_PER_PERSON) {
      Alert.alert(t(K.media.photoLimitReached), t(K.media.photoLimitSummary));
      return;
    }

    setPhotoProcessing(true);

    try {
      const preparedPhoto = await preparePhotoForUpload(result.assets[0]);
      if (preparedPhoto.sizeBytes > MAX_PHOTO_BYTES) {
        Alert.alert(t(K.media.photoTooLarge), t(K.media.photoTooLargeSummary));
        return;
      }

      await updatePerson(user.id, linkedPerson, buildPersonMutationPayload(linkedPerson, {
        newPhotoUris: [preparedPhoto.uri],
        newPhotos: [{ uri: preparedPhoto.uri }],
      }));
    } catch {
      Alert.alert(t(K.media.photoProcessingFailed), t(K.media.photoProcessingFailedSummary));
    } finally {
      setPhotoProcessing(false);
    }
  };

  const handleAddPhotoFromLibrary = async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t(K.media.permissionNeeded), t(K.media.photoPermissionLibrary));
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    await addPhotoFromPickerResult(result);
  };

  const handleCapturePhoto = async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t(K.media.permissionNeeded), t(K.media.photoPermissionCamera));
        return;
      }
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      await addPhotoFromPickerResult(result);
    } catch {
      Alert.alert(t(K.media.cameraUnavailable), t(K.media.cameraOpenFailed));
    }
  };

  const handleRemovePhoto = async (photo: PersonPhoto) => {
    if (!user?.id || !linkedPerson) {
      return;
    }

    setPhotoProcessing(true);

    try {
      const nextPayload = buildPersonMutationPayload(linkedPerson, {
        existingPhotos: linkedPerson.photos.filter((currentPhoto) => currentPhoto.id !== photo.id),
        removedPhotos: [photo],
        preferredPhotoRef: linkedPerson.preferredPhotoId === photo.id ? '' : linkedPerson.preferredPhotoId,
      });
      await updatePerson(user.id, linkedPerson, nextPayload);
    } catch {
      Alert.alert(t(K.media.photoProcessingFailed), t(K.media.photoProcessingFailedSummary));
    } finally {
      setPhotoProcessing(false);
    }
  };

  const handleSetPreferredPhoto = async (photo: PersonPhoto, crop: boolean) => {
    if (!user?.id || !linkedPerson) {
      return;
    }

    setPhotoProcessing(true);

    try {
      await updatePerson(user.id, linkedPerson, buildPersonMutationPayload(linkedPerson, {
        preferredPhotoRef: photo.id,
        cropPreferredPhotoRef: crop ? photo.id : '',
      }));
    } catch {
      Alert.alert(t(K.media.photoProcessingFailed), t(K.media.photoProcessingFailedSummary));
    } finally {
      setPhotoProcessing(false);
    }
  };

  const handleUpdatePhotoDetails = async (photo: PersonPhoto, values: Pick<NewPersonPhotoInput, 'title' | 'description'>) => {
    if (!user?.id || !linkedPerson) {
      return;
    }

    setPhotoProcessing(true);

    try {
      const nextExistingPhotos = linkedPerson.photos.map((currentPhoto) => (
        currentPhoto.id === photo.id
          ? { ...currentPhoto, title: values.title?.trim() ?? '', description: values.description?.trim() ?? '' }
          : currentPhoto
      ));
      await updatePerson(user.id, linkedPerson, buildPersonMutationPayload(linkedPerson, {
        existingPhotos: nextExistingPhotos,
      }));
    } catch {
      Alert.alert(t(K.media.photoProcessingFailed), t(K.media.photoProcessingFailedSummary));
    } finally {
      setPhotoProcessing(false);
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
    const validation = getPersonValidationFeedback({
      people,
      relationships,
      person: {
        firstName: linkedPerson.firstName,
        middleNames: linkedPerson.middleNames ?? '',
        lastName: linkedPerson.lastName,
        maidenName: linkedPerson.maidenName ?? '',
        birthDate: linkedPerson.birthDate,
        deathDate: linkedPerson.deathDate,
        notes: linkedPerson.notes,
        lifeEvents: nextLifeEvents,
      },
      ignorePersonId: linkedPerson.id,
    });
    if (validation.errors.length > 0) {
      Alert.alert(t(K.personProfile.cannotSaveLifeEvent), validation.errors[0]);
      return;
    }

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

  if (loadingTrees || loadingTreeData || needsDefaultTreeSelection || needsAssignedPersonHydration) {
    return (
      <View style={[personProfileStyles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[personProfileStyles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={personProfileStyles.compactContent}>
        <ProfileHeroSection
          shouldShowLinkedProfileTabs={shouldShowLinkedProfileTabs}
          linkedPerson={linkedPerson}
          preferredPhoto={preferredPhoto}
          canEditLinkedProfile={canEditLinkedProfile}
          onEdit={() => setEditorVisible(true)}
          userDisplayName={user?.displayName}
          userEmail={user?.email}
          fallbackSummary={fallbackProfileState.summary}
        />

        <HorizontalTabStrip
          items={shouldShowLinkedProfileTabs ? profileTabs : profileTabs.filter((tab) => tab.key === 'app-settings')}
          activeKey={activeTab}
          onChange={setActiveTab}
          containerStyle={[personProfileStyles.tabStripCard, { backgroundColor: theme.colors.surface }]}
          contentContainerStyle={personProfileStyles.tabStripContent}
          itemStyle={personProfileStyles.tabStripItem}
        />

        {!shouldShowLinkedProfileTabs ? (
          <Surface style={[treeDetailStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>{fallbackProfileState.title}</Text>
            <Text variant="bodyMedium" style={[treeDetailStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {fallbackProfileState.summary}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {fallbackProfileState.detail}
            </Text>
          </Surface>
        ) : null}

        {shouldShowLinkedProfileTabs && activeTab === 'biography' && linkedPerson ? (
          <ProfileOverviewSection
            linkedPerson={linkedPerson}
            preferredPhoto={preferredPhoto}
          />
        ) : null}

        {shouldShowLinkedProfileTabs && activeTab === 'relationships' && linkedPerson ? (
          <RelationshipsSection
            linkedPerson={linkedPerson}
            people={people}
            relationships={relationships}
            relationshipSectionTab={relationshipSectionTab}
            setRelationshipSectionTab={setRelationshipSectionTab}
            relationshipEntries={relationshipEntries}
            canEditLinkedProfile={canEditLinkedProfile}
            mutating={mutating}
            onAddRelationship={() => setRelationshipDialog({ visible: true, relationship: null })}
            onEditRelationship={(relationship) => setRelationshipDialog({ visible: true, relationship })}
          />
        ) : null}

        {shouldShowLinkedProfileTabs && activeTab === 'memories' && linkedPerson ? (
          <MemoriesSection
            linkedPerson={linkedPerson}
            preferredPhoto={preferredPhoto}
            memorySectionTab={memorySectionTab}
            setMemorySectionTab={setMemorySectionTab}
            memoryTimeline={memoryTimeline}
            canEditLinkedProfile={canEditLinkedProfile}
            mutating={mutating}
            onOpenNotesDialog={openNotesDialog}
            onAddPhotoFromLibrary={handleAddPhotoFromLibrary}
            onAddPhotoFromCamera={handleCapturePhoto}
            onRemovePhoto={handleRemovePhoto}
            onSetPreferredPhoto={handleSetPreferredPhoto}
            onUpdatePhotoDetails={handleUpdatePhotoDetails}
            photoProcessing={photoProcessing}
            onAddLifeEvent={() => setLifeEventDialog({ visible: true, event: null })}
            onEditLifeEvent={(event) => setLifeEventDialog({ visible: true, event })}
            onOpenViewer={setViewerIndex}
          />
        ) : null}

        {shouldShowLinkedProfileTabs && activeTab === 'descendants' && linkedPerson ? (
          <LineageSection
            title={t(K.lineage.descendants)}
            count={descendantIds.length}
            countSingular="descendant"
            countPlural="descendants"
            linkedPerson={linkedPerson}
            people={people}
            relationships={relationships}
            onPressPerson={openFamilyMemberProfile}
            mode="descendants"
          />
        ) : null}

        {shouldShowLinkedProfileTabs && activeTab === 'ascendants' && linkedPerson ? (
          <LineageSection
            title={t(K.lineage.ascendants)}
            count={ascendantIds.length}
            countSingular="ancestor"
            countPlural="ancestors"
            linkedPerson={linkedPerson}
            people={people}
            relationships={relationships}
            onPressPerson={openFamilyMemberProfile}
            mode="ascendants"
          />
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
            t(K.personProfile.removeRelationship),
            t(K.personProfile.removeThisFamilyConnection),
            t(K.common.remove),
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
            t(K.personProfile.deleteLifeEvent),
            t(K.personProfile.deleteMemoryFromName, { title: lifeEventDialog.event!.title, name: formatPersonName(linkedPerson) }),
            t(K.common.delete),
            async () => {
              await handleDeleteLifeEvent(lifeEventDialog.event!);
              setLifeEventDialog({ visible: false, event: null });
            },
          );
        } : undefined}
        onSubmit={handleLifeEventSubmit}
      />

      <NotesDialog
        visible={notesDialogVisible}
        mutating={mutating}
        notesDraft={notesDraft}
        setNotesDraft={setNotesDraft}
        onDismiss={() => setNotesDialogVisible(false)}
        onSave={handleSaveNotes}
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

      <PhotoViewerModal linkedPerson={linkedPerson} viewerIndex={viewerIndex} setViewerIndex={setViewerIndex} />

    </View>
  );
}
