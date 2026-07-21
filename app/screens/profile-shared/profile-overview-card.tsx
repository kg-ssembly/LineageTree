import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, Reveal, SectionCard, type SuggestionItem } from '../../../components';
import type { PersonPhoto, PersonRecord } from '../../../components/dto/person';
import { formatPersonDate, getPersonPresenceLabel, getPersonTreeMembershipIds, isPersonDeceased } from '../../../components/dto/person';
import type { RelationshipRecord } from '../../../components/dto/relationship';
import { formatPersonGender } from '../../../components/person-formatting';
import { getThemeChrome } from '../../../constants/styles';
import { useI18n } from '../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../i18n/keys';
import { buildProfileSuggestions, getPersonRelationshipCounts, getProfileCompletionChecks } from './suggestions';

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionHeaderText: {
    flex: 1,
    minWidth: 220,
  },
  titleWithHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  helperIconButton: {
    margin: 0,
    marginLeft: -4,
  },
  sectionSubtitle: {
    marginTop: 6,
  },
  sectionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  spotlightCard: {
    marginTop: 16,
    borderRadius: 24,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  spotlightTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  spotlightCopy: {
    flex: 1,
    minWidth: 180,
    gap: 6,
  },
  spotlightMetricWrap: {
    alignItems: 'flex-end',
    minWidth: 74,
    flexShrink: 0,
  },
  spotlightMetricLabel: {
    marginTop: 2,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  spotlightStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  spotlightStatCard: {
    minWidth: 110,
    flexGrow: 1,
    flexBasis: 110,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  spotlightStatLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  spotlightStatLabel: {
    flexShrink: 1,
  },
  spotlightStatValue: {
    marginTop: 2,
  },
  spotlightConnectionSummary: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  spotlightConnectionTitle: {
    marginBottom: 6,
  },
  spotlightChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  spotlightToneText: {
    marginTop: 14,
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  summaryChip: {
    borderRadius: 999,
  },
  biographyLead: {
    marginTop: 14,
    lineHeight: 24,
  },
  biographyBlock: {
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  biographyFactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  biographyFactCard: {
    borderRadius: 18,
    padding: 14,
    minWidth: 140,
    flexGrow: 1,
    flexBasis: 140,
    borderWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: {
    marginBottom: 8,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionHeaderButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
  },
  actionHeaderButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  actionCountChip: {
    borderRadius: 999,
  },
  actionToggleIcon: {
    marginRight: 2,
  },
  actionPanel: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionPanelContent: {
    marginTop: 10,
  },
  nextStepCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nextStepCardSpacing: {
    marginTop: 10,
  },
  nextStepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  nextStepContent: {
    flex: 1,
  },
  nextStepChip: {
    alignSelf: 'flex-start',
  },
  nextStepBody: {
    marginTop: 10,
    lineHeight: 20,
  },
  nextStepActionWrap: {
    alignItems: 'flex-end',
  },
  notesBox: {
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
  },
  notesText: {
    marginTop: 8,
  },
});

type ProfileOverviewCardProps = {
  person: PersonRecord;
  preferredPhoto: PersonPhoto | null | undefined;
  relationships: RelationshipRecord[];
  canEdit?: boolean;
  linkedCollaboratorLabel?: string | null;
  isCurrentUsersPerson?: boolean;
  onOpenHelperDialog?: () => void;
  onEdit?: () => void;
  onOpenPhotos?: () => void;
  onOpenNotes?: () => void;
  onAddRelationship?: () => void;
  delay?: number;
};

function getStrengthTone(filled: number, total: number, t: ReturnType<typeof useI18n>['t']) {
  if (filled <= 2) {
    return t(K.personProfile.profileStrengthStarting);
  }

  if (filled >= total - 1) {
    return t(K.personProfile.profileStrengthStrong);
  }

  return t(K.personProfile.profileStrengthGrowing);
}

function getStrengthProgress(filled: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return filled / total;
}

function OverviewSectionHeader({
  icon,
  eyebrow,
  title,
  subtitle,
  themeColors,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  eyebrow: string;
  title: string;
  subtitle: string;
  themeColors: {
    badgeBackground: string;
    badgeColor: string;
    subtitleColor: string;
  };
}) {
  return (
    <View style={styles.sectionBadgeRow}>
      <View style={[styles.sectionBadge, { backgroundColor: themeColors.badgeBackground }]}>
        <MaterialCommunityIcons name={icon} size={18} color={themeColors.badgeColor} />
      </View>
      <View style={styles.sectionBadgeTextWrap}>
        <Text variant="labelMedium" style={{ color: themeColors.badgeColor }}>
          {eyebrow}
        </Text>
        <Text variant="titleSmall">{title}</Text>
        <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: themeColors.subtitleColor }]}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export function ProfileOverviewCard({
  person,
  preferredPhoto,
  relationships,
  canEdit = false,
  linkedCollaboratorLabel,
  isCurrentUsersPerson = false,
  onOpenHelperDialog,
  onEdit,
  onOpenPhotos,
  onOpenNotes,
  onAddRelationship,
  delay = 90,
}: ProfileOverviewCardProps) {
  const [nextStepsCollapsed, setNextStepsCollapsed] = React.useState(true);
  const theme = useTheme();
  const { t } = useI18n();
  const chrome = getThemeChrome(theme);
  const relationshipCounts = getPersonRelationshipCounts(person.id, relationships);
  const { checks } = getProfileCompletionChecks(person, relationships);
  const completedCount = checks.filter(Boolean).length;
  const completionProgress = getStrengthProgress(completedCount, checks.length);
  const suggestions = buildProfileSuggestions(person, relationships, t);
  const totalFamilyLinks = relationshipCounts.parents + relationshipCounts.partners + relationshipCounts.children;
  const spotlightTextColor = theme.colors.onPrimaryContainer;
  const spotlightSubtextColor = theme.dark ? theme.colors.onPrimaryContainer : '#345447';
  const summaryChips = [
    person.gender !== 'unspecified' ? { key: 'gender', label: formatPersonGender(person.gender) } : null,
    { key: 'presence', label: getPersonPresenceLabel(person), icon: isPersonDeceased(person) ? 'flower-outline' : 'heart-pulse' },
    preferredPhoto ? { key: 'preferred-photo', label: t(K.personProfile.preferredPhotoSelected), icon: 'star' } : null,
    linkedCollaboratorLabel && !isCurrentUsersPerson ? { key: 'linked', label: t(K.common.linked), icon: 'link-variant' } : null,
    person.canonicalPersonId?.trim() ? { key: 'merged', label: t(K.personProfile.mergedCanonicalProfile), icon: 'merge' } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; icon?: string }>;
  const spotlightStats = [
    {
      key: 'photos',
      icon: 'image-multiple',
      label: t(K.memories.memories),
      value: person.photos.length.toString(),
    },
    {
      key: 'connections',
      icon: 'family-tree',
      label: t(K.personProfile.familyConnections),
      value: totalFamilyLinks.toString(),
    },
    {
      key: 'trees',
      icon: 'source-branch',
      label: t(K.personProfile.treeMemberships),
      value: getPersonTreeMembershipIds(person).length.toString(),
    },
  ];

  const handleSuggestionPress = (suggestion: SuggestionItem) => {
    if (!canEdit) {
      return;
    }

    switch (suggestion.actionTarget.kind) {
      case 'add-relationship':
        onAddRelationship?.();
        return;
      case 'open-profile':
        if (suggestion.actionTarget.initialTab === 'memories-gallery') {
          if (suggestion.actionTarget.initialMemorySectionTab === 'notes') {
            onOpenNotes?.();
            return;
          }

          if (suggestion.actionTarget.initialMemorySectionTab === 'photos') {
            onOpenPhotos?.();
            return;
          }
        }

        onEdit?.();
        return;
      default:
        onEdit?.();
    }
  };

  return (
    <Reveal delay={delay}>
      <SectionCard variant="person" backgroundColor={chrome.primaryCardBackground}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleLarge">{t(K.personProfile.biography)}</Text>
              {onOpenHelperDialog ? (
                <IconButton
                  icon="information-outline"
                  size={20}
                  style={styles.helperIconButton}
                  onPress={onOpenHelperDialog}
                  accessibilityLabel={t(K.personProfile.aboutMemberProfile)}
                />
              ) : null}
            </View>
          </View>
          {canEdit && onEdit ? (
            <Button mode="contained" icon="pencil" onPress={onEdit} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary}>
              {t(K.personProfile.editProfile)}
            </Button>
          ) : null}
        </View>

        <View
          style={[
            styles.spotlightCard,
            {
              backgroundColor: theme.colors.primaryContainer,
              borderColor: theme.colors.primary,
            },
          ]}
        >
          <View style={styles.spotlightTopRow}>
            <View style={styles.spotlightCopy}>
              <Text variant="labelLarge" style={{ color: spotlightSubtextColor }}>
                {t(K.common.summary)}
              </Text>
              <Text variant="headlineSmall" style={{ color: spotlightTextColor }}>
                {t(K.personProfile.profileStrength)}
              </Text>
              <Text variant="bodyMedium" style={{ color: spotlightSubtextColor }}>
                {t(K.personProfile.essentialsRecorded, { filled: completedCount, total: checks.length })}
              </Text>
            </View>
            <View style={styles.spotlightMetricWrap}>
              <Text variant="headlineMedium" style={{ color: spotlightTextColor }}>{Math.round(completionProgress * 100)}%</Text>
              <Text variant="labelMedium" style={[styles.spotlightMetricLabel, { color: spotlightSubtextColor }]}>
                {t(K.common.done)}
              </Text>
            </View>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.dark ? theme.colors.elevation.level2 : '#D5E6DC' }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.colors.primary,
                  width: `${Math.max(0, Math.min(100, Math.round(completionProgress * 100)))}%`,
                },
              ]}
            />
          </View>
          <Text variant="bodyLarge" style={[styles.spotlightToneText, { color: spotlightTextColor }]}>
            {getStrengthTone(completedCount, checks.length, t)}
          </Text>
          {summaryChips.length > 0 ? (
            <View style={styles.spotlightChipRow}>
              {summaryChips.map((chip) => (
                <Chip key={chip.key} compact icon={chip.icon} style={styles.summaryChip}>
                  {chip.label}
                </Chip>
              ))}
            </View>
          ) : null}
          <View style={styles.spotlightStatsRow}>
            {spotlightStats.map((item) => (
              <View
                key={item.key}
                style={[styles.spotlightStatCard, { backgroundColor: chrome.primaryCardBackground, borderColor: theme.colors.primary }]}
              >
                <View style={styles.spotlightStatLabelRow}>
                  <MaterialCommunityIcons name={item.icon as never} size={16} color={theme.colors.primary} />
                  <Text variant="labelMedium" style={[styles.spotlightStatLabel, { color: chrome.subtitle }]}>
                    {item.label}
                  </Text>
                </View>
                <Text variant="titleLarge" style={styles.spotlightStatValue}>{item.value}</Text>
              </View>
            ))}
          </View>
          <View
            style={[
              styles.spotlightConnectionSummary,
              {
                backgroundColor: chrome.primaryCardBackground,
                borderColor: theme.colors.primary,
              },
            ]}
          >
            <Text variant="titleSmall" style={[styles.spotlightConnectionTitle, { color: spotlightTextColor }]}>
              {t(K.personProfile.familyConnections)}
            </Text>
            <Text variant="bodyMedium" style={{ color: chrome.subtitle }}>
              {t(K.personProfile.familyConnectionsSummary, relationshipCounts)}
            </Text>
          </View>

          <View style={[styles.actionPanel, { backgroundColor: chrome.primaryCardBackground, borderColor: theme.colors.primary }]}>
            <View style={styles.actionHeaderRow}>
              <Pressable
                onPress={() => setNextStepsCollapsed((current) => !current)}
                accessibilityRole="button"
                accessibilityState={{ expanded: !nextStepsCollapsed }}
                style={styles.actionHeaderButton}
              >
                <View style={styles.actionHeaderButtonInner}>
                  <View style={[styles.sectionBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                    <MaterialCommunityIcons name="lightning-bolt-outline" size={18} color={theme.colors.primary} />
                  </View>
                  <View style={styles.actionHeaderTextWrap}>
                    <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
                      {t(K.common.steps)}
                    </Text>
                    <Text variant="titleSmall">{t(K.personProfile.suggestedNextSteps)}</Text>
                    <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: chrome.subtitle }]}>
                      {suggestions.length > 0 ? getStrengthTone(completedCount, checks.length, t) : t(K.personProfile.profileLooksStrong)}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={nextStepsCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={22}
                    color={theme.colors.primary}
                    style={styles.actionToggleIcon}
                  />
                </View>
              </Pressable>
              {suggestions.length > 0 ? (
                <Chip compact style={styles.actionCountChip}>
                  {suggestions.length}
                </Chip>
              ) : null}
            </View>
            {!nextStepsCollapsed ? (
              <View style={styles.actionPanelContent}>
                {suggestions.length > 0 ? (
                  suggestions.map((suggestion, index) => (
                    <View
                      key={suggestion.id}
                      style={[
                        styles.nextStepCard,
                        index > 0 ? styles.nextStepCardSpacing : null,
                        { backgroundColor: chrome.secondaryCardBackground, borderColor: chrome.sectionBorder },
                      ]}
                    >
                      <Pressable onPress={() => handleSuggestionPress(suggestion)} accessibilityRole="button">
                        <View style={styles.nextStepRow}>
                          <View style={styles.nextStepContent}>
                            {suggestion.icon ? (
                              <Chip compact icon={suggestion.icon} style={styles.nextStepChip}>
                                {suggestion.title}
                              </Chip>
                            ) : (
                              <Text variant="titleMedium">{suggestion.title}</Text>
                            )}
                            <Text variant="bodyMedium" style={[styles.nextStepBody, { color: theme.colors.onSurfaceVariant }]}>
                              {suggestion.description}
                            </Text>
                          </View>
                          <View style={styles.nextStepActionWrap}>
                            <Button
                              mode="text"
                              onPress={() => handleSuggestionPress(suggestion)}
                              style={BUTTON_CHROME}
                              contentStyle={BUTTON_CONTENT_CHROME}
                            >
                              {suggestion.ctaLabel}
                            </Button>
                          </View>
                        </View>
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: chrome.subtitle }]}>
                    {t(K.personProfile.profileLooksStrong)}
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        </View>

      </SectionCard>
    </Reveal>
  );
}
