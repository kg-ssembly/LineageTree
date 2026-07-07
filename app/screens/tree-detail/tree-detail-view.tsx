import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AddPersonEntryDialog,
  CollaboratorDialog,
  ConfirmDialog,
  FloatingSnackbar,
  MaidenTreeSuggestionDialog,
  PersonFormDialog,
  RelationshipDialog,
  SharedLoader,
} from '../../../components';
import type { PersonFormSubmission, PendingRelationshipMode, PendingRelationshipSubmission } from '../../../components/person-form-dialog';
import { useAuthStore } from '../../../stores/auth-store';
import { useTreeStore } from '../../../stores/tree-store';
import type { PersonRecord } from '../../../components/dto/person';
import { getDisplayPersonPhoto, getLifeEventTypeLabel, getPersonPresenceLabel } from '../../../components/dto/person';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, type ParentChildRelationshipKind, type SpouseRelationshipStatus } from '../../../components/dto/relationship';
import type { RelationshipRecord } from '../../../components/dto/relationship';
import type { RootStackParamList, TreeDetailTabParamList } from '../../../components/dto/navigation';
import { getUserDisplayLabel } from '../../../components/dto/user';
import { formatPersonName } from '../../../components/person-formatting';
import { findCrossSurnameChildren } from '../../../components/family-tree-surname-clusters';
import { canEditTreeContent, canManageTree, getAssignedPersonId, getTreeRole, type CollaboratorRole } from '../../../components/dto/tree';
import { computeRelationshipInsight } from '../../../providers';
import { getTreeBundle } from '../../../providers/family-tree-service';
import { GlobalStyles } from '../../../constants/styles';
import { useI18n } from '../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../i18n/keys';
import { useShallow } from 'zustand/react/shallow';
import { buildPeopleDirectory, buildTreeAssignmentContext, getTreeById } from '../tree-tabs/shared';
import {
  buildSelfAssignmentSuggestions,
  PeopleRelationshipsTabContent,
  TreeSettingsTabContent,
  VisualisationTabContent,
  type SharedTabProps,
} from '../tree-tab-content';
import {
  buildSelfPersonInitialValues,
  createPersonFromFormSubmission,
  findConnectedTreeForSurname,
  findMaidenTreeCandidates,
  type MaidenTreeSuggestionCandidate,
} from '../tree-screen-helpers';
import { TreeDetailMaidenViewer } from './tree-detail-maiden-viewer';
import { TreeDetailNodeQuickActionsDialog } from '../profile-shared';

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

type TreeSettingsFocus = {
  tab: 'approvals' | 'merges';
  itemId: string;
  mode: 'approval' | 'merge';
  token: number;
} | null;

type ViewerProfileTabKey = 'summary' | 'life' | 'photos';
type TreeBundleState = Awaited<ReturnType<typeof getTreeBundle>> | null;

type MaidenTreeSuggestionState = {
  visible: boolean;
  person: PersonRecord | null;
  relatedTreeCandidates: MaidenTreeSuggestionCandidate[];
  pendingRelationships: PendingRelationshipSubmission[];
};

const MAIDEN_MEMBERS_PER_PAGE = 3;

const Tab = createBottomTabNavigator<TreeDetailTabParamList>();
const styles = GlobalStyles.treeDetail;

