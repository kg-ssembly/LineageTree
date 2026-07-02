import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Button, Dialog, IconButton, List, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { GlobalStyles } from '../constants/styles';
import { useI18n } from '../hooks/use-i18n';
import { I18N_KEYS as K } from '../i18n/keys';
import type { PendingRelationshipMode } from './person-form-dialog';
import type { PersonRecord } from './dto/person';
import type { PendingRelationshipSubmission } from './person-form-dialog';
import type { RelationshipRecord } from './dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND } from './dto/relationship';
import { getRelationshipValidationFeedback } from './family-tree-validation';

function formatPersonName(person: PersonRecord) {
  return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim();
}

const dialogChrome = GlobalStyles.dialogChrome;

type AddPersonEntryDialogProps = {
  visible: boolean;
  hasExistingFamilyMembers: boolean;
  relationshipCandidates: PersonRecord[];
  relationships?: RelationshipRecord[];
  existingPendingRelationships?: PendingRelationshipSubmission[];
  allowUnrelatedEntry?: boolean;
  chooserTitleKey?: string;
  chooserHelperKey?: string;
  onDismiss: () => void;
  onSelectRelationship: (mode: PendingRelationshipMode, relatedPerson: PersonRecord) => void;
  onAddFirstFamilyMember?: () => void;
};

export default function AddPersonEntryDialog({
  visible,
  hasExistingFamilyMembers,
  relationshipCandidates,
  relationships = [],
  existingPendingRelationships = [],
  allowUnrelatedEntry = true,
  chooserTitleKey,
  chooserHelperKey,
  onDismiss,
  onSelectRelationship,
  onAddFirstFamilyMember,
}: AddPersonEntryDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [selectedMode, setSelectedMode] = useState<PendingRelationshipMode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const validationPeople = useMemo<PersonRecord[]>(() => [
    {
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
  ], [relationshipCandidates]);

  useEffect(() => {
    if (!visible) {
      setSelectedMode(null);
      setSearchQuery('');
    }
  }, [visible]);

  const filteredCandidates = useMemo(() => {
    if (!selectedMode) {
      return [];
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();
    return relationshipCandidates.filter((candidate) => (
      !normalizedQuery || formatPersonName(candidate).toLowerCase().includes(normalizedQuery)
    ));
  }, [relationshipCandidates, searchQuery, selectedMode]);

  const resetAndDismiss = () => {
    setSelectedMode(null);
    setSearchQuery('');
    onDismiss();
  };

  const chooseMode = (mode: PendingRelationshipMode) => {
    setSelectedMode(mode);
    setSearchQuery('');
  };

  const handleRelationshipSelection = (mode: PendingRelationshipMode, relatedPerson: PersonRecord) => {
    const pendingValidationRelationships: RelationshipRecord[] = existingPendingRelationships.map((relationship, index) => ({
      id: `__pending-relationship__-${index}`,
      treeId: '',
      ownerId: '',
      type: relationship.mode === 'spouse-of' ? 'spouse' : 'parent-child',
      fromPersonId: relationship.mode === 'child-of' ? relationship.relatedPersonId : '__new-person__',
      toPersonId: relationship.mode === 'child-of' ? '__new-person__' : relationship.relatedPersonId,
      parentChildKind: relationship.mode === 'spouse-of' ? undefined : relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
      createdAt: '',
    }));
    const validationFeedback = getRelationshipValidationFeedback({
      people: validationPeople,
      relationships: [...relationships, ...pendingValidationRelationships],
      type: mode === 'spouse-of' ? 'spouse' : 'parent-child',
      fromPersonId: mode === 'child-of' ? relatedPerson.id : '__new-person__',
      toPersonId: mode === 'child-of' ? '__new-person__' : relatedPerson.id,
      parentChildKind: mode === 'spouse-of' ? undefined : DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
    });
    const softWarnings = validationFeedback.warnings.filter((warning) => (
      warning === t(K.relationship.moreThanTwoBiologicalParents)
      || warning === t(K.relationship.anotherCurrentPartnerExists)
    ));

    const confirmSelection = () => {
      resetAndDismiss();
      onSelectRelationship(mode, relatedPerson);
    };

    if (softWarnings.length === 0) {
      confirmSelection();
      return;
    }

    Alert.alert(
      t(K.personForm.relationshipNeedsReviewTitle),
      softWarnings.join('\n\n'),
      [
        { text: t(K.personForm.chooseAnotherMember), style: 'cancel' },
        { text: t(K.startup.continue), onPress: confirmSelection },
      ],
    );
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
            ? t(K.relationship.selectRelatedFamilyMember)
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
              ? t(K.personForm.addMemberChooserMemberListHelper)
              : chooserHelperKey
                ? t(chooserHelperKey)
                : hasExistingFamilyMembers
                ? t(K.personForm.addMemberChooserHelper)
                : t(K.personForm.addMemberChooserEmptyHint)}
          </Text>

          {selectedMode ? (
            <View style={{ marginTop: 16 }}>
              <TextInput
                mode="outlined"
                label={t(K.common.searchFamilyMembers)}
                value={searchQuery}
                onChangeText={setSearchQuery}
                left={<TextInput.Icon icon="magnify" />}
                style={{ marginBottom: 12 }}
              />
              <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                <View>
                  {filteredCandidates.map((candidate) => (
                    <List.Item
                      key={candidate.id}
                      title={formatPersonName(candidate)}
                      description={t(
                        selectedMode === 'parent-of'
                          ? K.relationship.createParentForName
                          : selectedMode === 'child-of'
                            ? K.relationship.createChildForName
                            : K.relationship.createSpouseForName,
                        { name: formatPersonName(candidate) },
                      )}
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
                        handleRelationshipSelection(selectedMode, candidate);
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
              <Button mode="text" onPress={() => { setSelectedMode(null); setSearchQuery(''); }} style={{ marginTop: 12 }}>
                {t(K.common.back)}
              </Button>
            </View>
          ) : (
            <View style={{ marginTop: 16, gap: 10 }}>
              {hasExistingFamilyMembers ? (
                <>
                  <Button mode="contained" icon="account-arrow-up-outline" onPress={() => chooseMode('parent-of')}>
                    {t(K.relationship.parentOf)}
                  </Button>
                  <Button mode="outlined" icon="account-arrow-down-outline" onPress={() => chooseMode('child-of')}>
                    {t(K.relationship.childOf)}
                  </Button>
                  <Button mode="outlined" icon="account-heart-outline" onPress={() => chooseMode('spouse-of')}>
                    {t(K.relationship.spouseOf)}
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
    </Portal>
  );
}
