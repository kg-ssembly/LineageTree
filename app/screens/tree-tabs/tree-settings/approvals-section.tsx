import React from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, IconButton, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { canUserReviewApprovalRequest, isApprovalExpired } from '../../../../components/dto/approval';
import { Reveal } from '../../../../components';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import type { ApprovalsSectionProps } from './tree-settings-shared';

const styles = GlobalStyles.treeDetail;

export function ApprovalsSection({
  pendingApprovalRequests,
  approvalWindowHours,
  approvalWindowValue,
  approvalsDisabled,
  isOwner,
  userId,
  mutating,
  onOpenHelperDialog,
  onSetApprovalWindowHours,
  onApproveApprovalRequest,
  onRejectApprovalRequest,
  setPreviewApprovalRequest,
}: ApprovalsSectionProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Reveal delay={80}>
    <View style={styles.collaboratorSectionWrap}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleWrap}>
          <View style={styles.titleWithHelperRow}>
            <Text variant="titleLarge">{t(K.treeSettings.approvalSettings)}</Text>
            <IconButton
              icon="information-outline"
              size={18}
              style={styles.helperIconButton}
              onPress={() => onOpenHelperDialog('approval-settings')}
              accessibilityLabel={t(K.treeSettings.approvalSettings)}
            />
          </View>
        </View>
      </View>

      <View style={styles.summaryChipRow}>
        <Chip icon="timeline-clock-outline">
          {approvalsDisabled ? t(K.treeSettings.currentWindowOff) : t(K.treeSettings.currentWindowHours, { hours: approvalWindowHours })}
        </Chip>
      </View>

      <SegmentedButtons
        value={approvalWindowValue}
        onValueChange={(value) => {
          if (!isOwner || mutating) {
            return;
          }
          void onSetApprovalWindowHours(Number(value));
        }}
        buttons={[
          { value: '0', label: t(K.treeSettings.off), disabled: !isOwner || mutating },
          { value: '12', label: '12h', disabled: !isOwner || mutating },
          { value: '24', label: '24h', disabled: !isOwner || mutating },
          { value: '48', label: '48h', disabled: !isOwner || mutating },
        ]}
        style={styles.managementSegmentedButtons}
        density="small"
      />

      <View style={styles.collaboratorSectionWrap}>
        <View style={styles.sectionHeader}>
          <View style={styles.titleWrap}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleLarge">{t(K.treeSettings.pendingApprovals)}</Text>
              <IconButton
                icon="information-outline"
                size={18}
                style={styles.helperIconButton}
                onPress={() => onOpenHelperDialog('pending-approvals')}
                accessibilityLabel={t(K.treeSettings.aboutPendingApprovals)}
              />
            </View>
          </View>
        </View>

        {pendingApprovalRequests.length > 0 ? (
          <View style={styles.collaboratorList}>
            {pendingApprovalRequests.map((request) => {
              const canReview = canUserReviewApprovalRequest(request, userId);
              const expiresSoon = isApprovalExpired(request);

              return (
                <Card key={request.id} mode="elevated" style={[styles.collaboratorCard, { backgroundColor: canReview ? theme.colors.surfaceVariant : theme.colors.surface }]}>
                  <Card.Content>
                    <View style={styles.approvalRequestHeader}>
                      <View style={styles.collaboratorTextWrap}>
                        <View style={styles.collaboratorChipRow}>
                          <Chip compact icon={canReview ? 'clipboard-check-outline' : 'clock-outline'}>
                            {canReview ? t(K.treeSettings.needsYourReview) : t(K.treeSettings.awaitingReview)}
                          </Chip>
                          <Chip compact icon={expiresSoon ? 'timer-alert-outline' : 'timer-outline'}>
                            {t(K.treeSettings.autoApprovesAt, { date: request.expiresAt.slice(0, 16).replace('T', ' ') })}
                          </Chip>
                        </View>
                        <Text variant="titleMedium" style={styles.selfAssignmentTitle}>{request.title}</Text>
                        <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{request.description}</Text>
                        <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant }]}>{t(K.treeSettings.requestedByName, { name: request.requestedByLabel })}</Text>
                      </View>
                      <View style={styles.approvalRequestActions}>
                        <Button mode="outlined" icon="eye-outline" onPress={() => setPreviewApprovalRequest(request)}>
                          {t(K.treeSettings.previewChange)}
                        </Button>
                        {canReview ? (
                          <>
                            <Button mode="contained" onPress={() => onApproveApprovalRequest(request.id)} disabled={mutating}>
                              {t(K.treeSettings.approve)}
                            </Button>
                            <Button mode="outlined" textColor={theme.colors.error} onPress={() => onRejectApprovalRequest(request.id)} disabled={mutating}>
                              {t(K.treeSettings.reject)}
                            </Button>
                          </>
                        ) : null}
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text variant="titleMedium">Nothing is waiting on your eye right now</Text>
            <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
              Fresh edits from collaborators will appear here whenever they need a quick review.
            </Text>
          </View>
        )}
      </View>
    </View>
    </Reveal>
  );
}
