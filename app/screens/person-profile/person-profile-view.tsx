import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Button,
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
import { ConfirmDialog, HorizontalTabStrip, LifeEventDialog, PersonFormDialog, PersonRelationshipDialog } from '../../../components';
import type { PersonRelationshipMode } from '../../../components/person-relationship-dialog';
import { useAuthStore } from '../../../stores/auth-store';
import { useTreeStore } from '../../../stores/tree-store';
import type { PersonLifeEvent, PersonMutationPayload, PersonPhoto, PersonRecord } from '../../../components/dto/person';
import {
  formatPersonDate,
  getDisplayPersonPhoto,
  getLifeEventTypeLabel,
  getPersonLifeSpanLabel,
  getPersonPresenceLabel,
  getPersonTreeMembershipIds,
  isPersonDeceased,
} from '../../../components/dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from '../../../components/dto/relationship';
import type { MainTabParamList } from '../../../components/dto/navigation';
import { canEditTreeContent, getAssignedPersonId, getAssignedUserIdForPerson } from '../../../components/dto/tree';
import { getPersonValidationFeedback } from '../../../components/family-tree-validation';
import { cropPhotoForPreferredDisplay, MAX_PHOTOS_PER_PERSON, MAX_PHOTO_BYTES, preparePhotoForUpload } from '../../../components/photo-utils';
import { formatPersonGender, formatPersonName } from '../../../components/person-formatting';
import { GlobalStyles } from '../../../constants/styles';
import { useI18n } from '../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../i18n/keys';
import { PersonNotesDialog } from './dialogs/notes-dialog';
import { PersonPhotoViewerModal } from './dialogs/photo-viewer-modal';
import { PersonPhotosDialog } from './dialogs/photos-dialog';
import { MemberProfileSection } from './sections/member-profile-section';
import { PersonLineageSection } from './sections/lineage-section';
import { PersonMemoriesSection, type PersonMemorySectionTabKey } from './sections/memories-section';
import { PersonRelationshipsSection, type PersonRelationshipSectionTabKey } from './sections/relationships-section';
const dialogChrome = GlobalStyles.dialogChrome;
const treeDetailStyles = GlobalStyles.treeDetail;

type PersonProfileRouteParams = {
  treeId: string;
  personId: string;
};

type PersonProfileNavigation = {
  canGoBack: () => boolean;
  getState?: () => { type?: string };
  goBack: () => void;
  navigate: (name: string, params?: unknown) => void;
  push?: (name: string, params?: unknown) => void;
  setOptions: (options: { title?: string }) => void;
};

