import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Chip, Dialog, Divider, IconButton, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { getPersonLifeSpanLabel, type PersonRecord } from './dto/person';
import type { RelationshipRecord } from './dto/relationship';
import { useI18n } from '../hooks/use-i18n';
import { computeRelationshipInsight } from '../providers';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.relationshipInsightCard;
const dialogChrome = GlobalStyles.dialogChrome;
const PICKER_PAGE_SIZE = 5;

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
  const [showPathDetails, setShowPathDetails] = useState(false);
  const [pickerMode, setPickerMode] = useState<'from' | 'to' | null>(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [pickerPage, setPickerPage] = useState(1);

  const effectiveSubtitle = subtitle ?? '';

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const toCandidates = useMemo(
    () => people.filter((person) => person.id !== (lockedFromPersonId || fromPersonId)),
    [fromPersonId, lockedFromPersonId, people],
  );

  const fromCandidates = useMemo(
    () => people,
    [people],
  );

  const pickerCandidates = useMemo(
    () => (pickerMode === 'from' ? fromCandidates : toCandidates),
    [fromCandidates, pickerMode, toCandidates],
  );

  const filteredPickerCandidates = useMemo(() => {
    const query = pickerSearchQuery.trim().toLowerCase();
    return query
      ? pickerCandidates.filter((person) => formatPersonName(person).toLowerCase().includes(query))
      : pickerCandidates;
  }, [pickerCandidates, pickerSearchQuery]);

  const totalPickerPages = Math.max(1, Math.ceil(filteredPickerCandidates.length / PICKER_PAGE_SIZE));
  const paginatedPickerCandidates = useMemo(() => {
    const start = (pickerPage - 1) * PICKER_PAGE_SIZE;
    return filteredPickerCandidates.slice(start, start + PICKER_PAGE_SIZE);
  }, [filteredPickerCandidates, pickerPage]);

  useEffect(() => {
    if (lockedFromPersonId) {
      setFromPersonId(lockedFromPersonId);
    }
  }, [lockedFromPersonId]);

  useEffect(() => {
    if (toPersonId && !toCandidates.some((person) => person.id === toPersonId)) {
      setToPersonId('');
    }
  }, [toCandidates, toPersonId]);

  useEffect(() => {
    setShowPathDetails(false);
  }, [fromPersonId, toPersonId]);

  useEffect(() => {
    setPickerPage(1);
  }, [pickerMode, pickerSearchQuery]);

  useEffect(() => {
    if (pickerPage > totalPickerPages) {
      setPickerPage(totalPickerPages);
    }
  }, [pickerPage, totalPickerPages]);

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
  const canResetSelection = Boolean(toPersonId || (!lockedFromPersonId && fromPersonId));

  const openPicker = (mode: 'from' | 'to') => {
    setPickerMode(mode);
    setPickerSearchQuery('');
    setPickerPage(1);
  };

  const closePicker = () => {
    setPickerMode(null);
    setPickerSearchQuery('');
    setPickerPage(1);
  };

  const handleSelectPerson = (personId: string) => {
    if (pickerMode === 'from') {
      setFromPersonId(personId);
      if (personId === toPersonId) {
        setToPersonId('');
      }
    } else if (pickerMode === 'to') {
      setToPersonId(personId);
    }

    closePicker();
  };

  return (
    <>
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Text variant="titleMedium">{title}</Text>
        {effectiveSubtitle ? (
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            {effectiveSubtitle}
          </Text>
        ) : null}

        {!lockedFromPersonId ? (
          <View style={styles.section}>
            <Button mode="outlined" icon="account-search" onPress={() => openPicker('from')}>
              {fromPerson ? formatPersonName(fromPerson) : t('Select family member')}
            </Button>
          </View>
        ) : null}

        <View style={styles.section}>
          <Button
            mode="contained-tonal"
            icon="account-search"
            onPress={() => openPicker('to')}
            disabled={!fromPersonId}
          >
            {toPerson ? formatPersonName(toPerson) : t('Select family member')}
          </Button>
        </View>

        <View style={styles.actionsRow}>
          {!lockedFromPersonId ? (
            <IconButton
              icon="swap-horizontal"
              mode="contained-tonal"
              onPress={() => {
                const nextFrom = toPersonId;
                const nextTo = fromPersonId;
                setFromPersonId(nextFrom);
                setToPersonId(nextTo);
              }}
              disabled={!fromPersonId || !toPersonId}
              accessibilityLabel={t('Swap')}
            />
          ) : null}
          {canResetSelection ? (
            <IconButton
              icon="restart"
              mode="contained-tonal"
              onPress={() => {
                if (!lockedFromPersonId) {
                  setFromPersonId('');
                }
                setToPersonId('');
                setShowPathDetails(false);
              }}
              accessibilityLabel={t('Reset')}
            />
          ) : null}
        </View>

        {!canShowInsight ? (
          <View style={[styles.resultBox, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text variant="bodyMedium" style={[styles.pathText, { color: theme.colors.onSurfaceVariant }]}>
              {t('Select a family member to see the relationship.')}
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
      <Portal>
        <Dialog
          visible={pickerMode !== null}
          onDismiss={closePicker}
          style={[dialogChrome.dialog, styles.pickerDialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose, styles.pickerDialogTitle]}>
            {t('Select family member')}
          </Dialog.Title>
          <IconButton
            icon="close"
            size={20}
            onPress={closePicker}
            style={[dialogChrome.closeButton, styles.pickerCloseButton]}
            accessibilityLabel={t('Close')}
          />
          <Dialog.ScrollArea style={dialogChrome.scrollArea}>
            <View>
            <TextInput
              mode="outlined"
              label={t('Search family member')}
              value={pickerSearchQuery}
              onChangeText={setPickerSearchQuery}
              style={styles.searchInput}
              left={<TextInput.Icon icon="magnify" />}
            />
            {paginatedPickerCandidates.length > 0 ? (
              <View style={styles.resultsList}>
                {paginatedPickerCandidates.map((person, index) => (
                  <Pressable
                    key={`${pickerMode}-${person.id}`}
                    onPress={() => handleSelectPerson(person.id)}
                    style={[
                      styles.resultRow,
                      index > 0 ? styles.resultRowDivider : null,
                    ]}
                  >
                    <Text variant="titleSmall" style={styles.resultRowTitle}>{formatPersonName(person)}</Text>
                    <Text variant="bodySmall" style={styles.resultRowMeta}>
                      {formatPersonMeta(person) === 'No dates recorded yet' ? t('No dates recorded yet') : formatPersonMeta(person)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text variant="bodyMedium">{t('No matching family members found.')}</Text>
              </View>
            )}

            {filteredPickerCandidates.length > 0 ? (
              <View style={styles.paginationRow}>
                <IconButton
                  icon="chevron-left"
                  onPress={() => setPickerPage((page) => Math.max(1, page - 1))}
                  disabled={pickerPage === 1}
                  accessibilityLabel={t('Previous')}
                />
                <Text variant="bodySmall" style={styles.paginationLabel}>
                  {pickerPage} / {totalPickerPages}
                </Text>
                <IconButton
                  icon="chevron-right"
                  onPress={() => setPickerPage((page) => Math.min(totalPickerPages, page + 1))}
                  disabled={pickerPage === totalPickerPages}
                  accessibilityLabel={t('Next')}
                />
              </View>
            ) : null}
            </View>
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>
    </>
  );
}
