import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { GlobalStyles, Reveal, SectionCard } from '../../../../components';
import { useAuthStore } from '../../../../stores/auth-store';
import { useI18n } from '../../../../hooks/use-i18n';
import { assertRecentAuthentication } from '../../../../providers/account-security';
import { getFamilyMemberCardStyle } from '../../profile-shared/profile-card-shared';

type Action = 'google.com' | 'password' | 'phone' | `remove:${string}`;
const METHODS = [
  { id: 'google.com', label: 'Google', icon: 'google' },
  { id: 'password', label: 'Email sign-in', icon: 'email-outline' },
  { id: 'phone', label: 'Phone number', icon: 'phone-outline' },
] as const;

export function SignInMethodsSection() {
  const theme = useTheme();
  const { t } = useI18n();
  const auth = useAuthStore();
  const busy = auth.accountBusy;
  const user = auth.firebaseUser;
  const providers = user?.providerData ?? [];
  const [action, setAction] = useState<Action | null>(null);
  const [stage, setStage] = useState<'reauthenticate' | 'change'>('change');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const isWeb = Platform.OS === 'web';
  const connected = (id: string) => providers.some(provider => provider.providerId === id);

  const resetForm = () => {
    auth.cancelAccountPhoneCode();
    setAction(null); setCodeSent(false); setCode(''); setPhone('');
    setPassword(''); setPasswordConfirmation(''); setCurrentPassword(''); setEmail('');
  };

  useEffect(() => {
    setAction(null); setPassword(''); setPasswordConfirmation(''); setCurrentPassword('');
    setCode(''); setCodeSent(false); setPhone(''); setEmail('');
    return () => useAuthStore.getState().cancelAccountPhoneCode();
  }, [user?.uid]);

  const begin = async (next: Action) => {
    if (!user || busy) return;
    resetForm();
    auth.clearAccountFeedback();
    setEmail(user.email ?? '');
    setAction(next);
    setStage('reauthenticate');
    try {
      const token = await user.getIdTokenResult();
      assertRecentAuthentication(token.claims.auth_time);
      if (useAuthStore.getState().firebaseUser?.uid === user.uid) setStage('change');
    } catch { /* Let the user verify their existing method in the dialog. */ }
  };

  const verify = async (method: 'password' | 'google.com' | 'phone') => {
    try {
      if (method === 'password') await auth.reauthenticatePassword(currentPassword);
      else if (method === 'google.com') await auth.reauthenticateGoogle();
      else if (!codeSent) {
        const result = await auth.sendPhoneReauthCode();
        if (!result.automaticallyVerified) { setCodeSent(true); return; }
      }
      else await auth.verifyPhoneReauthCode(code);
      auth.cancelAccountPhoneCode();
      setCurrentPassword(''); setCode(''); setCodeSent(false); setStage('change');
    } catch { /* The store supplies the inline error. */ }
  };

  const submit = async () => {
    try {
      if (action === 'google.com') await auth.linkGoogle();
      else if (action === 'password') await auth.linkEmailPassword(email, password);
      else if (action === 'phone') {
        if (!codeSent) {
          const result = await auth.sendPhoneLinkCode(phone);
          if (!result.automaticallyVerified) { setCodeSent(true); return; }
          resetForm();
          return;
        }
        await auth.verifyPhoneLinkCode(code);
      } else if (action?.startsWith('remove:')) await auth.removeSignInMethod(action.slice(7));
      resetForm();
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/requires-recent-login') {
        auth.cancelAccountPhoneCode(); setCodeSent(false); setCode(''); setStage('reauthenticate');
      }
    }
  };

  const feedback = <>
    {auth.accountError ? <HelperText type="error" accessibilityLiveRegion="polite">{t(auth.accountError)}</HelperText> : null}
    {auth.accountNotice ? <HelperText type="info" accessibilityLiveRegion="polite">{t(auth.accountNotice)}</HelperText> : null}
  </>;
  const removeLabel = action?.startsWith('remove:') ? METHODS.find(method => method.id === action.slice(7))?.label ?? action.slice(7) : '';
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const disabled = busy || (action === 'password' && (!validEmail || password.length < 6 || password !== passwordConfirmation))
    || (action === 'phone' && (codeSent ? !/^\d{6}$/.test(code.trim()) : !phone.trim()));

  return <>
    <Reveal delay={140}>
      <SectionCard variant="tree" style={[getFamilyMemberCardStyle(theme), { marginBottom: 0 }]}>
        <Text variant="headlineSmall">{t('Sign-in methods')}</Text>
        <Text variant="bodySmall">{t('Connect more than one way to sign into this same profile.')}</Text>
        <Text variant="bodySmall">{t('Start from the profile whose family trees you want to keep using.')}</Text>
        <View style={{ gap: 16, marginTop: 16 }}>
          {METHODS.map(method => {
            const provider = providers.find(entry => entry.providerId === method.id);
            return <View key={method.id} style={{ gap: 4 }}>
              <Text variant="titleSmall">{t(method.label)}</Text>
              <Text variant="bodySmall">{provider ? (provider.email || provider.phoneNumber || t('Connected')) : t('Not connected')}</Text>
              {provider && method.id === 'password' ? <Button mode="outlined" disabled={busy} onPress={() => void begin('password')}>{t('Set or change password')}</Button> : null}
              {provider ? <Button icon="link-variant-off" mode="text" disabled={busy || new Set(providers.map(p => p.providerId)).size < 2}
                accessibilityLabel={`${t('Remove')} ${t(method.label)}`} onPress={() => void begin(`remove:${method.id}`)} style={{ alignSelf: 'flex-start' }}>{t('Remove')}</Button>
                : <Button icon={method.icon} mode="outlined" disabled={busy} onPress={() => void begin(method.id)}>{t('Connect')} {t(method.label)}</Button>}
            </View>;
          })}
        </View>
        {user?.email && !user.emailVerified ? <>
          <HelperText type="info">{t('Your email address has not been verified.')}</HelperText>
          <Button disabled={busy} onPress={() => void auth.verifyAccountEmail().catch(() => {})}>{t('Send verification email')}</Button>
        </> : null}
        <Button icon="refresh" disabled={busy} onPress={() => void auth.refreshSignInMethods().catch(() => {})}>{t('Refresh sign-in methods')}</Button>
        {!action ? feedback : null}
        {isWeb ? <View nativeID="account-phone-recaptcha" /> : null}
      </SectionCard>
    </Reveal>
    <Portal>
      <Dialog visible={action !== null} onDismiss={() => { if (!busy) resetForm(); }} dismissable={!busy}
        style={[GlobalStyles.dialogChrome.dialog, { maxWidth: 480, maxHeight: '85%', backgroundColor: theme.colors.surface }]}>
        <Dialog.Title>{t(stage === 'reauthenticate' ? 'Verify your identity' : removeLabel ? 'Remove sign-in method' : 'Connect sign-in method')}</Dialog.Title>
        <Dialog.ScrollArea style={GlobalStyles.dialogChrome.scrollArea}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingVertical: 16 }}>
            {stage === 'reauthenticate' ? <>
              <Text>{t('Verify a method already connected to this profile to continue.')}</Text>
              {connected('password') ? <>
                <TextInput label={t('Current password')} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" disabled={busy} mode="outlined" />
                <Button disabled={busy || !currentPassword} onPress={() => void verify('password')}>{t('Verify password')}</Button>
                <Text variant="bodySmall">{t('If you use an email sign-in link, sign out and sign in with a new link, then return here.')}</Text>
              </> : null}
              {connected('google.com') ? <Button icon="google" disabled={busy} onPress={() => void verify('google.com')}>{t('Verify with Google')}</Button> : null}
              {connected('phone') ? <>
                <Text>{user?.phoneNumber}</Text>
                {codeSent ? <TextInput label={t('Verification code')} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} disabled={busy} mode="outlined" /> : null}
                <Button disabled={busy || (codeSent && !/^\d{6}$/.test(code.trim()))} onPress={() => void verify('phone')}>{t(codeSent ? 'Verify code' : 'Send code')}</Button>
                {codeSent ? <Button disabled={busy} onPress={() => { auth.cancelAccountPhoneCode(); setCodeSent(false); setCode(''); }}>{t('Request a new code')}</Button> : null}
              </> : null}
            </> : removeLabel ? <>
              <Text>{t('Remove')} {t(removeLabel)}?</Text>
              <Text>{t('Use a remaining connected method next time. Signing in with a removed method can create a separate profile.')}</Text>
            </> : action === 'password' ? <>
              <TextInput label={t('Email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" editable={!user?.email && !busy} mode="outlined" />
              <TextInput label={t('New password')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" disabled={busy} mode="outlined" />
              <TextInput label={t('Confirm password')} value={passwordConfirmation} onChangeText={setPasswordConfirmation} secureTextEntry autoCapitalize="none" autoComplete="new-password" disabled={busy} mode="outlined" />
              {passwordConfirmation && password !== passwordConfirmation ? <HelperText type="error">{t('Passwords do not match.')}</HelperText> : null}
            </> : action === 'phone' ? <>
              <TextInput label={t('Phone number')} placeholder="+27821234567" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" disabled={busy || codeSent} mode="outlined" />
              <Text variant="bodySmall">{t('Include your country code, for example +27 for South Africa.')}</Text>
              {codeSent ? <>
                <TextInput label={t('Verification code')} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} disabled={busy} mode="outlined" />
                <Button disabled={busy} onPress={() => { auth.cancelAccountPhoneCode(); setCodeSent(false); setCode(''); }}>{t('Change number or request a new code')}</Button>
              </> : null}
            </> : <Text>{t('Choose the Google account you want to connect to this profile.')}</Text>}
            {feedback}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button disabled={busy} onPress={resetForm}>{t('Cancel')}</Button>
          {stage === 'change' ? <Button disabled={disabled} loading={busy} onPress={() => void submit()}>{t(removeLabel ? 'Remove' : action === 'phone' && !codeSent ? 'Send code' : 'Connect')}</Button> : null}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  </>;
}
