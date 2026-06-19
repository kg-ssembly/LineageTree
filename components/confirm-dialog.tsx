import React from 'react';
import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.confirmDialog;
const dialogChrome = GlobalStyles.dialogChrome;

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onDismiss: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  onDismiss,
  onConfirm,
}: ConfirmDialogProps) {
  const theme = useTheme();
  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loading ? undefined : onDismiss}
        style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={dialogChrome.dialogTitle}>{title}</Dialog.Title>
        <Dialog.Content style={dialogChrome.content}>
          <Text variant="bodyMedium">{message}</Text>
        </Dialog.Content>
        <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button mode="outlined" onPress={onDismiss} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button mode="contained" onPress={onConfirm} disabled={loading}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}


