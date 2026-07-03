import React from 'react';
import { Image, View } from 'react-native';
import { Avatar, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Reveal, SectionCard } from '../../../../components';
import type { PersonRecord } from '../../../../components/dto/person';
import { getPersonLifeSpanLabel, isPersonDeceased, type PersonPhoto } from '../../../../components/dto/person';
import { formatPersonName } from '../../../../components/person-formatting';
import { getThemeChrome, GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

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
  const chrome = getThemeChrome(theme);

  if (shouldShowLinkedProfileTabs) {
    return (
      <Reveal delay={60}>
        <SectionCard variant="person" backgroundColor={chrome.primaryCardBackground} style={personProfileStyles.heroCard}>
          {canEditLinkedProfile ? (
            <IconButton
              icon="pencil"
              mode="contained"
              size={22}
              onPress={onEdit}
              style={[personProfileStyles.heroFloatingButton, personProfileStyles.heroFloatingButtonRight]}
              accessibilityLabel={t(K.personProfile.editLinkedFamilyProfile)}
            />
          ) : null}
          <View style={personProfileStyles.heroHeader}>
            <View style={personProfileStyles.heroAvatarRow}>
              {preferredPhoto ? (
                <Image
                  source={{ uri: preferredPhoto.url }}
                  style={[personProfileStyles.heroAvatar, { backgroundColor: chrome.avatarBackground, borderColor: chrome.avatarBorder }]}
                />
              ) : (
                <View style={[personProfileStyles.heroAvatarFallback, { backgroundColor: chrome.avatarBackground, borderColor: chrome.avatarBorder }]}>
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
        </SectionCard>
      </Reveal>
    );
  }

  return (
    <Reveal delay={60}>
      <SectionCard variant="person" backgroundColor={chrome.secondaryCardBackground} style={personProfileStyles.heroCard}>
        <View style={personProfileStyles.heroHeader}>
          <View style={personProfileStyles.heroAvatarRow}>
            <Avatar.Text
              size={92}
              label={userDisplayName ? userDisplayName.slice(0, 2).toUpperCase() : '??'}
              style={{ backgroundColor: theme.colors.primaryContainer }}
              color={theme.colors.onPrimaryContainer}
            />
            <View style={personProfileStyles.heroIdentityWrap}>
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
                <Chip compact icon="account-group-outline">{t(K.personProfile.familyCircle)}</Chip>
                <Chip compact icon="image-multiple-outline">{t(K.memories.memories)}</Chip>
              </View>
            </View>
          </View>
        </View>
      </SectionCard>
    </Reveal>
  );
}
