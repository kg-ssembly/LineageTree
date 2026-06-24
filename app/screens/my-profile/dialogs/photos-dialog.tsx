import React from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text, useTheme } from 'react-native-paper';
import type { PersonPhoto } from '../../../../components/dto/person';
import { MAX_PHOTOS_PER_PERSON } from '../../../../components/photo-utils';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';

const dialogChrome = GlobalStyles.dialogChrome;
const personProfileStyles = GlobalStyles.personProfile;

export function PhotosDialog({
  visible,
  mutating,
  photoProcessing,
  photoEditorCount,
  canSavePhotoChanges,
  photoEditorExistingPhotos,
  photoEditorNewPhotoUris,
  photoEditorPreferredPhotoRef,
  onDismiss,
  onLibrary,
  onCamera,
  onTogglePreferred,
  onRemoveExisting,
  onRemoveNew,
  onSave,
}: {
  visible: boolean;
  mutating: boolean;
  photoProcessing: boolean;
  photoEditorCount: number;
  canSavePhotoChanges: boolean;
  photoEditorExistingPhotos: PersonPhoto[];
  photoEditorNewPhotoUris: string[];
  photoEditorPreferredPhotoRef: string;
  onDismiss: () => void;
  onLibrary: () => void;
  onCamera: () => void;
  onTogglePreferred: (value: string) => void;
  onRemoveExisting: (photo: PersonPhoto) => void;
  onRemoveNew: (uri: string) => void;
  onSave: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={mutating ? undefined : onDismiss} style={[dialogChrome.dialog, personProfileStyles.memoryDialog, { backgroundColor: theme.colors.surface }]}>
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t('Manage photos')}</Dialog.Title>
        <IconButton icon="close" onPress={onDismiss} disabled={mutating} accessibilityLabel={t('Cancel')} style={dialogChrome.closeButton} />
        <Dialog.ScrollArea style={personProfileStyles.memoryDialogScrollArea}>
          <ScrollView contentContainerStyle={personProfileStyles.memoryDialogContent} keyboardShouldPersistTaps="handled">
            <View style={personProfileStyles.memoryDialogPhotoActions}>
              <Button mode="outlined" icon="image-plus" onPress={onLibrary} disabled={mutating || photoProcessing || photoEditorCount >= MAX_PHOTOS_PER_PERSON}>
                {t('Library')}
              </Button>
              <Button mode="outlined" icon="camera" onPress={onCamera} disabled={mutating || photoProcessing || photoEditorCount >= MAX_PHOTOS_PER_PERSON}>
                {t('Camera')}
              </Button>
            </View>
            <Text variant="bodySmall" style={personProfileStyles.memoryDialogHint}>
              {t('Add up to 5 photos. Every photo is compressed to stay under 2 MB. When you choose a preferred photo, that one is cropped to fit the circular tree avatar.')}
            </Text>

            {photoEditorCount > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={personProfileStyles.memoryDialogPhotoList}>
                {photoEditorExistingPhotos.map((photo) => (
                  <View key={photo.id} style={personProfileStyles.memoryDialogPhotoCard}>
                    <Image source={{ uri: photo.url }} style={personProfileStyles.memoryDialogPhoto} />
                    <IconButton
                      icon={photoEditorPreferredPhotoRef === photo.id ? 'star' : 'star-outline'}
                      size={18}
                      style={[personProfileStyles.memoryDialogPhotoButton, personProfileStyles.memoryDialogPhotoPrimaryButton]}
                      onPress={() => onTogglePreferred(photo.id)}
                      disabled={mutating}
                    />
                    <IconButton
                      icon="close"
                      size={16}
                      style={[personProfileStyles.memoryDialogPhotoButton, personProfileStyles.memoryDialogPhotoRemoveButton]}
                      onPress={() => onRemoveExisting(photo)}
                      disabled={mutating}
                    />
                  </View>
                ))}
                {photoEditorNewPhotoUris.map((uri) => (
                  <View key={uri} style={personProfileStyles.memoryDialogPhotoCard}>
                    <Image source={{ uri }} style={personProfileStyles.memoryDialogPhoto} />
                    <IconButton
                      icon={photoEditorPreferredPhotoRef === uri ? 'star' : 'star-outline'}
                      size={18}
                      style={[personProfileStyles.memoryDialogPhotoButton, personProfileStyles.memoryDialogPhotoPrimaryButton]}
                      onPress={() => onTogglePreferred(uri)}
                      disabled={mutating}
                    />
                    <IconButton
                      icon="close"
                      size={16}
                      style={[personProfileStyles.memoryDialogPhotoButton, personProfileStyles.memoryDialogPhotoRemoveButton]}
                      onPress={() => onRemoveNew(uri)}
                      disabled={mutating}
                    />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text variant="bodySmall" style={personProfileStyles.memoryDialogHint}>
                No photos added yet.
              </Text>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button mode="contained" onPress={onSave} disabled={mutating || photoProcessing || !canSavePhotoChanges}>{t('Save photos')}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
