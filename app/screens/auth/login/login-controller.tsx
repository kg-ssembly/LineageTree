import React, { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { isSignInWithEmailLink } from 'firebase/auth';
import { TextInput } from 'react-native-paper';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import { useAuthStore } from '../../../../stores/auth-store';
import { type AuthFieldConfig } from '../shared/auth-form-view';
import { validateEmail, validateLoginPassword } from '../shared/auth-validation';
import { auth } from '../../../../providers/firebase-provider';

type LoginNavigation = {
  navigate: (name: string) => void;
};

const initialWebUrl = typeof window !== 'undefined' ? window.location.href : null;

export function useLoginScreenController(navigation: LoginNavigation) {
  const { t } = useI18n();
  const { signIn, requestPasswordReset, sendMagicLink, completeMagicLink, signInWithGoogle, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [inlineNoticeMessage, setInlineNoticeMessage] = useState<string | null>(null);
  const [emailLinkPending, setEmailLinkPending] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [detectedEmailLink, setDetectedEmailLink] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState({
    email: null as string | null,
    password: null as string | null,
  });

  useEffect(() => {
    if (error) {
      setSnackbarMessage(error);
      setSnackVisible(true);
    }
  }, [error]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const emailLink = [window.location.href, initialWebUrl]
      .find((candidate): candidate is string => Boolean(candidate && isSignInWithEmailLink(auth, candidate)));
    if (!emailLink) return;
    const savedEmail = window.localStorage.getItem('lineagetree.emailForSignIn');
    setDetectedEmailLink(emailLink);
    setEmailLinkPending(true);
    if (savedEmail) {
      setEmail(savedEmail);
      void completeMagicLink(savedEmail, emailLink).catch(() => {});
    } else {
      setInlineNoticeMessage(t(K.auth.signInLinkDetected));
    }
  }, [completeMagicLink, t]);

  const dismissSnackbar = () => {
    setSnackVisible(false);
    setSnackbarMessage(null);
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

  const handleForgotPassword = async () => {
    const emailError = validateEmail(email, t);
    setFieldErrors((current) => ({ ...current, email: emailError }));
    if (emailError) {
      return;
    }

    try {
      await requestPasswordReset(email.trim());
      const nextMessage = t('If an account exists for this email, password reset instructions will be sent.');
      setInlineNoticeMessage(nextMessage);
      setSnackbarMessage(nextMessage);
      setSnackVisible(true);
    } catch {
      // surfaced via store snackbar
    }
  };

  const handleMagicLink = async () => {
    const emailError = validateEmail(email, t);
    setFieldErrors((current) => ({ ...current, email: emailError }));
    if (emailError) return;
    try {
      if (emailLinkPending) {
        await completeMagicLink(email.trim(), detectedEmailLink ?? undefined);
      } else {
        await sendMagicLink(email.trim());
        setMagicLinkSent(true);
        setInlineNoticeMessage(t(K.auth.emailLinkSent));
      }
    } catch {
      // surfaced via store snackbar
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch {
      // surfaced via store snackbar
    }
  };

  const fields = useMemo<AuthFieldConfig[]>(() => [
    {
      key: 'email',
      label: t(K.common.email),
      value: email,
      onChangeText: (value) => {
        setEmail(value);
        setInlineNoticeMessage(null);
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
        setInlineNoticeMessage(null);
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
          accessibilityLabel={t(passwordVisible ? 'Hide password' : 'Show password')}
          onPress={() => setPasswordVisible((current) => !current)}
        />
      ),
    },
  ], [email, fieldErrors.email, fieldErrors.password, password, passwordVisible, t]);

  return {
    chipIcon: 'account-heart',
    chipLabel: t(K.auth.welcomeBack),
    title: t(K.auth.signIn),
    heroTitle: 'Lineage Tree',
    heroSubtitle: t(K.auth.returnToStories),
    subtitle: t(K.auth.pickUpWhereYouLeftOff),
    submitLabel: t(K.auth.signIn),
    secondaryActionLabel: t(K.auth.dontHaveAccountSignUp),
    submitLoading: loading,
    fields,
    snackbarVisible: snackVisible,
    snackbarMessage,
    onDismissSnackbar: dismissSnackbar,
    dismissLabel: t(K.common.dismiss),
    onSubmit: handleSignIn,
    tertiaryActionLabel: t(K.auth.forgotPassword),
    onTertiaryAction: handleForgotPassword,
    googleActionLabel: Platform.OS === 'web' ? t(K.auth.continueWithGoogle) : undefined,
    onGoogleAction: Platform.OS === 'web' ? handleGoogleSignIn : undefined,
    magicLinkActionLabel: Platform.OS === 'web'
      ? t(emailLinkPending ? K.auth.completeSignInLink : K.auth.sendSignInLink)
      : undefined,
    onMagicLinkAction: Platform.OS === 'web' ? handleMagicLink : undefined,
    passwordSectionLabel: Platform.OS === 'web' ? t(K.auth.useEmailPassword) : undefined,
    showPasswordForm: Platform.OS !== 'web' || showPasswordForm,
    onShowPasswordForm: Platform.OS === 'web' ? () => {
      setShowPasswordForm(true);
      setMagicLinkSent(false);
      setInlineNoticeMessage(null);
    } : undefined,
    magicLinkSent,
    inlineNoticeMessage,
    onSecondaryAction: () => navigation.navigate('SignUp'),
  };
}
