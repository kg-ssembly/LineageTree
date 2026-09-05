import React from 'react';
import { Button, Dialog, IconButton, Portal, Text, useTheme } from 'react-native-paper';
import { useI18n } from '../hooks/use-i18n';
import { I18N_KEYS as K } from '../i18n/keys';
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
  confirmLabel = K.common.confirm,
  cancelLabel = K.common.cancel,
  loading = false,
  onDismiss,
  onConfirm,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loading ? undefined : onDismiss}
        style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{title}</Dialog.Title>
        <IconButton icon="close" onPress={onDismiss} disabled={loading} accessibilityLabel={t(cancelLabel)} style={dialogChrome.closeButton} />
        <Dialog.Content style={dialogChrome.content}>
          <Text variant="bodyMedium">{message}</Text>
        </Dialog.Content>
        <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button onPress={onDismiss} disabled={loading}>{t(cancelLabel)}</Button>
          <Button mode="contained" onPress={onConfirm} disabled={loading} loading={loading}>
            {t(confirmLabel)}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
