import React from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { EmptyState, FamilyTreeCanvas, GlobalStyles, ScreenBackground, BUTTON_CHROME, BUTTON_CONTENT_CHROME } from '../../../../components';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import type { SharedTabProps } from '../shared';

const styles = GlobalStyles.treeDetail;

export function FamilyTreeView({
  selectedTree,
  people,
  relationships,
  onOpenPersonQuickActions,
  currentAssignedPerson,
  loadingTreeData,
  familySwitchRef,
  activeFamilyRef,
  canEdit,
  mutating,
  onOpenAddPerson,
  onOpenRelationshipDialog,
}: SharedTabProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={[styles.visualisationTabContainer, { backgroundColor: theme.colors.background }]}>
      <ScreenBackground variant="soft-circles" />
      {people.length > 1 && relationships.length === 0 && canEdit && !loadingTreeData ? (
        <View style={{ padding: 16, gap: 8, backgroundColor: theme.colors.surface }}>
          <Text variant="bodyMedium">{t(K.home.linkPeopleTogetherSoTheTreeBecomesAConnectedFamilyInsteadOfSeparatePages)}</Text>
          <Button mode="outlined" icon="family-tree" onPress={onOpenRelationshipDialog} disabled={mutating} style={[BUTTON_CHROME, { alignSelf: 'flex-start' }]} contentStyle={BUTTON_CONTENT_CHROME}>
            {t(K.relationship.addRelationship)}
          </Button>
        </View>
      ) : null}
      {people.length > 0 ? (
        <FamilyTreeCanvas
          people={people}
          relationships={relationships}
          currentTreeId={selectedTree.id}
          onPressPerson={onOpenPersonQuickActions}
          currentUserPersonId={currentAssignedPerson?.id ?? undefined}
          initialFocusPersonId={currentAssignedPerson?.id ?? undefined}
          floatingControls
          fillAvailableSpace
          familySwitchRef={familySwitchRef}
          activeFamilyRef={activeFamilyRef}
        />
      ) : loadingTreeData ? (
        <View style={[styles.visualisationEmptyState, { backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent' }]}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant, marginTop: 14 }]}>
            {t(K.tree.familyMembers.loading)}
          </Text>
        </View>
      ) : (
        <View style={[styles.visualisationEmptyState, { backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent' }]}>
          <EmptyState
            icon="family-tree"
            title={t(K.lineage.noVisualTreeYet)}
            message={t(canEdit ? K.tree.familyMembers.startBuilding : K.tree.familyMembers.sharedTreeEmpty)}
            actionLabel={canEdit ? t(K.home.addFamilyMember) : undefined}
            onAction={canEdit ? onOpenAddPerson : undefined}
            disabled={mutating}
          />
        </View>
      )}
    </View>
  );
}
