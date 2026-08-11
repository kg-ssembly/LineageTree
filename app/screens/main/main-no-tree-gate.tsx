import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Chip, Dialog, IconButton, Portal, Text, TextInput } from 'react-native-paper';
import { HorizontalTabStrip, Reveal, SectionCard, TabStripCard } from '../../../components';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME } from '../../../constants/styles';
import { I18N_KEYS as K } from '../../../i18n/keys';
import type { useMainScreenController } from './main-controller';

const RESULTS_PER_PAGE = 5;
type RequestAccessTabKey = 'search' | 'direct';

const localStyles = StyleSheet.create({
  dialog: {
    marginHorizontal: 12,
    borderRadius: 20,
  },
  dialogTitle: {
    paddingBottom: 4,
    paddingRight: 44,
  },
  dialogScrollArea: {
    borderBottomWidth: 0,
    borderTopWidth: 0,
    paddingHorizontal: 16,
  },
  dialogActions: {
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 8,
    margin: 0,
  },
  noTreeGate: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  backgroundOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.7,
  },
  card: {
    width: '100%',
  },
  crest: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  noTreeGateText: {
    textAlign: 'center',
  },
  title: {
    marginBottom: 8,
  },
  body: {
    maxWidth: 320,
    marginBottom: 18,
    alignSelf: 'center',
  },
  secondaryAction: {
    marginTop: 10,
  },
  dialogSection: {
    marginBottom: 18,
    gap: 10,
  },
  resultCard: {
    marginBottom: 10,
    borderRadius: 18,
  },
  resultMeta: {
    marginTop: 4,
  },
  resultActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  tabStripCard: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tabStripContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tabStripItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 2,
  },
  pendingRequestCard: {
    width: '100%',
    marginBottom: 14,
    borderRadius: 20,
  },
  pendingRequestNotice: {
    width: '100%',
    marginBottom: 18,
    borderRadius: 18,
    padding: 18,
  },
  pendingRequestNoticeText: {
    marginTop: 6,
  },
  pendingRequestNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pendingRequestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 12,
    flexWrap: 'wrap',
  },
  pendingRequestMeta: {
    marginTop: 10,
  },
  primaryAction: {
    width: '100%',
  },
});

