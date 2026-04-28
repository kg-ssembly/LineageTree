import React, { useEffect, useState } from 'react';
import { Button, Dialog, HelperText, Portal, SegmentedButtons, TextInput } from 'react-native-paper';
import type { CollaboratorRole } from '../../components/dto/tree';
import { GlobalStyles } from '../styles/global-styles';

const styles = GlobalStyles.collaboratorDialog;

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
      setError('Collaborator email is required.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    await onSubmit({ email: trimmedEmail, role });
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={loading ? undefined : onDismiss} style={styles.dialog}>
        <Dialog.Title>Add collaborator</Dialog.Title>
        <Dialog.Content>
          <TextInput
            mode="outlined"
            label="Collaborator email"
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
              { value: 'viewer', label: 'Viewer' },
              { value: 'editor', label: 'Editor' },
            ]}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={loading}>Cancel</Button>
          <Button onPress={handleSubmit} disabled={loading}>Invite</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}


