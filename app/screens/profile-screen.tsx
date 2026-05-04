/**
 * profile-screen.tsx
 * Profile tab — user account info, display name, appearance settings, and sign-out.
 */
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
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
import { StyleSheet } from 'react-native';

const styles = GlobalStyles.treeDetail;
const homeStyles = GlobalStyles.home;

const localStyles = StyleSheet.create({
  profileHeroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  profileAvatarRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
  },
  profileNameWrap: {
    flex: 1,
  },
  editNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 16,
  },
  editNameInput: {
    flex: 1,
  },
  signOutButtonContent: {
    height: 48,
  },
  signOutButton: {
    marginTop: 16,
  },
});

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

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Hero */}
      <Surface style={[localStyles.profileHeroCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={2}>
        <View style={localStyles.profileAvatarRow}>
          <Avatar.Text
            size={72}
            label={user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : '??'}
            style={{ backgroundColor: theme.colors.primary }}
            color={theme.colors.onPrimary}
          />
          <View style={localStyles.profileNameWrap}>
            <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
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
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>Edit profile</Text>
        <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Update your display name.
        </Text>
        <View style={localStyles.editNameRow}>
          <TextInput
            label="Display name"
            value={editName}
            onChangeText={(value) => { setEditName(value); setNameError(null); }}
            mode="outlined"
            style={localStyles.editNameInput}
            error={!!nameError}
            disabled={savingName}
          />
          <IconButton
            icon="content-save-outline"
            mode="contained"
            iconColor={theme.colors.onPrimary}
            containerColor={theme.colors.primary}
            size={24}
            onPress={handleSaveName}
            disabled={savingName || !isDirty}
          />
        </View>
        {nameError ? (
          <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>{nameError}</Text>
        ) : null}
      </Surface>

      {/* Appearance */}
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>Appearance</Text>
        <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Theme and display preferences.
        </Text>
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
        contentStyle={localStyles.signOutButtonContent}
        style={localStyles.signOutButton}
      >
        Log out
      </Button>
    </ScrollView>
  );
}

// UserProfileTabContent is the only export needed

