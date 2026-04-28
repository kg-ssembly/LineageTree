import React from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.confirmDialog;

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
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={loading ? undefined : onDismiss} style={styles.dialog}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button onPress={onConfirm} disabled={loading}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}


