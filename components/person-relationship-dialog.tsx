import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, IconButton, Portal, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { getPersonLifeSpanLabel, type PersonRecord } from './dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from './dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from './dto/relationship';
import { validateProposedRelationship } from './family-tree-validation';
import { useI18n } from '../hooks/use-i18n';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.personRelationshipDialog;
const dialogChrome = GlobalStyles.dialogChrome;
const MAX_VISIBLE_RESULTS = 3;

export type PersonRelationshipMode = 'parent-of' | 'child-of' | 'spouse-of';

interface PersonRelationshipDialogProps {
  visible: boolean;
  person: PersonRecord | null;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  loading?: boolean;
  editingRelationship?: RelationshipRecord | null;
  onDismiss: () => void;
  onDelete?: (() => void | Promise<void>) | null;
  onSubmit: (payload: {
    mode: PersonRelationshipMode;
    relatedPersonId: string;
    relationshipStatus?: SpouseRelationshipStatus;
    parentChildKind?: ParentChildRelationshipKind;
  }) => void | Promise<void>;
}

function formatPersonName(person?: PersonRecord | null) {
  if (!person) return 'Unknown family member';
  return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim();
}

function formatPersonMeta(person: PersonRecord) {
  const lifespan = getPersonLifeSpanLabel(person);
  return lifespan === 'Unknown lifespan' ? 'No dates recorded yet' : lifespan;
}

function getDraftFromRelationship(personId: string, relationship?: RelationshipRecord | null) {
  if (!relationship) {
    return {
      mode: 'parent-of' as PersonRelationshipMode,
      relatedPersonId: '',
      relationshipStatus: DEFAULT_SPOUSE_RELATIONSHIP_STATUS,
      parentChildKind: DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
    };
  }
  if (relationship.type === 'spouse') {
    return {
      mode: 'spouse-of' as PersonRelationshipMode,
      relatedPersonId: relationship.fromPersonId === personId ? relationship.toPersonId : relationship.fromPersonId,
      relationshipStatus: relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS,
      parentChildKind: DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
    };
  }
  if (relationship.fromPersonId === personId) {
    return {
      mode: 'parent-of' as PersonRelationshipMode,
      relatedPersonId: relationship.toPersonId,
      relationshipStatus: DEFAULT_SPOUSE_RELATIONSHIP_STATUS,
      parentChildKind: relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
    };
  }
  return {
    mode: 'child-of' as PersonRelationshipMode,
    relatedPersonId: relationship.fromPersonId,
    relationshipStatus: DEFAULT_SPOUSE_RELATIONSHIP_STATUS,
    parentChildKind: relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
  };
}

