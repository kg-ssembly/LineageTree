import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, Portal, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { GlobalStyles } from '../constants/styles';
import { useI18n } from '../hooks/use-i18n';
import { I18N_KEYS as K } from '../i18n/keys';
import type { AppLanguage } from '../i18n';
import type { ThemePreference } from '../constants/theme';

const dialogChrome = GlobalStyles.dialogChrome;

type StartupModalProps = {
  visible: boolean;
  mode: 'language' | 'update';
  currentVersion: string;
  updateHighlights: string[];
  initialTheme?: ThemePreference;
  initialLanguage?: AppLanguage;
  loading?: boolean;
  onSubmitPreferences: (preferences: { theme: ThemePreference; language: AppLanguage }) => void | Promise<void>;
  onDismissUpdate: () => void | Promise<void>;
};

export default function StartupModal({
  visible,
  mode,
  currentVersion,
  updateHighlights,
  initialTheme,
  initialLanguage,
  loading = false,
  onSubmitPreferences,
  onDismissUpdate,
}: StartupModalProps) {
  const theme = useTheme();
  const { t, languages } = useI18n();
  const [selectedTheme, setSelectedTheme] = useState<ThemePreference>(initialTheme ?? 'light');
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(initialLanguage ?? 'en');

  useEffect(() => {
    setSelectedTheme(initialTheme ?? 'light');
    setSelectedLanguage(initialLanguage ?? 'en');
  }, [initialLanguage, initialTheme, visible]);

  const title = mode === 'language'
    ? t(K.startup.chooseThemeAndLanguage)
    : t(K.startup.whatsNew);

  const description = mode === 'language'
    ? t(K.startup.setupPrompt)
    : t(K.startup.updatedVersion, { version: currentVersion });

  const canContinue = useMemo(() => Boolean(selectedTheme && selectedLanguage), [selectedLanguage, selectedTheme]);

  return (
    <Portal>
      <Dialog
        visible={visible}
        dismissable={mode === 'update' && !loading}
        onDismiss={mode === 'update' && !loading ? onDismissUpdate : undefined}
        style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
        <Dialog.Title style={dialogChrome.dialogTitle}>{title}</Dialog.Title>
        <Dialog.Content style={dialogChrome.content}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, marginBottom: 16 }}>
            {description}
          </Text>

          {mode === 'language' ? (
            <View style={{ gap: 18 }}>
              <View style={{ gap: 10 }}>
                <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                  {t(K.startup.choosePreferredTheme)}
                </Text>
                <SegmentedButtons
                  value={selectedTheme}
                  onValueChange={(value) => setSelectedTheme(value as ThemePreference)}
                  buttons={[
                    { value: 'light', label: t(K.common.light), icon: 'white-balance-sunny', disabled: loading },
                    { value: 'dark', label: t(K.common.dark), icon: 'weather-night', disabled: loading },
                  ]}
                />
              </View>

              <View style={{ gap: 10 }}>
                <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                  {t(K.startup.choosePreferredLanguage)}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {languages.map((option) => (
                    <Chip
                      key={option.code}
                      selected={option.code === selectedLanguage}
                      onPress={() => setSelectedLanguage(option.code)}
                      disabled={loading}
                      icon={option.code === selectedLanguage ? 'check' : 'translate'}
                      style={{ marginBottom: 8 }}
                    >
                      {option.nativeName}
                    </Chip>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: 10 }}>
              {updateHighlights.map((highlight) => (
                <View key={highlight} style={{ flexDirection: 'row', gap: 10 }}>
                  <Text variant="titleMedium" style={{ color: theme.colors.primary }}>•</Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, flex: 1 }}>
                    {t(highlight)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </Dialog.Content>
        <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          {mode === 'language' ? (
            <Button mode="contained" onPress={() => void onSubmitPreferences({ theme: selectedTheme, language: selectedLanguage })} disabled={loading || !canContinue}>
              {t(K.startup.continue)}
            </Button>
          ) : (
            <Button mode="contained" onPress={onDismissUpdate} disabled={loading}>
              {t(K.startup.continue)}
            </Button>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
