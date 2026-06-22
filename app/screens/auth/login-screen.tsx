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
  return null;
}

const styles = GlobalStyles.login;

export default function LoginScreen({ navigation }: any) {
  const theme = useTheme();
  const { t } = useI18n();
  const { signIn, loading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [snackVisible, setSnackVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    email: null as string | null,
    password: null as string | null,
  });

  React.useEffect(() => {
    if (error) setSnackVisible(true);
  }, [error]);

  const handleSignIn = async () => {
    const errors = {
      email: validateEmail(email, t),
      password: validatePassword(password, t),
    };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    try {
      await signIn(email.trim(), password);
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
          <Chip icon="account-heart" style={{ backgroundColor: theme.colors.secondaryContainer }}>
            {t('Welcome back')}
          </Chip>
          <Text variant="displaySmall" style={[styles.heroTitle, { color: theme.colors.onSurface }]}>
            Lineage Tree
          </Text>
          <Text variant="bodyLarge" style={[styles.heroSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {t('Return to your family stories, people profiles, and memories.')}
          </Text>
        </View>

        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            {t('Sign in')}
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            {t('Pick up where you left off.')}
          </Text>

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
            autoComplete="current-password"
            textContentType="password"
            importantForAutofill="yes"
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
            onPress={handleSignIn}
            disabled={loading}
            contentStyle={styles.buttonContent}
            style={styles.button}
          >
            {loading
              ? <ActivityIndicator color={theme.colors.onPrimary} size="small" />
              : t('Sign in')}
          </Button>

          <Button mode="text" onPress={() => navigation.navigate('SignUp')} style={styles.linkButton}>
            {t("Don't have an account? Sign up")}
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
