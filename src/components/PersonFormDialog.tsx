import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Button,
  Chip,
  Dialog,
  HelperText,
  IconButton,
  Menu,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import type { PersonGender, PersonLifeEvent, PersonMutationPayload, PersonPhoto, PersonRecord } from '../types/person';

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
  onDismiss: () => void;
  onSubmit: (payload: PersonFormSubmission) => void | Promise<void>;
}

const genderOptions: Array<{ label: string; value: PersonGender }> = [
  { label: 'Unspecified', value: 'unspecified' },
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Non-binary', value: 'non-binary' },
  { label: 'Other', value: 'other' },
];

const relationshipModeOptions: Array<{ label: string; value: PendingRelationshipMode }> = [
  { label: 'Parent of', value: 'parent-of' },
  { label: 'Child of', value: 'child-of' },
  { label: 'Spouse of', value: 'spouse-of' },
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
  const parsedDate = parseIsoDate(value);
  return parsedDate ? parsedDate.toLocaleDateString() : 'Pick a date';
}

function formatPersonName(person: PersonRecord) {
  return `${person.firstName} ${person.lastName}`.trim();
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
  onDismiss,
  onSubmit,
}: PersonFormDialogProps) {
  const theme = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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

    setFirstName(person?.firstName ?? initialValues?.firstName ?? '');
    setLastName(person?.lastName ?? initialValues?.lastName ?? '');
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

  const allPhotoCount = useMemo(
    () => existingPhotos.length + newPhotoUris.length,
    [existingPhotos, newPhotoUris],
  );

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

  const addImageFromResult = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets.length > 0) {
      setNewPhotoUris((current) => [...current, result.assets[0].uri]);
    }
  };

  const handleAddPhotoFromLibrary = async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow access to your photo library to add family photos.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    addImageFromResult(result);
  };

  const handleCapturePhoto = async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Please allow camera access to capture family photos.');
        return;
      }
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      addImageFromResult(result);
    } catch {
      Alert.alert('Camera unavailable', 'The camera could not be opened on this device.');
    }
  };

  const handleRemoveExistingPhoto = (photo: PersonPhoto) => {
    setExistingPhotos((current) => current.filter((currentPhoto) => currentPhoto.id !== photo.id));
    setRemovedPhotos((current) => [...current, photo]);
    if (preferredPhotoRef === photo.id) {
      setPreferredPhotoRef('');
    }
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

    if (birthDate && deathDate && deathDate < birthDate) {
      setDeathDateError('Death date cannot be earlier than birth date.');
      return;
    }

    await onSubmit({
      firstName,
      lastName,
      birthDate,
      deathDate,
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
          style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={styles.dialogTitle}>{mode === 'create' ? 'Add family member' : 'Edit family member'}</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
                <Text variant="titleSmall">Date of death</Text>
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
                        if (deathDateError) {
                          setDeathDateError(null);
                        }
                      }}
                      disabled={loading}
                    >
                      Clear
                    </Button>
                  ) : null}
                </View>
                <HelperText type="info" visible={!deathDateError}>
                  Leave blank to mark this family member as still present.
                </HelperText>
                <HelperText type="error" visible={!!deathDateError}>
                  {deathDateError}
                </HelperText>
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
                    const filteredCandidates = relationshipCandidates.filter((candidate) => formatPersonName(candidate).toLowerCase().includes(draft.searchQuery.trim().toLowerCase()));
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
                            if (relationshipError) {
                              setRelationshipError(null);
                            }
                          }}
                          buttons={relationshipModeOptions}
                        />
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
                              selected={draft.relatedPersonId === candidate.id}
                              onPress={() => {
                                setPendingRelationships((current) => current.map((item) => item.key === draft.key ? { ...item, relatedPersonId: candidate.id } : item));
                                if (relationshipError) {
                                  setRelationshipError(null);
                                }
                              }}
                              style={styles.relationshipChip}
                            >
                              {formatPersonName(candidate)}
                            </Chip>
                          ))}
                        </ScrollView>
                      </View>
                    );
                  })}
                  <HelperText type="error" visible={!!relationshipError}>
                    {relationshipError}
                  </HelperText>
                </View>
              ) : null}

              <TextInput
                mode="outlined"
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                disabled={loading}
                style={styles.sectionSpacing}
              />

              <View style={styles.sectionSpacing}>
                <View style={styles.photoHeader}>
                  <Text variant="titleSmall">Photos ({allPhotoCount})</Text>
                </View>
                <View style={styles.photoActionRow}>
                  <Button mode="outlined" onPress={handleAddPhotoFromLibrary} disabled={loading} icon="image-plus">
                    Library
                  </Button>
                  <Button mode="outlined" onPress={handleCapturePhoto} disabled={loading} icon="camera">
                    Camera
                  </Button>
                </View>
                <Text variant="bodySmall" style={styles.photoHint}>
                  Add photos from the library or capture a new one directly from the camera.
                </Text>

                {(existingPhotos.length > 0 || newPhotoUris.length > 0) ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoList}>
                    {existingPhotos.map((photo) => (
                      <View key={photo.id} style={styles.photoCard}>
                        <Image source={{ uri: photo.url }} style={styles.photo} />
                        <IconButton
                          icon={preferredPhotoRef === photo.id ? 'star' : 'star-outline'}
                          size={18}
                          style={styles.photoPrimaryButton}
                          onPress={() => setPreferredPhotoRef((current) => current === photo.id ? '' : photo.id)}
                          disabled={loading}
                        />
                        <IconButton
                          icon="close"
                          size={16}
                          style={styles.photoRemoveButton}
                          onPress={() => handleRemoveExistingPhoto(photo)}
                          disabled={loading}
                        />
                      </View>
                    ))}
                    {newPhotoUris.map((uri) => (
                      <View key={uri} style={styles.photoCard}>
                        <Image source={{ uri }} style={styles.photo} />
                        <IconButton
                          icon={preferredPhotoRef === uri ? 'star' : 'star-outline'}
                          size={18}
                          style={styles.photoPrimaryButton}
                          onPress={() => setPreferredPhotoRef((current) => current === uri ? '' : uri)}
                          disabled={loading}
                        />
                        <IconButton
                          icon="close"
                          size={16}
                          style={styles.photoRemoveButton}
                          onPress={() => {
                            setNewPhotoUris((current) => current.filter((item) => item !== uri));
                            if (preferredPhotoRef === uri) {
                              setPreferredPhotoRef('');
                            }
                          }}
                          disabled={loading}
                        />
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text variant="bodySmall" style={styles.photoHint}>
                    No photos added yet.
                  </Text>
                )}
                {(existingPhotos.length > 0 || newPhotoUris.length > 0) ? (
                  <HelperText type="info" visible>
                    Tap the star on a photo to use it as the profile picture in the tree view.
                  </HelperText>
                ) : null}
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[styles.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}> 
            <Button onPress={onDismiss} disabled={loading}>Cancel</Button>
            <Button onPress={handleSubmit} disabled={loading}>
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
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

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '92%',
    marginHorizontal: 12,
    borderRadius: 5,
  },
  dialogTitle: {
    paddingBottom: 4,
  },
  scrollArea: {
    borderBottomWidth: 0,
    borderTopWidth: 0,
    paddingHorizontal: 4,
  },
  content: {
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  dialogActions: {
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fieldSpacing: {
    marginTop: 8,
  },
  sectionSpacing: {
    marginTop: 16,
  },
  birthDateActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
  },
  relationshipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helperText: {
    marginTop: 8,
    color: '#6B6B74',
  },
  pendingRelationshipCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#D7D1F9',
    backgroundColor: '#F7F5FF',
  },
  relationshipChipRow: {
    paddingTop: 12,
    paddingRight: 8,
  },
  relationshipChip: {
    marginRight: 8,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  photoActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  photoHint: {
    marginTop: 8,
    opacity: 0.7,
  },
  photoList: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  photoCard: {
    marginRight: 12,
    position: 'relative',
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#ECE8FF',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    margin: 0,
  },
  photoPrimaryButton: {
    position: 'absolute',
    top: -6,
    left: -6,
    backgroundColor: '#FFFFFF',
    margin: 0,
  },
});
