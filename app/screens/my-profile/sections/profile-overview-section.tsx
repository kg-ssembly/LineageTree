import React from 'react';
import { View } from 'react-native';
import { Chip, Surface, Text, useTheme } from 'react-native-paper';
import { Reveal } from '../../../../components';
import type { PersonRecord, PersonPhoto } from '../../../../components/dto/person';
import { formatPersonDate, getPersonPresenceLabel, getPersonTreeMembershipIds, isPersonDeceased } from '../../../../components/dto/person';
import { formatPersonGender } from '../../../../components/person-formatting';
import { GlobalStyles } from '../../../../constants/styles';
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
  const biographyLead = [
    linkedPerson.birthDate ? `${formatPersonDate(linkedPerson.birthDate)} marks the beginning of ${linkedPerson.firstName}'s story.` : null,
    linkedPerson.hometown?.trim() ? `Their story is rooted in ${linkedPerson.hometown.trim()}.` : null,
    linkedPerson.familyBranch?.trim() ? `They are part of the ${linkedPerson.familyBranch.trim()} branch.` : null,
    linkedPerson.notes?.trim() ? linkedPerson.notes.trim() : null,
  ].filter(Boolean).join(' ');

  return (
    <Reveal delay={70}>
      <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <Text variant="titleLarge">{t(K.personProfile.biography)}</Text>
      <View style={personProfileStyles.metadataRow}>
        {linkedPerson.gender !== 'unspecified' ? <Chip compact>{formatPersonGender(linkedPerson.gender)}</Chip> : null}
        <Chip compact icon={isPersonDeceased(linkedPerson) ? 'flower-outline' : 'heart-pulse'}>{getPersonPresenceLabel(linkedPerson)}</Chip>
        <Chip compact icon="image-multiple">{t(K.memories.photoGalleryCount, { count: linkedPerson.photos.length })}</Chip>
        <Chip compact icon="source-branch">{t(K.personProfile.treeMemberships)}: {getPersonTreeMembershipIds(linkedPerson).length}</Chip>
        {preferredPhoto ? <Chip compact icon="star">{t(K.personProfile.preferredPhotoSelected)}</Chip> : null}
      </View>
      <Text variant="bodyLarge" style={personProfileStyles.biographyLead}>
        {biographyLead || t(K.personProfile.waitingForFirstStory, { name: linkedPerson.firstName })}
      </Text>

      <View style={[personProfileStyles.biographyBlock, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Text variant="titleSmall">{t(K.personProfile.storyDetails)}</Text>
        <View style={personProfileStyles.biographyFactRow}>
          <View style={[personProfileStyles.biographyFactCard, { backgroundColor: theme.colors.surface }]}>
            <Text variant="labelMedium" style={personProfileStyles.detailLabel}>{t(K.personProfile.born)}</Text>
            <Text variant="titleMedium">{linkedPerson.birthDate ? formatPersonDate(linkedPerson.birthDate) : t(K.common.unknown)}</Text>
          </View>
          <View style={[personProfileStyles.biographyFactCard, { backgroundColor: theme.colors.surface }]}>
            <Text variant="labelMedium" style={personProfileStyles.detailLabel}>{t(K.personProfile.surnameStory)}</Text>
            <Text variant="titleMedium">{linkedPerson.maidenName?.trim() || linkedPerson.lastName || t(K.common.unknown)}</Text>
          </View>
          <View style={[personProfileStyles.biographyFactCard, { backgroundColor: theme.colors.surface }]}>
            <Text variant="labelMedium" style={personProfileStyles.detailLabel}>{t(K.personProfile.belongsTo)}</Text>
            <Text variant="titleMedium">{linkedPerson.familyBranch?.trim() || t(K.personProfile.currentTreeOnly)}</Text>
          </View>
        </View>
      </View>

      <View style={[personProfileStyles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="titleSmall">{t(K.personProfile.storyNote)}</Text>
        <Text variant="bodyMedium" style={[personProfileStyles.notesText, { color: theme.colors.onSurfaceVariant }]}>
          {linkedPerson.notes || t(K.personProfile.addRealDetail)}
        </Text>
      </View>
      </Surface>
    </Reveal>
  );
}
