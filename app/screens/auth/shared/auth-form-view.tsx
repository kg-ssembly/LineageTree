import React from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  ActivityIndicator,
  Button,
  Chip,
  HelperText,
  Menu,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { Reveal, ScreenBackground, SectionCard, SharedLoader } from '../../../../components';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME } from '../../../../constants/styles';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, width: '100%', maxWidth: 608, alignSelf: 'center' },
  heroWrap: {
    marginBottom: 28,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  logoBadge: {
    width: 92,
    height: 92,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#35432B',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  logo: { width: 78, height: 78 },
  heroTitle: {
    marginTop: 14,
    fontWeight: '700',
  },
  heroSubtitle: {
    marginTop: 8,
    lineHeight: 24,
  },
  card: {
    borderRadius: 28,
    padding: 24,
    shadowColor: '#35432B',
    shadowOpacity: 0.04,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  title: { marginBottom: 4, fontWeight: '700' },
  subtitle: { marginBottom: 20 },
  input: { marginTop: 8 },
  button: { marginTop: 24, ...BUTTON_CHROME },
  googleButton: { backgroundColor: '#FFFFFF' },
  buttonContent: BUTTON_CONTENT_CHROME,
  linkButton: { marginTop: 12, alignSelf: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24 },
  divider: { flex: 1, height: 1 },
  recaptchaAnchor: { height: 1, width: 1, opacity: 0, position: 'absolute' as const },
  passwordSectionLabel: { marginTop: 20, marginBottom: 4, fontWeight: '700' },
  passwordRevealButton: { marginTop: 12, alignSelf: 'flex-start' },
});

const APP_LOGO = require('../../../../assets/logo-transparent.png');

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityLabel="Google">
      <Path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z" />
      <Path fill="#34A853" d="M12 21.96c2.59 0 4.76-.86 6.35-2.33l-3.14-2.45c-.87.58-1.98.92-3.21.92-2.47 0-4.56-1.67-5.31-3.91H3.44v2.53A9.6 9.6 0 0 0 12 21.96Z" />
      <Path fill="#FBBC05" d="M6.69 14.19A5.78 5.78 0 0 1 6.38 12c0-.76.13-1.5.31-2.19V7.28H3.44A9.98 9.98 0 0 0 2.4 12c0 1.61.39 3.14 1.04 4.72l3.25-2.53Z" />
      <Path fill="#EA4335" d="M12 5.9c1.41 0 2.68.49 3.68 1.45l2.76-2.76C16.75 3 14.59 2.04 12 2.04a9.6 9.6 0 0 0-8.56 5.24l3.25 2.53C6.44 7.57 8.53 5.9 12 5.9Z" />
    </Svg>
  );
}

export type AuthFieldConfig = {
  key: string;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  helperText?: string | null;
  helperTextType?: 'error' | 'info';
  secureTextEntry?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  textContentType?: React.ComponentProps<typeof TextInput>['textContentType'];
  importantForAutofill?: React.ComponentProps<typeof TextInput>['importantForAutofill'];
  autoCorrect?: boolean;
  spellCheck?: boolean;
  passwordRules?: string;
  right?: React.ReactNode;
};

type AuthFormViewProps = {
  variant: 'login' | 'signUp';
  chipIcon: string;
  chipLabel: string;
  title: string;
  heroTitle: string;
  heroSubtitle: string;
  subtitle: string;
  submitLabel: string;
  submitLoading: boolean;
  fields: AuthFieldConfig[];
  onSubmit: () => void;
  secondaryActionLabel: string;
  onSecondaryAction: () => void;
  snackbarVisible: boolean;
  snackbarMessage: string | null;
  onDismissSnackbar: () => void;
  dismissLabel: string;
  tertiaryActionLabel?: string;
  onTertiaryAction?: () => void;
  inlineNoticeMessage?: string | null;
  googleActionLabel?: string;
  onGoogleAction?: () => void;
  magicLinkActionLabel?: string;
  onMagicLinkAction?: () => void;
  phoneActionLabel?: string;
  onPhoneAction?: () => void;
  phoneCodeSent?: boolean;
  phoneFields?: AuthFieldConfig[];
  onPhoneCodeAction?: () => void;
  phoneCodeActionLabel?: string;
  activeAuthMethod?: 'magic' | 'phone' | 'password' | null;
  phoneCountry?: { label: string; dialCode: string };
  phoneCountries?: Array<{ label: string; dialCode: string }>;
  onPhoneCountryChange?: (country: { label: string; dialCode: string }) => void;
  backActionLabel?: string;
  onBackAction?: () => void;
  passwordSectionLabel?: string;
  showPasswordForm?: boolean;
  onShowPasswordForm?: () => void;
  magicLinkSent?: boolean;
};

