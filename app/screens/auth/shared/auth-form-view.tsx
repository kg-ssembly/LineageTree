import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  HelperText,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { Reveal, ScreenBackground, SectionCard, SharedLoader } from '../../../../components';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME } from '../../../../constants/styles';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  heroWrap: {
    marginBottom: 28,
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
    shadowColor: '#2A1C14',
    shadowOpacity: 0.12,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  title: { marginBottom: 4, fontWeight: '700' },
  subtitle: { marginBottom: 20 },
  input: { marginTop: 6 },
  button: { marginTop: 24, ...BUTTON_CHROME },
  buttonContent: BUTTON_CONTENT_CHROME,
  linkButton: { marginTop: 12, alignSelf: 'center' },
});

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
}: AuthFormViewProps) {
  const theme = useTheme();
  const chipColor = variant === 'login'
    ? theme.colors.secondaryContainer
    : theme.colors.tertiaryContainer;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenBackground />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.heroWrap}>
          <Chip icon={chipIcon} style={{ alignSelf: 'flex-start', backgroundColor: chipColor }}>
            {chipLabel}
          </Chip>
          <Text variant="displaySmall" style={[styles.heroTitle, { color: theme.colors.onSurface }]}>
            {heroTitle}
          </Text>
          <Text variant="bodyLarge" style={[styles.heroSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {heroSubtitle}
          </Text>
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

          {fields.map((field) => (
            <React.Fragment key={field.key}>
              <TextInput
                label={field.label}
                value={field.value}
                onChangeText={field.onChangeText}
                mode="outlined"
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
          ))}

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

            {tertiaryActionLabel && onTertiaryAction ? (
              <Button mode="text" onPress={onTertiaryAction} style={styles.linkButton}>
                {tertiaryActionLabel}
              </Button>
            ) : null}

            <HelperText type="info" visible={Boolean(inlineNoticeMessage)}>
              {inlineNoticeMessage ?? ' '}
            </HelperText>

            <Button mode="text" onPress={onSecondaryAction} style={styles.linkButton}>
              {secondaryActionLabel}
            </Button>
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
    </KeyboardAvoidingView>
  );
}
