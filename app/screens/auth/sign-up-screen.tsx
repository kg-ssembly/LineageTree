import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
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
import { useAuthStore } from '../../../stores/auth-store';
import { useI18n } from '../../../hooks/use-i18n';
import { GlobalStyles } from '../../../constants/styles';

function validateEmail(email: string, t: (message: string) => string): string | null {
  if (!email.trim()) return t('Email is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('Enter a valid email address.');
  return null;
}
function validatePassword(password: string, t: (message: string) => string): string | null {
  if (!password) return t('Password is required.');
  if (password.length < 8) return t('Use at least 8 characters.');
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return t('Use uppercase, lowercase, and a number.');
  }
  return null;
}
function validateDisplayName(name: string, t: (message: string) => string): string | null {
  if (!name.trim()) return t('Name is required.');
  if (name.trim().length < 2) return t('Name must be at least 2 characters.');
  return null;
}

const styles = GlobalStyles.signUp;

export default function SignUpScreen({ navigation }: any) {
  const theme = useTheme();
  const { t } = useI18n();
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
      displayName: validateDisplayName(displayName, t),
      email: validateEmail(email, t),
      password: validatePassword(password, t),
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
            {t('Start your first branch')}
          </Chip>
          <Text variant="displaySmall" style={[styles.heroTitle, { color: theme.colors.onSurface }]}>
            {t('Create your account')}
          </Text>
          <Text variant="bodyLarge" style={[styles.heroSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {t('Capture generations, memories, and milestones in a more beautiful family workspace.')}
          </Text>
        </View>

        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            {t('Sign up')}
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            {t('Set up your space in less than a minute.')}
          </Text>

          <TextInput
            label={t('Full name')}
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
            label={t('Email')}
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
            label={t('Password')}
            value={password}
            onChangeText={(v) => { setPassword(v); setFieldErrors((e) => ({ ...e, password: null })); }}
            mode="outlined"
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="new-password"
            textContentType="newPassword"
            importantForAutofill="yes"
            passwordRules="minlength: 8; required: lower; required: upper; required: digit;"
            style={styles.input}
            error={!!fieldErrors.password}
            right={
              <TextInput.Icon
                icon={passwordVisible ? 'eye-off' : 'eye'}
                onPress={() => setPasswordVisible((v) => !v)}
              />
            }
          />
          <HelperText type={fieldErrors.password ? 'error' : 'info'} visible>
            {fieldErrors.password ?? t('Use 8+ characters with uppercase, lowercase, and a number.')}
          </HelperText>

          <Button
            mode="contained"
            onPress={handleSignUp}
            disabled={loading}
            contentStyle={styles.buttonContent}
            style={styles.button}
          >
            {loading
              ? <ActivityIndicator color={theme.colors.onPrimary} size="small" />
              : t('Create account')}
          </Button>

          <Button mode="text" onPress={() => navigation.navigate('Login')} style={styles.linkButton}>
            {t('Already have an account? Sign in')}
          </Button>
        </Surface>
      </ScrollView>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => { setSnackVisible(false); clearError(); }}
        duration={4000}
        action={{ label: t('Dismiss'), onPress: () => { setSnackVisible(false); clearError(); } }}
      >
        {error}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}
