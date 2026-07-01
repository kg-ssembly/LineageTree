import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Dialog, Portal, Text, useTheme } from 'react-native-paper';
import { GlobalStyles } from '../constants/styles';
import { useI18n } from '../hooks/use-i18n';
import type { AppLanguage } from '../i18n';

const dialogChrome = GlobalStyles.dialogChrome;

type StartupModalProps = {
  visible: boolean;
  mode: 'language' | 'update';
  currentVersion: string;
  updateHighlights: string[];
  initialLanguage?: AppLanguage;
  loading?: boolean;
  onSubmitLanguage: (language: AppLanguage) => void | Promise<void>;
  onDismissUpdate: () => void | Promise<void>;
};

export default function StartupModal({
  visible,
  mode,
  currentVersion,
  updateHighlights,
  initialLanguage,
  loading = false,
  onSubmitLanguage,
  onDismissUpdate,
}: StartupModalProps) {
  const theme = useTheme();
  const { t, languages } = useI18n();
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(initialLanguage ?? 'en');

  useEffect(() => {
    setSelectedLanguage(initialLanguage ?? 'en');
  }, [initialLanguage, visible]);

  const title = mode === 'language'
    ? t('Choose your preferred language')
    : t("What's new");

  const description = mode === 'language'
    ? t('Pick the language you want Lineage Tree to use from now on. You can change it again later in Settings.')
    : t('Lineage Tree has been updated to version {version}.', { version: currentVersion });

  const canSaveLanguage = useMemo(() => Boolean(selectedLanguage), [selectedLanguage]);

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
            <Button mode="contained" onPress={() => onSubmitLanguage(selectedLanguage)} disabled={loading || !canSaveLanguage}>
              {t('Save language')}
            </Button>
          ) : (
            <Button mode="contained" onPress={onDismissUpdate} disabled={loading}>
              {t('Continue')}
            </Button>
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
