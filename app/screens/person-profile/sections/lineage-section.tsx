import React from 'react';
import { View } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { FamilyTreeCanvas, GlobalStyles, Reveal, SectionCard } from '../../../../components';
import type { PersonRecord } from '../../../../components/dto/person';
import type { RelationshipRecord } from '../../../../components/dto/relationship';
import { getFamilyMemberCardStyle } from '../../profile-shared/profile-card-shared';

const styles = GlobalStyles.personProfile;

export function PersonLineageSection({
  title,
  helperLabel,
  count,
  person,
  people,
  relationships,
  currentAssignedPersonId,
  onOpenHelperDialog,
  onPressPerson,
  mode,
}: {
  title: string;
  helperLabel: string;
  count: number;
  person: PersonRecord;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  currentAssignedPersonId?: string;
  onOpenHelperDialog: () => void;
  onPressPerson: (person: PersonRecord) => void;
  mode: 'ascendant' | 'descendant';
}) {
  const theme = useTheme();
  return (
    <Reveal delay={120}>
      <SectionCard variant="person" style={getFamilyMemberCardStyle(theme)}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <View style={styles.titleWithHelperRow}>
            <Text variant="titleLarge">{title}</Text>
            <IconButton
              icon="information-outline"
              size={20}
              style={styles.helperIconButton}
              onPress={onOpenHelperDialog}
              accessibilityLabel={helperLabel}
            />
          </View>
          {count > 0 ? (
            <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {count}
            </Text>
          ) : null}
        </View>
      </View>
      <FamilyTreeCanvas
        people={people}
        relationships={relationships}
        onPressPerson={onPressPerson}
        currentUserPersonId={currentAssignedPersonId}
        highlightedPersonId={person.id}
        initialFocusPersonId={person.id}
        descendantRootPersonId={mode === 'descendant' ? person.id : undefined}
        ascendantRootPersonId={mode === 'ascendant' ? person.id : undefined}
        showMaidenFamilyInNodeTitle
        floatingControls
      />
      </SectionCard>
    </Reveal>
  );
}
