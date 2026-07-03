import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import type { PersonFormSubmission, PendingRelationshipMode, PendingRelationshipSubmission } from '../../../components/person-form-dialog';
import type { PersonRecord } from '../../../components/dto/person';
import type { RootStackParamList } from '../../../components/dto/navigation';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, type ParentChildRelationshipKind, type SpouseRelationshipStatus } from '../../../components/dto/relationship';
import { getUserDisplayLabel } from '../../../components/dto/user';
import { formatPersonName } from '../../../components/person-formatting';
import { findCrossSurnameChildren } from '../../../components/family-tree-surname-clusters';
import {
  canSetDefaultTree,
  canEditTreeContent,
  canManageTree,
  getTreeRole,
  treeNeedsDiscoverabilityChoice,
  type CollaboratorRole,
  type FamilyTree,
} from '../../../components/dto/tree';
import { useI18n } from '../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../i18n/keys';
import { useAuthStore } from '../../../stores/auth-store';
import { useTreeStore } from '../../../stores/tree-store';
import { useShallow } from 'zustand/react/shallow';
import { getTreeDeletionImpact, type DiscoverableTreeSummary } from '../../../providers/family-tree-service';
import type { SharedTabProps } from '../tree-tab-content';
import {
  buildSelfAssignmentSuggestions,
  buildPeopleDirectory,
  buildTreeAssignmentContext,
  getActivityNotificationCount,
  getTreeById,
} from '../tree-tabs/shared';
import {
  buildSelfPersonInitialValues,
  createPersonFromFormSubmission,
  findConnectedTreeForSurname,
  findMaidenTreeCandidates,
  type MaidenTreeSuggestionCandidate,
} from '../tree-screen-helpers';
import { CURRENT_APP_VERSION } from '../../../constants/app-metadata';
import { getCurrentReleaseNote } from '../../../constants/release-notes';
import type { AppLanguage } from '../../../i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

export type PersonDialogState = {
  visible: boolean;
  mode: 'create' | 'edit';
  person: PersonRecord | null;
  initialPendingRelationships: PendingRelationshipSubmission[];
};

export type NodeQuickActionState = {
  visible: boolean;
  person: PersonRecord | null;
};

export type ConfirmState = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  action: (() => Promise<void>) | null;
};

export type TreeDialogState = {
  visible: boolean;
  mode: 'create' | 'edit';
  tree: FamilyTree | null;
};

export type TreeSettingsFocus = {
  tab: 'approvals' | 'merges';
  itemId: string;
  mode: 'approval' | 'merge';
  token: number;
} | null;

export type PriorityAlertState = {
  id: string;
  kind: 'merge-invite' | 'tree-access-request' | 'tree-access-response' | 'merge-request' | 'merge-history';
  title: string;
  message: string;
  createdAt: string;
  status?: string;
  notificationId?: string;
  sourceKind?: 'merge-request' | 'merge-history';
  sourceId?: string;
  requestId?: string;
  seen?: boolean;
  opened?: boolean;
};

export type TreeNameSuggestionState = {
  visible: boolean;
  requestedName: string;
  matches: DiscoverableTreeSummary[];
};

export type MaidenTreeSuggestionState = {
  visible: boolean;
  person: PersonRecord | null;
  relatedTreeCandidates: MaidenTreeSuggestionCandidate[];
  pendingRelationships: PendingRelationshipSubmission[];
};

type MemberProfileParams = {
  treeId: string;
  personId: string;
};

const MAIN_TAB_NAMES = ['home', 'tree', 'members', 'treeSettings', 'myProfile'] as const;

function isMainTabName(name: string): name is typeof MAIN_TAB_NAMES[number] {
  return (MAIN_TAB_NAMES as readonly string[]).includes(name);
}

