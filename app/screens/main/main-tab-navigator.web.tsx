import React, { type ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
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

function WebTabBar({
  state,
  descriptors,
  navigation,
  controller,
  topInset,
}: BottomTabBarProps & {
  controller: ReturnType<typeof useMainScreenController>;
  topInset: number;
}) {
  return (
    <View
      style={[
        localStyles.tabBar,
        {
          paddingTop: Math.max(16, topInset + 8),
          backgroundColor: controller.theme.colors.surface,
          borderBottomColor: controller.theme.colors.outlineVariant,
        },
      ]}
    >
      <View style={localStyles.tabBarInner}>
        <View style={localStyles.brandWrap}>
          <Text variant="headlineSmall" style={{ color: controller.theme.colors.onSurface }}>
            Lineage Tree
          </Text>
          <Text variant="bodySmall" style={{ color: controller.theme.colors.onSurfaceVariant }}>
            Family workspace
          </Text>
        </View>
        <View style={localStyles.navItemsRow}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const descriptor = descriptors[route.key];
            const options = descriptor.options;
            const label = typeof options.title === 'string' ? options.title : route.name;
            const iconName = TAB_ICONS[route.name as keyof MainTabParamList] ?? 'circle';

            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });

                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                style={({ pressed }) => [
                  localStyles.navItem,
                  {
                    backgroundColor: isFocused ? controller.theme.colors.primaryContainer : 'transparent',
                    borderColor: isFocused ? controller.theme.colors.primary : 'transparent',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={iconName as never}
                  size={20}
                  color={isFocused ? controller.theme.colors.primary : controller.theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="labelLarge"
                  style={{
                    color: isFocused ? controller.theme.colors.primary : controller.theme.colors.onSurfaceVariant,
                  }}
                >
                  {label}
                </Text>
                {route.name === 'home' && controller.notificationBadgeCount > 0 ? (
                  <View style={[localStyles.badge, { backgroundColor: controller.theme.colors.error }]}>
                    <Text variant="labelSmall" style={{ color: controller.theme.colors.onError }}>
                      {controller.notificationBadgeCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
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

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        lazy: true,
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: [styles.tabScene, { backgroundColor: controller.theme.colors.background }],
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons
            name={(TAB_ICONS[route.name as keyof MainTabParamList] ?? 'circle') as never}
            size={size}
            color={color}
          />
        ),
      })}
      tabBar={(props) => <WebTabBar {...props} controller={controller} topInset={insets.top} />}
    >
      <Tab.Screen
        name="home"
        options={{
          title: controller.t(K.navigation.home),
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

const localStyles = StyleSheet.create({
  tabBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  tabBarInner: {
    width: '100%',
    maxWidth: 1480,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  brandWrap: {
    minWidth: 180,
  },
  navItemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  navItem: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 2,
  },
});
