import React, { useEffect, useMemo, useState } from 'react';
import { TextInput } from 'react-native-paper';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import { useAuthStore } from '../../../../stores/auth-store';
import { type AuthFieldConfig } from '../shared/auth-form-view';
import { validateDisplayName, validateEmail, validateSignUpPassword } from '../shared/auth-validation';

type SignUpNavigation = {
  navigate: (name: string) => void;
};

export function useSignUpScreenController(navigation: SignUpNavigation) {
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

  useEffect(() => {
    if (error) {
      setSnackVisible(true);
    }
  }, [error]);

  const dismissSnackbar = () => {
    setSnackVisible(false);
    clearError();
  };

  const handleSignUp = async () => {
    const errors = {
      displayName: validateDisplayName(displayName, t),
      email: validateEmail(email, t),
      password: validateSignUpPassword(password, t),
    };

    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      return;
    }

    try {
      await signUp(email.trim(), password, displayName.trim());
    } catch {
      // surfaced via store snackbar
    }
  };

  const fields = useMemo<AuthFieldConfig[]>(() => [
    {
      key: 'displayName',
      label: t(K.common.fullName),
      value: displayName,
      onChangeText: (value) => {
        setDisplayName(value);
        setFieldErrors((current) => ({ ...current, displayName: null }));
      },
      error: fieldErrors.displayName,
      autoCapitalize: 'words',
      textContentType: 'name',
    },
    {
      key: 'email',
      label: t(K.common.email),
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
      label: t(K.common.password),
      value: password,
      onChangeText: (value) => {
        setPassword(value);
        setFieldErrors((current) => ({ ...current, password: null }));
      },
      error: fieldErrors.password,
      helperText: fieldErrors.password ?? t(K.auth.useEightPlusCharacters),
      helperTextType: fieldErrors.password ? 'error' : 'info',
      secureTextEntry: !passwordVisible,
      autoCapitalize: 'none',
      autoCorrect: false,
      spellCheck: false,
      autoComplete: 'new-password',
      textContentType: 'newPassword',
      importantForAutofill: 'yes',
      passwordRules: 'minlength: 8; required: lower; required: upper; required: digit;',
      right: (
        <TextInput.Icon
          icon={passwordVisible ? 'eye-off' : 'eye'}
          onPress={() => setPasswordVisible((current) => !current)}
        />
      ),
    },
  ], [displayName, email, fieldErrors.displayName, fieldErrors.email, fieldErrors.password, password, passwordVisible, t]);

  return {
    chipIcon: 'sprout',
    chipLabel: t(K.auth.startYourFirstBranch),
    title: t(K.auth.signUp),
    heroTitle: t(K.auth.createYourAccount),
    heroSubtitle: t(K.auth.captureGenerations),
    subtitle: t(K.auth.setUpYourSpace),
    submitLabel: t(K.auth.createAccount),
    secondaryActionLabel: t(K.auth.alreadyHaveAccountSignIn),
    submitLoading: loading,
    fields,
    snackbarVisible: snackVisible,
    snackbarMessage: error,
    onDismissSnackbar: dismissSnackbar,
    dismissLabel: t(K.common.dismiss),
    onSubmit: handleSignUp,
    onSecondaryAction: () => navigation.navigate('Login'),
  };
}
