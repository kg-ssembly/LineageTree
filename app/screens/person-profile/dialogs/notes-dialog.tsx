import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const styles = StyleSheet.create({
  dialog: {
    marginHorizontal: 12,
    borderRadius: 20,
    maxHeight: '88%',
  },
  dialogTitle: {
    paddingBottom: 4,
    paddingRight: 44,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 8,
    margin: 0,
  },
  scrollArea: {
    borderBottomWidth: 0,
    borderTopWidth: 0,
    paddingHorizontal: 16,
  },
  content: {
    paddingBottom: 12,
  },
  hint: {
    marginBottom: 12,
  },
  input: {
    minHeight: 140,
  },
  actions: {
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

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
      <Dialog visible={visible} onDismiss={mutating ? undefined : onDismiss} style={[styles.dialog, { backgroundColor: theme.colors.surface }]}>
        <Dialog.Title style={styles.dialogTitle}>{t(K.memories.notes)}</Dialog.Title>
        <IconButton icon="close" onPress={onDismiss} disabled={mutating} accessibilityLabel={t(K.common.cancel)} style={styles.closeButton} />
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text variant="bodySmall" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
              {t(K.memories.notesSummary)}
            </Text>
            <TextInput mode="outlined" label={t(K.memories.familyNotes)} value={notesDraft} onChangeText={setNotesDraft} multiline numberOfLines={6} style={styles.input} disabled={mutating} />
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={[styles.actions, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button mode="contained" onPress={onSave} disabled={mutating}>{t(K.memories.saveNotes)}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
