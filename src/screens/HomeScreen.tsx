import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
  useTheme,
} from 'react-native-paper';
import { ConfirmDialog, TreeFormDialog } from '../components';
import type { ThemePreference } from '../lib/theme';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useTreeStore } from '../store/treeStore';
import type { RootStackParamList } from '../../components/dto/navigation';
import type { FamilyTree } from '../../components/dto/tree';
import { canManageTree, getTreeRole } from '../../components/dto/tree';
import { GlobalStyles } from '../styles/global-styles';

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

type HelperDialogKey = 'hero' | 'appearance' | 'trees';

const helperDialogCopy: Record<HelperDialogKey, { title: string; message: string }> = {
  hero: {
    title: 'About your family archive',
    message: 'Build family branches, preserve photo memories, and keep life events attached to every person in one living archive.',
  },
  appearance: {
    title: 'Appearance settings',
    message: 'Switch between light, dark, or system mode anytime. System mode follows your device settings automatically.',
  },
  trees: {
    title: 'Family tree workspaces',
    message: 'Each tree is a dedicated workspace where you manage family members, relationships, collaborators, photos, and approvals.',
  },
};

function formatRole(role: ReturnType<typeof getTreeRole>) {
  if (!role) {
    return 'Shared';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

const styles = GlobalStyles.home;

export default function HomeScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { user, signOut, loading: authLoading, setDefaultTreeId } = useAuthStore();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const {
    trees,
    selectedTreeId,
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
  const [helperDialog, setHelperDialog] = useState<{ visible: boolean; key: HelperDialogKey }>({
    visible: false,
    key: 'hero',
  });

  useEffect(() => {
    if (error) {
      setSnackVisible(true);
    }
  }, [error]);

  const stats = useMemo(() => ({
    trees: trees.length,
    active: selectedTreeId ? 1 : 0,
    shared: trees.filter((tree) => tree.collaborators.length > 1).length,
  }), [selectedTreeId, trees]);

  const appearanceSummary = preference === 'system'
    ? 'Following your device appearance automatically.'
    : preference === 'dark'
      ? 'Dark mode is enabled for a cozy, cinematic workspace.'
      : 'Light mode is enabled for a bright, airy workspace.';

  const defaultTree = useMemo(
    () => trees.find((tree) => tree.id === user?.defaultTreeId) ?? null,
    [trees, user?.defaultTreeId],
  );

  useEffect(() => {
    hasAutoOpenedTreeRef.current = false;
    clearedMissingDefaultTreeRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (loadingTrees || !user?.defaultTreeId || defaultTree) {
      return;
    }

    if (clearedMissingDefaultTreeRef.current === user.defaultTreeId) {
      return;
    }

    clearedMissingDefaultTreeRef.current = user.defaultTreeId;
    void setDefaultTreeId(null);
  }, [defaultTree, loadingTrees, setDefaultTreeId, user?.defaultTreeId]);

  useEffect(() => {
    if (!user || loadingTrees || hasAutoOpenedTreeRef.current || trees.length === 0) {
      return;
    }

    if (route.params?.skipAutoOpen) {
      return;
    }

    const targetTree = defaultTree ?? trees[0];
    if (!targetTree) {
      return;
    }

    hasAutoOpenedTreeRef.current = true;
    selectTree(targetTree.id);
    navigation.navigate('TreeDetail', {
      treeId: targetTree.id,
      initialTab: 'VisualisationTab',
    });
  }, [defaultTree, loadingTrees, navigation, route.params?.skipAutoOpen, selectTree, trees, user]);

  const openConfirm = (title: string, message: string, confirmLabel: string, action: () => Promise<void>) => {
    setConfirmState({ visible: true, title, message, confirmLabel, action });
  };

  const closeConfirm = () => {
    setConfirmState({ visible: false, title: '', message: '', confirmLabel: 'Confirm', action: null });
  };

  const handleConfirm = async () => {
    if (!confirmState.action) {
      return;
    }

    try {
      await confirmState.action();
      closeConfirm();
    } catch {
      // surfaced by store snackbar
    }
  };

  const handleTreeSubmit = async (name: string) => {
    if (!user) {
      return;
    }

    try {
      if (treeDialog.mode === 'create') {
        const tree = await createTree({ id: user.id, email: user.email, displayName: user.displayName }, name);
        if (!user.defaultTreeId) {
          await setDefaultTreeId(tree.id);
        }
        setTreeDialog({ visible: false, mode: 'create', tree: null });
        navigation.navigate('TreeDetail', { treeId: tree.id, initialTab: 'VisualisationTab' });
        return;
      }

      if (treeDialog.tree) {
        await renameTree(treeDialog.tree.id, name);
      }

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
      // surfaced by auth store update failures if any are added later
    }
  };

  const openHelperDialog = (key: HelperDialogKey) => {
    setHelperDialog({ visible: true, key });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Surface style={[styles.profileCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={2}>
          <View style={styles.heroTopRow}>
            <Avatar.Text
              size={76}
              label={user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : '??'}
              style={[styles.avatar, { backgroundColor: theme.colors.primary }]}
              color={theme.colors.onPrimary}
            />
            <Chip compact icon="weather-sunset-up" style={{ backgroundColor: theme.colors.secondaryContainer }}>
              Family stories, beautifully organized
            </Chip>
          </View>

          <View style={styles.profileTextWrap}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="headlineMedium" style={[styles.name, { color: theme.colors.onSurface }]}> 
                Hi, {user?.displayName ?? 'there'}
              </Text>
              <IconButton
                icon="information-outline"
                size={20}
                style={styles.helperIconButton}
                onPress={() => openHelperDialog('hero')}
                accessibilityLabel="About your family archive"
              />
            </View>
            <Text variant="bodyMedium" style={[styles.email, { color: theme.colors.onSurfaceVariant }]}>{user?.email}</Text>
            <Text variant="bodyMedium" style={[styles.heroDescription, { color: theme.colors.onSurfaceVariant }]}>
              Your family archive at a glance.
            </Text>
          </View>

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
              onPress={() => setTreeDialog({ visible: true, mode: 'create', tree: null })}
              disabled={mutating}
              contentStyle={styles.headerButtonContent}
              style={styles.heroActionButton}
            >
              New tree
            </Button>
            <Button
              mode="contained-tonal"
              icon="logout"
              onPress={signOut}
              disabled={authLoading}
              contentStyle={styles.headerButtonContent}
              buttonColor={theme.colors.secondaryContainer}
              textColor={theme.colors.onSurface}
              style={styles.heroActionButton}
            >
              Log out
            </Button>
          </View>
        </Surface>

        <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTextWrap}>
              <View style={styles.titleWithHelperRow}>
                <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>Appearance</Text>
                <IconButton
                  icon="information-outline"
                  size={20}
                  style={styles.helperIconButton}
                  onPress={() => openHelperDialog('appearance')}
                  accessibilityLabel="About appearance settings"
                />
              </View>
              <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>Theme and display preferences.</Text>
            </View>
          </View>

          <SegmentedButtons
            value={preference}
            onValueChange={(value) => setPreference(value as ThemePreference)}
            buttons={[
              { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
              { value: 'dark', label: 'Dark', icon: 'weather-night' },
              { value: 'system', label: 'System', icon: 'theme-light-dark' },
            ]}
            style={styles.themeSwitch}
          />

          <View style={[styles.appearanceHint, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{appearanceSummary}</Text>
          </View>
        </Surface>

        <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTextWrap}>
              <View style={styles.titleWithHelperRow}>
                <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>Family trees</Text>
                <IconButton
                  icon="information-outline"
                  size={20}
                  style={styles.helperIconButton}
                  onPress={() => openHelperDialog('trees')}
                  accessibilityLabel="About family tree workspaces"
                />
              </View>
              <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Open a tree to continue where you left off.
              </Text>
            </View>
            <Button
              mode="contained"
              icon="plus"
              onPress={() => setTreeDialog({ visible: true, mode: 'create', tree: null })}
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
                const isSelected = tree.id === selectedTreeId;
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
                    onPress={() => openTree(tree)}
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
                            onPress={() => handleToggleDefaultTree(tree)}
                            disabled={mutating}
                          />
                          {ownerCanManage ? (
                            <>
                              <IconButton
                                icon="pencil"
                                iconColor={theme.colors.primary}
                                onPress={() => setTreeDialog({ visible: true, mode: 'edit', tree })}
                                disabled={mutating}
                              />
                              <IconButton
                                icon="delete"
                                iconColor={theme.colors.error}
                                onPress={() => openConfirm(
                                  'Delete family tree',
                                  `Delete “${tree.name}” and all of its people, photos, and relationships? This cannot be undone.`,
                                  'Delete',
                                  async () => {
                                    await removeTree(tree);
                                    if (user?.defaultTreeId === tree.id) {
                                      await setDefaultTreeId(null);
                                    }
                                  },
                                )}
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
          onDismiss={() => setHelperDialog((current) => ({ ...current, visible: false }))}
        >
          <Dialog.Title>{helperDialogCopy[helperDialog.key].title}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{helperDialogCopy[helperDialog.key].message}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setHelperDialog((current) => ({ ...current, visible: false }))}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => {
          setSnackVisible(false);
          clearError();
        }}
        duration={5000}
        action={{
          label: 'Dismiss',
          onPress: () => {
            setSnackVisible(false);
            clearError();
          },
        }}
      >
        {error}
      </Snackbar>
    </View>
  );
}

