import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native';
import type { MainTabParamList } from '../../../components/dto/navigation';
import { I18N_KEYS as K } from '../../../i18n/keys';
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
        tabBarShowLabel: true,
        tabBarStyle: [styles.tabBar, { backgroundColor: controller.theme.colors.surface, borderTopColor: controller.theme.colors.outlineVariant }],
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        sceneStyle: [styles.tabScene, { backgroundColor: controller.theme.colors.background }],
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={(TAB_ICONS[route.name as keyof MainTabParamList] ?? 'circle') as never} size={size} color={color} />
        ),
        tabBarLabel: ({ color, focused }) => (
          <Text
            style={{
              color,
              fontSize: 11,
              fontWeight: focused ? '800' : '700',
              marginTop: 2,
            }}
          >
            {route.name === 'tree'
              ? controller.t(K.navigation.tree)
              : route.name === 'members'
                ? controller.t(K.navigation.members)
                : route.name === 'treeSettings'
                  ? controller.t(K.navigation.settings)
                : route.name === 'notifications'
                  ? controller.t(K.navigation.notifications)
                    : controller.t(K.navigation.profile)}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="tree" options={{ title: controller.t(K.navigation.tree) }}>
        {() => (controller.sharedTabProps ? <VisualisationTabContent {...controller.sharedTabProps} /> : noTreeGate)}
      </Tab.Screen>

      <Tab.Screen name="members" options={{ title: controller.t(K.navigation.members) }}>
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

      <Tab.Screen name="treeSettings" options={{ title: controller.t(K.navigation.settings) }}>
        {() => (controller.sharedTabProps ? <TreeSettingsTabContent {...controller.sharedTabProps} /> : noTreeGate)}
      </Tab.Screen>

      <Tab.Screen
        name="notifications"
        options={{
          title: controller.t(K.navigation.notifications),
          tabBarBadge: controller.notificationBadgeCount > 0 ? controller.notificationBadgeCount : undefined,
        }}
      >
        {() => (controller.sharedTabProps ? <NotificationsTabContent {...controller.sharedTabProps} /> : noTreeGate)}
      </Tab.Screen>

      <Tab.Screen name="myProfile" options={{ title: controller.t(K.navigation.profile) }}>
        {() => <UserProfileTabContent onSignOut={controller.signOut} authLoading={controller.authLoading} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
