import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, IconButton, Portal, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { getPersonLifeSpanLabel, type PersonRecord } from './dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from './dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from './dto/relationship';
import { getRelationshipValidationFeedback, validateProposedRelationship } from './family-tree-validation';
import { useI18n } from '../hooks/use-i18n';
import { translate } from '../i18n';
import { I18N_KEYS as K } from '../i18n/keys';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.personRelationshipDialog;
const dialogChrome = GlobalStyles.dialogChrome;
const ITEMS_PER_PAGE = 5;

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
  if (!person) return translate(K.relationship.unknownFamilyMember);
  return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim();
}

function formatPersonMeta(person: PersonRecord) {
  const lifespan = getPersonLifeSpanLabel(person);
  return lifespan === translate(K.personProfile.unknownLifespan) ? translate(K.relationshipInsight.noDatesRecordedYet) : lifespan;
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
  const [currentPage, setCurrentPage] = useState(0);
  const [validationWarningDialogVisible, setValidationWarningDialogVisible] = useState(false);
  const [pendingCandidateSelection, setPendingCandidateSelection] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !person) return;
    const draft = getDraftFromRelationship(person.id, editingRelationship);
    setMode(draft.mode);
    setRelatedPersonId(draft.relatedPersonId);
    setRelationshipStatus(draft.relationshipStatus);
    setParentChildKind(draft.parentChildKind);
    setSearchQuery('');
    setError(null);
    setCurrentPage(0);
  }, [editingRelationship, person, visible]);

  // Gender-aware mode button labels
  const modeButtons = useMemo(() => [
    {
      value: 'parent-of',
      label: person?.gender === 'male' ? t(K.relationship.fatherOf) : person?.gender === 'female' ? t(K.relationship.motherOf) : t(K.relationship.parentOf),
    },
    {
      value: 'child-of',
      label: person?.gender === 'male' ? t(K.relationship.sonOf) : person?.gender === 'female' ? t(K.relationship.daughterOf) : t(K.relationship.childOf),
    },
    { value: 'spouse-of', label: t(K.relationship.spouseOf) },
  ], [person?.gender, t]);

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

  const getExistingParentCount = useMemo(() => {
   if (!person || mode !== 'child-of') return 0;
   return relationships
     .filter((r) => r.type === 'parent-child' && r.toPersonId === person.id)
     .length;
  }, [person, mode, relationships]);

  const getExistingSpouseCount = useMemo(() => {
   if (!person || mode !== 'spouse-of') return 0;
   return relationships
     .filter((r) => r.type === 'spouse' && (r.fromPersonId === person.id || r.toPersonId === person.id))
     .length;
  }, [person, mode, relationships]);

  const selectedPerson = useMemo(
   () => (relatedPersonId ? candidates.find((c) => c.id === relatedPersonId) ?? null : null),
   [candidates, relatedPersonId],
  );

  const allFilteredCandidates = useMemo(
   () => candidates.filter((c) => formatPersonName(c).toLowerCase().includes(searchQuery.trim().toLowerCase())),
   [candidates, searchQuery],
  );

  const totalCandidateMatches = allFilteredCandidates.length;

  const filteredCandidates = useMemo(() => {
   const start = currentPage * ITEMS_PER_PAGE;
   const end = start + ITEMS_PER_PAGE;
   return allFilteredCandidates.slice(start, end);
  }, [allFilteredCandidates, currentPage]);

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
      parentChildKind: mode === 'spouse-of' ? undefined : parentChildKind,
      relationshipStatus: mode === 'spouse-of' ? relationshipStatus : undefined,
      ignoreRelationshipId: editingRelationship?.id,
    });
  }, [editingRelationship?.id, mode, parentChildKind, people, person, relatedPersonId, relationshipStatus, relationships]);
  const validationWarnings = useMemo(() => {
    if (!person || !relatedPersonId) {
      return [];
    }

    return getRelationshipValidationFeedback({
      people,
      relationships,
      type: mode === 'spouse-of' ? 'spouse' : 'parent-child',
      fromPersonId: mode === 'child-of' ? relatedPersonId : person.id,
      toPersonId: mode === 'child-of' ? person.id : relatedPersonId,
      parentChildKind: mode === 'spouse-of' ? undefined : parentChildKind,
      relationshipStatus: mode === 'spouse-of' ? relationshipStatus : undefined,
      ignoreRelationshipId: editingRelationship?.id,
    }).warnings;
  }, [editingRelationship?.id, mode, parentChildKind, people, person, relatedPersonId, relationshipStatus, relationships]);

  const getSoftValidationWarnings = (candidateId: string): string[] => {
    if (!person) return [];
    
    const warnings: string[] = [];
    
    if (mode === 'child-of' && getExistingParentCount >= 2) {
      warnings.push(t(K.relationship.personAlreadyHasTwoParents ?? 'This person already has two parents'));
    }
    
    if (mode === 'spouse-of' && getExistingSpouseCount >= 1) {
      warnings.push(t(K.relationship.personAlreadyHasOneSpouse ?? 'This person already has a spouse'));
    }
    
    return warnings;
  };

  const handleSubmit = async () => {
    if (!person) { setError(t(K.relationship.familyMemberCouldNotBeLoaded)); return; }
    if (!relatedPersonId) { setError(t(K.relationship.chooseRelatedFamilyMemberFirst)); return; }
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
    setCurrentPage(0);
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loading ? undefined : onDismiss}
        style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{editingRelationship ? t(K.relationship.editRelationship) : t(K.relationship.addRelationship)}</Dialog.Title>
        <IconButton icon="close" onPress={onDismiss} disabled={loading} accessibilityLabel={t(K.common.cancel)} style={dialogChrome.closeButton} />
        <Dialog.ScrollArea style={[dialogChrome.scrollArea, styles.scrollArea]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text variant="bodyMedium" style={styles.helperText}>
              {t(K.relationship.manageConnectionsDirectly, { name: formatPersonName(person) })}
            </Text>

            <SegmentedButtons
              value={mode}
              onValueChange={(value) => {
                setMode(value as PersonRelationshipMode);
                setRelatedPersonId('');
                setSearchQuery('');
                setError(null);
                setCurrentPage(0);
              }}
              buttons={modeButtons}
              style={styles.segmentedButtons}
            />

            {mode === 'spouse-of' ? (
              <View style={styles.section}>
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
              <View style={styles.section}>
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

            <View style={styles.section}>
              <Text variant="titleSmall">{t(K.relationship.selectRelatedFamilyMember)}</Text>
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
                    label={t(K.common.searchFamilyMember)}
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
                            const warnings = getSoftValidationWarnings(candidate.id);
                            setRelatedPersonId(candidate.id);
                            setSearchQuery('');
                            if (warnings.length > 0) {
                              setError(warnings[0]);
                            } else {
                              setError(null);
                            }
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
                      <Text variant="bodyMedium">{t(K.relationship.noMatchingForRelationshipType)}</Text>
                    </View>
                  )}
                  {totalCandidateMatches > ITEMS_PER_PAGE ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                      <Button
                        mode="outlined"
                        onPress={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                        disabled={currentPage === 0 || loading}
                      >
                        {t(K.common.previous ?? 'Previous')}
                      </Button>
                      <Text style={{ alignSelf: 'center', paddingHorizontal: 8 }} variant="bodySmall">
                        {`${currentPage + 1} / ${Math.ceil(totalCandidateMatches / ITEMS_PER_PAGE)}`}
                      </Text>
                      <Button
                        mode="outlined"
                        onPress={() => setCurrentPage((prev) => prev + 1)}
                        disabled={currentPage >= Math.ceil(totalCandidateMatches / ITEMS_PER_PAGE) - 1 || loading}
                      >
                        {t(K.common.next ?? 'Next')}
                      </Button>
                    </View>
                  ) : null}
                </>
              )}
            </View>

            <HelperText type="error" visible={!!error || !!validationMessage}>
              {error ?? validationMessage ?? ' '}
            </HelperText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions
          style={[
            dialogChrome.dialogActions,
            { borderTopColor: theme.colors.outlineVariant, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
          ]}
        >
          {editingRelationship && onDelete ? (
            <IconButton icon="trash-can-outline" iconColor={theme.colors.error} onPress={onDelete} disabled={loading} accessibilityLabel={t(K.common.delete)} />
          ) : (
            <View />
          )}
          <Button mode="contained" onPress={handleSubmit} disabled={loading || !person || candidates.length === 0 || !!validationMessage}>{t(K.common.save)}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
