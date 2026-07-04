import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Dialog, IconButton, List, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { GlobalStyles } from '../constants/styles';
import { useI18n } from '../hooks/use-i18n';
import { I18N_KEYS as K } from '../i18n/keys';
import type { PendingRelationshipMode } from './person-form-dialog';
import type { PersonRecord } from './dto/person';
import type { PendingRelationshipSubmission } from './person-form-dialog';
import type { RelationshipRecord } from './dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from './dto/relationship';
import { getRelationshipValidationResolution } from './family-tree-validation';
import { formatPersonName as formatPersonDisplayName } from './person-formatting';

const dialogChrome = GlobalStyles.dialogChrome;
const PAGE_SIZE = 5;

type ReviewState = {
  mode: PendingRelationshipMode;
  relatedPerson: PersonRecord;
  warnings: string[];
} | null;

type BlockingState = {
  mode: PendingRelationshipMode;
  relatedPerson: PersonRecord;
  message: string;
} | null;

type AddPersonEntryDialogProps = {
  visible: boolean;
  hasExistingFamilyMembers: boolean;
  relationshipCandidates: PersonRecord[];
  relationships?: RelationshipRecord[];
  existingPendingRelationships?: PendingRelationshipSubmission[];
  validationAnchorPerson?: PersonRecord | null;
  initialMode?: PendingRelationshipMode | null;
  fixedRelatedPerson?: PersonRecord | null;
  skipPersonSelectionWhenFixed?: boolean;
  perspective?: 'new-person' | 'anchor-person';
  allowUnrelatedEntry?: boolean;
  chooserTitleKey?: string;
  chooserHelperKey?: string;
  newPersonName?: string;
  onDismiss: () => void;
  onSelectRelationship: (mode: PendingRelationshipMode, relatedPerson: PersonRecord) => void;
  onSelectRelationshipAttempt?: (mode: PendingRelationshipMode, relatedPerson: PersonRecord) => Promise<boolean> | boolean;
  onAddFirstFamilyMember?: () => void;
};

function resolveSubmissionMode(
  mode: PendingRelationshipMode,
  perspective: 'new-person' | 'anchor-person',
): PendingRelationshipMode {
  if (perspective === 'new-person') {
    return mode;
  }

  if (mode === 'parent-of') {
    return 'child-of';
  }

  if (mode === 'child-of') {
    return 'parent-of';
  }

  return mode;
}

function getChooserModeLabel(
  mode: PendingRelationshipMode,
  name: string | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (!name?.trim()) {
    return t(
      mode === 'parent-of'
        ? K.relationship.parentOf
        : mode === 'child-of'
          ? K.relationship.childOf
          : K.relationship.spouseOf,
    );
  }

  return t(
    mode === 'parent-of'
      ? K.relationship.anotherParentOfName
      : mode === 'child-of'
        ? K.relationship.childOfName
        : K.relationship.spouseOfName,
    { name },
  );
}

function getSelectRelationshipTitle(
  mode: PendingRelationshipMode,
  name: string | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  if (!name?.trim()) {
    return t(K.relationship.selectRelatedFamilyMember);
  }

  return t(
    mode === 'parent-of'
      ? K.relationship.selectParentForName
      : mode === 'child-of'
        ? K.relationship.selectChildForName
        : K.relationship.selectSpouseForName,
    { name },
  );
}

