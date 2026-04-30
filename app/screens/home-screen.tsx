import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Dialog,
  IconButton,
  Portal,
  SegmentedButtons,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { ConfirmDialog, TreeFormDialog } from '../../components';
import type { ThemePreference } from '../../constants/theme';
import { useAuthStore } from '../../stores/auth-store';
import { useThemeStore } from '../../stores/theme-store';
import { useTreeStore } from '../../stores/tree-store';
import type { RootStackParamList } from '../../components/dto/navigation';
import type { FamilyTree } from '../../components/dto/tree';
import { canManageTree, getTreeRole } from '../../components/dto/tree';
import { GlobalStyles } from '../../constants/styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type TreeDialogState = {
  visible: boolean;
  mode: 'create' | 'edit';
  tree: FamilyTree | null;
};

type ConfirmState = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  action: (() => Promise<void>) | null;
};

function formatRole(role: ReturnType<typeof getTreeRole>) {
  if (!role) return 'Shared';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

const Tab = createBottomTabNavigator();
const styles = GlobalStyles.home;

const localStyles = StyleSheet.create({
  tabBar: {
    height: 64,
    paddingTop: 6,
    paddingBottom: 8,
    borderTopWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'none' as const,
  },
  tabItem: {
    minHeight: 52,
  },
  profileHeroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  profileAvatarRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
  },
  profileNameWrap: {
    flex: 1,
  },
  editNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 16,
  },
  editNameInput: {
    flex: 1,
  },
  signOutButton: {
    marginTop: 16,
  },
  signOutButtonContent: {
    height: 48,
  },
});

// ── Profile Tab ────────────────────────────────────────────────────────────────

type ProfileTabProps = {
  onSignOut: () => void;
  authLoading: boolean;
};

