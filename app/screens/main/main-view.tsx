import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  CollaboratorDialog,
  ConfirmDialog,
  FloatingSnackbar,
  PersonFormDialog,
  RelationshipDialog,
  SharedLoader,
  StartupModal,
  TreeFormDialog,
} from '../../../components';
import { Button, Dialog, Portal, Surface, Text } from 'react-native-paper';
import { canManageTree } from '../../../components/dto/tree';
import { GlobalStyles } from '../../../constants/styles';
import { I18N_KEYS as K } from '../../../i18n/keys';
import type { useMainScreenController } from './main-controller';
import { MainNoTreeGate } from './main-no-tree-gate';
import { MainNodeQuickActionsDialog } from './main-node-quick-actions-dialog';
import { MainTabNavigator } from './main-tab-navigator';

const styles = GlobalStyles.treeDetail;
const dialogChrome = GlobalStyles.dialogChrome;

export function MainScreenView({ controller }: { controller: ReturnType<typeof useMainScreenController> }) {
  const isWaitingForInitialTreeSelection = controller.loadingTrees
    || (controller.trees.length > 0 && !controller.selectedTree && !controller.sharedTabProps);

  const noTreeGate = (
    <MainNoTreeGate
      controller={controller}
      onCreateTree={controller.openCreateTreeDialog}
    />
  );

  if (isWaitingForInitialTreeSelection) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: controller.theme.colors.background }]}>
        <ActivityIndicator size="large" color={controller.theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: controller.theme.colors.background }]}>
      <MainTabNavigator controller={controller} noTreeGate={noTreeGate} styles={styles} />

      <CollaboratorDialog
        visible={controller.collaboratorDialogVisible}
        loading={controller.mutating}
        onDismiss={controller.closeCollaboratorDialog}
        onSubmit={controller.dialogActions.handleCollaboratorSubmit}
      />

      <PersonFormDialog
        visible={controller.personDialog.visible}
        mode={controller.personDialog.mode}
        person={controller.personDialog.person}
        initialPendingRelationships={controller.personDialog.initialPendingRelationships}
        loading={controller.mutating}
        existingLastNames={controller.existingLastNames}
        relationshipCandidates={controller.personDialogRelationshipCandidates}
        relationships={controller.relationships}
        onDismiss={controller.closePersonDialog}
        onSubmit={controller.dialogActions.handlePersonSubmit}
        onDelete={controller.personDialog.mode === 'edit' && controller.personDialog.person ? async () => {
          await controller.onDeletePerson(controller.personDialog.person!);
          controller.closePersonDialog();
        } : undefined}
      />

      <PersonFormDialog
        visible={controller.selfPersonDialogVisible}
        mode="create"
        initialValues={controller.selfInitialValues}
        loading={controller.mutating}
        existingLastNames={controller.existingLastNames}
        relationshipCandidates={controller.sharedTabProps?.people ?? []}
        onDismiss={controller.closeSelfPersonDialog}
        onSubmit={controller.dialogActions.handleSelfPersonSubmit}
      />

      <RelationshipDialog
        visible={controller.relationshipDialogVisible}
        people={controller.sharedTabProps?.people ?? []}
        relationships={controller.relationships}
        loading={controller.mutating}
        onDismiss={controller.closeRelationshipDialog}
        onSubmit={controller.dialogActions.handleRelationshipSubmit}
      />

      <TreeFormDialog
        visible={controller.treeDialog.visible}
        mode={controller.treeDialog.mode}
        tree={controller.treeDialog.tree}
        loading={controller.mutating}
        onDismiss={controller.closeTreeDialog}
        onSubmit={controller.dialogActions.handleTreeDialogSubmit}
        onDelete={controller.treeDialog.mode === 'edit' && controller.treeDialog.tree && canManageTree(controller.treeDialog.tree, controller.user?.id)
          ? async () => {
            const { tree } = controller.treeDialog;
            if (!tree) {
              return;
            }
            controller.closeTreeDialog();
            controller.handleConfirmDeleteTree(tree);
          }
          : null}
      />

      <Portal>
        <Dialog
          visible={controller.treeNameSuggestion.visible}
          onDismiss={controller.mutating ? undefined : controller.closeTreeNameSuggestion}
          style={[dialogChrome.dialog, { backgroundColor: controller.theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
            Similar family trees found
          </Dialog.Title>
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium" style={{ color: controller.theme.colors.onSurfaceVariant }}>
              We found discoverable trees named "{controller.treeNameSuggestion.requestedName}". You may want to request access instead of creating a duplicate tree.
            </Text>
            <View style={{ marginTop: 16, gap: 10 }}>
              {controller.treeNameSuggestion.matches.map((match) => (
                <Surface
                  key={match.id}
                  style={{
                    backgroundColor: controller.theme.colors.elevation.level1,
                    borderColor: controller.theme.colors.outlineVariant,
                    borderWidth: 1,
                    borderRadius: 18,
                    padding: 14,
                  }}
                  elevation={0}
                >
                  <Text variant="titleMedium">{match.name}</Text>
                  <Text variant="bodySmall" style={{ color: controller.theme.colors.onSurfaceVariant, marginTop: 4 }}>
                    Owned by {match.ownerDisplayName || match.ownerUsername || controller.t(K.common.unknown)}
                  </Text>
                  <Button
                    mode="contained-tonal"
                    onPress={() => { void controller.requestAccessToSuggestedTree(match.id); }}
                    disabled={controller.mutating}
                    style={{ marginTop: 12, alignSelf: 'flex-start' }}
                  >
                    {controller.t(K.app.requestAccess)}
                  </Button>
                </Surface>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: controller.theme.colors.outlineVariant }]}>
            <Button onPress={controller.closeTreeNameSuggestion} disabled={controller.mutating}>
              {controller.t(K.common.cancel)}
            </Button>
            <Button mode="contained" onPress={() => { void controller.continueCreatingSuggestedTree(); }} disabled={controller.mutating}>
              Create anyway
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <MainNodeQuickActionsDialog controller={controller} />

      <ConfirmDialog
        visible={controller.confirmState.visible}
        title={controller.confirmState.title}
        message={controller.confirmState.message}
        confirmLabel={controller.confirmState.confirmLabel}
        loading={controller.mutating}
        onDismiss={controller.closeConfirm}
        onConfirm={controller.dialogActions.handleConfirmAction}
      />

      <StartupModal
        visible={controller.startupModal.visible}
        mode={controller.startupModal.mode}
        currentVersion={controller.startupModal.currentVersion}
        updateHighlights={controller.startupModal.updateHighlights}
        initialLanguage={controller.startupModal.initialLanguage}
        loading={controller.startupModal.loading}
        onSubmitLanguage={controller.handleStartupLanguageSubmit}
        onDismissUpdate={controller.handleUpdateModalDismiss}
      />

      <SharedLoader visible={controller.mutating || controller.startupModal.loading || controller.discoverabilityPrompt.loading} />

      <Portal>
        <Dialog
          visible={Boolean(controller.priorityAlert)}
          onDismiss={() => { void controller.dismissPriorityAlert(); }}
          style={[dialogChrome.dialog, { backgroundColor: controller.theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
            {controller.priorityAlert?.title ?? controller.t(K.notifications.notification)}
          </Dialog.Title>
          <Dialog.Content style={dialogChrome.content}>
            {controller.priorityAlert ? (
              <>
                <Text variant="bodySmall" style={{ color: controller.theme.colors.onSurfaceVariant }}>
                  {controller.priorityAlert.createdAt.slice(0, 16).replace('T', ' ')}
                </Text>
                {controller.priorityAlert.status ? (
                  <Text variant="bodySmall" style={{ color: controller.theme.colors.primary, marginTop: 6 }}>
                    {controller.priorityAlert.status}
                  </Text>
                ) : null}
                <Text variant="bodyMedium" style={{ marginTop: 12 }}>
                  {controller.priorityAlert.message}
                </Text>
              </>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: controller.theme.colors.outlineVariant }]}>
            <Button onPress={() => { void controller.dismissPriorityAlert(); }}>
              {controller.t(K.common.close)}
            </Button>
            {controller.priorityAlert?.kind === 'tree-access-request' ? (
              <Button mode="text" onPress={() => { void controller.respondToPriorityTreeAccess('rejected'); }} disabled={controller.mutating}>
                {controller.t(K.notifications.declineAccess)}
              </Button>
            ) : null}
            {controller.priorityAlert?.kind === 'tree-access-request' ? (
              <Button mode="contained" onPress={() => { void controller.respondToPriorityTreeAccess('accepted'); }} disabled={controller.mutating}>
                {controller.t(K.notifications.approveAccess)}
              </Button>
            ) : null}
            {controller.priorityAlert?.kind === 'merge-invite' ? (
              <Button mode="text" onPress={() => { void controller.respondToPriorityMergeInvite('dismissed'); }} disabled={controller.mutating}>
                {controller.t(K.common.dismiss)}
              </Button>
            ) : null}
            {controller.priorityAlert?.kind === 'merge-invite' ? (
              <Button mode="contained" onPress={() => { void controller.respondToPriorityMergeInvite('accepted'); }} disabled={controller.mutating}>
                {controller.t(K.notifications.accept)}
              </Button>
            ) : null}
            {controller.priorityAlert && (controller.priorityAlert.kind === 'merge-request' || controller.priorityAlert.kind === 'merge-history') ? (
              <Button mode="contained" onPress={() => { void controller.openPriorityAlertTarget(); }} disabled={controller.mutating}>
                {controller.t(K.notifications.openMerge)}
              </Button>
            ) : null}
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={controller.discoverabilityPrompt.visible}
          dismissable={false}
          style={[dialogChrome.dialog, { backgroundColor: controller.theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
            {controller.t(K.app.discoverabilityPromptTitle)}
          </Dialog.Title>
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium" style={{ color: controller.theme.colors.onSurfaceVariant }}>
              {controller.t(K.app.discoverabilityPromptMessage)}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: controller.theme.colors.outlineVariant }]}>
            <Button mode="text" onPress={() => { void controller.handleDiscoverabilityPromptChoice(false); }} disabled={controller.discoverabilityPrompt.loading}>
              {controller.t(K.app.discoverabilityPromptKeepPrivate)}
            </Button>
            <Button mode="contained" onPress={() => { void controller.handleDiscoverabilityPromptChoice(true); }} disabled={controller.discoverabilityPrompt.loading}>
              {controller.t(K.app.discoverabilityPromptMake)}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FloatingSnackbar
        visible={controller.snackVisible}
        onDismiss={controller.dismissSnackbar}
        duration={5000}
        action={{ label: controller.t(K.common.dismiss), onPress: controller.dismissSnackbar }}
      >
        {controller.snackMessage}
      </FloatingSnackbar>
    </View>
  );
}
