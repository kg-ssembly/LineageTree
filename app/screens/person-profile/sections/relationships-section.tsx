import React from 'react';
import { View } from 'react-native';
import { Button, Chip, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { HorizontalTabStrip, RelationshipInsightCard, Reveal } from '../../../../components';
import type { PersonRelationshipMode } from '../../../../components/person-relationship-dialog';
import type { PersonRecord } from '../../../../components/dto/person';
import type { RelationshipRecord } from '../../../../components/dto/relationship';
import { formatPersonName } from '../../../../components/person-formatting';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const styles = GlobalStyles.personProfile;

export type PersonRelationshipSectionTabKey = 'insight' | 'list';

export function PersonRelationshipsSection({
  person,
  people,
  relationships,
  canEdit,
  mutating,
  relationshipSectionTab,
  setRelationshipSectionTab,
  paginatedRelationships,
  relationshipPage,
  totalRelationshipPages,
  setRelationshipPage,
  onOpenHelperDialog,
  onAddRelationship,
  onEditRelationship,
}: {
  person: PersonRecord;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  canEdit: boolean;
  mutating: boolean;
  relationshipSectionTab: PersonRelationshipSectionTabKey;
  setRelationshipSectionTab: (tab: PersonRelationshipSectionTabKey) => void;
  paginatedRelationships: Array<{
    relationship: RelationshipRecord;
    mode: PersonRelationshipMode;
    relatedPerson: PersonRecord | null;
    title: string;
    subtitle: string;
  }>;
  relationshipPage: number;
  totalRelationshipPages: number;
  setRelationshipPage: React.Dispatch<React.SetStateAction<number>>;
  onOpenHelperDialog: () => void;
  onAddRelationship: () => void;
  onEditRelationship: (relationship: RelationshipRecord) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Reveal delay={110}>
    <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <View style={styles.titleWithHelperRow}>
            <Text variant="titleLarge">{t(K.personProfile.relationships)}</Text>
            <IconButton
              icon="information-outline"
              size={20}
              style={styles.helperIconButton}
              onPress={onOpenHelperDialog}
              accessibilityLabel={t(K.personProfile.aboutRelationships)}
            />
          </View>
        </View>
        {canEdit ? (
          <Button mode="contained" icon="family-tree" onPress={onAddRelationship}>
            Connect family
          </Button>
        ) : null}
      </View>
      <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
        Follow the people closest to {formatPersonName(person)} and discover how each branch meets the next.
      </Text>

      <HorizontalTabStrip
        items={[
          { key: 'insight', label: t(K.personProfile.howRelated) },
          { key: 'list', label: t('All relationships') },
        ]}
        activeKey={relationshipSectionTab}
        onChange={(value) => setRelationshipSectionTab(value as PersonRelationshipSectionTabKey)}
        containerStyle={[styles.tabStripCard, styles.relationshipTabStripCard, { backgroundColor: theme.colors.surface }]}
        contentContainerStyle={styles.tabStripContent}
        itemStyle={styles.tabStripItem}
      />

      {relationshipSectionTab === 'insight' ? (
        <RelationshipInsightCard
          people={people}
          relationships={relationships}
          lockedFromPersonId={person.id}
          title={t(K.personProfile.howDoesPersonRelate, { name: formatPersonName(person) })}
        />
      ) : paginatedRelationships.length > 0 ? (
        <>
          <View style={styles.relationshipList}>
            {paginatedRelationships.map((entry, index) => (
              <Reveal key={entry.relationship.id} delay={140 + index * 35}>
              <View style={[styles.relationshipCard, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.relationshipRow}>
                  <View style={styles.relationshipTextWrap}>
                    <Chip compact style={styles.relationshipChip}>
                      {entry.mode === 'parent-of' ? t(K.relationship.parentOf) : entry.mode === 'child-of' ? t(K.relationship.childOf) : t(K.relationship.spouseOf)}
                    </Chip>
                    <Text variant="titleMedium" style={styles.relationshipTitle}>{formatPersonName(entry.relatedPerson)}</Text>
                    <Text variant="bodySmall" style={[styles.relationshipSubtitle, { color: theme.colors.onSurfaceVariant }]}>{entry.subtitle}</Text>
                  </View>
                  {canEdit ? (
                    <View style={styles.rowActions}>
                      <IconButton icon="pencil" onPress={() => onEditRelationship(entry.relationship)} disabled={mutating} />
                    </View>
                  ) : null}
                </View>
              </View>
              </Reveal>
            ))}
          </View>

          {totalRelationshipPages > 1 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <IconButton icon="chevron-left" onPress={() => setRelationshipPage((p) => Math.max(1, p - 1))} disabled={relationshipPage === 1} />
              <Text variant="bodyMedium">{relationshipPage} / {totalRelationshipPages}</Text>
              <IconButton icon="chevron-right" onPress={() => setRelationshipPage((p) => Math.min(totalRelationshipPages, p + 1))} disabled={relationshipPage === totalRelationshipPages} />
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text variant="titleMedium">{t(K.personProfile.noRelationshipsYet)}</Text>
          <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
            Start by connecting a parent, child, or partner so this story can branch outward from {formatPersonName(person)}.
          </Text>
        </View>
      )}
    </Surface>
    </Reveal>
  );
}