function ProfileTabContent({ onSignOut, authLoading }: ProfileTabProps) {
  const theme = useTheme();
  const { user, updateDisplayName } = useAuthStore();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const [editName, setEditName] = useState(user?.displayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const isDirty = editName.trim() !== (user?.displayName ?? '').trim();

  const handleSaveName = async () => {
    if (!editName.trim()) {
      setNameError('Display name cannot be empty.');
      return;
    }
    setNameError(null);
    setSavingName(true);
    try {
      await updateDisplayName(editName.trim());
    } catch {
      setNameError('Failed to update name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const appearanceSummary =
    preference === 'dark'
      ? 'Dark mode is enabled for a cosy, low-light workspace.'
      : 'Light mode is enabled for a bright, airy workspace.';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Hero */}
      <Surface style={[localStyles.profileHeroCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={2}>
        <View style={localStyles.profileAvatarRow}>
          <Avatar.Text
            size={72}
            label={user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : '??'}
            style={{ backgroundColor: theme.colors.primary }}
            color={theme.colors.onPrimary}
          />
          <View style={localStyles.profileNameWrap}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
              {user?.displayName ?? 'Unknown'}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
              {user?.email}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
              Member since {user?.createdAt ? new Date(user.createdAt).getFullYear() : '—'}
            </Text>
          </View>
        </View>
      </Surface>

      {/* Edit profile */}
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>Edit profile</Text>
        <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Update your display name.
        </Text>
        <View style={localStyles.editNameRow}>
          <TextInput
            label="Display name"
            value={editName}
            onChangeText={(value) => { setEditName(value); setNameError(null); }}
            mode="outlined"
            style={localStyles.editNameInput}
            error={!!nameError}
            disabled={savingName}
          />
          <IconButton
            icon="content-save-outline"
            mode="contained"
            iconColor={theme.colors.onPrimary}
            containerColor={theme.colors.primary}
            size={24}
            onPress={handleSaveName}
            disabled={savingName || !isDirty}
          />
        </View>
        {nameError ? (
          <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>{nameError}</Text>
        ) : null}
      </Surface>

      {/* Appearance */}
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>Appearance</Text>
        <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Theme and display preferences.
        </Text>
        <SegmentedButtons
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
          buttons={[
            { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
            { value: 'dark', label: 'Dark', icon: 'weather-night' },
          ]}
          style={styles.themeSwitch}
        />
        <View style={[styles.appearanceHint, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{appearanceSummary}</Text>
        </View>
      </Surface>

      {/* Sign out */}
      <Button
        mode="contained-tonal"
        icon="logout"
        onPress={onSignOut}
        disabled={authLoading}
        contentStyle={localStyles.signOutButtonContent}
        buttonColor={theme.colors.secondaryContainer}
        textColor={theme.colors.onSurface}
        style={localStyles.signOutButton}
      >
        Log out
      </Button>
    </ScrollView>
  );
}

// ── Tree Management Tab ────────────────────────────────────────────────────────

type TreeManagementTabProps = {
  onOpenTree: (tree: FamilyTree) => void;
  onOpenCreateTree: () => void;
  onOpenEditTree: (tree: FamilyTree) => void;
  onConfirmDeleteTree: (tree: FamilyTree) => void;
  onToggleDefaultTree: (tree: FamilyTree) => void;
};

function TreeManagementTabContent({
  onOpenTree,
  onOpenCreateTree,
  onOpenEditTree,
  onConfirmDeleteTree,
  onToggleDefaultTree,
}: TreeManagementTabProps) {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { trees, selectedTreeId: treeSelectedId, loadingTrees, mutating } = useTreeStore();

  const stats = useMemo(() => ({
    trees: trees.length,
    active: treeSelectedId ? 1 : 0,
    shared: trees.filter((t) => t.collaborators.length > 1).length,
  }), [treeSelectedId, trees]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Stats */}
      <Surface style={[styles.profileCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={2}>
        <View style={styles.titleWithHelperRow}>
          <Text variant="headlineMedium" style={[styles.name, { color: theme.colors.onSurface }]}>
            My trees
          </Text>
        </View>
        <Text variant="bodyMedium" style={[styles.heroDescription, { color: theme.colors.onSurfaceVariant }]}>
          Manage your family tree workspaces.
        </Text>
        <View style={styles.heroStatsRow}>
          <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={0}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>{stats.trees}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Trees</Text>
          </Surface>
          <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={0}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>{stats.shared}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Shared</Text>
          </Surface>
          <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]} elevation={0}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>{stats.active}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Active</Text>
          </Surface>
        </View>
        <View style={styles.heroActionsRow}>
          <Button
            mode="contained"
            icon="plus"
            onPress={onOpenCreateTree}
            disabled={mutating}
            contentStyle={styles.headerButtonContent}
            style={styles.heroActionButton}
          >
            New tree
          </Button>
        </View>
      </Surface>

      {/* Tree list */}
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTextWrap}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>Family trees</Text>
            <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Your trees
            </Text>
          </View>
          <Button
            mode="contained"
            icon="plus"
            onPress={onOpenCreateTree}
            disabled={mutating}
          >
            New tree
          </Button>
        </View>

        {loadingTrees ? (
          <View style={styles.centeredState}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>Loading your trees…</Text>
          </View>
        ) : trees.length === 0 ? (
          <View style={styles.emptyState}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>No family trees yet</Text>
            <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
              Create your first tree to start adding people, photos, and relationships.
            </Text>
          </View>
        ) : (
          <View>
            {trees.map((tree) => {
              const isSelected = tree.id === treeSelectedId;
              const isDefaultTree = user?.defaultTreeId === tree.id;
              const role = getTreeRole(tree, user?.id);
              const ownerCanManage = canManageTree(tree, user?.id);

              return (
                <Card
                  key={tree.id}
                  mode="contained"
                  style={[
                    styles.treeCard,
                    {
                      backgroundColor: isSelected ? theme.colors.elevation.level2 : theme.colors.elevation.level1,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.outlineVariant,
                    },
                  ]}
                  onPress={() => onOpenTree(tree)}
                >
                  <Card.Content>
                    <View style={styles.treeHeader}>
                      <View style={styles.treeTextWrap}>
                        <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>{tree.name}</Text>
                        <Text variant="bodyMedium" style={[styles.treeMetaText, { color: theme.colors.onSurfaceVariant }]}>
                          {tree.collaborators.length} member{tree.collaborators.length === 1 ? '' : 's'}
                        </Text>
                        <View style={styles.treeChipRow}>
                          <Chip compact icon="account-key">{formatRole(role)}</Chip>
                          {isDefaultTree ? <Chip compact icon="star" style={{ backgroundColor: theme.colors.secondaryContainer }}>Default</Chip> : null}
                          {isSelected ? <Chip compact icon="check-circle" style={{ backgroundColor: theme.colors.tertiaryContainer }}>Active</Chip> : null}
                        </View>
                      </View>
                      <View style={styles.cardActions}>
                        <IconButton
                          icon={isDefaultTree ? 'star' : 'star-outline'}
                          iconColor={isDefaultTree ? theme.colors.secondary : theme.colors.onSurfaceVariant}
                          onPress={() => onToggleDefaultTree(tree)}
                          disabled={mutating}
                        />
                        {ownerCanManage ? (
                          <>
                            <IconButton
                              icon="pencil"
                              iconColor={theme.colors.primary}
                              onPress={() => onOpenEditTree(tree)}
                              disabled={mutating}
                            />
                            <IconButton
                              icon="delete"
                              iconColor={theme.colors.error}
                              onPress={() => onConfirmDeleteTree(tree)}
                              disabled={mutating}
                            />
                          </>
                        ) : null}
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              );
            })}
          </View>
        )}
      </Surface>
    </ScrollView>
  );
}

// ── Home Screen ────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { user, signOut, loading: authLoading, setDefaultTreeId } = useAuthStore();
  const {
    trees,
    loadingTrees,
    mutating,
    error,
    selectTree,
    createTree,
    renameTree,
    removeTree,
    clearError,
  } = useTreeStore();

  const [treeDialog, setTreeDialog] = useState<TreeDialogState>({ visible: false, mode: 'create', tree: null });
  const [snackVisible, setSnackVisible] = useState(false);
  const hasAutoOpenedTreeRef = useRef(false);
  const clearedMissingDefaultTreeRef = useRef<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    action: null,
  });
  const [helperDialog, setHelperDialog] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    if (error) setSnackVisible(true);
  }, [error]);

  const defaultTree = useMemo(
    () => trees.find((t) => t.id === user?.defaultTreeId) ?? null,
    [trees, user?.defaultTreeId],
  );

  useEffect(() => {
    hasAutoOpenedTreeRef.current = false;
    clearedMissingDefaultTreeRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (loadingTrees || !user?.defaultTreeId || defaultTree) return;
    if (clearedMissingDefaultTreeRef.current === user.defaultTreeId) return;
    clearedMissingDefaultTreeRef.current = user.defaultTreeId;
    void setDefaultTreeId(null);
  }, [defaultTree, loadingTrees, setDefaultTreeId, user?.defaultTreeId]);

  useEffect(() => {
    if (!user || loadingTrees || hasAutoOpenedTreeRef.current || trees.length === 0) return;
    if (route.params?.skipAutoOpen) return;
    const targetTree = defaultTree ?? trees[0];
    if (!targetTree) return;
    hasAutoOpenedTreeRef.current = true;
    selectTree(targetTree.id);
    navigation.navigate('TreeDetail', { treeId: targetTree.id, initialTab: 'VisualisationTab' });
  }, [defaultTree, loadingTrees, navigation, route.params?.skipAutoOpen, selectTree, trees, user]);

  const openConfirm = (title: string, message: string, confirmLabel: string, action: () => Promise<void>) => {
    setConfirmState({ visible: true, title, message, confirmLabel, action });
  };

  const closeConfirm = () => {
    setConfirmState({ visible: false, title: '', message: '', confirmLabel: 'Confirm', action: null });
  };

  const handleConfirm = async () => {
    if (!confirmState.action) return;
    try {
      await confirmState.action();
      closeConfirm();
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleTreeSubmit = async (name: string) => {
    if (!user) return;
    try {
      if (treeDialog.mode === 'create') {
        const tree = await createTree({ id: user.id, email: user.email, displayName: user.displayName }, name);
        if (!user.defaultTreeId) await setDefaultTreeId(tree.id);
        setTreeDialog({ visible: false, mode: 'create', tree: null });
        navigation.navigate('TreeDetail', { treeId: tree.id, initialTab: 'VisualisationTab' });
        return;
      }
      if (treeDialog.tree) await renameTree(treeDialog.tree.id, name);
      setTreeDialog({ visible: false, mode: 'create', tree: null });
    } catch {
      // surfaced by store snackbar
    }
  };

  const openTree = (tree: FamilyTree) => {
    selectTree(tree.id);
    navigation.navigate('TreeDetail', { treeId: tree.id });
  };

  const handleToggleDefaultTree = async (tree: FamilyTree) => {
    try {
      await setDefaultTreeId(user?.defaultTreeId === tree.id ? null : tree.id);
    } catch {
      // ignored
    }
  };

  const handleConfirmDeleteTree = (tree: FamilyTree) => {
    openConfirm(
      'Delete family tree',
      `Delete "${tree.name}" and all of its people, photos, and relationships? This cannot be undone.`,
      'Delete',
      async () => {
        await removeTree(tree);
        if (user?.defaultTreeId === tree.id) await setDefaultTreeId(null);
      },
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Tab.Navigator
        screenOptions={({ route: currentRoute }) => ({
          lazy: true,
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          tabBarShowIcon: true,
          tabBarStyle: [localStyles.tabBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }],
          tabBarLabelStyle: localStyles.tabLabel,
          tabBarItemStyle: localStyles.tabItem,
          sceneStyle: { backgroundColor: theme.colors.background },
          tabBarIcon: ({ color, size }) => {
            const iconName = currentRoute.name === 'MyProfileTab' ? 'account-circle-outline' : 'family-tree';
            return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="MyProfileTab" options={{ title: 'My Profile' }}>
          {() => <ProfileTabContent onSignOut={signOut} authLoading={authLoading} />}
        </Tab.Screen>
        <Tab.Screen name="TreeManagementTab" options={{ title: 'Tree Management' }}>
          {() => (
            <TreeManagementTabContent
              onOpenTree={openTree}
              onOpenCreateTree={() => setTreeDialog({ visible: true, mode: 'create', tree: null })}
              onOpenEditTree={(tree) => setTreeDialog({ visible: true, mode: 'edit', tree })}
              onConfirmDeleteTree={handleConfirmDeleteTree}
              onToggleDefaultTree={handleToggleDefaultTree}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>

      <TreeFormDialog
        visible={treeDialog.visible}
        mode={treeDialog.mode}
        tree={treeDialog.tree}
        loading={mutating}
        onDismiss={() => setTreeDialog({ visible: false, mode: 'create', tree: null })}
        onSubmit={handleTreeSubmit}
      />

      <ConfirmDialog
        visible={confirmState.visible}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        loading={mutating}
        onDismiss={closeConfirm}
        onConfirm={handleConfirm}
      />

      <Portal>
        <Dialog
          visible={helperDialog.visible}
          onDismiss={() => setHelperDialog((c) => ({ ...c, visible: false }))}
        >
          <Dialog.Title>{helperDialog.title}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{helperDialog.message}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setHelperDialog((c) => ({ ...c, visible: false }))}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => { setSnackVisible(false); clearError(); }}
        duration={5000}
        action={{ label: 'Dismiss', onPress: () => { setSnackVisible(false); clearError(); } }}
      >
        {error}
      </Snackbar>
    </View>
  );
}

