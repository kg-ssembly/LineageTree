import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Button,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Text,
  useTheme,
} from 'react-native-paper';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, GlobalStyles, InfoDialog, Reveal, SectionCard } from '../../../../components';
import type { NotificationActivityState } from '../../../../components/dto/notification';
import type { MainTabParamList } from '../../../../components/dto/navigation';
import { useI18n } from '../../../../hooks/use-i18n';
import { translate } from '../../../../i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import type { SharedTabProps } from '../shared';

const dialogChrome = GlobalStyles.dialogChrome;
const styles = GlobalStyles.treeDetail;
const ACTIVITY_PAGE_SIZE = 5;
const EMBEDDED_ATTENTION_LIMIT = 6;
const EMBEDDED_COMPLETED_LIMIT = 4;
type NotificationFilterKey = 'attention' | 'done';

type NotificationFeedKind = 'merge-invite' | 'tree-access-request' | 'tree-access-response' | 'approval' | 'merge-request' | 'merge-history' | 'membership';

type NotificationFeedItem = {
  id: string;
  kind: NotificationFeedKind;
  title: string;
  message: string;
  createdAt: string;
  status?: string;
  treeName?: string;
  sourceTreeId?: string;
  notificationId?: string;
  sourceKind?: NotificationActivityState['sourceKind'];
  sourceId?: string;
  requestId?: string;
  seen?: boolean;
  opened?: boolean;
  actioned?: boolean;
};

function formatCompactTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return translate('Now');
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d`;
  }

  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function getItemCategoryLabel(item: NotificationFeedItem, t: ReturnType<typeof useI18n>['t']) {
  if (item.kind === 'approval') {
    return t(K.notifications.approval);
  }
  if (item.kind === 'membership' || item.kind === 'tree-access-request' || item.kind === 'tree-access-response') {
    return t(K.notifications.access);
  }
  return t(K.notifications.merge);
}

function isItemComplete(item: NotificationFeedItem) {
  if ((item.kind === 'merge-invite' || item.kind === 'tree-access-request') && item.status === 'pending') {
    return false;
  }

  if (item.notificationId) {
    return Boolean(item.opened || item.seen);
  }

  return Boolean(item.actioned);
}

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
  openConfirm,
  onRespondToMergeInvite,
  onRespondToTreeAccessRequest,
  onMarkNotificationSeen,
  onMarkNotificationOpened,
  onMarkNotificationActivityActioned,
  onDeleteNotification,
  onDeleteNotificationActivity,
  onDeleteAllNotifications,
  onLoadMergePreview,
  onOpenTreeSettingsTarget,
  onSwitchTree,
  embedded = false,
  scrollable = !embedded,
  navigation,
}: SharedTabProps & { embedded?: boolean; scrollable?: boolean; navigation: { navigate: (name: keyof MainTabParamList) => void } }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [selectedNotification, setSelectedNotification] = useState<NotificationFeedItem | null>(null);
  const [helperVisible, setHelperVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NotificationFilterKey>('attention');
  const [currentPage, setCurrentPage] = useState(1);
  const [embeddedFilter, setEmbeddedFilter] = useState<'attention' | 'done'>('attention');

  const activityStateByKey = useMemo(
    () => new Map(notificationActivityStates.map((state) => [`${state.sourceKind}:${state.sourceId}`, state])),
    [notificationActivityStates],
  );

  const notificationFeed = useMemo<NotificationFeedItem[]>(() => {
    const directNotifications = notifications.map<NotificationFeedItem>((notification) => ({
      id: `direct-${notification.id}`,
      kind: notification.type === 'tree-access-request'
        ? 'tree-access-request'
        : notification.type === 'tree-access-response'
          ? 'tree-access-response'
          : 'merge-invite',
      title: notification.type === 'tree-access-request'
        ? t(K.notifications.treeAccessRequest)
        : notification.type === 'tree-access-response'
          ? t(K.notifications.treeAccessUpdate)
          : t(K.notifications.mergeInvitation),
      message: notification.message,
      createdAt: notification.createdAt,
      status: notification.status,
      treeName: notification.sourceTreeName,
      sourceTreeId: notification.sourceTreeId,
      notificationId: notification.id,
      seen: Boolean(notification.seenAt),
      opened: Boolean(notification.openedAt),
    }));

    const approvalNotifications = approvalRequests
      .filter((request) => !activityStateByKey.get(`approval:${request.id}`)?.deletedAt)
      .map<NotificationFeedItem>((request) => ({
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

    const mergeRequestNotifications = mergeRequests
      .filter((request) => !activityStateByKey.get(`merge-request:${request.id}`)?.deletedAt)
      .map<NotificationFeedItem>((request) => ({
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

    const mergeHistoryNotifications = mergeHistory
      .filter((entry) => !activityStateByKey.get(`merge-history:${entry.id}`)?.deletedAt)
      .map<NotificationFeedItem>((entry) => ({
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
      .filter(({ tree, entry }) => !activityStateByKey.get(`membership:${tree.id}-${entry.id}`)?.deletedAt)
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

  const feedMetrics = useMemo(() => {
    const unseenDirectIds: string[] = [];
    const unopenedDirectIds: string[] = [];
    const unactionedDerivedItems: Array<{ sourceKind: NotificationActivityState['sourceKind']; sourceId: string }> = [];
    const attentionItems: NotificationFeedItem[] = [];
    const completedItems: NotificationFeedItem[] = [];

    for (const item of notificationFeed) {
      if (item.notificationId && !item.seen) {
        unseenDirectIds.push(item.notificationId);
      }

      if (item.notificationId && !item.opened) {
        unopenedDirectIds.push(item.notificationId);
      }

      if (item.sourceKind && item.sourceId && !item.actioned) {
        unactionedDerivedItems.push({
          sourceKind: item.sourceKind,
          sourceId: item.sourceId,
        });
      }

      if (isItemComplete(item)) {
        completedItems.push(item);
      } else {
        attentionItems.push(item);
      }
    }

    return {
      unseenDirectIds,
      unopenedDirectIds,
      unactionedDerivedItems,
      attentionItems,
      completedItems,
      embeddedAttentionItems: attentionItems.slice(0, EMBEDDED_ATTENTION_LIMIT),
      embeddedCompletedItems: completedItems.slice(0, EMBEDDED_COMPLETED_LIMIT),
    };
  }, [notificationFeed]);

  const filteredFeed = useMemo(
    () => (activeFilter === 'attention' ? feedMetrics.attentionItems : feedMetrics.completedItems),
    [activeFilter, feedMetrics.attentionItems, feedMetrics.completedItems],
  );

  const openNotification = async (item: NotificationFeedItem) => {
    setSelectedNotification(item);
    if (item.notificationId && userId) {
      await onMarkNotificationOpened(item.notificationId);
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredFeed.length / ACTIVITY_PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, filteredFeed.length]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedFeed = useMemo(() => {
    const startIndex = (currentPage - 1) * ACTIVITY_PAGE_SIZE;
    return filteredFeed.slice(startIndex, startIndex + ACTIVITY_PAGE_SIZE);
  }, [currentPage, filteredFeed]);

  useEffect(() => {
    if (!embedded) {
      return;
    }

    if (feedMetrics.attentionItems.length > 0) {
      setEmbeddedFilter('attention');
      return;
    }

    setEmbeddedFilter('done');
  }, [embedded, feedMetrics.attentionItems.length]);

  const handleMarkAllSeen = async () => {
    for (const notificationId of feedMetrics.unseenDirectIds) {
      await onMarkNotificationSeen(notificationId);
    }
  };

  const handleMarkAllOpened = async () => {
    for (const notificationId of feedMetrics.unopenedDirectIds) {
      await onMarkNotificationOpened(notificationId);
    }
  };

  const handleMarkAllActioned = async () => {
    for (const item of feedMetrics.unactionedDerivedItems) {
      await onMarkNotificationActivityActioned(item.sourceKind, item.sourceId);
    }
  };

  const handleMarkActioned = async (item: NotificationFeedItem) => {
    if (!item.sourceKind || !item.sourceId) {
      return;
    }

    await onMarkNotificationActivityActioned(item.sourceKind, item.sourceId);
  };

  const handleDeleteItem = async (item: NotificationFeedItem) => {
    if (item.notificationId) {
      await onDeleteNotification(item.notificationId);
    } else if (item.sourceKind && item.sourceId) {
      await onDeleteNotificationActivity(item.sourceKind, item.sourceId);
    }
    setSelectedNotification((current) => (current?.id === item.id ? null : current));
  };

  const handleDeleteAll = async () => {
    await onDeleteAllNotifications(
      notificationFeed.flatMap((item) => item.notificationId ? [item.notificationId] : []),
      notificationFeed.flatMap((item) => (
        item.sourceKind && item.sourceId
          ? [{ sourceKind: item.sourceKind, sourceId: item.sourceId }]
          : []
      )),
    );
    setSelectedNotification(null);
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

  const canOpenApprovedTree = (item: NotificationFeedItem) => (
    item.kind === 'tree-access-response'
    && item.status === 'accepted'
    && Boolean(item.sourceTreeId)
    && Boolean(trees?.some((tree) => tree.id === item.sourceTreeId))
    && Boolean(onSwitchTree)
  );

  const handleOpenApprovedTree = async (item: NotificationFeedItem) => {
    if (!canOpenApprovedTree(item) || !item.sourceTreeId || !onSwitchTree) {
      return;
    }

    const grantedTree = trees?.find((tree) => tree.id === item.sourceTreeId);
    if (!grantedTree) {
      return;
    }

    await onSwitchTree(grantedTree);
    navigation.navigate('tree' satisfies keyof MainTabParamList);
    setSelectedNotification(null);
  };

  const handleAcceptMergeInvite = async (item: NotificationFeedItem) => {
    if (!item.notificationId || !item.sourceTreeId) {
      return;
    }

    await onLoadMergePreview(item.sourceTreeId, selectedTree.id);
    await onRespondToMergeInvite(item.notificationId, 'accepted');
    navigation.navigate('treeSettings' satisfies keyof MainTabParamList);
    setSelectedNotification(null);
  };

  const renderCompactRow = (item: NotificationFeedItem) => {
    const categoryLabel = getItemCategoryLabel(item, t);
    const complete = isItemComplete(item);
    const primaryActionLabel = item.kind === 'approval' ? t('Review') : t(K.common.open);
    const canOpenTarget = item.kind === 'approval' || item.kind === 'merge-request' || item.kind === 'merge-history' || canOpenApprovedTree(item);

    return (
      <Pressable
        key={item.id}
        onPress={() => { void openNotification(item); }}
        style={{
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 11,
          backgroundColor: complete ? theme.colors.surface : theme.colors.elevation.level1,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              marginTop: 5,
              backgroundColor: complete ? theme.colors.outline : theme.colors.primary,
            }}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text variant="titleSmall" numberOfLines={1} style={{ flex: 1 }}>
                {item.title}
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {formatCompactTimestamp(item.createdAt)}
              </Text>
            </View>
            <Text variant="bodySmall" numberOfLines={2} style={{ color: theme.colors.onSurfaceVariant, lineHeight: 18 }}>
              {item.message}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Chip compact style={{ height: 28 }}>
                  {complete ? t(K.common.done) : t('Needs action')}
                </Chip>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                  {categoryLabel}{item.treeName ? ` · ${item.treeName}` : ''}
                </Text>
              </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  {!complete && canOpenTarget ? (
                    <Button compact mode="text" onPress={() => { void (canOpenApprovedTree(item) ? handleOpenApprovedTree(item) : handleOpenTarget(item)); }} disabled={mutating}>
                      {primaryActionLabel}
                    </Button>
                  ) : null}
                  <IconButton
                    icon="delete-outline"
                    size={18}
                    onPress={() => openConfirm('Delete notification?', 'This removes this item from your notifications feed.', t(K.common.delete), async () => handleDeleteItem(item))}
                    disabled={mutating}
                    accessibilityLabel={t(K.common.delete)}
                    style={{ margin: 0 }}
                  />
                </View>
              </View>
            </View>
          </View>
        </Pressable>
    );
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
                <Text variant="headlineSmall">{t(K.notifications.familyActivity)}</Text>
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

        {embedded ? (
          notificationFeed.length > 0 ? (
            <View style={{ gap: 12, paddingBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Chip
                  compact
                  selected={embeddedFilter === 'attention'}
                  onPress={() => setEmbeddedFilter('attention')}
                  style={embeddedFilter === 'attention' ? { backgroundColor: theme.colors.secondaryContainer } : undefined}
                  textStyle={embeddedFilter === 'attention' ? { color: theme.colors.onSecondaryContainer } : undefined}
                >
                  {t(K.notifications.needsAttention)} ({feedMetrics.attentionItems.length})
                </Chip>
                <Chip
                  compact
                  selected={embeddedFilter === 'done'}
                  onPress={() => setEmbeddedFilter('done')}
                  style={embeddedFilter === 'done' ? { backgroundColor: theme.colors.tertiaryContainer } : undefined}
                  textStyle={embeddedFilter === 'done' ? { color: theme.colors.onTertiaryContainer } : undefined}
                >
                  {t(K.common.done)} ({feedMetrics.completedItems.length})
                </Chip>
              </View>
              {(embeddedFilter === 'attention' ? feedMetrics.embeddedAttentionItems : feedMetrics.embeddedCompletedItems).length > 0 ? (
                <View style={{ gap: 8 }}>
                  {(embeddedFilter === 'attention' ? feedMetrics.embeddedAttentionItems : feedMetrics.embeddedCompletedItems).map(renderCompactRow)}
                  {embeddedFilter === 'attention' && feedMetrics.attentionItems.length > feedMetrics.embeddedAttentionItems.length ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t('Showing the latest {count} items first.', { count: feedMetrics.embeddedAttentionItems.length })}
                    </Text>
                  ) : null}
                  {embeddedFilter === 'done' && feedMetrics.completedItems.length > feedMetrics.embeddedCompletedItems.length ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t('Showing the latest {count} items first.', { count: feedMetrics.embeddedCompletedItems.length })}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: 14, padding: 14 }}>
                  <Text variant="bodyMedium">
                    {embeddedFilter === 'attention' ? t(K.notifications.everythingCaughtUp) : t('No completed notifications yet.')}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">{t(K.notifications.yourFamilyActivityFeedIsQuiet)}</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t('Invites, edits, and merge moments will appear here as more people join in and your story grows.')}
              </Text>
            </View>
          )
        ) : notificationFeed.length > 0 ? (
          <Reveal delay={60}>
          <SectionCard nested style={{ marginBottom: 16, borderRadius: 22, gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Text variant="titleSmall">{t(K.notifications.mostRecentFamilyActivity)}</Text>
                <Chip compact icon="timeline-clock-outline">
                  {notificationFeed.length} total
                </Chip>
              </View>
              <View style={[styles.collaboratorChipRow, { justifyContent: 'space-between' }]}>
                <Chip compact icon="bell-ring-outline">{feedMetrics.unseenDirectIds.length} new</Chip>
                <Chip compact icon="email-open-outline">{feedMetrics.unopenedDirectIds.length} unopened</Chip>
                <Chip compact icon="check-decagram-outline">{feedMetrics.unactionedDerivedItems.length} to follow up</Chip>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Chip
                  compact
                  selected={activeFilter === 'attention'}
                  onPress={() => setActiveFilter('attention')}
                  style={activeFilter === 'attention' ? { backgroundColor: theme.colors.primaryContainer } : undefined}
                >
                  {t(K.notifications.needsAttention)} ({feedMetrics.attentionItems.length})
                </Chip>
                <Chip
                  compact
                  selected={activeFilter === 'done'}
                  onPress={() => setActiveFilter('done')}
                  style={activeFilter === 'done' ? { backgroundColor: theme.colors.primaryContainer } : undefined}
                >
                  {t(K.common.done)} ({feedMetrics.completedItems.length})
                </Chip>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Button mode="outlined" onPress={() => openConfirm('Delete all notifications?', 'This will remove direct notifications and hide the rest of the current activity feed.', 'Delete all', handleDeleteAll)} disabled={mutating || notificationFeed.length === 0} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                  Delete all
                </Button>
                <Button mode="outlined" onPress={() => { void handleMarkAllSeen(); }} disabled={mutating || feedMetrics.unseenDirectIds.length === 0} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                  {t('Quiet new alerts')}
                </Button>
                <Button mode="outlined" onPress={() => { void handleMarkAllOpened(); }} disabled={mutating || feedMetrics.unopenedDirectIds.length === 0} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                  {t('Open everything')}
                </Button>
                <Button mode="outlined" onPress={() => { void handleMarkAllActioned(); }} disabled={mutating || feedMetrics.unactionedDerivedItems.length === 0} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                  {t('Mark follow-up done')}
                </Button>
              </View>
          </SectionCard>
          </Reveal>
        ) : null}

        {!embedded && notificationFeed.length > 0 ? (
          <View style={styles.collaboratorList}>
            {paginatedFeed.map((item, index) => (
              <Reveal key={item.id} delay={80 + index * 35}>
                <SectionCard
                  nested
                  style={[styles.collaboratorCard, { backgroundColor: theme.colors.surface, borderRadius: 22, marginBottom: 10, paddingVertical: 14, paddingHorizontal: 14 }]}
                >
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
                      <View style={{ alignItems: 'flex-end', gap: 6, maxWidth: '42%' }}>
                        <IconButton
                          icon="delete-outline"
                          size={18}
                          onPress={() => openConfirm('Delete notification?', 'This removes this item from your notifications feed.', t(K.common.delete), async () => handleDeleteItem(item))}
                          disabled={mutating}
                          accessibilityLabel={t(K.common.delete)}
                          style={{ margin: 0 }}
                        />
                        <View style={[styles.collaboratorChipRow, { justifyContent: 'flex-end' }]}>
                          {item.notificationId && !item.opened && !item.seen ? <Chip compact>{t(K.notifications.new)}</Chip> : null}
                          {item.notificationId && item.seen && !item.opened ? <Chip compact>{t(K.notifications.seen)}</Chip> : null}
                          {item.actioned ? <Chip compact>{t(K.notifications.actioned)}</Chip> : null}
                          {item.status ? <Chip compact>{item.status}</Chip> : null}
                        </View>
                      </View>
                    </View>
                  </Pressable>
                  <View style={[styles.collaboratorChipRow, { marginTop: 6 }]}>
    {item.kind === 'approval' ? <Chip compact>{t(K.notifications.approval)}</Chip> : null}
    {item.kind === 'merge-request' || item.kind === 'merge-history' || item.kind === 'merge-invite' ? <Chip compact>{t(K.notifications.merge)}</Chip> : null}
    {item.kind === 'tree-access-request' || item.kind === 'tree-access-response' ? <Chip compact>{t(K.notifications.access)}</Chip> : null}
    {item.kind === 'membership' ? <Chip compact>{t(K.notifications.access)}</Chip> : null}
                    {item.treeName ? <Chip compact>{item.treeName}</Chip> : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {item.notificationId && !item.seen && !item.opened ? (
                      <Button compact mode="outlined" onPress={() => onMarkNotificationSeen(item.notificationId!)} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                        {t(K.notifications.markSeen)}
                      </Button>
                    ) : null}
                    {item.notificationId && !item.opened ? (
                      <Button compact mode="outlined" onPress={() => onMarkNotificationOpened(item.notificationId!)} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                        {t(K.common.open)}
                      </Button>
                    ) : null}
                    {item.sourceKind && item.sourceId && !item.actioned ? (
                      <Button compact mode="outlined" onPress={() => { void handleMarkActioned(item); }} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                        {t(K.common.done)}
                      </Button>
                    ) : null}
                    {(item.kind === 'approval' || item.kind === 'merge-request' || item.kind === 'merge-history' || canOpenApprovedTree(item)) ? (
                      <Button compact mode="contained" onPress={() => { void (canOpenApprovedTree(item) ? handleOpenApprovedTree(item) : handleOpenTarget(item)); }} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                        {item.kind === 'approval' ? t('Review') : t(K.common.open)}
                      </Button>
                    ) : null}
                  </View>
                </SectionCard>
              </Reveal>
            ))}
            {paginatedFeed.length === 0 ? (
              <View style={styles.emptyState}>
                <Text variant="titleMedium">
                  {activeFilter === 'attention' ? t(K.notifications.everythingCaughtUp) : t(K.notifications.yourFamilyActivityFeedIsQuiet)}
                </Text>
              </View>
            ) : null}
            {totalPages > 1 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
                <IconButton
                  icon="chevron-left"
                  onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  accessibilityLabel={t(K.tree.familyMembers.previousPage)}
                  mode="outlined"
                  style={BUTTON_CHROME}
                  containerColor={theme.colors.surface}
                  iconColor={theme.colors.primary}
                />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t(K.app.resultsPageCount, { current: currentPage, total: totalPages })}
                </Text>
                <IconButton
                  icon="chevron-right"
                  onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  accessibilityLabel={t(K.tree.familyMembers.nextPage)}
                  mode="outlined"
                  style={BUTTON_CHROME}
                  containerColor={theme.colors.surface}
                  iconColor={theme.colors.primary}
                />
              </View>
            ) : null}
          </View>
        ) : !embedded ? (
          <View style={styles.emptyState}>
            <Text variant="titleMedium">{t(K.notifications.yourFamilyActivityFeedIsQuiet)}</Text>
            <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
              {t('Invites, edits, and merge moments will appear here as more people join in and your story grows.')}
            </Text>
          </View>
        ) : null}
      </View>

      <InfoDialog
        visible={helperVisible}
        title={t(K.notifications.notifications)}
        message={t(K.notifications.helper)}
        onDismiss={() => setHelperVisible(false)}
      />

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
              <Button mode="outlined" onPress={() => onMarkNotificationSeen(selectedNotification.notificationId!)} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                {t(K.notifications.markSeen)}
              </Button>
            ) : null}
            {selectedNotification?.notificationId && !selectedNotification.opened ? (
              <Button mode="outlined" onPress={() => onMarkNotificationOpened(selectedNotification.notificationId!)} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                {t(K.notifications.markOpened)}
              </Button>
            ) : null}
            {selectedNotification?.sourceKind && selectedNotification.sourceId && !selectedNotification.actioned ? (
              <Button mode="outlined" onPress={() => { void handleMarkActioned(selectedNotification); }} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                {t(K.notifications.markActioned)}
              </Button>
            ) : null}
            {selectedNotification ? (
              <Button mode="outlined" onPress={() => openConfirm('Delete notification?', 'This removes this item from your notifications feed.', t(K.common.delete), async () => handleDeleteItem(selectedNotification))} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                {t(K.common.delete)}
              </Button>
            ) : null}
            {selectedNotification?.kind === 'merge-invite' && selectedNotification.notificationId && selectedNotification.status === 'pending' ? (
              <Button mode="contained" onPress={() => { void handleAcceptMergeInvite(selectedNotification); }} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                {t(K.notifications.accept)}
              </Button>
            ) : null}
            {selectedNotification?.kind === 'merge-invite' && selectedNotification.notificationId && selectedNotification.status === 'pending' ? (
              <Button mode="outlined" onPress={() => onRespondToMergeInvite(selectedNotification.notificationId!, 'dismissed')} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                {t(K.common.dismiss)}
              </Button>
            ) : null}
            {selectedNotification?.kind === 'tree-access-request' && selectedNotification.notificationId && selectedNotification.status === 'pending' ? (
              <Button mode="contained" onPress={() => onRespondToTreeAccessRequest(selectedNotification.notificationId!, 'accepted')} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                {t(K.notifications.approveAccess)}
              </Button>
            ) : null}
            {selectedNotification?.kind === 'tree-access-request' && selectedNotification.notificationId && selectedNotification.status === 'pending' ? (
              <Button mode="outlined" onPress={() => onRespondToTreeAccessRequest(selectedNotification.notificationId!, 'rejected')} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                {t(K.notifications.declineAccess)}
              </Button>
            ) : null}
            {selectedNotification && (selectedNotification.kind === 'approval' || selectedNotification.kind === 'merge-request' || selectedNotification.kind === 'merge-history') ? (
              <Button mode="contained" onPress={() => { void handleOpenTarget(selectedNotification); }} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                {selectedNotification.kind === 'approval' ? t(K.notifications.openApproval) : t(K.notifications.openMerge)}
              </Button>
            ) : null}
            {selectedNotification && canOpenApprovedTree(selectedNotification) ? (
              <Button mode="contained" onPress={() => { void handleOpenApprovedTree(selectedNotification); }} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                {t(K.common.open)}
              </Button>
            ) : null}
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );

  if (!scrollable) {
    return content;
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {content}
    </ScrollView>
  );
}
