import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import type { PersonRecord } from './dto/person';
import type { RelationshipRecord } from './dto/relationship';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.personRelationshipDialog;

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
  if (!person) return 'Unknown family member';
  return `${person.firstName} ${person.lastName}`.trim();
}

function getDraftFromRelationship(personId: string, relationship?: RelationshipRecord | null) {
  if (!relationship) return { mode: 'parent-of' as PersonRelationshipMode, relatedPersonId: '' };
  if (relationship.type === 'spouse') {
    return {
      mode: 'spouse-of' as PersonRelationshipMode,
      relatedPersonId: relationship.fromPersonId === personId ? relationship.toPersonId : relationship.fromPersonId,
    };
  }
  if (relationship.fromPersonId === personId) {
    return { mode: 'parent-of' as PersonRelationshipMode, relatedPersonId: relationship.toPersonId };
  }
  return { mode: 'child-of' as PersonRelationshipMode, relatedPersonId: relationship.fromPersonId };
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
    if (!visible || !person) return;
    const draft = getDraftFromRelationship(person.id, editingRelationship);
    setMode(draft.mode);
    setRelatedPersonId(draft.relatedPersonId);
    setSearchQuery('');
    setError(null);
  }, [editingRelationship, person, visible]);

  // Gender-aware mode button labels
  const modeButtons = useMemo(() => [
    {
      value: 'parent-of',
      label: person?.gender === 'male' ? 'Father of' : person?.gender === 'female' ? 'Mother of' : 'Parent of',
    },
    {
      value: 'child-of',
      label: person?.gender === 'male' ? 'Son of' : person?.gender === 'female' ? 'Daughter of' : 'Child of',
    },
    { value: 'spouse-of', label: 'Spouse of' },
  ], [person?.gender]);

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

  const selectedPerson = useMemo(
    () => (relatedPersonId ? candidates.find((c) => c.id === relatedPersonId) ?? null : null),
    [candidates, relatedPersonId],
  );

  const filteredCandidates = useMemo(
    () => candidates.filter((c) => formatPersonName(c).toLowerCase().includes(searchQuery.trim().toLowerCase())),
    [candidates, searchQuery],
  );

  const duplicateRelationship = useMemo(() => {
    if (!person || !relatedPersonId) return false;
    return relationships.some((relationship) => {
      if (relationship.id === editingRelationship?.id) return false;
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
    if (!person) { setError('This family member could not be loaded.'); return; }
    if (!relatedPersonId) { setError('Choose a related family member first.'); return; }
    if (duplicateRelationship) { setError('That relationship already exists.'); return; }
    await onSubmit({ mode, relatedPersonId });
  };

  const clearSelection = () => {
    setRelatedPersonId('');
    setSearchQuery('');
    setError(null);
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={loading ? undefined : onDismiss} style={styles.dialog}>
        <Dialog.Title>{editingRelationship ? 'Edit relationship' : 'Add relationship'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text variant="bodyMedium" style={styles.helperText}>
              Manage connections directly from {formatPersonName(person)}.
            </Text>

            <SegmentedButtons
              value={mode}
              onValueChange={(value) => {
                setMode(value as PersonRelationshipMode);
                setRelatedPersonId('');
                setSearchQuery('');
                setError(null);
              }}
              buttons={modeButtons}
              style={styles.segmentedButtons}
            />

            <View style={styles.section}>
              <Text variant="titleSmall">Select related family member</Text>
              {selectedPerson ? (
                <View style={{ marginTop: 12 }}>
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
                        onPress={() => {
                          setRelatedPersonId(candidate.id);
                          setSearchQuery('');
                          setError(null);
                        }}
                        disabled={loading}
                        style={styles.personChip}
                      >
                        {formatPersonName(candidate)}
                      </Chip>
                    ))}
                  </View>
                </>
              )}
            </View>

            <HelperText type="error" visible={!!error || duplicateRelationship}>
              {error ?? (duplicateRelationship ? 'That relationship already exists.' : ' ')}
            </HelperText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button mode="outlined" onPress={onDismiss} disabled={loading}>Cancel</Button>
          <Button mode="contained" onPress={handleSubmit} disabled={loading || !person || candidates.length === 0}>Save</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
