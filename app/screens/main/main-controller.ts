import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import type { PersonFormSubmission, PendingRelationshipSubmission } from '../../../components/person-form-dialog';
import type { PersonRecord } from '../../../components/dto/person';
import type { RootStackParamList } from '../../../components/dto/navigation';
import type { ParentChildRelationshipKind, SpouseRelationshipStatus } from '../../../components/dto/relationship';
import { getUserDisplayLabel } from '../../../components/dto/user';
import { formatPersonName } from '../../../components/person-formatting';
import { findCrossSurnameChildren } from '../../../components/family-tree-surname-clusters';
import {
  canSetDefaultTree,
  canEditTreeContent,
  canManageTree,
  getTreeRole,
  type CollaboratorRole,
  type FamilyTree,
} from '../../../components/dto/tree';
import { useI18n } from '../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../i18n/keys';
import { useAuthStore } from '../../../stores/auth-store';
import { useTreeStore } from '../../../stores/tree-store';
import { useShallow } from 'zustand/react/shallow';
import { getTreeDeletionImpact } from '../../../providers/family-tree-service';
import type { SharedTabProps } from '../tree-tab-content';
import {
  buildPeopleDirectory,
  buildTreeAssignmentContext,
  getActivityNotificationCount,
  getTreeById,
} from '../tree-tabs/shared';
import { buildSelfPersonInitialValues, createPersonFromFormSubmission, findConnectedTreeForSurname } from '../tree-screen-helpers';

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
  const { t } = useI18n();
  const { user, signOut, loading: authLoading, setDefaultTreeId } = useAuthStore();
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
  const [selfPersonDialogVisible, setSelfPersonDialogVisible] = useState(false);
  const [relationshipDialogVisible, setRelationshipDialogVisible] = useState(false);
  const [collaboratorDialogVisible, setCollaboratorDialogVisible] = useState(false);
  const [nodeQuickActionState, setNodeQuickActionState] = useState<NodeQuickActionState>({ visible: false, person: null });
  const [treeDialog, setTreeDialog] = useState<TreeDialogState>({ visible: false, mode: 'create', tree: null });
  const [treeSettingsFocus, setTreeSettingsFocus] = useState<TreeSettingsFocus>(null);
  const [memberProfileParams, setMemberProfileParams] = useState<MemberProfileParams | null>(null);
  const [snackVisible, setSnackVisible] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: t(K.common.confirm),
    action: null,
  });

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
    currentAssignedPersonId,
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

  const openCreateTreeDialog = useCallback(() => {
    setTreeDialog({ visible: true, mode: 'create', tree: null });
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

  const handleTreeDialogSubmit = useCallback(async (name: string) => {
    if (!user) {
      return;
    }

    try {
      if (treeDialog.mode === 'create') {
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
  }, [closeTreeDialog, createTree, renameTree, selectTree, setDefaultTreeId, treeDialog.mode, treeDialog.tree, user]);

  const handleToggleDefaultTree = useCallback(async (tree: FamilyTree) => {
    try {
      await setDefaultTreeId(user?.defaultTreeId === tree.id ? null : tree.id);
    } catch {
      // ignored
    }
  }, [setDefaultTreeId, user?.defaultTreeId]);

  const handleSwitchTree = useCallback((tree: FamilyTree) => {
    selectTree(tree.id);
  }, [selectTree]);

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

  const onOpenAddPerson = useCallback(() => {
    setPersonDialog({ visible: true, mode: 'create', person: null, initialPendingRelationships: [] });
  }, []);

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
    () => [],
    [],
  );

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
      onEditPerson,
      onDeletePerson,
      onRemoveCollaborator,
      onAssignPersonToUser: handleAssignPersonToUser,
      onClearSelfAssignment: handleClearSelfAssignment,
      onApproveApprovalRequest,
      onRejectApprovalRequest,
      onSetApprovalWindowHours,
      onSetSurnameVariantGroups,
      onCreateMergeRequest,
      onSendMergeInvite,
      onRespondToMergeInvite,
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
    onRequestMergeChanges,
    onRespondToMergeInvite,
    onSendMergeInvite,
    onSetApprovalWindowHours,
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

  return {
    authLoading,
    canEdit,
    clearError,
    clearNotice,
    closeCollaboratorDialog,
    closeConfirm,
    closeNodeQuickActions,
    closePersonDialog,
    closeRelationshipDialog,
    closeSelfPersonDialog,
    closeTreeDialog,
    collaboratorDialogVisible,
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
    t,
    theme,
    trees,
    treeDialog,
    user,
  };
}
