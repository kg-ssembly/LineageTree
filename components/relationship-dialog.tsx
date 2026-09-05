import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, IconButton, Portal, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { getPersonLifeSpanLabel, type PersonRecord } from './dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, RelationshipType, SpouseRelationshipStatus } from './dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from './dto/relationship';
import { getRelationshipValidationFeedback, getRelationshipValidationResolution } from './family-tree-validation';
import { useI18n } from '../hooks/use-i18n';
import { translate } from '../i18n';
import { I18N_KEYS as K } from '../i18n/keys';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.relationshipDialog;
const dialogChrome = GlobalStyles.dialogChrome;
const MAX_VISIBLE_RESULTS = 3;

interface RelationshipDialogProps {
  visible: boolean;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  loading?: boolean;
  onDismiss: () => void;
  onSubmit: (payload: {
    type: RelationshipType;
    fromPersonId: string;
    toPersonId: string;
    relationshipStatus?: SpouseRelationshipStatus;
    parentChildKind?: ParentChildRelationshipKind;
  }) => void | Promise<void>;
}

function formatPersonName(person: PersonRecord) {
  return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim();
}

function formatPersonMeta(person: PersonRecord) {
  const lifespan = getPersonLifeSpanLabel(person);
  return lifespan === translate(K.personProfile.unknownLifespan) ? translate(K.common.unknown) : lifespan;
}

