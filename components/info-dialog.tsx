import type { ReactNode } from 'react';
import React from 'react';
import { Dialog, IconButton, Portal, Text, useTheme } from 'react-native-paper';
import { GlobalStyles } from '../constants/styles';
import { useI18n } from '../hooks/use-i18n';
import { I18N_KEYS as K } from '../i18n/keys';

const dialogChrome = GlobalStyles.dialogChrome;

type InfoDialogProps = {
  visible: boolean;
  title: string;
  message: ReactNode;
  onDismiss: () => void;
};

export default function InfoDialog({
  visible,
  title,
  message,
  onDismiss,
}: InfoDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[dialogChrome.helperDialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{title}</Dialog.Title>
        <IconButton
          icon="close"
          size={20}
          onPress={onDismiss}
          style={dialogChrome.closeButton}
          accessibilityLabel={t(K.common.close)}
        />
        <Dialog.Content style={dialogChrome.content}>
          {typeof message === 'string' ? (
            <Text variant="bodyMedium">{message}</Text>
          ) : (
            message
          )}
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}
