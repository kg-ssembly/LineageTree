import React from 'react';
import { Pressable, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Divider, IconButton, ProgressBar, Text, TextInput, useTheme } from 'react-native-paper';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, GlobalStyles, HorizontalTabStrip, Reveal, SectionCard, TabStripCard } from '../../../../components';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import type { MergesSectionProps } from './tree-settings-shared';
import { getTreeSettingsFamilyMemberCardStyle } from './tree-settings-shared';

const styles = GlobalStyles.treeDetail;
const RESULTS_PER_PAGE = 5;

type RequestAccessTabKey = 'search' | 'direct';

export function MergesSection({
  selectedTree,
  notifications,
  mergePreview,
  pendingMergeRequests,
  highlightedMergeRequestId,
  mergeSelectionDrafts,
  availableMergeSourceTrees,
  canEdit,
  userId,
  mutating,
  onOpenHelperDialog,
  setMergePreviewVisible,
  setMergeHistoryVisible,
  toggleMergeSelection,
  onCreateMergeRequest,
  onRespondToMergeInvite,
  onRequestTreeAccess,
  onRequestTreeAccessByIdentifier,
  onSearchDiscoverableTrees,
  onLoadMergePreview,
  onApproveMergeRequest,
  onRequestMergeChanges,
  onRejectMergeRequest,
}: MergesSectionProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [mergeSourceTreeId, setMergeSourceTreeId] = React.useState(selectedTree.id);
  const [mergeTargetTreeId, setMergeTargetTreeId] = React.useState('');
  const [requestAccessTab, setRequestAccessTab] = React.useState<RequestAccessTabKey>('search');
  const [accessSearchQuery, setAccessSearchQuery] = React.useState('');
  const [accessIdentifierQuery, setAccessIdentifierQuery] = React.useState('');
  const [accessResults, setAccessResults] = React.useState<Awaited<ReturnType<MergesSectionProps['onSearchDiscoverableTrees']>>>([]);
  const [accessSearching, setAccessSearching] = React.useState(false);
  const [accessResultsPage, setAccessResultsPage] = React.useState(1);

  const pendingMergeInvites = notifications.filter((notification) => notification.type === 'merge-invite' && notification.status === 'pending');
  const pendingTreeAccessRequests = notifications.filter((notification) => notification.type === 'tree-access-response' && notification.status === 'pending');
  const pendingRequestTreeIds = new Set(pendingTreeAccessRequests.map((notification) => notification.sourceTreeId));
  const pendingIdentifierKeys = new Set(
    pendingTreeAccessRequests
      .map((notification) => notification.targetIdentifier.trim().toLowerCase())
      .filter(Boolean),
  );
  const mergeTargetOptions = React.useMemo(
    () => availableMergeSourceTrees.filter((tree) => tree.id !== mergeSourceTreeId),
    [availableMergeSourceTrees, mergeSourceTreeId],
  );
  const totalAccessPages = Math.max(1, Math.ceil(accessResults.length / RESULTS_PER_PAGE));
  const pagedAccessResults = accessResults.slice((accessResultsPage - 1) * RESULTS_PER_PAGE, accessResultsPage * RESULTS_PER_PAGE);

  React.useEffect(() => {
    if (availableMergeSourceTrees.some((tree) => tree.id === mergeSourceTreeId)) {
      return;
    }

    setMergeSourceTreeId(availableMergeSourceTrees[0]?.id ?? selectedTree.id);
  }, [availableMergeSourceTrees, mergeSourceTreeId, selectedTree.id]);

  React.useEffect(() => {
    if (mergeTargetOptions.some((tree) => tree.id === mergeTargetTreeId)) {
      return;
    }

    setMergeTargetTreeId(mergeTargetOptions[0]?.id ?? '');
  }, [mergeTargetOptions, mergeTargetTreeId]);

  const handleUseMergeInvite = async (notification: MergesSectionProps['notifications'][number]) => {
    await onLoadMergePreview(notification.sourceTreeId, selectedTree.id);
    await onRespondToMergeInvite(notification.id, 'accepted');
  };

  const handlePreviewMerge = async () => {
    await onLoadMergePreview(mergeSourceTreeId, mergeTargetTreeId);
  };

  const handleCreateMerge = async () => {
    await onCreateMergeRequest(mergeSourceTreeId, mergeTargetTreeId);
  };

  const handleSearch = async () => {
    setAccessSearching(true);
    try {
      const nextResults = await onSearchDiscoverableTrees(accessSearchQuery);
      setAccessResults(nextResults);
      setAccessResultsPage(1);
    } finally {
      setAccessSearching(false);
    }
  };

  const handleIdentifierRequest = async () => {
    await onRequestTreeAccessByIdentifier(accessIdentifierQuery);
    setAccessIdentifierQuery('');
  };

  const handleRequestAccess = async (treeId: string) => {
    await onRequestTreeAccess(treeId);
  };

  return (
    <Reveal delay={80}>
      <View style={styles.collaboratorSectionWrap}>
        <View style={styles.sectionHeader}>
          <View style={styles.titleWrap}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleLarge">{t(K.notifications.merge)}</Text>
              <IconButton
                icon="information-outline"
                size={18}
                style={styles.helperIconButton}
                onPress={() => onOpenHelperDialog('merge-guidance')}
                accessibilityLabel={t(K.treeSettings.aboutCollaborativeMerges)}
              />
            </View>
          </View>
        </View>

        {pendingMergeInvites.length > 0 ? (
          <Reveal delay={90}>
            <SectionCard style={[styles.collaboratorCard, getTreeSettingsFamilyMemberCardStyle(theme), { marginBottom: 16 }]}>
              <View style={styles.titleWithHelperRow}>
                <Text variant="titleMedium">{t(K.treeSettings.mergeInvitations)}</Text>
                <IconButton
                  icon="information-outline"
                  size={18}
                  style={styles.helperIconButton}
                  onPress={() => onOpenHelperDialog('merge-invitations')}
                  accessibilityLabel={t(K.treeSettings.aboutMergeInvitations)}
                />
              </View>
              <View style={{ marginTop: 8 }}>
                {pendingMergeInvites.map((notification, index) => (
                  <Reveal key={notification.id} delay={110 + index * 20}>
                    <SectionCard nested style={[getTreeSettingsFamilyMemberCardStyle(theme), { marginTop: 8 }]}>
                      <Text variant="titleSmall">{notification.sourceTreeName}</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{notification.message}</Text>
                      <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
                        <Chip compact icon="calendar-clock">{notification.createdAt.slice(0, 16).replace('T', ' ')}</Chip>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <Button
                          mode="contained"
                          onPress={() => handleUseMergeInvite(notification)}
                          disabled={mutating || !canEdit || !userId || notification.sourceTreeId === selectedTree.id}
                          style={BUTTON_CHROME}
                          buttonColor={theme.colors.primary}
                          textColor={theme.colors.onPrimary}
                          contentStyle={BUTTON_CONTENT_CHROME}
                        >
                          {t(K.treeSettings.useThisTree)}
                        </Button>
                        <Button
                          mode="outlined"
                          onPress={() => onRespondToMergeInvite(notification.id, 'dismissed')}
                          disabled={mutating}
                          style={BUTTON_CHROME}
                          buttonColor={theme.colors.surface}
                          textColor={theme.colors.primary}
                          contentStyle={BUTTON_CONTENT_CHROME}
                        >
                          {t(K.common.dismiss)}
                        </Button>
                      </View>
                    </SectionCard>
                  </Reveal>
                ))}
              </View>
            </SectionCard>
          </Reveal>
        ) : null}

        <Reveal delay={110}>
          <SectionCard style={[styles.selfAssignmentCard, getTreeSettingsFamilyMemberCardStyle(theme), { marginBottom: 16 }]}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleMedium" style={{ marginBottom: 8 }}>{t(K.treeSettings.mergeAnotherTree)}</Text>
              <IconButton
                icon="information-outline"
                size={18}
                style={styles.helperIconButton}
                onPress={() => onOpenHelperDialog('merge-guidance')}
                accessibilityLabel={t(K.treeSettings.aboutCollaborativeMerges)}
              />
            </View>

            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t(K.treeSettings.mergeAnotherTreeMessage)}
            </Text>

            <Text variant="labelMedium" style={{ marginTop: 12 }}>{t(K.treeSettings.sourceTree)}</Text>
            <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
              {availableMergeSourceTrees.map((tree) => (
                <Chip key={tree.id} compact selected={tree.id === mergeSourceTreeId} showSelectedOverlay onPress={() => setMergeSourceTreeId(tree.id)}>
                  {tree.name}
                </Chip>
              ))}
            </View>

            <Text variant="labelMedium" style={{ marginTop: 12 }}>{t(K.treeSettings.targetTree)}</Text>
            {mergeTargetOptions.length > 0 ? (
              <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
                {mergeTargetOptions.map((tree) => (
                  <Chip key={tree.id} compact selected={tree.id === mergeTargetTreeId} showSelectedOverlay onPress={() => setMergeTargetTreeId(tree.id)}>
                    {tree.name}
                  </Chip>
                ))}
              </View>
            ) : (
              <Text variant="bodySmall" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
                {t(K.treeSettings.needAccessToAnotherEditableTree)}
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Button
                mode="outlined"
                onPress={handlePreviewMerge}
                disabled={mutating || !mergeSourceTreeId.trim() || !mergeTargetTreeId.trim()}
                style={BUTTON_CHROME}
                buttonColor={theme.colors.surface}
                textColor={theme.colors.primary}
                contentStyle={BUTTON_CONTENT_CHROME}
              >
                {t(K.treeSettings.viewMergePreview)}
              </Button>
              <Button
                mode="contained"
                onPress={handleCreateMerge}
                disabled={mutating || !mergeSourceTreeId.trim() || !mergeTargetTreeId.trim()}
                style={BUTTON_CHROME}
                buttonColor={theme.colors.primary}
                textColor={theme.colors.onPrimary}
                contentStyle={BUTTON_CONTENT_CHROME}
              >
                {t(K.treeSettings.startMergeReview)}
              </Button>
            </View>

            <Divider style={{ marginVertical: 16 }} />

            <Text variant="titleSmall">{t(K.app.requestAccessToTree)}</Text>
            <Text variant="bodySmall" style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}>
              {t(K.treeSettings.requestAccessToMergeMessage)}
            </Text>

            <TabStripCard style={{ marginTop: 12, backgroundColor: theme.colors.surfaceVariant }}>
              <HorizontalTabStrip
                items={[
                  { key: 'search', label: t(K.app.requestAccessSearchTab) },
                  { key: 'direct', label: t(K.app.requestAccessDirectTab) },
                ]}
                activeKey={requestAccessTab}
                onChange={(key) => setRequestAccessTab(key as RequestAccessTabKey)}
              />
            </TabStripCard>

            {requestAccessTab === 'search' ? (
              <View style={{ marginTop: 12 }}>
                <Text variant="titleSmall">{t(K.app.searchBySurnameOrTreeName)}</Text>
                <TextInput
                  mode="outlined"
                  label={t(K.app.surnameOrTreeName)}
                  value={accessSearchQuery}
                  onChangeText={setAccessSearchQuery}
                  left={<TextInput.Icon icon="magnify" />}
                  style={{ marginTop: 8 }}
                />
                <Button
                  mode="contained"
                  onPress={handleSearch}
                  disabled={!accessSearchQuery.trim() || accessSearching || mutating}
                  style={[BUTTON_CHROME, { marginTop: 8 }]}
                  buttonColor={theme.colors.primary}
                  textColor={theme.colors.onPrimary}
                  contentStyle={BUTTON_CONTENT_CHROME}
                >
                  {t(K.app.searchTrees)}
                </Button>
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Text variant="titleSmall">{t(K.app.enterUsernameOrEmailDirectly)}</Text>
                <Text variant="bodySmall" style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}>
                  {t(K.app.enterUsernameOrEmailDirectlyHelper)}
                </Text>
                <TextInput
                  mode="outlined"
                  label={t(K.app.usernameEmailOrTreeId)}
                  value={accessIdentifierQuery}
                  onChangeText={setAccessIdentifierQuery}
                  autoCapitalize="none"
                  left={<TextInput.Icon icon="account" />}
                  style={{ marginTop: 8 }}
                />
                <Button
                  mode="outlined"
                  onPress={handleIdentifierRequest}
                  disabled={!accessIdentifierQuery.trim() || pendingIdentifierKeys.has(accessIdentifierQuery.trim().toLowerCase()) || accessSearching || mutating}
                  style={[BUTTON_CHROME, { marginTop: 8 }]}
                  buttonColor={theme.colors.surface}
                  textColor={theme.colors.primary}
                  contentStyle={BUTTON_CONTENT_CHROME}
                >
                  {t(K.app.requestAccessDirectly)}
                </Button>
              </View>
            )}

            {accessSearching ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 16 }} />
            ) : null}

            {requestAccessTab === 'search' ? (
              <View style={{ marginTop: 12 }}>
                {pagedAccessResults.map((result, index) => {
                  const requestIsPending = pendingRequestTreeIds.has(result.id);
                  const alreadyAccessible = availableMergeSourceTrees.some((tree) => tree.id === result.id);

                  return (
                    <Reveal key={result.id} delay={130 + index * 15}>
                      <SectionCard nested style={[getTreeSettingsFamilyMemberCardStyle(theme), { marginTop: index === 0 ? 0 : 10 }]}>
                        <Text variant="titleSmall">{result.name}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {t(K.app.discoverableTreeOwnedBy, { name: result.ownerDisplayName || result.ownerUsername || t(K.common.unknown) })}
                        </Text>
                        <View style={[styles.collaboratorChipRow, { marginTop: 8, justifyContent: 'space-between' }]}>
                          <Chip compact icon={result.matchedBy === 'username' ? 'account-search' : 'family-tree'}>
                            {result.matchedLabel}
                          </Chip>
                          <Button
                            mode={requestIsPending || alreadyAccessible ? 'outlined' : 'contained'}
                            onPress={() => handleRequestAccess(result.id)}
                            disabled={mutating || requestIsPending || alreadyAccessible}
                            style={BUTTON_CHROME}
                            contentStyle={BUTTON_CONTENT_CHROME}
                          >
                            {alreadyAccessible ? t(K.treeSettings.alreadyAccessible) : requestIsPending ? t(K.app.requestedAccessPending) : t(K.app.requestAccess)}
                          </Button>
                        </View>
                      </SectionCard>
                    </Reveal>
                  );
                })}

                {accessResults.length > RESULTS_PER_PAGE ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <Button mode="outlined" onPress={() => setAccessResultsPage((page) => Math.max(1, page - 1))} disabled={accessResultsPage === 1} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                      {t(K.common.previous)}
                    </Button>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t(K.app.resultsPageCount, { current: accessResultsPage, total: totalAccessPages })}
                    </Text>
                    <Button mode="outlined" onPress={() => setAccessResultsPage((page) => Math.min(totalAccessPages, page + 1))} disabled={accessResultsPage === totalAccessPages} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                      {t(K.common.next)}
                    </Button>
                  </View>
                ) : null}

                {!accessSearching && accessResults.length === 0 && accessSearchQuery.trim() ? (
                  <Text variant="bodySmall" style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
                    {t(K.app.noDiscoverableTreesFound)}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </SectionCard>
        </Reveal>

        {mergePreview ? (
          <Button mode="outlined" icon="eye-outline" onPress={() => setMergePreviewVisible(true)} style={[BUTTON_CHROME, { marginBottom: 16, alignSelf: 'flex-start' }]} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
            {t(K.treeSettings.viewMergePreview)}
          </Button>
        ) : null}

        <SectionCard style={getTreeSettingsFamilyMemberCardStyle(theme)}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWrap}>
              <View style={styles.titleWithHelperRow}>
                <Text variant="titleLarge">{t(K.treeSettings.pendingMergeApprovals)}</Text>
                <IconButton
                  icon="information-outline"
                  size={18}
                  style={styles.helperIconButton}
                  onPress={() => onOpenHelperDialog('merge-guidance')}
                  accessibilityLabel={t(K.treeSettings.aboutPendingMergeApprovals)}
                />
              </View>
            </View>
          </View>

          {pendingMergeRequests.length > 0 ? (
            <View style={styles.collaboratorList}>
              {pendingMergeRequests.map((request, index) => {
                const selectedMatchIds = mergeSelectionDrafts[request.id] ?? request.selectedMatchIds;

                return (
                  <Reveal key={request.id} delay={130 + index * 25}>
                    <SectionCard nested style={[styles.collaboratorCard, getTreeSettingsFamilyMemberCardStyle(theme, request.id === highlightedMergeRequestId ? theme.colors.surfaceVariant : theme.colors.surface)]}>
                      <Text variant="titleMedium">{request.preview.sourceTree.treeName} ↔ {request.preview.targetTree.treeName}</Text>
                      <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                        {t(K.treeSettings.suggestedMergeSummary, {
                          name: request.suggestedByLabel,
                          duplicates: request.preview.duplicateCount,
                          conflicts: request.preview.conflicts.length,
                        })}
                      </Text>
                      <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
                        {request.approvals.map((approval) => (
                          <Chip key={`${request.id}-${approval.treeId}-${approval.editorUserId}`} compact icon={approval.decision === 'approve' ? 'check-circle-outline' : approval.decision === 'reject' ? 'close-circle-outline' : 'message-text-outline'}>
                            {approval.editorLabel}
                          </Chip>
                        ))}
                      </View>
                      <View style={{ marginTop: 8 }}>
                        {request.preview.matches.slice(0, 6).map((match) => {
                          const selected = selectedMatchIds.includes(match.id);

                          return (
                            <View key={`${request.id}-${match.id}`} style={{ marginBottom: 8 }}>
                              <Pressable onPress={() => toggleMergeSelection(request.id, match.id)}>
                                <View style={[styles.collaboratorChipRow, { justifyContent: 'space-between' }]}>
                                  <Text variant="bodySmall">{match.confidenceScore}% · {match.confidenceLabel}</Text>
                                  <Chip compact icon={selected ? 'check-circle-outline' : 'circle-outline'}>
                                    {selected ? t(K.treeSettings.mergeChoice) : t(K.treeSettings.skipMergeChoice)}
                                  </Chip>
                                </View>
                              </Pressable>
                              <ProgressBar progress={match.confidenceScore / 100} style={{ marginTop: 4, height: 8, borderRadius: 999 }} />
                            </View>
                          );
                        })}
                        <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                          {t(K.treeSettings.selectedMatchesToMerge, { count: selectedMatchIds.length })}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <Button mode="contained" onPress={() => onApproveMergeRequest(request.id, undefined, selectedMatchIds)} disabled={mutating || selectedMatchIds.length === 0} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                          {t(K.treeSettings.approve)}
                        </Button>
                        <Button mode="outlined" onPress={() => onRequestMergeChanges(request.id, t(K.treeSettings.requestMergeChangesMessage), selectedMatchIds)} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                          {t(K.treeSettings.requestChanges)}
                        </Button>
                        <Button mode="outlined" textColor={theme.colors.error} onPress={() => onRejectMergeRequest(request.id)} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.surface} contentStyle={BUTTON_CONTENT_CHROME}>
                          {t(K.treeSettings.reject)}
                        </Button>
                      </View>
                    </SectionCard>
                  </Reveal>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">{t(K.treeSettings.noMergeStoriesWaiting)}</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t('When another tree is ready to compare against this one, the suggested matches will gather here.')}
              </Text>
            </View>
          )}

          <Divider style={{ marginVertical: 16 }} />

          <Button mode="outlined" icon="history" onPress={() => setMergeHistoryVisible(true)} style={[BUTTON_CHROME, { alignSelf: 'flex-start' }]} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
            {t(K.treeSettings.mergeHistoryAndUndo)}
          </Button>
        </SectionCard>
      </View>
    </Reveal>
  );
}
