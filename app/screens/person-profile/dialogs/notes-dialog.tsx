import React from 'react';
import { ScrollView } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const dialogChrome = GlobalStyles.dialogChrome;
const styles = GlobalStyles.personProfile;

export function PersonNotesDialog({
  visible,
  mutating,
  notesDraft,
  setNotesDraft,
  onDismiss,
  onSave,
}: {
  visible: boolean;
  mutating: boolean;
  notesDraft: string;
  setNotesDraft: (value: string) => void;
  onDismiss: () => void;
  onSave: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={mutating ? undefined : onDismiss} style={[dialogChrome.dialog, styles.memoryDialog, { backgroundColor: theme.colors.surface }]}>
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(K.memories.notes)}</Dialog.Title>
        <IconButton icon="close" onPress={onDismiss} disabled={mutating} accessibilityLabel={t(K.common.cancel)} style={dialogChrome.closeButton} />
        <Dialog.ScrollArea style={styles.memoryDialogScrollArea}>
          <ScrollView contentContainerStyle={styles.memoryDialogContent} keyboardShouldPersistTaps="handled">
            <Text variant="bodySmall" style={styles.memoryDialogHint}>
              {t(K.memories.notesSummary)}
            </Text>
            <TextInput mode="outlined" label={t(K.memories.familyNotes)} value={notesDraft} onChangeText={setNotesDraft} multiline numberOfLines={6} style={styles.memoryDialogInput} disabled={mutating} />
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button mode="contained" onPress={onSave} disabled={mutating}>{t(K.memories.saveNotes)}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
