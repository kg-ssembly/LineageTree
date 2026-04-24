import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  HelperText,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  return null;
}
function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return null;
}
function validateDisplayName(name: string): string | null {
  if (!name.trim()) return 'Name is required.';
  if (name.trim().length < 2) return 'Name must be at least 2 characters.';
  return null;
}

export default function SignUpScreen({ navigation }: any) {
  const theme = useTheme();
  const { signUp, loading, error, clearError } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [snackVisible, setSnackVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    displayName: null as string | null,
    email: null as string | null,
    password: null as string | null,
  });

  React.useEffect(() => {
    if (error) setSnackVisible(true);
  }, [error]);

  const handleSignUp = async () => {
    const errors = {
      displayName: validateDisplayName(displayName),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    try {
      await signUp(email.trim(), password, displayName.trim());
    } catch {
      // error surfaced via store → snackbar
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.heroWrap}>
          <Chip icon="sprout" style={{ backgroundColor: theme.colors.tertiaryContainer }}>
            Start your first branch
          </Chip>
          <Text variant="displaySmall" style={[styles.heroTitle, { color: theme.colors.onSurface }]}>
            Create your account
          </Text>
          <Text variant="bodyLarge" style={[styles.heroSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Capture generations, memories, and milestones in a more beautiful family workspace.
          </Text>
        </View>

        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            Sign up
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Set up your space in less than a minute.
          </Text>

          <TextInput
            label="Full name"
            value={displayName}
            onChangeText={(v) => { setDisplayName(v); setFieldErrors((e) => ({ ...e, displayName: null })); }}
            mode="outlined"
            autoCapitalize="words"
            textContentType="name"
            style={styles.input}
            error={!!fieldErrors.displayName}
          />
          <HelperText type="error" visible={!!fieldErrors.displayName}>{fieldErrors.displayName}</HelperText>

          <TextInput
            label="Email"
            value={email}
            onChangeText={(v) => { setEmail(v); setFieldErrors((e) => ({ ...e, email: null })); }}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            style={styles.input}
            error={!!fieldErrors.email}
          />
          <HelperText type="error" visible={!!fieldErrors.email}>{fieldErrors.email}</HelperText>

          <TextInput
            label="Password"
            value={password}
            onChangeText={(v) => { setPassword(v); setFieldErrors((e) => ({ ...e, password: null })); }}
            mode="outlined"
            secureTextEntry={!passwordVisible}
            autoComplete="new-password"
            textContentType="newPassword"
            style={styles.input}
            error={!!fieldErrors.password}
            right={
              <TextInput.Icon
                icon={passwordVisible ? 'eye-off' : 'eye'}
                onPress={() => setPasswordVisible((v) => !v)}
              />
            }
          />
          <HelperText type="error" visible={!!fieldErrors.password}>{fieldErrors.password}</HelperText>

          <Button
            mode="contained"
            onPress={handleSignUp}
            disabled={loading}
            contentStyle={styles.buttonContent}
            style={styles.button}
          >
            {loading
              ? <ActivityIndicator color={theme.colors.onPrimary} size="small" />
              : 'Create account'}
          </Button>

          <Button mode="text" onPress={() => navigation.navigate('Login')} style={styles.linkButton}>
            Already have an account? Sign in
          </Button>
        </Surface>
      </ScrollView>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => { setSnackVisible(false); clearError(); }}
        duration={4000}
        action={{ label: 'Dismiss', onPress: () => { setSnackVisible(false); clearError(); } }}
      >
        {error}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  heroWrap: {
    marginBottom: 20,
  },
  heroTitle: {
    marginTop: 14,
    fontWeight: '800',
  },
  heroSubtitle: {
    marginTop: 8,
    lineHeight: 24,
  },
  card: {
    borderRadius: 28,
    padding: 24,
  },
  title: { marginBottom: 4, fontWeight: '700' },
  subtitle: { marginBottom: 20 },
  input: { marginTop: 4 },
  button: { marginTop: 24, borderRadius: 14 },
  buttonContent: { height: 52 },
  linkButton: { marginTop: 10 },
});
