import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, SegmentedButtons, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import type { ThemePreference } from '../../../../constants/theme';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { useAuthStore } from '../../../../stores/auth-store';
import { useThemeStore } from '../../../../stores/theme-store';

export type UserProfileTabProps = {
  onSignOut: () => void;
  authLoading: boolean;
};

const treeDetailStyles = GlobalStyles.treeDetail;
const homeStyles = GlobalStyles.home;

export function AppSettingsSection({ onSignOut, authLoading }: UserProfileTabProps) {
  const theme = useTheme();
  const { language, languages, setLanguage, t } = useI18n();
  const { user, updateDisplayName } = useAuthStore();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const [editName, setEditName] = useState(user?.displayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    setEditName(user?.displayName ?? '');
  }, [user?.displayName]);

  const isDirty = editName.trim() !== (user?.displayName ?? '').trim();
  const appearanceSummary =
    preference === 'dark'
      ? t('Dark mode is enabled for a cosy, low-light workspace.')
      : t('Light mode is enabled for a bright, airy workspace.');

  const handleSaveName = async () => {
    if (!editName.trim()) {
      setNameError(t('Display name cannot be empty.'));
      return;
    }

    setNameError(null);
    setSavingName(true);
    try {
      await updateDisplayName(editName.trim());
    } catch {
      setNameError(t('Failed to update name. Please try again.'));
    } finally {
      setSavingName(false);
    }
  };

  return (
    <>
      <Surface style={[treeDetailStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>{t('Edit profile')}</Text>
        <Text variant="bodySmall" style={[treeDetailStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {t('Change the display name shown across your family trees.')}
        </Text>
        <View style={homeStyles.editNameRow}>
          <TextInput
            label={t('Display name')}
            value={editName}
            onChangeText={(value) => {
              setEditName(value);
              setNameError(null);
            }}
            mode="outlined"
            style={homeStyles.editNameInput}
            error={!!nameError}
            disabled={savingName}
          />
          <Button mode="contained" icon="content-save-outline" onPress={handleSaveName} disabled={savingName || !isDirty} style={homeStyles.saveNameButton}>
            {t('Save changes')}
          </Button>
        </View>
        {nameError ? <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>{nameError}</Text> : null}
      </Surface>

      <Surface style={[treeDetailStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>{t('Appearance')}</Text>
        <Text variant="bodySmall" style={[treeDetailStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {t('Switch the app between light and dark viewing modes.')}
        </Text>
        <SegmentedButtons
          key={`appearance-${theme.dark ? 'dark' : 'light'}-${preference}`}
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
          buttons={[
            { value: 'light', label: t('Light'), icon: 'white-balance-sunny' },
            { value: 'dark', label: t('Dark'), icon: 'weather-night' },
          ]}
          style={homeStyles.themeSwitch}
        />
        <View style={[homeStyles.appearanceHint, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{appearanceSummary}</Text>
        </View>
      </Surface>

      <Surface style={[treeDetailStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>{t('App language')}</Text>
        <Text variant="bodySmall" style={[treeDetailStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {t('Choose the language used across the app.')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {languages.map((option) => (
            <Chip
              key={option.code}
              selected={option.code === language}
              onPress={() => void setLanguage(option.code)}
              style={{ marginBottom: 8 }}
              icon={option.code === language ? 'check' : 'translate'}
            >
              {option.nativeName}
            </Chip>
          ))}
        </View>
      </Surface>

      <Button mode="contained-tonal" icon="logout" onPress={onSignOut} disabled={authLoading} contentStyle={homeStyles.signOutButtonContent} style={homeStyles.signOutButton}>
        {t('Log out')}
      </Button>
    </>
  );
}
