import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Divider, Text, TextInput, useTheme } from 'react-native-paper';
import type { PersonRecord } from './dto/person';
import type { RelationshipRecord } from './dto/relationship';
import { computeRelationshipInsight } from '../providers';
import { GlobalStyles } from '../constants/styles';

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

function getPathRelationLabel(relation: 'parent' | 'child' | 'spouse') {
  switch (relation) {
    case 'parent':
      return 'parent';
    case 'child':
      return 'child';
    default:
      return 'spouse';
  }
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
  const [fromSearchQuery, setFromSearchQuery] = useState('');
  const [toSearchQuery, setToSearchQuery] = useState('');
  const [showPathDetails, setShowPathDetails] = useState(false);

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

  const filteredFromCandidates = useMemo(() => {
    const query = fromSearchQuery.trim().toLowerCase();
    const candidates = query
      ? fromCandidates.filter((person) => formatPersonName(person).toLowerCase().includes(query))
      : fromCandidates;

    return candidates.slice(0, query ? 12 : 8);
  }, [fromCandidates, fromSearchQuery]);

  const filteredToCandidates = useMemo(() => {
    const query = toSearchQuery.trim().toLowerCase();
    const candidates = query
      ? toCandidates.filter((person) => formatPersonName(person).toLowerCase().includes(query))
      : toCandidates;

    return candidates.slice(0, query ? 12 : 8);
  }, [toCandidates, toSearchQuery]);

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

  React.useEffect(() => {
    setShowPathDetails(false);
  }, [fromPersonId, toPersonId]);

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

  const fromPerson = peopleById.get(fromPersonId) ?? null;
  const toPerson = peopleById.get(toPersonId) ?? null;
  const canShowInsight = Boolean(fromPersonId && toPersonId);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Text variant="titleMedium">{title}</Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          {effectiveSubtitle}
        </Text>

        {!lockedFromPersonId ? (
          <View style={styles.section}>
            <Text variant="titleSmall">1. Who are we starting with?</Text>
            <TextInput
              mode="outlined"
              label="Search first family member"
              value={fromSearchQuery}
              onChangeText={setFromSearchQuery}
              style={{ marginTop: 12 }}
              left={<TextInput.Icon icon="magnify" />}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { paddingTop: 12 }]}>
              {filteredFromCandidates.map((person) => (
                <Chip
                  key={`from-${person.id}`}
                  selected={fromPersonId === person.id}
                  onPress={() => {
                    setFromPersonId(person.id);
                    setFromSearchQuery('');
                  }}
                  style={styles.chip}
                >
                  {formatPersonName(person)}
                </Chip>
              ))}
            </ScrollView>
            {!fromPersonId ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                Start by choosing one person.
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.section}>
            <Text variant="titleSmall">1. Selected family member</Text>
            <View style={styles.lockedPersonRow}>
              <Chip selected style={styles.chip}>{formatPersonName(peopleById.get(fromPersonId))}</Chip>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text variant="titleSmall">2. Who do you want to compare with?</Text>
          <TextInput
            mode="outlined"
            label="Search second family member"
            value={toSearchQuery}
            onChangeText={setToSearchQuery}
            style={{ marginTop: 12 }}
            left={<TextInput.Icon icon="magnify" />}
            disabled={!fromPersonId}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { paddingTop: 12 }]}>
            {filteredToCandidates.map((person) => (
              <Chip
                key={`to-${person.id}`}
                selected={toPersonId === person.id}
                onPress={() => {
                  setToPersonId(person.id);
                  setToSearchQuery('');
                }}
                style={styles.chip}
                disabled={!fromPersonId}
              >
                {formatPersonName(person)}
              </Chip>
            ))}
          </ScrollView>
          {fromPersonId && !toPersonId ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
              Pick the second person and we’ll explain the relationship in plain language.
            </Text>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          {!lockedFromPersonId ? (
            <Button
              onPress={() => {
                const nextFrom = toPersonId;
                const nextTo = fromPersonId;
                setFromPersonId(nextFrom);
                setToPersonId(nextTo);
              }}
              disabled={!fromPersonId || !toPersonId}
            >
              Swap
            </Button>
          ) : null}
          <Button onPress={() => {
            if (!lockedFromPersonId) {
              setFromPersonId('');
            }
            setToPersonId('');
            setFromSearchQuery('');
            setToSearchQuery('');
            setShowPathDetails(false);
          }}>
            Clear
          </Button>
        </View>

        {!canShowInsight ? (
          <View style={[styles.resultBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text variant="titleMedium">Choose two family members</Text>
            <Text variant="bodyMedium" style={[styles.pathText, { color: theme.colors.onSurfaceVariant }]}>
              We’ll show a simple answer first, then you can open the full connection path only if you want more detail.
            </Text>
          </View>
        ) : (
          insight ? (
            <View style={[styles.resultBox, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="titleMedium">{formatPersonName(toPerson)} is {formatPersonName(fromPerson)}’s {insight.relationship.toLowerCase()}</Text>
              <Text variant="bodyMedium" style={[styles.pathText, { color: theme.colors.onSurfaceVariant }]}>
                We found a family connection between these two people.
              </Text>
              <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Chip compact icon="account">{formatPersonName(fromPerson)}</Chip>
                <Chip compact icon="arrow-right">{insight.relationship}</Chip>
                <Chip compact icon="account">{formatPersonName(toPerson)}</Chip>
              </View>
              <Button mode="text" onPress={() => setShowPathDetails((current) => !current)} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                {showPathDetails ? 'Hide connection steps' : 'Show connection steps'}
              </Button>
              {showPathDetails ? (
                <View style={{ marginTop: 8 }}>
                  <Divider style={{ marginBottom: 12 }} />
                  {insight.pathPersonIds.map((personId, index) => {
                    const currentPerson = peopleById.get(personId);
                    const relation = insight.pathRelations[index];
                    return (
                      <View key={`${personId}-${index}`} style={{ marginBottom: 10 }}>
                        <Text variant="titleSmall">{index + 1}. {formatPersonName(currentPerson)}</Text>
                        {relation ? (
                          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                            Next step goes through a {getPathRelationLabel(relation)} relationship.
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                    Full path: {pathLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.resultBox, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="titleMedium">No direct family relationship found</Text>
              <Text variant="bodyMedium" style={[styles.pathText, { color: theme.colors.onSurfaceVariant }]}>
                No result returned because these two family members are currently unrelated in this tree.
              </Text>
            </View>
          )
        )}
    </View>
  );
}
