import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Chip, Divider, Text, TextInput, useTheme } from 'react-native-paper';
import { getPersonLifeSpanLabel, type PersonRecord } from './dto/person';
import type { RelationshipRecord } from './dto/relationship';
import { useI18n } from '../hooks/use-i18n';
import { computeRelationshipInsight } from '../providers';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.relationshipInsightCard;
const MAX_VISIBLE_RESULTS = 3;

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

  return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim();
}

function formatPersonMeta(person: PersonRecord) {
  const lifespan = getPersonLifeSpanLabel(person);
  return lifespan === 'Unknown lifespan' ? 'No dates recorded yet' : lifespan;
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
  const { t } = useI18n();
  const [fromPersonId, setFromPersonId] = useState(lockedFromPersonId ?? '');
  const [toPersonId, setToPersonId] = useState('');
  const [fromSearchQuery, setFromSearchQuery] = useState('');
  const [toSearchQuery, setToSearchQuery] = useState('');
  const [showPathDetails, setShowPathDetails] = useState(false);

  const effectiveSubtitle = subtitle ?? (lockedFromPersonId
    ? t('See how this family member is connected to everyone else in the tree.')
    : t('Select two family members to compute their relationship and show the connection path.'));

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

    return candidates.slice(0, MAX_VISIBLE_RESULTS);
  }, [fromCandidates, fromSearchQuery]);

  const filteredToCandidates = useMemo(() => {
    const query = toSearchQuery.trim().toLowerCase();
    const candidates = query
      ? toCandidates.filter((person) => formatPersonName(person).toLowerCase().includes(query))
      : toCandidates;

    return candidates.slice(0, MAX_VISIBLE_RESULTS);
  }, [toCandidates, toSearchQuery]);

  const totalFromMatches = useMemo(() => {
    const query = fromSearchQuery.trim().toLowerCase();
    return (query
      ? fromCandidates.filter((person) => formatPersonName(person).toLowerCase().includes(query))
      : fromCandidates).length;
  }, [fromCandidates, fromSearchQuery]);

  const totalToMatches = useMemo(() => {
    const query = toSearchQuery.trim().toLowerCase();
    return (query
      ? toCandidates.filter((person) => formatPersonName(person).toLowerCase().includes(query))
      : toCandidates).length;
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
  const pathRelationLabel = insight
    ? insight.pathRelations.map((relation) => getPathRelationLabel(relation)).join(' → ')
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
            <Text variant="titleSmall">{t('1. Who are we starting with?')}</Text>
            <TextInput
              mode="outlined"
              label={t('Search first family member')}
              value={fromSearchQuery}
              onChangeText={setFromSearchQuery}
              style={styles.searchInput}
              left={<TextInput.Icon icon="magnify" />}
            />
            {filteredFromCandidates.length > 0 ? (
              <View style={styles.resultsList}>
                {filteredFromCandidates.map((person, index) => (
                  <Pressable
                    key={`from-${person.id}`}
                    onPress={() => {
                      setFromPersonId(person.id);
                      setFromSearchQuery('');
                    }}
                    style={[
                      styles.resultRow,
                      fromPersonId === person.id ? styles.resultRowSelected : null,
                      index > 0 ? styles.resultRowDivider : null,
                    ]}
                  >
                    <Text variant="titleSmall" style={styles.resultRowTitle}>{formatPersonName(person)}</Text>
                    <Text variant="bodySmall" style={styles.resultRowMeta}>{formatPersonMeta(person)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text variant="bodyMedium">{t('No matching family members found.')}</Text>
              </View>
            )}
            {totalFromMatches > MAX_VISIBLE_RESULTS ? (
              <Text variant="bodySmall" style={styles.pathText}>
                {t('Showing the first 3 matches. Add more letters to narrow the results.')}
              </Text>
            ) : null}
            {!fromPersonId ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                {t('Start by choosing one person.')}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.section}>
            <Text variant="titleSmall">{t('1. Selected family member')}</Text>
            <View style={styles.lockedPersonRow}>
              <Chip selected style={styles.chip}>{formatPersonName(peopleById.get(fromPersonId))}</Chip>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text variant="titleSmall">{t('2. Who do you want to compare with?')}</Text>
          <TextInput
            mode="outlined"
            label={t('Search second family member')}
            value={toSearchQuery}
            onChangeText={setToSearchQuery}
            style={styles.searchInput}
            left={<TextInput.Icon icon="magnify" />}
            disabled={!fromPersonId}
          />
          {filteredToCandidates.length > 0 ? (
            <View style={styles.resultsList}>
              {filteredToCandidates.map((person, index) => (
                <Pressable
                  key={`to-${person.id}`}
                  onPress={() => {
                    setToPersonId(person.id);
                    setToSearchQuery('');
                  }}
                  style={[
                    styles.resultRow,
                    toPersonId === person.id ? styles.resultRowSelected : null,
                    index > 0 ? styles.resultRowDivider : null,
                  ]}
                  disabled={!fromPersonId}
                >
                  <Text variant="titleSmall" style={styles.resultRowTitle}>{formatPersonName(person)}</Text>
                  <Text variant="bodySmall" style={styles.resultRowMeta}>{formatPersonMeta(person)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text variant="bodyMedium">{t('No matching family members found.')}</Text>
            </View>
          )}
          {totalToMatches > MAX_VISIBLE_RESULTS ? (
            <Text variant="bodySmall" style={styles.pathText}>
              {t('Showing the first 3 matches. Add more letters to narrow the results.')}
            </Text>
          ) : null}
          {fromPersonId && !toPersonId ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
              {t('Pick the second person and we’ll explain the relationship in plain language.')}
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
              {t('Swap')}
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
            {t('Clear')}
          </Button>
        </View>

        {!canShowInsight ? (
          <View style={[styles.resultBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text variant="titleMedium">{t('Choose two family members')}</Text>
            <Text variant="bodyMedium" style={[styles.pathText, { color: theme.colors.onSurfaceVariant }]}>
              {t('We’ll show a simple answer first, then you can open the full connection path only if you want more detail.')}
            </Text>
          </View>
        ) : (
          insight ? (
            <View style={[styles.resultBox, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="titleMedium">{formatPersonName(toPerson)} is {formatPersonName(fromPerson)}’s {insight.relationship.toLowerCase()}</Text>
              <Text variant="bodyMedium" style={[styles.pathText, { color: theme.colors.onSurfaceVariant }]}>
                We found a family connection and can show both the plain-language answer and the exact path through the tree.
              </Text>
              <View style={styles.summaryRow}>
                <Chip compact icon="account">{formatPersonName(fromPerson)}</Chip>
                <Chip compact icon="arrow-right">{insight.relationship}</Chip>
                <Chip compact icon="account">{formatPersonName(toPerson)}</Chip>
                <Chip compact icon="source-branch">{Math.max(insight.pathPersonIds.length - 1, 0)} steps</Chip>
              </View>
              <Button mode="text" onPress={() => setShowPathDetails((current) => !current)} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                {showPathDetails ? t('Hide connection steps') : t('Show connection steps')}
              </Button>
              {showPathDetails ? (
                <View style={{ marginTop: 8 }}>
                  <Divider style={{ marginBottom: 12 }} />
                  {insight.pathPersonIds.map((personId, index) => {
                    const currentPerson = peopleById.get(personId);
                    const relation = insight.pathRelations[index];
                    return (
                      <View key={`${personId}-${index}`} style={styles.pathStepCard}>
                        <Text variant="titleSmall">{index + 1}. {formatPersonName(currentPerson)}</Text>
                        {relation ? (
                          <Text variant="bodySmall" style={styles.stepMeta}>
                            Next step goes through a {getPathRelationLabel(relation)} relationship.
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                    Full path: {pathLabel}
                  </Text>
                  {pathRelationLabel ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                      Path types: {pathRelationLabel}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.resultBox, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="titleMedium">{t('No direct family relationship found')}</Text>
              <Text variant="bodyMedium" style={[styles.pathText, { color: theme.colors.onSurfaceVariant }]}>
                {t('No result returned because these two family members are currently unrelated in this tree.')}
              </Text>
            </View>
          )
        )}
    </View>
  );
}
