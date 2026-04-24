import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Button,
  Chip,
  Dialog,
  HelperText,
  IconButton,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import type { PersonGender, PersonMutationPayload, PersonPhoto, PersonRecord } from '../types/person';

export interface PersonFormSubmission extends PersonMutationPayload {}

interface PersonFormDialogProps {
  visible: boolean;
  mode: 'create' | 'edit';
  person?: PersonRecord | null;
  loading?: boolean;
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

function formatBirthDateLabel(value: string) {
  const parsedDate = parseIsoDate(value);
  return parsedDate ? parsedDate.toLocaleDateString() : 'Pick a date';
}

export default function PersonFormDialog({
  visible,
  mode,
  person,
  loading = false,
  onDismiss,
  onSubmit,
}: PersonFormDialogProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<PersonGender>('unspecified');
  const [notes, setNotes] = useState('');
  const [existingPhotos, setExistingPhotos] = useState<PersonPhoto[]>([]);
  const [removedPhotos, setRemovedPhotos] = useState<PersonPhoto[]>([]);
  const [newPhotoUris, setNewPhotoUris] = useState<string[]>([]);
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setFirstName(person?.firstName ?? '');
    setLastName(person?.lastName ?? '');
    setBirthDate(person?.birthDate ?? '');
    setGender(person?.gender ?? 'unspecified');
    setNotes(person?.notes ?? '');
    setExistingPhotos(person?.photos ?? []);
    setRemovedPhotos([]);
    setNewPhotoUris([]);
    setFirstNameError(null);
    setBirthDatePickerVisible(false);
  }, [person, visible]);

  const allPhotoCount = useMemo(
    () => existingPhotos.length + newPhotoUris.length,
    [existingPhotos, newPhotoUris],
  );

  const selectedBirthDate = useMemo(() => parseIsoDate(birthDate), [birthDate]);

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
  };

  const handleSubmit = async () => {
    if (!firstName.trim()) {
      setFirstNameError('First name is required.');
      return;
    }

    await onSubmit({
      firstName,
      lastName,
      birthDate,
      gender,
      notes,
      existingPhotos,
      removedPhotos,
      newPhotoUris,
    });
  };

  return (
    <>
      <Portal>
        <Dialog visible={visible} onDismiss={loading ? undefined : onDismiss} style={styles.dialog}>
          <Dialog.Title>{mode === 'create' ? 'Add person' : 'Edit person'}</Dialog.Title>
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

              <TextInput
                mode="outlined"
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                disabled={loading}
                style={styles.fieldSpacing}
              />

              <View style={styles.sectionSpacing}>
                <Text variant="titleSmall">Birth date</Text>
                <View style={styles.birthDateActions}>
                  <Button
                    mode="outlined"
                    icon="calendar"
                    onPress={() => setBirthDatePickerVisible(true)}
                    disabled={loading}
                  >
                    {formatBirthDateLabel(birthDate)}
                  </Button>
                  {birthDate ? (
                    <Button onPress={() => setBirthDate('')} disabled={loading}>
                      Clear
                    </Button>
                  ) : null}
                </View>
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
                          icon="close"
                          size={16}
                          style={styles.photoRemoveButton}
                          onPress={() => setNewPhotoUris((current) => current.filter((item) => item !== uri))}
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
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
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
    </>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '90%',
  },
  scrollArea: {
    borderBottomWidth: 0,
    borderTopWidth: 0,
    paddingHorizontal: 0,
  },
  content: {
    paddingBottom: 12,
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
});