export function AuthFormView({
  variant,
  chipIcon,
  chipLabel,
  title,
  heroTitle,
  heroSubtitle,
  subtitle,
  submitLabel,
  submitLoading,
  fields,
  onSubmit,
  secondaryActionLabel,
  onSecondaryAction,
  snackbarVisible,
  snackbarMessage,
  onDismissSnackbar,
  dismissLabel,
  tertiaryActionLabel,
  onTertiaryAction,
  inlineNoticeMessage,
  googleActionLabel,
  onGoogleAction,
  magicLinkActionLabel,
  onMagicLinkAction,
  phoneActionLabel,
  onPhoneAction,
  phoneCodeSent = false,
  phoneFields = [],
  onPhoneCodeAction,
  phoneCodeActionLabel,
  activeAuthMethod = null,
  phoneCountry,
  phoneCountries = [],
  onPhoneCountryChange,
  backActionLabel,
  onBackAction,
  passwordSectionLabel,
  showPasswordForm = true,
  onShowPasswordForm,
  magicLinkSent = false,
}: AuthFormViewProps) {
  const theme = useTheme();
  const chipColor = variant === 'login'
    ? theme.colors.secondaryContainer
    : theme.colors.tertiaryContainer;
  const hasAlternativeSignIn = Boolean(googleActionLabel && onGoogleAction) || Boolean(magicLinkActionLabel && onMagicLinkAction) || Boolean(phoneActionLabel && onPhoneAction);
  const [countryMenuVisible, setCountryMenuVisible] = React.useState(false);
  const renderField = (field: AuthFieldConfig) => (
    <React.Fragment key={field.key}>
      <TextInput
        label={field.label}
        accessibilityLabel={field.label}
        value={field.value}
        onChangeText={field.onChangeText}
        mode="outlined"
        outlineStyle={{ borderRadius: 16 }}
        outlineColor={theme.colors.outlineVariant}
        keyboardType={field.keyboardType}
        secureTextEntry={field.secureTextEntry}
        autoCapitalize={field.autoCapitalize}
        autoComplete={field.autoComplete}
        textContentType={field.textContentType}
        importantForAutofill={field.importantForAutofill}
        autoCorrect={field.autoCorrect}
        spellCheck={field.spellCheck}
        passwordRules={field.passwordRules}
        style={styles.input}
        error={!!field.error}
        right={field.right}
      />
      <HelperText type={field.helperTextType ?? 'error'} visible={Boolean(field.helperText ?? field.error)}>
        {field.helperText ?? field.error ?? ' '}
      </HelperText>
    </React.Fragment>
  );
  const alternativeActions = hasAlternativeSignIn && activeAuthMethod === null ? (
    <>
      {googleActionLabel && onGoogleAction ? (
        <Button
          mode="outlined"
          icon={() => <GoogleMark />}
          onPress={onGoogleAction}
          disabled={submitLoading}
          contentStyle={styles.buttonContent}
          style={[styles.button, styles.googleButton]}
        >
          {googleActionLabel}
        </Button>
      ) : null}

      {magicLinkActionLabel && onMagicLinkAction ? (
        <Button
          mode="contained"
          icon="email-fast-outline"
          onPress={onMagicLinkAction}
          disabled={submitLoading}
          contentStyle={styles.buttonContent}
          style={styles.button}
        >
          {magicLinkActionLabel}
        </Button>
      ) : null}

      {phoneActionLabel && onPhoneAction ? (
        <Button
          mode="outlined"
          icon="cellphone"
          onPress={onPhoneAction}
          disabled={submitLoading}
          contentStyle={styles.buttonContent}
          style={styles.button}
        >
          {phoneActionLabel}
        </Button>
      ) : null}
    </>
  ) : null;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.heroWrap}>
          <View style={styles.logoRow}>
            <View style={[styles.logoBadge, { backgroundColor: theme.colors.secondaryContainer }]}>
              <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Lineage Tree logo" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleLarge" style={{ color: theme.colors.primary, fontWeight: '800' }}>Lineage Tree - Your family story</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>Connected across generations.</Text>
            </View>
          </View>
        </View>

        <Reveal delay={70}>
          <SectionCard
            style={[styles.card, {
              borderColor: theme.colors.outlineVariant,
              borderWidth: 1,
            }]}
            elevation={2}
          >
            <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
            <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
              {subtitle}
            </Text>

            {activeAuthMethod === 'magic' ? fields.filter((field) => field.key === 'email').map(renderField) : null}
            {activeAuthMethod === 'phone' ? (
              <>
                {phoneCountry && onPhoneCountryChange ? (
                  <Menu
                    visible={countryMenuVisible}
                    onDismiss={() => setCountryMenuVisible(false)}
                    anchor={<Button mode="outlined" icon="earth" onPress={() => setCountryMenuVisible(true)} style={styles.input} contentStyle={styles.buttonContent}>{`${phoneCountry.label} (${phoneCountry.dialCode})`}</Button>}
                  >
                    {phoneCountries.map((country) => <Menu.Item key={`${country.label}-${country.dialCode}`} title={`${country.label} (${country.dialCode})`} onPress={() => { setCountryMenuVisible(false); onPhoneCountryChange(country); }} />)}
                  </Menu>
                ) : null}
                {phoneFields.filter((field) => field.key === 'phone' || (phoneCodeSent && field.key === 'phone-code')).map(renderField)}
              </>
            ) : null}
            {activeAuthMethod === 'magic' && onMagicLinkAction && magicLinkActionLabel ? (
              <Button mode="contained" icon="email-fast-outline" onPress={onMagicLinkAction} disabled={submitLoading} contentStyle={styles.buttonContent} style={styles.button}>
                {submitLoading ? <ActivityIndicator color={theme.colors.onPrimary} size="small" /> : magicLinkActionLabel}
              </Button>
            ) : null}
            {activeAuthMethod === null ? (
              <>
                {alternativeActions}
                <View style={styles.dividerRow}>
                  <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>or</Text>
                  <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} />
                </View>
                {showPasswordForm ? (
                  <Text variant="titleMedium" style={[styles.passwordSectionLabel, { color: theme.colors.onSurface }]}>
                    {passwordSectionLabel}
                  </Text>
                ) : onShowPasswordForm ? (
                  <Button mode="text" onPress={onShowPasswordForm} style={styles.passwordRevealButton}>
                    {passwordSectionLabel}
                  </Button>
                ) : null}
              </>
            ) : null}

          {fields.map((field) => (
            (!hasAlternativeSignIn || activeAuthMethod === 'password') ? renderField(field) : null
          ))}

          {activeAuthMethod === 'phone' && onPhoneCodeAction && phoneCodeActionLabel ? (
            <Button mode="contained" onPress={onPhoneCodeAction} disabled={submitLoading} contentStyle={styles.buttonContent} style={styles.button}>
              {submitLoading ? <ActivityIndicator color={theme.colors.onPrimary} size="small" /> : phoneCodeActionLabel}
            </Button>
          ) : null}

            {(!hasAlternativeSignIn || activeAuthMethod === 'password') && (
              <Button
                mode="contained"
                onPress={onSubmit}
                disabled={submitLoading}
                contentStyle={styles.buttonContent}
                style={styles.button}
              >
                {submitLoading
                  ? <ActivityIndicator color={theme.colors.onPrimary} size="small" />
                  : submitLabel}
              </Button>
            )}

            {tertiaryActionLabel && onTertiaryAction && (!hasAlternativeSignIn || activeAuthMethod === 'password') ? (
              <Button mode="text" onPress={onTertiaryAction} style={styles.linkButton}>
                {tertiaryActionLabel}
              </Button>
            ) : null}

            <HelperText type="info" visible={Boolean(inlineNoticeMessage)}>
              {inlineNoticeMessage ?? ' '}
            </HelperText>

            {(!hasAlternativeSignIn || activeAuthMethod === 'password') ? <Button mode="text" onPress={onSecondaryAction} style={styles.linkButton}>
              {secondaryActionLabel}
            </Button> : null}

            {activeAuthMethod && backActionLabel && onBackAction ? (
                <Button mode="text" icon="arrow-left" onPress={onBackAction} style={styles.linkButton}>
                  {backActionLabel}
                </Button>
            ) : null}
          </SectionCard>
        </Reveal>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={onDismissSnackbar}
        duration={4000}
        action={{ label: dismissLabel, onPress: onDismissSnackbar }}
      >
        {snackbarMessage}
      </Snackbar>

      <SharedLoader visible={submitLoading} />
      {activeAuthMethod === 'phone' ? <Pressable nativeID="phone-recaptcha-anchor" accessibilityRole="button" style={styles.recaptchaAnchor} onPress={() => undefined} /> : null}
    </KeyboardAvoidingView>
  );
}
