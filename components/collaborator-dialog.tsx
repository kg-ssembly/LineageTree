import React, { useEffect, useState } from 'react';
import { Button, Dialog, HelperText, IconButton, Portal, SegmentedButtons, TextInput, useTheme } from 'react-native-paper';
import type { CollaboratorRole } from './dto/tree';
import { useI18n } from '../hooks/use-i18n';
import { I18N_KEYS as K } from '../i18n/keys';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.collaboratorDialog;
const dialogChrome = GlobalStyles.dialogChrome;

interface CollaboratorDialogProps {
  visible: boolean;
  loading?: boolean;
  onDismiss: () => void;
  onSubmit: (payload: { email: string; role: CollaboratorRole }) => void | Promise<void>;
}

export default function CollaboratorDialog({
  visible,
  loading = false,
  onDismiss,
  onSubmit,
}: CollaboratorDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('viewer');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setEmail('');
    setRole('viewer');
    setError(null);
  }, [visible]);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t(K.treeSettings.collaboratorEmailRequired));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t(K.auth.enterValidEmail));
      return;
    }

    await onSubmit({ email: trimmedEmail, role });
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loading ? undefined : onDismiss}
        style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(K.treeSettings.addCollaborator)}</Dialog.Title>
        <IconButton icon="close" onPress={onDismiss} disabled={loading} accessibilityLabel={t(K.common.cancel)} style={dialogChrome.closeButton} />
        <Dialog.Content style={dialogChrome.content}>
          <TextInput
            mode="outlined"
            label={t(K.treeSettings.collaboratorEmail)}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (error) {
                setError(null);
              }
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            disabled={loading}
            error={!!error}
          />
          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>

          <SegmentedButtons
            value={role}
            onValueChange={(value) => setRole(value as CollaboratorRole)}
            style={styles.roleButtons}
            buttons={[
              { value: 'viewer', label: t(K.treeSettings.viewer) },
              { value: 'contributor', label: t(K.treeSettings.contributor) },
              { value: 'editor', label: t(K.treeSettings.editor) },
            ]}
          />
        </Dialog.Content>
        <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button mode="contained" onPress={handleSubmit} disabled={loading}>{t(K.treeSettings.invite)}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
