import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  HelperText,
  IconButton,
  List,
  Menu,
  Portal,
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
import AddPersonEntryDialog from './add-person-entry-dialog';

const styles = GlobalStyles.personFormDialog;
const dialogChrome = GlobalStyles.dialogChrome;
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
  onSelectRelationshipAttempt?: (mode: PendingRelationshipMode, relatedPerson: PersonRecord) => Promise<boolean> | boolean;
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

function formatPreviewName(payload: Pick<PersonFormSubmission, 'firstName' | 'middleNames' | 'lastName'>) {
  return [payload.firstName, payload.middleNames, payload.lastName].join(' ').replace(/\s+/g, ' ').trim();
}

function normaliseSurnameValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getPendingRelationshipSectionName(firstNameValue: string, lastNameValue: string) {
  return [firstNameValue, lastNameValue].join(' ').replace(/\s+/g, ' ').trim();
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
  onSelectRelationshipAttempt,
  onDismiss,
  onSubmit,
  onDelete,
}: PersonFormDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();
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
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [birthDateError, setBirthDateError] = useState<string | null>(null);
  const [deathDateError, setDeathDateError] = useState<string | null>(null);
  const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);
  const [deathDatePickerVisible, setDeathDatePickerVisible] = useState(false);
  const [pendingRelationships, setPendingRelationships] = useState<PendingRelationshipDraft[]>([]);
  const [surnameMenuVisible, setSurnameMenuVisible] = useState(false);
  const [lastNameTouched, setLastNameTouched] = useState(false);
  const [showCustomSurnameInput, setShowCustomSurnameInput] = useState(false);
  const [preferredPhotoRef, setPreferredPhotoRef] = useState('');
  const [previewState, setPreviewState] = useState<SubmissionPreviewState>({ visible: false, payload: null, warnings: [] });
  const [submitPending, setSubmitPending] = useState(false);
  const [addConnectionDialogVisible, setAddConnectionDialogVisible] = useState(false);
  const [surnameVariantConfirmDialogVisible, setSurnameVariantConfirmDialogVisible] = useState(false);
  const [proposedSurnameVariant, setProposedSurnameVariant] = useState<string | null>(null);
  const [surnameVariantHints, setSurnameVariantHints] = useState<string[]>([]);

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
    setLastNameError(null);
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
    setShowCustomSurnameInput(false);
    setPreferredPhotoRef(person?.preferredPhotoId ?? initialValues?.preferredPhotoRef ?? '');
    setPreviewState({ visible: false, payload: null, warnings: [] });
    setSubmitPending(false);
    setAddConnectionDialogVisible(false);
    setSurnameVariantConfirmDialogVisible(false);
    setProposedSurnameVariant(null);
    setSurnameVariantHints([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mode, person?.id]);

  useEffect(() => {
    if (!loading) {
      setSubmitPending(false);
    }
  }, [loading]);

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
    surnameVariantHints: !hasExistingSurnames && lastName.trim()
      ? [...new Set([...surnameVariantHints, lastName.trim()])]
      : surnameVariantHints,
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
  const hasExistingSurnames = uniqueLastNames.length > 0;
  const normalizedTreeSurnames = useMemo(
    () => new Set(uniqueLastNames.map(normaliseSurnameValue)),
    [uniqueLastNames],
  );
  const hasMatchingExistingSurname = useMemo(
    () => normalizedTreeSurnames.has(normaliseSurnameValue(lastName)),
    [lastName, normalizedTreeSurnames],
  );
  const relationshipCandidatesById = useMemo(
    () => new Map(relationshipCandidates.map((candidate) => [candidate.id, candidate])),
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
    requireRelationshipContext: mode === 'create' && pendingRelationships.some((relationship) => relationship.relatedPersonId),
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
      requireRelationshipContext: deferredValidationInput.requireRelationshipContext,
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
  const effectiveLastNameSelection = useMemo(() => {
    if (lastName.trim()) {
      return lastName.trim();
    }

    if (mode === 'create' && !lastNameTouched && suggestedLastName) {
      return suggestedLastName;
    }

    return '';
  }, [lastName, lastNameTouched, mode, suggestedLastName]);

  useEffect(() => {
    if (mode !== 'create' || !suggestedLastName || lastNameTouched) {
      return;
    }

    setLastName(suggestedLastName);
    setShowCustomSurnameInput(false);
  }, [lastNameTouched, mode, suggestedLastName]);

  useEffect(() => {
    if (!lastName.trim()) {
      setShowCustomSurnameInput(uniqueLastNames.length === 0);
      return;
    }

    setShowCustomSurnameInput(!hasMatchingExistingSurname);
  }, [hasMatchingExistingSurname, lastName, uniqueLastNames.length]);

  const selectedRelationshipDraft = mode === 'create'
    ? pendingRelationships.find((relationship) => relationship.relatedPersonId) ?? null
    : null;
  const selectedRelationshipPerson = selectedRelationshipDraft
    ? relationshipCandidatesById.get(selectedRelationshipDraft.relatedPersonId) ?? null
    : null;
  const dialogTitle = mode === 'edit'
    ? t(K.personForm.editFamilyMember)
    : selectedRelationshipDraft && selectedRelationshipPerson
      ? t(K.personForm.addRelatedFamilyMemberTitle, {
          name: formatPersonName(selectedRelationshipPerson),
          relationship: t(
            selectedRelationshipDraft.mode === 'spouse-of'
              ? K.relationship.spouse
              : selectedRelationshipDraft.mode === 'child-of'
                ? K.relationship.child
                : K.relationship.parent,
          ),
        })
      : t(K.personForm.addFamilyMember);
  const pendingRelationshipSectionName = getPendingRelationshipSectionName(firstName, lastName);
  const addAnotherConnectionLabel = pendingRelationshipSectionName
    ? t(K.personForm.addAnotherConnectionForName, { name: pendingRelationshipSectionName })
    : t(K.personForm.addAnotherConnection);

  const handleSubmit = async () => {
    const firstError = personValidationFeedback.errors.find((message) => message === t(K.personForm.firstNameRequiredError));
    if (firstError) {
      setFirstNameError(firstError);
      return;
    }

    // Check if last name is compulsory and not empty
    if (!lastName.trim()) {
      setLastNameError(t(K.personForm.lastNameRequired));
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

    if (mode === 'create' && hasExistingSurnames) {
      const trimmedLastName = lastName.trim();
      const normalizedLastName = normaliseSurnameValue(trimmedLastName);
      const isNewSurname = trimmedLastName.length > 0 && !normalizedTreeSurnames.has(normalizedLastName);

      if (isNewSurname) {
        setProposedSurnameVariant(trimmedLastName);
        setSurnameVariantConfirmDialogVisible(true);
        return;
      }
    }

    setPreviewState({
      visible: true,
      payload: buildSubmissionPayload(),
      warnings: [...personValidationFeedback.warnings, ...relationshipWarnings],
    });
  };

  const getRelationshipPreviewLabel = (relationshipMode: PendingRelationshipMode) => {
    if (relationshipMode === 'spouse-of') {
      return t(K.relationship.spouseOf);
    }

    if (relationshipMode === 'child-of') {
      return gender === 'male'
        ? t(K.relationship.sonOf)
        : gender === 'female'
          ? t(K.relationship.daughterOf)
          : t(K.relationship.childOf);
    }

    return gender === 'male'
      ? t(K.relationship.fatherOf)
      : gender === 'female'
        ? t(K.relationship.motherOf)
        : t(K.relationship.parentOf);
  };

  const getRelationshipCreateDescription = (relationshipMode: PendingRelationshipMode, name: string) => (
    t(
      relationshipMode === 'spouse-of'
        ? K.relationship.createSpouseForName
        : relationshipMode === 'child-of'
          ? K.relationship.createChildForName
          : K.relationship.createParentForName,
      { name },
    )
  );

  const openAddConnectionDialog = () => {
    setRelationshipError(null);
    setAddConnectionDialogVisible(true);
  };

  const handleAddConnection = (relationshipMode: PendingRelationshipMode, relatedPerson: PersonRecord) => {
    setRelationshipError(null);
    setPendingRelationships((current) => [
      ...current,
      {
        key: `${Date.now()}-${Math.random()}`,
        mode: relationshipMode,
        relatedPersonId: relatedPerson.id,
        parentChildKind: relationshipMode === 'spouse-of' ? undefined : DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
        searchQuery: '',
      },
    ]);
  };

  const removePendingRelationship = (relationshipKey: string) => {
    setRelationshipError(null);
    setPendingRelationships((current) => current.filter((relationship) => relationship.key !== relationshipKey));
  };

  const handleSurnameVariantConfirm = () => {
    if (proposedSurnameVariant) {
      const newVariants = [...surnameVariantHints, proposedSurnameVariant];
      const uniqueVariants = [...new Set(newVariants.map((value) => value.trim()).filter(Boolean))];

      setSurnameVariantHints(uniqueVariants);
      setSurnameVariantConfirmDialogVisible(false);
      setProposedSurnameVariant(null);

      setPreviewState({
        visible: true,
        payload: {
          ...buildSubmissionPayload(),
          surnameVariantHints: uniqueVariants,
        },
        warnings: [...personValidationFeedback.warnings, ...relationshipWarnings],
      });
    }
  };

  const handleSurnameVariantDismiss = () => {
    setSurnameVariantConfirmDialogVisible(false);
    setProposedSurnameVariant(null);
  };

  const handlePreviewConfirm = async () => {
    if (!previewState.payload) {
      return;
    }

    const payload = previewState.payload;
    setPreviewState({ visible: false, payload: null, warnings: [] });
    setSubmitPending(true);

    try {
      await onSubmit(payload);
    } finally {
      setSubmitPending(false);
    }
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
            {dialogTitle}
          </Dialog.Title>
          <IconButton icon="close" onPress={onDismiss} disabled={loading} accessibilityLabel={t(K.common.cancel)} style={dialogChrome.closeButton} />
          <Dialog.ScrollArea style={[dialogChrome.scrollArea, styles.scrollArea]}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
                {hasExistingSurnames ? (
                  <>
                    <Menu
                      visible={surnameMenuVisible}
                      onDismiss={() => setSurnameMenuVisible(false)}
                      anchor={(
                        <Button
                          mode="outlined"
                          icon="chevron-down"
                          onPress={() => setSurnameMenuVisible(true)}
                          style={styles.fieldSpacing}
                          disabled={loading}
                        >
                          {effectiveLastNameSelection || t(K.personForm.chooseExistingSurname)}
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
                            setShowCustomSurnameInput(false);
                            setSurnameMenuVisible(false);
                            if (lastNameError) {
                              setLastNameError(null);
                            }
                          }}
                        />
                      ))}
                      <Menu.Item
                        title={t(K.personForm.addDifferentSurnameVariant)}
                        onPress={() => {
                          setShowCustomSurnameInput(true);
                          setLastNameTouched(true);
                          setSurnameMenuVisible(false);
                        }}
                      />
                    </Menu>
                    {showCustomSurnameInput ? (
                      <TextInput
                        mode="outlined"
                        label={t(K.personForm.enterSurnameVariant)}
                        value={lastName}
                        onChangeText={(value) => {
                          setLastName(value);
                          setLastNameTouched(true);
                          if (lastNameError) {
                            setLastNameError(null);
                          }
                        }}
                        disabled={loading}
                        error={!!lastNameError}
                        style={styles.fieldSpacing}
                      />
                    ) : null}
                  </>
                ) : (
                  <TextInput
                    mode="outlined"
                    label={t(K.personForm.enterSurnameVariant)}
                    value={lastName}
                    onChangeText={(value) => {
                      setLastName(value);
                      setLastNameTouched(true);
                      if (lastNameError) {
                        setLastNameError(null);
                      }
                    }}
                    disabled={loading}
                    error={!!lastNameError}
                    style={styles.fieldSpacing}
                  />
                )}
                <HelperText type="error" visible={!!lastNameError}>
                  {lastNameError}
                </HelperText>
                {mode === 'create' && suggestedLastName && hasExistingSurnames ? (
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
              <HelperText type="error" visible={!!relationshipError}>
                {relationshipError}
              </HelperText>
              {mode === 'create' ? (
                <View style={[styles.sectionSpacing, styles.pendingRelationshipsSection, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}>
                  <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                    {t(K.personForm.relationshipsToAdd)}
                  </Text>
                  <Text variant="bodySmall" style={[styles.relationshipSectionHelper, { color: theme.colors.onSurfaceVariant }]}>
                    {pendingRelationshipSectionName
                      ? t(K.personForm.addAnotherConnectionForName, { name: pendingRelationshipSectionName })
                      : t(K.personForm.addAnotherConnectionHelper)}
                  </Text>
                  {pendingRelationships.map((relationshipDraft) => {
                    const relatedPerson = relationshipCandidatesById.get(relationshipDraft.relatedPersonId);
                    const relatedPersonName = relatedPerson ? formatPersonName(relatedPerson) : relationshipDraft.relatedPersonId;

                    return (
                      <List.Item
                        key={relationshipDraft.key}
                        style={styles.pendingRelationshipItem}
                        title={`${getRelationshipPreviewLabel(relationshipDraft.mode)} ${relatedPersonName}`}
                        description={getRelationshipCreateDescription(relationshipDraft.mode, relatedPersonName)}
                        left={(props) => (
                          <List.Icon
                            {...props}
                            icon={
                              relationshipDraft.mode === 'parent-of'
                                ? 'account-arrow-up-outline'
                                : relationshipDraft.mode === 'child-of'
                                  ? 'account-arrow-down-outline'
                                  : 'account-heart-outline'
                            }
                          />
                        )}
                        right={() => (
                          <IconButton
                            icon="close"
                            onPress={() => removePendingRelationship(relationshipDraft.key)}
                            accessibilityLabel={t(K.personForm.removePendingRelationship)}
                          />
                        )}
                      />
                    );
                  })}
                  <Button
                    mode="text"
                    icon="plus"
                    onPress={openAddConnectionDialog}
                    disabled={loading || relationshipCandidates.length === 0}
                    style={styles.addConnectionButton}
                  >
                    {addAnotherConnectionLabel}
                  </Button>
                </View>
              ) : null}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, styles.dialogActions, { borderTopColor: theme.colors.outlineVariant, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
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
            ) : (
              <View />
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button mode="contained" onPress={handleSubmit} disabled={loading}>
                {mode === 'create' ? t(K.common.create) : t(K.common.save)}
              </Button>
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
                  <Text variant="titleMedium">{formatPreviewName(previewState.payload)}</Text>
                  <Text variant="bodyMedium" style={styles.helperText}>
                    {mode === 'create' ? t(K.personForm.readyToCreateFamilyMember) : t(K.personForm.readyToSaveFamilyMember)}
                  </Text>
                  <Text variant="titleSmall" style={styles.sectionSpacing}>{t(K.common.summary)}</Text>
                  <Text variant="bodyMedium">{t(K.personForm.gender)}: {previewState.payload.gender}</Text>
                  {previewState.payload.birthDate ? <Text variant="bodyMedium">{t(K.personProfile.birth)}: {formatPersonDate(previewState.payload.birthDate)}</Text> : null}
                  {previewState.payload.deathDate ? <Text variant="bodyMedium">{t(K.personProfile.inMemory)}: {formatPersonDate(previewState.payload.deathDate)}</Text> : null}
                  {previewState.payload.maidenName ? <Text variant="bodyMedium">{t(K.personForm.maidenName)}: {previewState.payload.maidenName}</Text> : null}
                  {previewState.payload.pendingRelationships.length > 0 ? (
                    <View style={styles.sectionSpacing}>
                      <Text variant="titleSmall">{t(K.personForm.relationshipsToAdd)}</Text>
                      {previewState.payload.pendingRelationships.map((relationship, index) => {
                        const relatedPerson = relationshipCandidatesById.get(relationship.relatedPersonId);
                        return (
                          <Text key={`${relationship.relatedPersonId}-${index}`} variant="bodyMedium">
                            {index + 1}. {getRelationshipPreviewLabel(relationship.mode)} {relatedPerson ? formatPersonName(relatedPerson) : relationship.relatedPersonId}
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
                void handlePreviewConfirm();
              }}
              disabled={loading || !previewState.payload}
            >
              {mode === 'create' ? t(K.common.create) : t(K.common.save)}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <AddPersonEntryDialog
        visible={addConnectionDialogVisible}
        hasExistingFamilyMembers={relationshipCandidates.length > 0}
        relationshipCandidates={relationshipCandidates}
        relationships={relationships}
        existingPendingRelationships={pendingRelationships.map(({ mode, relatedPersonId, parentChildKind }) => ({
          mode,
          relatedPersonId,
          parentChildKind,
        }))}
        allowUnrelatedEntry={false}
        chooserTitleKey={K.personForm.addAnotherConnectionTitle}
        chooserHelperKey={K.personForm.addAnotherConnectionHelper}
        newPersonName={firstName}
        onDismiss={() => setAddConnectionDialogVisible(false)}
        onSelectRelationship={handleAddConnection}
        onSelectRelationshipAttempt={onSelectRelationshipAttempt}
      />
      <Portal>
        <Dialog
          visible={submitPending || loading}
          dismissable={false}
          style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Content style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
            <Text variant="titleMedium" style={{ marginTop: 16 }}>
              {mode === 'create' ? t(K.personForm.creatingFamilyMember) : t(K.personForm.savingFamilyMember)}
            </Text>
            <Text variant="bodyMedium" style={[styles.helperText, { textAlign: 'center', marginTop: 8 }]}>
              {t(K.personForm.savingFamilyMemberHelper)}
            </Text>
          </Dialog.Content>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={surnameVariantConfirmDialogVisible}
          onDismiss={handleSurnameVariantDismiss}
          style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>
            {t(K.personForm.confirmNewSurname ?? 'Confirm New Surname')}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.helperText}>
              {t(K.personForm.surnameNotInTree)}
            </Text>
            <Text variant="bodyMedium" style={styles.helperText}>
              {t(K.personForm.confirmSurnameCorrect, { surname: proposedSurnameVariant ?? '' })}
            </Text>
            {proposedSurnameVariant && (
              <Text variant="titleSmall" style={[styles.sectionSpacing, { fontWeight: 'bold' }]}>
                {proposedSurnameVariant}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions style={dialogChrome.dialogActions}>
            <Button onPress={handleSurnameVariantDismiss} disabled={loading}>
              {t(K.common.cancel)}
            </Button>
            <Button mode="contained" onPress={handleSurnameVariantConfirm} disabled={loading}>
              {t(K.common.confirm ?? 'Confirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
