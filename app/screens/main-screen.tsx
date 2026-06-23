import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Button,
  Dialog,
  IconButton,
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
  TreeFormDialog,
} from '../../components';
import type { PersonFormSubmission } from '../../components/person-form-dialog';
import type { PendingRelationshipSubmission } from '../../components/person-form-dialog';
import { useAuthStore } from '../../stores/auth-store';
import { useTreeStore } from '../../stores/tree-store';
import { getTreeDeletionImpact } from '../../providers/family-tree-service';
import type { PersonRecord } from '../../components/dto/person';
import type { ParentChildRelationshipKind, SpouseRelationshipStatus } from '../../components/dto/relationship';
import type { MainTabParamList, RootStackParamList } from '../../components/dto/navigation';
import { getUserNameParts, getUserDisplayLabel } from '../../components/dto/user';
import { formatPersonName } from '../../components/person-formatting';
import {
  findCrossSurnameChildren,
  extractSurname,
} from '../../components/family-tree-surname-clusters';
import {
  canSetDefaultTree,
  canEditTreeContent,
  canManageTree,
  getAssignedPersonId,
  getTreeRole,
  type CollaboratorRole,
  type FamilyTree,
} from '../../components/dto/tree';
import { GlobalStyles } from '../../constants/styles';
import { useI18n } from '../../hooks/use-i18n';
const dialogChrome = GlobalStyles.dialogChrome;
import {
  NotificationsTabContent,
  PeopleRelationshipsTabContent,
  TreeSettingsTabContent,
  VisualisationTabContent,
  type SharedTabProps,
} from './tree-tab-content';
import { UserProfileTabContent } from './profile-screen';

type Props = NativeStackScreenProps<RootStackParamList, 'Main'>;

// ─── Local types ──────────────────────────────────────────────────────────────

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

function normaliseSurnameKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function treeMatchesSurname(tree: FamilyTree, surname: string) {
  const key = normaliseSurnameKey(surname);
  if (!key) {
    return false;
  }

  if (normaliseSurnameKey(tree.name) === key) {
    return true;
  }

  return tree.surnameVariantGroups.some((group) => (
    [group.primarySurname, ...group.variants]
      .map(normaliseSurnameKey)
      .includes(key)
  ));
}

type TreeDialogState = {
  visible: boolean;
  mode: 'create' | 'edit';
  tree: FamilyTree | null;
};

type TreeSettingsFocus = {
  tab: 'approvals' | 'merges';
  itemId: string;
  mode: 'approval' | 'merge';
  token: number;
} | null;

// ─── Navigator ────────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<MainTabParamList>();
const styles = GlobalStyles.treeDetail;
const homeStyles = GlobalStyles.home;

// ─── Tab icon map ─────────────────────────────────────────────────────────────

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  tree: 'family-tree',
  members: 'account-group-outline',
  notifications: 'bell-outline',
  treeSettings: 'cog-outline',
  myProfile: 'account-circle-outline',
};

// ─── Local styles ─────────────────────────────────────────────────────────────

const localStyles = StyleSheet.create({
  noTreeGate: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 32,
    gap: 16,
  },
  noTreeGateText: {
    textAlign: 'center' as const,
  },
});

// ─── No-tree gate ─────────────────────────────────────────────────────────────

function NoTreeGate({ onCreateTree }: { onCreateTree: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View style={[localStyles.noTreeGate, { backgroundColor: theme.colors.background }]}>
      <MaterialCommunityIcons name="family-tree" size={64} color={theme.colors.primary} />
      <Text variant="headlineSmall" style={[localStyles.noTreeGateText, { color: theme.colors.onSurface }]}>
        {t('No family tree yet')}
      </Text>
      <Text variant="bodyMedium" style={[localStyles.noTreeGateText, { color: theme.colors.onSurfaceVariant }]}>
        {t('Create your first family tree to start adding people, photos, and relationships.')}
      </Text>
      <Button mode="contained" icon="plus" onPress={onCreateTree} contentStyle={homeStyles.headerButtonContent}>
        {t('Create family tree')}
      </Button>
    </View>
  );
}


// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MainScreen({ navigation }: Props) {
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
  } = useTreeStore();

  // ── Dialog / overlay state ──────────────────────────────────────────────────

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
  const [snackVisible, setSnackVisible] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: t('Confirm'),
    action: null,
  });

  // ── Derived state ───────────────────────────────────────────────────────────

  const selectedTree = useMemo(
    () => trees.find((t) => t.id === selectedTreeId) ?? null,
    [trees, selectedTreeId],
  );

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );

  const existingLastNames = useMemo(
    () => [...new Set(people.map((p) => p.lastName.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [people],
  );

  const crossSurnameChildIds = useMemo(
    () => findCrossSurnameChildren(people, relationships),
    [people, relationships],
  );

  const currentUserLabel = useMemo(() => getUserDisplayLabel(user), [user]);

  const assignedUserIdByPersonId = useMemo(
    () => new Map(Object.entries(selectedTree?.personAssignments ?? {}).map(([uid, pid]) => [pid, uid])),
    [selectedTree?.personAssignments],
  );

  const assignedPersonByUserId = useMemo(
    () => new Map(
      Object.entries(selectedTree?.personAssignments ?? {})
        .map(([uid, pid]) => {
          const p = peopleById.get(pid);
          return p ? [uid, p] as const : null;
        })
        .filter((e): e is readonly [string, PersonRecord] => Boolean(e)),
    ),
    [peopleById, selectedTree?.personAssignments],
  );

  const currentAssignedPersonId = selectedTree ? getAssignedPersonId(selectedTree, user?.id) : null;

  const currentAssignedPerson = useMemo(
    () => (currentAssignedPersonId ? peopleById.get(currentAssignedPersonId) ?? null : null),
    [currentAssignedPersonId, peopleById],
  );

  const notificationBadgeCount = useMemo(() => {
    const unseenDirectCount = notifications.filter((notification) => !notification.seenAt).length;
    const actionedStateKeys = new Set(
      notificationActivityStates
        .filter((state) => Boolean(state.actionedAt))
        .map((state) => `${state.sourceKind}:${state.sourceId}`),
    );

    const unactionedApprovalCount = approvalRequests.filter((request) => !actionedStateKeys.has(`approval:${request.id}`)).length;
    const unactionedMergeRequestCount = mergeRequests.filter((request) => !actionedStateKeys.has(`merge-request:${request.id}`)).length;
    const unactionedMergeHistoryCount = mergeHistory.filter((entry) => !actionedStateKeys.has(`merge-history:${entry.id}`)).length;
    const unactionedMembershipCount = trees
      .flatMap((tree) => tree.membershipHistory.map((entry) => ({ tree, entry })))
      .filter(({ entry }) => !user?.id || entry.userId === user.id || entry.action === 'invited' || entry.action === 'role-changed')
      .filter(({ tree, entry }) => !actionedStateKeys.has(`membership:${tree.id}-${entry.id}`))
      .length;

    return unseenDirectCount
      + unactionedApprovalCount
      + unactionedMergeRequestCount
      + unactionedMergeHistoryCount
      + unactionedMembershipCount;
  }, [approvalRequests, mergeHistory, mergeRequests, notificationActivityStates, notifications, trees, user?.id]);

  const availableSelfLinkPeople = useMemo(
    () => people
      .filter((p) => { const uid = assignedUserIdByPersonId.get(p.id); return !uid || uid === user?.id; })
      .sort((a, b) => formatPersonName(a).localeCompare(formatPersonName(b))),
    [assignedUserIdByPersonId, people, user?.id],
  );

  const role = selectedTree ? getTreeRole(selectedTree, user?.id) : null;
  const isOwner = selectedTree ? canManageTree(selectedTree, user?.id) : false;
  const canEdit = selectedTree ? canEditTreeContent(selectedTree, user?.id) : false;

  const selfUserNameParts = useMemo(() => getUserNameParts(user), [user]);
  const selfInitialValues = useMemo(() => ({
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
  }), [selfUserNameParts.firstName, selfUserNameParts.lastName]);

  // ── Auto-select tree ────────────────────────────────────────────────────────

  const hasAutoSelectedRef = useRef(false);
  const canvasFamilySwitchRef = useRef<((surname: string) => void) | null>(null);
  const canvasActiveFamilyRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadingTrees || selectedTreeId || hasAutoSelectedRef.current) return;
    const target = trees.find((t) => t.id === user?.defaultTreeId && canSetDefaultTree(t, user?.id))
      ?? trees.find((tree) => canSetDefaultTree(tree, user?.id))
      ?? trees[0];
    if (target) {
      hasAutoSelectedRef.current = true;
      selectTree(target.id);
    }
  }, [loadingTrees, selectedTreeId, trees, user?.defaultTreeId, selectTree]);

  // Reset flag when user changes
  useEffect(() => { hasAutoSelectedRef.current = false; }, [user?.id]);

  // ── Error / notice ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (error || notice) setSnackVisible(true);
  }, [error, notice]);

  // ── Shared handlers ─────────────────────────────────────────────────────────

  const openConfirm = useCallback((title: string, message: string, confirmLabel: string, action: () => Promise<void>) => {
    setConfirmState({ visible: true, title, message, confirmLabel, action });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState({ visible: false, title: '', message: '', confirmLabel: t('Confirm'), action: null });
  }, [t]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmState.action) return;
    try {
      await confirmState.action();
      closeConfirm();
    } catch {
      // surfaced via snackbar
    }
  }, [closeConfirm, confirmState.action]);

  const openPersonProfile = useCallback((person: PersonRecord) => {
    if (!selectedTree) return;
    navigation.navigate('PersonProfile', { treeId: selectedTree.id, personId: person.id });
  }, [navigation, selectedTree]);

  const closePersonDialog = useCallback(() => {
    setPersonDialog({ visible: false, mode: 'create', person: null, initialPendingRelationships: [] });
  }, []);

  const closeNodeQuickActions = useCallback(() => {
    setNodeQuickActionState({ visible: false, person: null });
  }, []);

  const openCreateRelativeDialog = useCallback((mode: PendingRelationshipSubmission['mode'], relatedPerson: PersonRecord) => {
    setNodeQuickActionState({ visible: false, person: null });
    setPersonDialog({ visible: true, mode: 'create', person: null, initialPendingRelationships: [{ mode, relatedPersonId: relatedPerson.id }] });
  }, []);

  // ── Tree CRUD ───────────────────────────────────────────────────────────────

  const handleTreeDialogSubmit = useCallback(async (name: string) => {
    if (!user) return;
    try {
      if (treeDialog.mode === 'create') {
        const tree = await createTree({ id: user.id, email: user.email, displayName: user.displayName }, name);
        if (!user.defaultTreeId) await setDefaultTreeId(tree.id);
        selectTree(tree.id);
      } else if (treeDialog.tree) {
        await renameTree(treeDialog.tree.id, name);
      }
      setTreeDialog({ visible: false, mode: 'create', tree: null });
    } catch {
      // surfaced via snackbar
    }
  }, [createTree, renameTree, selectTree, setDefaultTreeId, treeDialog, user]);

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

  const findConnectedTreeForSurname = useCallback((person: PersonRecord, surname: string) => {
    if (!selectedTree) {
      return null;
    }

    const membershipIds = new Set(person.treeMembershipIds);
    return trees.find((tree) => (
      tree.id !== selectedTree.id
      && selectedTree.connectedTreeIds.includes(tree.id)
      && membershipIds.has(tree.id)
      && treeMatchesSurname(tree, surname)
    )) ?? null;
  }, [selectedTree, trees]);

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
          t('Delete family tree'),
          details,
          t('Delete'),
          async () => {
            await removeTree(tree);
            if (user?.defaultTreeId === tree.id) await setDefaultTreeId(null);
          },
        );
      } catch {
        openConfirm(
          t('Delete family tree'),
          t('Delete "{treeName}" and everything attached to it, including family members, relationships, photos, collaborator access, approval history, merge records, and connected-tree links? This cannot be undone.', { treeName: tree.name }),
          t('Delete'),
          async () => {
            await removeTree(tree);
            if (user?.defaultTreeId === tree.id) await setDefaultTreeId(null);
          },
        );
      }
    })();
  }, [openConfirm, removeTree, setDefaultTreeId, t, user?.defaultTreeId]);

  // ── Person / relationship handlers ───────────────────────────────────────────

  const handleCollaboratorSubmit = useCallback(async ({ email, role: cRole }: { email: string; role: CollaboratorRole }) => {
    if (!selectedTree) return;
    try {
      await addCollaborator(selectedTree.id, email, cRole);
      setCollaboratorDialogVisible(false);
    } catch { /* snackbar */ }
  }, [addCollaborator, selectedTree]);

  const createPersonFromPayload = useCallback(async (payload: PersonFormSubmission) => {
    if (!user?.id || !selectedTree) return null;
    const created = await createPerson(user.id, selectedTree.id, {
      firstName: payload.firstName, middleNames: payload.middleNames, lastName: payload.lastName, maidenName: payload.maidenName, birthDate: payload.birthDate,
      deathDate: payload.deathDate, gender: payload.gender, notes: payload.notes,
      lifeEvents: payload.lifeEvents, preferredPhotoRef: payload.preferredPhotoRef,
    }, payload.newPhotoUris);
    for (const pr of payload.pendingRelationships) {
      if (pr.mode === 'parent-of') await addParentChildRelationship(user.id, selectedTree.id, created.id, pr.relatedPersonId, pr.parentChildKind);
      else if (pr.mode === 'child-of') await addParentChildRelationship(user.id, selectedTree.id, pr.relatedPersonId, created.id, pr.parentChildKind);
      else await addSpouseRelationship(user.id, selectedTree.id, created.id, pr.relatedPersonId);
    }
    return created;
  }, [addParentChildRelationship, addSpouseRelationship, createPerson, selectedTree, user?.id]);

  const handlePersonSubmit = useCallback(async (payload: PersonFormSubmission) => {
    if (!user?.id || !selectedTree) return;
    try {
      if (personDialog.mode === 'create') await createPersonFromPayload(payload);
      else if (personDialog.person) await updatePerson(user.id, personDialog.person, payload);
      closePersonDialog();
    } catch { /* snackbar */ }
  }, [closePersonDialog, createPersonFromPayload, personDialog.mode, personDialog.person, selectedTree, updatePerson, user?.id]);

  const handleSelfPersonSubmit = useCallback(async (payload: PersonFormSubmission) => {
    if (!user?.id || !selectedTree) return;
    try {
      const created = await createPersonFromPayload(payload);
      if (created) await assignPersonToUser(user.id, selectedTree.id, user.id, created.id);
      setSelfPersonDialogVisible(false);
    } catch { /* snackbar */ }
  }, [assignPersonToUser, createPersonFromPayload, selectedTree, user?.id]);

  const handleAssignPersonToUser = useCallback(async (targetUserId: string, personId: string) => {
    if (!user?.id || !selectedTree) return;
    try { await assignPersonToUser(user.id, selectedTree.id, targetUserId, personId); } catch { /* snackbar */ }
  }, [assignPersonToUser, selectedTree, user?.id]);

  const handleClearSelfAssignment = useCallback(async () => {
    if (!user?.id || !selectedTree) return;
    try { await clearSelfAssignment(selectedTree.id, user.id); } catch { /* snackbar */ }
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
    if (!user?.id || !selectedTree) return;
    try {
      if (type === 'spouse') await addSpouseRelationship(user.id, selectedTree.id, fromPersonId, toPersonId, relationshipStatus);
      else await addParentChildRelationship(user.id, selectedTree.id, fromPersonId, toPersonId, parentChildKind);
      setRelationshipDialogVisible(false);
    } catch { /* snackbar */ }
  }, [addParentChildRelationship, addSpouseRelationship, selectedTree, user?.id]);

  const onOpenAddPerson = useCallback(() => setPersonDialog({ visible: true, mode: 'create', person: null, initialPendingRelationships: [] }), []);
  const onOpenRelationshipDialog = useCallback(() => setRelationshipDialogVisible(true), []);
  const onOpenPersonQuickActions = useCallback((person: PersonRecord) => setNodeQuickActionState({ visible: true, person }), []);
  const onOpenCollaboratorDialog = useCallback(() => setCollaboratorDialogVisible(true), []);
  const onOpenAddSelf = useCallback(() => setSelfPersonDialogVisible(true), []);
  const onEditPerson = useCallback((p: PersonRecord) => setPersonDialog({ visible: true, mode: 'edit', person: p, initialPendingRelationships: [] }), []);
  const onDeletePerson = useCallback(async (p: PersonRecord) => {
    if (!user?.id) return;
    await removePerson(user.id, p);
  }, [removePerson, user?.id]);
  const onRemoveCollaborator = useCallback(async (uid: string) => {
    if (!selectedTree) return;
    await removeCollaborator(selectedTree.id, uid);
  }, [removeCollaborator, selectedTree]);
  const onSetApprovalWindowHours = useCallback(async (hours: number) => {
    if (!selectedTree) return;
    await setApprovalWindowHours(selectedTree.id, hours);
  }, [selectedTree, setApprovalWindowHours]);
  const onApproveApprovalRequest = useCallback(async (id: string) => {
    if (!user?.id) return;
    await approveApprovalRequest(user.id, id);
  }, [approveApprovalRequest, user?.id]);
  const onRejectApprovalRequest = useCallback(async (id: string) => {
    if (!user?.id) return;
    await rejectApprovalRequest(user.id, id);
  }, [rejectApprovalRequest, user?.id]);
  const onSetSurnameVariantGroups = useCallback(async (groups: SharedTabProps['selectedTree']['surnameVariantGroups']) => {
    if (!selectedTree) return;
    await setSurnameVariantGroups(selectedTree.id, groups);
  }, [selectedTree, setSurnameVariantGroups]);
  const onCreateMergeRequest = useCallback(async (targetTreeId: string) => {
    if (!user?.id || !selectedTree) return;
    await createMergeRequest(user.id, selectedTree.id, targetTreeId);
  }, [createMergeRequest, selectedTree, user?.id]);
  const onSendMergeInvite = useCallback(async (identifier: string) => {
    if (!user?.id || !selectedTree) return;
    await sendMergeInvite(user.id, selectedTree.id, identifier);
  }, [selectedTree, sendMergeInvite, user?.id]);
  const onRespondToMergeInvite = useCallback(async (notificationId: string, status: 'accepted' | 'dismissed') => {
    if (!user?.id) return;
    await respondToMergeInvite(user.id, notificationId, status);
  }, [respondToMergeInvite, user?.id]);
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
  const onLoadTreeMergePreview = useCallback(async (targetTreeId: string) => {
    if (!selectedTree) return;
    await loadMergePreview(selectedTree.id, targetTreeId);
  }, [loadMergePreview, selectedTree]);
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

  const personDialogRelationshipCandidates = useMemo(
    () => people.filter((p) => p.id !== personDialog.person?.id),
    [people, personDialog.person?.id],
  );

  const currentSelfAssignmentSuggestions: SharedTabProps['currentSelfAssignmentSuggestions'] = useMemo(
    () => [],
    [],
  );

  // ── sharedTabProps ──────────────────────────────────────────────────────────

  const sharedTabProps = useMemo((): SharedTabProps | null => {
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
      // Tree management
      trees,
      defaultTreeId: user?.defaultTreeId,
      loadingTrees,
      onCreateTree: () => setTreeDialog({ visible: true, mode: 'create', tree: null }),
      onEditTree: (t) => setTreeDialog({ visible: true, mode: 'edit', tree: t }),
      onConfirmDeleteTree: handleConfirmDeleteTree,
      onToggleDefaultTree: handleToggleDefaultTree,
      onSwitchTree: handleSwitchTree,
      familySwitchRef: canvasFamilySwitchRef,
      activeFamilyRef: canvasActiveFamilyRef,
    };
  }, [
    selectedTree, people, relationships, approvalRequests, mergeRequests, mergeHistory, mergePreview, peopleById, canEdit, isOwner, role,
    user?.id, user?.defaultTreeId, currentUserLabel, currentAssignedPerson, currentSelfAssignmentSuggestions,
    availableSelfLinkPeople, notifications, notificationActivityStates, assignedPersonByUserId, assignedUserIdByPersonId, mutating, loadingTreeData,
    openConfirm, openPersonProfile, onOpenAddPerson, onOpenRelationshipDialog, onOpenPersonQuickActions,
    onOpenCollaboratorDialog, onOpenAddSelf, onEditPerson, onDeletePerson, onRemoveCollaborator,
    handleAssignPersonToUser, handleClearSelfAssignment, onApproveApprovalRequest, onRejectApprovalRequest,
    onSetApprovalWindowHours, onSetSurnameVariantGroups, onCreateMergeRequest, onSendMergeInvite, onRespondToMergeInvite, onMarkNotificationSeen, onMarkNotificationOpened, onMarkNotificationActivityActioned, onLoadTreeMergePreview,
    onApproveMergeRequest, onRejectMergeRequest, onRequestMergeChanges, onUndoMerge, onGrantMergeViewerAccess, onCreateSurnameTree, treeSettingsFocus, onOpenTreeSettingsTarget,
    trees, loadingTrees, handleConfirmDeleteTree, handleToggleDefaultTree, handleSwitchTree,
  ]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const noTreeGate = (
    <NoTreeGate onCreateTree={() => setTreeDialog({ visible: true, mode: 'create', tree: null })} />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Tab.Navigator
        screenOptions={({ route: r }) => ({
          lazy: true,
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          tabBarActiveBackgroundColor: theme.colors.elevation.level2,
          tabBarShowIcon: true,
          tabBarShowLabel: false,
          tabBarStyle: [styles.tabBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }],
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          sceneStyle: [styles.tabScene, { backgroundColor: theme.colors.background }],
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={(TAB_ICONS[r.name as keyof MainTabParamList] ?? 'circle') as any} size={size} color={color} />
          ),
        })}
      >
        <Tab.Screen name="tree" options={{ title: t('Tree') }}>
          {() => (sharedTabProps ? <VisualisationTabContent {...sharedTabProps} /> : noTreeGate)}
        </Tab.Screen>

        <Tab.Screen name="members" options={{ title: t('Members') }}>
          {() => (sharedTabProps ? <PeopleRelationshipsTabContent {...sharedTabProps} /> : noTreeGate)}
        </Tab.Screen>

        <Tab.Screen name="treeSettings" options={{ title: t('Settings') }}>
          {() => (sharedTabProps ? <TreeSettingsTabContent {...sharedTabProps} /> : noTreeGate)}
        </Tab.Screen>

        <Tab.Screen
          name="notifications"
          options={{
            title: t('Notifications'),
            tabBarBadge: notificationBadgeCount > 0 ? notificationBadgeCount : undefined,
          }}
        >
          {() => (sharedTabProps ? <NotificationsTabContent {...sharedTabProps} /> : noTreeGate)}
        </Tab.Screen>

        <Tab.Screen name="myProfile" options={{ title: t('Profile') }}>
          {() => <UserProfileTabContent onSignOut={signOut} authLoading={authLoading} />}
        </Tab.Screen>
      </Tab.Navigator>

      {/* ── Dialogs ── */}

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
          await onDeletePerson(personDialog.person!);
          closePersonDialog();
        } : undefined}
      />

      <PersonFormDialog
        visible={selfPersonDialogVisible}
        mode="create"
        initialValues={selfInitialValues}
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

      <TreeFormDialog
        visible={treeDialog.visible}
        mode={treeDialog.mode}
        tree={treeDialog.tree}
        loading={mutating}
        onDismiss={() => setTreeDialog({ visible: false, mode: 'create', tree: null })}
        onSubmit={handleTreeDialogSubmit}
        onDelete={treeDialog.mode === 'edit' && treeDialog.tree && canManageTree(treeDialog.tree, user?.id)
          ? async () => {
            const tree = treeDialog.tree;
            if (!tree) {
              return;
            }
            setTreeDialog({ visible: false, mode: 'create', tree: null });
            handleConfirmDeleteTree(tree);
          }
          : null}
      />

      <Portal>
        <Dialog
          visible={nodeQuickActionState.visible}
          onDismiss={closeNodeQuickActions}
          style={[dialogChrome.dialog, styles.quickActionDialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{nodeQuickActionState.person ? formatPersonName(nodeQuickActionState.person) : t('Quick actions')}</Dialog.Title>
          <IconButton
            icon="close"
            size={20}
            onPress={closeNodeQuickActions}
            style={dialogChrome.closeButton}
            accessibilityLabel={t('Close')}
          />
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium" style={[styles.quickActionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {t('Choose what you want to do with this family member.')}
            </Text>
            <List.Item
              title={t('Open profile')}
              description={t('See photos, memories, and full relationship details')}
              left={(props) => <List.Icon {...props} icon="account-arrow-right-outline" />}
              onPress={() => {
                const p = nodeQuickActionState.person;
                if (!p) return;
                closeNodeQuickActions();
                openPersonProfile(p);
              }}
            />
            {/* Maiden name member: context-aware — offer the OTHER family (not the one being viewed). */}
            {nodeQuickActionState.person?.maidenName?.trim() ? (() => {
              const person = nodeQuickActionState.person!;
              const maiden = person.maidenName!.trim();
              const marital = extractSurname(person);
              const currentFamily = canvasActiveFamilyRef.current;
              // If we're already in the maiden-name view, offer the marital family; otherwise offer the maiden.
              const isViewingMaiden = currentFamily === maiden;
              const targetSurname = isViewingMaiden ? marital : maiden;
              const label = isViewingMaiden
                ? t('View {surname} (marital) family tree', { surname: marital })
                : t('View {surname} (maiden) family tree', { surname: maiden });
              const description = isViewingMaiden
                ? t('Switch to {surname} — their family by marriage', { surname: marital })
                : t('Switch to {surname} — their birth family', { surname: maiden });
              const linkedTree = findConnectedTreeForSurname(person, targetSurname);
              return (
                <List.Item
                  title={label}
                  description={description}
                  left={(props) => <List.Icon {...props} icon="family-tree" />}
                  onPress={() => {
                    closeNodeQuickActions();
                    if (linkedTree) {
                      navigation.navigate('TreeDetail', {
                        treeId: linkedTree.id,
                        initialTab: 'VisualisationTab',
                        returnTreeId: selectedTree?.id,
                      });
                      return;
                    }
                    canvasFamilySwitchRef.current?.(targetSurname);
                  }}
                />
              );
            })() : null}
            {/* Cross-surname child (no maiden name): offer their family if not already viewing it. */}
            {nodeQuickActionState.person && !nodeQuickActionState.person.maidenName?.trim() && crossSurnameChildIds.has(nodeQuickActionState.person.id) ? (() => {
              const surname = extractSurname(nodeQuickActionState.person!);
              const alreadyViewing = canvasActiveFamilyRef.current === surname;
              if (alreadyViewing) return null;
              return (
                <List.Item
                  title={t('View {surname} family tree', { surname })}
                  description={t('This person has parents from different families')}
                  left={(props) => <List.Icon {...props} icon="source-branch" />}
                  onPress={() => {
                    closeNodeQuickActions();
                    canvasFamilySwitchRef.current?.(surname);
                  }}
                />
              );
            })() : null}
            {canEdit && nodeQuickActionState.person ? (
              <>
                <List.Item
                  title={t('Add parent')}
                  description={t('Create a new parent for {name}', { name: formatPersonName(nodeQuickActionState.person) })}
                  left={(props) => <List.Icon {...props} icon="account-arrow-up-outline" />}
                  onPress={() => openCreateRelativeDialog('parent-of', nodeQuickActionState.person!)}
                  disabled={mutating}
                />
                <List.Item
                  title={t('Add child')}
                  description={t('Create a new child for {name}', { name: formatPersonName(nodeQuickActionState.person) })}
                  left={(props) => <List.Icon {...props} icon="account-arrow-down-outline" />}
                  onPress={() => openCreateRelativeDialog('child-of', nodeQuickActionState.person!)}
                  disabled={mutating}
                />
                <List.Item
                  title={t('Add spouse')}
                  description={t('Create a spouse for {name}', { name: formatPersonName(nodeQuickActionState.person) })}
                  left={(props) => <List.Icon {...props} icon="account-heart-outline" />}
                  onPress={() => openCreateRelativeDialog('spouse-of', nodeQuickActionState.person!)}
                  disabled={mutating}
                />
              </>
            ) : null}
          </Dialog.Content>
        </Dialog>
      </Portal>

      <ConfirmDialog
        visible={confirmState.visible}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        loading={mutating}
        onDismiss={closeConfirm}
        onConfirm={handleConfirmAction}
      />

      <Snackbar
        visible={snackVisible}
        onDismiss={() => { setSnackVisible(false); clearError(); clearNotice(); }}
        duration={5000}
        action={{ label: t('Dismiss'), onPress: () => { setSnackVisible(false); clearError(); clearNotice(); } }}
      >
        {error ?? notice}
      </Snackbar>
    </View>
  );
}
