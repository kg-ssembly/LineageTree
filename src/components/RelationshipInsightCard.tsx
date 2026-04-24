import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text, useTheme } from 'react-native-paper';
import type { PersonRecord } from '../types/person';
import type { RelationshipRecord } from '../types/relationship';
import { computeRelationshipInsight } from '../services';

interface RelationshipInsightCardProps {
  people: PersonRecord[];
  relationships: RelationshipRecord[];
}

function formatPersonName(person?: PersonRecord | null) {
  if (!person) {
    return 'Unknown person';
  }

  return `${person.firstName} ${person.lastName}`.trim();
}

export default function RelationshipInsightCard({ people, relationships }: RelationshipInsightCardProps) {
  const theme = useTheme();
  const [fromPersonId, setFromPersonId] = useState('');
  const [toPersonId, setToPersonId] = useState('');

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

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
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Select two people to compute their relationship and show the connection path.
        </Text>

        <View style={styles.section}>
          <Text variant="titleSmall">Person A</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {people.map((person) => (
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

        <View style={styles.section}>
          <Text variant="titleSmall">Person B</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {people.map((person) => (
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
          <Button onPress={() => { setFromPersonId(''); setToPersonId(''); }}>Clear</Button>
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
                No result returned because these two people are currently unrelated in this tree.
              </Text>
            </View>
          )
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
  },
  subtitle: {
    marginTop: 6,
    color: '#6B6B74',
  },
  section: {
    marginTop: 16,
  },
  chipRow: {
    paddingTop: 8,
    paddingRight: 8,
  },
  chip: {
    marginRight: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  resultBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F3F0FF',
  },
  pathText: {
    marginTop: 8,
    color: '#4E4E58',
  },
});

