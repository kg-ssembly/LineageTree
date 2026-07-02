import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParamList } from '../../../components/dto/navigation';
import { I18N_KEYS as K } from '../../../i18n/keys';
import PersonProfileScreen from '../person-profile';
import { HomeTabContent, PeopleRelationshipsTabContent, TreeSettingsTabContent, VisualisationTabContent } from '../tree-tab-content';
import { UserProfileTabContent } from '../my-profile';
import type { useMainScreenController } from './main-controller';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  home: 'home-heart',
  tree: 'family-tree',
  members: 'account-group-outline',
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
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' && insets.bottom < 24 ? 0 : insets.bottom;

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
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: controller.theme.colors.surface,
            borderTopColor: controller.theme.colors.outlineVariant,
            paddingBottom: bottomInset,
            height: styles.tabBar.height + bottomInset,
          },
        ],
        tabBarItemStyle: styles.tabItem,
        sceneStyle: [styles.tabScene, { backgroundColor: 'transparent' }],
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={(TAB_ICONS[route.name as keyof MainTabParamList] ?? 'circle') as never} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen
        name="home"
        options={{
          title: controller.t(K.navigation.home),
          tabBarBadge: controller.notificationBadgeCount > 0 ? controller.notificationBadgeCount : undefined,
        }}
      >
        {() => (controller.sharedTabProps ? <HomeTabContent {...controller.sharedTabProps} /> : noTreeGate)}
      </Tab.Screen>

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

      <Tab.Screen name="myProfile" options={{ title: controller.t(K.navigation.profile) }}>
        {() => <UserProfileTabContent onSignOut={controller.signOut} authLoading={controller.authLoading} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