export default function RelationshipDialog({
  visible,
  people,
  relationships,
  loading = false,
  onDismiss,
  onSubmit,
}: RelationshipDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [type, setType] = useState<RelationshipType>('parent-child');
  const [fromPersonId, setFromPersonId] = useState('');
  const [toPersonId, setToPersonId] = useState('');
  const [fromSearch, setFromSearch] = useState('');
  const [toSearch, setToSearch] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState<SpouseRelationshipStatus>(DEFAULT_SPOUSE_RELATIONSHIP_STATUS);
  const [parentChildKind, setParentChildKind] = useState<ParentChildRelationshipKind>(DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND);
  const [error, setError] = useState<string | null>(null);
  const [blockingValidationMessage, setBlockingValidationMessage] = useState<string | null>(null);
  const [reviewWarnings, setReviewWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setType('parent-child');
    setFromPersonId('');
    setToPersonId('');
    setFromSearch('');
    setToSearch('');
    setRelationshipStatus(DEFAULT_SPOUSE_RELATIONSHIP_STATUS);
    setParentChildKind(DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND);
    setError(null);
  }, [visible]);

  const validationResolution = useMemo(
    () => getRelationshipValidationResolution({
      people,
      relationships,
      type,
      fromPersonId,
      toPersonId,
      parentChildKind: type === 'parent-child' ? parentChildKind : undefined,
      relationshipStatus: type === 'spouse' ? relationshipStatus : undefined,
    }),
    [fromPersonId, parentChildKind, people, relationshipStatus, relationships, toPersonId, type],
  );
  const validationMessage = validationResolution.blockingErrors[0] ?? null;
  const validationWarnings = useMemo(
    () => getRelationshipValidationFeedback({
      people,
      relationships,
      type,
      fromPersonId,
      toPersonId,
      parentChildKind: type === 'parent-child' ? parentChildKind : undefined,
      relationshipStatus: type === 'spouse' ? relationshipStatus : undefined,
    }).warnings,
    [fromPersonId, parentChildKind, people, relationshipStatus, relationships, toPersonId, type],
  );
  const liveReviewMessages = useMemo(
    () => [...new Set([...(validationResolution.blockingErrors ?? []), ...validationWarnings].filter(Boolean))].slice(0, 3),
    [validationResolution.blockingErrors, validationWarnings],
  );

  const fromMatches = useMemo(
    () => people
      .filter((person) => person.id !== toPersonId)
      .filter((person) => formatPersonName(person).toLowerCase().includes(fromSearch.trim().toLowerCase())),
    [fromSearch, people, toPersonId],
  );
  const toMatches = useMemo(
    () => people
      .filter((person) => person.id !== fromPersonId)
      .filter((person) => formatPersonName(person).toLowerCase().includes(toSearch.trim().toLowerCase())),
    [fromPersonId, people, toSearch],
  );

  const filteredFromPeople = useMemo(
    () => fromMatches.slice(0, MAX_VISIBLE_RESULTS),
    [fromMatches],
  );
  const filteredToPeople = useMemo(
    () => toMatches.slice(0, MAX_VISIBLE_RESULTS),
    [toMatches],
  );

  const selectedFromPerson = useMemo(
    () => people.find((person) => person.id === fromPersonId) ?? null,
    [fromPersonId, people],
  );
  const selectedToPerson = useMemo(
    () => people.find((person) => person.id === toPersonId) ?? null,
    [people, toPersonId],
  );

  const handleSubmit = async () => {
    if (people.length < 2) {
      setError(t(K.relationship.addAtLeastTwoFamilyMembers));
      return;
    }

    if (!fromPersonId || !toPersonId) {
      setError(t(K.relationship.selectBothFamilyMembers));
      return;
    }

    if (fromPersonId === toPersonId) {
      setError(type === 'spouse'
        ? t(K.relationship.cannotBeOwnSpouse)
        : t(K.relationship.cannotBeOwnParentOrChild));
      return;
    }

    if (validationResolution.blockingErrors.length > 0) {
      setBlockingValidationMessage(validationResolution.blockingErrors[0] ?? null);
      return;
    }

    if (validationResolution.softWarnings.length > 0) {
      setReviewWarnings(validationResolution.softWarnings);
      return;
    }

    await onSubmit({
      type,
      fromPersonId,
      toPersonId,
      relationshipStatus: type === 'spouse' ? relationshipStatus : undefined,
      parentChildKind: type === 'parent-child' ? parentChildKind : undefined,
    });
  };

  const firstLabel = type === 'spouse' ? t(K.relationship.selectSpouseA) : t(K.relationship.selectParent);
  const secondLabel = type === 'spouse' ? t(K.relationship.selectSpouseB) : t(K.relationship.selectChild);

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loading ? undefined : onDismiss}
        style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose, styles.dialogTitle]}>{t(K.relationship.addRelationship)}</Dialog.Title>
        <IconButton icon="close" onPress={onDismiss} disabled={loading} accessibilityLabel={t(K.common.cancel)} style={dialogChrome.closeButton} />
        <Dialog.ScrollArea style={[dialogChrome.scrollArea, styles.scrollArea]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={[styles.relationshipTypeCard, { borderColor: theme.colors.outlineVariant }]}>
              <SegmentedButtons
                value={type}
                onValueChange={(value) => {
                  setType(value as RelationshipType);
                  setError(null);
                }}
                buttons={[
                  { value: 'parent-child', label: t(K.relationship.parentToChild) },
                  { value: 'spouse', label: t(K.relationship.spouseToSpouse) },
                ]}
              />
            </View>

            {type === 'spouse' ? (
              <View style={[styles.relationshipTypeCard, { borderColor: theme.colors.outlineVariant }]}>
                <Text variant="titleSmall">{t(K.relationship.relationshipStatus)}</Text>
                <View style={styles.choiceWrap}>
                  {[
                    { value: 'partner', label: K.relationship.partnerLabel },
                    { value: 'married', label: K.relationship.marriedLabel },
                    { value: 'separated', label: K.relationship.separatedLabel },
                    { value: 'divorced', label: K.relationship.divorcedLabel },
                    { value: 'widowed', label: K.relationship.widowedLabel },
                  ].map((option) => (
                    <Chip
                      key={option.value}
                      selected={relationshipStatus === option.value}
                      onPress={() => setRelationshipStatus(option.value as SpouseRelationshipStatus)}
                      style={styles.choiceChip}
                      disabled={loading}
                    >
                      {t(option.label)}
                    </Chip>
                  ))}
                </View>
              </View>
            ) : (
              <View style={[styles.relationshipTypeCard, { borderColor: theme.colors.outlineVariant }]}>
                <Text variant="titleSmall">{t(K.relationship.childRelationship)}</Text>
                <View style={styles.choiceWrap}>
                  {[
                    { value: 'biological', label: K.relationship.biologicalLabel },
                    { value: 'non-biological', label: K.relationship.nonBiologicalLabel },
                    { value: 'step', label: K.relationship.stepLabel },
                    { value: 'adopted', label: K.relationship.adoptedLabel },
                    { value: 'foster', label: K.relationship.fosterLabel },
                    { value: 'guardian', label: K.relationship.guardianLabel },
                  ].map((option) => (
                    <Chip
                      key={option.value}
                      selected={parentChildKind === option.value}
                      onPress={() => setParentChildKind(option.value as ParentChildRelationshipKind)}
                      style={styles.choiceChip}
                      disabled={loading}
                    >
                      {t(option.label)}
                    </Chip>
                  ))}
                </View>
                <HelperText type="info" visible={validationWarnings.length > 0}>
                  {validationWarnings[0] ?? ''}
                </HelperText>
              </View>
            )}

            {(fromPersonId || toPersonId) && liveReviewMessages.length > 0 ? (
              <View style={[styles.reviewCard, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.elevation.level1 }]}>
                <Text variant="titleSmall">{t(K.personForm.pleaseReviewBeforeSaving)}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t(K.personForm.relationshipReviewSummaryBeforeSaving, { count: liveReviewMessages.length })}
                </Text>
                {liveReviewMessages.map((message) => (
                  <Text key={message} variant="bodyMedium" style={styles.reviewMessage}>
                    • {message}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={[styles.section, styles.sectionCard, { borderColor: theme.colors.outlineVariant }]}>
              <View style={styles.sectionHeaderRow}>
                <Text variant="titleSmall">{firstLabel}</Text>
                {selectedFromPerson ? (
                  <Chip compact selected onPress={() => setFromPersonId('')}>
                    {t(K.relationship.selected)}
                  </Chip>
                ) : null}
              </View>
              <TextInput
                outlineStyle={{ borderRadius: 16 }}
                mode="outlined"
                label={t(K.common.searchFamilyMember)}
                value={fromSearch}
                onChangeText={setFromSearch}
                style={styles.searchInput}
                disabled={loading}
                left={<TextInput.Icon icon="magnify" />}
              />
              <Text variant="bodySmall" style={styles.helperCopy}>
                {t(K.relationship.searchHelper)}
              </Text>
              {selectedFromPerson ? (
                <View style={styles.selectedChipRow}>
                  <Chip selected closeIcon="close" onClose={() => setFromPersonId('')} onPress={() => setFromPersonId('')}>
                    {formatPersonName(selectedFromPerson)}
                  </Chip>
                </View>
              ) : null}
              {filteredFromPeople.length > 0 ? (
                <View style={[styles.resultsList, { borderColor: theme.colors.outlineVariant }]}>
                  {filteredFromPeople.map((person, index) => (
                    <Pressable
                      key={`from-${person.id}`}
                      onPress={() => {
                        setFromPersonId(person.id);
                        setError(null);
                      }}
                      disabled={loading}
                      style={[
                        styles.resultRow,
                        {
                          backgroundColor: fromPersonId === person.id
                            ? theme.colors.primaryContainer
                            : theme.colors.surface,
                        },
                        index > 0 ? [styles.resultRowDivider, { borderTopColor: theme.colors.outlineVariant }] : null,
                      ]}
                    >
                      <Text variant="titleSmall" style={styles.resultRowTitle}>{formatPersonName(person)}</Text>
                      <Text variant="bodySmall" style={styles.resultRowMeta}>{formatPersonMeta(person)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={[styles.emptyState, { backgroundColor: theme.colors.elevation.level1 }]}>
                  <Text variant="bodyMedium">{t(K.relationship.noMatchesThisSide)}</Text>
                </View>
              )}
              {fromMatches.length > MAX_VISIBLE_RESULTS ? (
                <Text variant="bodySmall" style={styles.resultsFooterText}>
                  {t(K.relationship.keepTypingToNarrow)}
                </Text>
              ) : null}
            </View>

            <View style={[styles.section, styles.sectionCard, { borderColor: theme.colors.outlineVariant }]}>
              <View style={styles.sectionHeaderRow}>
                <Text variant="titleSmall">{secondLabel}</Text>
                {selectedToPerson ? (
                  <Chip compact selected onPress={() => setToPersonId('')}>
                    {t(K.relationship.selected)}
                  </Chip>
                ) : null}
              </View>
              <TextInput
                outlineStyle={{ borderRadius: 16 }}
                mode="outlined"
                label={t(K.common.searchFamilyMember)}
                value={toSearch}
                onChangeText={setToSearch}
                style={styles.searchInput}
                disabled={loading}
                left={<TextInput.Icon icon="magnify" />}
              />
              <Text variant="bodySmall" style={styles.helperCopy}>
                {t(K.relationship.selectionOtherSideRemoved)}
              </Text>
              {selectedToPerson ? (
                <View style={styles.selectedChipRow}>
                  <Chip selected closeIcon="close" onClose={() => setToPersonId('')} onPress={() => setToPersonId('')}>
                    {formatPersonName(selectedToPerson)}
                  </Chip>
                </View>
              ) : null}
              {filteredToPeople.length > 0 ? (
                <View style={[styles.resultsList, { borderColor: theme.colors.outlineVariant }]}>
                  {filteredToPeople.map((person, index) => (
                    <Pressable
                      key={`to-${person.id}`}
                      onPress={() => {
                        setToPersonId(person.id);
                        setError(null);
                      }}
                      disabled={loading}
                      style={[
                        styles.resultRow,
                        {
                          backgroundColor: toPersonId === person.id
                            ? theme.colors.primaryContainer
                            : theme.colors.surface,
                        },
                        index > 0 ? [styles.resultRowDivider, { borderTopColor: theme.colors.outlineVariant }] : null,
                      ]}
                    >
                      <Text variant="titleSmall" style={styles.resultRowTitle}>{formatPersonName(person)}</Text>
                      <Text variant="bodySmall" style={styles.resultRowMeta}>{formatPersonMeta(person)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={[styles.emptyState, { backgroundColor: theme.colors.elevation.level1 }]}>
                  <Text variant="bodyMedium">{t(K.relationship.noMatchesThisSide)}</Text>
                </View>
              )}
              {toMatches.length > MAX_VISIBLE_RESULTS ? (
                <Text variant="bodySmall" style={styles.resultsFooterText}>
                  {t(K.relationship.keepTypingToNarrow)}
                </Text>
              ) : null}
            </View>

            <HelperText type="error" visible={!!error || !!validationMessage}>
              {error ?? validationMessage ?? ' '}
            </HelperText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={[dialogChrome.dialogActions, styles.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button mode="contained" onPress={handleSubmit} disabled={loading || people.length < 2}>{t(K.common.save)}</Button>
        </Dialog.Actions>
      </Dialog>
      <Dialog
        visible={!!blockingValidationMessage}
        onDismiss={() => setBlockingValidationMessage(null)}
        style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={dialogChrome.dialogTitle}>
          {t(K.relationship.addRelationship)}
        </Dialog.Title>
        <Dialog.Content style={dialogChrome.content}>
          <Text variant="bodyMedium">
            {blockingValidationMessage ?? ''}
          </Text>
        </Dialog.Content>
        <Dialog.Actions style={dialogChrome.dialogActions}>
          <Button mode="contained" onPress={() => setBlockingValidationMessage(null)} disabled={loading}>
            {t(K.common.close)}
          </Button>
        </Dialog.Actions>
      </Dialog>
      <Dialog
        visible={reviewWarnings.length > 0}
        onDismiss={() => setReviewWarnings([])}
        style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={dialogChrome.dialogTitle}>
          {t(K.personForm.relationshipNeedsReviewTitle)}
        </Dialog.Title>
        <Dialog.Content style={dialogChrome.content}>
          <Text variant="bodyMedium" style={styles.helperCopy}>
            {t(K.personForm.relationshipValidationCheck)}
          </Text>
          <Text variant="bodyMedium" style={{ marginTop: 12 }}>
            {reviewWarnings.length === 1
              ? reviewWarnings[0]
              : reviewWarnings.map((warning, index) => `${index + 1}. ${warning}`).join('\n')}
          </Text>
        </Dialog.Content>
        <Dialog.Actions style={dialogChrome.dialogActions}>
          <Button onPress={() => setReviewWarnings([])} disabled={loading}>
            {t(K.common.cancel)}
          </Button>
          <Button
            mode="contained"
            onPress={async () => {
              setReviewWarnings([]);
              await onSubmit({
                type,
                fromPersonId,
                toPersonId,
                relationshipStatus: type === 'spouse' ? relationshipStatus : undefined,
                parentChildKind: type === 'parent-child' ? parentChildKind : undefined,
              });
            }}
            disabled={loading}
          >
            {t(K.startup.continue)}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
