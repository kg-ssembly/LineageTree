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

const PHONE_COUNTRIES = [
  { label: 'South Africa', dialCode: '+27' },
  { label: 'United States', dialCode: '+1' },
  { label: 'United Kingdom', dialCode: '+44' },
  { label: 'Australia', dialCode: '+61' },
  { label: 'Botswana', dialCode: '+267' },
  { label: 'Eswatini', dialCode: '+268' },
  { label: 'Lesotho', dialCode: '+266' },
  { label: 'Namibia', dialCode: '+264' },
  { label: 'Nigeria', dialCode: '+234' },
  { label: 'Zimbabwe', dialCode: '+263' },
  { label: 'India', dialCode: '+91' },
  { label: 'Canada', dialCode: '+1' },
  { label: 'New Zealand', dialCode: '+64' },
];

function normalizePhoneNumber(input: string, dialCode: string) {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  const countryDigits = dialCode.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    return `+${digits}`;
  }

  // Also accept the common international format beginning with 00.
  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`;
  }

  // Do not add the selected country twice when the user enters 27... rather than +27....
  if (digits.startsWith(countryDigits)) {
    return `+${digits}`;
  }

  // Convert a local leading zero to the selected country's international format.
  if (digits.startsWith('0')) {
    return `${dialCode}${digits.slice(1)}`;
  }

  return `${dialCode}${digits}`;
}

export function useLoginScreenController(navigation: LoginNavigation) {
  const { t } = useI18n();
  const { signIn, requestPasswordReset, sendMagicLink, completeMagicLink, signInWithGoogle, sendPhoneCode, verifyPhoneCode, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [inlineNoticeMessage, setInlineNoticeMessage] = useState<string | null>(null);
  const [emailLinkPending, setEmailLinkPending] = useState(false);
  const [activeAuthMethod, setActiveAuthMethod] = useState<'magic' | 'phone' | 'password' | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState(PHONE_COUNTRIES[0]);
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
    if (activeAuthMethod !== 'magic') {
      setActiveAuthMethod('magic');
      setShowPhoneForm(false);
      setInlineNoticeMessage(null);
      return;
    }
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

  const handlePhoneAction = async () => {
    if (activeAuthMethod !== 'phone') {
      setActiveAuthMethod('phone');
      setShowPhoneForm(true);
      setInlineNoticeMessage(null);
      return;
    }
    try {
      if (phoneCodeSent) {
        await verifyPhoneCode(phoneCode);
      } else {
        await sendPhoneCode(normalizePhoneNumber(phone, phoneCountry.dialCode));
        setPhoneCodeSent(true);
      }
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

  const phoneFields = useMemo<AuthFieldConfig[]>(() => [
    { key: 'phone', label: 'Mobile number', value: phone, onChangeText: setPhone, keyboardType: 'phone-pad', autoCapitalize: 'none', autoComplete: 'tel', textContentType: 'telephoneNumber' },
    { key: 'phone-code', label: 'SMS verification code', value: phoneCode, onChangeText: setPhoneCode, keyboardType: 'number-pad', autoCapitalize: 'none', autoComplete: 'one-time-code', textContentType: 'oneTimeCode' },
  ], [phone, phoneCode]);

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
    activeAuthMethod,
    backActionLabel: activeAuthMethod ? 'Back to login options' : undefined,
    onBackAction: activeAuthMethod ? () => {
      setActiveAuthMethod(null);
      setShowPhoneForm(false);
      setPhoneCodeSent(false);
      setPhoneCode('');
      setInlineNoticeMessage(null);
    } : undefined,
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
    phoneActionLabel: Platform.OS === 'web' ? 'Sign in with phone' : undefined,
    onPhoneAction: Platform.OS === 'web' ? handlePhoneAction : undefined,
    phoneFields: Platform.OS === 'web' && showPhoneForm ? phoneFields : undefined,
    phoneCountry: Platform.OS === 'web' && showPhoneForm ? phoneCountry : undefined,
    phoneCountries: PHONE_COUNTRIES,
    onPhoneCountryChange: (country: { label: string; dialCode: string }) => { setPhoneCountry(country); setShowPhoneForm(true); },
    phoneCodeSent,
    onPhoneCodeAction: Platform.OS === 'web' && showPhoneForm ? handlePhoneAction : undefined,
    phoneCodeActionLabel: phoneCodeSent ? 'Verify code' : 'Send code',
    magicLinkActionLabel: Platform.OS === 'web'
      ? t(emailLinkPending ? K.auth.completeSignInLink : K.auth.sendSignInLink)
      : undefined,
    onMagicLinkAction: Platform.OS === 'web' ? handleMagicLink : undefined,
    passwordSectionLabel: Platform.OS === 'web' ? t(K.auth.useEmailPassword) : undefined,
    showPasswordForm: Platform.OS !== 'web' || activeAuthMethod === 'password',
    onShowPasswordForm: Platform.OS === 'web' ? () => {
      setActiveAuthMethod('password');
      setShowPhoneForm(false);
      setMagicLinkSent(false);
      setInlineNoticeMessage(null);
    } : undefined,
    magicLinkSent,
    inlineNoticeMessage,
    onSecondaryAction: () => navigation.navigate('SignUp'),
  };
}
