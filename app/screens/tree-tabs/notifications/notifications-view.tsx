import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Text,
  useTheme,
} from 'react-native-paper';
import { Reveal } from '../../../../components';
import type { NotificationActivityState } from '../../../../components/dto/notification';
import type { MainTabParamList } from '../../../../components/dto/navigation';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import type { SharedTabProps } from '../shared';

const dialogChrome = GlobalStyles.dialogChrome;
const styles = GlobalStyles.treeDetail;
const ACTIVITY_PAGE_SIZE = 5;

type NotificationFeedKind = 'merge-invite' | 'approval' | 'merge-request' | 'merge-history' | 'membership';

type NotificationFeedItem = {
  id: string;
  kind: NotificationFeedKind;
  title: string;
  message: string;
  createdAt: string;
  status?: string;
  treeName?: string;
  notificationId?: string;
  sourceKind?: NotificationActivityState['sourceKind'];
  sourceId?: string;
  requestId?: string;
  seen?: boolean;
  opened?: boolean;
  actioned?: boolean;
};

export function NotificationsView({
  selectedTree,
  approvalRequests,
  mergeRequests,
  mergeHistory,
  notifications,
  notificationActivityStates,
  trees,
  userId,
  mutating,
  onRespondToMergeInvite,
  onMarkNotificationSeen,
  onMarkNotificationOpened,
  onMarkNotificationActivityActioned,
  onOpenTreeSettingsTarget,
  embedded = false,
  navigation,
}: SharedTabProps & { embedded?: boolean; navigation: { navigate: (name: keyof MainTabParamList) => void } }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [selectedNotification, setSelectedNotification] = useState<NotificationFeedItem | null>(null);
  const [helperVisible, setHelperVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const activityStateByKey = useMemo(
    () => new Map(notificationActivityStates.map((state) => [`${state.sourceKind}:${state.sourceId}`, state])),
    [notificationActivityStates],
  );

  const notificationFeed = useMemo<NotificationFeedItem[]>(() => {
    const directNotifications = notifications.map<NotificationFeedItem>((notification) => ({
      id: `direct-${notification.id}`,
      kind: 'merge-invite',
      title: t(K.notifications.mergeInvitation),
      message: notification.message,
      createdAt: notification.createdAt,
      status: notification.status,
      treeName: notification.sourceTreeName,
      notificationId: notification.id,
      seen: Boolean(notification.seenAt),
      opened: Boolean(notification.openedAt),
    }));

    const approvalNotifications = approvalRequests.map<NotificationFeedItem>((request) => ({
      id: `approval-${request.id}`,
      kind: 'approval',
      title: request.status === 'pending' ? t(K.notifications.approvalRequest) : t(K.notifications.approvalUpdate),
      message: `${request.title} · ${request.description}`,
      createdAt: request.updatedAt,
      status: request.status,
      treeName: selectedTree.name,
      requestId: request.id,
      sourceKind: 'approval',
      sourceId: request.id,
      actioned: Boolean(activityStateByKey.get(`approval:${request.id}`)?.actionedAt),
    }));

    const mergeRequestNotifications = mergeRequests.map<NotificationFeedItem>((request) => ({
      id: `merge-request-${request.id}`,
      kind: 'merge-request',
      title: t(K.notifications.mergeRequest),
      message: `${request.preview.sourceTree.treeName} ↔ ${request.preview.targetTree.treeName}`,
      createdAt: request.updatedAt,
      status: request.status,
      treeName: selectedTree.name,
      requestId: request.id,
      sourceKind: 'merge-request',
      sourceId: request.id,
      actioned: Boolean(activityStateByKey.get(`merge-request:${request.id}`)?.actionedAt),
    }));

    const mergeHistoryNotifications = mergeHistory.map<NotificationFeedItem>((entry) => ({
      id: `merge-history-${entry.id}`,
      kind: 'merge-history',
      title: t(K.notifications.mergeActivity),
      message: entry.summary,
      createdAt: entry.updatedAt,
      status: entry.status,
      treeName: selectedTree.name,
      requestId: entry.mergeRequestId,
      sourceKind: 'merge-history',
      sourceId: entry.id,
      actioned: Boolean(activityStateByKey.get(`merge-history:${entry.id}`)?.actionedAt),
    }));

    const membershipNotifications = (trees ?? [])
      .flatMap((tree) => tree.membershipHistory.map((entry) => ({ tree, entry })))
      .filter(({ entry }) => !userId || entry.userId === userId || entry.action === 'invited' || entry.action === 'role-changed')
      .map<NotificationFeedItem>(({ tree, entry }) => ({
        id: `membership-${tree.id}-${entry.id}`,
        kind: 'membership',
        title: t(K.notifications.treeAccessUpdate),
        message: entry.note?.trim()
          ? `${tree.name} · ${entry.note}`
          : `${tree.name} · ${entry.action}`,
        createdAt: entry.createdAt,
        status: entry.action,
        treeName: tree.name,
        sourceKind: 'membership',
        sourceId: `${tree.id}-${entry.id}`,
        actioned: Boolean(activityStateByKey.get(`membership:${tree.id}-${entry.id}`)?.actionedAt),
      }));

    return [
      ...directNotifications,
      ...approvalNotifications,
      ...mergeRequestNotifications,
      ...mergeHistoryNotifications,
      ...membershipNotifications,
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [activityStateByKey, approvalRequests, mergeHistory, mergeRequests, notifications, selectedTree.name, t, trees, userId]);

  const openNotification = async (item: NotificationFeedItem) => {
    setSelectedNotification(item);
    if (item.notificationId && userId) {
      await onMarkNotificationOpened(item.notificationId);
    }
  };

  const unseenDirectNotifications = useMemo(
    () => notificationFeed.filter((item) => item.notificationId && !item.seen).map((item) => item.notificationId as string),
    [notificationFeed],
  );

  const totalPages = Math.max(1, Math.ceil(notificationFeed.length / ACTIVITY_PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [notificationFeed.length]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedFeed = useMemo(() => {
    const startIndex = (currentPage - 1) * ACTIVITY_PAGE_SIZE;
    return notificationFeed.slice(startIndex, startIndex + ACTIVITY_PAGE_SIZE);
  }, [currentPage, notificationFeed]);

  const unopenedDirectNotifications = useMemo(
    () => notificationFeed.filter((item) => item.notificationId && !item.opened).map((item) => item.notificationId as string),
    [notificationFeed],
  );

  const unactionedDerivedNotifications = useMemo(
    () => notificationFeed
      .filter((item) => item.sourceKind && item.sourceId && !item.actioned)
      .map((item) => ({ sourceKind: item.sourceKind as NotificationActivityState['sourceKind'], sourceId: item.sourceId as string })),
    [notificationFeed],
  );

  const handleMarkAllSeen = async () => {
    for (const notificationId of unseenDirectNotifications) {
      await onMarkNotificationSeen(notificationId);
    }
  };

  const handleMarkAllOpened = async () => {
    for (const notificationId of unopenedDirectNotifications) {
      await onMarkNotificationOpened(notificationId);
    }
  };

  const handleMarkAllActioned = async () => {
    for (const item of unactionedDerivedNotifications) {
      await onMarkNotificationActivityActioned(item.sourceKind, item.sourceId);
    }
  };

  const handleMarkActioned = async (item: NotificationFeedItem) => {
    if (!item.sourceKind || !item.sourceId) {
      return;
    }

    await onMarkNotificationActivityActioned(item.sourceKind, item.sourceId);
  };

  const handleOpenTarget = async (item: NotificationFeedItem) => {
    if (!onOpenTreeSettingsTarget) {
      return;
    }

    if (item.kind === 'approval' && item.requestId) {
      await onMarkNotificationActivityActioned('approval', item.requestId);
      onOpenTreeSettingsTarget({ tab: 'approvals', itemId: item.requestId, mode: 'approval' });
      navigation.navigate('treeSettings' satisfies keyof MainTabParamList);
      setSelectedNotification(null);
      return;
    }

    if ((item.kind === 'merge-request' || item.kind === 'merge-history') && item.requestId) {
      const sourceKind = item.kind === 'merge-request' ? 'merge-request' : 'merge-history';
      await onMarkNotificationActivityActioned(sourceKind, item.sourceId ?? item.requestId);
      onOpenTreeSettingsTarget({ tab: 'merges', itemId: item.requestId, mode: 'merge' });
      navigation.navigate('treeSettings' satisfies keyof MainTabParamList);
      setSelectedNotification(null);
    }
  };

  useEffect(() => {
    if (!selectedNotification) {
      return;
    }

    const refreshed = notificationFeed.find((item) => item.id === selectedNotification.id);
    if (
      refreshed
      && (
        refreshed.seen !== selectedNotification.seen
        || refreshed.opened !== selectedNotification.opened
        || refreshed.actioned !== selectedNotification.actioned
        || refreshed.status !== selectedNotification.status
        || refreshed.message !== selectedNotification.message
      )
    ) {
      setSelectedNotification(refreshed);
    }
  }, [notificationFeed, selectedNotification]);

  const content = (
    <>
      <View>
        {!embedded ? (
          <View style={styles.sectionHeader}>
            <View style={styles.titleWrap}>
              <View style={styles.titleWithHelperRow}>
                <Text variant="headlineSmall">Family activity</Text>
                <IconButton
                  icon="information-outline"
                  size={18}
                  style={styles.helperIconButton}
                  onPress={() => setHelperVisible(true)}
                  accessibilityLabel={t(K.notifications.notifications)}
                />
              </View>
            </View>
          </View>
        ) : null}

        {notificationFeed.length > 0 ? (
          <Reveal delay={60}>
          <Card mode="outlined" style={{ marginBottom: 16, backgroundColor: theme.colors.surface, borderRadius: 16 }}>
            <Card.Content style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Text variant="titleSmall">Most recent family activity</Text>
                <Chip compact icon="timeline-clock-outline">
                  {notificationFeed.length} total
                </Chip>
              </View>
              <View style={[styles.collaboratorChipRow, { justifyContent: 'space-between' }]}>
                <Chip compact icon="bell-ring-outline">{unseenDirectNotifications.length} new</Chip>
                <Chip compact icon="email-open-outline">{unopenedDirectNotifications.length} unopened</Chip>
                <Chip compact icon="check-decagram-outline">{unactionedDerivedNotifications.length} to follow up</Chip>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Button mode="outlined" onPress={() => { void handleMarkAllSeen(); }} disabled={mutating || unseenDirectNotifications.length === 0}>
                  Quiet new alerts
                </Button>
                <Button mode="outlined" onPress={() => { void handleMarkAllOpened(); }} disabled={mutating || unopenedDirectNotifications.length === 0}>
                  Open everything
                </Button>
                <Button mode="outlined" onPress={() => { void handleMarkAllActioned(); }} disabled={mutating || unactionedDerivedNotifications.length === 0}>
                  Mark follow-up done
                </Button>
              </View>
            </Card.Content>
          </Card>
          </Reveal>
        ) : null}

        {notificationFeed.length > 0 ? (
          <View style={styles.collaboratorList}>
            {paginatedFeed.map((item, index) => (
              <Reveal key={item.id} delay={80 + index * 35}>
                <Card
                  mode="outlined"
                  style={[styles.collaboratorCard, { backgroundColor: theme.colors.surface, borderRadius: 12, marginBottom: 10 }]}
                >
                  <Card.Content style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
                  <Pressable onPress={() => { void openNotification(item); }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text variant="titleSmall">{item.title}</Text>
                          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            {item.createdAt.slice(0, 16).replace('T', ' ')}
                          </Text>
                        </View>
                        <Text
                          variant="bodySmall"
                          numberOfLines={2}
                          style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, lineHeight: 18 }}
                        >
                          {item.message}
                        </Text>
                      </View>
                      <View style={[styles.collaboratorChipRow, { justifyContent: 'flex-end', maxWidth: '42%' }]}>
                        {item.notificationId && !item.opened && !item.seen ? <Chip compact>{t(K.notifications.new)}</Chip> : null}
                        {item.notificationId && item.seen && !item.opened ? <Chip compact>{t(K.notifications.seen)}</Chip> : null}
                        {item.actioned ? <Chip compact>{t(K.notifications.actioned)}</Chip> : null}
                        {item.status ? <Chip compact>{item.status}</Chip> : null}
                      </View>
                    </View>
                  </Pressable>
                  <View style={[styles.collaboratorChipRow, { marginTop: 6 }]}>
                    {item.kind === 'approval' ? <Chip compact>{t(K.notifications.approval)}</Chip> : null}
                    {item.kind === 'merge-request' || item.kind === 'merge-history' || item.kind === 'merge-invite' ? <Chip compact>{t(K.notifications.merge)}</Chip> : null}
                    {item.kind === 'membership' ? <Chip compact>{t(K.notifications.access)}</Chip> : null}
                    {item.treeName ? <Chip compact>{item.treeName}</Chip> : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {item.notificationId && !item.seen && !item.opened ? (
                      <Button compact mode="text" onPress={() => onMarkNotificationSeen(item.notificationId!)} disabled={mutating}>
                        Notice
                      </Button>
                    ) : null}
                    {item.notificationId && !item.opened ? (
                      <Button compact mode="text" onPress={() => onMarkNotificationOpened(item.notificationId!)} disabled={mutating}>
                        Open
                      </Button>
                    ) : null}
                    {item.sourceKind && item.sourceId && !item.actioned ? (
                      <Button compact mode="text" onPress={() => { void handleMarkActioned(item); }} disabled={mutating}>
                        Done
                      </Button>
                    ) : null}
                    {(item.kind === 'approval' || item.kind === 'merge-request' || item.kind === 'merge-history') ? (
                      <Button compact mode="contained-tonal" onPress={() => { void handleOpenTarget(item); }} disabled={mutating}>
                        {item.kind === 'approval' ? 'Review' : 'Open'}
                      </Button>
                    ) : null}
                  </View>
                  </Card.Content>
                </Card>
              </Reveal>
            ))}
            {totalPages > 1 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
                <Button compact mode="outlined" onPress={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
                  Previous
                </Button>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  Page {currentPage} of {totalPages}
                </Text>
                <Button compact mode="outlined" onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>
                  Next
                </Button>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text variant="titleMedium">Your family activity feed is quiet</Text>
            <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
              Invites, edits, and merge moments will appear here as more people join in and your story grows.
            </Text>
          </View>
        )}
      </View>

      <Portal>
        <Dialog
          visible={helperVisible}
          onDismiss={() => setHelperVisible(false)}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
            {t(K.notifications.notifications)}
          </Dialog.Title>
          <IconButton icon="close" onPress={() => setHelperVisible(false)} style={dialogChrome.closeButton} />
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium">
              {t(K.notifications.helper)}
            </Text>
          </Dialog.Content>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={!!selectedNotification}
          onDismiss={() => setSelectedNotification(null)}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
            {selectedNotification?.title ?? t(K.notifications.notification)}
          </Dialog.Title>
          <IconButton icon="close" onPress={() => setSelectedNotification(null)} style={dialogChrome.closeButton} />
          <Dialog.Content style={dialogChrome.content}>
            {selectedNotification ? (
              <>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {selectedNotification.createdAt.slice(0, 16).replace('T', ' ')}
                </Text>
                {selectedNotification.treeName ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                    {selectedNotification.treeName}
                  </Text>
                ) : null}
                <Text variant="bodyMedium" style={{ marginTop: 12 }}>
                  {selectedNotification.message}
                </Text>
              </>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            {selectedNotification?.notificationId && !selectedNotification.seen && !selectedNotification.opened ? (
              <Button mode="text" onPress={() => onMarkNotificationSeen(selectedNotification.notificationId!)} disabled={mutating}>
                {t(K.notifications.markSeen)}
              </Button>
            ) : null}
            {selectedNotification?.notificationId && !selectedNotification.opened ? (
              <Button mode="text" onPress={() => onMarkNotificationOpened(selectedNotification.notificationId!)} disabled={mutating}>
                {t(K.notifications.markOpened)}
              </Button>
            ) : null}
            {selectedNotification?.sourceKind && selectedNotification.sourceId && !selectedNotification.actioned ? (
              <Button mode="text" onPress={() => { void handleMarkActioned(selectedNotification); }} disabled={mutating}>
                {t(K.notifications.markActioned)}
              </Button>
            ) : null}
            {selectedNotification?.kind === 'merge-invite' && selectedNotification.notificationId && selectedNotification.status === 'pending' ? (
              <>
                <Button mode="contained-tonal" onPress={() => onRespondToMergeInvite(selectedNotification.notificationId!, 'accepted')} disabled={mutating}>
                  {t(K.notifications.accept)}
                </Button>
                <Button mode="text" onPress={() => onRespondToMergeInvite(selectedNotification.notificationId!, 'dismissed')} disabled={mutating}>
                  {t(K.common.dismiss)}
                </Button>
              </>
            ) : null}
            {selectedNotification && (selectedNotification.kind === 'approval' || selectedNotification.kind === 'merge-request' || selectedNotification.kind === 'merge-history') ? (
              <Button mode="contained" onPress={() => { void handleOpenTarget(selectedNotification); }} disabled={mutating}>
                {selectedNotification.kind === 'approval' ? t(K.notifications.openApproval) : t(K.notifications.openMerge)}
              </Button>
            ) : null}
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {content}
    </ScrollView>
  );
}