export function MainNoTreeGate({
  onCreateTree,
  controller,
}: {
  onCreateTree: () => void;
  controller: ReturnType<typeof useMainScreenController>;
}) {
  const [requestDialogVisible, setRequestDialogVisible] = useState(false);
  const [pendingRequestDialogVisible, setPendingRequestDialogVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [usernameQuery, setUsernameQuery] = useState('');
  const [results, setResults] = useState<Awaited<ReturnType<typeof controller.onSearchDiscoverableTrees>>>([]);
  const [searching, setSearching] = useState(false);
  const [resultsPage, setResultsPage] = useState(1);
  const [activeTab, setActiveTab] = useState<RequestAccessTabKey>('search');
  const [selectedPendingRequestId, setSelectedPendingRequestId] = useState<string | null>(null);

  const requestAccessTabs: Array<{ key: RequestAccessTabKey; label: string }> = [
    { key: 'search', label: controller.t(K.app.requestAccessSearchTab) },
    { key: 'direct', label: controller.t(K.app.requestAccessDirectTab) },
  ];

  const handleSearch = async () => {
    setSearching(true);
    try {
      const nextResults = await controller.onSearchDiscoverableTrees(searchQuery);
      setResults(nextResults);
      setResultsPage(1);
    } finally {
      setSearching(false);
    }
  };

  const handleIdentifierRequest = async () => {
    await controller.onRequestTreeAccessByIdentifier(usernameQuery);
    setRequestDialogVisible(false);
    setResults([]);
    setResultsPage(1);
    setSearchQuery('');
    setUsernameQuery('');
  };

  const handleRequestAccess = async (treeId: string) => {
    await controller.onRequestTreeAccess(treeId);
    setRequestDialogVisible(false);
    setResults([]);
    setResultsPage(1);
    setSearchQuery('');
    setUsernameQuery('');
  };

  const handleCancelPendingRequest = async (notificationId: string | null | undefined) => {
    if (!notificationId) {
      return;
    }

    await controller.onCancelTreeAccessRequest(notificationId);
    setPendingRequestDialogVisible(false);
    setSelectedPendingRequestId(null);
  };

  const totalPages = Math.max(1, Math.ceil(results.length / RESULTS_PER_PAGE));
  const pagedResults = results.slice((resultsPage - 1) * RESULTS_PER_PAGE, resultsPage * RESULTS_PER_PAGE);
  const pendingTreeAccessRequests = controller.pendingTreeAccessRequests ?? [];
  const pendingRequestTreeIds = new Set(pendingTreeAccessRequests.map((notification) => notification.sourceTreeId));
  const pendingIdentifierKeys = new Set(
    pendingTreeAccessRequests
      .map((notification) => notification.targetIdentifier.trim().toLowerCase())
      .filter(Boolean),
  );
  const renderablePendingRequests = pendingTreeAccessRequests.filter((notification) => (
    Boolean(
      notification.message?.trim()
      || notification.sourceTreeName?.trim()
      || notification.targetIdentifier?.trim(),
    )
  ));
  const selectedPendingRequest = renderablePendingRequests.find((notification) => notification.id === selectedPendingRequestId)
    ?? renderablePendingRequests[0]
    ?? null;
  const selectedPendingRequestTreeName = selectedPendingRequest?.sourceTreeName?.trim() || controller.t(K.common.unknown);
  const selectedPendingRequestIdentifier = selectedPendingRequest?.targetIdentifier?.trim() || '';
  const selectedPendingRequestMessage = selectedPendingRequest?.message?.trim() || '';
  const hasRenderablePendingRequests = renderablePendingRequests.length > 0;

  const openPendingRequest = (notificationId: string) => {
    setSelectedPendingRequestId(notificationId);
    setPendingRequestDialogVisible(true);
  };

  const formatPendingRequestLabel = (notification: typeof pendingTreeAccessRequests[number]) => (
    notification.targetIdentifier?.trim()
      ? `${notification.sourceTreeName} • ${notification.targetIdentifier.trim()}`
      : notification.sourceTreeName
  );

  return (
    <View style={localStyles.noTreeGate}>
      <View style={localStyles.contentWrap}>
        <Reveal delay={60}>
          <SectionCard
            variant="tree"
            style={[
              localStyles.card,
            ]}
            elevation={1}
          >
          <View style={[localStyles.crest, { backgroundColor: controller.theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="family-tree" size={40} color={controller.theme.colors.primary} />
          </View>

          <View style={localStyles.chipRow}>
            <Chip compact icon="account-group-outline">{controller.t(K.navigation.members)}</Chip>
            <Chip compact icon="timeline-text-outline">{controller.t(K.navigation.tree)}</Chip>
            <Chip compact icon="image-outline">{controller.t(K.memories.memories)}</Chip>
          </View>

          {hasRenderablePendingRequests ? (
            <View style={localStyles.dialogSection}>
              <View
                style={[
                  localStyles.pendingRequestNotice,
                  {
                    backgroundColor: controller.theme.colors.elevation.level1,
                    borderColor: controller.theme.colors.outlineVariant,
                    borderWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View style={localStyles.pendingRequestNoticeHeader}>
                  <MaterialCommunityIcons name="clock-check-outline" size={22} color={controller.theme.colors.primary} />
                  <Text variant="titleMedium" style={{ color: controller.theme.colors.onSurface }}>
                    {controller.t(K.app.requestedAccessPending)}
                  </Text>
                </View>
                <Text
                  variant="bodyMedium"
                  style={[localStyles.pendingRequestNoticeText, { color: controller.theme.colors.onSurfaceVariant }]}
                >
                  {controller.t(K.app.requestedAccessPendingMessage, { treeName: selectedPendingRequestTreeName })}
                </Text>
              </View>

              {renderablePendingRequests.map((notification) => (
                <SectionCard
                  key={notification.id}
                  elevation={1}
                  backgroundColor={controller.theme.colors.surfaceVariant}
                  style={localStyles.pendingRequestCard}
                >
                  <Text variant="titleMedium">{notification.sourceTreeName?.trim() || controller.t(K.common.unknown)}</Text>
                  <Text variant="bodySmall" style={[localStyles.pendingRequestMeta, { color: controller.theme.colors.onSurfaceVariant }]}>
                    {notification.message?.trim() || controller.t(K.app.requestedAccessPendingMessage, { treeName: notification.sourceTreeName || controller.t(K.common.unknown) })}
                  </Text>
                  <Text variant="labelMedium" style={[localStyles.pendingRequestMeta, { color: controller.theme.colors.onSurface }]}>
                    {formatPendingRequestLabel(notification)}
                  </Text>
                  <View style={localStyles.pendingRequestActions}>
                    <Button mode="outlined" onPress={() => openPendingRequest(notification.id)} buttonColor={controller.theme.colors.surface} textColor={controller.theme.colors.primary}>
                      {controller.t(K.common.open)}
                    </Button>
                    <Button mode="outlined" onPress={() => { void handleCancelPendingRequest(notification.id); }} disabled={controller.mutating} buttonColor={controller.theme.colors.surface} textColor={controller.theme.colors.primary}>
                      {controller.t(K.app.requestedAccessCancel)}
                    </Button>
                  </View>
                </SectionCard>
              ))}
            </View>
          ) : (
            <>
              <Text variant="headlineSmall" style={[localStyles.noTreeGateText, localStyles.title, { color: controller.theme.colors.onSurface }]}>
                {controller.t(K.app.noFamilyTreeYet)}
              </Text>
              <Text variant="bodyMedium" style={[localStyles.noTreeGateText, localStyles.body, { color: controller.theme.colors.onSurfaceVariant }]}>
                {controller.t(K.app.createFirstFamilyTree)}
              </Text>
            </>
          )}
          <Button
            mode="contained"
            icon="account-search-outline"
            onPress={() => setRequestDialogVisible(true)}
            style={[localStyles.primaryAction, BUTTON_CHROME]}
            contentStyle={BUTTON_CONTENT_CHROME}
          >
            {controller.t(K.app.requestAccessToTree)}
          </Button>
          <Button
            mode="outlined"
            icon="plus"
            onPress={onCreateTree}
            style={[localStyles.secondaryAction, BUTTON_CHROME]}
            contentStyle={BUTTON_CONTENT_CHROME}
          >
            {controller.t(K.app.startOwnFamilyTree)}
          </Button>
          </SectionCard>
        </Reveal>
      </View>

      <Portal>
        <Dialog
          visible={pendingRequestDialogVisible}
          onDismiss={() => setPendingRequestDialogVisible(false)}
          style={[localStyles.dialog, { backgroundColor: controller.theme.colors.surface }]}
        >
          <Dialog.Title style={localStyles.dialogTitle}>
            {controller.t(K.app.requestedAccessDetails)}
          </Dialog.Title>
          <IconButton
            icon="close"
            onPress={() => setPendingRequestDialogVisible(false)}
            accessibilityLabel={controller.t(K.common.close)}
            style={localStyles.closeButton}
          />
          <Dialog.Content>
            {selectedPendingRequest ? (
              <View style={localStyles.dialogSection}>
                <Text variant="titleMedium">{selectedPendingRequestTreeName}</Text>
                <Text variant="bodyMedium" style={{ color: controller.theme.colors.onSurfaceVariant }}>
                  {selectedPendingRequestMessage || controller.t(K.app.requestedAccessPendingMessage, { treeName: selectedPendingRequestTreeName })}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {selectedPendingRequestIdentifier ? <Chip compact icon="account-arrow-right-outline">{selectedPendingRequestIdentifier}</Chip> : null}
                  <Chip compact icon="calendar-clock">
                    {selectedPendingRequest ? new Date(selectedPendingRequest.createdAt).toLocaleDateString() : ''}
                  </Chip>
                </View>
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions style={[localStyles.dialogActions, { borderTopColor: controller.theme.colors.outlineVariant }]}>
            <Button onPress={() => setPendingRequestDialogVisible(false)}>{controller.t(K.common.close)}</Button>
            {selectedPendingRequest ? (
              <Button mode="outlined" onPress={() => { void handleCancelPendingRequest(selectedPendingRequest.id); }} disabled={controller.mutating} buttonColor={controller.theme.colors.surface} textColor={controller.theme.colors.primary}>
                {controller.t(K.app.requestedAccessCancel)}
              </Button>
            ) : null}
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={requestDialogVisible}
          onDismiss={() => setRequestDialogVisible(false)}
          style={[localStyles.dialog, { backgroundColor: controller.theme.colors.surface }]}
        >
          <Dialog.Title style={localStyles.dialogTitle}>
            {controller.t(K.app.requestAccessToTree)}
          </Dialog.Title>
          <IconButton
            icon="close"
            onPress={() => setRequestDialogVisible(false)}
            accessibilityLabel={controller.t(K.common.close)}
            style={localStyles.closeButton}
          />
          <Dialog.ScrollArea style={localStyles.dialogScrollArea}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 8 }}>
              <TabStripCard style={{ backgroundColor: controller.theme.colors.surfaceVariant }}>
                <HorizontalTabStrip
                  items={requestAccessTabs}
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  contentContainerStyle={localStyles.tabStripContent}
                  itemStyle={localStyles.tabStripItem}
                />
              </TabStripCard>

              {activeTab === 'search' ? (
                <View style={localStyles.dialogSection}>
                  <Text variant="titleSmall">{controller.t(K.app.searchBySurnameOrTreeName)}</Text>
                  <TextInput
                    mode="outlined"
                    label={controller.t(K.app.surnameOrTreeName)}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    left={<TextInput.Icon icon="magnify" />}
                  />
                  <Button mode="contained" onPress={() => { void handleSearch(); }} disabled={!searchQuery.trim() || searching || controller.mutating} buttonColor={controller.theme.colors.primary} textColor={controller.theme.colors.onPrimary}>
                    {controller.t(K.app.searchTrees)}
                  </Button>
                </View>
              ) : (
                <View style={localStyles.dialogSection}>
                  <Text variant="titleSmall">{controller.t(K.app.enterUsernameOrEmailDirectly)}</Text>
                  <Text variant="bodySmall" style={{ color: controller.theme.colors.onSurfaceVariant }}>
                    {controller.t(K.app.enterUsernameOrEmailDirectlyHelper)}
                  </Text>
                  <TextInput
                    mode="outlined"
                    label={controller.t(K.app.usernameEmailOrTreeId)}
                    value={usernameQuery}
                    onChangeText={setUsernameQuery}
                    autoCapitalize="none"
                    left={<TextInput.Icon icon="account" />}
                  />
                  <Button
                    mode="outlined"
                    onPress={() => { void handleIdentifierRequest(); }}
                    disabled={!usernameQuery.trim() || pendingIdentifierKeys.has(usernameQuery.trim().toLowerCase()) || searching || controller.mutating}
                    buttonColor={controller.theme.colors.surface}
                    textColor={controller.theme.colors.primary}
                  >
                    {controller.t(K.app.requestAccessDirectly)}
                  </Button>
                </View>
              )}

              {searching ? (
                <ActivityIndicator color={controller.theme.colors.primary} style={{ marginVertical: 12 }} />
              ) : null}

              {activeTab === 'search' ? pagedResults.map((result) => {
                const requestIsPending = pendingRequestTreeIds.has(result.id);

                return (
                  <SectionCard
                    key={result.id}
                    elevation={1}
                    backgroundColor={controller.theme.colors.surfaceVariant}
                    style={localStyles.resultCard}
                  >
                      <Text variant="titleMedium">{result.name}</Text>
                      <Text variant="bodySmall" style={[localStyles.resultMeta, { color: controller.theme.colors.onSurfaceVariant }]}>
                        {controller.t(K.app.discoverableTreeOwnedBy, { name: result.ownerDisplayName || result.ownerUsername || controller.t(K.common.unknown) })}
                      </Text>
                      <View style={[localStyles.resultActions]}>
                        <Chip compact icon={result.matchedBy === 'username' ? 'account-search' : 'family-tree'}>
                          {result.matchedLabel}
                        </Chip>
                        <Button
                          mode={requestIsPending ? 'outlined' : 'contained'}
                          onPress={() => { void handleRequestAccess(result.id); }}
                          disabled={controller.mutating || requestIsPending}
                        >
                          {requestIsPending ? controller.t(K.app.requestedAccessPending) : controller.t(K.app.requestAccess)}
                        </Button>
                      </View>
                  </SectionCard>
                );
              }) : null}

              {activeTab === 'search' && results.length > RESULTS_PER_PAGE ? (
                <View style={localStyles.paginationRow}>
                  <Button mode="outlined" onPress={() => setResultsPage((page) => Math.max(1, page - 1))} disabled={resultsPage === 1}>
                    {controller.t(K.common.previous)}
                  </Button>
                  <Text variant="bodySmall" style={{ color: controller.theme.colors.onSurfaceVariant }}>
                    {controller.t(K.app.resultsPageCount, { current: resultsPage, total: totalPages })}
                  </Text>
                  <Button mode="outlined" onPress={() => setResultsPage((page) => Math.min(totalPages, page + 1))} disabled={resultsPage === totalPages}>
                    {controller.t(K.common.next)}
                  </Button>
                </View>
              ) : null}

              {!searching && activeTab === 'search' && results.length === 0 && searchQuery.trim() ? (
                <Text variant="bodyMedium" style={{ color: controller.theme.colors.onSurfaceVariant }}>
                  {controller.t(K.app.noDiscoverableTreesFound)}
                </Text>
              ) : null}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[localStyles.dialogActions, { borderTopColor: controller.theme.colors.outlineVariant }]}>
            <Button onPress={() => setRequestDialogVisible(false)}>{controller.t(K.common.close)}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
