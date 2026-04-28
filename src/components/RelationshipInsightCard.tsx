import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Chip, Text, useTheme } from 'react-native-paper';
import type { PersonRecord } from '../types/person';
import type { RelationshipRecord } from '../types/relationship';
import { computeRelationshipInsight } from '../services';
import { GlobalStyles } from '../styles/global-styles';

const styles = GlobalStyles.relationshipInsightCard;

interface RelationshipInsightCardProps {
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  lockedFromPersonId?: string;
  title?: string;
  subtitle?: string;
}

function formatPersonName(person?: PersonRecord | null) {
  if (!person) {
    return 'Unknown family member';
  }

  return `${person.firstName} ${person.lastName}`.trim();
}

export default function RelationshipInsightCard({
  people,
  relationships,
  lockedFromPersonId,
  title = 'Relationship intelligence',
  subtitle,
}: RelationshipInsightCardProps) {
  const theme = useTheme();
  const [fromPersonId, setFromPersonId] = useState(lockedFromPersonId ?? '');
  const [toPersonId, setToPersonId] = useState('');

  const effectiveSubtitle = subtitle ?? (lockedFromPersonId
    ? 'See how this family member is connected to everyone else in the tree.'
    : 'Select two family members to compute their relationship and show the connection path.');

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const fromCandidates = useMemo(
    () => (lockedFromPersonId ? people.filter((person) => person.id === lockedFromPersonId) : people),
    [lockedFromPersonId, people],
  );

  const toCandidates = useMemo(
    () => people.filter((person) => person.id !== (lockedFromPersonId || fromPersonId)),
    [fromPersonId, lockedFromPersonId, people],
  );

  React.useEffect(() => {
    if (lockedFromPersonId) {
      setFromPersonId(lockedFromPersonId);
    }
  }, [lockedFromPersonId]);

  React.useEffect(() => {
    if (toPersonId && !toCandidates.some((person) => person.id === toPersonId)) {
      setToPersonId('');
    }
  }, [toCandidates, toPersonId]);

  const insight = useMemo(() => {
    if (!fromPersonId || !toPersonId) {
      return null;
    }

    return computeRelationshipInsight(people, relationships, fromPersonId, toPersonId);
  }, [fromPersonId, people, relationships, toPersonId]);

  const pathLabel = insight
    ? insight.pathPersonIds
      .map((personId) => formatPersonName(peopleById.get(personId)))
      .join(' → ')
    : null;

  return (
    <Card mode="outlined" style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      <Card.Content>
        <Text variant="titleMedium">{title}</Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          {effectiveSubtitle}
        </Text>

        {!lockedFromPersonId ? (
          <View style={styles.section}>
            <Text variant="titleSmall">Family member A</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {fromCandidates.map((person) => (
                <Chip
                  key={`from-${person.id}`}
                  selected={fromPersonId === person.id}
                  onPress={() => setFromPersonId(person.id)}
                  style={styles.chip}
                >
                  {formatPersonName(person)}
                </Chip>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.section}>
            <Text variant="titleSmall">Selected family member</Text>
            <View style={styles.lockedPersonRow}>
              <Chip selected style={styles.chip}>{formatPersonName(peopleById.get(fromPersonId))}</Chip>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text variant="titleSmall">Compare with</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {toCandidates.map((person) => (
              <Chip
                key={`to-${person.id}`}
                selected={toPersonId === person.id}
                onPress={() => setToPersonId(person.id)}
                style={styles.chip}
              >
                {formatPersonName(person)}
              </Chip>
            ))}
          </ScrollView>
        </View>

        <View style={styles.actionsRow}>
          <Button onPress={() => {
            if (!lockedFromPersonId) {
              setFromPersonId('');
            }
            setToPersonId('');
          }}>
            Clear
          </Button>
        </View>

        {fromPersonId && toPersonId ? (
          insight ? (
            <View style={[styles.resultBox, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="titleMedium">Relationship: {insight.relationship}</Text>
              <Text variant="bodyMedium" style={[styles.pathText, { color: theme.colors.onSurfaceVariant }]}>Path: {pathLabel}</Text>
            </View>
          ) : (
            <View style={[styles.resultBox, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="titleMedium">No direct family relationship found</Text>
              <Text variant="bodyMedium" style={[styles.pathText, { color: theme.colors.onSurfaceVariant }]}>
                No result returned because these two family members are currently unrelated in this tree.
              </Text>
            </View>
          )
        ) : null}
      </Card.Content>
    </Card>
  );
}


