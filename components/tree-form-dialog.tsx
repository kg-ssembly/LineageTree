import React, { useEffect, useState } from 'react';
import { Button, Dialog, HelperText, IconButton, Portal, TextInput, useTheme } from 'react-native-paper';
import type { FamilyTree } from './dto/tree';
import { useI18n } from '../hooks/use-i18n';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.treeFormDialog;
const dialogChrome = GlobalStyles.dialogChrome;

interface TreeFormDialogProps {
  visible: boolean;
  mode: 'create' | 'edit';
  tree?: FamilyTree | null;
  loading?: boolean;
  onDismiss: () => void;
  onSubmit: (name: string) => void | Promise<void>;
  onDelete?: (() => void | Promise<void>) | null;
}

export default function TreeFormDialog({
  visible,
  mode,
  tree,
  loading = false,
  onDismiss,
  onSubmit,
  onDelete,
}: TreeFormDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();
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
      setError(t('Tree name is required.'));
      return;
    }

    await onSubmit(trimmedName);
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loading ? undefined : onDismiss}
        style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{mode === 'create' ? t('Create family tree') : t('Edit family tree')}</Dialog.Title>
        <IconButton icon="close" onPress={onDismiss} disabled={loading} accessibilityLabel={t('Cancel')} style={dialogChrome.closeButton} />
        <Dialog.Content style={dialogChrome.content}>
          <TextInput
            mode="outlined"
            label={t('Tree name')}
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
        <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          {mode === 'edit' && onDelete ? (
            <Button mode="text" textColor={theme.colors.error} onPress={onDelete} disabled={loading}>
              {t('Delete tree')}
            </Button>
          ) : null}
          <Button mode="contained" onPress={handleSubmit} disabled={loading}>
            {mode === 'create' ? t('Create') : t('Save')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
