import React, { type ComponentType } from 'react';
import { Image, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import type { MainTabParamList, RootStackParamList } from '../../../components/dto/navigation';
import { I18N_KEYS as K } from '../../../i18n/keys';
import type { useMainScreenController } from './main-controller';
import type { SharedTabProps } from '../tree-tabs/shared';

const Tab = createBottomTabNavigator<MainTabParamList>();
const WEB_DESKTOP_BREAKPOINT = 900;
const APP_LOGO = require('../../../assets/logo-transparent.png');
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
  notifications: 'bell-outline',
  tree: 'family-tree',
  members: 'account-group-outline',
  treeSettings: 'cog-outline',
  myProfile: 'account-circle-outline',
};

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  home: K.navigation.home,
  notifications: K.notifications.notifications,
  tree: K.navigation.tree,
  members: K.navigation.members,
  treeSettings: K.navigation.settings,
  myProfile: K.navigation.profile,
};

function WebMainTabBar({
  state,
  descriptors,
  navigation,
  controller,
}: BottomTabBarProps & {
  controller: ReturnType<typeof useMainScreenController>;
}) {
  const notificationsRouteIndex = state.routes.findIndex((route) => route.name === 'notifications');
  const isNotificationsFocused = notificationsRouteIndex >= 0 && state.index === notificationsRouteIndex;

  const handleNotificationsPress = () => {
    const notificationsRoute = state.routes[notificationsRouteIndex];
    if (!notificationsRoute) {
      return;
    }

    const event = navigation.emit({
      type: 'tabPress',
      target: notificationsRoute.key,
      canPreventDefault: true,
    });

    if (!isNotificationsFocused && !event.defaultPrevented) {
      navigation.navigate(notificationsRoute.name, notificationsRoute.params);
    }
  };

  return (
    <View
      style={[
        webTabBarStyles.shell,
        {
          backgroundColor: controller.theme.colors.surface,
          borderBottomColor: controller.theme.colors.outlineVariant,
        },
      ]}
    >
      <View style={webTabBarStyles.brandBlock}>
        <Image source={APP_LOGO} style={webTabBarStyles.logo} resizeMode="contain" />
        <View>
          <Text variant="titleMedium" style={{ color: controller.theme.colors.onSurface }}>
            Lineage Tree
          </Text>
          <Text variant="bodySmall" style={{ color: controller.theme.colors.onSurfaceVariant }}>
            {controller.selectedTree?.name ?? controller.t(K.navigation.home)}
          </Text>
        </View>
      </View>

      <View style={webTabBarStyles.menuRow}>
        <Pressable
          onPress={handleNotificationsPress}
          accessibilityRole="button"
          accessibilityLabel={controller.t(K.notifications.notifications)}
          accessibilityState={isNotificationsFocused ? { selected: true } : {}}
          style={[
            webTabBarStyles.iconChip,
            {
              backgroundColor: isNotificationsFocused ? controller.theme.colors.secondaryContainer : controller.theme.colors.surface,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="bell-outline"
            size={18}
            color={isNotificationsFocused ? controller.theme.colors.primary : controller.theme.colors.onSurfaceVariant}
          />
          {controller.notificationBadgeCount > 0 ? (
            <View style={[webTabBarStyles.badge, webTabBarStyles.iconBadge, { backgroundColor: controller.theme.colors.primary }]}>
              <Text variant="labelSmall" style={{ color: controller.theme.colors.onPrimary }}>
                {controller.notificationBadgeCount > 99 ? '99+' : controller.notificationBadgeCount}
              </Text>
            </View>
          ) : null}
        </Pressable>

        {state.routes.filter((route) => route.name !== 'notifications').map((route) => {
          const index = state.routes.findIndex((entry) => entry.key === route.key);
          const isFocused = state.index === index;
          const descriptor = descriptors[route.key];
          const routeName = route.name as keyof MainTabParamList;
          const label = controller.t(TAB_LABELS[routeName]);
          const icon = TAB_ICONS[routeName];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={descriptor.options.tabBarAccessibilityLabel}
              style={[
                webTabBarStyles.menuChip,
                {
                  backgroundColor: isFocused ? controller.theme.colors.secondaryContainer : controller.theme.colors.surface,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={icon as never}
                size={18}
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const webTabBarStyles = StyleSheet.create({
  shell: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 0,
  },
  logo: {
    width: 52,
    height: 52,
  },
  menuRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
    flex: 1,
  },
  menuChip: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconChip: {
    minWidth: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
});

function getHomeTabContent(): TabContentComponent {
  return require('../tree-tabs/home').HomeTabContent;
}

function getVisualisationTabContent(): TabContentComponent {
  return require('../tree-tabs/family-tree').VisualisationTabContent;
}

function getPeopleRelationshipsTabContent(): TabContentComponent {
  return require('../tree-tabs/family-members').PeopleRelationshipsTabContent;
}

function getNotificationsTabContent(): TabContentComponent {
  return require('../tree-tabs/notifications').NotificationsTabContent;
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
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= WEB_DESKTOP_BREAKPOINT;
  const bottomInset = Platform.OS === 'android' && insets.bottom < 24 ? 0 : insets.bottom;

  return (
    <Tab.Navigator
      tabBar={isDesktopWeb ? (props) => <WebMainTabBar {...props} controller={controller} /> : undefined}
      screenOptions={({ route }) => ({
        lazy: true,
        headerShown: false,
        tabBarPosition: isDesktopWeb ? 'top' : 'bottom',
        tabBarActiveTintColor: controller.theme.colors.primary,
        tabBarInactiveTintColor: controller.theme.colors.onSurfaceVariant,
        tabBarActiveBackgroundColor: controller.theme.colors.elevation.level2,
        tabBarShowIcon: true,
        tabBarShowLabel: !isDesktopWeb,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: controller.theme.colors.surface,
            borderTopColor: controller.theme.colors.outlineVariant,
            paddingBottom: bottomInset,
            height: isDesktopWeb ? undefined : styles.tabBar.height + bottomInset,
          },
        ],
        tabBarItemStyle: route.name === 'notifications' ? { display: 'none' } : styles.tabItem,
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

      <Tab.Screen
        name="notifications"
        options={{
          title: controller.t(K.notifications.notifications),
          tabBarButton: () => null,
        }}
      >
        {() => {
          if (!controller.sharedTabProps) {
            return noTreeGate;
          }

          const NotificationsTabContent = getNotificationsTabContent();
          return <NotificationsTabContent {...controller.sharedTabProps} />;
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
