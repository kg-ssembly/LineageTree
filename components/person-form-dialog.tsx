import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from './dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from './dto/relationship';
import { getPersonValidationFeedback, getRelationshipValidationFeedback } from './family-tree-validation';
import { GlobalStyles } from '../constants/styles';
import { useI18n } from '../hooks/use-i18n';
import { I18N_KEYS as K } from '../i18n/keys';
import AddPersonEntryDialog from './add-person-entry-dialog';
import RelationshipSuggestionsDialog from './relationship-suggestions-dialog';
import RelationshipVisualPreviewDialog from './relationship-visual-preview-dialog';
import { buildRelationshipSuggestions } from './relationship-suggestions';

const styles = GlobalStyles.personFormDialog;
const dialogChrome = GlobalStyles.dialogChrome;
export type PendingRelationshipMode = 'parent-of' | 'child-of' | 'spouse-of';

export interface PendingRelationshipSubmission {
  mode: PendingRelationshipMode;
  relatedPersonId: string;
  parentChildKind?: ParentChildRelationshipKind;
  relationshipStatus?: SpouseRelationshipStatus;
}

interface PendingRelationshipDraft extends PendingRelationshipSubmission {
  key: string;
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
  initialStep?: 1 | 2;
  initialAddConnectionMode?: PendingRelationshipMode | null;
  autoOpenAddConnectionDialog?: boolean;
  relationshipOnly?: boolean;
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
  const firstName = firstNameValue.trim();
  if (firstName) {
    return firstName;
  }

  return [firstNameValue, lastNameValue].join(' ').replace(/\s+/g, ' ').trim();
}

function getResolvedLastNameValue(
  lastNameValue: string,
  mode: 'create' | 'edit',
  lastNameTouchedValue: boolean,
  suggestedLastNameValue: string,
) {
  const trimmedLastName = lastNameValue.trim();
  if (trimmedLastName) {
    return trimmedLastName;
  }

  if (mode === 'create' && !lastNameTouchedValue && suggestedLastNameValue.trim()) {
    return suggestedLastNameValue.trim();
  }

  return '';
}

function getUniqueReviewMessages(messages: string[]) {
  return [...new Set(messages.map((message) => message.trim()).filter(Boolean))];
}

function getAnchorRelationshipSummary(
  relationshipMode: PendingRelationshipMode,
  relatedPersonName: string,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  return t(
    relationshipMode === 'spouse-of'
      ? K.relationship.createSpouseForName
      : relationshipMode === 'child-of'
        ? K.relationship.createChildForName
        : K.relationship.createParentForName,
    { name: relatedPersonName },
  );
}

function buildRelationshipPreviewPeople(
  draftPerson: PersonRecord,
  pendingRelationships: PendingRelationshipDraft[],
  relationshipCandidatesById: Map<string, PersonRecord>,
) {
  const people = new Map<string, PersonRecord>();
  people.set(draftPerson.id, draftPerson);

  pendingRelationships.forEach((relationship) => {
    const relatedPerson = relationshipCandidatesById.get(relationship.relatedPersonId);
    if (relatedPerson) {
      people.set(relatedPerson.id, relatedPerson);
    }
  });

  return [...people.values()];
}

