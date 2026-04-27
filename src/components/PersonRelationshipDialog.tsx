import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import type { PersonRecord } from '../types/person';
import type { RelationshipRecord } from '../types/relationship';

export type PersonRelationshipMode = 'parent-of' | 'child-of' | 'spouse-of';

interface PersonRelationshipDialogProps {
  visible: boolean;
  person: PersonRecord | null;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  loading?: boolean;
  editingRelationship?: RelationshipRecord | null;
  onDismiss: () => void;
  onSubmit: (payload: { mode: PersonRelationshipMode; relatedPersonId: string }) => void | Promise<void>;
}

function formatPersonName(person?: PersonRecord | null) {
  if (!person) {
    return 'Unknown family member';
  }

  return `${person.firstName} ${person.lastName}`.trim();
}

function getDraftFromRelationship(personId: string, relationship?: RelationshipRecord | null) {
  if (!relationship) {
    return {
      mode: 'parent-of' as PersonRelationshipMode,
      relatedPersonId: '',
    };
  }

  if (relationship.type === 'spouse') {
    return {
      mode: 'spouse-of' as PersonRelationshipMode,
      relatedPersonId: relationship.fromPersonId === personId ? relationship.toPersonId : relationship.fromPersonId,
    };
  }

  if (relationship.fromPersonId === personId) {
    return {
      mode: 'parent-of' as PersonRelationshipMode,
      relatedPersonId: relationship.toPersonId,
    };
  }

  return {
    mode: 'child-of' as PersonRelationshipMode,
    relatedPersonId: relationship.fromPersonId,
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
  onSubmit,
}: PersonRelationshipDialogProps) {
  const [mode, setMode] = useState<PersonRelationshipMode>('parent-of');
  const [relatedPersonId, setRelatedPersonId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !person) {
      return;
    }

    const draft = getDraftFromRelationship(person.id, editingRelationship);
    setMode(draft.mode);
    setRelatedPersonId(draft.relatedPersonId);
    setSearchQuery('');
    setError(null);
  }, [editingRelationship, person, visible]);

  const candidates = useMemo(
    () => people.filter((candidate) => candidate.id !== person?.id),
    [people, person?.id],
  );

  const filteredCandidates = useMemo(
    () => candidates.filter((candidate) => formatPersonName(candidate).toLowerCase().includes(searchQuery.trim().toLowerCase())),
    [candidates, searchQuery],
  );

  const duplicateRelationship = useMemo(() => {
    if (!person || !relatedPersonId) {
      return false;
    }

    return relationships.some((relationship) => {
      if (relationship.id === editingRelationship?.id) {
        return false;
      }

      if (mode === 'spouse-of') {
        const [firstId, secondId] = [person.id, relatedPersonId].sort();
        return relationship.type === 'spouse'
          && relationship.fromPersonId === firstId
          && relationship.toPersonId === secondId;
      }

      if (mode === 'parent-of') {
        return relationship.type === 'parent-child'
          && relationship.fromPersonId === person.id
          && relationship.toPersonId === relatedPersonId;
      }

      return relationship.type === 'parent-child'
        && relationship.fromPersonId === relatedPersonId
        && relationship.toPersonId === person.id;
    });
  }, [editingRelationship?.id, mode, person, relatedPersonId, relationships]);

  const handleSubmit = async () => {
    if (!person) {
      setError('This family member could not be loaded.');
      return;
    }

    if (!relatedPersonId) {
      setError('Choose a related family member first.');
      return;
    }

    if (duplicateRelationship) {
      setError('That relationship already exists.');
      return;
    }

    await onSubmit({ mode, relatedPersonId });
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={loading ? undefined : onDismiss} style={styles.dialog}>
        <Dialog.Title>{editingRelationship ? 'Edit relationship' : 'Add relationship'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text variant="bodyMedium" style={styles.helperText}>
              Manage connections directly from {formatPersonName(person)}.
            </Text>

            <SegmentedButtons
              value={mode}
              onValueChange={(value) => {
                setMode(value as PersonRelationshipMode);
                setError(null);
              }}
              buttons={[
                { value: 'parent-of', label: 'Parent of' },
                { value: 'child-of', label: 'Child of' },
                { value: 'spouse-of', label: 'Spouse of' },
              ]}
              style={styles.segmentedButtons}
            />

            <View style={styles.section}>
              <Text variant="titleSmall">Select related family member</Text>
              <TextInput
                mode="outlined"
                label="Search family member"
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
                disabled={loading}
              />
              <View style={styles.peopleWrap}>
                {filteredCandidates.map((candidate) => (
                  <Chip
                    key={candidate.id}
                    selected={relatedPersonId === candidate.id}
                    onPress={() => {
                      setRelatedPersonId(candidate.id);
                      setError(null);
                    }}
                    disabled={loading}
                    style={styles.personChip}
                  >
                    {formatPersonName(candidate)}
                  </Chip>
                ))}
              </View>
            </View>

            <HelperText type="error" visible={!!error || duplicateRelationship}>
              {error ?? (duplicateRelationship ? 'That relationship already exists.' : ' ')}
            </HelperText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={loading}>Cancel</Button>
          <Button onPress={handleSubmit} disabled={loading || !person || candidates.length === 0}>Save</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '82%',
    marginHorizontal: 16,
  },
  scrollArea: {
    borderBottomWidth: 0,
    borderTopWidth: 0,
    paddingHorizontal: 0,
  },
  helperText: {
    color: '#6B6B74',
  },
  segmentedButtons: {
    marginTop: 16,
  },
  section: {
    marginTop: 16,
  },
  searchInput: {
    marginTop: 8,
  },
  peopleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  personChip: {
    marginRight: 8,
    marginBottom: 8,
  },
});

