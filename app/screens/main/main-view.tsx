import React from 'react';
import { View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import {
  CollaboratorDialog,
  ConfirmDialog,
  PersonFormDialog,
  RelationshipDialog,
  TreeFormDialog,
} from '../../../components';
import { canManageTree } from '../../../components/dto/tree';
import { GlobalStyles } from '../../../constants/styles';
import type { useMainScreenController } from './main-controller';
import { MainNoTreeGate } from './main-no-tree-gate';
import { MainNodeQuickActionsDialog } from './main-node-quick-actions-dialog';
import { MainTabNavigator } from './main-tab-navigator';

const styles = GlobalStyles.treeDetail;

export function MainScreenView({ controller }: { controller: ReturnType<typeof useMainScreenController> }) {
  const noTreeGate = (
    <MainNoTreeGate
      controller={controller}
      onCreateTree={controller.openCreateTreeDialog}
    />
  );

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

      <Snackbar
        visible={controller.snackVisible}
        onDismiss={controller.dismissSnackbar}
        duration={5000}
        action={{ label: controller.t('Dismiss'), onPress: controller.dismissSnackbar }}
      >
        {controller.snackMessage}
      </Snackbar>
    </View>
  );
}
