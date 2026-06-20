import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import {
  Button,
  Chip,
  Dialog,
  HelperText,
  IconButton,
  Menu,
  Portal,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import type { PersonGender, PersonLifeEvent, PersonMutationPayload, PersonPhoto, PersonRecord } from './dto/person';
import { formatPersonDate } from './dto/person';
import type { RelationshipRecord } from './dto/relationship';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.personFormDialog;
const dialogChrome = GlobalStyles.dialogChrome;

export type PendingRelationshipMode = 'parent-of' | 'child-of' | 'spouse-of';

export interface PendingRelationshipSubmission {
  mode: PendingRelationshipMode;
  relatedPersonId: string;
}

interface PendingRelationshipDraft extends PendingRelationshipSubmission {
  key: string;
  searchQuery: string;
}

export interface PersonFormSubmission extends PersonMutationPayload {
  pendingRelationships: PendingRelationshipSubmission[];
}

interface PersonFormDialogProps {
  visible: boolean;
  mode: 'create' | 'edit';
  person?: PersonRecord | null;
  initialValues?: Partial<PersonMutationPayload>;
  initialPendingRelationships?: PendingRelationshipSubmission[];
  loading?: boolean;
  existingLastNames?: string[];
  relationshipCandidates?: PersonRecord[];
  /** All existing relationships in the tree — used to suggest co-parents */
  relationships?: RelationshipRecord[];
  onDismiss: () => void;
  onSubmit: (payload: PersonFormSubmission) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}

const genderOptions: Array<{ label: string; value: PersonGender }> = [
  { label: 'Unspecified', value: 'unspecified' },
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Non-binary', value: 'non-binary' },
  { label: 'Other', value: 'other' },
];


function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string) {
  if (!value) {
    return undefined;
  }

  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}

function formatDateButtonLabel(value: string) {
  return value ? formatPersonDate(value) : 'Pick a date';
}

function formatPersonName(person: PersonRecord) {
  return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim();
}

function createPendingRelationshipDraft(): PendingRelationshipDraft {
  return {
    key: `${Date.now()}-${Math.random()}`,
    mode: 'parent-of',
    relatedPersonId: '',
    searchQuery: '',
  };
}

function createPendingRelationshipDraftFromSubmission(
  relationship: PendingRelationshipSubmission,
): PendingRelationshipDraft {
  return {
    key: `${Date.now()}-${Math.random()}`,
    mode: relationship.mode,
    relatedPersonId: relationship.relatedPersonId,
    searchQuery: '',
  };
}

