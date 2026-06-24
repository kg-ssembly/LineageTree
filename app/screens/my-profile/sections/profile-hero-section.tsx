import React from 'react';
import { Image, View } from 'react-native';
import { Avatar, Chip, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PersonRecord } from '../../../../components/dto/person';
import { getPersonLifeSpanLabel, isPersonDeceased, type PersonPhoto } from '../../../../components/dto/person';
import { formatPersonName } from '../../../../components/person-formatting';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';

const homeStyles = GlobalStyles.home;
const personProfileStyles = GlobalStyles.personProfile;

export function ProfileHeroSection({
  shouldShowLinkedProfileTabs,
  linkedPerson,
  preferredPhoto,
  canEditLinkedProfile,
  onEdit,
  userDisplayName,
  userEmail,
  fallbackSummary,
}: {
  shouldShowLinkedProfileTabs: boolean;
  linkedPerson: PersonRecord | null;
  preferredPhoto: PersonPhoto | null | undefined;
  canEditLinkedProfile: boolean;
  onEdit: () => void;
  userDisplayName?: string | null;
  userEmail?: string | null;
  fallbackSummary: string;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  if (shouldShowLinkedProfileTabs) {
    return (
      <Surface style={[personProfileStyles.heroCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
        {canEditLinkedProfile ? (
          <IconButton
            icon="pencil"
            mode="contained-tonal"
            size={22}
            onPress={onEdit}
            style={[personProfileStyles.heroFloatingButton, personProfileStyles.heroFloatingButtonRight]}
            accessibilityLabel={t('Edit my linked family profile')}
          />
        ) : null}
        <View style={personProfileStyles.heroHeader}>
          <View style={personProfileStyles.heroAvatarRow}>
            {preferredPhoto ? (
              <Image source={{ uri: preferredPhoto.url }} style={personProfileStyles.heroAvatar} />
            ) : (
              <View style={personProfileStyles.heroAvatarFallback}>
                <MaterialCommunityIcons
                  name={linkedPerson && isPersonDeceased(linkedPerson) ? 'flower-outline' : 'account-heart-outline'}
                  size={38}
                  color={theme.colors.primary}
                />
              </View>
            )}
            <View style={personProfileStyles.heroIdentityWrap}>
              <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                {t('My linked family profile')}
              </Text>
              <View style={personProfileStyles.heroNameRow}>
                <Text variant="headlineMedium">{linkedPerson ? formatPersonName(linkedPerson) : t('Unknown')}</Text>
                <Chip compact icon="account">{t('You')}</Chip>
              </View>
              <Text variant="bodyMedium" style={[personProfileStyles.heroSubtext, { color: theme.colors.onSurfaceVariant }]}>
                {linkedPerson ? getPersonLifeSpanLabel(linkedPerson) : t('Link yourself in your default tree to manage your family profile here.')}
              </Text>
            </View>
          </View>
        </View>
      </Surface>
    );
  }

  return (
    <Surface style={[homeStyles.profileHeroCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={2}>
      <View style={homeStyles.profileAvatarRow}>
        <Avatar.Text
          size={88}
          label={userDisplayName ? userDisplayName.slice(0, 2).toUpperCase() : '??'}
          style={{ backgroundColor: theme.colors.primaryContainer }}
          color={theme.colors.onPrimaryContainer}
        />
        <View style={homeStyles.profileNameWrap}>
          <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
            {t('Profile workspace')}
          </Text>
          <Text variant="headlineMedium" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
            {userDisplayName ?? t('Unknown')}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
            {userEmail}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            {fallbackSummary}
          </Text>
        </View>
      </View>
    </Surface>
  );
}
