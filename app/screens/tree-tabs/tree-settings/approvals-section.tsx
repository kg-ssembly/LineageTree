import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, IconButton, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, ConfirmDialog, GlobalStyles, Reveal, SectionCard } from '../../../../components';
import { canUserReviewApprovalRequest, isApprovalExpired } from '../../../../components/dto/approval';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import type { ApprovalsSectionProps } from './tree-settings-shared';
import { getTreeSettingsFamilyMemberCardStyle } from './tree-settings-shared';

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
  const [decision, setDecision] = useState<{ id: string; title: string; description: string; approve: boolean } | null>(null);
  const [deciding, setDeciding] = useState(false);
  const confirmDecision = async () => {
    if (!decision || deciding || mutating) return;
    setDeciding(true);
    try {
      await (decision.approve ? onApproveApprovalRequest(decision.id) : onRejectApprovalRequest(decision.id));
      setDecision(null);
    } finally {
      setDeciding(false);
    }
  };

  return (
    <Reveal delay={80}>
    <View style={styles.collaboratorSectionWrap}>
      <SectionCard style={getTreeSettingsFamilyMemberCardStyle(theme)}>
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
      </SectionCard>

      <SectionCard style={getTreeSettingsFamilyMemberCardStyle(theme)}>
        <View style={styles.sectionHeader}>
          <View style={styles.titleWrap}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleLarge">{t(K.treeSettings.pendingApprovals)} ({pendingApprovalRequests.length})</Text>
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
            {pendingApprovalRequests.map((request, index) => {
              const canReview = canUserReviewApprovalRequest(request, userId);
              const expiresSoon = isApprovalExpired(request);

              return (
                <Reveal key={request.id} delay={120 + index * 25}>
                  <SectionCard nested style={[styles.collaboratorCard, getTreeSettingsFamilyMemberCardStyle(theme, canReview ? theme.colors.surfaceVariant : theme.colors.surface)]}>
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
                        <Button mode="outlined" icon="eye-outline" onPress={() => setPreviewApprovalRequest(request)} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                          {t(K.treeSettings.previewChange)}
                        </Button>
                        {canReview ? (
                          <>
                            <Button mode="contained" onPress={() => setDecision({ id: request.id, title: request.title, description: request.description, approve: true })} disabled={mutating} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                              {t(K.treeSettings.approve)}
                            </Button>
                            <Button mode="outlined" textColor={theme.colors.error} onPress={() => setDecision({ id: request.id, title: request.title, description: request.description, approve: false })} disabled={mutating} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                              {t(K.treeSettings.reject)}
                            </Button>
                          </>
                        ) : null}
                      </View>
                    </View>
                  </SectionCard>
                </Reveal>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text variant="titleMedium">{t(K.treeSettings.nothingWaitingOnYourEye)}</Text>
            <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
              {t('Fresh edits from collaborators will appear here whenever they need a quick review.')}
            </Text>
          </View>
        )}
      </SectionCard>
    </View>
      <ConfirmDialog
        visible={!!decision}
        title={decision ? t(decision.approve ? K.treeSettings.approve : K.treeSettings.reject) : ''}
        message={decision ? decision.title + '\n\n' + decision.description : ''}
        confirmLabel={decision?.approve ? K.treeSettings.approve : K.treeSettings.reject}
        loading={mutating || deciding}
        onDismiss={() => setDecision(null)}
        onConfirm={confirmDecision}
      />
    </Reveal>
  );
}