export function useMainScreenController({ navigation }: Props) {
  const isFocused = useIsFocused();
  const theme = useTheme();
  const { t, language, setLanguage } = useI18n();
  const currentReleaseNote = useMemo(() => getCurrentReleaseNote(), []);
  const {
    user,
    signOut,
    loading: authLoading,
    setDefaultTreeId,
    updatePreferredLanguage,
    markAppVersionSeen,
    markDiscoverabilityPromptSeen,
  } = useAuthStore();
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
    createTree,
    createTreeFromSurname,
    renameTree,
    setTreeDiscoverability,
    removeTree,
    assignPersonToUser,
    clearSelfAssignment,
    updatePerson,
    removePerson,
    addParentChildRelationship,
    addSpouseRelationship,
    approveApprovalRequest,
    rejectApprovalRequest,
    setApprovalWindowHours,
    setSurnameVariantGroups,
    createMergeRequest,
    sendMergeInvite,
    requestTreeAccess,
    requestTreeAccessByIdentifier,
    cancelTreeAccessRequest,
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
    createTree: state.createTree,
    createTreeFromSurname: state.createTreeFromSurname,
    renameTree: state.renameTree,
    setTreeDiscoverability: state.setTreeDiscoverability,
    removeTree: state.removeTree,
    assignPersonToUser: state.assignPersonToUser,
    clearSelfAssignment: state.clearSelfAssignment,
    updatePerson: state.updatePerson,
    removePerson: state.removePerson,
    addParentChildRelationship: state.addParentChildRelationship,
    addSpouseRelationship: state.addSpouseRelationship,
    approveApprovalRequest: state.approveApprovalRequest,
    rejectApprovalRequest: state.rejectApprovalRequest,
    setApprovalWindowHours: state.setApprovalWindowHours,
    setSurnameVariantGroups: state.setSurnameVariantGroups,
    createMergeRequest: state.createMergeRequest,
    sendMergeInvite: state.sendMergeInvite,
    requestTreeAccess: state.requestTreeAccess,
    requestTreeAccessByIdentifier: state.requestTreeAccessByIdentifier,
    cancelTreeAccessRequest: state.cancelTreeAccessRequest,
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
  const [nodeQuickActionState, setNodeQuickActionState] = useState<NodeQuickActionState>({ visible: false, person: null });
  const [treeDialog, setTreeDialog] = useState<TreeDialogState>({ visible: false, mode: 'create', tree: null });
  const [treeSettingsFocus, setTreeSettingsFocus] = useState<TreeSettingsFocus>(null);
  const [followUpTreePromptsPending, setFollowUpTreePromptsPending] = useState(false);
  const [memberProfileParams, setMemberProfileParams] = useState<MemberProfileParams | null>(null);
  const [snackVisible, setSnackVisible] = useState(false);
  const [startupModalSubmitting, setStartupModalSubmitting] = useState(false);
  const [priorityAlert, setPriorityAlert] = useState<PriorityAlertState | null>(null);
  const [treeNameSuggestion, setTreeNameSuggestion] = useState<TreeNameSuggestionState>({
    visible: false,
    requestedName: '',
    matches: [],
  });
  const [maidenTreeSuggestion, setMaidenTreeSuggestion] = useState<MaidenTreeSuggestionState>({
    visible: false,
    person: null,
    relatedTreeCandidates: [],
    pendingRelationships: [],
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: t(K.common.confirm),
    action: null,
  });
  const dismissedPriorityAlertIdsRef = useRef(new Set<string>());

  const selectedTree = useMemo(
    () => getTreeById(trees, selectedTreeId),
    [selectedTreeId, trees],
  );

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

  const notificationBadgeCount = useMemo(() => {
    return getActivityNotificationCount({
      approvalRequests,
      mergeRequests,
      mergeHistory,
      notifications,
      notificationActivityStates,
      trees,
      userId: user?.id,
    });
  }, [approvalRequests, mergeHistory, mergeRequests, notificationActivityStates, notifications, trees, user?.id]);

  const availableSelfLinkPeople = useMemo(
    () => people
      .filter((person) => {
        const assignedUserId = assignedUserIdByPersonId.get(person.id);
        return !assignedUserId || assignedUserId === user?.id;
      })
      .sort((left, right) => formatPersonName(left).localeCompare(formatPersonName(right))),
    [assignedUserIdByPersonId, people, user?.id],
  );

  const role = selectedTree ? getTreeRole(selectedTree, user?.id) : null;
  const isOwner = selectedTree ? canManageTree(selectedTree, user?.id) : false;
  const canEdit = selectedTree ? canEditTreeContent(selectedTree, user?.id) : false;
  const selfInitialValues = useMemo(() => buildSelfPersonInitialValues(user), [user]);

  const hasAutoSelectedRef = useRef(false);
  const canvasFamilySwitchRef = useRef<((surname: string) => void) | null>(null);
  const canvasActiveFamilyRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadingTrees || selectedTreeId || hasAutoSelectedRef.current) {
      return;
    }

    const target = trees.find((tree) => tree.id === user?.defaultTreeId && canSetDefaultTree(tree, user?.id))
      ?? trees.find((tree) => canSetDefaultTree(tree, user?.id))
      ?? trees[0];

    if (target) {
      hasAutoSelectedRef.current = true;
      selectTree(target.id);
    }
  }, [loadingTrees, selectTree, selectedTreeId, trees, user?.defaultTreeId, user?.id]);

  useEffect(() => {
    hasAutoSelectedRef.current = false;
  }, [user?.id]);

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
  }, [isFocused, t]);

  useEffect(() => {
    if (!user?.preferredLanguage || user.preferredLanguage === language) {
      return;
    }

    void setLanguage(user.preferredLanguage);
  }, [language, setLanguage, user?.preferredLanguage]);

  const shouldShowLanguageModal = !user?.preferredLanguage;
  const shouldShowUpdateModal = !shouldShowLanguageModal
    && Boolean(user)
    && user.lastSeenAppVersion !== CURRENT_APP_VERSION;
  const ownedTreesNeedingDiscoverabilityChoice = useMemo(
    () => trees.filter((tree) => tree.ownerId === user?.id && tree.discoverable == null),
    [trees, user?.id],
  );
  const shouldShowDiscoverabilityPrompt = !shouldShowLanguageModal
    && !shouldShowUpdateModal
    && Boolean(user)
    && !user?.discoverabilityPromptSeenAt
    && ownedTreesNeedingDiscoverabilityChoice.length > 0;
  const shouldBlockPriorityAlerts = shouldShowLanguageModal
    || shouldShowUpdateModal
    || shouldShowDiscoverabilityPrompt;

  const handleStartupLanguageSubmit = useCallback(async (nextLanguage: AppLanguage) => {
    setStartupModalSubmitting(true);
    try {
      await setLanguage(nextLanguage);
      await updatePreferredLanguage(nextLanguage);
    } finally {
      setStartupModalSubmitting(false);
    }
  }, [setLanguage, updatePreferredLanguage]);

  const handleUpdateModalDismiss = useCallback(async () => {
    setStartupModalSubmitting(true);
    try {
      await markAppVersionSeen(CURRENT_APP_VERSION);
    } finally {
      setStartupModalSubmitting(false);
    }
  }, [markAppVersionSeen]);

  const handleDiscoverabilityPromptChoice = useCallback(async (discoverable: boolean) => {
    for (const tree of ownedTreesNeedingDiscoverabilityChoice) {
      await setTreeDiscoverability(tree.id, discoverable);
    }
    await markDiscoverabilityPromptSeen();
  }, [markDiscoverabilityPromptSeen, ownedTreesNeedingDiscoverabilityChoice, setTreeDiscoverability]);

  const openConfirm = useCallback((title: string, message: string, confirmLabel: string, action: () => Promise<void>) => {
    setConfirmState({ visible: true, title, message, confirmLabel, action });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState({ visible: false, title: '', message: '', confirmLabel: t(K.common.confirm), action: null });
  }, [t]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmState.action) {
      return;
    }

    try {
      await confirmState.action();
      closeConfirm();
    } catch {
      // surfaced via snackbar
    }
  }, [closeConfirm, confirmState.action]);

  const handleOpenMaidenFamilyTree = useCallback((person: PersonRecord, maidenSurname: string, maritalSurname: string, isViewingMaiden: boolean) => {
    if (!selectedTree) {
      return;
    }

    const targetSurname = isViewingMaiden ? maritalSurname : maidenSurname;
    const linkedTree = findConnectedTreeForSurname(person, targetSurname, selectedTree, trees);
    setNodeQuickActionState({ visible: false, person: null });

    if (linkedTree) {
      navigation.navigate('TreeDetail', {
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
        navigation.navigate('TreeDetail', {
          treeId: createdTree.id,
          initialTab: 'VisualisationTab',
          returnTreeId: selectedTree.id,
        });
      },
    );
  }, [canvasFamilySwitchRef, createTreeFromSurname, navigation, openConfirm, selectedTree, t, trees, user]);

  const openPersonProfile = useCallback((person: PersonRecord) => {
    if (!selectedTree) {
      return;
    }

    setMemberProfileParams({ treeId: selectedTree.id, personId: person.id });
    navigation.navigate('Main', { screen: 'members' });
  }, [navigation, selectedTree]);

  useEffect(() => {
    if (memberProfileParams && selectedTree?.id !== memberProfileParams.treeId) {
      setMemberProfileParams(null);
    }
  }, [memberProfileParams, selectedTree?.id]);

  const memberProfileNavigation = useMemo(() => ({
    canGoBack: () => true,
    getState: () => ({ type: 'tab' }),
    goBack: () => setMemberProfileParams(null),
    navigate: (name: string, params?: unknown) => {
      if (name === 'memberProfile' && params && typeof params === 'object') {
        const nextParams = params as Partial<MemberProfileParams>;
        if (nextParams.treeId && nextParams.personId) {
          setMemberProfileParams({ treeId: nextParams.treeId, personId: nextParams.personId });
        }
        return;
      }

      if (name === 'members') {
        setMemberProfileParams(null);
        return;
      }

      if (isMainTabName(name)) {
        navigation.navigate('Main', { screen: name });
      }
    },
    setOptions: () => {},
  }), [navigation]);

  const closePersonDialog = useCallback(() => {
    setPersonDialog({ visible: false, mode: 'create', person: null, initialPendingRelationships: [] });
  }, []);

  const closeAddPersonChooser = useCallback(() => {
    setAddPersonChooserVisible(false);
  }, []);

  const closeNodeQuickActions = useCallback(() => {
    setNodeQuickActionState({ visible: false, person: null });
  }, []);

  const closeSelfPersonDialog = useCallback(() => {
    setSelfPersonDialogVisible(false);
  }, []);

  const closeRelationshipDialog = useCallback(() => {
    setRelationshipDialogVisible(false);
  }, []);

  const closeCollaboratorDialog = useCallback(() => {
    setCollaboratorDialogVisible(false);
  }, []);

  const closeTreeDialog = useCallback(() => {
    setTreeDialog({ visible: false, mode: 'create', tree: null });
  }, []);

  const closeTreeNameSuggestion = useCallback(() => {
    setTreeNameSuggestion({ visible: false, requestedName: '', matches: [] });
  }, []);

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

  const handleMaidenParentSelectionAttempt = useCallback(async (mode: PendingRelationshipSubmission['mode'], relatedPerson: PersonRecord) => {
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

  const openCreateTreeDialog = useCallback(() => {
    setTreeDialog({ visible: true, mode: 'create', tree: null });
  }, []);

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

  const handleTreeDialogSubmit = useCallback(async (name: string) => {
    if (!user) {
      return;
    }

    try {
      if (treeDialog.mode === 'create') {
        const normalizedName = name.trim().toLowerCase();
        const discoverableMatches = (await searchDiscoverableTrees(name, user.id))
          .filter((candidate) => candidate.name.trim().toLowerCase() === normalizedName);

        if (discoverableMatches.length > 0) {
          closeTreeDialog();
          setTreeNameSuggestion({
            visible: true,
            requestedName: name,
            matches: discoverableMatches,
          });
          return;
        }

        const tree = await createTree({ id: user.id, email: user.email, displayName: user.displayName }, name);
        if (!user.defaultTreeId) {
          await setDefaultTreeId(tree.id);
        }
        selectTree(tree.id);
      } else if (treeDialog.tree) {
        await renameTree(treeDialog.tree.id, name);
      }

      closeTreeDialog();
    } catch {
      // surfaced via snackbar
    }
  }, [closeTreeDialog, createTree, renameTree, searchDiscoverableTrees, selectTree, setDefaultTreeId, treeDialog.mode, treeDialog.tree, user]);

  const continueCreatingSuggestedTree = useCallback(async () => {
    if (!user || !treeNameSuggestion.requestedName.trim()) {
      return;
    }

    try {
      const tree = await createTree(
        { id: user.id, email: user.email, displayName: user.displayName },
        treeNameSuggestion.requestedName.trim(),
      );
      if (!user.defaultTreeId) {
        await setDefaultTreeId(tree.id);
      }
      selectTree(tree.id);
      closeTreeNameSuggestion();
    } catch {
      // surfaced via snackbar
    }
  }, [closeTreeNameSuggestion, createTree, selectTree, setDefaultTreeId, treeNameSuggestion.requestedName, user]);

  const requestAccessToSuggestedTree = useCallback(async (treeId: string) => {
    if (!user?.id) {
      return;
    }

    try {
      await requestTreeAccess(user.id, treeId);
      closeTreeNameSuggestion();
    } catch {
      // surfaced via snackbar
    }
  }, [closeTreeNameSuggestion, requestTreeAccess, user?.id]);

  const handleToggleDefaultTree = useCallback(async (tree: FamilyTree) => {
    if (!user) {
      return;
    }

    const nextDefaultTreeId = user.defaultTreeId === tree.id ? null : tree.id;
    const linkedTree = nextDefaultTreeId
      ? trees.find((candidate) => candidate.id !== tree.id && Boolean(candidate.personAssignments[user.id]))
      : null;

    if (nextDefaultTreeId && linkedTree) {
      openConfirm(
        t(K.treeSettings.unlinkYourProfile),
        `You are still linked in "${linkedTree.name}". Unlink your profile there before making "${tree.name}" your default tree.`,
        t(K.common.unlink),
        async () => {
          await clearSelfAssignment(linkedTree.id, user.id);
          await setDefaultTreeId(tree.id);
          selectTree(tree.id);
        },
      );
      return;
    }

    try {
      await setDefaultTreeId(nextDefaultTreeId);
      if (nextDefaultTreeId) {
        selectTree(tree.id);
      }
    } catch {
      // ignored
    }
  }, [clearSelfAssignment, openConfirm, selectTree, setDefaultTreeId, t, trees, user]);

  const handleSwitchTree = useCallback((tree: FamilyTree) => {
    if (!user) {
      return;
    }

    const linkedTree = trees.find((candidate) => candidate.id !== tree.id && Boolean(candidate.personAssignments[user.id]));
    if (linkedTree) {
      openConfirm(
        t(K.treeSettings.unlinkYourProfile),
        `You are still linked in "${linkedTree.name}". Unlink your profile there before switching to "${tree.name}".`,
        t(K.common.unlink),
        async () => {
          await clearSelfAssignment(linkedTree.id, user.id);
          selectTree(tree.id);
        },
      );
      return;
    }

    selectTree(tree.id);
  }, [clearSelfAssignment, openConfirm, selectTree, t, trees, user]);

  const handleConfirmDeleteTree = useCallback((tree: FamilyTree) => {
    void (async () => {
      try {
        const impact = await getTreeDeletionImpact(tree.id);
        const details = [
          `Delete "${tree.name}" permanently?`,
          '',
          'This will also remove or disconnect:',
          `${impact.peopleDeleted} family member profile(s) that only exist in this tree`,
          `${impact.peopleDetached} shared family member profile(s) that will be removed from this tree but kept in other tree(s)`,
          `${impact.photosDeleted} photo(s) attached to profiles being permanently deleted`,
          `${impact.relationshipsDeleted} relationship record(s) in this tree`,
          `${impact.linkedProfilesRemoved} linked profile assignment(s) for this tree`,
          `${impact.collaboratorsRemoved} collaborator access record(s) on this tree`,
          `${impact.approvalRequestsDeleted} approval request(s) for this tree`,
          `${impact.mergeRequestsAffected} merge request record(s) involving this tree`,
          `${impact.mergeHistoryAffected} merge history record(s) involving this tree`,
          `${impact.connectedTreesDetached} connected tree link(s) to other family trees`,
          '',
          'This cannot be undone.',
        ].join('\n');

        openConfirm(
          t(K.app.deleteFamilyTree),
          details,
          t(K.common.delete),
          async () => {
            await removeTree(tree);
            if (user?.defaultTreeId === tree.id) {
              await setDefaultTreeId(null);
            }
          },
        );
      } catch {
        openConfirm(
          t(K.app.deleteFamilyTree),
          t(K.app.deleteFamilyTreeWithContents, { treeName: tree.name }),
          t(K.common.delete),
          async () => {
            await removeTree(tree);
            if (user?.defaultTreeId === tree.id) {
              await setDefaultTreeId(null);
            }
          },
        );
      }
    })();
  }, [openConfirm, removeTree, setDefaultTreeId, t, user?.defaultTreeId]);

  const handleCollaboratorSubmit = useCallback(async ({ email, role: collaboratorRole }: { email: string; role: CollaboratorRole }) => {
    if (!selectedTree) {
      return;
    }

    try {
      await addCollaborator(selectedTree.id, email, collaboratorRole);
      setCollaboratorDialogVisible(false);
    } catch {
      // snackbar
    }
  }, [addCollaborator, selectedTree]);

  const createPersonFromPayload = useCallback(async (payload: PersonFormSubmission) => createPersonFromFormSubmission({
    addParentChildRelationship,
    addSpouseRelationship,
    createPerson,
    selectedTree,
    userId: user?.id,
  }, payload), [addParentChildRelationship, addSpouseRelationship, createPerson, selectedTree, user?.id]);

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
      // snackbar
    }
  }, [closePersonDialog, createPersonFromPayload, personDialog.mode, personDialog.person, selectedTree, updatePerson, user?.id]);

  const handleSelfPersonSubmit = useCallback(async (payload: PersonFormSubmission) => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      const created = await createPersonFromPayload(payload);
      if (created) {
        await assignPersonToUser(user.id, selectedTree.id, user.id, created.id);
        setFollowUpTreePromptsPending(true);
      }
      setSelfPersonDialogVisible(false);
    } catch {
      // snackbar
    }
  }, [assignPersonToUser, createPersonFromPayload, selectedTree, user?.id]);

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
      // snackbar
    }
  }, [assignPersonToUser, selectedTree, user?.id]);

  const handleClearSelfAssignment = useCallback(async () => {
    if (!user?.id || !selectedTree) {
      return;
    }

    try {
      await clearSelfAssignment(selectedTree.id, user.id);
    } catch {
      // snackbar
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
      // snackbar
    }
  }, [addParentChildRelationship, addSpouseRelationship, selectedTree, user?.id]);

  const openCreatePersonDialog = useCallback((initialPendingRelationships: PendingRelationshipSubmission[] = []) => {
    setPersonDialog({
      visible: true,
      mode: 'create',
      person: null,
      initialPendingRelationships,
    });
  }, []);

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
      [{ mode, relatedPersonId: relatedPerson.id, parentChildKind: mode === 'spouse-of' ? undefined : DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND }],
    );
  }, [openCreatePersonDialog]);

  const handleAddFirstFamilyMember = useCallback(() => {
    setAddPersonChooserVisible(false);
    openCreatePersonDialog();
  }, [openCreatePersonDialog]);

  const onOpenRelationshipDialog = useCallback(() => {
    setRelationshipDialogVisible(true);
  }, []);

  const onOpenPersonQuickActions = useCallback((person: PersonRecord) => {
    setNodeQuickActionState({ visible: true, person });
  }, []);

  const onOpenCollaboratorDialog = useCallback(() => {
    setCollaboratorDialogVisible(true);
  }, []);

  const onOpenAddSelf = useCallback(() => {
    setSelfPersonDialogVisible(true);
  }, []);

  const onEditPerson = useCallback((person: PersonRecord) => {
    setPersonDialog({ visible: true, mode: 'edit', person, initialPendingRelationships: [] });
  }, []);

  const onDeletePerson = useCallback(async (person: PersonRecord) => {
    if (!user?.id) {
      return;
    }

    await removePerson(user.id, person);
  }, [removePerson, user?.id]);

  const onRemoveCollaborator = useCallback(async (userId: string) => {
    if (!selectedTree) {
      return;
    }

    await removeCollaborator(selectedTree.id, userId);
  }, [removeCollaborator, selectedTree]);

  const onSetApprovalWindowHours = useCallback(async (hours: number) => {
    if (!selectedTree) {
      return;
    }

    await setApprovalWindowHours(selectedTree.id, hours);
  }, [selectedTree, setApprovalWindowHours]);

  const onApproveApprovalRequest = useCallback(async (id: string) => {
    if (!user?.id) {
      return;
    }

    await approveApprovalRequest(user.id, id);
  }, [approveApprovalRequest, user?.id]);

  const onRejectApprovalRequest = useCallback(async (id: string) => {
    if (!user?.id) {
      return;
    }

    await rejectApprovalRequest(user.id, id);
  }, [rejectApprovalRequest, user?.id]);

  const onSetSurnameVariantGroups = useCallback(async (groups: SharedTabProps['selectedTree']['surnameVariantGroups']) => {
    if (!selectedTree) {
      return;
    }

    await setSurnameVariantGroups(selectedTree.id, groups);
  }, [selectedTree, setSurnameVariantGroups]);

  const onSetTreeDiscoverability = useCallback(async (discoverable: boolean) => {
    if (!selectedTree) {
      return;
    }

    await setTreeDiscoverability(selectedTree.id, discoverable);
  }, [selectedTree, setTreeDiscoverability]);

  const onCreateMergeRequest = useCallback(async (targetTreeId: string) => {
    if (!user?.id || !selectedTree) {
      return;
    }

    await createMergeRequest(user.id, selectedTree.id, targetTreeId);
  }, [createMergeRequest, selectedTree, user?.id]);

  const onSendMergeInvite = useCallback(async (sourceTreeId: string, identifier: string) => {
    if (!user?.id || !sourceTreeId) {
      return;
    }

    await sendMergeInvite(user.id, sourceTreeId, identifier);
  }, [sendMergeInvite, user?.id]);

  const onRespondToMergeInvite = useCallback(async (notificationId: string, status: 'accepted' | 'dismissed') => {
    if (!user?.id) {
      return;
    }

    await respondToMergeInvite(user.id, notificationId, status);
  }, [respondToMergeInvite, user?.id]);

  const onRequestTreeAccess = useCallback(async (treeId: string) => {
    if (!user?.id) {
      return;
    }

    await requestTreeAccess(user.id, treeId);
  }, [requestTreeAccess, user?.id]);

  const onRequestTreeAccessByIdentifier = useCallback(async (identifier: string) => {
    if (!user?.id) {
      return;
    }

    await requestTreeAccessByIdentifier(user.id, identifier);
  }, [requestTreeAccessByIdentifier, user?.id]);

  const onCancelTreeAccessRequest = useCallback(async (notificationId: string) => {
    if (!user?.id) {
      return;
    }

    await cancelTreeAccessRequest(user.id, notificationId);
  }, [cancelTreeAccessRequest, user?.id]);

  const onRespondToTreeAccessRequest = useCallback(async (notificationId: string, status: 'accepted' | 'rejected') => {
    if (!user?.id) {
      return;
    }

    await respondToTreeAccessRequest(user.id, notificationId, status);
  }, [respondToTreeAccessRequest, user?.id]);

  const onSearchDiscoverableTrees = useCallback(async (searchTerm: string) => {
    if (!user?.id) {
      return [];
    }

    return searchDiscoverableTrees(searchTerm, user.id);
  }, [searchDiscoverableTrees, user?.id]);

  const onSearchDiscoverableTreesByUsername = useCallback(async (username: string) => {
    if (!user?.id) {
      return [];
    }

    return searchDiscoverableTreesByUsername(username, user.id);
  }, [searchDiscoverableTreesByUsername, user?.id]);

  const onMarkNotificationSeen = useCallback(async (notificationId: string) => {
    if (!user?.id) {
      return;
    }

    await markNotificationSeen(user.id, notificationId);
  }, [markNotificationSeen, user?.id]);

  const onMarkNotificationOpened = useCallback(async (notificationId: string) => {
    if (!user?.id) {
      return;
    }

    await markNotificationOpened(user.id, notificationId);
  }, [markNotificationOpened, user?.id]);

  const onMarkNotificationActivityActioned = useCallback(async (sourceKind: 'approval' | 'merge-request' | 'merge-history' | 'membership', sourceId: string) => {
    if (!user?.id) {
      return;
    }

    await markNotificationActivityActioned(user.id, sourceKind, sourceId);
  }, [markNotificationActivityActioned, user?.id]);

  const onLoadTreeMergePreview = useCallback(async (targetTreeId: string) => {
    if (!selectedTree) {
      return;
    }

    await loadMergePreview(selectedTree.id, targetTreeId);
  }, [loadMergePreview, selectedTree]);

  const onApproveMergeRequest = useCallback(async (requestId: string, comment?: string, selectedMatchIds?: string[]) => {
    if (!user?.id) {
      return;
    }

    await approveMergeRequest(user.id, requestId, comment, selectedMatchIds);
  }, [approveMergeRequest, user?.id]);

  const onRejectMergeRequest = useCallback(async (requestId: string, comment?: string) => {
    if (!user?.id) {
      return;
    }

    await rejectMergeRequest(user.id, requestId, comment);
  }, [rejectMergeRequest, user?.id]);

  const onRequestMergeChanges = useCallback(async (requestId: string, comment?: string, selectedMatchIds?: string[]) => {
    if (!user?.id) {
      return;
    }

    await requestMergeChanges(user.id, requestId, comment, selectedMatchIds);
  }, [requestMergeChanges, user?.id]);

  const onUndoMerge = useCallback(async (requestId: string) => {
    if (!user?.id) {
      return;
    }

    await undoMerge(user.id, requestId);
  }, [undoMerge, user?.id]);

  const onGrantMergeViewerAccess = useCallback(async (requestId: string, treeId: string) => {
    if (!user?.id) {
      return;
    }

    await grantMergeViewerAccess(user.id, requestId, treeId);
  }, [grantMergeViewerAccess, user?.id]);

  const onCreateSurnameTree = useCallback(async (surname: string) => {
    if (!user || !selectedTree) {
      return;
    }

    await createTreeFromSurname({ id: user.id, email: user.email, displayName: user.displayName }, selectedTree.id, surname);
  }, [createTreeFromSurname, selectedTree, user]);

  const onOpenTreeSettingsTarget = useCallback((target: Omit<NonNullable<TreeSettingsFocus>, 'token'>) => {
    setTreeSettingsFocus({ ...target, token: Date.now() });
  }, []);

  const personDialogRelationshipCandidates = useMemo(
    () => people.filter((person) => person.id !== personDialog.person?.id),
    [people, personDialog.person?.id],
  );

  const currentSelfAssignmentSuggestions: SharedTabProps['currentSelfAssignmentSuggestions'] = useMemo(
    () => (currentAssignedPerson
      ? []
      : buildSelfAssignmentSuggestions(user, people, assignedUserIdByPersonId, user?.id)),
    [assignedUserIdByPersonId, currentAssignedPerson, people, user],
  );
  const pendingTreeAccessRequests = useMemo(
    () => notifications
      .filter((notification) => notification.type === 'tree-access-response' && notification.status === 'pending')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [notifications],
  );
  const pendingTreeAccessRequest = useMemo(
    () => pendingTreeAccessRequests[0] ?? null,
    [pendingTreeAccessRequests],
  );

  const importantPriorityAlerts = useMemo<PriorityAlertState[]>(() => {
    const actionedStateKeys = new Set(
      notificationActivityStates
        .filter((state) => Boolean(state.actionedAt))
        .map((state) => `${state.sourceKind}:${state.sourceId}`),
    );

    const directAlerts = notifications.flatMap<PriorityAlertState>((notification) => {
      if (notification.type === 'tree-access-request' && notification.status === 'pending') {
        return [{
          id: `priority-notification-${notification.id}`,
          kind: 'tree-access-request',
          title: t(K.notifications.treeAccessRequest),
          message: notification.message,
          createdAt: notification.createdAt,
          status: notification.status,
          notificationId: notification.id,
          seen: Boolean(notification.seenAt),
          opened: Boolean(notification.openedAt),
        }];
      }

      if (notification.type === 'tree-access-response' && (notification.status === 'accepted' || notification.status === 'rejected')) {
        if (notification.openedAt || notification.seenAt) {
          return [];
        }

        return [{
          id: `priority-notification-${notification.id}`,
          kind: 'tree-access-response',
          title: t(K.notifications.treeAccessUpdate),
          message: notification.message,
          createdAt: notification.createdAt,
          status: notification.status,
          notificationId: notification.id,
          seen: Boolean(notification.seenAt),
          opened: Boolean(notification.openedAt),
        }];
      }

      if (notification.type === 'merge-invite' && notification.status === 'pending') {
        return [{
          id: `priority-notification-${notification.id}`,
          kind: 'merge-invite',
          title: t(K.notifications.mergeInvitation),
          message: notification.message,
          createdAt: notification.createdAt,
          status: notification.status,
          notificationId: notification.id,
          seen: Boolean(notification.seenAt),
          opened: Boolean(notification.openedAt),
        }];
      }

      return [];
    });

    const mergeRequestAlerts = mergeRequests
      .filter((request) => !actionedStateKeys.has(`merge-request:${request.id}`))
      .map<PriorityAlertState>((request) => ({
        id: `priority-merge-request-${request.id}`,
        kind: 'merge-request',
        title: t(K.notifications.mergeRequest),
        message: `${request.preview.sourceTree.treeName} ↔ ${request.preview.targetTree.treeName}`,
        createdAt: request.updatedAt,
        status: request.status,
        sourceKind: 'merge-request',
        sourceId: request.id,
        requestId: request.id,
      }));

    const mergeHistoryAlerts = mergeHistory
      .filter((entry) => !actionedStateKeys.has(`merge-history:${entry.id}`))
      .map<PriorityAlertState>((entry) => ({
        id: `priority-merge-history-${entry.id}`,
        kind: 'merge-history',
        title: t(K.notifications.mergeActivity),
        message: entry.summary,
        createdAt: entry.updatedAt,
        status: entry.status,
        sourceKind: 'merge-history',
        sourceId: entry.id,
        requestId: entry.mergeRequestId,
      }));

    return [...directAlerts, ...mergeRequestAlerts, ...mergeHistoryAlerts]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [mergeHistory, mergeRequests, notificationActivityStates, notifications, t]);

  const sharedTabProps = useMemo((): SharedTabProps | null => {
    if (!selectedTree) {
      return null;
    }

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
      trees,
      defaultTreeId: user?.defaultTreeId,
      loadingTrees,
      onCreateTree: openCreateTreeDialog,
      onEditTree: (tree) => setTreeDialog({ visible: true, mode: 'edit', tree }),
      onConfirmDeleteTree: handleConfirmDeleteTree,
      onToggleDefaultTree: handleToggleDefaultTree,
      onSwitchTree: handleSwitchTree,
      familySwitchRef: canvasFamilySwitchRef,
      activeFamilyRef: canvasActiveFamilyRef,
    };
  }, [
    approvalRequests,
    assignedPersonByUserId,
    assignedUserIdByPersonId,
    availableSelfLinkPeople,
    canEdit,
    currentAssignedPerson,
    currentSelfAssignmentSuggestions,
    followUpTreePromptsPending,
    currentUserLabel,
    handleAssignPersonToUser,
    handleClearSelfAssignment,
    handleConfirmDeleteTree,
    handleSwitchTree,
    handleToggleDefaultTree,
    isOwner,
    loadMergePreview,
    loadingTreeData,
    loadingTrees,
    mergeHistory,
    mergePreview,
    mergeRequests,
    mutating,
    notificationActivityStates,
    notifications,
    onApproveApprovalRequest,
    onApproveMergeRequest,
    onCreateMergeRequest,
    onCreateSurnameTree,
    onDeletePerson,
    onEditPerson,
    onGrantMergeViewerAccess,
    onLoadTreeMergePreview,
    onMarkNotificationActivityActioned,
    onMarkNotificationOpened,
    onMarkNotificationSeen,
    onOpenAddPerson,
    onOpenAddSelf,
    onOpenCollaboratorDialog,
    onOpenPersonQuickActions,
    onOpenRelationshipDialog,
    onOpenTreeSettingsTarget,
    onRejectApprovalRequest,
    onRejectMergeRequest,
    onRemoveCollaborator,
    onRequestTreeAccess,
    onRequestTreeAccessByIdentifier,
    onRespondToTreeAccessRequest,
    onRequestMergeChanges,
    onRespondToMergeInvite,
    onSearchDiscoverableTrees,
    onSearchDiscoverableTreesByUsername,
    onSendMergeInvite,
    onSetApprovalWindowHours,
    onSetTreeDiscoverability,
    onSetSurnameVariantGroups,
    onUndoMerge,
    openConfirm,
    openPersonProfile,
    people,
    peopleById,
    relationships,
    role,
    selectedTree,
    treeSettingsFocus,
    trees,
    user?.defaultTreeId,
    user?.id,
  ]);

  const dismissSnackbar = useCallback(() => {
    setSnackVisible(false);
    clearError();
    clearNotice();
  }, [clearError, clearNotice]);

  useEffect(() => {
    if (!isFocused || shouldBlockPriorityAlerts || priorityAlert) {
      return;
    }

    const nextAlert = importantPriorityAlerts.find((item) => !dismissedPriorityAlertIdsRef.current.has(item.id));
    if (nextAlert) {
      setPriorityAlert(nextAlert);
    }
  }, [importantPriorityAlerts, isFocused, priorityAlert, shouldBlockPriorityAlerts]);

  useEffect(() => {
    if (!priorityAlert) {
      return;
    }

    const stillExists = importantPriorityAlerts.some((item) => item.id === priorityAlert.id);
    if (!stillExists) {
      setPriorityAlert(null);
    }
  }, [importantPriorityAlerts, priorityAlert]);

  const dismissPriorityAlert = useCallback(async () => {
    if (!priorityAlert) {
      return;
    }

    dismissedPriorityAlertIdsRef.current.add(priorityAlert.id);
    if (priorityAlert.notificationId) {
      if (priorityAlert.kind === 'tree-access-response' && !priorityAlert.opened) {
        await onMarkNotificationOpened(priorityAlert.notificationId);
      } else if (!priorityAlert.seen) {
        await onMarkNotificationSeen(priorityAlert.notificationId);
      }
    }
    setPriorityAlert(null);
  }, [onMarkNotificationOpened, onMarkNotificationSeen, priorityAlert]);

  const openPriorityAlertTarget = useCallback(async () => {
    if (!priorityAlert) {
      return;
    }

    dismissedPriorityAlertIdsRef.current.add(priorityAlert.id);

    if (priorityAlert.notificationId && !priorityAlert.opened) {
      await onMarkNotificationOpened(priorityAlert.notificationId);
    }

    if ((priorityAlert.kind === 'merge-request' || priorityAlert.kind === 'merge-history') && priorityAlert.requestId && priorityAlert.sourceKind && priorityAlert.sourceId) {
      await onMarkNotificationActivityActioned(priorityAlert.sourceKind, priorityAlert.sourceId);
      onOpenTreeSettingsTarget({
        tab: 'merges',
        itemId: priorityAlert.requestId,
        mode: 'merge',
      });
      navigation.navigate('Main', { screen: 'treeSettings' });
    }

    setPriorityAlert(null);
  }, [navigation, onMarkNotificationActivityActioned, onMarkNotificationOpened, onOpenTreeSettingsTarget, priorityAlert]);

  const respondToPriorityMergeInvite = useCallback(async (status: 'accepted' | 'dismissed') => {
    if (!priorityAlert?.notificationId || priorityAlert.kind !== 'merge-invite') {
      return;
    }

    dismissedPriorityAlertIdsRef.current.add(priorityAlert.id);
    await onRespondToMergeInvite(priorityAlert.notificationId, status);
    setPriorityAlert(null);
  }, [onRespondToMergeInvite, priorityAlert]);

  const respondToPriorityTreeAccess = useCallback(async (status: 'accepted' | 'rejected') => {
    if (!priorityAlert?.notificationId || priorityAlert.kind !== 'tree-access-request') {
      return;
    }

    dismissedPriorityAlertIdsRef.current.add(priorityAlert.id);
    await onRespondToTreeAccessRequest(priorityAlert.notificationId, status);
    setPriorityAlert(null);
  }, [onRespondToTreeAccessRequest, priorityAlert]);

  return {
    authLoading,
    canEdit,
    clearError,
    clearNotice,
    closeCollaboratorDialog,
    closeConfirm,
    closeAddPersonChooser,
    closeNodeQuickActions,
    closePersonDialog,
    closeRelationshipDialog,
    closeSelfPersonDialog,
    closeTreeDialog,
    closeTreeNameSuggestion,
    collaboratorDialogVisible,
    addPersonChooserVisible,
    confirmState,
    crossSurnameChildIds,
    dialogActions: {
      handleCollaboratorSubmit,
      handleConfirmAction,
      handlePersonSubmit,
      handleRelationshipSubmit,
      handleSelfPersonSubmit,
      handleTreeDialogSubmit,
    },
    dismissSnackbar,
    existingLastNames,
    findConnectedTreeForSurname,
    handleConfirmDeleteTree,
    handleOpenMaidenFamilyTree,
    handleAddPersonEntrySelection,
    handleAddFirstFamilyMember,
    handleMaidenParentSelectionAttempt,
    openCreateTreeDialog,
    memberProfileNavigation,
    memberProfileParams,
    mutating,
    navigation,
    nodeQuickActionState,
    notificationBadgeCount,
    onDeletePerson,
    openCreateRelativeDialog,
    openPersonProfile,
    personDialog,
    personDialogRelationshipCandidates,
    people,
    relationshipDialogVisible,
    relationships,
    loadingTrees,
    selectedTree,
    selfInitialValues,
    selfPersonDialogVisible,
    sharedTabProps,
    signOut,
    snackMessage: error ?? notice,
    snackVisible,
    startupModal: {
      currentVersion: currentReleaseNote.version,
      initialLanguage: user?.preferredLanguage ?? language,
      loading: startupModalSubmitting,
      mode: (shouldShowLanguageModal ? 'language' : 'update') as 'language' | 'update',
      updateHighlights: currentReleaseNote.highlights,
      visible: shouldShowLanguageModal || shouldShowUpdateModal,
    },
    discoverabilityPrompt: {
      visible: shouldShowDiscoverabilityPrompt,
      loading: mutating,
      pendingCount: ownedTreesNeedingDiscoverabilityChoice.length,
    },
    pendingTreeAccessRequests,
    pendingTreeAccessRequest,
    priorityAlert,
    treeNameSuggestion,
    maidenTreeSuggestion,
    dismissPriorityAlert,
    continueCreatingSuggestedTree,
    closeMaidenTreeSuggestion,
    handleDiscoverabilityPromptChoice,
    openPriorityAlertTarget,
    requestAccessToSuggestedTree,
    openMaidenTreeCandidate,
    requestMaidenTreeAccess,
    respondToPriorityMergeInvite,
    respondToPriorityTreeAccess,
    handleStartupLanguageSubmit,
    handleUpdateModalDismiss,
    onCancelTreeAccessRequest,
    onRequestTreeAccess,
    onRequestTreeAccessByIdentifier,
    onRespondToTreeAccessRequest,
    onSearchDiscoverableTrees,
    onSearchDiscoverableTreesByUsername,
    onSetTreeDiscoverability,
    treeNeedsDiscoverabilityChoice,
    t,
    theme,
    trees,
    treeDialog,
    user,
  };
}
