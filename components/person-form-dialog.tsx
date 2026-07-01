import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
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
import type { ParentChildRelationshipKind, RelationshipRecord } from './dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND } from './dto/relationship';
import { getPersonValidationFeedback, getRelationshipValidationFeedback } from './family-tree-validation';
import { GlobalStyles } from '../constants/styles';
import { useI18n } from '../hooks/use-i18n';
import { I18N_KEYS as K } from '../i18n/keys';

const styles = GlobalStyles.personFormDialog;
const dialogChrome = GlobalStyles.dialogChrome;
const MAX_RELATIONSHIP_CANDIDATES = 20;

export type PendingRelationshipMode = 'parent-of' | 'child-of' | 'spouse-of';

export interface PendingRelationshipSubmission {
  mode: PendingRelationshipMode;
  relatedPersonId: string;
  parentChildKind?: ParentChildRelationshipKind;
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

type SubmissionPreviewState = {
  visible: boolean;
  payload: PersonFormSubmission | null;
  warnings: string[];
};

const genderOptions: Array<{ label: string; value: PersonGender }> = [
  { label: K.common.unspecified, value: 'unspecified' },
  { label: K.common.female, value: 'female' },
  { label: K.common.male, value: 'male' },
  { label: K.common.nonBinary, value: 'non-binary' },
  { label: K.common.other, value: 'other' },
];


function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const todayDate = new Date();
todayDate.setHours(0, 0, 0, 0);

function parseIsoDate(value: string) {
  if (!value) {
    return undefined;
  }

  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}

function formatDateButtonLabel(value: string, t: (key: string, values?: Record<string, string | number>) => string) {
  return value ? formatPersonDate(value) : t(K.common.pickDate);
}

function formatPersonName(person: PersonRecord) {
  return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim();
}

function createValidationPersonRecord(input: {
  firstName: string;
  middleNames: string;
  lastName: string;
  maidenName: string;
  birthDate: string;
  deathDate: string;
  gender: PersonGender;
  notes: string;
  lifeEvents: PersonLifeEvent[];
  person?: PersonRecord | null;
}): PersonRecord {
  return {
    id: '__new-person__',
    treeId: input.person?.treeId ?? '',
    treeMembershipIds: [],
    treeMemberships: [],
    ownerId: input.person?.ownerId ?? '',
    firstName: input.firstName,
    middleNames: input.middleNames,
    lastName: input.lastName,
    maidenName: input.maidenName,
    nicknames: [],
    clanName: '',
    familyBranch: '',
    hometown: '',
    birthPlace: '',
    surnameVariantHints: [],
    canonicalPersonId: '',
    duplicatePersonIds: [],
    birthDate: input.birthDate,
    deathDate: input.deathDate,
    gender: input.gender,
    notes: input.notes,
    lifeEvents: input.lifeEvents,
    photos: [],
    preferredPhotoId: '',
    createdAt: '',
    updatedAt: '',
  };
}

function createPendingValidationRelationships(
  pendingDrafts: PendingRelationshipDraft[],
): RelationshipRecord[] {
  return pendingDrafts
    .filter((draft) => draft.relatedPersonId)
    .map((draft, index) => ({
      id: `__pending-relationship__-${index}`,
      treeId: '',
      ownerId: '',
      type: draft.mode === 'spouse-of' ? 'spouse' : 'parent-child',
      fromPersonId: draft.mode === 'child-of' ? draft.relatedPersonId : '__new-person__',
      toPersonId: draft.mode === 'child-of' ? '__new-person__' : draft.relatedPersonId,
      parentChildKind: draft.mode === 'spouse-of' ? undefined : draft.parentChildKind,
      createdAt: '',
    }));
}

function createPendingRelationshipDraft(): PendingRelationshipDraft {
  return {
    key: `${Date.now()}-${Math.random()}`,
    mode: 'parent-of',
    relatedPersonId: '',
    parentChildKind: DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
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
    parentChildKind: relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
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
  const { t } = useI18n();
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
  const [birthDateError, setBirthDateError] = useState<string | null>(null);
  const [deathDateError, setDeathDateError] = useState<string | null>(null);
  const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);
  const [deathDatePickerVisible, setDeathDatePickerVisible] = useState(false);
  const [pendingRelationships, setPendingRelationships] = useState<PendingRelationshipDraft[]>([]);
  const [surnameMenuVisible, setSurnameMenuVisible] = useState(false);
  const [lastNameTouched, setLastNameTouched] = useState(false);
  const [preferredPhotoRef, setPreferredPhotoRef] = useState('');
  const [previewState, setPreviewState] = useState<SubmissionPreviewState>({ visible: false, payload: null, warnings: [] });

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
    setBirthDateError(null);
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
    setPreviewState({ visible: false, payload: null, warnings: [] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode, person?.id]);

  const buildSubmissionPayload = () => ({
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
    cropPreferredPhotoRef: '',
    existingPhotos,
    removedPhotos,
    newPhotoUris,
    pendingRelationships: pendingRelationships.map(({ mode: relationshipMode, relatedPersonId, parentChildKind }) => ({
      mode: relationshipMode,
      relatedPersonId,
      parentChildKind: relationshipMode === 'spouse-of' ? undefined : parentChildKind,
    })),
  } satisfies PersonFormSubmission);

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
  const relationshipCandidateSearchIndex = useMemo(
    () => relationshipCandidates.map((candidate) => ({
      candidate,
      searchableName: formatPersonName(candidate).toLowerCase(),
    })),
    [relationshipCandidates],
  );
  const validationPersonRecord = useMemo(
    () => createValidationPersonRecord({
      firstName,
      middleNames,
      lastName,
      maidenName,
      birthDate,
      deathDate: isPresent ? '' : deathDate,
      gender,
      notes,
      lifeEvents,
      person,
    }),
    [birthDate, deathDate, firstName, gender, isPresent, lastName, lifeEvents, maidenName, middleNames, notes, person],
  );
  const pendingValidationRelationships = useMemo(() => createPendingValidationRelationships(pendingRelationships), [pendingRelationships]);
  const deferredValidationInput = useDeferredValue({
    firstName,
    middleNames,
    lastName,
    maidenName,
    birthDate,
    deathDate: isPresent ? '' : deathDate,
    notes,
    lifeEvents,
    existingPhotos,
    removedPhotos,
    newPhotoUris,
    pendingRelationships,
    pendingValidationRelationships,
    personId: person?.id,
    requireIdentityContext: mode === 'create',
  });
  const personValidationFeedback = useMemo(
    () => getPersonValidationFeedback({
      people: relationshipCandidates,
      relationships: [...relationships, ...deferredValidationInput.pendingValidationRelationships],
      person: {
        firstName: deferredValidationInput.firstName,
        middleNames: deferredValidationInput.middleNames,
        lastName: deferredValidationInput.lastName,
        maidenName: deferredValidationInput.maidenName,
        birthDate: deferredValidationInput.birthDate,
        deathDate: deferredValidationInput.deathDate,
        notes: deferredValidationInput.notes,
        lifeEvents: deferredValidationInput.lifeEvents,
      },
      pendingRelationships: deferredValidationInput.pendingRelationships,
      existingPhotos: deferredValidationInput.existingPhotos,
      removedPhotos: deferredValidationInput.removedPhotos,
      newPhotoUris: deferredValidationInput.newPhotoUris,
      requireIdentityContext: deferredValidationInput.requireIdentityContext,
      ignorePersonId: deferredValidationInput.personId,
    }),
    [deferredValidationInput, relationshipCandidates, relationships],
  );
  const validationPeople = useMemo(
    () => [validationPersonRecord, ...new Map(relationshipCandidates.map((candidate) => [candidate.id, candidate])).values()],
    [relationshipCandidates, validationPersonRecord],
  );
  const pendingValidationRelationshipIdByCompositeKey = useMemo(() => {
    const relationshipIdByCompositeKey = new Map<string, string>();

    pendingValidationRelationships.forEach((relationship) => {
      relationshipIdByCompositeKey.set(
        `${relationship.type}:${relationship.fromPersonId}:${relationship.toPersonId}`,
        relationship.id,
      );
    });

    return relationshipIdByCompositeKey;
  }, [pendingValidationRelationships]);
  const pendingRelationshipFeedbackByKey = useMemo(() => {
    const allRelationships = [...relationships, ...pendingValidationRelationships];
    const feedbackByKey = new Map<string, { warnings: string[]; errors: string[] }>();

    pendingRelationships.forEach((draft) => {
      if (!draft.relatedPersonId) {
        feedbackByKey.set(draft.key, { warnings: [], errors: [] });
        return;
      }

      const relatedPerson = relationshipCandidatesById.get(draft.relatedPersonId);
      if (!relatedPerson) {
        feedbackByKey.set(draft.key, { warnings: [], errors: [] });
        return;
      }

      const relationshipType = draft.mode === 'spouse-of' ? 'spouse' : 'parent-child';
      const fromPersonId = draft.mode === 'child-of' ? draft.relatedPersonId : '__new-person__';
      const toPersonId = draft.mode === 'child-of' ? '__new-person__' : draft.relatedPersonId;
      const ignoreRelationshipId = pendingValidationRelationshipIdByCompositeKey.get(
        `${relationshipType}:${fromPersonId}:${toPersonId}`,
      );

      const feedback = getRelationshipValidationFeedback({
        people: validationPeople,
        relationships: allRelationships,
        type: relationshipType,
        fromPersonId,
        toPersonId,
        parentChildKind: draft.mode === 'spouse-of' ? undefined : draft.parentChildKind,
        ignoreRelationshipId,
      });

      feedbackByKey.set(draft.key, {
        warnings: feedback.warnings.map((warning) => `${formatPersonName(relatedPerson)}: ${warning}`),
        errors: feedback.errors.map((error) => `${formatPersonName(relatedPerson)}: ${error}`),
      });
    });

    return feedbackByKey;
  }, [pendingRelationships, pendingValidationRelationshipIdByCompositeKey, pendingValidationRelationships, relationshipCandidatesById, relationships, validationPeople]);
  const relationshipWarnings = useMemo(
    () => pendingRelationships.flatMap((draft) => pendingRelationshipFeedbackByKey.get(draft.key)?.warnings ?? []),
    [pendingRelationships, pendingRelationshipFeedbackByKey],
  );
  const relationshipSearchResultsByKey = useMemo(() => {
    const resultsByKey = new Map<string, PersonRecord[]>();

    pendingRelationships.forEach((draft) => {
      if (draft.relatedPersonId) {
        resultsByKey.set(draft.key, []);
        return;
      }

      const normalizedQuery = draft.searchQuery.trim().toLowerCase();
      if (!normalizedQuery) {
        resultsByKey.set(draft.key, relationshipCandidates.slice(0, MAX_RELATIONSHIP_CANDIDATES));
        return;
      }

      const matches: PersonRecord[] = [];
      for (const entry of relationshipCandidateSearchIndex) {
        if (entry.searchableName.includes(normalizedQuery)) {
          matches.push(entry.candidate);
          if (matches.length >= MAX_RELATIONSHIP_CANDIDATES) {
            break;
          }
        }
      }

      resultsByKey.set(draft.key, matches);
    });

    return resultsByKey;
  }, [pendingRelationships, relationshipCandidateSearchIndex, relationshipCandidates]);

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

  const spouseIdByPersonId = useMemo(() => {
    const spouseLookup = new Map<string, string>();

    relationships.forEach((relationship) => {
      if (relationship.type !== 'spouse') {
        return;
      }

      if (!spouseLookup.has(relationship.fromPersonId)) {
        spouseLookup.set(relationship.fromPersonId, relationship.toPersonId);
      }
      if (!spouseLookup.has(relationship.toPersonId)) {
        spouseLookup.set(relationship.toPersonId, relationship.fromPersonId);
      }
    });

    return spouseLookup;
  }, [relationships]);

  // ── Co-parent suggestion ──────────────────────────────────────────────────
  // When user sets a "child-of" relationship, check if that parent has a spouse
  // who isn't already in pendingRelationships. If so, offer to add them too.
  const coParentSuggestion = useMemo((): PersonRecord | null => {
    if (mode !== 'create' || !relationships.length) return null;

    const childOfDraft = pendingRelationships.find((d) => d.mode === 'child-of' && d.relatedPersonId);
    if (!childOfDraft) return null;

    const parentId = childOfDraft.relatedPersonId;

    // Find a spouse of that parent
    const otherParentId = spouseIdByPersonId.get(parentId);
    if (!otherParentId) return null;

    // Only suggest if not already added
    const alreadyAdded = pendingRelationships.some(
      (d) => d.mode === 'child-of' && d.relatedPersonId === otherParentId,
    );
    if (alreadyAdded) return null;

    return relationshipCandidatesById.get(otherParentId) ?? null;
  }, [mode, pendingRelationships, relationshipCandidatesById, relationships.length, spouseIdByPersonId]);
  // ─────────────────────────────────────────────────────────────────────────

  // Gender-aware relationship mode labels
  const relationshipModeOptions = useMemo(() => [
    {
      label: gender === 'male' ? t(K.relationship.fatherOf) : gender === 'female' ? t(K.relationship.motherOf) : t(K.relationship.parentOf),
      value: 'parent-of' as PendingRelationshipMode,
    },
    {
      label: gender === 'male' ? t(K.relationship.sonOf) : gender === 'female' ? t(K.relationship.daughterOf) : t(K.relationship.childOf),
      value: 'child-of' as PendingRelationshipMode,
    },
    { label: t(K.relationship.spouseOf), value: 'spouse-of' as PendingRelationshipMode },
  ], [gender, t]);

  const handleNextStep = () => {
    const firstError = personValidationFeedback.errors.find((message) => message === t(K.personForm.firstNameRequiredError));
    if (firstError) {
      setFirstNameError(firstError);
      return;
    }
    const futureBirthDateError = personValidationFeedback.errors.find((message) => message === t(K.personForm.birthDateInFuture));
    if (futureBirthDateError) {
      setBirthDateError(futureBirthDateError);
      return;
    }
    const futureDeathDateError = personValidationFeedback.errors.find((message) => message === t(K.personForm.deathDateInFuture));
    if (futureDeathDateError) {
      setDeathDateError(futureDeathDateError);
      return;
    }
    const deathError = personValidationFeedback.errors.find((message) => message === t(K.personForm.deathDateBeforeBirth));
    if (deathError) {
      setDeathDateError(deathError);
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    const firstError = personValidationFeedback.errors.find((message) => message === t(K.personForm.firstNameRequiredError));
    if (firstError) {
      setFirstNameError(firstError);
      return;
    }
    const futureBirthDateError = personValidationFeedback.errors.find((message) => message === t(K.personForm.birthDateInFuture));
    if (futureBirthDateError) {
      setBirthDateError(futureBirthDateError);
      return;
    }
    const futureDeathDateError = personValidationFeedback.errors.find((message) => message === t(K.personForm.deathDateInFuture));
    if (futureDeathDateError) {
      setDeathDateError(futureDeathDateError);
      return;
    }

    if (mode === 'create') {
      const hasIncompleteRelationship = pendingRelationships.some((draft) => !draft.relatedPersonId);
      if (hasIncompleteRelationship) {
        setRelationshipError(t(K.personForm.chooseFamilyMemberForRelationship));
        return;
      }

      const duplicateKeys = new Set<string>();
      for (const draft of pendingRelationships) {
        const compositeKey = `${draft.mode}:${draft.relatedPersonId}`;
        if (duplicateKeys.has(compositeKey)) {
          setRelationshipError(t(K.personForm.removeDuplicatePendingRelationships));
          return;
        }
        duplicateKeys.add(compositeKey);
      }
    }

    const deathError = personValidationFeedback.errors.find((message) => message === t(K.personForm.deathDateBeforeBirth));
    if (deathError) {
      setDeathDateError(deathError);
      return;
    }

    const duplicateError = personValidationFeedback.errors.find((message) => message !== t(K.personForm.firstNameRequiredError) && message !== t(K.personForm.deathDateBeforeBirth));
    if (duplicateError) {
      setRelationshipError(duplicateError);
      return;
    }

    const pendingRelationshipError = pendingRelationships
      .map((draft) => pendingRelationshipFeedbackByKey.get(draft.key)?.errors[0] ?? null)
      .find(Boolean);

    if (pendingRelationshipError) {
      setRelationshipError(pendingRelationshipError);
      return;
    }

    setPreviewState({
      visible: true,
      payload: buildSubmissionPayload(),
      warnings: [...personValidationFeedback.warnings, ...relationshipWarnings],
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
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose, styles.dialogTitle]}>
            {mode === 'create'
              ? (step === 1 ? t(K.personForm.addFamilyMember) : t(K.personForm.addRelationships))
              : t(K.personForm.editFamilyMember)}
          </Dialog.Title>
          <IconButton icon="close" onPress={onDismiss} disabled={loading} accessibilityLabel={t(K.common.cancel)} style={dialogChrome.closeButton} />
          {mode === 'create' ? (
            <View style={[styles.stepProgressRow, { borderBottomColor: theme.colors.outlineVariant }]}>
              <View style={[styles.stepDot, step >= 1 && { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.stepLine, { backgroundColor: step >= 2 ? theme.colors.primary : theme.colors.outlineVariant }]} />
              <View style={[styles.stepDot, step >= 2 && { backgroundColor: theme.colors.primary }]} />
              <Text variant="labelSmall" style={[styles.stepLabel, { color: theme.colors.onSurfaceVariant }]}>
                {t(K.personForm.stepOfTwo, { step })}
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
                label={t(K.personForm.firstNameRequired)}
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
              <HelperText type="info" visible={personValidationFeedback.warnings.length > 0}>
                {personValidationFeedback.warnings[0] ?? ''}
              </HelperText>

              <TextInput
                mode="outlined"
                label={t(K.personForm.secondMiddleNames)}
                value={middleNames}
                onChangeText={setMiddleNames}
                disabled={loading}
              />

              <View style={styles.sectionSpacing}>
                <Text variant="titleSmall">{t(K.personForm.lastName)}</Text>
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
                      {lastName || (uniqueLastNames.length > 0 ? t(K.personForm.chooseExistingSurname) : t(K.personForm.noExistingSurnames))}
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
                  label={t(K.personForm.typeNewSurnameOrEditSelection)}
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
                    {t(K.personForm.suggestedSurnameFromRelationship, { name: suggestedLastName })}
                  </HelperText>
                ) : null}
              </View>

              <View style={styles.sectionSpacing}>
                <Text variant="titleSmall">{t(K.personForm.maidenName)}</Text>
                <TextInput
                  mode="outlined"
                  label={t(K.personForm.maidenBirthSurnameOptional)}
                  value={maidenName}
                  onChangeText={setMaidenName}
                  disabled={loading}
                  style={styles.fieldSpacing}
                />
                <HelperText type="info" visible>
                  {t(K.personForm.surnameHelper)}
                </HelperText>
              </View>

              <View style={styles.sectionSpacing}>
                <Text variant="titleSmall">{t(K.personForm.birthDate)}</Text>
                <View style={styles.birthDateActions}>
                  <Button
                    mode="outlined"
                    icon="calendar"
                    onPress={() => setBirthDatePickerVisible(true)}
                    disabled={loading}
                  >
                    {formatDateButtonLabel(birthDate, t)}
                  </Button>
                  {birthDate ? (
                    <Button onPress={() => {
                      setBirthDate('');
                      if (birthDateError) {
                        setBirthDateError(null);
                      }
                    }} disabled={loading}>
                      {t(K.common.clear)}
                    </Button>
                  ) : null}
                </View>
                <HelperText type="error" visible={!!birthDateError}>
                  {birthDateError}
                </HelperText>
              </View>

              <View style={styles.sectionSpacing}>
                <View style={styles.presentRow}>
                  <Text variant="titleSmall">{t(K.personForm.stillPresent)}</Text>
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
                        {formatDateButtonLabel(deathDate, t)}
                      </Button>
                      {deathDate ? (
                        <Button
                          onPress={() => {
                            setDeathDate('');
                            if (deathDateError) setDeathDateError(null);
                          }}
                          disabled={loading}
                        >
                          {t(K.common.clear)}
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
                <Text variant="titleSmall">{t(K.personForm.gender)}</Text>
                <View style={styles.chipGroup}>
                  {genderOptions.map((option) => (
                    <Chip
                      key={option.value}
                      selected={gender === option.value}
                      onPress={() => setGender(option.value)}
                      disabled={loading}
                      style={styles.chip}
                    >
                      {t(option.label)}
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
                    <Text variant="titleSmall">{t(K.personForm.createRelationshipsNow)}</Text>
                    <Button onPress={() => setPendingRelationships((current) => [...current, createPendingRelationshipDraft()])}>
                      {t(K.personForm.addRelationship)}
                    </Button>
                  </View>
                  <Text variant="bodyMedium" style={styles.helperText}>
                    {t(K.personForm.queueRelationshipsAfterSave)}
                  </Text>

                  {pendingRelationships.map((draft, index) => {
                    const filteredCandidates = relationshipSearchResultsByKey.get(draft.key) ?? [];
                    const selectedPerson = draft.relatedPersonId
                      ? relationshipCandidatesById.get(draft.relatedPersonId) ?? null
                      : null;
                    const clearSelection = () =>
                      setPendingRelationships((current) =>
                        current.map((item) => item.key === draft.key ? { ...item, relatedPersonId: '', searchQuery: '' } : item),
                      );
                    return (
                      <View key={draft.key} style={styles.pendingRelationshipCard}>
                        <View style={styles.relationshipHeader}>
                          <Text variant="titleSmall">{t(K.personForm.relationshipNumber, { number: index + 1 })}</Text>
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
                            setPendingRelationships((current) => current.map((item) => item.key === draft.key ? {
                              ...item,
                              mode: value as PendingRelationshipMode,
                              parentChildKind: value === 'spouse-of' ? undefined : item.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
                            } : item));
                            if (relationshipError) setRelationshipError(null);
                          }}
                          buttons={relationshipModeOptions}
                        />
                        {draft.mode !== 'spouse-of' ? (
                          <View style={styles.sectionSpacing}>
                            <Text variant="bodyMedium">{t(K.personForm.parentChildRelationshipType)}</Text>
                            <View style={styles.chipGroup}>
                              {[
                                { value: 'biological', label: K.relationship.biologicalLabel },
                                { value: 'non-biological', label: K.relationship.nonBiologicalLabel },
                                { value: 'step', label: K.relationship.stepLabel },
                                { value: 'adopted', label: K.relationship.adoptedLabel },
                                { value: 'foster', label: K.relationship.fosterLabel },
                                { value: 'guardian', label: K.relationship.guardianLabel },
                              ].map((option) => (
                                <Chip
                                  key={`${draft.key}-${option.value}`}
                                  selected={draft.parentChildKind === option.value}
                                  onPress={() => {
                                    setPendingRelationships((current) => current.map((item) => item.key === draft.key ? {
                                      ...item,
                                      parentChildKind: option.value as ParentChildRelationshipKind,
                                    } : item));
                                    if (relationshipError) setRelationshipError(null);
                                  }}
                                  style={styles.chip}
                                  disabled={loading}
                                >
                                  {t(option.label)}
                                </Chip>
                              ))}
                            </View>
                          </View>
                        ) : null}
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
                              label={t(K.common.searchFamilyMember)}
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
                  <HelperText type="info" visible={relationshipWarnings.length > 0}>
                    {relationshipWarnings[0] ?? ''}
                  </HelperText>

                  {coParentSuggestion ? (
                    <View style={[styles.coParentBanner, { backgroundColor: theme.colors.secondaryContainer, borderRadius: 8 }]}>
                      <View style={{ flex: 1 }}>
                        <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                          {t(K.personForm.alsoAddParent, { name: formatPersonName(coParentSuggestion) })}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer, opacity: 0.8 }}>
                          {t(K.personForm.spouseOfSelectedParent)}
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
                              parentChildKind: DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
                              searchQuery: '',
                            },
                          ]);
                        }}
                        disabled={loading}
                      >
                        {t(K.common.add)}
                      </Button>
                    </View>
                  ) : null}

                  {showMaidenNameSuggestion ? (
                    <View style={[styles.coParentBanner, { backgroundColor: theme.colors.tertiaryContainer ?? theme.colors.secondaryContainer, borderRadius: 8 }]}>
                      <View style={{ flex: 1 }}>
                        <Text variant="labelMedium" style={{ color: (theme.colors as any).onTertiaryContainer ?? theme.colors.onSecondaryContainer }}>
                          {t(K.personForm.didSurnameChangeAtMarriage)}
                        </Text>
                        <Text variant="bodySmall" style={{ color: (theme.colors as any).onTertiaryContainer ?? theme.colors.onSecondaryContainer, opacity: 0.8 }}>
                          {t(K.personForm.recordOriginalSurnameInStepOne)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              </> /* end step 2 / edit wrapper */
              ) : null}
              <HelperText type="error" visible={!!relationshipError}>
                {relationshipError}
              </HelperText>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, styles.dialogActions, { borderTopColor: theme.colors.outlineVariant, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            {/* Left side: delete button (edit) or step indicator (create step 2) */}
            {mode === 'edit' && onDelete ? (
              <IconButton
                icon="trash-can-outline"
                iconColor={theme.colors.error}
                disabled={loading}
                onPress={() => {
                  Alert.alert(
                    t(K.personForm.deleteFamilyMember),
                    t(K.personForm.removePersonAndRelationships),
                    [
                      { text: t(K.common.cancel), style: 'cancel' },
                      { text: t(K.common.delete), style: 'destructive', onPress: () => void onDelete() },
                    ],
                  );
                }}
                accessibilityLabel={t(K.personForm.deleteMember)}
              />
            ) : mode === 'create' && step === 2 ? (
              <Button mode="outlined" onPress={() => setStep(1)} disabled={loading}>{t(K.common.back)}</Button>
            ) : (
              <View />
            )}
            {/* Right side: step-1 next or final submit */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
              {mode === 'create' && step === 1 ? (
                <>
                  <Button mode="contained" onPress={handleNextStep} disabled={loading}>{t(K.common.next)}</Button>
                </>
              ) : (
                <>
                  <Button mode="contained" onPress={handleSubmit} disabled={loading}>
                    {mode === 'create' ? t(K.common.create) : t(K.common.save)}
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
        validRange={{ endDate: todayDate }}
        onDismiss={() => setBirthDatePickerVisible(false)}
        onConfirm={({ date }) => {
          setBirthDatePickerVisible(false);
          if (date) {
            setBirthDate(formatIsoDate(date));
            if (birthDateError) {
              setBirthDateError(null);
            }
          }
        }}
        saveLabel={t(K.common.save)}
        label={t(K.personForm.selectBirthDate)}
      />

      <DatePickerModal
        locale="en"
        mode="single"
        visible={deathDatePickerVisible}
        date={selectedDeathDate}
        validRange={{ endDate: todayDate }}
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
        saveLabel={t(K.common.save)}
        label={t(K.personForm.selectDateOfDeath)}
      />
      <Portal>
        <Dialog
          visible={previewState.visible}
          onDismiss={loading ? undefined : () => setPreviewState({ visible: false, payload: null, warnings: [] })}
          style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose, styles.dialogTitle]}>
            {t(K.personForm.previewChanges)}
          </Dialog.Title>
          <IconButton icon="close" onPress={() => setPreviewState({ visible: false, payload: null, warnings: [] })} disabled={loading} accessibilityLabel={t(K.common.cancel)} style={dialogChrome.closeButton} />
          <Dialog.ScrollArea style={[dialogChrome.scrollArea, styles.scrollArea]}>
            <ScrollView contentContainerStyle={styles.content}>
              {previewState.payload ? (
                <>
                  <Text variant="titleMedium">{[previewState.payload.firstName, previewState.payload.middleNames, previewState.payload.lastName].join(' ').replace(/\s+/g, ' ').trim()}</Text>
                  <Text variant="bodyMedium" style={styles.helperText}>{previewState.payload.gender}</Text>
                  {previewState.payload.birthDate ? <Text variant="bodyMedium">{t(K.personProfile.birth)}: {formatPersonDate(previewState.payload.birthDate)}</Text> : null}
                  {previewState.payload.deathDate ? <Text variant="bodyMedium">{t(K.personProfile.inMemory)}: {formatPersonDate(previewState.payload.deathDate)}</Text> : null}
                  {previewState.payload.maidenName ? <Text variant="bodyMedium">{t(K.personForm.maidenName)}: {previewState.payload.maidenName}</Text> : null}
                  {previewState.payload.notes ? <Text variant="bodyMedium">{t(K.memories.notes)}: {previewState.payload.notes}</Text> : null}
                  <Text variant="bodyMedium">{t(K.memories.lifeEvents)}: {previewState.payload.lifeEvents.length}</Text>
                  <Text variant="bodyMedium">{t(K.memories.photos)}: {previewState.payload.existingPhotos.length + previewState.payload.newPhotoUris.length - previewState.payload.removedPhotos.length}</Text>
                  {previewState.payload.pendingRelationships.length > 0 ? (
                    <View style={styles.sectionSpacing}>
                      <Text variant="titleSmall">{t(K.personForm.relationshipsToAdd)}</Text>
                      {previewState.payload.pendingRelationships.map((relationship, index) => {
                        const relatedPerson = relationshipCandidatesById.get(relationship.relatedPersonId);
                        return (
                          <Text key={`${relationship.relatedPersonId}-${index}`} variant="bodyMedium">
                            {index + 1}. {relationship.mode} {relatedPerson ? formatPersonName(relatedPerson) : relationship.relatedPersonId}
                          </Text>
                        );
                      })}
                    </View>
                  ) : null}
                  {previewState.warnings.length > 0 ? (
                    <View style={styles.sectionSpacing}>
                      <Text variant="titleSmall">{t(K.personForm.pleaseReviewBeforeSaving)}</Text>
                      {previewState.warnings.map((warning) => (
                        <Text key={warning} variant="bodyMedium" style={styles.helperText}>{warning}</Text>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, styles.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button onPress={() => setPreviewState({ visible: false, payload: null, warnings: [] })} disabled={loading}>{t(K.common.back)}</Button>
            <Button
              mode="contained"
              onPress={() => {
                if (previewState.payload) {
                  void onSubmit(previewState.payload);
                }
              }}
              disabled={loading || !previewState.payload}
            >
              {mode === 'create' ? t(K.common.create) : t(K.common.save)}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