export default function TreeDetailScreen({ navigation, route }: Props) {
  const isFocused = useIsFocused();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const {
    trees,
    selectedTreeId,
    people,
    relationships,
    approvalRequests,
    mergeRequests,
    mergeHistory,
    notifications,
    notificationActivityStates,
    mergePreview,
    loadingTrees,
    loadingTreeData,
    mutating,
    error,
    notice,
    selectTree,
    addCollaborator,
    removeCollaborator,
    createPerson,
    createPersonWithRelationships,
    createTreeFromSurname,
    assignPersonToUser,
    clearSelfAssignment,
    updatePerson,
    removePerson,
    addParentChildRelationship,
    addSpouseRelationship,
    approveApprovalRequest,
    rejectApprovalRequest,
    setTreeDiscoverability,
    setApprovalWindowHours,
    setSurnameVariantGroups,
    createMergeRequest,
    sendMergeInvite,
    requestTreeAccess,
    requestTreeAccessByIdentifier,
    respondToTreeAccessRequest,
    searchDiscoverableTrees,
    searchDiscoverableTreesByUsername,
    respondToMergeInvite,
    markNotificationSeen,
    markNotificationOpened,
    markNotificationActivityActioned,
    loadMergePreview,
    approveMergeRequest,
    grantMergeViewerAccess,
    rejectMergeRequest,
    requestMergeChanges,
    undoMerge,
    clearError,
    clearNotice,
  } = useTreeStore(useShallow((state) => ({
    trees: state.trees,
    selectedTreeId: state.selectedTreeId,
    people: state.people,
    relationships: state.relationships,
    approvalRequests: state.approvalRequests,
    mergeRequests: state.mergeRequests,
    mergeHistory: state.mergeHistory,
    notifications: state.notifications,
    notificationActivityStates: state.notificationActivityStates,
    mergePreview: state.mergePreview,
    loadingTrees: state.loadingTrees,
    loadingTreeData: state.loadingTreeData,
    mutating: state.mutating,
    error: state.error,
    notice: state.notice,
    selectTree: state.selectTree,
    addCollaborator: state.addCollaborator,
    removeCollaborator: state.removeCollaborator,
    createPerson: state.createPerson,
    createPersonWithRelationships: state.createPersonWithRelationships,
    createTreeFromSurname: state.createTreeFromSurname,
    assignPersonToUser: state.assignPersonToUser,
    clearSelfAssignment: state.clearSelfAssignment,
    updatePerson: state.updatePerson,
    removePerson: state.removePerson,
    addParentChildRelationship: state.addParentChildRelationship,
    addSpouseRelationship: state.addSpouseRelationship,
    approveApprovalRequest: state.approveApprovalRequest,
    rejectApprovalRequest: state.rejectApprovalRequest,
    setTreeDiscoverability: state.setTreeDiscoverability,
    setApprovalWindowHours: state.setApprovalWindowHours,
    setSurnameVariantGroups: state.setSurnameVariantGroups,
    createMergeRequest: state.createMergeRequest,
    sendMergeInvite: state.sendMergeInvite,
    requestTreeAccess: state.requestTreeAccess,
    requestTreeAccessByIdentifier: state.requestTreeAccessByIdentifier,
    respondToTreeAccessRequest: state.respondToTreeAccessRequest,
    searchDiscoverableTrees: state.searchDiscoverableTrees,
    searchDiscoverableTreesByUsername: state.searchDiscoverableTreesByUsername,
    respondToMergeInvite: state.respondToMergeInvite,
    markNotificationSeen: state.markNotificationSeen,
    markNotificationOpened: state.markNotificationOpened,
    markNotificationActivityActioned: state.markNotificationActivityActioned,
    loadMergePreview: state.loadMergePreview,
    approveMergeRequest: state.approveMergeRequest,
    grantMergeViewerAccess: state.grantMergeViewerAccess,
    rejectMergeRequest: state.rejectMergeRequest,
    requestMergeChanges: state.requestMergeChanges,
    undoMerge: state.undoMerge,
    clearError: state.clearError,
    clearNotice: state.clearNotice,
  })));

  const [personDialog, setPersonDialog] = useState<PersonDialogState>({
    visible: false,
    mode: 'create',
    person: null,
    initialPendingRelationships: [],
  });
  const [addPersonChooserVisible, setAddPersonChooserVisible] = useState(false);
  const [selfPersonDialogVisible, setSelfPersonDialogVisible] = useState(false);
  const [relationshipDialogVisible, setRelationshipDialogVisible] = useState(false);
  const [collaboratorDialogVisible, setCollaboratorDialogVisible] = useState(false);
  const [followUpTreePromptsPending, setFollowUpTreePromptsPending] = useState(false);
  const [nodeQuickActionState, setNodeQuickActionState] = useState<NodeQuickActionState>({ visible: false, person: null });
  const [maidenTreeSuggestion, setMaidenTreeSuggestion] = useState<MaidenTreeSuggestionState>({
    visible: false,
    person: null,
    relatedTreeCandidates: [],
    pendingRelationships: [],
  });
  const [snackVisible, setSnackVisible] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: t(K.common.confirm),
    action: null,
  });
  const [treeSettingsFocus, setTreeSettingsFocus] = useState<TreeSettingsFocus>(null);
  const canvasFamilySwitchRef = useRef<((surname: string) => void) | null>(null);
  const canvasActiveFamilyRef = useRef<string | null>(null);
  const [maidenMembersVisible, setMaidenMembersVisible] = useState(false);
  const [viewerPerson, setViewerPerson] = useState<PersonRecord | null>(null);
  const [viewerProfileTab, setViewerProfileTab] = useState<ViewerProfileTabKey>('summary');
  const [viewerPhotoIndex, setViewerPhotoIndex] = useState<number | null>(null);
  const [returnTreeBundle, setReturnTreeBundle] = useState<TreeBundleState>(null);
  const [maidenMemberSearchQuery, setMaidenMemberSearchQuery] = useState('');
  const [maidenMembersPage, setMaidenMembersPage] = useState(1);

  const selectedTree = useMemo(
    () => getTreeById(trees, route.params.treeId),
    [route.params.treeId, trees],
  );
  const returnTree = useMemo(
    () => getTreeById(trees, route.params.returnTreeId),
    [route.params.returnTreeId, trees],
  );
  const isMaidenViewerMode = Boolean(route.params.returnTreeId);
  const initialTab = route.params.initialTab && route.params.initialTab !== 'HomeTab'
    ? route.params.initialTab
    : 'PeopleRelationshipsTab';
  const bottomInset = Platform.OS === 'android' && insets.bottom < 24 ? 0 : insets.bottom;
  const isSharedLoaderVisible = mutating;

  const { peopleById, existingLastNames } = useMemo(
    () => buildPeopleDirectory(people),
    [people],
  );
  const crossSurnameChildIds = useMemo(
    () => findCrossSurnameChildren(people, relationships),
    [people, relationships],
  );

  const currentUserLabel = useMemo(() => getUserDisplayLabel(user), [user]);

  const {
    assignedUserIdByPersonId,
    assignedPersonByUserId,
    currentAssignedPerson,
  } = useMemo(
    () => buildTreeAssignmentContext(selectedTree, peopleById, user?.id),
    [peopleById, selectedTree, user?.id],
  );
  const returnTreeAssignedPersonId = useMemo(
    () => (returnTreeBundle?.tree ? getAssignedPersonId(returnTreeBundle.tree, user?.id) : null),
    [returnTreeBundle?.tree, user?.id],
  );
  const returnTreePeopleById = useMemo(
    () => new Map((returnTreeBundle?.people ?? []).map((person) => [person.id, person])),
    [returnTreeBundle?.people],
  );
  const returnTreeAssignedPerson = useMemo(
    () => (returnTreeAssignedPersonId ? returnTreePeopleById.get(returnTreeAssignedPersonId) ?? null : null),
    [returnTreeAssignedPersonId, returnTreePeopleById],
  );
  const combinedRelationshipPeople = useMemo(() => {
    const peopleByIdMap = new Map<string, PersonRecord>();
    (returnTreeBundle?.people ?? []).forEach((person) => {
      peopleByIdMap.set(person.id, person);
    });
    people.forEach((person) => {
      peopleByIdMap.set(person.id, person);
    });
    return [...peopleByIdMap.values()];
  }, [people, returnTreeBundle?.people]);
  const combinedRelationshipRecords = useMemo(() => {
    const relationshipsById = new Map<string, RelationshipRecord>();
    (returnTreeBundle?.relationships ?? []).forEach((relationship) => {
      relationshipsById.set(relationship.id, relationship);
    });
    relationships.forEach((relationship) => {
      relationshipsById.set(relationship.id, relationship);
    });
    return [...relationshipsById.values()];
  }, [relationships, returnTreeBundle?.relationships]);
  const viewerPersonPreferredPhoto = useMemo(
    () => getDisplayPersonPhoto(viewerPerson),
    [viewerPerson],
  );
  const viewerRelationshipInsight = useMemo(
    () => (returnTreeAssignedPerson && viewerPerson
      ? computeRelationshipInsight(combinedRelationshipPeople, combinedRelationshipRecords, returnTreeAssignedPerson.id, viewerPerson.id)
      : null),
    [combinedRelationshipPeople, combinedRelationshipRecords, returnTreeAssignedPerson, viewerPerson],
  );
  const viewerTimeline = useMemo(() => {
    if (!viewerPerson) {
      return [] as Array<{
        id: string;
        date: string;
        title: string;
        description: string;
        badgeLabel: string;
        system: boolean;
      }>;
    }

    const items = viewerPerson.lifeEvents.map((event) => ({
      id: event.id,
      date: event.date,
      title: event.title,
      description: event.description,
      badgeLabel: getLifeEventTypeLabel(event.type),
      system: false,
    }));
    const hasManualDeathEvent = viewerPerson.lifeEvents.some((event) => event.type === 'death');

    if (viewerPerson.birthDate) {
      items.push({
        id: `birth-${viewerPerson.id}`,
        date: viewerPerson.birthDate,
        title: t(K.personProfile.birth),
        description: t(K.personProfile.wasBorn, { name: formatPersonName(viewerPerson) }),
        badgeLabel: t(K.personProfile.birth),
        system: true,
      });
    }

    if (viewerPerson.deathDate && !hasManualDeathEvent) {
      items.push({
        id: `death-${viewerPerson.id}`,
        date: viewerPerson.deathDate,
        title: t(K.personProfile.inMemory),
        description: t(K.personProfile.passedAway, { name: formatPersonName(viewerPerson) }),
        badgeLabel: t(K.personProfile.inMemory),
        system: true,
      });
    }

    return items.sort((left, right) => left.date.localeCompare(right.date));
  }, [t, viewerPerson]);
  const maidenViewerPeople = useMemo(
    () => [...people].sort((left, right) => formatPersonName(left).localeCompare(formatPersonName(right))),
    [people],
  );
  const filteredMaidenViewerPeople = useMemo(() => {
    const normalizedQuery = maidenMemberSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return maidenViewerPeople;
    }

    return maidenViewerPeople.filter((person) => {
      const searchableText = [
        formatPersonName(person),
        person.middleNames ?? '',
        person.nicknames?.join(' ') ?? '',
        person.birthPlace ?? '',
        person.hometown ?? '',
        person.familyBranch ?? '',
        person.clanName ?? '',
        person.surnameVariantHints?.join(' ') ?? '',
        person.birthDate,
        person.deathDate,
        person.notes,
        getPersonPresenceLabel(person),
      ].join(' ').toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [maidenMemberSearchQuery, maidenViewerPeople]);
  const maidenMembersTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredMaidenViewerPeople.length / MAIDEN_MEMBERS_PER_PAGE)),
    [filteredMaidenViewerPeople.length],
  );
  const paginatedMaidenViewerPeople = useMemo(() => {
    const startIndex = (maidenMembersPage - 1) * MAIDEN_MEMBERS_PER_PAGE;
    return filteredMaidenViewerPeople.slice(startIndex, startIndex + MAIDEN_MEMBERS_PER_PAGE);
  }, [filteredMaidenViewerPeople, maidenMembersPage]);

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

  useEffect(() => () => {
    if (route.params.returnTreeId) {
      selectTree(route.params.returnTreeId);
    }
  }, [route.params.returnTreeId, selectTree]);

  useEffect(() => {
    if (selectedTree) {
      navigation.setOptions({ title: selectedTree.name });
    }
  }, [navigation, selectedTree]);

  useEffect(() => {
    if (!isMaidenViewerMode || !route.params.returnTreeId) {
      setReturnTreeBundle(null);
      return;
    }

    let cancelled = false;
    void getTreeBundle(route.params.returnTreeId)
      .then((bundle) => {
        if (!cancelled) {
          setReturnTreeBundle(bundle);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReturnTreeBundle(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isMaidenViewerMode, route.params.returnTreeId]);

  useEffect(() => {
    setMaidenMembersPage(1);
  }, [maidenMemberSearchQuery, maidenMembersVisible, people]);

  useEffect(() => {
    setMaidenMembersPage((page) => Math.min(page, maidenMembersTotalPages));
  }, [maidenMembersTotalPages]);

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
    if (isFocused && (error || notice)) {
      setSnackVisible(true);
    }
  }, [error, isFocused, notice]);

  useEffect(() => {
    if (isFocused) {
      return;
    }

    setPersonDialog({ visible: false, mode: 'create', person: null, initialPendingRelationships: [] });
    setSelfPersonDialogVisible(false);
    setRelationshipDialogVisible(false);
    setCollaboratorDialogVisible(false);
    setNodeQuickActionState({ visible: false, person: null });
    setConfirmState((current) => (
      current.visible
        ? { visible: false, title: '', message: '', confirmLabel: t(K.common.confirm), action: null }
        : current
    ));
    setMaidenMembersVisible(false);
    setViewerPerson(null);
    setViewerProfileTab('summary');
    setViewerPhotoIndex(null);
  }, [isFocused, t]);

  const openConfirm = useCallback((title: string, message: string, confirmLabel: string, action: () => Promise<void>) => {
    setConfirmState({ visible: true, title, message, confirmLabel, action });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState({ visible: false, title: '', message: '', confirmLabel: t(K.common.confirm), action: null });
  }, [t]);

  const openPersonProfile = useCallback((person: PersonRecord) => {
    if (isMaidenViewerMode) {
      setViewerPerson(person);
      setViewerProfileTab('summary');
      setViewerPhotoIndex(null);
      return;
    }
    navigation.navigate('PersonProfile', {
      treeId: route.params.treeId,
      personId: person.id,
    });
  }, [isMaidenViewerMode, navigation, route.params.treeId]);

  const closePersonDialog = useCallback(() => {
    setPersonDialog({ visible: false, mode: 'create', person: null, initialPendingRelationships: [] });
  }, []);

  const closeAddPersonChooser = useCallback(() => {
    setAddPersonChooserVisible(false);
  }, []);

  const closeNodeQuickActions = useCallback(() => {
    setNodeQuickActionState({ visible: false, person: null });
  }, []);
  const closeViewerPersonDialog = useCallback(() => {
    setViewerPerson(null);
    setViewerProfileTab('summary');
    setViewerPhotoIndex(null);
  }, []);
  const closeMaidenMembersModal = useCallback(() => {
    setMaidenMembersVisible(false);
  }, []);

  const handleMaidenParentSelectionAttempt = useCallback(async (mode: PendingRelationshipMode, relatedPerson: PersonRecord) => {
    if (mode !== 'parent-of' || !relatedPerson.maidenName?.trim() || !user?.id || !selectedTree) {
      return true;
    }

    const relatedTreeCandidates = await findMaidenTreeCandidates(
      relatedPerson,
      trees,
      (searchTerm) => searchDiscoverableTrees(searchTerm, user.id),
      selectedTree.id,
    );

    if (relatedTreeCandidates.length > 0) {
      setMaidenTreeSuggestion({
        visible: true,
        person: relatedPerson,
        relatedTreeCandidates,
        pendingRelationships: [{ mode, relatedPersonId: relatedPerson.id }],
      });
      return false;
    }

    return true;
  }, [searchDiscoverableTrees, selectedTree, trees, user?.id]);

  const openCreateRelativeDialog = useCallback((mode: PendingRelationshipSubmission['mode'], relatedPerson: PersonRecord) => {
    setNodeQuickActionState({ visible: false, person: null });

    void (async () => {
      const shouldContinue = await handleMaidenParentSelectionAttempt(mode, relatedPerson);
      if (!shouldContinue) {
        return;
      }

      setPersonDialog({
        visible: true,
        mode: 'create',
        person: null,
        initialPendingRelationships: [{ mode, relatedPersonId: relatedPerson.id }],
      });
    })();
  }, [handleMaidenParentSelectionAttempt]);

  const closeMaidenTreeSuggestion = useCallback(() => {
    setMaidenTreeSuggestion({
      visible: false,
      person: null,
      relatedTreeCandidates: [],
      pendingRelationships: [],
    });
  }, []);

  const openMaidenTreeCandidate = useCallback((treeId: string) => {
    const targetTree = trees.find((tree) => tree.id === treeId);
    if (!targetTree || !selectedTree) {
      return;
    }

    closeMaidenTreeSuggestion();
    navigation.navigate('TreeDetail', {
      treeId: targetTree.id,
      initialTab: 'VisualisationTab',
      returnTreeId: selectedTree.id,
    });
  }, [closeMaidenTreeSuggestion, navigation, selectedTree, trees]);

  const requestMaidenTreeAccess = useCallback(async (treeId: string) => {
    if (!user?.id) {
      return;
    }

    await requestTreeAccess(user.id, treeId);
    closeMaidenTreeSuggestion();
  }, [closeMaidenTreeSuggestion, requestTreeAccess, user?.id]);
  const confirmAction = confirmState.action;

  const handleConfirm = useCallback(async () => {
    if (!confirmAction) {
      return;
    }

    try {
      await confirmAction();
      closeConfirm();
    } catch {
      // surfaced by store snackbar
    }
  }, [closeConfirm, confirmAction]);

  const handleOpenMaidenFamilyTree = useCallback((person: PersonRecord, maidenSurname: string, maritalSurname: string, isViewingMaiden: boolean) => {
    if (!selectedTree) {
      return;
    }

    const targetSurname = isViewingMaiden ? maritalSurname : maidenSurname;
    const linkedTree = findConnectedTreeForSurname(person, targetSurname, selectedTree, trees);
    closeNodeQuickActions();

    if (linkedTree) {
      navigation.push('TreeDetail', {
        treeId: linkedTree.id,
        initialTab: 'VisualisationTab',
        returnTreeId: selectedTree.id,
      });
      return;
    }

    if (isViewingMaiden) {
      canvasFamilySwitchRef.current?.(targetSurname);
      return;
    }

    if (!user) {
      return;
    }

    openConfirm(
      t(K.relationship.createMaidenFamilyTreeTitle, { surname: maidenSurname }),
      t(K.relationship.createMaidenFamilyTreeMessage, { surname: maidenSurname }),
      t(K.treeSettings.createTree),
      async () => {
        const createdTree = await createTreeFromSurname(
          { id: user.id, email: user.email, displayName: user.displayName },
          selectedTree.id,
          maidenSurname,
        );
        navigation.push('TreeDetail', {
          treeId: createdTree.id,
          initialTab: 'VisualisationTab',
          returnTreeId: selectedTree.id,
        });
      },
    );
  }, [canvasFamilySwitchRef, closeNodeQuickActions, createTreeFromSurname, navigation, openConfirm, selectedTree, t, trees, user]);

  const handleCollaboratorSubmit = useCallback(async ({ email, role: collaboratorRole }: { email: string; role: CollaboratorRole }) => {
    if (!selectedTree || !user?.id) {
      return;
    }

    try {
      await addCollaborator(user.id, selectedTree.id, email, collaboratorRole);
      setCollaboratorDialogVisible(false);
    } catch {
      // surfaced by store snackbar
    }
  }, [addCollaborator, selectedTree, user?.id]);

  const createPersonFromPayload = useCallback(async (payload: PersonFormSubmission) => {
    return createPersonFromFormSubmission({
      addParentChildRelationship,
      addSpouseRelationship,
      createPerson,
      createPersonWithRelationships,
      peopleForValidation: people,
      relationshipsForValidation: relationships,
      selectedTree,
      userId: user?.id,
    }, payload);
  }, [addParentChildRelationship, addSpouseRelationship, createPerson, createPersonWithRelationships, people, relationships, selectedTree, user?.id]);

  const createSelfPersonFromPayload = useCallback(async (payload: PersonFormSubmission) => {
    return createPersonFromFormSubmission({
      addParentChildRelationship,
      addSpouseRelationship,
      createPerson,
      createPersonWithRelationships,
      peopleForValidation: people,
      relationshipsForValidation: relationships,
      selectedTree,
      options: {
        forceImmediateApproval: true,
      },
      userId: user?.id,
    }, payload);
  }, [addParentChildRelationship, addSpouseRelationship, createPerson, createPersonWithRelationships, people, relationships, selectedTree, user?.id]);

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
      const createdPerson = await createSelfPersonFromPayload(payload);
      if (createdPerson) {
        await assignPersonToUser(user.id, selectedTree.id, user.id, createdPerson.id);
        setFollowUpTreePromptsPending(true);
      }
      setSelfPersonDialogVisible(false);
    } catch {
      // surfaced by store snackbar
    }
  }, [assignPersonToUser, createSelfPersonFromPayload, selectedTree, user?.id]);

  const selfPersonInitialValues = useMemo(
    () => buildSelfPersonInitialValues(user),
    [user],
  );

  const closeSelfPersonDialog = useCallback(() => {
    setSelfPersonDialogVisible(false);
  }, []);

  const handleAssignPersonToUser = useCallback(async (targetUserId: string, personId: string) => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      await assignPersonToUser(user.id, selectedTree.id, targetUserId, personId);
      if (targetUserId === user.id) {
        setFollowUpTreePromptsPending(true);
      }
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
    relationshipStatus,
    parentChildKind,
  }: {
    type: 'parent-child' | 'spouse';
    fromPersonId: string;
    toPersonId: string;
    relationshipStatus?: SpouseRelationshipStatus;
    parentChildKind?: ParentChildRelationshipKind;
  }) => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      if (type === 'spouse') {
        await addSpouseRelationship(user.id, selectedTree.id, fromPersonId, toPersonId, relationshipStatus);
      } else {
        await addParentChildRelationship(user.id, selectedTree.id, fromPersonId, toPersonId, parentChildKind);
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

  const openCreatePersonDialog = useCallback((initialPendingRelationships: PendingRelationshipSubmission[] = []) => setPersonDialog({
    visible: true,
    mode: 'create',
    person: null,
    initialPendingRelationships,
  }), []);

  const onOpenAddPerson = useCallback(() => {
    if (people.length === 0) {
      openCreatePersonDialog();
      return;
    }

    setAddPersonChooserVisible(true);
  }, [openCreatePersonDialog, people.length]);
  const handleAddPersonEntrySelection = useCallback((mode: PendingRelationshipMode, relatedPerson: PersonRecord) => {
    setAddPersonChooserVisible(false);
    openCreatePersonDialog(
      [{
        mode,
        relatedPersonId: relatedPerson.id,
        parentChildKind: mode === 'spouse-of' ? undefined : DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
        relationshipStatus: mode === 'spouse-of' ? 'partner' : undefined,
      }],
    );
  }, [openCreatePersonDialog]);
  const onOpenAddPersonForRelationship = useCallback((mode: PendingRelationshipMode, relatedPerson: PersonRecord) => {
    openCreatePersonDialog([
      {
        mode,
        relatedPersonId: relatedPerson.id,
        parentChildKind: mode === 'spouse-of' ? undefined : DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
        relationshipStatus: mode === 'spouse-of' ? 'partner' : undefined,
      },
    ]);
  }, [openCreatePersonDialog]);
  const handleAddFirstFamilyMember = useCallback(() => {
    setAddPersonChooserVisible(false);
    openCreatePersonDialog();
  }, [openCreatePersonDialog]);
  const onOpenRelationshipDialog = useCallback(() => setRelationshipDialogVisible(true), []);
  const onOpenPersonQuickActions = useCallback((person: PersonRecord) => {
    if (isMaidenViewerMode) {
      setViewerPerson(person);
      setViewerProfileTab('summary');
      setViewerPhotoIndex(null);
      return;
    }

    setNodeQuickActionState({ visible: true, person });
  }, [isMaidenViewerMode]);
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
    if (!selectedTree || !user?.id) return;
    await removeCollaborator(user.id, selectedTree.id, collaboratorUserId);
  }, [removeCollaborator, selectedTree, user?.id]);
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
  const onSetTreeDiscoverability = useCallback(async (discoverable: boolean) => {
    if (!selectedTree) return;
    await setTreeDiscoverability(selectedTree.id, discoverable);
  }, [selectedTree, setTreeDiscoverability]);
  const onSetSurnameVariantGroups = useCallback(async (groups: SharedTabProps['selectedTree']['surnameVariantGroups']) => {
    if (!selectedTree) return;
    await setSurnameVariantGroups(selectedTree.id, groups);
  }, [selectedTree, setSurnameVariantGroups]);
  const onCreateMergeRequest = useCallback(async (sourceTreeId: string, targetTreeId: string) => {
    if (!user?.id || !sourceTreeId || !targetTreeId) return;
    await createMergeRequest(user.id, sourceTreeId, targetTreeId);
  }, [createMergeRequest, user?.id]);
  const onSendMergeInvite = useCallback(async (sourceTreeId: string, identifier: string) => {
    if (!user?.id || !sourceTreeId) return;
    await sendMergeInvite(user.id, sourceTreeId, identifier);
  }, [sendMergeInvite, user?.id]);
  const onRespondToMergeInvite = useCallback(async (notificationId: string, status: 'accepted' | 'dismissed') => {
    if (!user?.id) return;
    await respondToMergeInvite(user.id, notificationId, status);
  }, [respondToMergeInvite, user?.id]);
  const onRequestTreeAccess = useCallback(async (treeId: string) => {
    if (!user?.id) return;
    await requestTreeAccess(user.id, treeId);
  }, [requestTreeAccess, user?.id]);
  const onRequestTreeAccessByIdentifier = useCallback(async (identifier: string) => {
    if (!user?.id) return;
    await requestTreeAccessByIdentifier(user.id, identifier);
  }, [requestTreeAccessByIdentifier, user?.id]);
  const onRespondToTreeAccessRequest = useCallback(async (notificationId: string, status: 'accepted' | 'rejected') => {
    if (!user?.id) return;
    await respondToTreeAccessRequest(user.id, notificationId, status);
  }, [respondToTreeAccessRequest, user?.id]);
  const onSearchDiscoverableTrees = useCallback(async (searchTerm: string) => {
    if (!user?.id) return [];
    return searchDiscoverableTrees(searchTerm, user.id);
  }, [searchDiscoverableTrees, user?.id]);
  const onSearchDiscoverableTreesByUsername = useCallback(async (username: string) => {
    if (!user?.id) return [];
    return searchDiscoverableTreesByUsername(username, user.id);
  }, [searchDiscoverableTreesByUsername, user?.id]);
  const onMarkNotificationSeen = useCallback(async (notificationId: string) => {
    if (!user?.id) return;
    await markNotificationSeen(user.id, notificationId);
  }, [markNotificationSeen, user?.id]);
  const onMarkNotificationOpened = useCallback(async (notificationId: string) => {
    if (!user?.id) return;
    await markNotificationOpened(user.id, notificationId);
  }, [markNotificationOpened, user?.id]);
  const onMarkNotificationActivityActioned = useCallback(async (sourceKind: 'approval' | 'merge-request' | 'merge-history' | 'membership', sourceId: string) => {
    if (!user?.id) return;
    await markNotificationActivityActioned(user.id, sourceKind, sourceId);
  }, [markNotificationActivityActioned, user?.id]);
  const onLoadTreeMergePreview = useCallback(async (sourceTreeId: string, targetTreeId: string) => {
    if (!sourceTreeId || !targetTreeId) return;
    await loadMergePreview(sourceTreeId, targetTreeId);
  }, [loadMergePreview]);
  const onApproveMergeRequest = useCallback(async (requestId: string, comment?: string, selectedMatchIds?: string[]) => {
    if (!user?.id) return;
    await approveMergeRequest(user.id, requestId, comment, selectedMatchIds);
  }, [approveMergeRequest, user?.id]);
  const onRejectMergeRequest = useCallback(async (requestId: string, comment?: string) => {
    if (!user?.id) return;
    await rejectMergeRequest(user.id, requestId, comment);
  }, [rejectMergeRequest, user?.id]);
  const onRequestMergeChanges = useCallback(async (requestId: string, comment?: string, selectedMatchIds?: string[]) => {
    if (!user?.id) return;
    await requestMergeChanges(user.id, requestId, comment, selectedMatchIds);
  }, [requestMergeChanges, user?.id]);
  const onUndoMerge = useCallback(async (requestId: string) => {
    if (!user?.id) return;
    await undoMerge(user.id, requestId);
  }, [undoMerge, user?.id]);
  const onGrantMergeViewerAccess = useCallback(async (requestId: string, treeId: string) => {
    if (!user?.id) return;
    await grantMergeViewerAccess(user.id, requestId, treeId);
  }, [grantMergeViewerAccess, user?.id]);
  const onCreateSurnameTree = useCallback(async (surname: string) => {
    if (!user || !selectedTree) return;
    await createTreeFromSurname({ id: user.id, email: user.email, displayName: user.displayName }, selectedTree.id, surname);
  }, [createTreeFromSurname, selectedTree, user]);
  const onOpenTreeSettingsTarget = useCallback((target: Omit<NonNullable<TreeSettingsFocus>, 'token'>) => {
    setTreeSettingsFocus({ ...target, token: Date.now() });
  }, []);

  const sharedTabProps: SharedTabProps | null = useMemo(() => {
    if (!selectedTree) return null;
    return {
      selectedTree,
      people,
      relationships,
      approvalRequests,
      mergeRequests,
      mergeHistory,
      mergePreview,
      peopleById,
      canEdit,
      isOwner,
      role,
      userId: user?.id,
      currentUserLabel,
      currentAssignedPerson,
      currentSelfAssignmentSuggestions,
      followUpTreePromptsPending,
      availableSelfLinkPeople,
      notifications,
      notificationActivityStates,
      assignedPersonByUserId,
      assignedUserIdByPersonId,
      canCreateSelfProfile: canEdit,
      mutating,
      loadingTreeData,
      openConfirm,
      openPersonProfile,
      onOpenAddPerson,
      onOpenAddPersonForRelationship,
      onOpenRelationshipDialog,
      onOpenPersonQuickActions,
      onOpenCollaboratorDialog,
      onOpenAddSelf,
      onConsumeFollowUpTreePrompts: () => setFollowUpTreePromptsPending(false),
      onEditPerson,
      onDeletePerson,
      onRemoveCollaborator,
      onAssignPersonToUser: handleAssignPersonToUser,
      onClearSelfAssignment: handleClearSelfAssignment,
      onApproveApprovalRequest,
      onRejectApprovalRequest,
      onSetTreeDiscoverability,
      onSetApprovalWindowHours,
      onSetSurnameVariantGroups,
      onCreateMergeRequest,
      onSendMergeInvite,
      onRespondToMergeInvite,
      onRequestTreeAccess,
      onRequestTreeAccessByIdentifier,
      onRespondToTreeAccessRequest,
      onSearchDiscoverableTrees,
      onSearchDiscoverableTreesByUsername,
      onMarkNotificationSeen,
      onMarkNotificationOpened,
      onMarkNotificationActivityActioned,
      onLoadMergePreview: onLoadTreeMergePreview,
      onApproveMergeRequest,
      onRejectMergeRequest,
      onRequestMergeChanges,
      onUndoMerge,
      onGrantMergeViewerAccess,
      onCreateSurnameTree,
      treeSettingsFocus,
      onOpenTreeSettingsTarget,
      familySwitchRef: canvasFamilySwitchRef,
      activeFamilyRef: canvasActiveFamilyRef,
    };
  }, [
    selectedTree, people, relationships, approvalRequests, mergeRequests, mergeHistory, mergePreview, peopleById, canEdit, isOwner, role,
    user?.id, currentUserLabel, currentAssignedPerson, currentSelfAssignmentSuggestions,
    followUpTreePromptsPending, availableSelfLinkPeople, notifications, notificationActivityStates, assignedPersonByUserId, assignedUserIdByPersonId, mutating, loadingTreeData,
    openConfirm, openPersonProfile, onOpenAddPerson, onOpenAddPersonForRelationship, onOpenRelationshipDialog, onOpenPersonQuickActions,
    onOpenCollaboratorDialog, onOpenAddSelf, onEditPerson, onDeletePerson, onRemoveCollaborator,
    handleAssignPersonToUser, handleClearSelfAssignment, onApproveApprovalRequest, onRejectApprovalRequest,
    onSetTreeDiscoverability, onSetApprovalWindowHours, onSetSurnameVariantGroups, onCreateMergeRequest, onSendMergeInvite, onRespondToMergeInvite, onRequestTreeAccess, onRequestTreeAccessByIdentifier, onRespondToTreeAccessRequest, onSearchDiscoverableTrees, onSearchDiscoverableTreesByUsername, onMarkNotificationSeen, onMarkNotificationOpened, onMarkNotificationActivityActioned, onLoadTreeMergePreview,
    onApproveMergeRequest, onRejectMergeRequest, onRequestMergeChanges, onUndoMerge, onGrantMergeViewerAccess, onCreateSurnameTree, treeSettingsFocus, onOpenTreeSettingsTarget,
    canvasFamilySwitchRef, canvasActiveFamilyRef,
  ]);

  if (!selectedTree || !sharedTabProps) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (isMaidenViewerMode) {
    return (
      <TreeDetailMaidenViewer
        theme={theme}
        t={t}
        returnTreeName={returnTree?.name ?? null}
        sharedTabContent={<VisualisationTabContent {...sharedTabProps} />}
        canvasActiveFamilyRef={canvasActiveFamilyRef}
        canvasFamilySwitchRef={canvasFamilySwitchRef}
        maidenMembersVisible={maidenMembersVisible}
        setMaidenMembersVisible={setMaidenMembersVisible}
        maidenMemberSearchQuery={maidenMemberSearchQuery}
        setMaidenMemberSearchQuery={setMaidenMemberSearchQuery}
        filteredMaidenViewerPeople={filteredMaidenViewerPeople}
        paginatedMaidenViewerPeople={paginatedMaidenViewerPeople}
        maidenMembersPage={maidenMembersPage}
        maidenMembersTotalPages={maidenMembersTotalPages}
        setMaidenMembersPage={setMaidenMembersPage}
        viewerPerson={viewerPerson}
        setViewerPerson={setViewerPerson}
        viewerPersonPreferredPhoto={viewerPersonPreferredPhoto}
        viewerProfileTab={viewerProfileTab}
        setViewerProfileTab={setViewerProfileTab}
        viewerRelationshipInsight={viewerRelationshipInsight}
        returnTreeAssignedPerson={returnTreeAssignedPerson}
        viewerTimeline={viewerTimeline}
        viewerPhotoIndex={viewerPhotoIndex}
        setViewerPhotoIndex={setViewerPhotoIndex}
        closeMaidenMembersModal={closeMaidenMembersModal}
        closeViewerPersonDialog={closeViewerPersonDialog}
        navigationGoBack={() => navigation.goBack()}
      />
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
          tabBarStyle: [
            styles.tabBar,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.outlineVariant,
              paddingBottom: bottomInset,
              height: styles.tabBar.height + bottomInset,
            },
          ],
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
        <Tab.Screen name="PeopleRelationshipsTab" options={{ title: t(K.tree.familyMembers.title) }}>
          {() => <PeopleRelationshipsTabContent {...sharedTabProps} />}
        </Tab.Screen>
        <Tab.Screen name="VisualisationTab" options={{ title: t(K.navigation.tree) }}>
          {() => <VisualisationTabContent {...sharedTabProps} />}
        </Tab.Screen>
        <Tab.Screen name="ProfileTab" options={{ title: t(K.navigation.profile) }}>
          {() => <TreeSettingsTabContent {...sharedTabProps} />}
        </Tab.Screen>
        <Tab.Screen
          name="HomeTab"
          options={{ title: t(K.navigation.home) }}
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
        visible={collaboratorDialogVisible && !isSharedLoaderVisible}
        loading={mutating}
        onDismiss={() => setCollaboratorDialogVisible(false)}
        onSubmit={handleCollaboratorSubmit}
      />

      <AddPersonEntryDialog
        visible={addPersonChooserVisible && !isSharedLoaderVisible}
        hasExistingFamilyMembers={people.length > 0}
        relationshipCandidates={people}
        relationships={relationships}
        perspective="new-person"
        onDismiss={closeAddPersonChooser}
        onSelectRelationship={handleAddPersonEntrySelection}
        onSelectRelationshipAttempt={handleMaidenParentSelectionAttempt}
        onAddFirstFamilyMember={handleAddFirstFamilyMember}
      />

      <PersonFormDialog
        visible={personDialog.visible && !isSharedLoaderVisible}
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
        onSelectRelationshipAttempt={handleMaidenParentSelectionAttempt}
      />

      <PersonFormDialog
        visible={selfPersonDialogVisible && !isSharedLoaderVisible}
        mode="create"
        initialValues={selfPersonInitialValues}
        loading={mutating}
        existingLastNames={existingLastNames}
        relationshipCandidates={people}
        onDismiss={closeSelfPersonDialog}
        onSubmit={handleSelfPersonSubmit}
      />

      <RelationshipDialog
        visible={relationshipDialogVisible && !isSharedLoaderVisible}
        people={people}
        relationships={relationships}
        loading={mutating}
        onDismiss={() => setRelationshipDialogVisible(false)}
        onSubmit={handleRelationshipSubmit}
      />

      <TreeDetailNodeQuickActionsDialog
        visible={nodeQuickActionState.visible && !isSharedLoaderVisible}
        person={nodeQuickActionState.person}
        theme={theme}
        t={t}
        canEdit={canEdit}
        mutating={mutating}
        closeNodeQuickActions={closeNodeQuickActions}
        openPersonProfile={openPersonProfile}
        openCreateRelativeDialog={openCreateRelativeDialog}
        crossSurnameChildIds={crossSurnameChildIds}
        canvasActiveFamilyRef={canvasActiveFamilyRef}
        canvasFamilySwitchRef={canvasFamilySwitchRef}
        onOpenMaidenFamilyTree={handleOpenMaidenFamilyTree}
      />

      <MaidenTreeSuggestionDialog
        visible={maidenTreeSuggestion.visible && !isSharedLoaderVisible}
        surname={maidenTreeSuggestion.person?.maidenName?.trim() ?? ''}
        candidates={maidenTreeSuggestion.relatedTreeCandidates}
        theme={theme}
        t={t}
        onDismiss={closeMaidenTreeSuggestion}
        onOpenTree={openMaidenTreeCandidate}
        onRequestAccess={requestMaidenTreeAccess}
      />

      <ConfirmDialog
        visible={confirmState.visible && !isSharedLoaderVisible}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        loading={mutating}
        onDismiss={closeConfirm}
        onConfirm={handleConfirm}
      />

      <SharedLoader visible={isSharedLoaderVisible} />

      <FloatingSnackbar
        visible={snackVisible}
        onDismiss={() => {
          setSnackVisible(false);
          clearError();
          clearNotice();
        }}
        duration={5000}
        action={{
          label: t(K.common.dismiss),
          onPress: () => {
            setSnackVisible(false);
            clearError();
            clearNotice();
          },
        }}
      >
        {error ?? notice}
      </FloatingSnackbar>
    </View>
  );
}
