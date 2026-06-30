import React from 'react';
import { View } from 'react-native';
import { Button, Chip, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { Reveal } from '../../../../components';
import type { PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import { formatPersonDate, getPersonPresenceLabel, getPersonTreeMembershipIds, isPersonDeceased } from '../../../../components/dto/person';
import { formatPersonGender, formatPersonName } from '../../../../components/person-formatting';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const styles = GlobalStyles.personProfile;

export function MemberProfileSection({
  person,
  preferredPhoto,
  canEdit,
  linkedCollaboratorLabel,
  isCurrentUsersPerson,
  onOpenHelperDialog,
  onEdit,
}: {
  person: PersonRecord;
  preferredPhoto: PersonPhoto | null | undefined;
  canEdit: boolean;
  linkedCollaboratorLabel: string | null;
  isCurrentUsersPerson: boolean;
  onOpenHelperDialog: () => void;
  onEdit: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const biographyLead = [
    person.birthDate ? `${formatPersonName(person)} was born on ${formatPersonDate(person.birthDate)}.` : null,
    person.birthPlace?.trim() ? `Their story begins in ${person.birthPlace.trim()}.` : null,
    person.hometown?.trim() ? `${person.hometown.trim()} helped shape their journey.` : null,
    person.notes?.trim() ? person.notes.trim() : null,
  ].filter(Boolean).join(' ');

  return (
    <Reveal delay={90}>
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <View style={styles.titleWithHelperRow}>
            <Text variant="titleLarge">Biography</Text>
            <IconButton
              icon="information-outline"
              size={20}
              style={styles.helperIconButton}
              onPress={onOpenHelperDialog}
              accessibilityLabel={t(K.personProfile.aboutMemberProfile)}
            />
          </View>
        </View>
        {canEdit ? (
          <Button mode="contained-tonal" icon="pencil" onPress={onEdit}>
            Shape this story
          </Button>
        ) : null}
      </View>

      <View style={styles.metadataRow}>
        {person.gender !== 'unspecified' ? <Chip compact>{formatPersonGender(person.gender)}</Chip> : null}
        <Chip compact icon={isPersonDeceased(person) ? 'flower-outline' : 'heart-pulse'}>{getPersonPresenceLabel(person)}</Chip>
        <Chip compact icon="image-multiple">{t(K.memories.photoGalleryCount, { count: person.photos.length })}</Chip>
        <Chip compact icon="source-branch">{t(K.personProfile.treeMemberships)}: {getPersonTreeMembershipIds(person).length}</Chip>
        {preferredPhoto ? <Chip compact icon="star">{t(K.personProfile.preferredPhotoSelected)}</Chip> : null}
        {linkedCollaboratorLabel && !isCurrentUsersPerson ? <Chip compact icon="link-variant">{t(K.common.linked)}</Chip> : null}
        {person.canonicalPersonId?.trim() ? <Chip compact icon="merge">{t(K.personProfile.mergedCanonicalProfile)}</Chip> : null}
      </View>
      <Text variant="bodyLarge" style={styles.biographyLead}>
        {biographyLead || `${formatPersonName(person)}'s page is waiting for the first story fragment, place, or memory to give it more voice.`}
      </Text>

      <View style={[styles.biographyBlock, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Text variant="titleSmall">Known details</Text>
        <View style={styles.biographyFactRow}>
          <View style={[styles.biographyFactCard, { backgroundColor: theme.colors.surface }]}>
            <Text variant="labelMedium" style={styles.detailLabel}>Born</Text>
            <Text variant="titleMedium">{person.birthDate ? formatPersonDate(person.birthDate) : t(K.common.unknown)}</Text>
          </View>
          <View style={[styles.biographyFactCard, { backgroundColor: theme.colors.surface }]}>
            <Text variant="labelMedium" style={styles.detailLabel}>Name trail</Text>
            <Text variant="titleMedium">{person.maidenName?.trim() || person.lastName || t(K.common.unknown)}</Text>
          </View>
          <View style={[styles.biographyFactCard, { backgroundColor: theme.colors.surface }]}>
            <Text variant="labelMedium" style={styles.detailLabel}>Family circle</Text>
            <Text variant="titleMedium">{getPersonTreeMembershipIds(person).join(', ') || t(K.personProfile.currentTreeOnly)}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="titleSmall">Story note</Text>
        <Text variant="bodyMedium" style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}>
          {person.notes || t('Add a memory, phrase, or detail that makes this person feel real.')}
        </Text>
      </View>
      </Surface>
    </Reveal>
  );
}
