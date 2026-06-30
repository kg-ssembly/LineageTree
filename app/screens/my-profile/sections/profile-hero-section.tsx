import React from 'react';
import { Image, View } from 'react-native';
import { Avatar, Chip, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Reveal } from '../../../../components';
import type { PersonRecord } from '../../../../components/dto/person';
import { getPersonLifeSpanLabel, isPersonDeceased, type PersonPhoto } from '../../../../components/dto/person';
import { formatPersonName } from '../../../../components/person-formatting';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

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
      <Reveal delay={60}>
        <Surface style={[personProfileStyles.heroCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          {canEditLinkedProfile ? (
            <IconButton
              icon="pencil"
              mode="contained-tonal"
              size={22}
              onPress={onEdit}
              style={[personProfileStyles.heroFloatingButton, personProfileStyles.heroFloatingButtonRight]}
              accessibilityLabel={t(K.personProfile.editLinkedFamilyProfile)}
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
                  {t(K.personProfile.linkedFamilyProfile)}
                </Text>
                <View style={personProfileStyles.heroNameRow}>
                  <Text variant="headlineMedium">{linkedPerson ? formatPersonName(linkedPerson) : t(K.common.unknown)}</Text>
                  <Chip compact icon="account">{t(K.common.you)}</Chip>
                </View>
                <Text variant="bodyMedium" style={[personProfileStyles.heroSubtext, { color: theme.colors.onSurfaceVariant }]}>
                  {linkedPerson ? getPersonLifeSpanLabel(linkedPerson) : t(K.personProfile.linkYourselfToManageProfile)}
                </Text>
              </View>
            </View>
          </View>
        </Surface>
      </Reveal>
    );
  }

  return (
    <Reveal delay={60}>
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
              {t(K.profileState.profileWorkspace)}
            </Text>
            <Text variant="headlineMedium" style={{ color: theme.colors.onSurface, fontWeight: '800' }}>
              {userDisplayName ?? t(K.common.unknown)}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
              {userEmail}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
              {fallbackSummary}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <Chip compact icon="account-group-outline">Family circle</Chip>
              <Chip compact icon="image-multiple-outline">Memories</Chip>
            </View>
          </View>
        </View>
      </Surface>
    </Reveal>
  );
}
