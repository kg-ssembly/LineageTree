import { buildTreeInvitationLink } from '../../../../components/tree-invitation-link';
import { PersonRecoveryPanel } from '../../../../components/person-recovery-panel';
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Chip, Dialog, IconButton, Portal, ProgressBar, Text, TextInput, useTheme } from 'react-native-paper';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, FloatingSnackbar, GlobalStyles, InfoDialog, Reveal, ScreenBackground } from '../../../../components';
import type { ApprovalRequest } from '../../../../components/dto/approval';
import type { PersonRecord } from '../../../../components/dto/person';
import {
  canEditTreeContent,
  getTreeApprovalWindowHours,
  getTreeRole,
  getUnlinkedCollaborators,
} from '../../../../components/dto/tree';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import { normaliseSurnameKey } from '../../tree-screen-helpers';
import type { SharedTabProps } from '../shared';
import { ApprovalsSection } from './approvals-section';
import { CollaboratorsSection } from './collaborators-section';
import { MergesSection } from './merges-section';
import { OverviewSection } from './overview-section';
import {
  arraysEqual,
  buildPersonApprovalPreviewFields,
  buildRelationshipApprovalPreviewFields,
  getApprovalOperationLabel,
  getTreeSettingsFamilyMemberCardStyle,
  TREE_HELPER_COPY,
  TREE_MANAGEMENT_TABS,
  type TreeHelperDialogKey,
  type TreeManagementTabKey,
} from './tree-settings-shared';
import { TreesSection } from './trees-section';
const dialogChrome = GlobalStyles.dialogChrome;
const styles = GlobalStyles.treeDetail;

const OWNER_LINK_PAGE_SIZE = 3;

const settingsTabIcons: Record<TreeManagementTabKey, keyof typeof MaterialCommunityIcons.glyphMap> = {
  overview: 'view-dashboard-outline',
  collaborators: 'account-multiple-outline',
  approvals: 'clipboard-check-outline',
  merges: 'merge',
  trees: 'source-branch',
  history: 'history',
};

