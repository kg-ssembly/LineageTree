import React, { useEffect, useMemo, useState } from 'react';
import { TextInput } from 'react-native-paper';
import { useI18n } from '../../../../hooks/use-i18n';
import { useAuthStore } from '../../../../stores/auth-store';
import { type AuthFieldConfig } from '../shared/auth-form-view';
import { validateEmail, validateLoginPassword } from '../shared/auth-validation';

type LoginNavigation = {
  navigate: (name: string) => void;
};

export function useLoginScreenController(navigation: LoginNavigation) {
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

  useEffect(() => {
    if (error) {
      setSnackVisible(true);
    }
  }, [error]);

  const dismissSnackbar = () => {
    setSnackVisible(false);
    clearError();
  };

  const handleSignIn = async () => {
    const errors = {
      email: validateEmail(email, t),
      password: validateLoginPassword(password, t),
    };

    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      return;
    }

    try {
      await signIn(email.trim(), password);
    } catch {
      // surfaced via store snackbar
    }
  };

  const fields = useMemo<AuthFieldConfig[]>(() => [
    {
      key: 'email',
      label: t('Email'),
      value: email,
      onChangeText: (value) => {
        setEmail(value);
        setFieldErrors((current) => ({ ...current, email: null }));
      },
      error: fieldErrors.email,
      keyboardType: 'email-address',
      autoCapitalize: 'none',
      autoComplete: 'email',
      textContentType: 'emailAddress',
    },
    {
      key: 'password',
      label: t('Password'),
      value: password,
      onChangeText: (value) => {
        setPassword(value);
        setFieldErrors((current) => ({ ...current, password: null }));
      },
      error: fieldErrors.password,
      secureTextEntry: !passwordVisible,
      autoCapitalize: 'none',
      autoCorrect: false,
      spellCheck: false,
      autoComplete: 'current-password',
      textContentType: 'password',
      importantForAutofill: 'yes',
      right: (
        <TextInput.Icon
          icon={passwordVisible ? 'eye-off' : 'eye'}
          onPress={() => setPasswordVisible((current) => !current)}
        />
      ),
    },
  ], [email, fieldErrors.email, fieldErrors.password, password, passwordVisible, t]);

  return {
    chipIcon: 'account-heart',
    chipLabel: t('Welcome back'),
    title: t('Sign in'),
    heroTitle: 'Lineage Tree',
    heroSubtitle: t('Return to your family stories, people profiles, and memories.'),
    subtitle: t('Pick up where you left off.'),
    submitLabel: t('Sign in'),
    secondaryActionLabel: t("Don't have an account? Sign up"),
    submitLoading: loading,
    fields,
    snackbarVisible: snackVisible,
    snackbarMessage: error,
    onDismissSnackbar: dismissSnackbar,
    dismissLabel: t('Dismiss'),
    onSubmit: handleSignIn,
    onSecondaryAction: () => navigation.navigate('SignUp'),
  };
}
