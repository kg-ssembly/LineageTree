import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import { Reveal, SectionCard, SuggestionList, type SuggestionItem } from '../../../components';
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
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
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
  const theme = useTheme();
  const { t } = useI18n();
  const chrome = getThemeChrome(theme);
  const relationshipCounts = getPersonRelationshipCounts(person.id, relationships);
  const { checks } = getProfileCompletionChecks(person, relationships);
  const completedCount = checks.filter(Boolean).length;
  const suggestions = buildProfileSuggestions(person, relationships, t);

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

        <View style={styles.metadataRow}>
          {person.gender !== 'unspecified' ? <Chip compact>{formatPersonGender(person.gender)}</Chip> : null}
          <Chip compact icon={isPersonDeceased(person) ? 'flower-outline' : 'heart-pulse'}>{getPersonPresenceLabel(person)}</Chip>
          <Chip compact icon="image-multiple">{t(K.memories.photoGalleryCount, { count: person.photos.length })}</Chip>
          <Chip compact icon="family-tree">{t(K.personProfile.familyLinksCount, { count: relationshipCounts.parents + relationshipCounts.partners + relationshipCounts.children })}</Chip>
          <Chip compact icon="source-branch">{t(K.personProfile.treeMemberships)}: {getPersonTreeMembershipIds(person).length}</Chip>
          {preferredPhoto ? <Chip compact icon="star">{t(K.personProfile.preferredPhotoSelected)}</Chip> : null}
          {linkedCollaboratorLabel && !isCurrentUsersPerson ? <Chip compact icon="link-variant">{t(K.common.linked)}</Chip> : null}
          {person.canonicalPersonId?.trim() ? <Chip compact icon="merge">{t(K.personProfile.mergedCanonicalProfile)}</Chip> : null}
        </View>

        <Text variant="bodyLarge" style={[styles.biographyLead, { color: chrome.noteText }]}>
          {getStrengthTone(completedCount, checks.length, t)}
        </Text>

        <View style={[styles.biographyBlock, { backgroundColor: chrome.secondaryCardBackground, borderColor: chrome.sectionBorder }]}>
          <Text variant="titleSmall">{t(K.personProfile.profileStrength)}</Text>
          <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: chrome.subtitle }]}>
            {t(K.personProfile.essentialsRecorded, { filled: completedCount, total: checks.length })}
          </Text>
          <View style={styles.biographyFactRow}>
            <View style={[styles.biographyFactCard, { backgroundColor: chrome.primaryCardBackground, borderColor: chrome.sectionBorder }]}>
              <Text variant="labelMedium" style={[styles.detailLabel, { color: chrome.subtitle }]}>{t(K.personProfile.birth)}</Text>
              <Text variant="titleMedium">{person.birthDate ? formatPersonDate(person.birthDate) : t(K.common.unknown)}</Text>
            </View>
            <View style={[styles.biographyFactCard, { backgroundColor: chrome.primaryCardBackground, borderColor: chrome.sectionBorder }]}>
              <Text variant="labelMedium" style={[styles.detailLabel, { color: chrome.subtitle }]}>{t(K.personProfile.birthPlace)}</Text>
              <Text variant="titleMedium">{person.birthPlace?.trim() || t(K.common.unknown)}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.biographyBlock, { backgroundColor: chrome.secondaryCardBackground, borderColor: chrome.sectionBorder }]}>
          <Text variant="titleSmall">{t(K.personProfile.familyConnections)}</Text>
          <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: chrome.subtitle }]}>
            {t(K.personProfile.familyConnectionsSummary, relationshipCounts)}
          </Text>
          <View style={styles.biographyFactRow}>
            <View style={[styles.biographyFactCard, { backgroundColor: chrome.primaryCardBackground, borderColor: chrome.sectionBorder }]}>
              <Text variant="labelMedium" style={[styles.detailLabel, { color: chrome.subtitle }]}>{t(K.personProfile.parents)}</Text>
              <Text variant="titleMedium">{relationshipCounts.parents}</Text>
            </View>
            <View style={[styles.biographyFactCard, { backgroundColor: chrome.primaryCardBackground, borderColor: chrome.sectionBorder }]}>
              <Text variant="labelMedium" style={[styles.detailLabel, { color: chrome.subtitle }]}>{t(K.personProfile.partners)}</Text>
              <Text variant="titleMedium">{relationshipCounts.partners}</Text>
            </View>
            <View style={[styles.biographyFactCard, { backgroundColor: chrome.primaryCardBackground, borderColor: chrome.sectionBorder }]}>
              <Text variant="labelMedium" style={[styles.detailLabel, { color: chrome.subtitle }]}>{t(K.personProfile.children)}</Text>
              <Text variant="titleMedium">{relationshipCounts.children}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.biographyBlock, { backgroundColor: chrome.secondaryCardBackground, borderColor: chrome.sectionBorder }]}>
          <Text variant="titleSmall">{t(K.personProfile.suggestedNextSteps)}</Text>
          {suggestions.length > 0 ? (
            <SuggestionList
              suggestions={suggestions}
              onPressSuggestion={handleSuggestionPress}
              variant="profile"
              getCardColors={() => ({
                backgroundColor: chrome.primaryCardBackground,
                borderColor: chrome.sectionBorder,
              })}
              getActionMode={() => 'text'}
            />
          ) : (
            <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: chrome.subtitle }]}>
              {t(K.personProfile.profileLooksStrong)}
            </Text>
          )}
        </View>

        <View style={[styles.notesBox, { backgroundColor: chrome.hintBackground }]}>
          <Text variant="titleSmall">{t(K.personProfile.storyNote)}</Text>
          <Text variant="bodyMedium" style={[styles.notesText, { color: chrome.subtitle }]}>
            {person.notes?.trim() || t(K.personProfile.addRealDetail)}
          </Text>
        </View>
      </SectionCard>
    </Reveal>
  );
}
