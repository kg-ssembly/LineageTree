import React, { type ComponentType } from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParamList, RootStackParamList } from '../../../components/dto/navigation';
import { I18N_KEYS as K } from '../../../i18n/keys';
import type { useMainScreenController } from './main-controller';
import type { SharedTabProps } from '../tree-tabs/shared';

const Tab = createBottomTabNavigator<MainTabParamList>();
type TabContentComponent = ComponentType<SharedTabProps>;
type PersonProfileComponent = ComponentType<{
  navigation: ReturnType<typeof useMainScreenController>['memberProfileNavigation'];
  route: { params: RootStackParamList['PersonProfile'] };
}>;
type UserProfileComponent = ComponentType<{
  onSignOut: ReturnType<typeof useMainScreenController>['signOut'];
  authLoading: boolean;
}>;

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  home: 'home-heart',
  tree: 'family-tree',
  members: 'account-group-outline',
  treeSettings: 'cog-outline',
  myProfile: 'account-circle-outline',
};

function getHomeTabContent(): TabContentComponent {
  return require('../tree-tabs/home').HomeTabContent;
}

function getVisualisationTabContent(): TabContentComponent {
  return require('../tree-tabs/family-tree').VisualisationTabContent;
}

function getPeopleRelationshipsTabContent(): TabContentComponent {
  return require('../tree-tabs/family-members').PeopleRelationshipsTabContent;
}

function getTreeSettingsTabContent(): TabContentComponent {
  return require('../tree-tabs/tree-settings').TreeSettingsTabContent;
}

function getPersonProfileScreen(): PersonProfileComponent {
  return require('../person-profile').default;
}

function getUserProfileTabContent(): UserProfileComponent {
  return require('../my-profile').UserProfileTabContent;
}

export function MainTabNavigator({
  controller,
  noTreeGate,
  styles,
}: {
  controller: ReturnType<typeof useMainScreenController>;
  noTreeGate: React.ReactNode;
  styles: {
    tabBar: {
      height: number;
    };
    tabItem: object;
    tabScene: object;
  };
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
        sceneStyle: [styles.tabScene, { backgroundColor: controller.theme.colors.background }],
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
        {() => {
          if (!controller.sharedTabProps) {
            return noTreeGate;
          }

          const HomeTabContent = getHomeTabContent();
          return <HomeTabContent {...controller.sharedTabProps} />;
        }}
      </Tab.Screen>

      <Tab.Screen name="tree" options={{ title: controller.t(K.navigation.tree) }}>
        {() => {
          if (!controller.sharedTabProps) {
            return noTreeGate;
          }

          const VisualisationTabContent = getVisualisationTabContent();
          return <VisualisationTabContent {...controller.sharedTabProps} />;
        }}
      </Tab.Screen>

      <Tab.Screen name="members" options={{ title: controller.t(K.navigation.members) }}>
        {() => {
          if (!controller.sharedTabProps) {
            return noTreeGate;
          }

          if (controller.memberProfileParams) {
            const PersonProfileScreen = getPersonProfileScreen();
            return (
              <PersonProfileScreen
                navigation={controller.memberProfileNavigation}
                route={{ params: controller.memberProfileParams }}
              />
            );
          }

          const PeopleRelationshipsTabContent = getPeopleRelationshipsTabContent();
          return <PeopleRelationshipsTabContent {...controller.sharedTabProps} />;
        }}
      </Tab.Screen>

      <Tab.Screen name="treeSettings" options={{ title: controller.t(K.navigation.settings) }}>
        {() => {
          if (!controller.sharedTabProps) {
            return noTreeGate;
          }

          const TreeSettingsTabContent = getTreeSettingsTabContent();
          return <TreeSettingsTabContent {...controller.sharedTabProps} />;
        }}
      </Tab.Screen>

      <Tab.Screen name="myProfile" options={{ title: controller.t(K.navigation.profile) }}>
        {() => {
          const UserProfileTabContent = getUserProfileTabContent();
          return <UserProfileTabContent onSignOut={controller.signOut} authLoading={controller.authLoading} />;
        }}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
