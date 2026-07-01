import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Dialog, IconButton, Portal, Surface, Text, useTheme } from 'react-native-paper';
import { HorizontalTabStrip, RelationshipInsightCard, Reveal } from '../../../../components';
import type { PersonRecord } from '../../../../components/dto/person';
import type { RelationshipRecord } from '../../../../components/dto/relationship';
import { formatPersonName } from '../../../../components/person-formatting';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const personProfileStyles = GlobalStyles.personProfile;
const dialogChrome = GlobalStyles.dialogChrome;

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
  const [helperVisible, setHelperVisible] = useState(false);

  return (
    <Reveal delay={110}>
    <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={personProfileStyles.sectionHeader}>
        <View style={personProfileStyles.sectionHeaderText}>
          <View style={personProfileStyles.titleWithHelperRow}>
            <Text variant="titleLarge">{t(K.personProfile.relationships)}</Text>
            <IconButton
              icon="information-outline"
              size={20}
              style={personProfileStyles.helperIconButton}
              onPress={() => setHelperVisible(true)}
              accessibilityLabel={t(K.personProfile.aboutRelationships)}
            />
          </View>
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
          { key: 'list', label: t(K.personProfile.allRelationships) },
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
    <Portal>
      <Dialog visible={helperVisible} onDismiss={() => setHelperVisible(false)} style={[dialogChrome.helperDialog, { backgroundColor: theme.colors.surface }]}>
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
          {t(K.personProfile.relationships)}
        </Dialog.Title>
        <IconButton icon="close" size={20} onPress={() => setHelperVisible(false)} style={dialogChrome.closeButton} accessibilityLabel={t(K.common.close)} />
        <Dialog.Content>
          <Text variant="bodyMedium">{t(K.personProfile.relationshipActionsSummary)}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setHelperVisible(false)}>{t(K.common.close)}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
    </Reveal>
  );
}
