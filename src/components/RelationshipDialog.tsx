import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import type { PersonRecord } from '../../components/dto/person';
import type { RelationshipRecord, RelationshipType } from '../../components/dto/relationship';
import { GlobalStyles } from '../styles/global-styles';

const styles = GlobalStyles.relationshipDialog;

interface RelationshipDialogProps {
  visible: boolean;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  loading?: boolean;
  onDismiss: () => void;
  onSubmit: (payload: { type: RelationshipType; fromPersonId: string; toPersonId: string }) => void | Promise<void>;
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
    setError(null);
  }, [visible]);

  const duplicateRelationship = useMemo(() => {
    if (!fromPersonId || !toPersonId) {
      return false;
    }

    if (type === 'spouse') {
      const [firstId, secondId] = [fromPersonId, toPersonId].sort();
      return relationships.some(
        (relationship) => relationship.type === 'spouse'
          && relationship.fromPersonId === firstId
          && relationship.toPersonId === secondId,
      );
    }

    return relationships.some(
      (relationship) => relationship.type === 'parent-child'
        && relationship.fromPersonId === fromPersonId
        && relationship.toPersonId === toPersonId,
    );
  }, [fromPersonId, relationships, toPersonId, type]);

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

    if (duplicateRelationship) {
      setError('That relationship already exists.');
      return;
    }

    await onSubmit({ type, fromPersonId, toPersonId });
  };

  const firstLabel = type === 'spouse' ? 'Select spouse A' : 'Select parent';
  const secondLabel = type === 'spouse' ? 'Select spouse B' : 'Select child';

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loading ? undefined : onDismiss}
        style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={styles.dialogTitle}>Add relationship</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
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

            <HelperText type="error" visible={!!error || duplicateRelationship}>
              {error ?? (duplicateRelationship ? 'That relationship already exists.' : ' ')}
            </HelperText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={[styles.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}> 
          <Button onPress={onDismiss} disabled={loading}>Cancel</Button>
          <Button onPress={handleSubmit} disabled={loading || people.length < 2}>Save</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

