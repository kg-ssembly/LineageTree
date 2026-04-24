import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  IconButton,
  Snackbar,
  Surface,
  Text,
} from 'react-native-paper';
import { ConfirmDialog, TreeFormDialog } from '../components';
import { theme } from '../lib/theme';
import { useAuthStore } from '../store/authStore';
import { useTreeStore } from '../store/treeStore';
import type { RootStackParamList } from '../types/navigation';
import type { FamilyTree } from '../types/tree';
import { canManageTree, getTreeRole } from '../types/tree';

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
  if (!role) {
    return 'Shared';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function HomeScreen({ navigation }: Props) {
  const { user, signOut, loading: authLoading } = useAuthStore();
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
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    visible: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    action: null,
  });

  useEffect(() => {
    if (error) {
      setSnackVisible(true);
    }
  }, [error]);

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
        setTreeDialog({ visible: false, mode: 'create', tree: null });
        navigation.navigate('TreeDetail', { treeId: tree.id, treeName: tree.name });
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
    navigation.navigate('TreeDetail', { treeId: tree.id, treeName: tree.name });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Surface style={styles.profileCard} elevation={2}>
          <Avatar.Text
            size={72}
            label={user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : '??'}
            style={styles.avatar}
          />
          <View style={styles.profileTextWrap}>
            <Text variant="headlineSmall" style={styles.name}>{user?.displayName ?? 'Welcome!'}</Text>
            <Text variant="bodyMedium" style={styles.email}>{user?.email}</Text>
          </View>
          <Button
            mode="contained"
            onPress={signOut}
            disabled={authLoading}
            buttonColor="#E24A4A"
            contentStyle={styles.headerButtonContent}
          >
            Log Out
          </Button>
        </Surface>

        <Surface style={styles.sectionCard} elevation={1}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTextWrap}>
              <Text variant="headlineSmall">Family trees</Text>
              <Text variant="bodyMedium" style={styles.sectionSubtitle}>
                Open a tree to manage people, relationships, and collaborators in its dedicated workspace.
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
              <Text variant="bodyMedium" style={styles.stateText}>Loading your trees…</Text>
            </View>
          ) : trees.length === 0 ? (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">No family trees yet</Text>
              <Text variant="bodyMedium" style={styles.stateText}>
                Create your first tree to start adding people, photos, and relationships.
              </Text>
            </View>
          ) : (
            <View>
              {trees.map((tree) => {
                const isSelected = tree.id === selectedTreeId;
                const role = getTreeRole(tree, user?.id);
                const ownerCanManage = canManageTree(tree, user?.id);

                return (
                  <Card
                    key={tree.id}
                    mode="elevated"
                    style={[styles.treeCard, isSelected && styles.treeCardSelected]}
                    onPress={() => openTree(tree)}
                  >
                    <Card.Content>
                      <View style={styles.treeHeader}>
                        <View style={styles.treeTextWrap}>
                          <Text variant="titleLarge">{tree.name}</Text>
                          <Text variant="bodyMedium" style={styles.treeMetaText}>
                            {tree.collaborators.length} member{tree.collaborators.length === 1 ? '' : 's'}
                          </Text>
                          <View style={styles.treeChipRow}>
                            <Chip compact icon="account-key">{formatRole(role)}</Chip>
                            {isSelected ? <Chip compact icon="check-circle">Active</Chip> : null}
                          </View>
                        </View>
                        <View style={styles.cardActions}>
                          {ownerCanManage ? (
                            <>
                              <IconButton
                                icon="pencil"
                                onPress={() => setTreeDialog({ visible: true, mode: 'edit', tree })}
                                disabled={mutating}
                              />
                              <IconButton
                                icon="delete"
                                iconColor="#C62828"
                                onPress={() => openConfirm(
                                  'Delete family tree',
                                  `Delete “${tree.name}” and all of its people, photos, and relationships? This cannot be undone.`,
                                  'Delete',
                                  async () => {
                                    await removeTree(tree);
                                  },
                                )}
                                disabled={mutating}
                              />
                            </>
                          ) : null}
                        </View>
                      </View>
                    </Card.Content>
                    <Card.Actions>
                      <Button onPress={() => openTree(tree)}>Open tree</Button>
                    </Card.Actions>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7FF',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  avatar: {
    marginBottom: 16,
  },
  profileTextWrap: {
    marginBottom: 16,
  },
  name: {
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    color: '#6B6B74',
  },
  headerButtonContent: {
    height: 46,
  },
  sectionCard: {
    borderRadius: 20,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionTextWrap: {
    flex: 1,
    minWidth: 220,
  },
  sectionSubtitle: {
    marginTop: 4,
    color: '#6B6B74',
  },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  stateText: {
    marginTop: 8,
    color: '#6B6B74',
    textAlign: 'center',
  },
  treeCard: {
    marginTop: 12,
  },
  treeCardSelected: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: '#F2F0FF',
  },
  treeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  treeTextWrap: {
    flex: 1,
  },
  treeMetaText: {
    color: '#6B6B74',
    marginTop: 4,
  },
  treeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
