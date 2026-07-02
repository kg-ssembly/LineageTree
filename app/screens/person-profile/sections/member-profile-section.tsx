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
            <Text variant="titleLarge">{t(K.personProfile.biography)}</Text>
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
          <Button mode="contained" icon="pencil" onPress={onEdit} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary}>
            {t(K.personProfile.shapeThisStory)}
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
        {biographyLead || t(K.personProfile.waitingForFirstStory, { name: formatPersonName(person) })}
      </Text>

      <View style={[styles.biographyBlock, { backgroundColor: theme.colors.elevation.level1 }]}>
        <Text variant="titleSmall">{t(K.personProfile.knownDetails)}</Text>
        <View style={styles.biographyFactRow}>
          <View style={[styles.biographyFactCard, { backgroundColor: theme.colors.surface }]}>
            <Text variant="labelMedium" style={styles.detailLabel}>{t(K.personProfile.born)}</Text>
            <Text variant="titleMedium">{person.birthDate ? formatPersonDate(person.birthDate) : t(K.common.unknown)}</Text>
          </View>
          <View style={[styles.biographyFactCard, { backgroundColor: theme.colors.surface }]}>
            <Text variant="labelMedium" style={styles.detailLabel}>{t(K.personProfile.nameTrail)}</Text>
            <Text variant="titleMedium">{person.maidenName?.trim() || person.lastName || t(K.common.unknown)}</Text>
          </View>
          <View style={[styles.biographyFactCard, { backgroundColor: theme.colors.surface }]}>
            <Text variant="labelMedium" style={styles.detailLabel}>{t(K.personProfile.familyCircle)}</Text>
            <Text variant="titleMedium">{getPersonTreeMembershipIds(person).join(', ') || t(K.personProfile.currentTreeOnly)}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="titleSmall">{t(K.personProfile.storyNote)}</Text>
        <Text variant="bodyMedium" style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}>
          {person.notes || t(K.personProfile.addRealDetail)}
        </Text>
      </View>
      </Surface>
    </Reveal>
  );
}
