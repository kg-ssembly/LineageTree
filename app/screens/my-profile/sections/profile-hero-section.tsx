import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, Chip, Text, useTheme } from 'react-native-paper';
import { CachedImage, Reveal, SectionCard } from '../../../../components';
import type { PersonRecord } from '../../../../components/dto/person';
import { getPersonLifeSpanLabel, type PersonPhoto } from '../../../../components/dto/person';
import { formatPersonName } from '../../../../components/person-formatting';
import { getThemeChrome } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import { getFamilyMemberCardStyle } from '../../profile-shared/profile-card-shared';

const styles = StyleSheet.create({
  heroCard: {
    marginBottom: 0,
    position: 'relative',
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
    minWidth: 0,
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
  treeName,
}: {
  shouldShowLinkedProfileTabs: boolean;
  linkedPerson: PersonRecord | null;
  preferredPhoto: PersonPhoto | null | undefined;
  canEditLinkedProfile: boolean;
  onEdit: () => void;
  userDisplayName?: string | null;
  userEmail?: string | null;
  fallbackSummary: string;
  treeName?: string;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const chrome = getThemeChrome(theme);

  if (shouldShowLinkedProfileTabs) {
    return (
      <Reveal delay={60}>
        <SectionCard
          variant="person"
          backgroundColor={theme.colors.surface}
          style={[getFamilyMemberCardStyle(theme, theme.colors.surface), styles.heroCard]}
        >
          <View style={styles.heroHeader}>
            <View style={styles.heroAvatarRow}>
              {preferredPhoto ? (
                <CachedImage
                  uri={preferredPhoto.url}
                  style={[styles.heroAvatar, { backgroundColor: chrome.avatarBackground, borderColor: chrome.avatarBorder }]}
                  priority="high"
                  recyclingKey={preferredPhoto.id}
                />
              ) : (
                <Avatar.Text size={92} label={`${linkedPerson?.firstName[0] ?? ''}${linkedPerson?.lastName[0] ?? ''}`} style={{ backgroundColor: theme.colors.surfaceVariant }} color={theme.colors.onSurfaceVariant} />
              )}
              <View style={styles.heroIdentityWrap}>
                <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                  {t('My family story')}
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
          {linkedPerson?.notes ? <Text numberOfLines={3} variant="bodyLarge" style={{ marginTop: 16, color: theme.colors.onSurface }}>{linkedPerson.notes}</Text> : null}
          {treeName ? <Text variant="bodySmall" style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>{treeName}</Text> : null}
          {canEditLinkedProfile ? <Button mode="contained" icon="pencil-outline" onPress={onEdit} style={{ alignSelf: 'flex-start', marginTop: 12 }}>{t('Edit profile')}</Button> : null}
        </SectionCard>
      </Reveal>
    );
  }

  return (
    <Reveal delay={60}>
      <SectionCard
        variant="person"
        backgroundColor={chrome.secondaryCardBackground}
        style={[getFamilyMemberCardStyle(theme, chrome.secondaryCardBackground), styles.heroCard]}
      >
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
              <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
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