const tabStyles = StyleSheet.create({
  rail: {
    marginTop: 14,
    marginBottom: 16,
    borderRadius: 22,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    gap: 8,
  },
  webContent: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  item: {
    width: '100%',
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  webItem: {
    flex: 1,
    flexBasis: 0,
    width: undefined,
    minWidth: 120,
  },
  activeBar: {
    width: 3,
    height: 20,
    borderRadius: 2,
  },
  itemLabel: {
    flex: 1,
  },
});

function TreeSettingsContent({
  selectedTree,
  people,
  relationships,
  approvalRequests,
  mergeRequests,
  mergeHistory,
  mergePreview,
  peopleById,
  canEdit,
  role,
  isOwner,
  userId,
  currentUserLabel,
  currentAssignedPerson,
  currentSelfAssignmentSuggestions,
  availableSelfLinkPeople,
  notifications,
  assignedPersonByUserId,
  assignedUserIdByPersonId,
  canCreateSelfProfile,
  mutating,
  onEnsureTreeAuxiliaryData,
  onOpenCollaboratorDialog,
  openConfirm,
  onRemoveCollaborator,
  onOpenAddSelf,
  onAssignPersonToUser,
  onClearSelfAssignment,
  openPersonProfile,
  onApproveApprovalRequest,
  onRejectApprovalRequest,
  onSetTreeDiscoverability,
  onSetApprovalWindowHours,
  onSetTreeKinshipSystem,
  onSetSurnameVariantGroups,
  onCreateMergeRequest,
  onSendMergeInvite,
  onRespondToMergeInvite,
  onRespondToTreeAccessRequest,
  loadingNotifications,
  onRequestTreeAccess,
  onRequestTreeAccessByIdentifier,
  onSearchDiscoverableTrees,
  onLoadMergePreview,
  onApproveMergeRequest,
  onRejectMergeRequest,
  onRequestMergeChanges,
  onUndoMerge,
  onGrantMergeViewerAccess,
  onCreateSurnameTree,
  treeSettingsFocus,
  trees,
  defaultTreeId,
  loadingTrees,
  onCreateTree,
  onEditTree,
  onToggleDefaultTree,
  onSwitchTree,
}: SharedTabProps) {
  const theme = useTheme();
  const contentRef = useRef<ScrollView>(null);
  const handledFocusToken = useRef<number | null>(null);
  const { t } = useI18n();
  const [helperDialog, setHelperDialog] = useState<{ visible: boolean; key: TreeHelperDialogKey }>({
    visible: false,
    key: 'tree-management',
  });
  const [activeManagementTab, setActiveManagementTab] = useState<TreeManagementTabKey | null>(null);
  useEffect(() => { contentRef.current?.scrollTo({ y: 0, animated: false }); }, [activeManagementTab]);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [ownerLinkTargetUserId, setOwnerLinkTargetUserId] = useState<string | null>(null);
  const [ownerLinkSearchQuery, setOwnerLinkSearchQuery] = useState('');
  const [ownerLinkPage, setOwnerLinkPage] = useState(1);
  const [surnameVariantDraft, setSurnameVariantDraft] = useState('');
  const [surnameVariantDrafts, setSurnameVariantDrafts] = useState<string[]>([]);
  const [surnameVariantDialogVisible, setSurnameVariantDialogVisible] = useState(false);
  const [previewApprovalRequest, setPreviewApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [mergePreviewVisible, setMergePreviewVisible] = useState(false);
  const [mergeHistoryVisible, setMergeHistoryVisible] = useState(false);
  const [mergeSelectionDrafts, setMergeSelectionDrafts] = useState<Record<string, string[]>>({});
  const [copyNoticeVisible, setCopyNoticeVisible] = useState(false);
  const [copyNoticeMessage, setCopyNoticeMessage] = useState('');
  const [highlightedMergeRequestId, setHighlightedMergeRequestId] = useState<string | null>(null);
  const deferredLinkSearchQuery = useDeferredValue(linkSearchQuery);
  const deferredOwnerLinkSearchQuery = useDeferredValue(ownerLinkSearchQuery);

  useEffect(() => {
    onEnsureTreeAuxiliaryData?.(selectedTree.id);
  }, [onEnsureTreeAuxiliaryData, selectedTree.id]);

  const treeSurnameVariants = useMemo(
    () => [...new Set(selectedTree.surnameVariantGroups.flatMap((group) => [group.primarySurname, ...group.variants]).map((value) => value.trim()).filter(Boolean))],
    [selectedTree.surnameVariantGroups],
  );

  const unlinkedCollaboratorCount = useMemo(
    () => getUnlinkedCollaborators(selectedTree).filter((collaborator) => collaborator.userId !== userId).length,
    [selectedTree, userId],
  );

  const selfLinkSearchIndex = useMemo(
    () => availableSelfLinkPeople.map((person) => ({
      person,
      searchableText: [person.firstName, person.lastName, person.birthDate, person.notes].join(' ').toLowerCase(),
    })),
    [availableSelfLinkPeople],
  );

  const ownerLinkSearchIndex = useMemo(
    () => people.map((person) => ({
      person,
      searchableText: [person.firstName, person.lastName, person.birthDate, person.notes].join(' ').toLowerCase(),
    })),
    [people],
  );

  const filteredLinkPeople = useMemo(() => {
    const normalizedQuery = deferredLinkSearchQuery.trim().toLowerCase();

    return selfLinkSearchIndex
      .filter(({ person }) => person.id !== currentAssignedPerson?.id)
      .filter(({ searchableText }) => {
        if (!normalizedQuery) {
          return true;
        }

        return searchableText.includes(normalizedQuery);
      })
      .map(({ person }) => person);
  }, [currentAssignedPerson?.id, deferredLinkSearchQuery, selfLinkSearchIndex]);

  const filteredOwnerLinkPeople = useMemo(() => {
    if (!ownerLinkTargetUserId) {
      return [] as PersonRecord[];
    }

    const normalizedQuery = deferredOwnerLinkSearchQuery.trim().toLowerCase();

    return ownerLinkSearchIndex
      .filter(({ person }) => {
        const assignedUserId = assignedUserIdByPersonId.get(person.id);
        if (assignedUserId && assignedUserId !== ownerLinkTargetUserId) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return true;
      })
      .filter(({ searchableText }) => !normalizedQuery || searchableText.includes(normalizedQuery))
      .map(({ person }) => person);
  }, [assignedUserIdByPersonId, deferredOwnerLinkSearchQuery, ownerLinkSearchIndex, ownerLinkTargetUserId]);

  const ownerLinkTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredOwnerLinkPeople.length / OWNER_LINK_PAGE_SIZE)),
    [filteredOwnerLinkPeople.length],
  );

  const pagedOwnerLinkPeople = useMemo(() => {
    const startIndex = (ownerLinkPage - 1) * OWNER_LINK_PAGE_SIZE;
    return filteredOwnerLinkPeople.slice(startIndex, startIndex + OWNER_LINK_PAGE_SIZE);
  }, [filteredOwnerLinkPeople, ownerLinkPage]);

  useEffect(() => {
    setOwnerLinkPage(1);
  }, [ownerLinkTargetUserId, ownerLinkSearchQuery]);

  useEffect(() => {
    setOwnerLinkPage((page) => Math.min(page, ownerLinkTotalPages));
  }, [ownerLinkTotalPages]);

  const treeSettingsMetrics = useMemo(() => {
    const pendingApprovalRequests = approvalRequests.filter((request) => request.status === 'pending');
    const availableMergeSourceTrees = (trees ?? []).filter((tree) => canEditTreeContent(tree, userId));
    const currentTreeSurnameKeys = new Set(
      selectedTree.surnameVariantGroups
        .flatMap((group) => [group.primarySurname, ...group.variants])
        .map(normaliseSurnameKey)
        .filter(Boolean),
    );

    const existingTreeLookup = new Map<string, SharedTabProps['selectedTree']>();
    (trees ?? []).forEach((tree) => {
      const values = tree.surnameVariantGroups.length > 0
        ? tree.surnameVariantGroups.flatMap((group) => [group.primarySurname, ...group.variants])
        : [tree.name];

      values
        .map(normaliseSurnameKey)
        .filter(Boolean)
        .forEach((key) => {
          if (!existingTreeLookup.has(key)) {
            existingTreeLookup.set(key, tree);
          }
        });
    });

    const counts = new Map<string, { surname: string; count: number }>();
    people.forEach((person) => {
      const maidenSurname = person.maidenName?.trim();
      if (!maidenSurname) {
        return;
      }

      const key = normaliseSurnameKey(maidenSurname);
      if (!key || currentTreeSurnameKeys.has(key)) {
        return;
      }

      const current = counts.get(key);
      counts.set(key, { surname: maidenSurname, count: (current?.count ?? 0) + 1 });
    });

    const maidenSurnameSuggestions = [...counts.entries()]
      .map(([key, value]) => ({
        surname: value.surname,
        count: value.count,
        existingTree: existingTreeLookup.get(key) ?? null,
      }))
      .filter((suggestion) => !suggestion.existingTree)
      .sort((left, right) => right.count - left.count || left.surname.localeCompare(right.surname));
    const pendingMergeRequests = mergeRequests.filter((request) => request.status === 'pending' || request.status === 'changes-requested');
    const mergeRequestsById = new Map(mergeRequests.map((request) => [request.id, request]));
    const approvalWindowHours = getTreeApprovalWindowHours(selectedTree);

    return {
      pendingApprovalRequests,
      availableMergeSourceTrees,
      maidenSurnameSuggestions,
      pendingMergeRequests,
      mergeRequestsById,
      approvalWindowHours,
    };
  }, [approvalRequests, mergeRequests, people, selectedTree, trees, userId]);
  const {
    pendingApprovalRequests,
    availableMergeSourceTrees,
    maidenSurnameSuggestions,
    pendingMergeRequests,
    mergeRequestsById,
    approvalWindowHours,
  } = treeSettingsMetrics;

  const approvalsDisabled = approvalWindowHours === 0;
  const approvalWindowValue = useMemo(() => {
    if (approvalWindowHours <= 0) return '0';
    if (approvalWindowHours <= 12) return '12';
    if (approvalWindowHours <= 24) return '24';
    return '48';
  }, [approvalWindowHours]);

  useEffect(() => {
    if (mergePreview) {
      setMergePreviewVisible(true);
    }
  }, [mergePreview]);

  useEffect(() => {
    setSurnameVariantDrafts(treeSurnameVariants);
  }, [treeSurnameVariants]);

  useEffect(() => {
    setMergeSelectionDrafts((current) => {
      const next = { ...current };
      let changed = false;
      const activeRequestIds = new Set(pendingMergeRequests.map((request) => request.id));

      Object.keys(next).forEach((requestId) => {
        if (!activeRequestIds.has(requestId)) {
          delete next[requestId];
          changed = true;
        }
      });

      pendingMergeRequests.forEach((request) => {
        const validMatchIds = new Set(request.preview.matches.map((match) => match.id));
        const existing = next[request.id];
        const normalized = existing
          ? existing.filter((matchId) => validMatchIds.has(matchId))
          : request.selectedMatchIds.filter((matchId) => validMatchIds.has(matchId));

        if (!existing || !arraysEqual(existing, normalized)) {
          next[request.id] = normalized;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [pendingMergeRequests]);

  useEffect(() => {
    if (!treeSettingsFocus || handledFocusToken.current === treeSettingsFocus.token) {
      return;
    }

    handledFocusToken.current = treeSettingsFocus.token;
    if (treeSettingsFocus.mode === 'trees') { setActiveManagementTab('trees'); return; }

    if (treeSettingsFocus.mode === 'approval') {
      setActiveManagementTab('approvals');
      const request = approvalRequests.find((entry) => entry.id === treeSettingsFocus.itemId) ?? null;
      if (request) {
        setPreviewApprovalRequest(request);
      }
      return;
    }

    setActiveManagementTab('merges');
    setHighlightedMergeRequestId(treeSettingsFocus.itemId);
  }, [approvalRequests, treeSettingsFocus]);

  const handleSaveSurnameVariants = async () => {
    const normalizedVariants = [...new Set(surnameVariantDrafts.map((value) => value.trim()).filter(Boolean))];
    if (normalizedVariants.length === 0) {
      await onSetSurnameVariantGroups([]);
      setSurnameVariantDialogVisible(false);
      return;
    }

    const existingGroup = selectedTree.surnameVariantGroups[0];
    await onSetSurnameVariantGroups([
      {
        id: existingGroup?.id ?? `${selectedTree.id}-surname-variants`,
        primarySurname: normalizedVariants[0],
        variants: normalizedVariants.slice(1),
        notes: existingGroup?.notes ?? '',
        createdAt: existingGroup?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    setSurnameVariantDialogVisible(false);
  };

  const handleAddSurnameVariantDraft = () => {
    const nextVariant = surnameVariantDraft.trim();
    if (!nextVariant) {
      return;
    }

    if (surnameVariantDrafts.some((variant) => variant.toLowerCase() === nextVariant.toLowerCase())) {
      setSurnameVariantDraft('');
      return;
    }

    setSurnameVariantDrafts((current) => [...current, nextVariant]);
    setSurnameVariantDraft('');
  };

  const handleRemoveSurnameVariantDraft = (variantToRemove: string) => {
    setSurnameVariantDrafts((current) => current.filter((variant) => variant !== variantToRemove));
  };

  const openHelperDialog = (key: TreeHelperDialogKey) => {
    setHelperDialog({ visible: true, key });
  };

  const openSurnameVariantDialog = () => {
    setSurnameVariantDraft('');
    setSurnameVariantDrafts(treeSurnameVariants);
    setSurnameVariantDialogVisible(true);
  };

  const previewRelationshipBefore = previewApprovalRequest
    ? relationships.find((relationship) => relationship.id === previewApprovalRequest.targetId) ?? null
    : null;
  const previewPersonFields = previewApprovalRequest?.entityType === 'person'
    ? buildPersonApprovalPreviewFields(
      previewApprovalRequest.payload.beforePerson ?? previewApprovalRequest.payload.deletedPerson ?? null,
      previewApprovalRequest.payload.afterPerson ?? null,
    )
    : [];
  const previewBundledRelationships = previewApprovalRequest?.entityType === 'person'
    ? previewApprovalRequest.payload.relationships ?? []
    : [];
  const previewRelationshipFields = previewApprovalRequest?.entityType === 'relationship'
    ? buildRelationshipApprovalPreviewFields(
      previewApprovalRequest.operation === 'create-relationship' ? null : previewRelationshipBefore,
      previewApprovalRequest.operation === 'delete-relationship' ? null : previewApprovalRequest.payload.relationship ?? null,
      peopleById,
    )
    : [];

  const toggleMergeSelection = (requestId: string, matchId: string) => {
    setMergeSelectionDrafts((current) => {
      const selectedIds = current[requestId] ?? [];
      const nextSelectedIds = selectedIds.includes(matchId)
        ? selectedIds.filter((currentId) => currentId !== matchId)
        : [...selectedIds, matchId];
      return { ...current, [requestId]: nextSelectedIds };
    });
  };

  const handleCopyTreeId = async (treeId: string) => {
    const clipboard = (globalThis as { navigator?: { clipboard?: { writeText?: (value: string) => Promise<void> } } }).navigator?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(treeId);
      setCopyNoticeMessage(t(K.treeSettings.treeIdCopied));
      setCopyNoticeVisible(true);
      return;
    }

    await Share.share({ message: treeId });
    setCopyNoticeMessage(t(K.treeSettings.treeIdReadyToShare));
    setCopyNoticeVisible(true);
  };

  const renderMergeHistoryItem = ({ item: entry, index }: { item: typeof mergeHistory[number]; index: number }) => {
    const mergeRequest = mergeRequestsById.get(entry.mergeRequestId);
    const canGrantViewerAccess = Boolean(
      mergeRequest
      && userId
      && mergeRequest.status === 'applied'
      && mergeRequest.suggestedByUserId !== userId
      && getTreeRole(selectedTree, userId) !== 'viewer'
      && !selectedTree.memberIds.includes(mergeRequest.suggestedByUserId),
    );

    return (
      <Reveal delay={80 + index * 20}>
        <View style={{ marginBottom: 12 }}>
          <View style={[styles.collaboratorCard, getTreeSettingsFamilyMemberCardStyle(theme)]}>
            <Text variant="titleMedium">{entry.summary}</Text>
            <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
              {t(K.treeSettings.mergeHistorySummary, {
                matches: entry.preview.matches.length,
                approvals: entry.approvals.length,
                people: entry.changedPersonIds.length,
              })}
            </Text>
            <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
              <Chip compact icon="history">{entry.status}</Chip>
              <Chip compact icon="calendar-clock">{entry.createdAt.slice(0, 16).replace('T', ' ')}</Chip>
            </View>
            <Button mode="outlined" icon="undo" onPress={() => onUndoMerge(entry.mergeRequestId)} disabled={mutating || entry.status !== 'applied'} style={[BUTTON_CHROME, { marginTop: 8 }]} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
              {t(K.treeSettings.previewAndUndoMerge)}
            </Button>
            {canGrantViewerAccess ? (
              <Button mode="outlined" icon="account-eye-outline" onPress={() => onGrantMergeViewerAccess(entry.mergeRequestId, selectedTree.id)} disabled={mutating} style={[BUTTON_CHROME, { marginTop: 8 }]} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                {t(K.treeSettings.grantViewerAccessToName, { name: mergeRequest?.suggestedByLabel ?? t(K.treeSettings.requester) })}
              </Button>
            ) : null}
          </View>
        </View>
      </Reveal>
    );
  };

  const { width } = useWindowDimensions();
  const wideSettings = width >= 900;
  const accessRequests = notifications.filter(item => item.type === 'tree-access-request' && item.status === 'pending' && item.sourceTreeId === selectedTree.id);
  const managementTabItems = TREE_MANAGEMENT_TABS.map((tab) => {
    const isActive = activeManagementTab === tab.key || (tab.key === 'approvals' && activeManagementTab === 'merges');
    return (
      <Pressable
        key={tab.key}
        onPress={() => setActiveManagementTab(tab.key)}
        style={[tabStyles.item, { backgroundColor: isActive ? theme.colors.primaryContainer : theme.colors.surface, borderColor: isActive ? theme.colors.primary : theme.colors.outlineVariant }]}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
      >
        <View style={[tabStyles.activeBar, { backgroundColor: isActive ? theme.colors.primary : 'transparent' }]} />
        <MaterialCommunityIcons
          name={settingsTabIcons[tab.key]}
          size={20}
          color={isActive ? theme.colors.primary : theme.colors.onSurfaceVariant}
        />
        <Text variant="labelMedium" style={[tabStyles.itemLabel, { color: isActive ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
          {t(tab.label)}{tab.key === 'approvals' ? ` (${pendingApprovalRequests.length + pendingMergeRequests.length})` : tab.key === 'collaborators' && accessRequests.length ? ` (${accessRequests.length})` : ''}
        </Text>
      </Pressable>
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenBackground />
      <ScrollView ref={contentRef} contentContainerStyle={styles.content}>
        <View>
        <View style={styles.titleWithHelperRow}>
          <Text variant="headlineSmall">{selectedTree.name}</Text>
          <Button icon="chevron-down" onPress={() => setActiveManagementTab('trees')}>{t('Manage trees')}</Button>
          <IconButton
            icon="information-outline"
            size={20}
            style={styles.helperIconButton}
            onPress={() => openHelperDialog('tree-management')}
            accessibilityLabel={t(K.treeSettings.aboutMyFamilyTrees)}
          />
        </View>

        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{people.length} {t('family members')} · {selectedTree.collaborators.length} {t('collaborators')}</Text>
        <View style={{ flexDirection: wideSettings ? 'row' : 'column', gap: 20, marginTop: 16 }}>
          {wideSettings || !activeManagementTab ? <View style={{ width: wideSettings ? 240 : '100%', gap: 8 }}>{managementTabItems}</View> : null}
          <View style={{ flex: 1, minWidth: 0, gap: 16 }}>
            {activeManagementTab ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              {!wideSettings ? <Button icon="arrow-left" onPress={() => setActiveManagementTab(null)}>{t('Settings')}</Button> : null}
              <Text variant="titleLarge">{t(activeManagementTab === 'trees' ? 'Manage trees' : activeManagementTab === 'merges' ? 'Reviews' : TREE_MANAGEMENT_TABS.find(tab => tab.key === activeManagementTab)?.label ?? '')}</Text>
            </View> : wideSettings ? <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('Choose a section to manage your tree.')}</Text> : null}
            {activeManagementTab === 'approvals' || activeManagementTab === 'merges' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button mode={activeManagementTab === 'approvals' ? 'contained-tonal' : 'outlined'} onPress={() => setActiveManagementTab('approvals')}>{t('Pending changes')} ({pendingApprovalRequests.length})</Button>
              <Button mode={activeManagementTab === 'merges' ? 'contained-tonal' : 'outlined'} onPress={() => setActiveManagementTab('merges')}>{t('Merge requests & tools')} ({pendingMergeRequests.length})</Button>
            </View> : null}
            {activeManagementTab === 'history' ? <PersonRecoveryPanel treeId={selectedTree.id} userId={userId ?? ''} isOwner={isOwner} canEdit={canEdit} people={people} history={approvalRequests} /> : null}
        {activeManagementTab === 'overview' ? (
          <>
<OverviewSection
            selectedTree={selectedTree}
            people={people}
            role={role}
            isOwner={isOwner}
            currentUserLabel={currentUserLabel}
            currentAssignedPerson={currentAssignedPerson}
            currentSelfAssignmentSuggestions={currentSelfAssignmentSuggestions}
            canCreateSelfProfile={canCreateSelfProfile}
            mutating={mutating}
            userId={userId ?? ""}
            treeSurnameVariants={treeSurnameVariants}
            unlinkedCollaboratorCount={unlinkedCollaboratorCount}
            linkSearchQuery={linkSearchQuery}
            filteredLinkPeople={filteredLinkPeople}
            onOpenHelperDialog={openHelperDialog}
            onOpenSurnameVariantDialog={openSurnameVariantDialog}
            onSetTreeDiscoverability={onSetTreeDiscoverability}
            onSetTreeKinshipSystem={onSetTreeKinshipSystem}
            onOpenAddSelf={onOpenAddSelf}
            openPersonProfile={openPersonProfile}
            onAssignPersonToUser={onAssignPersonToUser}
            openConfirm={openConfirm}
            onClearSelfAssignment={onClearSelfAssignment}
            setLinkSearchQuery={setLinkSearchQuery}
          />
</>
        ) : null}

        {activeManagementTab === 'collaborators' ? (
          <>
          <View style={[getTreeSettingsFamilyMemberCardStyle(theme), { gap: 8 }]}><Button disabled={!selectedTree.discoverable} onPress={() => { void Share.share({ message: buildTreeInvitationLink(selectedTree.id) }); }}>{t('Share invitation link')}</Button>
<Text>{t('Invitation links require discovery to be enabled and owner approval to join.')}</Text>
</View>
          {isOwner ? <View style={[getTreeSettingsFamilyMemberCardStyle(theme), { gap: 12 }]}>
            <Text variant="titleMedium">{t('Access requests')} ({accessRequests.length})</Text>
            {loadingNotifications ? <ProgressBar indeterminate /> : accessRequests.length === 0 ? <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('No pending access requests.')}</Text> : accessRequests.map(request => <View key={request.id} style={{ gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.outlineVariant, paddingTop: 12 }}>
              <Text variant="titleSmall">{request.requestedByLabel}</Text><Text>{request.message}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button mode="contained" disabled={mutating} onPress={() => openConfirm(t('Approve access'), t('Allow this person to join your tree?'), t('Approve'), () => onRespondToTreeAccessRequest(request.id, 'accepted'))}>{t('Approve')}</Button>
                <Button mode="outlined" disabled={mutating} onPress={() => openConfirm(t('Decline access'), t('Decline this request to join your tree?'), t('Decline'), () => onRespondToTreeAccessRequest(request.id, 'rejected'))}>{t('Decline')}</Button>
              </View>
            </View>)}
          </View> : null}
          <CollaboratorsSection
            selectedTree={selectedTree}
            people={people}
            assignedPersonByUserId={assignedPersonByUserId}
            assignedUserIdByPersonId={assignedUserIdByPersonId}
            role={role}
            canManageCollaborators={canEdit}
            isOwner={isOwner}
            userId={userId ?? ""}
            mutating={mutating}
            ownerLinkTargetUserId={ownerLinkTargetUserId}
            ownerLinkSearchQuery={ownerLinkSearchQuery}
            filteredOwnerLinkPeople={pagedOwnerLinkPeople}
            ownerLinkPage={ownerLinkPage}
            ownerLinkTotalPages={ownerLinkTotalPages}
            onOpenHelperDialog={openHelperDialog}
            onOpenCollaboratorDialog={onOpenCollaboratorDialog}
            openConfirm={openConfirm}
            onRemoveCollaborator={onRemoveCollaborator}
            onAssignPersonToUser={onAssignPersonToUser}
            setOwnerLinkSearchQuery={setOwnerLinkSearchQuery}
            setOwnerLinkPage={setOwnerLinkPage}
            toggleOwnerLinkChooser={(targetUserId) => {
              setOwnerLinkTargetUserId((current) => (current === targetUserId ? null : targetUserId));
              setOwnerLinkSearchQuery('');
              setOwnerLinkPage(1);
            }}
            clearOwnerLinkChooser={() => {
              setOwnerLinkTargetUserId(null);
              setOwnerLinkSearchQuery('');
              setOwnerLinkPage(1);
            }}
          />
          </>
        ) : null}

        {activeManagementTab === 'approvals' ? (
          <ApprovalsSection
            pendingApprovalRequests={pendingApprovalRequests}
            approvalWindowHours={approvalWindowHours}
            approvalWindowValue={approvalWindowValue}
            approvalsDisabled={approvalsDisabled}
            isOwner={isOwner}
            userId={userId ?? ""}
            mutating={mutating}
            onOpenHelperDialog={openHelperDialog}
            onSetApprovalWindowHours={onSetApprovalWindowHours}
            onApproveApprovalRequest={onApproveApprovalRequest}
            onRejectApprovalRequest={onRejectApprovalRequest}
            setPreviewApprovalRequest={setPreviewApprovalRequest}
          />
        ) : null}

        {activeManagementTab === 'merges' ? (
          <MergesSection
            selectedTree={selectedTree}
            notifications={notifications}
            trees={trees}
            mergePreview={mergePreview}
            pendingMergeRequests={pendingMergeRequests}
            highlightedMergeRequestId={highlightedMergeRequestId}
            mergeSelectionDrafts={mergeSelectionDrafts}
            availableMergeSourceTrees={availableMergeSourceTrees}
            canEdit={canEdit}
            userId={userId ?? ""}
            mutating={mutating}
            onOpenHelperDialog={openHelperDialog}
            setMergePreviewVisible={setMergePreviewVisible}
            setMergeHistoryVisible={setMergeHistoryVisible}
            toggleMergeSelection={toggleMergeSelection}
            onCreateMergeRequest={onCreateMergeRequest}
            onSendMergeInvite={onSendMergeInvite}
            onRespondToMergeInvite={onRespondToMergeInvite}
            onRequestTreeAccess={onRequestTreeAccess}
            onRequestTreeAccessByIdentifier={onRequestTreeAccessByIdentifier}
            onSearchDiscoverableTrees={onSearchDiscoverableTrees}
            onLoadMergePreview={onLoadMergePreview}
            onApproveMergeRequest={onApproveMergeRequest}
            onRequestMergeChanges={onRequestMergeChanges}
            onRejectMergeRequest={onRejectMergeRequest}
          />
        ) : null}

        {activeManagementTab === 'trees' ? (
          <TreesSection
            selectedTree={selectedTree}
            trees={trees}
            defaultTreeId={defaultTreeId}
            loadingTrees={loadingTrees}
            userId={userId ?? ""}
            mutating={mutating}
            maidenSurnameSuggestions={maidenSurnameSuggestions}
            onOpenHelperDialog={openHelperDialog}
            onCreateSurnameTree={onCreateSurnameTree}
            onCreateTree={onCreateTree}
            onEditTree={onEditTree}
            onToggleDefaultTree={onToggleDefaultTree}
            onSwitchTree={onSwitchTree}
            onCopyTreeId={handleCopyTreeId}
          />
        ) : null}
      </View>
      </View></View>

      <InfoDialog
        visible={helperDialog.visible}
        title={t(TREE_HELPER_COPY[helperDialog.key].title)}
        message={t(TREE_HELPER_COPY[helperDialog.key].message)}
        onDismiss={() => setHelperDialog((current) => ({ ...current, visible: false }))}
      />

      <Portal>
        <Dialog
          visible={surnameVariantDialogVisible}
          onDismiss={() => {
            setSurnameVariantDraft('');
            setSurnameVariantDrafts(treeSurnameVariants);
            setSurnameVariantDialogVisible(false);
          }}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>{t(K.treeSettings.manageVariants)}</Dialog.Title>
          {surnameVariantDialogVisible ? (
            <>
              <Dialog.Content style={dialogChrome.content}>
                <Text variant="bodySmall" style={{ marginBottom: 12, color: theme.colors.onSurfaceVariant }}>
                  {t(K.treeSettings.addAlternateSurnameHelper)}
                </Text>
                <TextInput mode="outlined" label={t(K.treeSettings.addVariant)} value={surnameVariantDraft} onChangeText={setSurnameVariantDraft} onSubmitEditing={handleAddSurnameVariantDraft} style={{ marginBottom: 12 }} />
                <Button mode="contained" icon="plus" onPress={handleAddSurnameVariantDraft} disabled={!surnameVariantDraft.trim()} style={[BUTTON_CHROME, { marginBottom: 12 }]} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                  {t(K.treeSettings.addVariant)}
                </Button>
                <View style={styles.collaboratorChipRow}>
                  {surnameVariantDrafts.length > 0 ? surnameVariantDrafts.map((variant) => (
                    <Chip key={`dialog-${variant}`} compact icon="close-circle-outline" onPress={() => handleRemoveSurnameVariantDraft(variant)}>
                      {variant}
                    </Chip>
                  )) : <Chip compact icon="information-outline">{t(K.treeSettings.variantsAppearAsChips)}</Chip>}
                </View>
              </Dialog.Content>
              <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
                <Button onPress={() => {
                  setSurnameVariantDraft('');
                  setSurnameVariantDrafts(treeSurnameVariants);
                  setSurnameVariantDialogVisible(false);
                }} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                  {t(K.common.cancel)}
                </Button>
                <Button mode="contained" onPress={handleSaveSurnameVariants} disabled={mutating} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                  {t(K.common.save)}
                </Button>
              </Dialog.Actions>
            </>
          ) : null}
        </Dialog>

        <Dialog visible={!!previewApprovalRequest} onDismiss={() => setPreviewApprovalRequest(null)} style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}>
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
            {previewApprovalRequest?.title ?? t(K.treeSettings.approvalPreview)}
          </Dialog.Title>
          <IconButton icon="close" size={20} onPress={() => setPreviewApprovalRequest(null)} style={dialogChrome.closeButton} accessibilityLabel={t(K.common.close)} />
          {previewApprovalRequest ? (
            <Dialog.ScrollArea style={dialogChrome.scrollArea}>
              <ScrollView contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
                <View>
                  <View style={styles.collaboratorChipRow}>
                    <Chip compact icon="swap-horizontal">{getApprovalOperationLabel(previewApprovalRequest.operation)}</Chip>
                    <Chip compact icon="account">{previewApprovalRequest.requestedByLabel}</Chip>
                  </View>

                  {previewApprovalRequest.entityType === 'person' ? (
                    <View style={{ marginTop: 16, gap: 12 }}>
                      {previewPersonFields.length > 0 ? previewPersonFields.map((field) => (
                        <View key={`${previewApprovalRequest.id}-${field.label}`}>
                          <Text variant="labelLarge">{field.label}</Text>
                          {field.before !== undefined && field.before !== null ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>{t(K.treeSettings.beforeValue, { value: field.before })}</Text> : null}
                          {field.after !== undefined && field.after !== null ? <Text variant="bodySmall" style={{ marginTop: 2 }}>{t(K.treeSettings.afterValue, { value: field.after })}</Text> : null}
                        </View>
                      )) : <Text variant="bodyMedium">{t(K.treeSettings.noFieldLevelPreview)}</Text>}
                      {previewBundledRelationships.length > 0 ? (
                        <View style={{ gap: 12 }}>
                          <Text variant="titleSmall">{t(K.treeSettings.includedRelationships)}</Text>
                          {previewBundledRelationships.map((relationship) => {
                            const fields = buildRelationshipApprovalPreviewFields(null, relationship, peopleById);
                            return (
                              <View key={`${previewApprovalRequest.id}-${relationship.id}`} style={{ gap: 8 }}>
                                {fields.map((field) => (
                                  <View key={`${previewApprovalRequest.id}-${relationship.id}-${field.label}`}>
                                    <Text variant="labelLarge">{field.label}</Text>
                                    {field.after !== undefined && field.after !== null ? <Text variant="bodySmall" style={{ marginTop: 2 }}>{t(K.treeSettings.afterValue, { value: field.after })}</Text> : null}
                                  </View>
                                ))}
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={{ marginTop: 16, gap: 12 }}>
                      {previewRelationshipFields.length > 0 ? previewRelationshipFields.map((field) => (
                        <View key={`${previewApprovalRequest.id}-${field.label}`}>
                          <Text variant="labelLarge">{field.label}</Text>
                          {field.before !== undefined && field.before !== null ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>{t(K.treeSettings.beforeValue, { value: field.before })}</Text> : null}
                          {field.after !== undefined && field.after !== null ? <Text variant="bodySmall" style={{ marginTop: 2 }}>{t(K.treeSettings.afterValue, { value: field.after })}</Text> : null}
                        </View>
                      )) : <Text variant="bodyMedium">{t(K.treeSettings.noFieldLevelPreview)}</Text>}
                    </View>
                  )}
                </View>
              </ScrollView>
            </Dialog.ScrollArea>
          ) : null}
        </Dialog>

        <Dialog visible={mergePreviewVisible} onDismiss={() => setMergePreviewVisible(false)} style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}>
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(K.treeSettings.mergePreview)}</Dialog.Title>
          <IconButton icon="close" size={20} onPress={() => setMergePreviewVisible(false)} style={dialogChrome.closeButton} accessibilityLabel={t(K.common.close)} />
          {mergePreviewVisible ? (
            <Dialog.ScrollArea style={dialogChrome.scrollArea}>
              <ScrollView contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
                {mergePreview ? (
                  <View>
                  <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {t(K.treeSettings.mergePreviewSummary, {
                      source: mergePreview.sourceTree.treeName,
                      sourceCount: mergePreview.sourceTree.personCount,
                      target: mergePreview.targetTree.treeName,
                      targetCount: mergePreview.targetTree.personCount,
                    })}
                  </Text>
                  <View style={styles.summaryChipRow}>
                    <Chip compact icon="account-switch">{t(K.treeSettings.possibleMatchesCount, { count: mergePreview.matches.length })}</Chip>
                    <Chip compact icon="source-branch-plus">{t(K.treeSettings.newBranchesCount, { count: mergePreview.newBranchCount })}</Chip>
                    <Chip compact icon="alert-circle-outline">{t(K.treeSettings.conflictsCount, { count: mergePreview.conflicts.length })}</Chip>
                  </View>
                  {mergePreview.matches.slice(0, 6).map((match) => (
                    <View key={match.id} style={{ marginTop: 12 }}>
                      <View style={styles.collaboratorChipRow}>
                        <Chip compact icon="gauge">{match.confidenceScore}%</Chip>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{match.confidenceLabel}</Text>
                      </View>
                      <ProgressBar progress={match.confidenceScore / 100} style={{ marginTop: 6, height: 8, borderRadius: 999 }} />
                      <Text variant="bodySmall" style={{ marginTop: 6 }}>{match.guidedQuestions[0]?.prompt}</Text>
                      {match.conflicts.length > 0 ? (
                        <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>
                          {t(K.treeSettings.conflictsFields, { fields: match.conflicts.map((conflict) => conflict.field).join(', ') })}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text variant="titleMedium">{t(K.treeSettings.noMergePreviewLoaded)}</Text>
                  </View>
                )}
              </ScrollView>
            </Dialog.ScrollArea>
          ) : null}
        </Dialog>

        <Dialog visible={mergeHistoryVisible} onDismiss={() => setMergeHistoryVisible(false)} style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}>
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(K.treeSettings.mergeHistoryAndUndo)}</Dialog.Title>
          <IconButton icon="close" size={20} onPress={() => setMergeHistoryVisible(false)} style={dialogChrome.closeButton} accessibilityLabel={t(K.common.close)} />
          {mergeHistoryVisible ? (
            <Dialog.ScrollArea style={dialogChrome.scrollArea}>
              {mergeHistory.length > 0 ? (
                <FlatList
                  data={mergeHistory}
                  keyExtractor={(entry) => entry.id}
                  renderItem={renderMergeHistoryItem}
                  contentContainerStyle={{ paddingBottom: 8 }}
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={8}
                  maxToRenderPerBatch={8}
                  windowSize={6}
                  removeClippedSubviews
                />
              ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
                  <View style={styles.emptyState}>
                    <Text variant="titleMedium">{t(K.treeSettings.noMergeHistoryYet)}</Text>
                    <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                      {t(K.treeSettings.mergeHistoryEmpty)}
                    </Text>
                  </View>
                </ScrollView>
              )}
            </Dialog.ScrollArea>
          ) : null}
        </Dialog>
      </Portal>

      <FloatingSnackbar visible={copyNoticeVisible} onDismiss={() => setCopyNoticeVisible(false)} duration={2200} action={{ label: t(K.common.dismiss), onPress: () => setCopyNoticeVisible(false) }}>
        {copyNoticeMessage}
      </FloatingSnackbar>
      </ScrollView>
    </View>
  );
}

export const TreeSettingsView = TreeSettingsContent;
