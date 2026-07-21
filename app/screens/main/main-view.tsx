import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  CollaboratorDialog,
  AddPersonEntryDialog,
  ConfirmDialog,
  FloatingSnackbar,
  MaidenTreeSuggestionDialog,
  PersonFormDialog,
  RelationshipDialog,
  ScreenBackground,
  SectionCard,
  SharedLoader,
  StartupModal,
  TreeFormDialog,
} from '../../../components';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { canManageTree } from '../../../components/dto/tree';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME } from '../../../constants/styles';
import { I18N_KEYS as K } from '../../../i18n/keys';
import type { useMainScreenController } from './main-controller';
import { MainNoTreeGate } from './main-no-tree-gate';
import { TreeDetailNodeQuickActionsDialog } from '../profile-shared';
import { MainTabNavigator } from './main-tab-navigator';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabScene: {
    flex: 1,
  },
  tabBar: {
    height: 72,
    paddingTop: 8,
    paddingBottom: 0,
    borderTopWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabItem: {
    minHeight: 52,
  },
});

const dialogChrome = StyleSheet.create({
  dialog: {
    marginHorizontal: 12,
    borderRadius: 20,
  },
  dialogTitle: {
    paddingBottom: 4,
  },
  dialogTitleWithClose: {
    paddingRight: 44,
  },
  content: {
    paddingBottom: 12,
  },
  dialogActions: {
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export function MainScreenView({ controller }: { controller: ReturnType<typeof useMainScreenController> }) {
  const isWaitingForInitialTreeSelection = controller.loadingTrees
    || (controller.trees.length > 0 && !controller.selectedTree && !controller.sharedTabProps);
  const isSharedLoaderVisible = controller.mutating || controller.startupModal.loading || controller.discoverabilityPrompt.loading;

  const noTreeGate = (
    <MainNoTreeGate
      controller={controller}
      onCreateTree={controller.openCreateTreeDialog}
    />
  );

  if (isWaitingForInitialTreeSelection) {
    return (
      <View style={[styles.container, { backgroundColor: controller.theme.colors.background }]}>
        <ScreenBackground />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={controller.theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: controller.theme.colors.background }]}>
      <ScreenBackground />
      <MainTabNavigator controller={controller} noTreeGate={noTreeGate} styles={styles} />

      <CollaboratorDialog
        visible={controller.collaboratorDialogVisible && !isSharedLoaderVisible}
        loading={controller.mutating}
        onDismiss={controller.closeCollaboratorDialog}
        onSubmit={controller.dialogActions.handleCollaboratorSubmit}
      />

      <AddPersonEntryDialog
        visible={controller.addPersonChooserVisible && !isSharedLoaderVisible}
        hasExistingFamilyMembers={controller.people.length > 0}
        relationshipCandidates={controller.people}
        relationships={controller.relationships}
        perspective="new-person"
        onDismiss={controller.closeAddPersonChooser}
        onSelectRelationship={controller.handleAddPersonEntrySelection}
        onSelectRelationshipAttempt={controller.handleMaidenParentSelectionAttempt}
        onAddFirstFamilyMember={controller.handleAddFirstFamilyMember}
      />

      <PersonFormDialog
        visible={controller.personDialog.visible && !isSharedLoaderVisible}
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
        onSelectRelationshipAttempt={controller.handleMaidenParentSelectionAttempt}
      />

      <PersonFormDialog
        visible={controller.selfPersonDialogVisible && !isSharedLoaderVisible}
        mode="create"
        initialValues={controller.selfInitialValues}
        loading={controller.mutating}
        existingLastNames={controller.existingLastNames}
        relationshipCandidates={controller.sharedTabProps?.people ?? []}
        onDismiss={controller.closeSelfPersonDialog}
        onSubmit={controller.dialogActions.handleSelfPersonSubmit}
      />

      <RelationshipDialog
        visible={controller.relationshipDialogVisible && !isSharedLoaderVisible}
        people={controller.sharedTabProps?.people ?? []}
        relationships={controller.relationships}
        loading={controller.mutating}
        onDismiss={controller.closeRelationshipDialog}
        onSubmit={controller.dialogActions.handleRelationshipSubmit}
      />

      <TreeFormDialog
        visible={controller.treeDialog.visible && !isSharedLoaderVisible}
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
        <MaidenTreeSuggestionDialog
          visible={controller.maidenTreeSuggestion.visible && !isSharedLoaderVisible}
          surname={controller.maidenTreeSuggestion.person?.maidenName?.trim() ?? ''}
          candidates={controller.maidenTreeSuggestion.relatedTreeCandidates}
          theme={controller.theme}
          t={controller.t}
          onDismiss={controller.closeMaidenTreeSuggestion}
          onOpenTree={controller.openMaidenTreeCandidate}
          onRequestAccess={controller.requestMaidenTreeAccess}
        />
        <Dialog
          visible={controller.treeNameSuggestion.visible && !isSharedLoaderVisible}
          onDismiss={controller.mutating ? undefined : controller.closeTreeNameSuggestion}
          style={[dialogChrome.dialog, { backgroundColor: controller.theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
            {controller.t(K.app.similarFamilyTreesFound)}
          </Dialog.Title>
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium" style={{ color: controller.theme.colors.onSurfaceVariant }}>
              {controller.t(K.app.similarFamilyTreesMessage, { name: controller.treeNameSuggestion.requestedName })}
            </Text>
            <View style={{ marginTop: 16, gap: 10 }}>
              {controller.treeNameSuggestion.matches.map((match) => (
                <SectionCard
                  key={match.id}
                  elevation={0}
                  backgroundColor={controller.theme.colors.elevation.level1}
                  style={{
                    borderColor: controller.theme.colors.outlineVariant,
                    borderWidth: 1,
                    borderRadius: 18,
                    padding: 14,
                  }}
                >
                  <Text variant="titleMedium">{match.name}</Text>
                  <Text variant="bodySmall" style={{ color: controller.theme.colors.onSurfaceVariant, marginTop: 4 }}>
                    {controller.t(K.app.discoverableTreeOwnedBy, { name: match.ownerDisplayName || match.ownerUsername || controller.t(K.common.unknown) })}
                  </Text>
                  <Button
                    mode="outlined"
                    onPress={() => { void controller.requestAccessToSuggestedTree(match.id); }}
                    disabled={controller.mutating}
                    style={[BUTTON_CHROME, { marginTop: 12, alignSelf: 'flex-start' }]}
                    buttonColor={controller.theme.colors.surface}
                    textColor={controller.theme.colors.primary}
                    contentStyle={BUTTON_CONTENT_CHROME}
                  >
                    {controller.t(K.app.requestAccess)}
                  </Button>
                </SectionCard>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: controller.theme.colors.outlineVariant }]}>
            <Button onPress={controller.closeTreeNameSuggestion} disabled={controller.mutating} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
              {controller.t(K.common.cancel)}
            </Button>
            <Button mode="contained" onPress={() => { void controller.continueCreatingSuggestedTree(); }} disabled={controller.mutating} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
              {controller.t(K.app.createAnyway)}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {!isSharedLoaderVisible ? (
        <TreeDetailNodeQuickActionsDialog
          visible={controller.nodeQuickActionState.visible}
          person={controller.nodeQuickActionState.person}
          theme={controller.theme}
          t={controller.t}
          canEdit={controller.canEdit}
          mutating={controller.mutating}
          closeNodeQuickActions={controller.closeNodeQuickActions}
          openPersonProfile={controller.openPersonProfile}
          openCreateRelativeDialog={controller.openCreateRelativeDialog}
          crossSurnameChildIds={controller.crossSurnameChildIds}
          canvasActiveFamilyRef={controller.sharedTabProps?.activeFamilyRef ?? { current: null }}
          canvasFamilySwitchRef={controller.sharedTabProps?.familySwitchRef ?? { current: null }}
          onOpenMaidenFamilyTree={controller.handleOpenMaidenFamilyTree}
        />
      ) : null}

      <ConfirmDialog
        visible={controller.confirmState.visible && !isSharedLoaderVisible}
        title={controller.confirmState.title}
        message={controller.confirmState.message}
        confirmLabel={controller.confirmState.confirmLabel}
        loading={controller.mutating}
        onDismiss={controller.closeConfirm}
        onConfirm={controller.dialogActions.handleConfirmAction}
      />

      <StartupModal
        visible={controller.startupModal.visible && !isSharedLoaderVisible}
        mode={controller.startupModal.mode}
        currentVersion={controller.startupModal.currentVersion}
        updateHighlights={controller.startupModal.updateHighlights}
        initialTheme={controller.startupModal.initialTheme}
        initialLanguage={controller.startupModal.initialLanguage}
        loading={controller.startupModal.loading}
        onSubmitPreferences={controller.handleStartupPreferencesSubmit}
        onDismissUpdate={controller.handleUpdateModalDismiss}
      />

      <SharedLoader visible={isSharedLoaderVisible} />

      <Portal>
        <Dialog
          visible={Boolean(controller.priorityAlert) && !isSharedLoaderVisible}
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
            <Button onPress={() => { void controller.dismissPriorityAlert(); }} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
              {controller.t(K.common.close)}
            </Button>
            {controller.priorityAlert?.kind === 'tree-access-request' ? (
              <Button mode="outlined" onPress={() => { void controller.respondToPriorityTreeAccess('rejected'); }} disabled={controller.mutating} style={BUTTON_CHROME} buttonColor={controller.theme.colors.surface} textColor={controller.theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                {controller.t(K.notifications.declineAccess)}
              </Button>
            ) : null}
            {controller.priorityAlert?.kind === 'tree-access-request' ? (
              <Button mode="contained" onPress={() => { void controller.respondToPriorityTreeAccess('accepted'); }} disabled={controller.mutating} style={BUTTON_CHROME} buttonColor={controller.theme.colors.primary} textColor={controller.theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                {controller.t(K.notifications.approveAccess)}
              </Button>
            ) : null}
            {controller.priorityAlert?.kind === 'merge-invite' ? (
              <Button mode="outlined" onPress={() => { void controller.respondToPriorityMergeInvite('dismissed'); }} disabled={controller.mutating} style={BUTTON_CHROME} buttonColor={controller.theme.colors.surface} textColor={controller.theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                {controller.t(K.common.dismiss)}
              </Button>
            ) : null}
            {controller.priorityAlert?.kind === 'merge-invite' ? (
              <Button mode="contained" onPress={() => { void controller.respondToPriorityMergeInvite('accepted'); }} disabled={controller.mutating} style={BUTTON_CHROME} buttonColor={controller.theme.colors.primary} textColor={controller.theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                {controller.t(K.notifications.accept)}
              </Button>
            ) : null}
            {controller.priorityAlert && (controller.priorityAlert.kind === 'merge-request' || controller.priorityAlert.kind === 'merge-history') ? (
              <Button mode="contained" onPress={() => { void controller.openPriorityAlertTarget(); }} disabled={controller.mutating} style={BUTTON_CHROME} buttonColor={controller.theme.colors.primary} textColor={controller.theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                {controller.t(K.notifications.openMerge)}
              </Button>
            ) : null}
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={controller.discoverabilityPrompt.visible && !isSharedLoaderVisible}
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
            <Button mode="outlined" onPress={() => { void controller.handleDiscoverabilityPromptChoice(false); }} disabled={controller.discoverabilityPrompt.loading} style={BUTTON_CHROME} buttonColor={controller.theme.colors.surface} textColor={controller.theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
              {controller.t(K.app.discoverabilityPromptKeepPrivate)}
            </Button>
            <Button mode="contained" onPress={() => { void controller.handleDiscoverabilityPromptChoice(true); }} disabled={controller.discoverabilityPrompt.loading} style={BUTTON_CHROME} buttonColor={controller.theme.colors.primary} textColor={controller.theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
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
