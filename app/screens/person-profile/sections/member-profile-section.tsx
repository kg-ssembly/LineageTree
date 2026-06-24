import React from 'react';
import { View } from 'react-native';
import { Button, Chip, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import type { PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import { formatPersonDate, getPersonPresenceLabel, getPersonTreeMembershipIds, isPersonDeceased } from '../../../../components/dto/person';
import { formatPersonGender } from '../../../../components/person-formatting';
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

  return (
    <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <View style={styles.titleWithHelperRow}>
            <Text variant="titleLarge">{t(K.personProfile.memberProfile)}</Text>
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
            {t('Edit family member')}
          </Button>
        ) : null}
      </View>

      <View style={styles.metadataRow}>
        {person.gender !== 'unspecified' ? <Chip compact>{formatPersonGender(person.gender)}</Chip> : null}
        <Chip compact icon={isPersonDeceased(person) ? 'flower-outline' : 'heart-pulse'}>{getPersonPresenceLabel(person)}</Chip>
        <Chip compact icon="image-multiple">{t('{count} photos', { count: person.photos.length })}</Chip>
        <Chip compact icon="source-branch">{t('{count} tree memberships', { count: getPersonTreeMembershipIds(person).length })}</Chip>
        {preferredPhoto ? <Chip compact icon="star">{t('Preferred photo selected')}</Chip> : null}
        {linkedCollaboratorLabel && !isCurrentUsersPerson ? <Chip compact icon="link-variant">{t('Linked')}</Chip> : null}
        {person.canonicalPersonId?.trim() ? <Chip compact icon="merge">{t('Merged canonical profile')}</Chip> : null}
      </View>

      <View style={styles.detailGrid}>
        <View style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('First name')}</Text>
          <Text variant="titleMedium">{person.firstName || t('Unknown')}</Text>
        </View>
        {person.middleNames?.trim() ? (
          <View style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
            <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('Second / middle names')}</Text>
            <Text variant="titleMedium">{person.middleNames.trim()}</Text>
          </View>
        ) : null}
        <View style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t(K.personForm.lastName)}</Text>
          <Text variant="titleMedium">{person.lastName || t('Unknown')}</Text>
        </View>
        {person.maidenName?.trim() ? (
          <View style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
            <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t(K.personForm.maidenName)}</Text>
            <Text variant="titleMedium">{person.maidenName.trim()}</Text>
          </View>
        ) : null}
        <View style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t(K.personForm.birthDate)}</Text>
          <Text variant="titleMedium">{person.birthDate ? formatPersonDate(person.birthDate) : t('Unknown')}</Text>
        </View>
        <View style={[styles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Text variant="labelMedium" style={[styles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t(K.personProfile.treeMemberships)}</Text>
          <Text variant="titleMedium">{getPersonTreeMembershipIds(person).join(', ') || t('Current tree only')}</Text>
        </View>
      </View>

      <View style={[styles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="titleSmall">{t('Notes')}</Text>
        <Text variant="bodyMedium" style={[styles.notesText, { color: theme.colors.onSurfaceVariant }]}>
          {person.notes || t('No notes added yet.')}
        </Text>
      </View>
    </Surface>
  );
}
