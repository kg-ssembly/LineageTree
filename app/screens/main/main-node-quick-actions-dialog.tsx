import React from 'react';
import { List } from 'react-native-paper';
import { Dialog, IconButton, Portal, Text } from 'react-native-paper';
import { extractSurname } from '../../../components/family-tree-surname-clusters';
import { formatPersonName } from '../../../components/person-formatting';
import { GlobalStyles } from '../../../constants/styles';
import type { useMainScreenController } from './main-controller';

const dialogChrome = GlobalStyles.dialogChrome;
const styles = GlobalStyles.treeDetail;

export function MainNodeQuickActionsDialog({
  controller,
}: {
  controller: ReturnType<typeof useMainScreenController>;
}) {
  return (
    <Portal>
      <Dialog
        visible={controller.nodeQuickActionState.visible}
        onDismiss={controller.closeNodeQuickActions}
        style={[dialogChrome.dialog, styles.quickActionDialog, { backgroundColor: controller.theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
          {controller.nodeQuickActionState.person ? formatPersonName(controller.nodeQuickActionState.person) : controller.t('Quick actions')}
        </Dialog.Title>
        <IconButton
          icon="close"
          size={20}
          onPress={controller.closeNodeQuickActions}
          style={dialogChrome.closeButton}
          accessibilityLabel={controller.t('Close')}
        />
        <Dialog.Content style={dialogChrome.content}>
          <Text variant="bodyMedium" style={[styles.quickActionSubtitle, { color: controller.theme.colors.onSurfaceVariant }]}>
            {controller.t('Choose what you want to do with this family member.')}
          </Text>
          <List.Item
            title={controller.t('Open profile')}
            description={controller.t('See photos, memories, and full relationship details')}
            left={(props) => <List.Icon {...props} icon="account-arrow-right-outline" />}
            onPress={() => {
              const person = controller.nodeQuickActionState.person;
              if (!person) {
                return;
              }
              controller.closeNodeQuickActions();
              controller.openPersonProfile(person);
            }}
          />

          {controller.nodeQuickActionState.person?.maidenName?.trim() ? (() => {
            const person = controller.nodeQuickActionState.person!;
            const maiden = person.maidenName!.trim();
            const marital = extractSurname(person);
            const currentFamily = controller.sharedTabProps?.activeFamilyRef?.current;
            const isViewingMaiden = currentFamily === maiden;
            const targetSurname = isViewingMaiden ? marital : maiden;
            const label = isViewingMaiden
              ? controller.t('View {surname} (marital) family tree', { surname: marital })
              : controller.t('View {surname} (maiden) family tree', { surname: maiden });
            const description = isViewingMaiden
              ? controller.t('Switch to {surname} — their family by marriage', { surname: marital })
              : controller.t('Switch to {surname} — their birth family', { surname: maiden });
            const linkedTree = controller.findConnectedTreeForSurname(person, targetSurname, controller.selectedTree, controller.sharedTabProps?.trees ?? []);

            return (
              <List.Item
                title={label}
                description={description}
                left={(props) => <List.Icon {...props} icon="family-tree" />}
                onPress={() => {
                  controller.closeNodeQuickActions();
                  if (linkedTree) {
                    controller.navigation.navigate('TreeDetail', {
                      treeId: linkedTree.id,
                      initialTab: 'VisualisationTab',
                      returnTreeId: controller.selectedTree?.id,
                    });
                    return;
                  }
                  controller.sharedTabProps?.familySwitchRef?.current?.(targetSurname);
                }}
              />
            );
          })() : null}

          {controller.nodeQuickActionState.person && !controller.nodeQuickActionState.person.maidenName?.trim() && controller.crossSurnameChildIds.has(controller.nodeQuickActionState.person.id) ? (() => {
            const surname = extractSurname(controller.nodeQuickActionState.person!);
            const alreadyViewing = controller.sharedTabProps?.activeFamilyRef?.current === surname;
            if (alreadyViewing) {
              return null;
            }

            return (
              <List.Item
                title={controller.t('View {surname} family tree', { surname })}
                description={controller.t('This person has parents from different families')}
                left={(props) => <List.Icon {...props} icon="source-branch" />}
                onPress={() => {
                  controller.closeNodeQuickActions();
                  controller.sharedTabProps?.familySwitchRef?.current?.(surname);
                }}
              />
            );
          })() : null}

          {controller.canEdit && controller.nodeQuickActionState.person ? (
            <>
              <List.Item
                title={controller.t('Add parent')}
                description={controller.t('Create a new parent for {name}', { name: formatPersonName(controller.nodeQuickActionState.person) })}
                left={(props) => <List.Icon {...props} icon="account-arrow-up-outline" />}
                onPress={() => controller.openCreateRelativeDialog('parent-of', controller.nodeQuickActionState.person!)}
                disabled={controller.mutating}
              />
              <List.Item
                title={controller.t('Add child')}
                description={controller.t('Create a new child for {name}', { name: formatPersonName(controller.nodeQuickActionState.person) })}
                left={(props) => <List.Icon {...props} icon="account-arrow-down-outline" />}
                onPress={() => controller.openCreateRelativeDialog('child-of', controller.nodeQuickActionState.person!)}
                disabled={controller.mutating}
              />
              <List.Item
                title={controller.t('Add spouse')}
                description={controller.t('Create a spouse for {name}', { name: formatPersonName(controller.nodeQuickActionState.person) })}
                left={(props) => <List.Icon {...props} icon="account-heart-outline" />}
                onPress={() => controller.openCreateRelativeDialog('spouse-of', controller.nodeQuickActionState.person!)}
                disabled={controller.mutating}
              />
            </>
          ) : null}
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}
