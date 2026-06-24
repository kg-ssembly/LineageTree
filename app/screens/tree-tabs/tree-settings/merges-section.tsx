import React from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Chip, Divider, IconButton, ProgressBar, Text, TextInput, useTheme } from 'react-native-paper';
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
    <View style={styles.collaboratorSectionWrap}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleWrap}>
          <View style={styles.titleWithHelperRow}>
            <Text variant="titleLarge">{t('Collaborative merges')}</Text>
            <IconButton
              icon="information-outline"
              size={18}
              style={styles.helperIconButton}
              onPress={() => onOpenHelperDialog('merge-guidance')}
              accessibilityLabel={t('About collaborative merges')}
            />
          </View>
        </View>
      </View>

      {pendingMergeInvites.length > 0 ? (
        <Card mode="elevated" style={[styles.collaboratorCard, { backgroundColor: theme.colors.surface, marginBottom: 16 }]}>
          <Card.Content>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleMedium">{t('Merge invitations')}</Text>
              <IconButton
                icon="information-outline"
                size={18}
                style={styles.helperIconButton}
                onPress={() => onOpenHelperDialog('merge-invitations')}
                accessibilityLabel={t('About merge invitations')}
              />
            </View>
            <View style={{ marginTop: 8 }}>
              {pendingMergeInvites.map((notification) => (
                <Card key={notification.id} mode="contained" style={{ marginTop: 8 }}>
                  <Card.Content>
                    <Text variant="titleSmall">{notification.sourceTreeName}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{notification.message}</Text>
                    <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
                      <Chip compact icon="calendar-clock">{notification.createdAt.slice(0, 16).replace('T', ' ')}</Chip>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <Button mode="contained" onPress={() => handleUseMergeInvite(notification)} disabled={mutating || !canEdit || notification.sourceTreeId === selectedTree.id}>
                        {t('Use this tree')}
                      </Button>
                      <Button mode="text" onPress={() => onRespondToMergeInvite(notification.id, 'dismissed')} disabled={mutating}>
                        {t(K.common.dismiss)}
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              ))}
            </View>
          </Card.Content>
        </Card>
      ) : null}

      <Card mode="elevated" style={[styles.selfAssignmentCard, { backgroundColor: theme.colors.surface, marginBottom: 16 }]}>
        <Card.Content>
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>{t('Invite another user to merge')}</Text>
          <Text variant="labelMedium" style={{ marginTop: 12 }}>{t('Source tree')}</Text>
          <View style={[styles.collaboratorChipRow, { marginTop: 8 }]}>
            {availableMergeSourceTrees.map((tree) => (
              <Chip key={tree.id} compact selected={tree.id === mergeInviteSourceTreeId} showSelectedOverlay onPress={() => setMergeInviteSourceTreeId(tree.id)}>
                {tree.name}
              </Chip>
            ))}
          </View>
          <TextInput
            mode="outlined"
            label={t('Registered email or username')}
            value={mergeInviteIdentifier}
            onChangeText={setMergeInviteIdentifier}
            style={{ marginTop: 8 }}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button mode="contained-tonal" onPress={handleSendMergeInvite} disabled={mutating || !mergeInviteIdentifier.trim() || !mergeInviteSourceTreeId.trim()}>
              {t('Send invitation')}
            </Button>
          </View>
        </Card.Content>
      </Card>

      {mergePreview ? (
        <Button mode="outlined" icon="eye-outline" onPress={() => setMergePreviewVisible(true)} style={{ marginBottom: 16, alignSelf: 'flex-start' }}>
          {t('View merge preview')}
        </Button>
      ) : null}

      <View style={styles.sectionHeader}>
        <View style={styles.titleWrap}>
          <View style={styles.titleWithHelperRow}>
            <Text variant="titleLarge">{t('Pending merge approvals')}</Text>
            <IconButton
              icon="information-outline"
              size={18}
              style={styles.helperIconButton}
              onPress={() => onOpenHelperDialog('merge-guidance')}
              accessibilityLabel={t('About pending merge approvals')}
            />
          </View>
        </View>
      </View>

      {pendingMergeRequests.length > 0 ? (
        <View style={styles.collaboratorList}>
          {pendingMergeRequests.map((request) => {
            const selectedMatchIds = mergeSelectionDrafts[request.id] ?? request.selectedMatchIds;

            return (
              <Card key={request.id} mode="elevated" style={[styles.collaboratorCard, { backgroundColor: request.id === highlightedMergeRequestId ? theme.colors.surfaceVariant : theme.colors.surface }]}>
                <Card.Content>
                  <Text variant="titleMedium">{request.preview.sourceTree.treeName} ↔ {request.preview.targetTree.treeName}</Text>
                  <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                    {t('Suggested by {name}. {duplicates} strong duplicate candidates, {conflicts} conflicts.', {
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
                                {selected ? t('Merge') : t('Skip')}
                              </Chip>
                            </View>
                          </Pressable>
                          <ProgressBar progress={match.confidenceScore / 100} style={{ marginTop: 4, height: 8, borderRadius: 999 }} />
                        </View>
                      );
                    })}
                    <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>
                      {t('{count} match(es) selected to merge', { count: selectedMatchIds.length })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <Button mode="contained" onPress={() => onApproveMergeRequest(request.id, undefined, selectedMatchIds)} disabled={mutating || selectedMatchIds.length === 0}>
                      {t('Approve')}
                    </Button>
                    <Button mode="outlined" onPress={() => onRequestMergeChanges(request.id, t('Please review the selected merge matches and highlighted conflicts before merging.'), selectedMatchIds)} disabled={mutating}>
                      {t('Request changes')}
                    </Button>
                    <Button mode="text" textColor={theme.colors.error} onPress={() => onRejectMergeRequest(request.id)} disabled={mutating}>
                      {t('Reject')}
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text variant="titleMedium">{t('No pending merge reviews')}</Text>
          <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
            {t('Merge suggestions with likely relative matches will appear here for joint editor approval.')}
          </Text>
        </View>
      )}

      <Divider style={{ marginVertical: 16 }} />

      <Button mode="outlined" icon="history" onPress={() => setMergeHistoryVisible(true)} style={{ alignSelf: 'flex-start' }}>
        {t('Merge history and undo')}
      </Button>
    </View>
  );
}
