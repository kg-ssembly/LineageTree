import React from 'react';
import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { FamilyTreeCanvas } from '../../../../components';
import { GlobalStyles } from '../../../../constants/styles';
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
  familySwitchRef,
  activeFamilyRef,
}: SharedTabProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={styles.visualisationTabContainer}>
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
      ) : (
        <View style={[styles.visualisationEmptyState, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium">{t(K.lineage.noVisualTreeYet)}</Text>
          <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
            {t(K.lineage.startDrawingTree)}
          </Text>
        </View>
      )}
    </View>
  );
}
