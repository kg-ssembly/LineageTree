import React from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Chip, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FamilyTreeCanvas, GlobalStyles, ScreenBackground } from '../../../../components';
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
}: SharedTabProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={[styles.visualisationTabContainer, { backgroundColor: theme.colors.background }]}>
      <ScreenBackground variant="soft-circles" />
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
          <View style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
            backgroundColor: theme.colors.primaryContainer,
          }}>
            <MaterialCommunityIcons name="family-tree" size={40} color={theme.colors.primary} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <Chip compact icon="gesture-pinch">{t(K.lineage.zoom)}</Chip>
            <Chip compact icon="gesture-tap">{t(K.lineage.tapToExplore)}</Chip>
          </View>
          <Text variant="titleMedium">{t(K.lineage.noVisualTreeYet)}</Text>
          <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
            {t(K.lineage.startDrawingTree)}
          </Text>
        </View>
      )}
    </View>
  );
}