export default function PersonRelationshipDialog({
  visible,
  person,
  people,
  relationships,
  loading = false,
  editingRelationship,
  onDismiss,
  onDelete,
  onSubmit,
}: PersonRelationshipDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [mode, setMode] = useState<PersonRelationshipMode>('parent-of');
  const [relatedPersonId, setRelatedPersonId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState<SpouseRelationshipStatus>(DEFAULT_SPOUSE_RELATIONSHIP_STATUS);
  const [parentChildKind, setParentChildKind] = useState<ParentChildRelationshipKind>(DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !person) return;
    const draft = getDraftFromRelationship(person.id, editingRelationship);
    setMode(draft.mode);
    setRelatedPersonId(draft.relatedPersonId);
    setRelationshipStatus(draft.relationshipStatus);
    setParentChildKind(draft.parentChildKind);
    setSearchQuery('');
    setError(null);
  }, [editingRelationship, person, visible]);

  // Gender-aware mode button labels
  const modeButtons = useMemo(() => [
    {
      value: 'parent-of',
      label: person?.gender === 'male' ? 'Father of' : person?.gender === 'female' ? 'Mother of' : 'Parent of',
    },
    {
      value: 'child-of',
      label: person?.gender === 'male' ? 'Son of' : person?.gender === 'female' ? 'Daughter of' : 'Child of',
    },
    { value: 'spouse-of', label: 'Spouse of' },
  ], [person?.gender]);

  const candidates = useMemo(() => {
    const childIds = new Set(
      relationships
        .filter((r) => r.type === 'parent-child' && r.fromPersonId === person?.id)
        .map((r) => r.toPersonId),
    );
    const parentIds = new Set(
      relationships
        .filter((r) => r.type === 'parent-child' && r.toPersonId === person?.id)
        .map((r) => r.fromPersonId),
    );
    return people.filter((candidate) => {
      if (candidate.id === person?.id) return false;
      if (mode === 'parent-of') return !childIds.has(candidate.id);
      if (mode === 'child-of') return !parentIds.has(candidate.id);
      return true;
    });
  }, [people, person?.id, relationships, mode]);

  const selectedPerson = useMemo(
    () => (relatedPersonId ? candidates.find((c) => c.id === relatedPersonId) ?? null : null),
    [candidates, relatedPersonId],
  );

  const filteredCandidates = useMemo(
    () => candidates
      .filter((c) => formatPersonName(c).toLowerCase().includes(searchQuery.trim().toLowerCase()))
      .slice(0, MAX_VISIBLE_RESULTS),
    [candidates, searchQuery],
  );

  const totalCandidateMatches = useMemo(
    () => candidates.filter((c) => formatPersonName(c).toLowerCase().includes(searchQuery.trim().toLowerCase())).length,
    [candidates, searchQuery],
  );

  const validationMessage = useMemo(() => {
    if (!person || !relatedPersonId) {
      return null;
    }

    return validateProposedRelationship({
      people,
      relationships,
      type: mode === 'spouse-of' ? 'spouse' : 'parent-child',
      fromPersonId: mode === 'child-of' ? relatedPersonId : person.id,
      toPersonId: mode === 'child-of' ? person.id : relatedPersonId,
      ignoreRelationshipId: editingRelationship?.id,
    });
  }, [editingRelationship?.id, mode, people, person, relatedPersonId, relationships]);

  const handleSubmit = async () => {
    if (!person) { setError(t('This family member could not be loaded.')); return; }
    if (!relatedPersonId) { setError(t('Choose a related family member first.')); return; }
    if (validationMessage) { setError(validationMessage); return; }
    await onSubmit({
      mode,
      relatedPersonId,
      relationshipStatus: mode === 'spouse-of' ? relationshipStatus : undefined,
      parentChildKind: mode === 'spouse-of' ? undefined : parentChildKind,
    });
  };

  const clearSelection = () => {
    setRelatedPersonId('');
    setSearchQuery('');
    setError(null);
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loading ? undefined : onDismiss}
        style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{editingRelationship ? t('Edit relationship') : t('Add relationship')}</Dialog.Title>
        <IconButton icon="close" onPress={onDismiss} disabled={loading} accessibilityLabel={t('Cancel')} style={dialogChrome.closeButton} />
        <Dialog.ScrollArea style={[dialogChrome.scrollArea, styles.scrollArea]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text variant="bodyMedium" style={styles.helperText}>
              {t('Manage connections directly from {name}.', { name: formatPersonName(person) })}
            </Text>

            <SegmentedButtons
              value={mode}
              onValueChange={(value) => {
                setMode(value as PersonRelationshipMode);
                setRelatedPersonId('');
                setSearchQuery('');
                setError(null);
              }}
              buttons={modeButtons}
              style={styles.segmentedButtons}
            />

            {mode === 'spouse-of' ? (
              <View style={styles.section}>
                <Text variant="titleSmall">{t('Relationship status')}</Text>
                <View style={styles.choiceWrap}>
                  {[
                    { value: 'partner', label: 'Partner' },
                    { value: 'married', label: 'Married' },
                    { value: 'separated', label: 'Separated' },
                    { value: 'divorced', label: 'Divorced' },
                    { value: 'widowed', label: 'Widowed' },
                  ].map((option) => (
                    <Chip
                      key={option.value}
                      selected={relationshipStatus === option.value}
                      onPress={() => setRelationshipStatus(option.value as SpouseRelationshipStatus)}
                      style={styles.choiceChip}
                      disabled={loading}
                    >
                      {option.label}
                    </Chip>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <Text variant="titleSmall">{t('Child relationship')}</Text>
                <View style={styles.choiceWrap}>
                  {[
                    { value: 'biological', label: 'Biological' },
                    { value: 'step', label: 'Step' },
                    { value: 'adopted', label: 'Adopted' },
                    { value: 'foster', label: 'Foster' },
                    { value: 'guardian', label: 'Guardian' },
                  ].map((option) => (
                    <Chip
                      key={option.value}
                      selected={parentChildKind === option.value}
                      onPress={() => setParentChildKind(option.value as ParentChildRelationshipKind)}
                      style={styles.choiceChip}
                      disabled={loading}
                    >
                      {option.label}
                    </Chip>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text variant="titleSmall">{t('Select related family member')}</Text>
              {selectedPerson ? (
                <View style={styles.selectedChipRow}>
                  <Chip
                    selected
                    closeIcon="close"
                    onClose={clearSelection}
                    onPress={clearSelection}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {formatPersonName(selectedPerson)}
                  </Chip>
                </View>
              ) : (
                <>
                  <TextInput
                    mode="outlined"
                    label={t('Search family member')}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchInput}
                    disabled={loading}
                    left={<TextInput.Icon icon="magnify" />}
                  />
                  {filteredCandidates.length > 0 ? (
                    <View style={styles.resultsList}>
                      {filteredCandidates.map((candidate, index) => (
                        <Pressable
                          key={candidate.id}
                          onPress={() => {
                            setRelatedPersonId(candidate.id);
                          setSearchQuery('');
                          setError(null);
                          }}
                          disabled={loading}
                          style={[
                            styles.resultRow,
                            relatedPersonId === candidate.id ? styles.resultRowSelected : null,
                            index > 0 ? styles.resultRowDivider : null,
                          ]}
                        >
                          <Text variant="titleSmall" style={styles.resultRowTitle}>{formatPersonName(candidate)}</Text>
                          <Text variant="bodySmall" style={styles.resultRowMeta}>{formatPersonMeta(candidate)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <Text variant="bodyMedium">{t('No matching family members are available for this relationship type.')}</Text>
                    </View>
                  )}
                  {totalCandidateMatches > MAX_VISIBLE_RESULTS ? (
                    <Text variant="bodySmall" style={styles.resultsFooterText}>
                      {t('Showing the first 3 matches. Add more search text to narrow the list.')}
                    </Text>
                  ) : null}
                </>
              )}
            </View>

            <HelperText type="error" visible={!!error || !!validationMessage}>
              {error ?? validationMessage ?? ' '}
            </HelperText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          {editingRelationship && onDelete ? (
            <IconButton icon="trash-can-outline" iconColor={theme.colors.error} onPress={onDelete} disabled={loading} accessibilityLabel={t('Delete')} />
          ) : null}
          <Button mode="contained" onPress={handleSubmit} disabled={loading || !person || candidates.length === 0 || !!validationMessage}>{t('Save')}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
