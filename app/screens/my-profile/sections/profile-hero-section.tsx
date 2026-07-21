import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Avatar, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Reveal, SectionCard } from '../../../../components';
import type { PersonRecord } from '../../../../components/dto/person';
import { getPersonLifeSpanLabel, isPersonDeceased, type PersonPhoto } from '../../../../components/dto/person';
import { formatPersonName } from '../../../../components/person-formatting';
import { getThemeChrome } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
    position: 'relative',
    shadowColor: '#2A1C14',
    shadowOpacity: 0.12,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  heroFloatingButton: {
    position: 'absolute',
    top: 14,
    zIndex: 1,
    elevation: 7,
    margin: 0,
  },
  heroFloatingButtonRight: {
    right: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  heroAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
  },
  heroAvatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIdentityWrap: {
    flex: 1,
    minWidth: 220,
  },
  heroNameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  heroSubtext: {
    marginTop: 6,
  },
  fallbackChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
});

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
        <SectionCard variant="person" backgroundColor={chrome.primaryCardBackground} style={styles.heroCard}>
          {canEditLinkedProfile ? (
            <IconButton
              icon="pencil"
              mode="contained"
              size={22}
              onPress={onEdit}
              style={[styles.heroFloatingButton, styles.heroFloatingButtonRight]}
              accessibilityLabel={t(K.personProfile.editLinkedFamilyProfile)}
            />
          ) : null}
          <View style={styles.heroHeader}>
            <View style={styles.heroAvatarRow}>
              {preferredPhoto ? (
                <Image
                  source={{ uri: preferredPhoto.url }}
                  style={[styles.heroAvatar, { backgroundColor: chrome.avatarBackground, borderColor: chrome.avatarBorder }]}
                />
              ) : (
                <View style={[styles.heroAvatarFallback, { backgroundColor: chrome.avatarBackground, borderColor: chrome.avatarBorder }]}>
                  <MaterialCommunityIcons
                    name={linkedPerson && isPersonDeceased(linkedPerson) ? 'flower-outline' : 'account-heart-outline'}
                    size={38}
                    color={theme.colors.primary}
                  />
                </View>
              )}
              <View style={styles.heroIdentityWrap}>
                <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                  {t(K.personProfile.linkedFamilyProfile)}
                </Text>
                <View style={styles.heroNameRow}>
                  <Text variant="headlineMedium">{linkedPerson ? formatPersonName(linkedPerson) : t(K.common.unknown)}</Text>
                  <Chip compact icon="account">{t(K.common.you)}</Chip>
                </View>
                <Text variant="bodyMedium" style={[styles.heroSubtext, { color: theme.colors.onSurfaceVariant }]}>
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
      <SectionCard variant="person" backgroundColor={chrome.secondaryCardBackground} style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroAvatarRow}>
            <Avatar.Text
              size={92}
              label={userDisplayName ? userDisplayName.slice(0, 2).toUpperCase() : '??'}
              style={{ backgroundColor: theme.colors.primaryContainer }}
              color={theme.colors.onPrimaryContainer}
            />
            <View style={styles.heroIdentityWrap}>
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
              <View style={styles.fallbackChipRow}>
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
