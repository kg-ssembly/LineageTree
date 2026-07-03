import React from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import { Reveal, SectionCard } from '../../../../components';
import { getTreeRole } from '../../../../components/dto/tree';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
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
  onToggleDefaultTree,
  onSwitchTree,
  onCopyTreeId,
}: TreesSectionProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const linkedTreeId = userId
    ? (trees ?? []).find((tree) => Boolean(tree.personAssignments[userId]))?.id ?? null
    : null;

  return (
    <Reveal delay={80}>
    <View>
      {maidenSurnameSuggestions.length > 0 ? (
        <Reveal delay={80}>
          <SectionCard style={[styles.collaboratorCard, { marginBottom: 16 }]}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleMedium">{t(K.treeSettings.suggestedMaidenSurnameTrees)}</Text>
              <IconButton
                icon="information-outline"
                size={18}
                style={styles.helperIconButton}
                onPress={() => onOpenHelperDialog('maiden-surname-trees')}
                accessibilityLabel={t(K.treeSettings.aboutSuggestedMaidenSurnameTrees)}
              />
            </View>
            <View style={{ marginTop: 8 }}>
              {maidenSurnameSuggestions.map((suggestion, index) => (
                <Reveal key={suggestion.surname} delay={100 + index * 20}>
                  <SectionCard nested style={{ marginTop: 8, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 14 }}>
                    <Text variant="titleSmall">{suggestion.surname}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t(K.treeSettings.maidenSurnameReferenceCount, { count: suggestion.count })}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <Button mode="outlined" onPress={() => onCreateSurnameTree(suggestion.surname)} disabled={mutating} style={BUTTON_CHROME} buttonColor={theme.colors.surface} textColor={theme.colors.primary} contentStyle={BUTTON_CONTENT_CHROME}>
                        {t(K.treeSettings.createTree)}
                      </Button>
                    </View>
                  </SectionCard>
                </Reveal>
              ))}
            </View>
          </SectionCard>
        </Reveal>
      ) : null}

        <View style={styles.sectionHeader}>
        <View style={styles.titleWrap}>
          <View style={styles.titleWithHelperRow}>
            <Text variant="titleMedium">{t(K.treeSettings.myFamilyTrees)}</Text>
            <IconButton
              icon="information-outline"
              size={18}
              style={styles.helperIconButton}
              onPress={() => onOpenHelperDialog('my-trees')}
              accessibilityLabel={t(K.treeSettings.aboutMyFamilyTrees)}
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
          <Text variant="titleMedium">{t(K.treeSettings.noTreesYet)}</Text>
          <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
            Start your first family space here, then let it grow branch by branch and story by story.
          </Text>
          {onCreateTree ? (
            <Button mode="contained" icon="plus" onPress={onCreateTree} disabled={mutating} style={[styles.emptyStateButton, BUTTON_CHROME]} contentStyle={BUTTON_CONTENT_CHROME}>
              {t(K.treeSettings.createATree)}
            </Button>
          ) : null}
        </View>
      ) : (
        (trees ?? []).map((tree, index) => {
          const isDefault = tree.id === defaultTreeId;
          const isSelected = tree.id === selectedTree.id;
          const treeRole = getTreeRole(tree, userId);
          const hideTreeActionIcons = Boolean(linkedTreeId && tree.id !== linkedTreeId);

          return (
            <Reveal key={tree.id} delay={100 + index * 25}>
              <SectionCard nested style={[styles.personCard, { backgroundColor: isSelected ? theme.colors.primaryContainer : theme.colors.surface, paddingVertical: 14, paddingHorizontal: 14 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text variant="titleMedium" style={isSelected ? { color: theme.colors.onPrimaryContainer } : undefined}>{tree.name}</Text>
                      {isDefault ? <Chip compact style={{ backgroundColor: theme.colors.secondaryContainer }}>{t(K.treeSettings.defaultTree)}</Chip> : null}
                      {isSelected ? <Chip compact icon="check-circle" style={{ backgroundColor: theme.colors.primaryContainer }}>{t(K.treeSettings.active)}</Chip> : null}
                    </View>
                    <Text variant="bodySmall" style={{ color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant, marginTop: 2 }}>
                      {t(K.tree.trees.memberCountWithRole, { count: tree.memberIds?.length ?? 0, role: formatRole(treeRole) })}
                    </Text>
                    <Text selectable variant="bodySmall" style={{ color: isSelected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant, marginTop: 4 }}>
                      {t(K.treeSettings.treeId, { id: tree.id })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <IconButton icon="content-copy" size={20} onPress={() => { void onCopyTreeId(tree.id); }} disabled={mutating} />
                    {onToggleDefaultTree && !hideTreeActionIcons ? (
                      <IconButton
                        icon={isDefault ? 'star' : 'star-outline'}
                        size={20}
                        onPress={() => onToggleDefaultTree(tree)}
                        disabled={mutating}
                      />
                    ) : null}
                    {!isSelected && onSwitchTree && !hideTreeActionIcons ? (
                      <IconButton icon="swap-horizontal" size={20} onPress={() => onSwitchTree(tree)} disabled={mutating} />
                    ) : null}
                    {onEditTree ? (
                      <IconButton icon="pencil-outline" size={20} onPress={() => onEditTree(tree)} disabled={mutating} />
                    ) : null}
                  </View>
                </View>
              </SectionCard>
            </Reveal>
          );
        })
      )}
    </View>
    </Reveal>
  );
}
