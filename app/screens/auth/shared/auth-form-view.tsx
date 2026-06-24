import React from 'react';
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
import { GlobalStyles } from '../../../../constants/styles';

const loginStyles = GlobalStyles.login;
const signUpStyles = GlobalStyles.signUp;

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
}: AuthFormViewProps) {
  const theme = useTheme();
  const styles = variant === 'login' ? loginStyles : signUpStyles;
  const chipColor = variant === 'login'
    ? theme.colors.secondaryContainer
    : theme.colors.tertiaryContainer;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.heroWrap}>
          <Chip icon={chipIcon} style={{ backgroundColor: chipColor }}>
            {chipLabel}
          </Chip>
          <Text variant="displaySmall" style={[styles.heroTitle, { color: theme.colors.onSurface }]}>
            {heroTitle}
          </Text>
          <Text variant="bodyLarge" style={[styles.heroSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {heroSubtitle}
          </Text>
        </View>

        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
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

          <Button mode="text" onPress={onSecondaryAction} style={styles.linkButton}>
            {secondaryActionLabel}
          </Button>
        </Surface>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={onDismissSnackbar}
        duration={4000}
        action={{ label: dismissLabel, onPress: onDismissSnackbar }}
      >
        {snackbarMessage}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}
