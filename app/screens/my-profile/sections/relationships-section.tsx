import React from 'react';
import { View } from 'react-native';
import { Button, Chip, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { HorizontalTabStrip, RelationshipInsightCard, Reveal } from '../../../../components';
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
    <Reveal delay={110}>
    <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={personProfileStyles.sectionHeader}>
        <View style={personProfileStyles.sectionHeaderText}>
          <Text variant="titleLarge">{t(K.personProfile.relationships)}</Text>
        </View>
        {canEditLinkedProfile ? (
          <Button mode="contained" icon="family-tree" onPress={onAddRelationship}>
            Connect family
          </Button>
        ) : null}
      </View>
      <Text variant="bodyMedium" style={[personProfileStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
        Explore how your story is connected, then add the missing links that make your branch clearer.
      </Text>

      <HorizontalTabStrip
        items={[
          { key: 'insight', label: t(K.personProfile.howRelated) },
          { key: 'list', label: t('All relationships') },
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
          {relationshipEntries.map((entry, index) => (
            <Reveal key={entry.relationship.id} delay={140 + index * 35}>
            <View style={[personProfileStyles.relationshipCard, { backgroundColor: theme.colors.surface }]}>
              <View style={personProfileStyles.relationshipRow}>
                <View style={personProfileStyles.relationshipTextWrap}>
                  <Chip compact style={personProfileStyles.relationshipChip}>
                    {entry.mode === 'parent-of' ? t(K.relationship.parentOf) : entry.mode === 'child-of' ? t(K.relationship.childOf) : t(K.relationship.spouseOf)}
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
            </Reveal>
          ))}
        </View>
      ) : (
        <View style={personProfileStyles.emptyState}>
          <Text variant="titleMedium">{t(K.personProfile.noRelationshipsYet)}</Text>
          <Text variant="bodyMedium" style={[personProfileStyles.stateText, { color: theme.colors.onSurfaceVariant }]}>
            Add a parent, child, or partner to start mapping how {formatPersonName(linkedPerson)} belongs in the bigger family story.
          </Text>
        </View>
      )}
    </Surface>
    </Reveal>
  );
}
