import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, SegmentedButtons, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { Reveal } from '../../../../components';
import type { ThemePreference } from '../../../../constants/theme';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
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
  const { user, updateDisplayName, updatePreferredLanguage } = useAuthStore();
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
      ? t(K.settings.darkModeEnabled)
      : t(K.settings.lightModeEnabled);

  const handleSaveName = async () => {
    if (!editName.trim()) {
      setNameError(t(K.settings.displayNameEmpty));
      return;
    }

    setNameError(null);
    setSavingName(true);
    try {
      await updateDisplayName(editName.trim());
    } catch {
      setNameError(t(K.settings.failedToUpdateName));
    } finally {
      setSavingName(false);
    }
  };

  const handleLanguageChange = async (nextLanguage: typeof language) => {
    await setLanguage(nextLanguage);
    await updatePreferredLanguage(nextLanguage);
  };

  return (
    <>
      <Reveal delay={80}>
        <Surface style={[treeDetailStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>{t(K.settings.editProfile)}</Text>
        <Text variant="bodySmall" style={[treeDetailStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {t(K.settings.changeDisplayName)}
        </Text>
        <View style={homeStyles.editNameRow}>
          <TextInput
            label={t(K.settings.displayName)}
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
            {t(K.common.saveChanges)}
          </Button>
        </View>
        {nameError ? <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>{nameError}</Text> : null}
        </Surface>
      </Reveal>

      <Reveal delay={100}>
        <Surface style={[treeDetailStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>{t(K.settings.appearance)}</Text>
        <Text variant="bodySmall" style={[treeDetailStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {t(K.settings.switchLightDarkModes)}
        </Text>
        <SegmentedButtons
          key={`appearance-${theme.dark ? 'dark' : 'light'}-${preference}`}
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
          buttons={[
            { value: 'light', label: t(K.common.light), icon: 'white-balance-sunny' },
            { value: 'dark', label: t(K.common.dark), icon: 'weather-night' },
          ]}
          style={homeStyles.themeSwitch}
        />
        <View style={[homeStyles.appearanceHint, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{appearanceSummary}</Text>
        </View>
        </Surface>
      </Reveal>

      <Reveal delay={120}>
        <Surface style={[treeDetailStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>{t(K.settings.appLanguage)}</Text>
        <Text variant="bodySmall" style={[treeDetailStyles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {t(K.settings.chooseLanguage)}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {languages.map((option) => (
            <Chip
              key={option.code}
              selected={option.code === language}
              onPress={() => void handleLanguageChange(option.code)}
              style={{ marginBottom: 8 }}
              icon={option.code === language ? 'check' : 'translate'}
            >
              {option.nativeName}
            </Chip>
          ))}
        </View>
        </Surface>
      </Reveal>

      <Button mode="contained-tonal" icon="logout" onPress={onSignOut} disabled={authLoading} contentStyle={homeStyles.signOutButtonContent} style={homeStyles.signOutButton}>
        {t(K.common.logOut)}
      </Button>
    </>
  );
}
