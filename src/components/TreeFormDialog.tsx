import React, { useEffect, useState } from 'react';
import { Button, Dialog, HelperText, Portal, TextInput } from 'react-native-paper';
import type { FamilyTree } from '../types/tree';
import { GlobalStyles } from '../styles/global-styles';

const styles = GlobalStyles.treeFormDialog;

interface TreeFormDialogProps {
  visible: boolean;
  mode: 'create' | 'edit';
  tree?: FamilyTree | null;
  loading?: boolean;
  onDismiss: () => void;
  onSubmit: (name: string) => void | Promise<void>;
}

export default function TreeFormDialog({
  visible,
  mode,
  tree,
  loading = false,
  onDismiss,
  onSubmit,
}: TreeFormDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setName(tree?.name ?? '');
    setError(null);
  }, [tree, visible]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Tree name is required.');
      return;
    }

    await onSubmit(trimmedName);
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={loading ? undefined : onDismiss} style={styles.dialog}>
        <Dialog.Title>{mode === 'create' ? 'Create family tree' : 'Rename family tree'}</Dialog.Title>
        <Dialog.Content>
          <TextInput
            mode="outlined"
            label="Tree name"
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (error) {
                setError(null);
              }
            }}
            autoFocus
            disabled={loading}
            error={!!error}
          />
          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={loading}>Cancel</Button>
          <Button onPress={handleSubmit} disabled={loading}>
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

