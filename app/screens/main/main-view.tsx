import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Dialog, IconButton, List, Portal, Snackbar, Text } from 'react-native-paper';
import {
  CollaboratorDialog,
  ConfirmDialog,
  PersonFormDialog,
  RelationshipDialog,
  TreeFormDialog,
} from '../../../components';
import { canManageTree } from '../../../components/dto/tree';
import type { MainTabParamList } from '../../../components/dto/navigation';
import { formatPersonName } from '../../../components/person-formatting';
import { extractSurname } from '../../../components/family-tree-surname-clusters';
import { GlobalStyles } from '../../../constants/styles';
import PersonProfileScreen from '../person-profile';
import { NotificationsTabContent, PeopleRelationshipsTabContent, TreeSettingsTabContent, VisualisationTabContent } from '../tree-tab-content';
import { UserProfileTabContent } from '../my-profile';
import type { useMainScreenController } from './main-controller';

const dialogChrome = GlobalStyles.dialogChrome;
const styles = GlobalStyles.treeDetail;
const homeStyles = GlobalStyles.home;
const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  tree: 'family-tree',
  members: 'account-group-outline',
  notifications: 'bell-outline',
  treeSettings: 'cog-outline',
  myProfile: 'account-circle-outline',
};

const localStyles = StyleSheet.create({
  noTreeGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  noTreeGateText: {
    textAlign: 'center',
  },
});

function NoTreeGate({ onCreateTree, controller }: { onCreateTree: () => void; controller: ReturnType<typeof useMainScreenController> }) {
  return (
    <View style={[localStyles.noTreeGate, { backgroundColor: controller.theme.colors.background }]}>
      <MaterialCommunityIcons name="family-tree" size={64} color={controller.theme.colors.primary} />
      <Text variant="headlineSmall" style={[localStyles.noTreeGateText, { color: controller.theme.colors.onSurface }]}>
        {controller.t('No family tree yet')}
      </Text>
      <Text variant="bodyMedium" style={[localStyles.noTreeGateText, { color: controller.theme.colors.onSurfaceVariant }]}>
        {controller.t('Create your first family tree to start adding people, photos, and relationships.')}
      </Text>
      <Button mode="contained" icon="plus" onPress={onCreateTree} contentStyle={homeStyles.headerButtonContent}>
        {controller.t('Create family tree')}
      </Button>
    </View>
  );
}

export function MainScreenView({ controller }: { controller: ReturnType<typeof useMainScreenController> }) {
  const noTreeGate = (
    <NoTreeGate
      controller={controller}
      onCreateTree={controller.openCreateTreeDialog}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: controller.theme.colors.background }]}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          lazy: true,
          headerShown: false,
          tabBarActiveTintColor: controller.theme.colors.primary,
          tabBarInactiveTintColor: controller.theme.colors.onSurfaceVariant,
          tabBarActiveBackgroundColor: controller.theme.colors.elevation.level2,
          tabBarShowIcon: true,
          tabBarShowLabel: false,
          tabBarStyle: [styles.tabBar, { backgroundColor: controller.theme.colors.surface, borderTopColor: controller.theme.colors.outlineVariant }],
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          sceneStyle: [styles.tabScene, { backgroundColor: controller.theme.colors.background }],
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name={(TAB_ICONS[route.name as keyof MainTabParamList] ?? 'circle') as any} size={size} color={color} />
          ),
        })}
      >
        <Tab.Screen name="tree" options={{ title: controller.t('Tree') }}>
          {() => (controller.sharedTabProps ? <VisualisationTabContent {...controller.sharedTabProps} /> : noTreeGate)}
        </Tab.Screen>

        <Tab.Screen name="members" options={{ title: controller.t('Members') }}>
          {() => (controller.sharedTabProps
            ? controller.memberProfileParams
              ? (
                <PersonProfileScreen
                  navigation={controller.memberProfileNavigation}
                  route={{ params: controller.memberProfileParams }}
                />
              )
              : <PeopleRelationshipsTabContent {...controller.sharedTabProps} />
            : noTreeGate)}
        </Tab.Screen>

        <Tab.Screen name="treeSettings" options={{ title: controller.t('Settings') }}>
          {() => (controller.sharedTabProps ? <TreeSettingsTabContent {...controller.sharedTabProps} /> : noTreeGate)}
        </Tab.Screen>

        <Tab.Screen
          name="notifications"
          options={{
            title: controller.t('Notifications'),
            tabBarBadge: controller.notificationBadgeCount > 0 ? controller.notificationBadgeCount : undefined,
          }}
        >
          {() => (controller.sharedTabProps ? <NotificationsTabContent {...controller.sharedTabProps} /> : noTreeGate)}
        </Tab.Screen>

        <Tab.Screen name="myProfile" options={{ title: controller.t('Profile') }}>
          {() => <UserProfileTabContent onSignOut={controller.signOut} authLoading={controller.authLoading} />}
        </Tab.Screen>
      </Tab.Navigator>

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
