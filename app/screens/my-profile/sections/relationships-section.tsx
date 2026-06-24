import React from 'react';
import { View } from 'react-native';
import { Button, Chip, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { HorizontalTabStrip, RelationshipInsightCard } from '../../../../components';
import type { PersonRecord } from '../../../../components/dto/person';
import type { RelationshipRecord } from '../../../../components/dto/relationship';
import { formatPersonName } from '../../../../components/person-formatting';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const personProfileStyles = GlobalStyles.personProfile;

export type RelationshipSectionTabKey = 'insight' | 'list';

export function RelationshipsSection({
  linkedPerson,
  people,
  relationships,
  relationshipSectionTab,
  setRelationshipSectionTab,
  relationshipEntries,
  canEditLinkedProfile,
  mutating,
  onAddRelationship,
  onEditRelationship,
}: {
  linkedPerson: PersonRecord;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  relationshipSectionTab: RelationshipSectionTabKey;
  setRelationshipSectionTab: (tab: RelationshipSectionTabKey) => void;
  relationshipEntries: Array<{
    relationship: RelationshipRecord;
    mode: 'parent-of' | 'child-of' | 'spouse-of';
    relatedPerson: PersonRecord | null;
    subtitle: string;
  }>;
  canEditLinkedProfile: boolean;
  mutating: boolean;
  onAddRelationship: () => void;
  onEditRelationship: (relationship: RelationshipRecord) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={personProfileStyles.sectionHeader}>
        <View style={personProfileStyles.sectionHeaderText}>
          <Text variant="titleLarge">{t(K.personProfile.relationships)}</Text>
        </View>
        {canEditLinkedProfile ? (
          <Button mode="contained" icon="family-tree" onPress={onAddRelationship}>
            {t(K.personProfile.addRelationship)}
          </Button>
        ) : null}
      </View>

      <HorizontalTabStrip
        items={[
          { key: 'insight', label: t(K.personProfile.howRelated) },
          { key: 'list', label: t(K.personProfile.allLinks) },
        ]}
        activeKey={relationshipSectionTab}
        onChange={(value) => setRelationshipSectionTab(value as RelationshipSectionTabKey)}
        containerStyle={[personProfileStyles.tabStripCard, personProfileStyles.relationshipTabStripCard, { backgroundColor: theme.colors.surface }]}
        contentContainerStyle={personProfileStyles.tabStripContent}
        itemStyle={personProfileStyles.tabStripItem}
      />

      {relationshipSectionTab === 'insight' ? (
        <RelationshipInsightCard people={people} relationships={relationships} lockedFromPersonId={linkedPerson.id} title={t(K.personProfile.howDoIRelate)} />
      ) : relationshipEntries.length > 0 ? (
        <View style={personProfileStyles.relationshipList}>
          {relationshipEntries.map((entry) => (
            <View key={entry.relationship.id} style={[personProfileStyles.relationshipCard, { backgroundColor: theme.colors.surface }]}>
              <View style={personProfileStyles.relationshipRow}>
                <View style={personProfileStyles.relationshipTextWrap}>
                  <Chip compact style={personProfileStyles.relationshipChip}>
                    {entry.mode === 'parent-of' ? t('Parent of') : entry.mode === 'child-of' ? t('Child of') : t('Spouse of')}
                  </Chip>
                  <Text variant="titleMedium" style={personProfileStyles.relationshipTitle}>{formatPersonName(entry.relatedPerson)}</Text>
                  <Text variant="bodySmall" style={[personProfileStyles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {entry.subtitle}
                  </Text>
                </View>
                {canEditLinkedProfile ? (
                  <View style={personProfileStyles.rowActions}>
                    <IconButton icon="pencil" onPress={() => onEditRelationship(entry.relationship)} disabled={mutating} />
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={personProfileStyles.emptyState}>
          <Text variant="titleMedium">{t(K.personProfile.noRelationshipsYet)}</Text>
          <Text variant="bodyMedium" style={[personProfileStyles.stateText, { color: theme.colors.onSurfaceVariant }]}>
            {t('Add parents, children, or spouses from this family member to grow the story around them.')}
          </Text>
        </View>
      )}
    </Surface>
  );
}
