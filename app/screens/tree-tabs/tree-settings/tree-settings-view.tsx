import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, IconButton, Portal, ProgressBar, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
import { HorizontalTabStrip } from '../../../../components';
import type { ApprovalRequest } from '../../../../components/dto/approval';
import type { PersonRecord } from '../../../../components/dto/person';
import {
  canEditTreeContent,
  getTreeApprovalWindowHours,
  getTreeRole,
  getUnlinkedCollaborators,
} from '../../../../components/dto/tree';
import { GlobalStyles } from '../../../../constants/styles';
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
  TREE_HELPER_COPY,
  TREE_MANAGEMENT_TABS,
  type TreeHelperDialogKey,
  type TreeManagementTabKey,
} from './tree-settings-shared';
import { TreesSection } from './trees-section';

const dialogChrome = GlobalStyles.dialogChrome;
const styles = GlobalStyles.treeDetail;

const settingsTabStripStyles = StyleSheet.create({
  card: {
    borderRadius: 28,
    marginTop: 8,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#1F2C1B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  content: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 2,
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
  onOpenCollaboratorDialog,
  openConfirm,
  onRemoveCollaborator,
  onOpenAddSelf,
  onAssignPersonToUser,
  onClearSelfAssignment,
  openPersonProfile,
  onApproveApprovalRequest,
  onRejectApprovalRequest,
  onSetApprovalWindowHours,
  onSetSurnameVariantGroups,
  onSendMergeInvite,
  onRespondToMergeInvite,
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
  onSwitchTree,
}: SharedTabProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [helperDialog, setHelperDialog] = useState<{ visible: boolean; key: TreeHelperDialogKey }>({
    visible: false,
    key: 'tree-management',
  });
  const [activeManagementTab, setActiveManagementTab] = useState<TreeManagementTabKey>('overview');
  const [showLinkChooser, setShowLinkChooser] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [ownerLinkTargetUserId, setOwnerLinkTargetUserId] = useState<string | null>(null);
  const [ownerLinkSearchQuery, setOwnerLinkSearchQuery] = useState('');
  const [mergeInviteIdentifier, setMergeInviteIdentifier] = useState('');
  const [mergeInviteSourceTreeId, setMergeInviteSourceTreeId] = useState(selectedTree.id);
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

  const treeSurnameVariants = useMemo(
    () => [...new Set(selectedTree.surnameVariantGroups.flatMap((group) => [group.primarySurname, ...group.variants]).map((value) => value.trim()).filter(Boolean))],
    [selectedTree.surnameVariantGroups],
  );

  const unlinkedCollaboratorCount = useMemo(
    () => getUnlinkedCollaborators(selectedTree).filter((collaborator) => collaborator.userId !== userId).length,
    [selectedTree, userId],
  );

  const filteredLinkPeople = useMemo(() => {
    const normalizedQuery = linkSearchQuery.trim().toLowerCase();

    return availableSelfLinkPeople
      .filter((person) => person.id !== currentAssignedPerson?.id)
      .filter((person) => {
        if (!normalizedQuery) {
          return true;
        }

        return [person.firstName, person.lastName, person.birthDate, person.notes]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [availableSelfLinkPeople, currentAssignedPerson?.id, linkSearchQuery]);

  const filteredOwnerLinkPeople = useMemo(() => {
    if (!ownerLinkTargetUserId) {
      return [] as PersonRecord[];
    }

    const normalizedQuery = ownerLinkSearchQuery.trim().toLowerCase();

    return people
      .filter((person) => {
        const assignedUserId = assignedUserIdByPersonId.get(person.id);
        if (assignedUserId && assignedUserId !== ownerLinkTargetUserId) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [person.firstName, person.lastName, person.birthDate, person.notes]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [assignedUserIdByPersonId, ownerLinkSearchQuery, ownerLinkTargetUserId, people]);

  const pendingApprovalRequests = useMemo(
    () => approvalRequests.filter((request) => request.status === 'pending'),
    [approvalRequests],
  );

  const availableMergeSourceTrees = useMemo(
    () => (trees ?? []).filter((tree) => canEditTreeContent(tree, userId)),
    [trees, userId],
  );

  const maidenSurnameSuggestions = useMemo(() => {
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

    return [...counts.entries()]
      .map(([key, value]) => ({
        surname: value.surname,
        count: value.count,
        existingTree: existingTreeLookup.get(key) ?? null,
      }))
      .filter((suggestion) => !suggestion.existingTree)
      .sort((left, right) => right.count - left.count || left.surname.localeCompare(right.surname));
  }, [people, selectedTree.surnameVariantGroups, trees]);

  const approvalWindowHours = useMemo(() => getTreeApprovalWindowHours(selectedTree), [selectedTree]);
  const approvalsDisabled = approvalWindowHours === 0;
  const approvalWindowValue = useMemo(() => {
    if (approvalWindowHours <= 0) return '0';
    if (approvalWindowHours <= 12) return '12';
    if (approvalWindowHours <= 24) return '24';
    return '48';
  }, [approvalWindowHours]);

  const pendingMergeRequests = useMemo(
    () => mergeRequests.filter((request) => request.status === 'pending' || request.status === 'changes-requested'),
    [mergeRequests],
  );

  const mergeRequestsById = useMemo(
    () => new Map(mergeRequests.map((request) => [request.id, request])),
    [mergeRequests],
  );

  useEffect(() => {
    if (mergePreview) {
      setMergePreviewVisible(true);
    }
  }, [mergePreview]);

  useEffect(() => {
    if (availableMergeSourceTrees.some((tree) => tree.id === mergeInviteSourceTreeId)) {
      return;
    }

    setMergeInviteSourceTreeId(availableMergeSourceTrees[0]?.id ?? selectedTree.id);
  }, [availableMergeSourceTrees, mergeInviteSourceTreeId, selectedTree.id]);

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
    if (!treeSettingsFocus) {
      return;
    }

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
      setCopyNoticeMessage(t('Tree ID copied'));
      setCopyNoticeVisible(true);
      return;
    }

    await Share.share({ message: treeId });
    setCopyNoticeMessage(t('Tree ID ready to share'));
    setCopyNoticeVisible(true);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View>
        <View style={styles.titleWithHelperRow}>
          <Text variant="headlineSmall">{selectedTree.name}</Text>
          <IconButton
            icon="information-outline"
            size={20}
            style={styles.helperIconButton}
            onPress={() => openHelperDialog('tree-management')}
            accessibilityLabel={t('About tree management')}
          />
        </View>

        <HorizontalTabStrip
          items={TREE_MANAGEMENT_TABS.map((tab) => ({ ...tab, label: t(tab.label) }))}
          activeKey={activeManagementTab}
          onChange={setActiveManagementTab}
          containerStyle={[settingsTabStripStyles.card, { backgroundColor: theme.colors.surface }]}
          contentContainerStyle={settingsTabStripStyles.content}
          itemStyle={settingsTabStripStyles.item}
        />

        {activeManagementTab === 'overview' ? (
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
            userId={userId}
            treeSurnameVariants={treeSurnameVariants}
            unlinkedCollaboratorCount={unlinkedCollaboratorCount}
            showLinkChooser={showLinkChooser}
            linkSearchQuery={linkSearchQuery}
            filteredLinkPeople={filteredLinkPeople}
            onOpenHelperDialog={openHelperDialog}
            onOpenSurnameVariantDialog={openSurnameVariantDialog}
            onOpenAddSelf={onOpenAddSelf}
            openPersonProfile={openPersonProfile}
            onAssignPersonToUser={onAssignPersonToUser}
            openConfirm={openConfirm}
            onClearSelfAssignment={onClearSelfAssignment}
            setShowLinkChooser={setShowLinkChooser}
            setLinkSearchQuery={setLinkSearchQuery}
          />
        ) : null}

        {activeManagementTab === 'collaborators' ? (
          <CollaboratorsSection
            selectedTree={selectedTree}
            people={people}
            assignedPersonByUserId={assignedPersonByUserId}
            assignedUserIdByPersonId={assignedUserIdByPersonId}
            role={role}
            isOwner={isOwner}
            userId={userId}
            mutating={mutating}
            ownerLinkTargetUserId={ownerLinkTargetUserId}
            ownerLinkSearchQuery={ownerLinkSearchQuery}
            filteredOwnerLinkPeople={filteredOwnerLinkPeople}
            onOpenHelperDialog={openHelperDialog}
            onOpenCollaboratorDialog={onOpenCollaboratorDialog}
            openConfirm={openConfirm}
            onRemoveCollaborator={onRemoveCollaborator}
            onAssignPersonToUser={onAssignPersonToUser}
            setOwnerLinkSearchQuery={setOwnerLinkSearchQuery}
            toggleOwnerLinkChooser={(targetUserId) => {
              setOwnerLinkTargetUserId((current) => (current === targetUserId ? null : targetUserId));
              setOwnerLinkSearchQuery('');
            }}
            clearOwnerLinkChooser={() => {
              setOwnerLinkTargetUserId(null);
              setOwnerLinkSearchQuery('');
            }}
          />
        ) : null}

        {activeManagementTab === 'approvals' ? (
          <ApprovalsSection
            pendingApprovalRequests={pendingApprovalRequests}
            approvalWindowHours={approvalWindowHours}
            approvalWindowValue={approvalWindowValue}
            approvalsDisabled={approvalsDisabled}
            isOwner={isOwner}
            userId={userId}
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
            mergeInviteIdentifier={mergeInviteIdentifier}
            mergeInviteSourceTreeId={mergeInviteSourceTreeId}
            availableMergeSourceTrees={availableMergeSourceTrees}
            canEdit={canEdit}
            mutating={mutating}
            onOpenHelperDialog={openHelperDialog}
            setMergeInviteIdentifier={setMergeInviteIdentifier}
            setMergeInviteSourceTreeId={setMergeInviteSourceTreeId}
            setMergePreviewVisible={setMergePreviewVisible}
            setMergeHistoryVisible={setMergeHistoryVisible}
            toggleMergeSelection={toggleMergeSelection}
            onSendMergeInvite={onSendMergeInvite}
            onRespondToMergeInvite={onRespondToMergeInvite}
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
            userId={userId}
            mutating={mutating}
            maidenSurnameSuggestions={maidenSurnameSuggestions}
            onOpenHelperDialog={openHelperDialog}
            onCreateSurnameTree={onCreateSurnameTree}
            onCreateTree={onCreateTree}
            onEditTree={onEditTree}
            onSwitchTree={onSwitchTree}
            onCopyTreeId={handleCopyTreeId}
          />
        ) : null}
      </View>

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
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodySmall" style={{ marginBottom: 12, color: theme.colors.onSurfaceVariant }}>
              {t('Add every alternate spelling or related surname that should be recognized anywhere in this tree.')}
            </Text>
            <TextInput mode="outlined" label={t(K.treeSettings.addVariant)} value={surnameVariantDraft} onChangeText={setSurnameVariantDraft} onSubmitEditing={handleAddSurnameVariantDraft} style={{ marginBottom: 12 }} />
            <Button mode="contained-tonal" icon="plus" onPress={handleAddSurnameVariantDraft} disabled={!surnameVariantDraft.trim()} style={{ marginBottom: 12 }}>
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
            }}>
              {t(K.common.cancel)}
            </Button>
            <Button mode="contained" onPress={handleSaveSurnameVariants} disabled={mutating}>
              {t(K.common.save)}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={helperDialog.visible} onDismiss={() => setHelperDialog((current) => ({ ...current, visible: false }))} style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}>
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(TREE_HELPER_COPY[helperDialog.key].title)}</Dialog.Title>
          <IconButton icon="close" size={20} onPress={() => setHelperDialog((current) => ({ ...current, visible: false }))} style={dialogChrome.closeButton} accessibilityLabel={t(K.common.close)} />
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium">{t(TREE_HELPER_COPY[helperDialog.key].message)}</Text>
          </Dialog.Content>
        </Dialog>

        <Dialog visible={!!previewApprovalRequest} onDismiss={() => setPreviewApprovalRequest(null)} style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}>
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
            {previewApprovalRequest?.title ?? t('Approval preview')}
          </Dialog.Title>
          <IconButton icon="close" size={20} onPress={() => setPreviewApprovalRequest(null)} style={dialogChrome.closeButton} accessibilityLabel={t(K.common.close)} />
          <Dialog.ScrollArea style={dialogChrome.scrollArea}>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
              {previewApprovalRequest ? (
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
                          {field.before !== undefined && field.before !== null ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>{t('Before: {value}', { value: field.before })}</Text> : null}
                          {field.after !== undefined && field.after !== null ? <Text variant="bodySmall" style={{ marginTop: 2 }}>{t('After: {value}', { value: field.after })}</Text> : null}
                        </View>
                      )) : <Text variant="bodyMedium">{t(K.treeSettings.noFieldLevelPreview)}</Text>}
                    </View>
                  ) : (
                    <View style={{ marginTop: 16, gap: 12 }}>
                      {previewRelationshipFields.length > 0 ? previewRelationshipFields.map((field) => (
                        <View key={`${previewApprovalRequest.id}-${field.label}`}>
                          <Text variant="labelLarge">{field.label}</Text>
                          {field.before !== undefined && field.before !== null ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>{t('Before: {value}', { value: field.before })}</Text> : null}
                          {field.after !== undefined && field.after !== null ? <Text variant="bodySmall" style={{ marginTop: 2 }}>{t('After: {value}', { value: field.after })}</Text> : null}
                        </View>
                      )) : <Text variant="bodyMedium">{t(K.treeSettings.noFieldLevelPreview)}</Text>}
                    </View>
                  )}
                </View>
              ) : null}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>

        <Dialog visible={mergePreviewVisible} onDismiss={() => setMergePreviewVisible(false)} style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}>
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t('Merge preview')}</Dialog.Title>
          <IconButton icon="close" size={20} onPress={() => setMergePreviewVisible(false)} style={dialogChrome.closeButton} accessibilityLabel={t(K.common.close)} />
          <Dialog.ScrollArea style={dialogChrome.scrollArea}>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
              {mergePreview ? (
                <View>
                  <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {t('{source} ({sourceCount}) to {target} ({targetCount})', {
                      source: mergePreview.sourceTree.treeName,
                      sourceCount: mergePreview.sourceTree.personCount,
                      target: mergePreview.targetTree.treeName,
                      targetCount: mergePreview.targetTree.personCount,
                    })}
                  </Text>
                  <View style={styles.summaryChipRow}>
                    <Chip compact icon="account-switch">{t('{count} possible matches', { count: mergePreview.matches.length })}</Chip>
                    <Chip compact icon="source-branch-plus">{t('{count} new branches', { count: mergePreview.newBranchCount })}</Chip>
                    <Chip compact icon="alert-circle-outline">{t('{count} conflicts', { count: mergePreview.conflicts.length })}</Chip>
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
                          {t('Conflicts: {fields}', { fields: match.conflicts.map((conflict) => conflict.field).join(', ') })}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text variant="titleMedium">{t('No merge preview loaded')}</Text>
                </View>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>

        <Dialog visible={mergeHistoryVisible} onDismiss={() => setMergeHistoryVisible(false)} style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}>
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(K.treeSettings.mergeHistoryAndUndo)}</Dialog.Title>
          <IconButton icon="close" size={20} onPress={() => setMergeHistoryVisible(false)} style={dialogChrome.closeButton} accessibilityLabel={t(K.common.close)} />
          <Dialog.ScrollArea style={dialogChrome.scrollArea}>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
              {mergeHistory.length > 0 ? (
                <View style={styles.collaboratorList}>
                  {mergeHistory.map((entry) => (
                    <View key={entry.id} style={{ marginBottom: 12 }}>
                      <View style={[styles.collaboratorCard, { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 16 }]}>
                        {(() => {
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
                            <>
                              <Text variant="titleMedium">{entry.summary}</Text>
                              <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                                {t('{matches} reviewed matches · {approvals} approval actions · {people} people changed', {
                                  matches: entry.preview.matches.length,
                                  approvals: entry.approvals.length,
                                  people: entry.changedPersonIds.length,
                                })}
                              </Text>
                              <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
                                <Chip compact icon="history">{entry.status}</Chip>
                                <Chip compact icon="calendar-clock">{entry.createdAt.slice(0, 16).replace('T', ' ')}</Chip>
                              </View>
                              <Button mode="outlined" icon="undo" onPress={() => onUndoMerge(entry.mergeRequestId)} disabled={mutating || entry.status !== 'applied'} style={{ marginTop: 8 }}>
                                {t('Preview and undo merge')}
                              </Button>
                              {canGrantViewerAccess ? (
                                <Button mode="contained-tonal" icon="account-eye-outline" onPress={() => onGrantMergeViewerAccess(entry.mergeRequestId, selectedTree.id)} disabled={mutating} style={{ marginTop: 8 }}>
                                  {t('Grant viewer access to {name}', { name: mergeRequest?.suggestedByLabel ?? t('requester') })}
                                </Button>
                              ) : null}
                            </>
                          );
                        })()}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text variant="titleMedium">{t('No merge history yet')}</Text>
                  <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                    {t('Applied or rejected merge activity, approval history, confidence scores, and undoable snapshots will appear here.')}
                  </Text>
                </View>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>

      <Snackbar visible={copyNoticeVisible} onDismiss={() => setCopyNoticeVisible(false)} duration={2200} action={{ label: t(K.common.dismiss), onPress: () => setCopyNoticeVisible(false) }}>
        {copyNoticeMessage}
      </Snackbar>
    </ScrollView>
  );
}

export const TreeSettingsView = TreeSettingsContent;
