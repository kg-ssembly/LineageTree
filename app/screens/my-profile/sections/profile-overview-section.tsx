import React from 'react';
import { View } from 'react-native';
import { Chip, Surface, Text, useTheme } from 'react-native-paper';
import { Reveal } from '../../../../components';
import type { PersonRecord, PersonPhoto } from '../../../../components/dto/person';
import { formatPersonDate, getPersonPresenceLabel, getPersonTreeMembershipIds, isPersonDeceased } from '../../../../components/dto/person';
import { formatPersonGender } from '../../../../components/person-formatting';
import { getThemeChrome, GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const personProfileStyles = GlobalStyles.personProfile;

export function ProfileOverviewSection({
  linkedPerson,
  preferredPhoto,
}: {
  linkedPerson: PersonRecord;
  preferredPhoto: PersonPhoto | null | undefined;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const chrome = getThemeChrome(theme);
  const biographyLead = [
    linkedPerson.birthDate ? t(K.personProfile.biographyBornOnDate, { name: linkedPerson.firstName, date: formatPersonDate(linkedPerson.birthDate) }) : null,
    linkedPerson.hometown?.trim() ? t(K.personProfile.biographyStoryRootedIn, { place: linkedPerson.hometown.trim() }) : null,
    linkedPerson.familyBranch?.trim() ? t(K.personProfile.biographyPartOfBranch, { branch: linkedPerson.familyBranch.trim() }) : null,
    linkedPerson.notes?.trim() ? linkedPerson.notes.trim() : null,
  ].filter(Boolean).join(' ');

  return (
    <Reveal delay={70}>
      <Surface style={[personProfileStyles.sectionCard, { backgroundColor: chrome.primaryCardBackground }]} elevation={1}>
        <Text variant="titleLarge">{t(K.personProfile.biography)}</Text>
        <View style={personProfileStyles.metadataRow}>
          {linkedPerson.gender !== 'unspecified' ? <Chip compact>{formatPersonGender(linkedPerson.gender)}</Chip> : null}
          <Chip compact icon={isPersonDeceased(linkedPerson) ? 'flower-outline' : 'heart-pulse'}>{getPersonPresenceLabel(linkedPerson)}</Chip>
          <Chip compact icon="image-multiple">{t(K.memories.photoGalleryCount, { count: linkedPerson.photos.length })}</Chip>
          <Chip compact icon="source-branch">{t(K.personProfile.treeMemberships)}: {getPersonTreeMembershipIds(linkedPerson).length}</Chip>
          {preferredPhoto ? <Chip compact icon="star">{t(K.personProfile.preferredPhotoSelected)}</Chip> : null}
        </View>
        <Text variant="bodyLarge" style={[personProfileStyles.biographyLead, { color: chrome.noteText }]}>
          {biographyLead || t(K.personProfile.waitingForFirstStory, { name: linkedPerson.firstName })}
        </Text>

        <View style={[personProfileStyles.biographyBlock, { backgroundColor: chrome.secondaryCardBackground, borderColor: chrome.sectionBorder }]}>
          <Text variant="titleSmall">{t(K.personProfile.storyDetails)}</Text>
          <View style={personProfileStyles.biographyFactRow}>
            <View style={[personProfileStyles.biographyFactCard, { backgroundColor: chrome.primaryCardBackground, borderColor: chrome.sectionBorder }]}>
              <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: chrome.subtitle }]}>{t(K.personProfile.born)}</Text>
              <Text variant="titleMedium">{linkedPerson.birthDate ? formatPersonDate(linkedPerson.birthDate) : t(K.common.unknown)}</Text>
            </View>
            <View style={[personProfileStyles.biographyFactCard, { backgroundColor: chrome.primaryCardBackground, borderColor: chrome.sectionBorder }]}>
              <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: chrome.subtitle }]}>{t(K.personProfile.surnameStory)}</Text>
              <Text variant="titleMedium">{linkedPerson.maidenName?.trim() || linkedPerson.lastName || t(K.common.unknown)}</Text>
            </View>
            <View style={[personProfileStyles.biographyFactCard, { backgroundColor: chrome.primaryCardBackground, borderColor: chrome.sectionBorder }]}>
              <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: chrome.subtitle }]}>{t(K.personProfile.belongsTo)}</Text>
              <Text variant="titleMedium">{linkedPerson.familyBranch?.trim() || t(K.personProfile.currentTreeOnly)}</Text>
            </View>
          </View>
        </View>

        <View style={[personProfileStyles.notesBox, { backgroundColor: chrome.hintBackground }]}>
          <Text variant="titleSmall">{t(K.personProfile.storyNote)}</Text>
          <Text variant="bodyMedium" style={[personProfileStyles.notesText, { color: chrome.subtitle }]}>
            {linkedPerson.notes || t(K.personProfile.addRealDetail)}
          </Text>
        </View>
      </Surface>
    </Reveal>
  );
}
