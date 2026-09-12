import React, { useState, type ComponentType } from 'react';
import { Image, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Menu, Text } from 'react-native-paper';
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
  treeContext: SharedTabProps | null;
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

function TreeSwitcher({ controller, onManageTrees }: { controller: ReturnType<typeof useMainScreenController>; onManageTrees: () => void }) {
  const [treeMenuVisible, setTreeMenuVisible] = useState(false);
  return (          <Menu visible={treeMenuVisible} onDismiss={() => setTreeMenuVisible(false)} anchor={<Button icon="chevron-down" compact onPress={() => setTreeMenuVisible(true)}>{controller.selectedTree?.name ?? controller.t('Choose tree')}</Button>}>
            {(controller.sharedTabProps?.trees ?? []).map(tree => <Menu.Item key={tree.id} title={tree.name} leadingIcon={tree.id === controller.selectedTree?.id ? 'check' : 'family-tree'} onPress={() => { setTreeMenuVisible(false); void controller.sharedTabProps?.onSwitchTree?.(tree); }} />)}
            <Menu.Item title={controller.t('Manage trees')} leadingIcon="cog-outline" onPress={() => { setTreeMenuVisible(false); controller.sharedTabProps?.onOpenTreeSettingsTarget?.({ tab: 'trees', mode: 'trees', itemId: '' }); onManageTrees(); }} />
          </Menu>);
}

function MobileMainTabBar({ state, navigation, controller }: BottomTabBarProps & {
  controller: ReturnType<typeof useMainScreenController>;
}) {
  const [moreVisible, setMoreVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors } = controller.theme;
  const activeName = state.routes[state.index].name;
  const navigate = (name: keyof MainTabParamList) => {
    const route = state.routes.find(item => item.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route.name, route.params);
    setMoreVisible(false);
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginHorizontal: 12, marginTop: 8, marginBottom: Math.max(insets.bottom, 12), borderRadius: 32, backgroundColor: colors.surface, shadowColor: colors.onSurface, shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}>
      {(['home', 'members', 'tree', 'notifications'] as const).map(name => {
        const selected = activeName === name;
        const centre = name === 'tree';
        const label = name === 'notifications' ? controller.t('Inbox') : controller.t(TAB_LABELS[name]);
        return <Pressable key={name} accessibilityRole="tab" accessibilityLabel={name === 'notifications' ? `${controller.t('Notifications')}, ${controller.notificationBadgeCount} ${controller.t('need your response')}` : label} accessibilityState={{ selected }} onPress={() => navigate(name)} style={{ flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <View style={{ width: centre ? 48 : 32, height: centre ? 48 : 30, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.primaryContainer : colors.surface, marginTop: centre ? -8 : 0 }}>
            <MaterialCommunityIcons name={TAB_ICONS[name] as never} size={centre ? 27 : 23} color={selected ? colors.primary : colors.onSurfaceVariant} />
            {name === 'notifications' && controller.notificationBadgeCount > 0 ? <View style={[webTabBarStyles.badge, webTabBarStyles.iconBadge, { backgroundColor: colors.primary }]}><Text variant="labelSmall" style={{ color: colors.onPrimary }}>{controller.notificationBadgeCount > 99 ? '99+' : controller.notificationBadgeCount}</Text></View> : null}
          </View>
          <Text variant="labelSmall" style={{ color: selected ? colors.primary : colors.onSurfaceVariant }}>{label}</Text>
        </Pressable>;
      })}
      <View style={{ flex: 1 }}>
        <Menu visible={moreVisible} onDismiss={() => setMoreVisible(false)} anchorPosition="top" anchor={
          <Pressable accessibilityRole="button" accessibilityLabel={controller.t('More options')} accessibilityState={{ expanded: moreVisible }} onPress={() => setMoreVisible(true)} style={{ minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <MaterialCommunityIcons name="dots-horizontal" size={26} color={['myProfile', 'treeSettings'].includes(activeName) ? colors.primary : colors.onSurfaceVariant} />
            <Text variant="labelSmall">{controller.t('More')}</Text>
          </Pressable>
        }>
          <Menu.Item title={controller.t('My profile')} leadingIcon="account-circle-outline" onPress={() => navigate('myProfile')} />
          <Menu.Item title={controller.t('Settings')} leadingIcon="cog-outline" onPress={() => navigate('treeSettings')} />
        </Menu>
      </View>
    </View>
  );
}

function WebMainTabBar({
  state,
  descriptors,
  navigation,
  controller,
}: BottomTabBarProps & {
  controller: ReturnType<typeof useMainScreenController>;
}) {
  const { width } = useWindowDimensions();
  const compactDesktop = width < 1150;
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
        compactDesktop && { flexDirection: 'column', alignItems: 'stretch' },
        {
          backgroundColor: controller.theme.colors.surface,
          shadowColor: controller.theme.colors.onSurface,
        },
      ]}
    >
      <View style={webTabBarStyles.brandBlock}>
        <Image source={APP_LOGO} style={webTabBarStyles.logo} resizeMode="contain" />
        <View style={{ flexShrink: 1 }}>
          <Text variant="titleMedium" style={{ color: controller.theme.colors.onSurface }}>
            Lineage Tree
          </Text>
          <TreeSwitcher controller={controller} onManageTrees={() => navigation.navigate('treeSettings')} />
        </View>
      </View>

      <View style={[webTabBarStyles.menuRow, compactDesktop && { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minHeight: 48, justifyContent: 'space-between' }]}>
        <Pressable
          onPress={handleNotificationsPress}
          accessibilityRole="tab"
          accessibilityLabel={controller.t(K.notifications.notifications)}
          accessibilityState={isNotificationsFocused ? { selected: true } : {}}
          style={[
            webTabBarStyles.menuChip,
            {
              backgroundColor: isNotificationsFocused ? controller.theme.colors.primaryContainer : controller.theme.colors.surface,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="bell-outline"
            size={18}
            color={isNotificationsFocused ? controller.theme.colors.primary : controller.theme.colors.onSurfaceVariant}
          />
          <Text variant="labelLarge" style={{ color: controller.theme.colors.onSurface }}>{controller.t(K.notifications.notifications)}</Text>
          {controller.notificationBadgeCount > 0 ? (
            <View style={[webTabBarStyles.badge, { backgroundColor: controller.theme.colors.primary }]}>
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
              accessibilityLabel={descriptor.options.tabBarAccessibilityLabel ?? label}
              style={[
                webTabBarStyles.menuChip,
                {
                  backgroundColor: isFocused ? controller.theme.colors.primaryContainer : controller.theme.colors.surface,
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
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 32,
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
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
    flexShrink: 1,
    maxWidth: 320,
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
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconChip: {
    minWidth: 48,
    height: 48,
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
      tabBar={(props) => isDesktopWeb ? <WebMainTabBar {...props} controller={controller} /> : <MobileMainTabBar {...props} controller={controller} />}
      screenOptions={({ route, navigation }) => ({
        lazy: true,
        headerShown: false,
        headerTitle: () => <TreeSwitcher controller={controller} onManageTrees={() => navigation.navigate('treeSettings')} />,
        headerStyle: { backgroundColor: controller.theme.colors.surface },
        tabBarPosition: isDesktopWeb ? 'top' : 'bottom',
        tabBarActiveTintColor: controller.theme.colors.primary,
        tabBarInactiveTintColor: controller.theme.colors.onSurfaceVariant,
        tabBarActiveBackgroundColor: controller.theme.colors.secondaryContainer,
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
          return <UserProfileTabContent treeContext={controller.sharedTabProps} onSignOut={controller.signOut} authLoading={controller.authLoading} />;
        }}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

