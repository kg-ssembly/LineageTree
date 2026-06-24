import React from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import { getTreeRole } from '../../../../components/dto/tree';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import type { TreesSectionProps } from './tree-settings-shared';
import { formatRole } from './tree-settings-shared';

const styles = GlobalStyles.treeDetail;

export function TreesSection({
  selectedTree,
  trees,
  defaultTreeId,
  loadingTrees,
  userId,
  mutating,
  maidenSurnameSuggestions,
  onOpenHelperDialog,
  onCreateSurnameTree,
  onCreateTree,
  onEditTree,
  onSwitchTree,
  onCopyTreeId,
}: TreesSectionProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View>
      {maidenSurnameSuggestions.length > 0 ? (
        <Card mode="elevated" style={[styles.collaboratorCard, { backgroundColor: theme.colors.surface, marginBottom: 16 }]}>
          <Card.Content>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleMedium">{t('Suggested maiden surname trees')}</Text>
              <IconButton
                icon="information-outline"
                size={18}
                style={styles.helperIconButton}
                onPress={() => onOpenHelperDialog('maiden-surname-trees')}
                accessibilityLabel={t('About suggested maiden surname trees')}
              />
            </View>
            <View style={{ marginTop: 8 }}>
              {maidenSurnameSuggestions.map((suggestion) => (
                <Card key={suggestion.surname} mode="contained" style={{ marginTop: 8, borderRadius: 12 }}>
                  <Card.Content>
                    <Text variant="titleSmall">{suggestion.surname}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t('{count} member(s) reference this as a maiden surname.', { count: suggestion.count })}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <Button mode="contained-tonal" onPress={() => onCreateSurnameTree(suggestion.surname)} disabled={mutating}>
                        {t('Create tree')}
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              ))}
            </View>
          </Card.Content>
        </Card>
      ) : null}

      <View style={styles.sectionHeader}>
        <View style={styles.titleWrap}>
          <View style={styles.titleWithHelperRow}>
            <Text variant="titleMedium">{t('My Family Trees')}</Text>
            <IconButton
              icon="information-outline"
              size={18}
              style={styles.helperIconButton}
              onPress={() => onOpenHelperDialog('my-trees')}
              accessibilityLabel={t('About my family trees')}
            />
          </View>
        </View>
      </View>

      {loadingTrees ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (trees ?? []).length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="titleMedium">{t('No trees yet')}</Text>
          <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
            {t('Create your first family tree to start building.')}
          </Text>
          {onCreateTree ? (
            <Button mode="contained" icon="plus" onPress={onCreateTree} disabled={mutating} style={styles.emptyStateButton}>
              {t('Create a tree')}
            </Button>
          ) : null}
        </View>
      ) : (
        (trees ?? []).map((tree) => {
          const isDefault = tree.id === defaultTreeId;
          const isSelected = tree.id === selectedTree.id;
          const treeRole = getTreeRole(tree, userId);

          return (
            <Card key={tree.id} style={[styles.personCard, { backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.surface }]} mode="elevated">
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text variant="titleMedium" style={isSelected ? { color: theme.colors.onPrimaryContainer } : undefined}>{tree.name}</Text>
                      {isDefault ? <Chip compact style={{ backgroundColor: theme.colors.secondaryContainer }}>{t('Default')}</Chip> : null}
                      {isSelected ? <Chip compact icon="check-circle" style={{ backgroundColor: theme.colors.primaryContainer }}>{t('Active')}</Chip> : null}
                    </View>
                    <Text variant="bodySmall" style={{ color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant, marginTop: 2 }}>
                      {t('{count} member(s) · {role}', { count: tree.memberIds?.length ?? 0, role: formatRole(treeRole) })}
                    </Text>
                    <Text selectable variant="bodySmall" style={{ color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant, marginTop: 4 }}>
                      {t('Tree ID: {id}', { id: tree.id })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <IconButton icon="content-copy" size={20} onPress={() => { void onCopyTreeId(tree.id); }} disabled={mutating} />
                    {!isSelected && onSwitchTree ? (
                      <IconButton icon="swap-horizontal" size={20} onPress={() => onSwitchTree(tree)} disabled={mutating} />
                    ) : null}
                    {onEditTree ? (
                      <IconButton icon="pencil-outline" size={20} onPress={() => onEditTree(tree)} disabled={mutating} />
                    ) : null}
                  </View>
                </View>
              </Card.Content>
            </Card>
          );
        })
      )}
    </View>
  );
}
