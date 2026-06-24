import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MainTabParamList } from '../../../components/dto/navigation';
import PersonProfileScreen from '../person-profile';
import { NotificationsTabContent, PeopleRelationshipsTabContent, TreeSettingsTabContent, VisualisationTabContent } from '../tree-tab-content';
import { UserProfileTabContent } from '../my-profile';
import type { useMainScreenController } from './main-controller';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  tree: 'family-tree',
  members: 'account-group-outline',
  notifications: 'bell-outline',
  treeSettings: 'cog-outline',
  myProfile: 'account-circle-outline',
};

export function MainTabNavigator({
  controller,
  noTreeGate,
  styles,
}: {
  controller: ReturnType<typeof useMainScreenController>;
  noTreeGate: React.ReactNode;
  styles: typeof import('../../../constants/styles').GlobalStyles.treeDetail;
}) {
  return (
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
          <MaterialCommunityIcons name={(TAB_ICONS[route.name as keyof MainTabParamList] ?? 'circle') as never} size={size} color={color} />
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
  );
}