type Props = {
  navigation: PersonProfileNavigation;
  route: {
    params: PersonProfileRouteParams;
  };
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
    message: 'Displays the first name, last name, birth date, gender, presence status, and photo count for this family member. Personal notes are shown at the bottom of this section.',
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

const PROFILE_TABS: Array<{ key: PersonProfileTabKey; label: string }> = [
  { key: 'member-profile', label: 'Profile' },
  { key: 'relationships', label: K.personProfile.relationships },
  { key: 'memories-gallery', label: 'Memories' },
  { key: 'descendant-tree', label: 'Descendants' },
  { key: 'ascendant-tree', label: 'Ascendants' },
];

const APP_TAB_ROUTES: Array<{
  key: keyof MainTabParamList;
  title: string;
  focusedIcon: keyof typeof MaterialCommunityIcons.glyphMap;
  unfocusedIcon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { key: 'tree', title: 'Tree', focusedIcon: 'family-tree', unfocusedIcon: 'family-tree' },
  { key: 'members', title: 'Members', focusedIcon: 'account-group-outline', unfocusedIcon: 'account-group-outline' },
  { key: 'treeSettings', title: 'Settings', focusedIcon: 'cog-outline', unfocusedIcon: 'cog-outline' },
  { key: 'notifications', title: 'Notifications', focusedIcon: 'bell-outline', unfocusedIcon: 'bell-outline' },
  { key: 'myProfile', title: 'My profile', focusedIcon: 'account-circle-outline', unfocusedIcon: 'account-circle-outline' },
];

export default function PersonProfileScreen({ navigation, route }: Props) {
  const isFocused = useIsFocused();
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
    confirmLabel: t(K.common.confirm),
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
  const [relationshipSectionTab, setRelationshipSectionTab] = useState<PersonRelationshipSectionTabKey>('insight');
  const [memorySectionTab, setMemorySectionTab] = useState<PersonMemorySectionTabKey>('events');
  const [notesDialogVisible, setNotesDialogVisible] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [photosDialogVisible, setPhotosDialogVisible] = useState(false);
  const [photoEditorExistingPhotos, setPhotoEditorExistingPhotos] = useState<PersonPhoto[]>([]);
  const [photoEditorRemovedPhotos, setPhotoEditorRemovedPhotos] = useState<PersonPhoto[]>([]);
  const [photoEditorNewPhotoUris, setPhotoEditorNewPhotoUris] = useState<string[]>([]);
  const [photoEditorPreferredPhotoRef, setPhotoEditorPreferredPhotoRef] = useState('');
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const relationshipPageSize = 3;

  const selectedTree = useMemo(
    () => trees.find((tree) => tree.id === route.params.treeId) ?? null,
    [route.params.treeId, trees],
  );

  const person = useMemo(
    () => people.find((currentPerson) => currentPerson.id === route.params.personId) ?? null,
    [people, route.params.personId],
  );
  const isMainTabNavigation = navigation.getState?.().type === 'tab';

  const canEdit = selectedTree ? canEditTreeContent(selectedTree, user?.id) : false;
  const preferredPhoto = getDisplayPersonPhoto(person);
  const photoEditorCount = useMemo(
    () => photoEditorExistingPhotos.length + photoEditorNewPhotoUris.length,
    [photoEditorExistingPhotos, photoEditorNewPhotoUris],
  );
  const canSavePhotoChanges = useMemo(
    () => Boolean(
      person
      && (
        photoEditorRemovedPhotos.length > 0
        || photoEditorNewPhotoUris.length > 0
        || photoEditorPreferredPhotoRef !== (person.preferredPhotoId ?? '')
      )
    ),
    [person, photoEditorNewPhotoUris.length, photoEditorPreferredPhotoRef, photoEditorRemovedPhotos.length],
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
          ? t('Parent of {name}', { name: formatPersonName(relatedPerson) })
          : mode === 'child-of'
            ? t('Child of {name}', { name: formatPersonName(relatedPerson) })
            : t('Spouse of {name}', { name: formatPersonName(relatedPerson) });
        const subtitle = relationship.type === 'spouse'
          ? t(K.personProfile.partnerConnection)
          : mode === 'parent-of'
            ? t(K.personProfile.parentToChildConnection)
            : t(K.personProfile.childToParentConnection);

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
        title: t(K.personProfile.birth),
        description: t(K.personProfile.wasBorn, { name: formatPersonName(person) }),
        badgeLabel: t(K.personProfile.birth),
        system: true,
      });
    }

    if (person.deathDate && !hasManualDeathEvent) {
      items.push({
        id: `death-${person.id}`,
        date: person.deathDate,
        title: t(K.personProfile.inMemory),
        description: t(K.personProfile.passedAway, { name: formatPersonName(person) }),
        badgeLabel: t(K.personProfile.inMemory),
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

    if (isMainTabNavigation) {
      navigation.navigate('memberProfile', {
        treeId: route.params.treeId,
        personId: targetPerson.id,
      });
      return;
    }

    navigation.push?.('PersonProfile', {
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
    if (isFocused && error) {
      setSnackVisible(true);
    }
  }, [error, isFocused]);

  useEffect(() => {
    if (isFocused && notice) {
      setSnackVisible(true);
    }
  }, [isFocused, notice]);

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

  const addPhotoFromPickerResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || result.assets.length === 0) {
      return;
    }

    if (photoEditorCount >= MAX_PHOTOS_PER_PERSON) {
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

      setPhotoEditorNewPhotoUris((current) => [...current, preparedPhoto.uri]);
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

    setPhotoProcessing(true);

    try {
      let nextNewPhotoUris = [...photoEditorNewPhotoUris];
      let nextPreferredPhotoRef = photoEditorPreferredPhotoRef;

      const preferredNewPhotoIndex = nextNewPhotoUris.findIndex((uri) => uri === nextPreferredPhotoRef);
      if (preferredNewPhotoIndex >= 0) {
        const croppedPreferred = await cropPhotoForPreferredDisplay(nextNewPhotoUris[preferredNewPhotoIndex]);
        if (croppedPreferred.sizeBytes > MAX_PHOTO_BYTES) {
          Alert.alert(t(K.media.photoTooLarge), t(K.media.preferredPhotoTooLargeSummary));
          return;
        }

        nextNewPhotoUris[preferredNewPhotoIndex] = croppedPreferred.uri;
        nextPreferredPhotoRef = croppedPreferred.uri;
      }

      const nextPayload = buildPersonMutationPayload(person, {
        existingPhotos: photoEditorExistingPhotos,
        removedPhotos: photoEditorRemovedPhotos,
        newPhotoUris: nextNewPhotoUris,
        preferredPhotoRef: nextPreferredPhotoRef,
      });
      const photoValidation = getPersonValidationFeedback({
        people,
        relationships,
        person: {
          firstName: nextPayload.firstName,
          middleNames: nextPayload.middleNames,
          lastName: nextPayload.lastName,
          maidenName: nextPayload.maidenName ?? '',
          birthDate: nextPayload.birthDate,
          deathDate: nextPayload.deathDate,
          notes: nextPayload.notes,
          lifeEvents: nextPayload.lifeEvents,
        },
        existingPhotos: nextPayload.existingPhotos,
        removedPhotos: nextPayload.removedPhotos,
        newPhotoUris: nextPayload.newPhotoUris,
        ignorePersonId: person.id,
      });
      if (photoValidation.errors.length > 0) {
        Alert.alert(t(K.personProfile.cannotSavePhotos), photoValidation.errors[0]);
        return;
      }

      await updatePerson(user.id, person, nextPayload);
      setPhotosDialogVisible(false);
    } catch {
      // surfaced by store snackbar
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
    const validation = getPersonValidationFeedback({
      people,
      relationships,
      person: {
        firstName: person.firstName,
        middleNames: person.middleNames ?? '',
        lastName: person.lastName,
        maidenName: person.maidenName ?? '',
        birthDate: person.birthDate,
        deathDate: person.deathDate,
        notes: person.notes,
        lifeEvents: nextLifeEvents,
      },
      ignorePersonId: person.id,
    });
    if (validation.errors.length > 0) {
      Alert.alert(t(K.personProfile.cannotSaveLifeEvent), validation.errors[0]);
      return;
    }

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
  const handleGoBack = () => {
    if (isMainTabNavigation) {
      navigation.navigate('members');
      return;
    }

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View pointerEvents="box-none" style={styles.stickyActionBarHost}>
        <Button
          mode="contained-tonal"
          icon="arrow-left"
          onPress={handleGoBack}
          style={[styles.heroFloatingButton, styles.heroFloatingButtonLeft]}
          contentStyle={{ height: 44, paddingHorizontal: 6 }}
          accessibilityLabel={t(K.personProfile.backToMemberSearch)}
        >
          {t(K.personProfile.backToMemberSearch)}
        </Button>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Surface style={[styles.heroCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
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
                  {t(K.personProfile.familyProfile)}
                </Text>
                <View style={styles.heroNameRow}>
                  <Text variant="headlineMedium">{formatPersonName(person)}</Text>
                  {isCurrentUsersPerson ? <Chip compact icon="account">{t(K.common.you)}</Chip> : null}
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
                    <Text variant="titleSmall">{t(K.personProfile.thisIsYourLinkedProfile)}</Text>
                    <Text variant="bodySmall" style={[styles.claimText, { color: theme.colors.onSurfaceVariant }]}>
                      {t(K.personProfile.anywhereYouWillSeeYouBadge)}
                    </Text>
                  </View>
                    <Button mode="outlined" icon="link-off" onPress={handleUnclaimPerson} disabled={mutating}>
                    {t(K.personProfile.unclaimMyself)}
                  </Button>
                </View>
              ) : linkedCollaborator ? (
                <>
                  <Text variant="titleSmall">{t(K.personProfile.alreadyLinkedToSomeoneElse)}</Text>
                  <Text variant="bodySmall" style={[styles.claimText, { color: theme.colors.onSurfaceVariant }]}>
                    {t(K.personProfile.thisProfileAlreadyLinkedToName, { name: linkedCollaborator.displayName || linkedCollaborator.email })}
                  </Text>
                </>
              ) : canClaimPerson ? (
                <View style={styles.claimRow}>
                  <View style={styles.claimTextWrap}>
                    <Text variant="titleSmall">{t(K.personProfile.isThisYou)}</Text>
                    <Text variant="bodySmall" style={[styles.claimText, { color: theme.colors.onSurfaceVariant }]}>
                      {t(K.personProfile.tapOnceToLinkProfile)}
                    </Text>
                  </View>
                  <Button mode="contained" icon="account-check" onPress={handleClaimPerson} disabled={mutating}>
                    {t(K.personProfile.claimThisFamilyMemberAsMe)}
                  </Button>
                </View>
              ) : null}
            </View>
          ) : null}
        </Surface>

        <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
            {t(K.personProfile.yourProfileWorkspace)}
          </Text>
          <HorizontalTabStrip
            items={PROFILE_TABS.map((tab) => ({ ...tab, label: t(tab.label) }))}
            activeKey={activeTab}
            onChange={setActiveTab}
            containerStyle={[styles.tabStripCard, { backgroundColor: theme.colors.surface }]}
            contentContainerStyle={styles.tabStripContent}
            itemStyle={styles.tabStripItem}
          />
        </Surface>

        {activeTab === 'member-profile' ? (
          <MemberProfileSection
            person={person}
            preferredPhoto={preferredPhoto}
            canEdit={canEdit}
            linkedCollaboratorLabel={linkedCollaborator ? linkedCollaborator.displayName || linkedCollaborator.email : null}
            isCurrentUsersPerson={isCurrentUsersPerson}
            onOpenHelperDialog={() => openHelperDialog('member-profile')}
            onEdit={() => setEditorVisible(true)}
          />
        ) : null}
        {activeTab === 'relationships' ? (
          <PersonRelationshipsSection
            person={person}
            people={people}
            relationships={relationships}
            canEdit={canEdit}
            mutating={mutating}
            relationshipSectionTab={relationshipSectionTab}
            setRelationshipSectionTab={setRelationshipSectionTab}
            paginatedRelationships={paginatedRelationships}
            relationshipPage={relationshipPage}
            totalRelationshipPages={totalRelationshipPages}
            setRelationshipPage={setRelationshipPage}
            onOpenHelperDialog={() => openHelperDialog('relationships')}
            onAddRelationship={() => setRelationshipDialog({ visible: true, relationship: null })}
            onEditRelationship={(relationship) => setRelationshipDialog({ visible: true, relationship })}
          />
        ) : null}

        {activeTab === 'descendant-tree' ? (
          <PersonLineageSection
            title={t(K.lineage.descendantTree)}
            helperLabel={t(K.lineage.aboutDescendantTree)}
            count={descendantIds.length}
            singularLabel="descendant"
            pluralLabel="descendants"
            person={person}
            people={people}
            relationships={relationships}
            currentAssignedPersonId={currentAssignedPerson?.id ?? undefined}
            onOpenHelperDialog={() => openHelperDialog('descendant-tree')}
            onPressPerson={openFamilyMemberProfile}
            mode="descendant"
          />
        ) : null}

        {activeTab === 'ascendant-tree' ? (
          <PersonLineageSection
            title={t(K.lineage.ascendantTree)}
            helperLabel={t(K.lineage.aboutAscendantTree)}
            count={ascendantIds.length}
            singularLabel="ancestor"
            pluralLabel="ancestors"
            person={person}
            people={people}
            relationships={relationships}
            currentAssignedPersonId={currentAssignedPerson?.id ?? undefined}
            onOpenHelperDialog={() => openHelperDialog('ascendant-tree')}
            onPressPerson={openFamilyMemberProfile}
            mode="ascendant"
          />
        ) : null}

        {activeTab === 'memories-gallery' ? (
          <PersonMemoriesSection
            person={person}
            preferredPhoto={preferredPhoto}
            canEdit={canEdit}
            mutating={mutating}
            memorySectionTab={memorySectionTab}
            setMemorySectionTab={setMemorySectionTab}
            memoryTimeline={memoryTimeline}
            onOpenHelperDialog={() => openHelperDialog('memories-gallery')}
            onOpenNotesDialog={openNotesDialog}
            onOpenPhotosDialog={openPhotosDialog}
            onOpenViewer={setViewerIndex}
            onAddLifeEvent={() => setLifeEventDialog({ visible: true, event: null })}
            onEditLifeEvent={(event) => setLifeEventDialog({ visible: true, event })}
          />
        ) : null}
      </ScrollView>
      {!isMainTabNavigation ? (
        <Surface
          style={[
            treeDetailStyles.tabBar,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.outlineVariant,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-around',
              paddingHorizontal: 10,
            },
          ]}
          elevation={0}
        >
          {APP_TAB_ROUTES.map((routeItem) => {
            const isActive = routeItem.key === 'members';
            return (
              <Pressable
                key={routeItem.key}
                onPress={() => navigation.navigate('Main', { screen: routeItem.key })}
                accessibilityRole="button"
                accessibilityLabel={t(routeItem.title)}
                style={{
                  minHeight: 56,
                  minWidth: 56,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isActive ? theme.colors.elevation.level2 : 'transparent',
                }}
              >
                <MaterialCommunityIcons
                  name={routeItem.focusedIcon}
                  size={26}
                  color={isActive ? theme.colors.primary : theme.colors.onSurfaceVariant}
                />
              </Pressable>
            );
          })}
        </Surface>
      ) : null}
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
            t(K.personProfile.removeRelationship),
            t(K.personProfile.removeThisFamilyConnection),
            t(K.common.remove),
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
            t(K.personProfile.deleteLifeEvent),
            t(K.personProfile.deleteMemoryFromName, { title: lifeEventDialog.event!.title, name: formatPersonName(person) }),
            t(K.common.delete),
            async () => {
              await handleDeleteLifeEvent(lifeEventDialog.event!);
              setLifeEventDialog({ visible: false, event: null });
            },
          );
        } : undefined}
        onSubmit={handleLifeEventSubmit}
      />

      <PersonNotesDialog
        visible={notesDialogVisible}
        mutating={mutating}
        notesDraft={notesDraft}
        setNotesDraft={setNotesDraft}
        onDismiss={() => setNotesDialogVisible(false)}
        onSave={handleSaveNotes}
      />

      <PersonPhotosDialog
        visible={photosDialogVisible}
        mutating={mutating}
        photoProcessing={photoProcessing}
        photoEditorCount={photoEditorCount}
        canSavePhotoChanges={canSavePhotoChanges}
        photoEditorExistingPhotos={photoEditorExistingPhotos}
        photoEditorNewPhotoUris={photoEditorNewPhotoUris}
        photoEditorPreferredPhotoRef={photoEditorPreferredPhotoRef}
        onDismiss={() => setPhotosDialogVisible(false)}
        onLibrary={handleAddPhotoFromLibrary}
        onCamera={handleCapturePhoto}
        onTogglePreferred={(value) => setPhotoEditorPreferredPhotoRef((current) => current === value ? '' : value)}
        onRemoveExisting={handleRemoveExistingPhoto}
        onRemoveNew={handleRemoveNewPhoto}
        onSave={handleSavePhotos}
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

      <PersonPhotoViewerModal person={person} viewerIndex={viewerIndex} setViewerIndex={setViewerIndex} />

      <Portal>
        <Dialog
          visible={helperDialog.visible}
          onDismiss={() => setHelperDialog((current) => ({ ...current, visible: false }))}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(helperDialogCopy[helperDialog.key].title)}</Dialog.Title>
          <IconButton
            icon="close"
            size={20}
            onPress={() => setHelperDialog((current) => ({ ...current, visible: false }))}
            style={dialogChrome.closeButton}
            accessibilityLabel={t(K.common.close)}
          />
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium">{t(helperDialogCopy[helperDialog.key].message)}</Text>
          </Dialog.Content>
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