export default function PersonFormDialog({
  visible,
  mode,
  person,
  initialValues,
  initialPendingRelationships = [],
  loading = false,
  existingLastNames = [],
  relationshipCandidates = [],
  relationships = [],
  onDismiss,
  onSubmit,
  onDelete,
}: PersonFormDialogProps) {
  const theme = useTheme();
  const [step, setStep] = useState<1 | 2>(1);
  const [isPresent, setIsPresent] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [middleNames, setMiddleNames] = useState('');
  const [lastName, setLastName] = useState('');
  const [maidenName, setMaidenName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [gender, setGender] = useState<PersonGender>('unspecified');
  const [notes, setNotes] = useState('');
  const [lifeEvents, setLifeEvents] = useState<PersonLifeEvent[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<PersonPhoto[]>([]);
  const [removedPhotos, setRemovedPhotos] = useState<PersonPhoto[]>([]);
  const [newPhotoUris, setNewPhotoUris] = useState<string[]>([]);
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [relationshipError, setRelationshipError] = useState<string | null>(null);
  const [deathDateError, setDeathDateError] = useState<string | null>(null);
  const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);
  const [deathDatePickerVisible, setDeathDatePickerVisible] = useState(false);
  const [pendingRelationships, setPendingRelationships] = useState<PendingRelationshipDraft[]>([]);
  const [surnameMenuVisible, setSurnameMenuVisible] = useState(false);
  const [lastNameTouched, setLastNameTouched] = useState(false);
  const [preferredPhotoRef, setPreferredPhotoRef] = useState('');

  // Track the last open-event key so we reinitialise only once per open, not
  // on every re-render, preventing the Portal infinite-update loop.
  const lastInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      lastInitKeyRef.current = null;
      return;
    }

    // Build a stable key from the identity of this open event.
    // Using person?.id + mode so switching from create→edit (or editing a
    // different person) always re-initialises, but a re-render that keeps the
    // same open dialog does NOT re-run all the setState calls and trigger the
    // Portal infinite-update loop.
    const initKey = `${mode}:${person?.id ?? 'new'}`;
    if (lastInitKeyRef.current === initKey) {
      return;
    }
    lastInitKeyRef.current = initKey;

    setStep(1);
    const initialDeathDate = person?.deathDate ?? initialValues?.deathDate ?? '';
    setIsPresent(!initialDeathDate);
    setFirstName(person?.firstName ?? initialValues?.firstName ?? '');
    setMiddleNames(person?.middleNames ?? initialValues?.middleNames ?? '');
    setLastName(person?.lastName ?? initialValues?.lastName ?? '');
    setMaidenName(person?.maidenName ?? '');
    setBirthDate(person?.birthDate ?? initialValues?.birthDate ?? '');
    setDeathDate(person?.deathDate ?? initialValues?.deathDate ?? '');
    setGender(person?.gender ?? initialValues?.gender ?? 'unspecified');
    setNotes(person?.notes ?? initialValues?.notes ?? '');
    setLifeEvents(person?.lifeEvents ?? initialValues?.lifeEvents ?? []);
    setExistingPhotos(person?.photos ?? initialValues?.existingPhotos ?? []);
    setRemovedPhotos([]);
    setNewPhotoUris(initialValues?.newPhotoUris ?? []);
    setFirstNameError(null);
    setRelationshipError(null);
    setDeathDateError(null);
    setBirthDatePickerVisible(false);
    setDeathDatePickerVisible(false);
    setPendingRelationships(
      mode === 'create'
        ? initialPendingRelationships.map(createPendingRelationshipDraftFromSubmission)
        : [],
    );
    setSurnameMenuVisible(false);
    setLastNameTouched(false);
    setPreferredPhotoRef(person?.preferredPhotoId ?? initialValues?.preferredPhotoRef ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode, person?.id]);

  const selectedBirthDate = useMemo(() => parseIsoDate(birthDate), [birthDate]);
  const selectedDeathDate = useMemo(() => parseIsoDate(deathDate), [deathDate]);
  const uniqueLastNames = useMemo(
    () => [...new Set(existingLastNames.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [existingLastNames],
  );
  const relationshipCandidatesById = useMemo(
    () => new Map(relationshipCandidates.map((candidate) => [candidate.id, candidate])),
    [relationshipCandidates],
  );

  const suggestedLastName = useMemo(() => {
    if (mode !== 'create') {
      return '';
    }

    const byPriority: PendingRelationshipMode[] = ['spouse-of', 'child-of', 'parent-of'];

    for (const relationshipMode of byPriority) {
      const matchedDraft = pendingRelationships.find((draft) => draft.mode === relationshipMode && draft.relatedPersonId);
      if (!matchedDraft) {
        continue;
      }

      const relatedPerson = relationshipCandidatesById.get(matchedDraft.relatedPersonId);
      const suggested = relatedPerson?.lastName?.trim() ?? '';
      if (suggested) {
        return suggested;
      }
    }

    return '';
  }, [mode, pendingRelationships, relationshipCandidatesById]);

  useEffect(() => {
    if (mode !== 'create' || !suggestedLastName || lastNameTouched) {
      return;
    }

    setLastName(suggestedLastName);
  }, [lastNameTouched, mode, suggestedLastName]);

  // ── Maiden name suggestion ────────────────────────────────────────────────
  // Show a hint when a spouse-of relationship is selected, reminding the user
  // to record a maiden name if the person's surname changed upon marriage.
  const showMaidenNameSuggestion = useMemo(() => {
    if (maidenName.trim()) return false; // already filled in
    return pendingRelationships.some((d) => d.mode === 'spouse-of' && d.relatedPersonId);
  }, [maidenName, pendingRelationships]);
  // ─────────────────────────────────────────────────────────────────────────

  // ── Co-parent suggestion ──────────────────────────────────────────────────
  // When user sets a "child-of" relationship, check if that parent has a spouse
  // who isn't already in pendingRelationships. If so, offer to add them too.
  const coParentSuggestion = useMemo((): PersonRecord | null => {
    if (mode !== 'create' || !relationships.length) return null;

    const childOfDraft = pendingRelationships.find((d) => d.mode === 'child-of' && d.relatedPersonId);
    if (!childOfDraft) return null;

    const parentId = childOfDraft.relatedPersonId;

    // Find a spouse of that parent
    const spouseId = relationships.find(
      (r) => r.type === 'spouse' && (r.fromPersonId === parentId || r.toPersonId === parentId),
    );
    if (!spouseId) return null;

    const otherParentId = spouseId.fromPersonId === parentId ? spouseId.toPersonId : spouseId.fromPersonId;

    // Only suggest if not already added
    const alreadyAdded = pendingRelationships.some(
      (d) => d.mode === 'child-of' && d.relatedPersonId === otherParentId,
    );
    if (alreadyAdded) return null;

    return relationshipCandidates.find((c) => c.id === otherParentId) ?? null;
  }, [mode, pendingRelationships, relationships, relationshipCandidates]);
  // ─────────────────────────────────────────────────────────────────────────

  // Gender-aware relationship mode labels
  const relationshipModeOptions = useMemo(() => [
    {
      label: gender === 'male' ? 'Father of' : gender === 'female' ? 'Mother of' : 'Parent of',
      value: 'parent-of' as PendingRelationshipMode,
    },
    {
      label: gender === 'male' ? 'Son of' : gender === 'female' ? 'Daughter of' : 'Child of',
      value: 'child-of' as PendingRelationshipMode,
    },
    { label: 'Spouse of', value: 'spouse-of' as PendingRelationshipMode },
  ], [gender]);

  const handleNextStep = () => {
    if (!firstName.trim()) {
      setFirstNameError('First name is required.');
      return;
    }
    if (!isPresent && birthDate && deathDate && deathDate < birthDate) {
      setDeathDateError('Death date cannot be earlier than birth date.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!firstName.trim()) {
      setFirstNameError('First name is required.');
      return;
    }

    if (mode === 'create') {
      const hasIncompleteRelationship = pendingRelationships.some((draft) => !draft.relatedPersonId);
      if (hasIncompleteRelationship) {
        setRelationshipError('Choose a family member for each relationship you want to create.');
        return;
      }

      const duplicateKeys = new Set<string>();
      for (const draft of pendingRelationships) {
        const compositeKey = `${draft.mode}:${draft.relatedPersonId}`;
        if (duplicateKeys.has(compositeKey)) {
          setRelationshipError('Remove duplicate pending relationships before saving.');
          return;
        }
        duplicateKeys.add(compositeKey);
      }
    }

    if (birthDate && !isPresent && deathDate && deathDate < birthDate) {
      setDeathDateError('Death date cannot be earlier than birth date.');
      return;
    }

    await onSubmit({
      firstName,
      middleNames,
      lastName,
      maidenName,
      birthDate,
      deathDate: isPresent ? '' : deathDate,
      gender,
      notes,
      lifeEvents,
      preferredPhotoRef,
      existingPhotos,
      removedPhotos,
      newPhotoUris,
      pendingRelationships: pendingRelationships.map(({ mode, relatedPersonId }) => ({ mode, relatedPersonId })),
    });
  };

  return (
    <>
      <Portal>
        <Dialog
          visible={visible}
          onDismiss={loading ? undefined : onDismiss}
          style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, styles.dialogTitle]}>
            {mode === 'create'
              ? (step === 1 ? 'Add family member' : 'Add relationships')
              : 'Edit family member'}
          </Dialog.Title>
          {mode === 'create' ? (
            <View style={[styles.stepProgressRow, { borderBottomColor: theme.colors.outlineVariant }]}>
              <View style={[styles.stepDot, step >= 1 && { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.stepLine, { backgroundColor: step >= 2 ? theme.colors.primary : theme.colors.outlineVariant }]} />
              <View style={[styles.stepDot, step >= 2 && { backgroundColor: theme.colors.primary }]} />
              <Text variant="labelSmall" style={[styles.stepLabel, { color: theme.colors.onSurfaceVariant }]}>
                Step {step} of 2
              </Text>
            </View>
          ) : null}
          <Dialog.ScrollArea style={[dialogChrome.scrollArea, styles.scrollArea]}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

              {/* ── Step 1: core info ──────────────────────────────────────── */}
              {(mode !== 'create' || step === 1) ? (
                <>
              <TextInput
                mode="outlined"
                label="First name *"
                value={firstName}
                onChangeText={(value) => {
                  setFirstName(value);
                  if (firstNameError) {
                    setFirstNameError(null);
                  }
                }}
                disabled={loading}
                error={!!firstNameError}
              />
              <HelperText type="error" visible={!!firstNameError}>
                {firstNameError}
              </HelperText>

              <TextInput
                mode="outlined"
                label="Second / middle names"
                value={middleNames}
                onChangeText={setMiddleNames}
                disabled={loading}
              />

              <View style={styles.sectionSpacing}>
                <Text variant="titleSmall">Last name</Text>
                <Menu
                  visible={surnameMenuVisible}
                  onDismiss={() => setSurnameMenuVisible(false)}
                  anchor={(
                    <Button
                      mode="outlined"
                      icon="chevron-down"
                      onPress={() => setSurnameMenuVisible(true)}
                      style={styles.fieldSpacing}
                      disabled={loading || uniqueLastNames.length === 0}
                    >
                      {lastName || (uniqueLastNames.length > 0 ? 'Choose existing surname' : 'No existing surnames')}
                    </Button>
                  )}
                >
                  {uniqueLastNames.map((value) => (
                    <Menu.Item
                      key={value}
                      title={value}
                      onPress={() => {
                        setLastName(value);
                        setLastNameTouched(true);
                        setSurnameMenuVisible(false);
                      }}
                    />
                  ))}
                </Menu>
                <TextInput
                  mode="outlined"
                  label="Type new surname or edit selection"
                  value={lastName}
                  onChangeText={(value) => {
                    setLastName(value);
                    setLastNameTouched(true);
                  }}
                  disabled={loading}
                  style={styles.fieldSpacing}
                />
                {mode === 'create' && suggestedLastName ? (
                  <HelperText type="info" visible>
                    Suggested surname from selected relationship: {suggestedLastName}
                  </HelperText>
                ) : null}
              </View>

              <View style={styles.sectionSpacing}>
                <Text variant="titleSmall">Maiden name</Text>
                <TextInput
                  mode="outlined"
                  label="Maiden / birth surname (optional)"
                  value={maidenName}
                  onChangeText={setMaidenName}
                  disabled={loading}
                  style={styles.fieldSpacing}
                />
                <HelperText type="info" visible>
                  The surname this person was born with or used before marriage.
                </HelperText>
              </View>

              <View style={styles.sectionSpacing}>
                <Text variant="titleSmall">Birth date</Text>
                <View style={styles.birthDateActions}>
                  <Button
                    mode="outlined"
                    icon="calendar"
                    onPress={() => setBirthDatePickerVisible(true)}
                    disabled={loading}
                  >
                    {formatDateButtonLabel(birthDate)}
                  </Button>
                  {birthDate ? (
                    <Button onPress={() => setBirthDate('')} disabled={loading}>
                      Clear
                    </Button>
                  ) : null}
                </View>
              </View>

              <View style={styles.sectionSpacing}>
                <View style={styles.presentRow}>
                  <Text variant="titleSmall">Still present</Text>
                  <Switch
                    value={isPresent}
                    onValueChange={(value) => {
                      setIsPresent(value);
                      if (value) {
                        setDeathDate('');
                        setDeathDateError(null);
                      }
                    }}
                    disabled={loading}
                  />
                </View>
                {!isPresent ? (
                  <>
                    <View style={styles.birthDateActions}>
                      <Button
                        mode="outlined"
                        icon="calendar-heart"
                        onPress={() => setDeathDatePickerVisible(true)}
                        disabled={loading}
                      >
                        {formatDateButtonLabel(deathDate)}
                      </Button>
                      {deathDate ? (
                        <Button
                          onPress={() => {
                            setDeathDate('');
                            if (deathDateError) setDeathDateError(null);
                          }}
                          disabled={loading}
                        >
                          Clear
                        </Button>
                      ) : null}
                    </View>
                    <HelperText type="error" visible={!!deathDateError}>
                      {deathDateError}
                    </HelperText>
                  </>
                ) : null}
              </View>

              <View style={styles.sectionSpacing}>
                <Text variant="titleSmall">Gender</Text>
                <View style={styles.chipGroup}>
                  {genderOptions.map((option) => (
                    <Chip
                      key={option.value}
                      selected={gender === option.value}
                      onPress={() => setGender(option.value)}
                      disabled={loading}
                      style={styles.chip}
                    >
                      {option.label}
                    </Chip>
                  ))}
                </View>
              </View>

              </> /* end step 1 */
              ) : null}

              {/* ── Step 2 content (or always visible in edit mode) ──────── */}
              {(mode === 'edit' || step === 2) ? (
                <>
              {mode === 'create' && relationshipCandidates.length > 0 ? (
                <View style={styles.sectionSpacing}>
                  <View style={styles.relationshipHeader}>
                    <Text variant="titleSmall">Create relationships now</Text>
                    <Button onPress={() => setPendingRelationships((current) => [...current, createPendingRelationshipDraft()])}>
                      Add relationship
                    </Button>
                  </View>
                  <Text variant="bodyMedium" style={styles.helperText}>
                    Queue one or more relationships to create as soon as this family member is saved.
                  </Text>

                  {pendingRelationships.map((draft, index) => {
                    const filteredCandidates = draft.relatedPersonId
                      ? []
                      : relationshipCandidates.filter((candidate) =>
                          formatPersonName(candidate).toLowerCase().includes(draft.searchQuery.trim().toLowerCase()),
                        );
                    const selectedPerson = draft.relatedPersonId
                      ? relationshipCandidates.find((c) => c.id === draft.relatedPersonId)
                      : null;
                    const clearSelection = () =>
                      setPendingRelationships((current) =>
                        current.map((item) => item.key === draft.key ? { ...item, relatedPersonId: '', searchQuery: '' } : item),
                      );
                    return (
                      <View key={draft.key} style={styles.pendingRelationshipCard}>
                        <View style={styles.relationshipHeader}>
                          <Text variant="titleSmall">Relationship {index + 1}</Text>
                          <IconButton
                            icon="delete"
                            size={18}
                            onPress={() => setPendingRelationships((current) => current.filter((item) => item.key !== draft.key))}
                            disabled={loading}
                          />
                        </View>
                        <SegmentedButtons
                          value={draft.mode}
                          onValueChange={(value) => {
                            setPendingRelationships((current) => current.map((item) => item.key === draft.key ? { ...item, mode: value as PendingRelationshipMode } : item));
                            if (relationshipError) setRelationshipError(null);
                          }}
                          buttons={relationshipModeOptions}
                        />
                        {selectedPerson ? (
                          <View style={styles.selectedPersonRow}>
                            <Chip
                              selected
                              closeIcon="close"
                              onClose={clearSelection}
                              onPress={clearSelection}
                              style={styles.selectedPersonChip}
                            >
                              {formatPersonName(selectedPerson)}
                            </Chip>
                          </View>
                        ) : (
                          <>
                            <TextInput
                              mode="outlined"
                              label="Search family member"
                              value={draft.searchQuery}
                              onChangeText={(value) => setPendingRelationships((current) => current.map((item) => item.key === draft.key ? { ...item, searchQuery: value } : item))}
                              style={styles.fieldSpacing}
                              disabled={loading}
                            />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relationshipChipRow}>
                              {filteredCandidates.map((candidate) => (
                                <Chip
                                  key={`${draft.key}-${candidate.id}`}
                                  onPress={() => {
                                    setPendingRelationships((current) => current.map((item) => item.key === draft.key ? { ...item, relatedPersonId: candidate.id, searchQuery: '' } : item));
                                    if (relationshipError) setRelationshipError(null);
                                  }}
                                  style={styles.relationshipChip}
                                  disabled={loading}
                                >
                                  {formatPersonName(candidate)}
                                </Chip>
                              ))}
                            </ScrollView>
                          </>
                        )}
                      </View>
                    );
                  })}
                  <HelperText type="error" visible={!!relationshipError}>
                    {relationshipError}
                  </HelperText>

                  {coParentSuggestion ? (
                    <View style={[styles.coParentBanner, { backgroundColor: theme.colors.secondaryContainer, borderRadius: 8 }]}>
                      <View style={{ flex: 1 }}>
                        <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                          Also add {formatPersonName(coParentSuggestion)} as a parent?
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer, opacity: 0.8 }}>
                          They are a spouse of the selected parent.
                        </Text>
                      </View>
                      <Button
                        compact
                        mode="contained-tonal"
                        onPress={() => {
                          setPendingRelationships((current) => [
                            ...current,
                            {
                              key: `${Date.now()}-${Math.random()}`,
                              mode: 'child-of',
                              relatedPersonId: coParentSuggestion.id,
                              searchQuery: '',
                            },
                          ]);
                        }}
                        disabled={loading}
                      >
                        Add
                      </Button>
                    </View>
                  ) : null}

                  {showMaidenNameSuggestion ? (
                    <View style={[styles.coParentBanner, { backgroundColor: theme.colors.tertiaryContainer ?? theme.colors.secondaryContainer, borderRadius: 8 }]}>
                      <View style={{ flex: 1 }}>
                        <Text variant="labelMedium" style={{ color: (theme.colors as any).onTertiaryContainer ?? theme.colors.onSecondaryContainer }}>
                          💍 Did their surname change at marriage?
                        </Text>
                        <Text variant="bodySmall" style={{ color: (theme.colors as any).onTertiaryContainer ?? theme.colors.onSecondaryContainer, opacity: 0.8 }}>
                          Record their original surname as a maiden name in Step 1.
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              </> /* end step 2 / edit wrapper */
              ) : null}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, styles.dialogActions, { borderTopColor: theme.colors.outlineVariant, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            {/* Left side: delete button (edit) or step indicator (create step 2) */}
            {mode === 'edit' && onDelete ? (
              <Button
                mode="text"
                textColor={theme.colors.error}
                disabled={loading}
                onPress={() => {
                  Alert.alert(
                    'Delete family member',
                    'Remove this person and all their relationships? This cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => void onDelete() },
                    ],
                  );
                }}
              >
                Delete member
              </Button>
            ) : mode === 'create' && step === 2 ? (
              <Button mode="outlined" onPress={() => setStep(1)} disabled={loading}>Back</Button>
            ) : (
              <View />
            )}
            {/* Right side: step-1 next or final submit */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {mode === 'create' && step === 1 ? (
                <>
                  <Button mode="outlined" onPress={onDismiss} disabled={loading}>Cancel</Button>
                  <Button mode="contained" onPress={handleNextStep} disabled={loading}>Next</Button>
                </>
              ) : (
                <>
                  <Button mode="outlined" onPress={mode === 'edit' ? onDismiss : onDismiss} disabled={loading}>Cancel</Button>
                  <Button mode="contained" onPress={handleSubmit} disabled={loading}>
                    {mode === 'create' ? 'Create' : 'Save'}
                  </Button>
                </>
              )}
            </View>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <DatePickerModal
        locale="en"
        mode="single"
        visible={birthDatePickerVisible}
        date={selectedBirthDate}
        onDismiss={() => setBirthDatePickerVisible(false)}
        onConfirm={({ date }) => {
          setBirthDatePickerVisible(false);
          if (date) {
            setBirthDate(formatIsoDate(date));
          }
        }}
        saveLabel="Save"
        label="Select birth date"
      />

      <DatePickerModal
        locale="en"
        mode="single"
        visible={deathDatePickerVisible}
        date={selectedDeathDate}
        onDismiss={() => setDeathDatePickerVisible(false)}
        onConfirm={({ date }) => {
          setDeathDatePickerVisible(false);
          if (date) {
            setDeathDate(formatIsoDate(date));
            if (deathDateError) {
              setDeathDateError(null);
            }
          }
        }}
        saveLabel="Save"
        label="Select date of death"
      />
    </>
  );
}