function getRelationshipActionText({
  mode,
  perspective,
  anchorName,
  relatedPersonName,
  t,
}: {
  mode: PendingRelationshipMode;
  perspective: 'new-person' | 'anchor-person';
  anchorName?: string;
  relatedPersonName: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (perspective === 'anchor-person' && anchorName?.trim()) {
    return t(
      mode === 'parent-of'
        ? K.relationship.parentOfName
        : mode === 'child-of'
          ? K.relationship.childOfName
          : K.relationship.spouseOfName,
      { name: anchorName.trim() },
    );
  }

  return t(
    mode === 'parent-of'
      ? K.relationship.createParentForName
      : mode === 'child-of'
        ? K.relationship.createChildForName
        : K.relationship.createSpouseForName,
    { name: relatedPersonName },
  );
}

export default function AddPersonEntryDialog({
  visible,
  hasExistingFamilyMembers,
  relationshipCandidates,
  relationships = [],
  existingPendingRelationships = [],
  validationAnchorPerson = null,
  initialMode = null,
  fixedRelatedPerson = null,
  skipPersonSelectionWhenFixed = false,
  perspective = 'new-person',
  allowUnrelatedEntry = true,
  chooserTitleKey,
  chooserHelperKey,
  newPersonName,
  onDismiss,
  onSelectRelationship,
  onSelectRelationshipAttempt,
  onAddFirstFamilyMember,
}: AddPersonEntryDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [selectedMode, setSelectedMode] = useState<PendingRelationshipMode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [reviewState, setReviewState] = useState<ReviewState>(null);
  const [blockingState, setBlockingState] = useState<BlockingState>(null);
  const anchorPersonId = validationAnchorPerson?.id ?? fixedRelatedPerson?.id ?? '__new-person__';
  const anchorDisplayName = newPersonName?.trim() || (validationAnchorPerson ? formatPersonDisplayName(validationAnchorPerson) : '');
  const validationPeople = useMemo<PersonRecord[]>(() => [
    validationAnchorPerson ?? fixedRelatedPerson ?? {
      id: '__new-person__',
      treeId: '',
      treeMembershipIds: [],
      treeMemberships: [],
      ownerId: '',
      firstName: '',
      middleNames: '',
      lastName: '',
      maidenName: '',
      nicknames: [],
      clanName: '',
      familyBranch: '',
      hometown: '',
      birthPlace: '',
      surnameVariantHints: [],
      canonicalPersonId: '',
      duplicatePersonIds: [],
      birthDate: '',
      deathDate: '',
      gender: 'unspecified',
      notes: '',
      lifeEvents: [],
      photos: [],
      preferredPhotoId: '',
      createdAt: '',
      updatedAt: '',
    },
    ...relationshipCandidates,
  ], [fixedRelatedPerson, relationshipCandidates, validationAnchorPerson]);

  useEffect(() => {
    if (!visible) {
      setSelectedMode(initialMode);
      setSearchQuery('');
      setPage(0);
      setReviewState(null);
      setBlockingState(null);
    }
  }, [initialMode, visible]);

  useEffect(() => {
    if (visible && initialMode) {
      setSelectedMode(initialMode);
      setSearchQuery('');
      setPage(0);
    }
  }, [initialMode, visible]);

  const filteredCandidates = useMemo(() => {
    if (!selectedMode) {
      return [];
    }

    if (fixedRelatedPerson) {
      return [fixedRelatedPerson];
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const excludedPersonIds = new Set(existingPendingRelationships.map((relationship) => relationship.relatedPersonId).filter(Boolean));

    return relationshipCandidates.filter((candidate) => (
      !excludedPersonIds.has(candidate.id)
      && (
      !normalizedQuery || formatPersonDisplayName(candidate).toLowerCase().includes(normalizedQuery)
      )
    ));
  }, [existingPendingRelationships, fixedRelatedPerson, relationshipCandidates, searchQuery, selectedMode]);

  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / PAGE_SIZE));
  const paginatedCandidates = useMemo(
    () => filteredCandidates.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filteredCandidates, page],
  );
  useEffect(() => {
    setPage(0);
  }, [searchQuery, selectedMode]);

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  const resetAndDismiss = () => {
    setSelectedMode(null);
    setSearchQuery('');
    setPage(0);
    setReviewState(null);
    setBlockingState(null);
    onDismiss();
  };

  const chooseMode = (mode: PendingRelationshipMode) => {
    if (fixedRelatedPerson && skipPersonSelectionWhenFixed) {
      resetAndDismiss();
      onSelectRelationship(mode, fixedRelatedPerson);
      return;
    }

    setSelectedMode(mode);
    setSearchQuery('');
    setPage(0);
  };

  const handleRelationshipSelection = async (mode: PendingRelationshipMode, relatedPerson: PersonRecord) => {
    if (onSelectRelationshipAttempt) {
      const shouldContinue = await onSelectRelationshipAttempt(mode, relatedPerson);
      if (!shouldContinue) {
        return;
      }
    }

    const submissionMode = resolveSubmissionMode(mode, perspective);
    const pendingValidationRelationships: RelationshipRecord[] = existingPendingRelationships.map((relationship, index) => ({
      id: `__pending-relationship__-${index}`,
      treeId: '',
      ownerId: '',
      type: relationship.mode === 'spouse-of' ? 'spouse' : 'parent-child',
      fromPersonId: relationship.mode === 'child-of' ? relationship.relatedPersonId : anchorPersonId,
      toPersonId: relationship.mode === 'child-of' ? anchorPersonId : relationship.relatedPersonId,
      parentChildKind: relationship.mode === 'spouse-of' ? undefined : relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
      relationshipStatus: relationship.mode === 'spouse-of' ? relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS : undefined,
      createdAt: '',
    }));
    const validationResolution = getRelationshipValidationResolution({
      people: validationPeople,
      relationships: [...relationships, ...pendingValidationRelationships],
      type: submissionMode === 'spouse-of' ? 'spouse' : 'parent-child',
      fromPersonId: submissionMode === 'child-of' ? relatedPerson.id : anchorPersonId,
      toPersonId: submissionMode === 'child-of' ? anchorPersonId : relatedPerson.id,
      parentChildKind: submissionMode === 'spouse-of' ? undefined : DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
      relationshipStatus: submissionMode === 'spouse-of' ? DEFAULT_SPOUSE_RELATIONSHIP_STATUS : undefined,
    });

    const confirmSelection = () => {
      setReviewState(null);
      resetAndDismiss();
      onSelectRelationship(submissionMode, relatedPerson);
    };

    if (validationResolution.blockingErrors.length > 0) {
      setBlockingState({
        mode,
        relatedPerson,
        message: validationResolution.blockingErrors[0] ?? '',
      });
      return;
    }

    if (validationResolution.softWarnings.length === 0) {
      confirmSelection();
      return;
    }

    setReviewState({
      mode,
      relatedPerson,
      warnings: validationResolution.softWarnings,
    });
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={resetAndDismiss}
        style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
          {selectedMode
           ? getSelectRelationshipTitle(selectedMode, newPersonName, t)
           : chooserTitleKey === K.personForm.addAnotherConnectionTitle && newPersonName
             ? t(K.personForm.addRelationshipsForName, { name: newPersonName })
           : chooserTitleKey
             ? t(chooserTitleKey)
             : t(K.personForm.addMemberChooserTitle)}
        </Dialog.Title>
        <IconButton
          icon="close"
          onPress={resetAndDismiss}
          accessibilityLabel={t(K.common.close)}
          style={dialogChrome.closeButton}
        />
        <Dialog.Content style={dialogChrome.content}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {selectedMode
              ? newPersonName
                ? t(K.personForm.selectRelatedMemberForPerson, { name: newPersonName })
                : t(K.personForm.addMemberChooserMemberListHelper)
              : chooserHelperKey
                ? t(chooserHelperKey)
                : hasExistingFamilyMembers
                ? t(K.personForm.addMemberChooserHelper)
                : t(K.personForm.addMemberChooserEmptyHint)}
          </Text>

          {selectedMode ? (
            <View style={{ marginTop: 16 }}>
              {!fixedRelatedPerson ? (
                <TextInput
                  mode="outlined"
                  label={t(K.common.searchFamilyMembers)}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  left={<TextInput.Icon icon="magnify" />}
                  style={{ marginBottom: 12 }}
                />
              ) : null}
              <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                <View>
                  {paginatedCandidates.map((candidate) => (
                    <List.Item
                      key={candidate.id}
                      title={formatPersonDisplayName(candidate)}
                      description={getRelationshipActionText({
                        mode: selectedMode,
                        perspective,
                        anchorName: anchorDisplayName,
                        relatedPersonName: formatPersonDisplayName(candidate),
                        t,
                      })}
                      left={(props) => (
                        <List.Icon
                          {...props}
                          icon={
                            selectedMode === 'parent-of'
                              ? 'account-arrow-up-outline'
                              : selectedMode === 'child-of'
                                ? 'account-arrow-down-outline'
                                : 'account-heart-outline'
                          }
                        />
                      )}
                      right={(props) => <List.Icon {...props} icon="chevron-right" />}
                      onPress={() => {
                        void handleRelationshipSelection(selectedMode, candidate);
                      }}
                    />
                  ))}
                  {filteredCandidates.length === 0 ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t(K.relationship.noMatchesThisSide)}
                    </Text>
                  ) : null}
                </View>
              </ScrollView>
              {!fixedRelatedPerson && totalPages > 1 ? (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                    {t(K.app.resultsPageCount, { current: page + 1, total: totalPages })}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
                    <Button mode="outlined" onPress={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>
                      {t(K.common.previous)}
                    </Button>
                    <Button mode="outlined" onPress={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1}>
                      {t(K.common.next)}
                    </Button>
                  </View>
                </View>
              ) : null}
              <Button mode="text" onPress={() => { setSelectedMode(null); setSearchQuery(''); }} style={{ marginTop: 12 }}>
                {t(K.common.back)}
              </Button>
            </View>
          ) : (
            <View style={{ marginTop: 16, gap: 10 }}>
              {hasExistingFamilyMembers ? (
                <>
                  <Button mode="contained" icon="account-arrow-up-outline" onPress={() => chooseMode('parent-of')}>
                    {getChooserModeLabel('parent-of', newPersonName, t)}
                  </Button>
                  <Button mode="outlined" icon="account-arrow-down-outline" onPress={() => chooseMode('child-of')}>
                    {getChooserModeLabel('child-of', newPersonName, t)}
                  </Button>
                  <Button mode="outlined" icon="account-heart-outline" onPress={() => chooseMode('spouse-of')}>
                    {getChooserModeLabel('spouse-of', newPersonName, t)}
                  </Button>
                  {allowUnrelatedEntry && onAddFirstFamilyMember ? (
                    <Button mode="text" icon="account-remove-outline" onPress={onAddFirstFamilyMember}>
                      {t(K.personForm.addWithoutRelationship)}
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button mode="contained" icon="account-plus" onPress={onAddFirstFamilyMember}>
                  {t(K.personForm.addFirstFamilyMember)}
                </Button>
              )}
            </View>
          )}
        </Dialog.Content>
      </Dialog>
      <Dialog
        visible={!!blockingState}
        onDismiss={() => setBlockingState(null)}
        style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
          {t(K.relationship.addRelationship)}
        </Dialog.Title>
        <IconButton
          icon="close"
          onPress={() => setBlockingState(null)}
          accessibilityLabel={t(K.common.close)}
          style={dialogChrome.closeButton}
        />
        <Dialog.Content style={dialogChrome.content}>
          {blockingState ? (
            <View style={{ gap: 12 }}>
              <Text variant="titleSmall">
                {getRelationshipActionText({
                  mode: blockingState.mode,
                  perspective,
                  anchorName: anchorDisplayName,
                  relatedPersonName: formatPersonDisplayName(blockingState.relatedPerson),
                  t,
                })}
              </Text>
              <Text variant="bodyMedium">
                {blockingState.message}
              </Text>
            </View>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions style={dialogChrome.dialogActions}>
          <Button mode="contained" onPress={() => setBlockingState(null)}>
            {t(K.common.close)}
          </Button>
        </Dialog.Actions>
      </Dialog>
      <Dialog
        visible={!!reviewState}
        onDismiss={() => setReviewState(null)}
        style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
          {t(K.personForm.relationshipNeedsReviewTitle)}
        </Dialog.Title>
        <IconButton
          icon="close"
          onPress={() => setReviewState(null)}
          accessibilityLabel={t(K.common.close)}
          style={dialogChrome.closeButton}
        />
        <Dialog.Content style={dialogChrome.content}>
          {reviewState ? (
            <View style={{ gap: 12 }}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {t(K.personForm.relationshipValidationCheck)}
              </Text>
              <Text variant="titleSmall">
                {getRelationshipActionText({
                  mode: reviewState.mode,
                  perspective,
                  anchorName: anchorDisplayName,
                  relatedPersonName: formatPersonDisplayName(reviewState.relatedPerson),
                  t,
                })}
              </Text>
              <Text variant="bodyMedium">
                {reviewState.warnings.length === 1
                  ? reviewState.warnings[0]
                  : reviewState.warnings.map((warning, index) => `${index + 1}. ${warning}`).join('\n')}
              </Text>
            </View>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button onPress={() => setReviewState(null)}>
            {t(K.personForm.chooseAnotherMember)}
          </Button>
          <Button
            mode="contained"
            onPress={() => {
              if (!reviewState) {
                return;
              }

              const { mode, relatedPerson } = reviewState;
              setReviewState(null);
              resetAndDismiss();
              onSelectRelationship(resolveSubmissionMode(mode, perspective), relatedPerson);
            }}
          >
            {t(K.startup.continue)}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
