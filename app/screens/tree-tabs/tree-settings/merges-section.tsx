import React from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Chip, Divider, IconButton, ProgressBar, Text, TextInput, useTheme } from 'react-native-paper';
import { Reveal } from '../../../../components';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import type { MergesSectionProps } from './tree-settings-shared';

const styles = GlobalStyles.treeDetail;

export function MergesSection({
  selectedTree,
  notifications,
  mergePreview,
  pendingMergeRequests,
  highlightedMergeRequestId,
  mergeSelectionDrafts,
  mergeInviteIdentifier,
  mergeInviteSourceTreeId,
  availableMergeSourceTrees,
  canEdit,
  mutating,
  onOpenHelperDialog,
  setMergeInviteIdentifier,
  setMergeInviteSourceTreeId,
  setMergePreviewVisible,
  setMergeHistoryVisible,
  toggleMergeSelection,
  onSendMergeInvite,
  onRespondToMergeInvite,
  onLoadMergePreview,
  onApproveMergeRequest,
  onRequestMergeChanges,
  onRejectMergeRequest,
}: MergesSectionProps) {
  const theme = useTheme();
  const { t } = useI18n();

  const pendingMergeInvites = notifications.filter((notification) => notification.type === 'merge-invite' && notification.status === 'pending');

  const handleUseMergeInvite = async (notification: MergesSectionProps['notifications'][number]) => {
    await onLoadMergePreview(notification.sourceTreeId);
    await onRespondToMergeInvite(notification.id, 'accepted');
  };

  const handleSendMergeInvite = async () => {
    await onSendMergeInvite(mergeInviteSourceTreeId, mergeInviteIdentifier);
    setMergeInviteIdentifier('');
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
          <Card mode="elevated" style={[styles.collaboratorCard, { backgroundColor: theme.colors.surface, marginBottom: 16 }]}>
            <Card.Content>
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
                  <Card mode="contained" style={{ marginTop: 8 }}>
                    <Card.Content>
                    <Text variant="titleSmall">{notification.sourceTreeName}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{notification.message}</Text>
                    <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
                      <Chip compact icon="calendar-clock">{notification.createdAt.slice(0, 16).replace('T', ' ')}</Chip>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <Button mode="contained" onPress={() => handleUseMergeInvite(notification)} disabled={mutating || !canEdit || notification.sourceTreeId === selectedTree.id}>
                        {t(K.treeSettings.useThisTree)}
                      </Button>
                      <Button mode="text" onPress={() => onRespondToMergeInvite(notification.id, 'dismissed')} disabled={mutating}>
                        {t(K.common.dismiss)}
                      </Button>
                    </View>
                    </Card.Content>
                  </Card>
                </Reveal>
              ))}
            </View>
            </Card.Content>
          </Card>
        </Reveal>
      ) : null}

      <Reveal delay={110}>
        <Card mode="elevated" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.surface, marginBottom: 16 }]}>
          <Card.Content>
          <View style={styles.titleWithHelperRow}>
            <Text variant="titleMedium" style={{ marginBottom: 8 }}>{t(K.treeSettings.inviteAnotherUserToMerge)}</Text>
            <IconButton
              icon="information-outline"
              size={18}
              style={styles.helperIconButton}
              onPress={() => onOpenHelperDialog('merge-invitations')}
              accessibilityLabel={t(K.treeSettings.aboutMergeInvitations)}
            />
          </View>
          <Text variant="labelMedium" style={{ marginTop: 12 }}>{t(K.treeSettings.sourceTree)}</Text>
          <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
            {availableMergeSourceTrees.map((tree) => (
              <Chip key={tree.id} compact selected={tree.id === mergeInviteSourceTreeId} showSelectedOverlay onPress={() => setMergeInviteSourceTreeId(tree.id)}>
                {tree.name}
              </Chip>
            ))}
          </View>
          <TextInput
            mode="outlined"
            label={t(K.treeSettings.registeredEmailOrUsername)}
            value={mergeInviteIdentifier}
            onChangeText={setMergeInviteIdentifier}
            style={{ marginTop: 8 }}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button mode="contained-tonal" onPress={handleSendMergeInvite} disabled={mutating || !mergeInviteIdentifier.trim() || !mergeInviteSourceTreeId.trim()}>
              {t(K.treeSettings.sendInvitation)}
            </Button>
          </View>
          </Card.Content>
        </Card>
      </Reveal>

      {mergePreview ? (
        <Button mode="outlined" icon="eye-outline" onPress={() => setMergePreviewVisible(true)} style={{ marginBottom: 16, alignSelf: 'flex-start' }}>
          {t(K.treeSettings.viewMergePreview)}
        </Button>
      ) : null}

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
                <Card mode="elevated" style={[styles.collaboratorCard, { backgroundColor: request.id === highlightedMergeRequestId ? theme.colors.surfaceVariant : theme.colors.surface }]}>
                  <Card.Content>
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
                    <Button mode="contained" onPress={() => onApproveMergeRequest(request.id, undefined, selectedMatchIds)} disabled={mutating || selectedMatchIds.length === 0}>
                      {t(K.treeSettings.approve)}
                    </Button>
                    <Button mode="outlined" onPress={() => onRequestMergeChanges(request.id, t(K.treeSettings.requestMergeChangesMessage), selectedMatchIds)} disabled={mutating}>
                      {t(K.treeSettings.requestChanges)}
                    </Button>
                    <Button mode="text" textColor={theme.colors.error} onPress={() => onRejectMergeRequest(request.id)} disabled={mutating}>
                      {t(K.treeSettings.reject)}
                    </Button>
                  </View>
                  </Card.Content>
                </Card>
              </Reveal>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text variant="titleMedium">{t(K.treeSettings.noMergeStoriesWaiting)}</Text>
          <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
            When another tree is ready to compare against this one, the suggested matches will gather here.
          </Text>
        </View>
      )}

      <Divider style={{ marginVertical: 16 }} />

      <Button mode="outlined" icon="history" onPress={() => setMergeHistoryVisible(true)} style={{ alignSelf: 'flex-start' }}>
        {t(K.treeSettings.mergeHistoryAndUndo)}
      </Button>
    </View>
    </Reveal>
  );
}
