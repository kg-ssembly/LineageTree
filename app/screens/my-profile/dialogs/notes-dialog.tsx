import React from 'react';
import { PersonNotesDialog } from '../../profile-shared';

export function NotesDialog({
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
  return (
    <PersonNotesDialog
      visible={visible}
      mutating={mutating}
      notesDraft={notesDraft}
      setNotesDraft={setNotesDraft}
      onDismiss={onDismiss}
      onSave={onSave}
    />
  );
}
