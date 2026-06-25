import React from 'react';
import { View } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { FamilyTreeCanvas } from '../../../../components';
import type { PersonRecord } from '../../../../components/dto/person';
import type { RelationshipRecord } from '../../../../components/dto/relationship';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';

const personProfileStyles = GlobalStyles.personProfile;

export function LineageSection({
  title,
  count,
  countSingular,
  countPlural,
  linkedPerson,
  people,
  relationships,
  onPressPerson,
  mode,
}: {
  title: string;
  count: number;
  countSingular: string;
  countPlural: string;
  linkedPerson: PersonRecord;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  onPressPerson: (person: PersonRecord) => void;
  mode: 'ascendants' | 'descendants';
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={personProfileStyles.sectionHeader}>
        <View style={personProfileStyles.sectionHeaderText}>
          <Text variant="titleLarge">{title}</Text>
          {count > 0 ? (
            <Text variant="bodySmall" style={[personProfileStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {count} {count === 1 ? t(countSingular) : t(countPlural)}
            </Text>
          ) : null}
        </View>
      </View>
      <FamilyTreeCanvas
        people={people}
        relationships={relationships}
        onPressPerson={onPressPerson}
        currentUserPersonId={linkedPerson.id}
        highlightedPersonId={linkedPerson.id}
        initialFocusPersonId={linkedPerson.id}
        descendantRootPersonId={mode === 'descendants' ? linkedPerson.id : undefined}
        ascendantRootPersonId={mode === 'ascendants' ? linkedPerson.id : undefined}
        showMaidenFamilyInNodeTitle
      />
    </Surface>
  );
}