function createValidationPersonRecord(input: {
  id?: string;
  firstName: string;
  middleNames: string;
  lastName: string;
  maidenName: string;
  birthPlace: string;
  birthDate: string;
  deathDate: string;
  gender: PersonGender;
  notes: string;
  lifeEvents: PersonLifeEvent[];
  person?: PersonRecord | null;
}): PersonRecord {
  return {
    id: input.id ?? '__new-person__',
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
    birthPlace: input.birthPlace,
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
  subjectPersonId: string,
): RelationshipRecord[] {
  return pendingDrafts
    .filter((draft) => draft.relatedPersonId)
    .map((draft, index) => ({
      id: `__pending-relationship__-${index}`,
      treeId: '',
      ownerId: '',
      type: draft.mode === 'spouse-of' ? 'spouse' : 'parent-child',
      fromPersonId: draft.mode === 'child-of' ? draft.relatedPersonId : subjectPersonId,
      toPersonId: draft.mode === 'child-of' ? subjectPersonId : draft.relatedPersonId,
      parentChildKind: draft.mode === 'spouse-of' ? undefined : draft.parentChildKind,
      relationshipStatus: draft.mode === 'spouse-of' ? draft.relationshipStatus : undefined,
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
    relationshipStatus: relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS,
  };
}

function getPendingRelationshipInitSignature(relationships: PendingRelationshipSubmission[]) {
  return relationships
    .map((relationship) => [
      relationship.mode,
      relationship.relatedPersonId,
      relationship.parentChildKind ?? '',
      relationship.relationshipStatus ?? '',
    ].join(':'))
    .sort()
    .join('|');
}

function getRelationshipModeForPerson(personId: string, relationship: RelationshipRecord): PendingRelationshipMode {
  if (relationship.type === 'spouse') {
    return 'spouse-of';
  }

  return relationship.fromPersonId === personId ? 'parent-of' : 'child-of';
}

export default function PersonFormDialog({
  visible,
  mode,
  person,
  initialValues,
  initialPendingRelationships = [],
  initialStep = 1,
  initialAddConnectionMode = null,
  autoOpenAddConnectionDialog = false,
  relationshipOnly = false,
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
  const isRelationshipOnlyFlow = mode === 'create' && relationshipOnly;
  const [isPresent, setIsPresent] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [middleNames, setMiddleNames] = useState('');
  const [lastName, setLastName] = useState('');
  const [maidenName, setMaidenName] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
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
  const [visualPreviewVisible, setVisualPreviewVisible] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [addConnectionDialogVisible, setAddConnectionDialogVisible] = useState(false);
  const [addConnectionInitialMode, setAddConnectionInitialMode] = useState<PendingRelationshipMode | null>(null);
  const [relationshipSuggestionsVisible, setRelationshipSuggestionsVisible] = useState(false);
  const [surnameVariantConfirmDialogVisible, setSurnameVariantConfirmDialogVisible] = useState(false);
  const [proposedSurnameVariant, setProposedSurnameVariant] = useState<string | null>(null);
  const [surnameVariantHints, setSurnameVariantHints] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const shouldAutoOpenSuggestionsRef = useRef(false);
  const initialPendingRelationshipSignature = useMemo(
    () => getPendingRelationshipInitSignature(initialPendingRelationships),
    [initialPendingRelationships],
  );
  const requiresRelationshipConnection = mode === 'create' && (
    isRelationshipOnlyFlow
    || initialPendingRelationships.some((relationship) => relationship.relatedPersonId)
  );

  const lastInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) {
      lastInitKeyRef.current = null;
      return;
    }

    const initKey = [
      mode,
      person?.id ?? 'new',
      relationshipOnly ? 'relationship-only' : 'person-form',
      `${initialStep}`,
      initialAddConnectionMode ?? '',
      autoOpenAddConnectionDialog ? 'auto-open' : 'manual-open',
      initialPendingRelationshipSignature,
    ].join('|');
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
    setBirthPlace(person?.birthPlace ?? initialValues?.birthPlace ?? '');
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
    setVisualPreviewVisible(false);
    setSubmitPending(false);
    setAddConnectionDialogVisible(false);
    setRelationshipSuggestionsVisible(false);
    setSurnameVariantConfirmDialogVisible(false);
    setProposedSurnameVariant(null);
    setSurnameVariantHints([]);
    setCurrentStep(isRelationshipOnlyFlow ? 2 : initialStep);
    setAddConnectionInitialMode(initialAddConnectionMode);
    setAddConnectionDialogVisible(Boolean(
      isRelationshipOnlyFlow && (initialAddConnectionMode || autoOpenAddConnectionDialog),
    ));
    shouldAutoOpenSuggestionsRef.current = isRelationshipOnlyFlow || initialStep === 2;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenAddConnectionDialog, initialAddConnectionMode, initialPendingRelationshipSignature, initialStep, mode, person?.id, relationshipOnly, visible]);

  useEffect(() => {
    if (!loading) {
      setSubmitPending(false);
    }
  }, [loading]);

  const buildSubmissionPayload = () => ({
    firstName,
    middleNames,
    lastName: getResolvedLastNameValue(lastName, mode, lastNameTouched, suggestedLastName),
    maidenName,
    birthPlace,
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
    surnameVariantHints: !hasExistingSurnames && getResolvedLastNameValue(lastName, mode, lastNameTouched, suggestedLastName)
      ? [...new Set([...surnameVariantHints, getResolvedLastNameValue(lastName, mode, lastNameTouched, suggestedLastName)])]
      : surnameVariantHints,
    pendingRelationships: pendingRelationships.map(({ mode: relationshipMode, relatedPersonId, parentChildKind, relationshipStatus }) => ({
      mode: relationshipMode,
      relatedPersonId,
      parentChildKind: relationshipMode === 'spouse-of' ? undefined : parentChildKind,
      relationshipStatus: relationshipMode === 'spouse-of' ? relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS : undefined,
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
  const validationPersonRecord = useMemo(
    () => createValidationPersonRecord({
      id: isRelationshipOnlyFlow ? person?.id : undefined,
      firstName,
      middleNames,
      lastName: getResolvedLastNameValue(lastName, mode, lastNameTouched, suggestedLastName),
      maidenName,
      birthPlace,
      birthDate,
      deathDate: isPresent ? '' : deathDate,
      gender,
      notes,
      lifeEvents,
      person,
    }),
    [birthDate, birthPlace, deathDate, firstName, gender, isPresent, isRelationshipOnlyFlow, lastName, lastNameTouched, lifeEvents, maidenName, middleNames, mode, notes, person, suggestedLastName],
  );
  const subjectPersonId = validationPersonRecord.id;
  const pendingValidationRelationships = useMemo(
    () => createPendingValidationRelationships(pendingRelationships, subjectPersonId),
    [pendingRelationships, subjectPersonId],
  );
  const relationshipPreviewPeople = useMemo(
    () => buildRelationshipPreviewPeople(validationPersonRecord, pendingRelationships, relationshipCandidatesById),
    [pendingRelationships, relationshipCandidatesById, validationPersonRecord],
  );
  const personValidationFeedback = useMemo(
    () => (isRelationshipOnlyFlow
      ? { errors: [], warnings: [] }
      : getPersonValidationFeedback({
        people: relationshipCandidates,
        relationships: [...relationships, ...pendingValidationRelationships],
        person: {
          firstName,
          middleNames,
          lastName: getResolvedLastNameValue(lastName, mode, lastNameTouched, suggestedLastName),
          maidenName,
          birthDate,
          deathDate: isPresent ? '' : deathDate,
          notes,
          lifeEvents,
        },
        pendingRelationships,
        existingPhotos,
        removedPhotos,
        newPhotoUris,
        requireIdentityContext: mode === 'create',
        requireRelationshipContext: requiresRelationshipConnection,
        ignorePersonId: person?.id,
      })),
    [birthDate, deathDate, existingPhotos, firstName, isPresent, isRelationshipOnlyFlow, lastName, lastNameTouched, lifeEvents, maidenName, middleNames, mode, newPhotoUris, pendingRelationships, pendingValidationRelationships, person?.id, relationshipCandidates, relationships, removedPhotos, requiresRelationshipConnection, notes, suggestedLastName],
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
      const fromPersonId = draft.mode === 'child-of' ? draft.relatedPersonId : subjectPersonId;
      const toPersonId = draft.mode === 'child-of' ? subjectPersonId : draft.relatedPersonId;
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
        relationshipStatus: draft.mode === 'spouse-of' ? draft.relationshipStatus : undefined,
        ignoreRelationshipId,
      });

      feedbackByKey.set(draft.key, {
        warnings: feedback.warnings.map((warning) => `${formatPersonName(relatedPerson)}: ${warning}`),
        errors: feedback.errors.map((error) => `${formatPersonName(relatedPerson)}: ${error}`),
      });
    });

    return feedbackByKey;
  }, [pendingRelationships, pendingValidationRelationshipIdByCompositeKey, pendingValidationRelationships, relationshipCandidatesById, relationships, subjectPersonId, validationPeople]);
  const relationshipWarnings = useMemo(
    () => pendingRelationships.flatMap((draft) => pendingRelationshipFeedbackByKey.get(draft.key)?.warnings ?? []),
    [pendingRelationships, pendingRelationshipFeedbackByKey],
  );
  const relationshipSuggestions = useMemo(
    () => (mode !== 'create'
      ? []
      : buildRelationshipSuggestions({
        people: validationPeople,
        relationships,
        subjectPersonId,
        pendingRelationships: pendingRelationships.map((draft) => ({
          mode: draft.mode,
          relatedPersonId: draft.relatedPersonId,
          parentChildKind: draft.parentChildKind,
          relationshipStatus: draft.relationshipStatus,
        })),
      })),
    [mode, pendingRelationships, relationships, subjectPersonId, validationPeople],
  );
  const hasConnectedRelationshipRequirement = requiresRelationshipConnection;
  const hasSelectedPendingRelationships = pendingRelationships.some((draft) => draft.relatedPersonId);
  const existingRelationshipEntries = useMemo(() => {
    if (!isRelationshipOnlyFlow || !person) {
      return [];
    }

    return relationships
      .filter((relationship) => relationship.fromPersonId === person.id || relationship.toPersonId === person.id)
      .map((relationship) => {
        const mode = getRelationshipModeForPerson(person.id, relationship);
        const relatedPersonId = mode === 'spouse-of'
          ? relationship.fromPersonId === person.id
            ? relationship.toPersonId
            : relationship.fromPersonId
          : mode === 'parent-of'
            ? relationship.toPersonId
            : relationship.fromPersonId;
        const relatedPerson = relationshipCandidatesById.get(relatedPersonId);

        return {
          id: relationship.id,
          mode,
          relatedPersonName: relatedPerson ? formatPersonName(relatedPerson) : relatedPersonId,
          detail: mode === 'spouse-of'
            ? relationship.relationshipStatus === 'married'
              ? t(K.relationship.marriedLabel)
              : t(K.relationship.partnerLabel)
            : relationship.parentChildKind === 'biological' || !relationship.parentChildKind
              ? t(K.relationship.biologicalLabel)
              : t(K.relationship.nonBiologicalLabel),
        };
      });
  }, [isRelationshipOnlyFlow, person, relationshipCandidatesById, relationships, t]);
  const effectiveLastNameSelection = useMemo(() => {
    if (lastName.trim()) {
      return lastName.trim();
    }

    if (mode === 'create' && !lastNameTouched && suggestedLastName) {
      return suggestedLastName;
    }

    return '';
  }, [lastName, lastNameTouched, mode, suggestedLastName]);
  const resolvedLastName = effectiveLastNameSelection.trim();
  const surnameNeedsReview = mode === 'create'
    && Boolean(resolvedLastName)
    && hasExistingSurnames
    && !normalizedTreeSurnames.has(normaliseSurnameValue(resolvedLastName));
  const stepOneHasContext = Boolean(firstName.trim() || resolvedLastName || birthDate || maidenName.trim());
  const stepOneReviewMessages = useMemo(() => {
    const messages: string[] = [];

    if (firstName.trim() && !resolvedLastName) {
      messages.push(t(K.personForm.lastNameRequired));
    }

    if ((firstName.trim() || resolvedLastName) && !birthDate) {
      messages.push(t(K.personForm.birthDateRequired));
    }

    if (surnameNeedsReview) {
      messages.push(t(K.personForm.surnameNotInTree));
    }

    messages.push(
      ...personValidationFeedback.errors.filter((message) => ![
        t(K.personForm.firstNameRequiredError),
        t(K.personForm.lastNameRequired),
        t(K.personForm.birthDateRequired),
      ].includes(message)),
      ...personValidationFeedback.warnings,
    );

    return getUniqueReviewMessages(messages).slice(0, 3);
  }, [birthDate, firstName, personValidationFeedback.errors, personValidationFeedback.warnings, resolvedLastName, surnameNeedsReview, t]);
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
  const pendingRelationshipSectionName = getPendingRelationshipSectionName(firstName, lastName);
  const dialogTitle = mode === 'edit'
    ? t(K.personForm.editFamilyMember)
    : currentStep === 2
      ? pendingRelationshipSectionName
        ? t(K.personForm.addRelationshipsForName, { name: pendingRelationshipSectionName })
        : t(K.personForm.addRelationships)
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
  const addAnotherConnectionLabel = pendingRelationshipSectionName
    ? t(K.personForm.addAnotherConnectionForName, { name: pendingRelationshipSectionName })
    : t(K.personForm.addAnotherConnection);
  const relationshipStepTitle = pendingRelationshipSectionName
    ? t(K.personForm.addRelationshipsForName, { name: pendingRelationshipSectionName })
    : t(K.personForm.addRelationship);
  const stepTwoReviewMessages = useMemo(() => {
    const messages: string[] = [];

    if (hasConnectedRelationshipRequirement && !hasSelectedPendingRelationships) {
      messages.push(t(K.personForm.addRelationshipToConnectMember));
    }

    if (pendingRelationships.some((draft) => !draft.relatedPersonId)) {
      messages.push(t(K.personForm.chooseFamilyMemberForRelationship));
    }

    messages.push(
      ...pendingRelationships.flatMap((draft) => pendingRelationshipFeedbackByKey.get(draft.key)?.errors ?? []),
      ...relationshipWarnings,
    );

    return getUniqueReviewMessages(messages).slice(0, 3);
  }, [hasConnectedRelationshipRequirement, hasSelectedPendingRelationships, pendingRelationshipFeedbackByKey, pendingRelationships, relationshipWarnings, t]);
  const childOverlayVisible = (
    addConnectionDialogVisible
    || relationshipSuggestionsVisible
    || visualPreviewVisible
    || previewState.visible
    || surnameVariantConfirmDialogVisible
    || submitPending
    || loading
  );

  const handleSubmit = async () => {
    if (!isRelationshipOnlyFlow) {
      const firstError = personValidationFeedback.errors.find((message) => message === t(K.personForm.firstNameRequiredError));
      if (firstError) {
        setFirstNameError(firstError);
        return;
      }

      if (!getResolvedLastNameValue(lastName, mode, lastNameTouched, suggestedLastName)) {
        setLastNameError(t(K.personForm.lastNameRequired));
        return;
      }

      const missingBirthDateError = personValidationFeedback.errors.find((message) => message === t(K.personForm.birthDateRequired));
      if (missingBirthDateError) {
        setBirthDateError(missingBirthDateError);
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
    }

    if (mode === 'create') {
      if (hasConnectedRelationshipRequirement && !hasSelectedPendingRelationships) {
        setRelationshipError(t(K.personForm.addRelationshipToConnectMember));
        return;
      }

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

    if (!isRelationshipOnlyFlow) {
      const deathError = personValidationFeedback.errors.find((message) => message === t(K.personForm.deathDateBeforeBirth));
      if (deathError) {
        setDeathDateError(deathError);
        return;
      }

      const duplicateError = personValidationFeedback.errors.find((message) => (
        message !== t(K.personForm.firstNameRequiredError)
        && message !== t(K.personForm.deathDateBeforeBirth)
      ));
      if (duplicateError) {
        setRelationshipError(duplicateError);
        return;
      }
    }

    const pendingRelationshipError = pendingRelationships
      .map((draft) => pendingRelationshipFeedbackByKey.get(draft.key)?.errors[0] ?? null)
      .find(Boolean);

    if (pendingRelationshipError) {
      setRelationshipError(pendingRelationshipError);
      return;
    }

    if (mode === 'create' && hasExistingSurnames) {
      const trimmedLastName = getResolvedLastNameValue(lastName, mode, lastNameTouched, suggestedLastName);
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
      warnings: [...(isRelationshipOnlyFlow ? [] : personValidationFeedback.warnings), ...relationshipWarnings],
    });
  };

  const handleNextStep = () => {
    const firstError = personValidationFeedback.errors.find((message) => message === t(K.personForm.firstNameRequiredError));
    if (firstError) {
      setFirstNameError(firstError);
      return;
    }

    if (!getResolvedLastNameValue(lastName, mode, lastNameTouched, suggestedLastName)) {
      setLastNameError(t(K.personForm.lastNameRequired));
      return;
    }

    const missingBirthDateError = personValidationFeedback.errors.find((message) => message === t(K.personForm.birthDateRequired));
    if (missingBirthDateError) {
      setBirthDateError(missingBirthDateError);
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

    shouldAutoOpenSuggestionsRef.current = true;
    setCurrentStep(2);
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

  const getPendingRelationshipDetail = (relationshipDraft: PendingRelationshipDraft) => {
    if (relationshipDraft.mode === 'spouse-of') {
      return relationshipDraft.relationshipStatus === 'married'
        ? t(K.relationship.marriedLabel)
        : t(K.relationship.partnerLabel);
    }

    return relationshipDraft.parentChildKind === 'biological'
      ? t(K.relationship.biologicalLabel)
      : t(K.relationship.nonBiologicalLabel);
  };

  const getPendingRelationshipSwitchLabel = (relationshipDraft: PendingRelationshipDraft, relatedPersonName: string) => {
    if (relationshipDraft.mode === 'spouse-of') {
      return t(K.personForm.isMarriedToName, { name: relatedPersonName });
    }

    return relationshipDraft.mode === 'parent-of'
      ? t(K.personForm.isBiologicalParent)
      : t(K.personForm.isBiologicalChild);
  };

  const openAddConnectionDialog = (initialMode: PendingRelationshipMode | null = null) => {
    setRelationshipError(null);
    setAddConnectionInitialMode(initialMode);
    setAddConnectionDialogVisible(true);
  };

  useEffect(() => {
    if (!visible || mode !== 'create' || currentStep !== 2 || !shouldAutoOpenSuggestionsRef.current) {
      return;
    }

    shouldAutoOpenSuggestionsRef.current = false;
    if (relationshipSuggestions.length > 0) {
      setRelationshipSuggestionsVisible(true);
    }
  }, [currentStep, mode, relationshipSuggestions.length, visible]);

  const handleAddConnection = (relationshipMode: PendingRelationshipMode, relatedPerson: PersonRecord) => {
    setRelationshipError(null);
    setPendingRelationships((current) => [
      ...current,
      {
        key: `${Date.now()}-${Math.random()}`,
        mode: relationshipMode,
        relatedPersonId: relatedPerson.id,
        parentChildKind: relationshipMode === 'spouse-of' ? undefined : DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
        relationshipStatus: relationshipMode === 'spouse-of' ? DEFAULT_SPOUSE_RELATIONSHIP_STATUS : undefined,
      },
    ]);
  };

  const removePendingRelationship = (relationshipKey: string) => {
    setRelationshipError(null);
    setPendingRelationships((current) => current.filter((relationship) => relationship.key !== relationshipKey));
  };

  const handleApplyRelationshipSuggestions = (selectedSuggestions: typeof relationshipSuggestions) => {
    if (selectedSuggestions.length > 0) {
      setPendingRelationships((current) => [
        ...current,
        ...selectedSuggestions.map((suggestion) => ({
          key: `${Date.now()}-${Math.random()}`,
          mode: suggestion.mode,
          relatedPersonId: suggestion.relatedPersonId,
          parentChildKind: suggestion.mode === 'spouse-of'
            ? undefined
            : suggestion.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
          relationshipStatus: suggestion.mode === 'spouse-of'
            ? suggestion.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS
            : undefined,
        })),
      ]);
    }

    setRelationshipSuggestionsVisible(false);
    setRelationshipError(null);
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
          visible={visible && !childOverlayVisible}
          onDismiss={loading ? undefined : onDismiss}
          style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose, styles.dialogTitle]}>
            {dialogTitle}
          </Dialog.Title>
          <IconButton icon="close" onPress={onDismiss} disabled={loading} accessibilityLabel={t(K.common.cancel)} style={dialogChrome.closeButton} />
          <Dialog.ScrollArea style={[dialogChrome.scrollArea, styles.scrollArea]}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {mode === 'create' && !isRelationshipOnlyFlow ? (
                <Text variant="labelMedium" style={[styles.stepMeta, { color: theme.colors.onSurfaceVariant }]}>
                  {t(K.personForm.stepOfTwo, { step: currentStep })}
                </Text>
              ) : null}

              {mode === 'create' && currentStep === 2 ? (
                <>
                  <HelperText type="error" visible={!!relationshipError}>
                    {relationshipError}
                  </HelperText>
                  <View style={styles.sectionSpacing}>
                    {stepTwoReviewMessages.length > 0 ? (
                      <View style={[styles.reviewPanel, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
                        <Text variant="titleSmall">{t(K.personForm.pleaseReviewBeforeSaving)}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {stepTwoReviewMessages.length} relationship item{stepTwoReviewMessages.length === 1 ? '' : 's'} to review before creating.
                        </Text>
                        {stepTwoReviewMessages.map((message) => (
                          <Text key={message} variant="bodyMedium" style={styles.reviewPanelMessage}>
                            • {message}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    <Text variant="labelMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                      {relationshipStepTitle}
                    </Text>
                    <Text variant="bodySmall" style={[styles.relationshipSectionHelper, { color: theme.colors.onSurfaceVariant }]}>
                      {relationshipCandidates.length > 0
                        ? t(K.personForm.queueRelationshipsAfterSave)
                        : t(K.personForm.addMemberChooserEmptyHint)}
                    </Text>
                    {selectedRelationshipDraft && selectedRelationshipPerson ? (
                      <View
                        style={[
                          styles.relationshipAnchorBanner,
                          { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant },
                        ]}
                      >
                        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                          Starting connection
                        </Text>
                        <Text variant="titleSmall">
                          {isRelationshipOnlyFlow
                            ? `${getRelationshipPreviewLabel(selectedRelationshipDraft.mode)} ${formatPersonName(selectedRelationshipPerson)}`
                            : getAnchorRelationshipSummary(
                              selectedRelationshipDraft.mode,
                              formatPersonName(selectedRelationshipPerson),
                              t,
                            )}
                        </Text>
                      </View>
                    ) : null}
                    {existingRelationshipEntries.length > 0 ? (
                      <View style={styles.pendingRelationshipList}>
                        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                          {t(K.personForm.existingRelationships)}
                        </Text>
                        {existingRelationshipEntries.map((relationshipEntry) => (
                          <View
                            key={relationshipEntry.id}
                            style={[styles.pendingRelationshipCard, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.elevation.level1 }]}
                          >
                            <List.Item
                              style={styles.pendingRelationshipItem}
                              title={`${getRelationshipPreviewLabel(relationshipEntry.mode)} ${relationshipEntry.relatedPersonName}`}
                              description={relationshipEntry.detail}
                            />
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {pendingRelationships.map((relationshipDraft) => {
                      const relatedPerson = relationshipCandidatesById.get(relationshipDraft.relatedPersonId);
                      const relatedPersonName = relatedPerson ? formatPersonName(relatedPerson) : relationshipDraft.relatedPersonId;
                      const isSwitchOn = relationshipDraft.mode === 'spouse-of'
                        ? relationshipDraft.relationshipStatus === 'married'
                        : relationshipDraft.parentChildKind === 'biological';

                      return (
                        <View
                          key={relationshipDraft.key}
                          style={[styles.pendingRelationshipCard, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }]}
                        >
                          <List.Item
                            style={styles.pendingRelationshipItem}
                            title={`${getRelationshipPreviewLabel(relationshipDraft.mode)} ${relatedPersonName}`}
                            description={isRelationshipOnlyFlow
                              ? getPendingRelationshipDetail(relationshipDraft)
                              : `${getRelationshipCreateDescription(relationshipDraft.mode, relatedPersonName)} · ${getPendingRelationshipDetail(relationshipDraft)}`}
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
                          <View style={styles.pendingRelationshipToggleRow}>
                            <Text variant="bodyMedium" style={{ flex: 1, color: theme.colors.onSurface }}>
                              {getPendingRelationshipSwitchLabel(relationshipDraft, relatedPersonName)}
                            </Text>
                            <Switch
                              value={isSwitchOn}
                              onValueChange={(value) => {
                                setPendingRelationships((current) => current.map((draft) => (
                                  draft.key !== relationshipDraft.key
                                    ? draft
                                    : {
                                      ...draft,
                                      parentChildKind: draft.mode === 'spouse-of'
                                        ? undefined
                                        : value
                                          ? 'biological'
                                          : 'non-biological',
                                      relationshipStatus: draft.mode === 'spouse-of'
                                        ? value
                                          ? 'married'
                                          : 'partner'
                                        : undefined,
                                    }
                                )));
                                setRelationshipError(null);
                              }}
                              disabled={loading}
                            />
                          </View>
                        </View>
                      );
                    })}
                    <Button
                      mode="text"
                      icon="plus"
                      onPress={() => openAddConnectionDialog(null)}
                      disabled={loading || relationshipCandidates.length === 0}
                      style={styles.addConnectionButton}
                    >
                      {addAnotherConnectionLabel}
                    </Button>
                    <View style={styles.relationshipPreviewButtonRow}>
                      <Button
                        mode="outlined"
                        icon="family-tree"
                        onPress={() => setVisualPreviewVisible(true)}
                        disabled={loading}
                      >
                        Visual Preview
                      </Button>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {stepOneHasContext && stepOneReviewMessages.length > 0 ? (
                    <View style={[styles.reviewPanel, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
                      <Text variant="titleSmall">{t(K.personForm.pleaseReviewBeforeSaving)}</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {stepOneReviewMessages.length} profile item{stepOneReviewMessages.length === 1 ? '' : 's'} to review before you continue.
                      </Text>
                      {stepOneReviewMessages.map((message) => (
                        <Text key={message} variant="bodyMedium" style={styles.reviewPanelMessage}>
                          • {message}
                        </Text>
                      ))}
                    </View>
                  ) : null}
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
                    <HelperText type="info" visible={surnameNeedsReview}>
                      {t(K.personForm.surnameNotInTree)}
                    </HelperText>
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
                    <Text variant="titleSmall">{t(K.personProfile.birthPlace)}</Text>
                    <TextInput
                      mode="outlined"
                      label={t(K.treeSettings.birthPlace)}
                      value={birthPlace}
                      onChangeText={setBirthPlace}
                      disabled={loading}
                      style={styles.fieldSpacing}
                    />
                  </View>

                  <View style={styles.sectionSpacing}>
                    <Text variant="titleSmall">{t(K.personForm.birthDate)} *</Text>
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
                </>
              )}
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
              {mode === 'create' && currentStep === 2 && !isRelationshipOnlyFlow ? (
                <Button onPress={() => setCurrentStep(1)} disabled={loading}>
                  {t(K.common.back)}
                </Button>
              ) : null}
              <Button
                mode="contained"
                onPress={mode === 'create' && currentStep === 1 ? handleNextStep : handleSubmit}
                disabled={loading}
              >
                {mode === 'create'
                  ? currentStep === 1
                    ? t(K.common.next)
                    : isRelationshipOnlyFlow
                      ? t(K.common.save)
                      : t(K.common.create)
                  : t(K.common.save)}
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
                    {mode === 'create' && !isRelationshipOnlyFlow ? t(K.personForm.readyToCreateFamilyMember) : t(K.personForm.readyToSaveFamilyMember)}
                  </Text>
                  <Text variant="titleSmall" style={styles.sectionSpacing}>{t(K.common.summary)}</Text>
                  <Text variant="bodyMedium">{t(K.personForm.gender)}: {previewState.payload.gender}</Text>
                  {previewState.payload.birthDate ? <Text variant="bodyMedium">{t(K.personProfile.birth)}: {formatPersonDate(previewState.payload.birthDate)}</Text> : null}
                  {previewState.payload.birthPlace ? <Text variant="bodyMedium">{t(K.personProfile.birthPlace)}: {previewState.payload.birthPlace}</Text> : null}
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
              {mode === 'create' && !isRelationshipOnlyFlow ? t(K.common.create) : t(K.common.save)}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <RelationshipSuggestionsDialog
        visible={relationshipSuggestionsVisible}
        suggestions={relationshipSuggestions}
        peopleById={relationshipCandidatesById}
        loading={loading}
        onDismiss={() => setRelationshipSuggestionsVisible(false)}
        onApply={handleApplyRelationshipSuggestions}
      />
      <RelationshipVisualPreviewDialog
        visible={visualPreviewVisible}
        people={relationshipPreviewPeople}
        relationships={pendingValidationRelationships}
        currentTreeId={person?.treeId}
        highlightedPersonId={subjectPersonId}
        onDismiss={() => setVisualPreviewVisible(false)}
      />
      <AddPersonEntryDialog
        visible={addConnectionDialogVisible}
        hasExistingFamilyMembers={relationshipCandidates.length > 0}
        relationshipCandidates={relationshipCandidates}
        relationships={relationships}
        existingPendingRelationships={pendingRelationships.map(({ mode, relatedPersonId, parentChildKind, relationshipStatus }) => ({
          mode,
          relatedPersonId,
          parentChildKind,
          relationshipStatus: mode === 'spouse-of' ? relationshipStatus : undefined,
        }))}
        initialMode={addConnectionInitialMode}
        perspective="anchor-person"
        allowUnrelatedEntry={false}
        chooserTitleKey={K.personForm.addAnotherConnectionTitle}
        chooserHelperKey={K.personForm.addAnotherConnectionHelper}
        newPersonName={firstName}
        validationAnchorPerson={validationPersonRecord}
        onDismiss={() => {
          setAddConnectionDialogVisible(false);
          setAddConnectionInitialMode(null);
        }}
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
              {mode === 'create' && !isRelationshipOnlyFlow ? t(K.personForm.creatingFamilyMember) : t(K.personForm.savingFamilyMember)}
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
