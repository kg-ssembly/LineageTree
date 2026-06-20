/**
 * profile-screen.tsx
 * Profile tab — user account info, display name, appearance settings, and sign-out.
 */
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Avatar,
  Button,
  IconButton,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useAuthStore } from '../../stores/auth-store';
import { useThemeStore } from '../../stores/theme-store';
import type { ThemePreference } from '../../constants/theme';
import { formatDate } from '../../components/dto/person';
import type { RootStackParamList } from '../../components/dto/navigation';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// No props needed for the content component directly unless passed by the navigator
// type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

import { GlobalStyles } from '../../constants/styles';
const styles = GlobalStyles.treeDetail;
const homeStyles = GlobalStyles.home;

export type UserProfileTabProps = {
  onSignOut: () => void;
  authLoading: boolean;
};

export function UserProfileTabContent({ onSignOut, authLoading }: UserProfileTabProps) {
  const theme = useTheme();
  const { user, updateDisplayName } = useAuthStore();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const [editName, setEditName] = useState(user?.displayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [activeHelper, setActiveHelper] = useState<'profile' | 'appearance' | null>(null);

  const isDirty = editName.trim() !== (user?.displayName ?? '').trim();

  const handleSaveName = async () => {
    if (!editName.trim()) {
      setNameError('Display name cannot be empty.');
      return;
    }
    setNameError(null);
    setSavingName(true);
    try {
      await updateDisplayName(editName.trim());
    } catch {
      setNameError('Failed to update name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const appearanceSummary =
    preference === 'dark'
      ? 'Dark mode is enabled for a cosy, low-light workspace.'
      : 'Light mode is enabled for a bright, airy workspace.';

  const profileStats = [
    { label: 'Trees', value: 'Family', icon: 'family-tree' },
    { label: 'Space', value: preference === 'dark' ? 'Night' : 'Light', icon: preference === 'dark' ? 'weather-night' : 'white-balance-sunny' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Surface style={[homeStyles.profileHeroCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={2}>
        <View style={homeStyles.profileAvatarRow}>
          <Avatar.Text
            size={88}
            label={user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : '??'}
            style={{ backgroundColor: theme.colors.primaryContainer }}
            color={theme.colors.onPrimaryContainer}
          />
          <View style={homeStyles.profileNameWrap}>
            <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
              Personal profile
            </Text>
            <Text variant="headlineMedium" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
              {user?.displayName ?? 'Unknown'}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
              {user?.email}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
              Member since {user?.createdAt ? formatDate(new Date(user.createdAt)) : '—'}
            </Text>
          </View>
        </View>

      </Surface>

      {/* Edit profile */}
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={homeStyles.titleWithHelperRow}>
          <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>Edit profile</Text>
          <IconButton
            icon="information-outline"
            size={18}
            style={homeStyles.helperIconButton}
            onPress={() => setActiveHelper((current) => current === 'profile' ? null : 'profile')}
            accessibilityLabel="About editing your profile"
          />
        </View>
        {activeHelper === 'profile' ? (
          <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Change the display name shown across your family trees.
          </Text>
        ) : null}
        <View style={homeStyles.editNameRow}>
          <TextInput
            label="Display name"
            value={editName}
            onChangeText={(value) => { setEditName(value); setNameError(null); }}
            mode="outlined"
            style={homeStyles.editNameInput}
            error={!!nameError}
            disabled={savingName}
          />
          <Button
            mode="contained"
            icon="content-save-outline"
            onPress={handleSaveName}
            disabled={savingName || !isDirty}
            style={homeStyles.saveNameButton}
          >
            Save changes
          </Button>
        </View>
        {nameError ? (
          <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>{nameError}</Text>
        ) : null}
      </Surface>

      {/* Appearance */}
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={homeStyles.titleWithHelperRow}>
          <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>Appearance</Text>
          <IconButton
            icon="information-outline"
            size={18}
            style={homeStyles.helperIconButton}
            onPress={() => setActiveHelper((current) => current === 'appearance' ? null : 'appearance')}
            accessibilityLabel="About appearance settings"
          />
        </View>
        {activeHelper === 'appearance' ? (
          <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Switch the app between light and dark viewing modes.
          </Text>
        ) : null}
        <SegmentedButtons
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
          buttons={[
            { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
            { value: 'dark', label: 'Dark', icon: 'weather-night' },
          ]}
          style={homeStyles.themeSwitch}
        />
        <View style={[homeStyles.appearanceHint, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{appearanceSummary}</Text>
        </View>
      </Surface>

      {/* Sign out */}
      <Button
        mode="contained-tonal"
        icon="logout"
        onPress={onSignOut}
        disabled={authLoading}
        contentStyle={homeStyles.signOutButtonContent}
        style={homeStyles.signOutButton}
      >
        Log out
      </Button>
    </ScrollView>
  );
}

// UserProfileTabContent is the only export needed
