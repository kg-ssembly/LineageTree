import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import type { PersonRecord } from './dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, RelationshipType, SpouseRelationshipStatus } from './dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from './dto/relationship';
import { validateProposedRelationship } from './family-tree-validation';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.relationshipDialog;
const dialogChrome = GlobalStyles.dialogChrome;

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
  return `${person.firstName} ${person.lastName}`.trim();
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
  const [type, setType] = useState<RelationshipType>('parent-child');
  const [fromPersonId, setFromPersonId] = useState('');
  const [toPersonId, setToPersonId] = useState('');
  const [fromSearch, setFromSearch] = useState('');
  const [toSearch, setToSearch] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState<SpouseRelationshipStatus>(DEFAULT_SPOUSE_RELATIONSHIP_STATUS);
  const [parentChildKind, setParentChildKind] = useState<ParentChildRelationshipKind>(DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND);
  const [error, setError] = useState<string | null>(null);

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

  const validationMessage = useMemo(
    () => validateProposedRelationship({
      people,
      relationships,
      type,
      fromPersonId,
      toPersonId,
    }),
    [fromPersonId, people, relationships, toPersonId, type],
  );

  const filteredFromPeople = useMemo(
    () => people.filter((person) => formatPersonName(person).toLowerCase().includes(fromSearch.trim().toLowerCase())),
    [fromSearch, people],
  );
  const filteredToPeople = useMemo(
    () => people.filter((person) => formatPersonName(person).toLowerCase().includes(toSearch.trim().toLowerCase())),
    [people, toSearch],
  );

  const handleSubmit = async () => {
    if (people.length < 2) {
      setError('Add at least two family members before creating a relationship.');
      return;
    }

    if (!fromPersonId || !toPersonId) {
      setError('Select both family members for this relationship.');
      return;
    }

    if (fromPersonId === toPersonId) {
      setError(type === 'spouse'
        ? 'A family member cannot be their own spouse.'
        : 'A family member cannot be their own parent or child.');
      return;
    }

    if (validationMessage) {
      setError(validationMessage);
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

  const firstLabel = type === 'spouse' ? 'Select spouse A' : 'Select parent';
  const secondLabel = type === 'spouse' ? 'Select spouse B' : 'Select child';

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loading ? undefined : onDismiss}
        style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, styles.dialogTitle]}>Add relationship</Dialog.Title>
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
                  { value: 'parent-child', label: 'Parent -> Child' },
                  { value: 'spouse', label: 'Spouse <-> Spouse' },
                ]}
              />
            </View>

            {type === 'spouse' ? (
              <View style={[styles.relationshipTypeCard, { borderColor: theme.colors.outlineVariant }]}>
                <Text variant="titleSmall">Relationship status</Text>
                <SegmentedButtons
                  value={relationshipStatus}
                  onValueChange={(value) => setRelationshipStatus(value as SpouseRelationshipStatus)}
                  buttons={[
                    { value: 'partner', label: 'Partner' },
                    { value: 'married', label: 'Married' },
                    { value: 'separated', label: 'Separated' },
                    { value: 'divorced', label: 'Divorced' },
                    { value: 'widowed', label: 'Widowed' },
                  ]}
                  style={{ marginTop: 10 }}
                />
              </View>
            ) : (
              <View style={[styles.relationshipTypeCard, { borderColor: theme.colors.outlineVariant }]}>
                <Text variant="titleSmall">Child relationship</Text>
                <SegmentedButtons
                  value={parentChildKind}
                  onValueChange={(value) => setParentChildKind(value as ParentChildRelationshipKind)}
                  buttons={[
                    { value: 'biological', label: 'Biological' },
                    { value: 'step', label: 'Step' },
                    { value: 'adopted', label: 'Adopted' },
                    { value: 'foster', label: 'Foster' },
                    { value: 'guardian', label: 'Guardian' },
                  ]}
                  style={{ marginTop: 10 }}
                />
              </View>
            )}

            <View style={[styles.section, styles.sectionCard, { borderColor: theme.colors.outlineVariant }]}>
              <Text variant="titleSmall">{firstLabel}</Text>
              <TextInput
                mode="outlined"
                label="Search family member"
                value={fromSearch}
                onChangeText={setFromSearch}
                style={styles.searchInput}
                disabled={loading}
              />
              <View style={styles.peopleWrap}>
                {filteredFromPeople.map((person) => (
                  <Chip
                    key={`from-${person.id}`}
                    selected={fromPersonId === person.id}
                    onPress={() => {
                      setFromPersonId(person.id);
                      setError(null);
                    }}
                    disabled={loading}
                    style={styles.personChip}
                  >
                    {formatPersonName(person)}
                  </Chip>
                ))}
              </View>
            </View>

            <View style={[styles.section, styles.sectionCard, { borderColor: theme.colors.outlineVariant }]}>
              <Text variant="titleSmall">{secondLabel}</Text>
              <TextInput
                mode="outlined"
                label="Search family member"
                value={toSearch}
                onChangeText={setToSearch}
                style={styles.searchInput}
                disabled={loading}
              />
              <View style={styles.peopleWrap}>
                {filteredToPeople.map((person) => (
                  <Chip
                    key={`to-${person.id}`}
                    selected={toPersonId === person.id}
                    onPress={() => {
                      setToPersonId(person.id);
                      setError(null);
                    }}
                    disabled={loading}
                    style={styles.personChip}
                  >
                    {formatPersonName(person)}
                  </Chip>
                ))}
              </View>
            </View>

            <HelperText type="error" visible={!!error || !!validationMessage}>
              {error ?? validationMessage ?? ' '}
            </HelperText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={[dialogChrome.dialogActions, styles.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button mode="outlined" onPress={onDismiss} disabled={loading}>Cancel</Button>
          <Button mode="contained" onPress={handleSubmit} disabled={loading || people.length < 2 || !!validationMessage}>Save</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
