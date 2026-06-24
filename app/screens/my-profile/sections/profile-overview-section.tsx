import React from 'react';
import { View } from 'react-native';
import { Chip, Surface, Text, useTheme } from 'react-native-paper';
import type { PersonRecord, PersonPhoto } from '../../../../components/dto/person';
import { formatPersonDate, getPersonPresenceLabel, getPersonTreeMembershipIds, isPersonDeceased } from '../../../../components/dto/person';
import { formatPersonGender } from '../../../../components/person-formatting';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';

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

  return (
    <Surface style={[personProfileStyles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
      <Text variant="titleLarge">{t('Profile')}</Text>
      <View style={personProfileStyles.metadataRow}>
        {linkedPerson.gender !== 'unspecified' ? <Chip compact>{formatPersonGender(linkedPerson.gender)}</Chip> : null}
        <Chip compact icon={isPersonDeceased(linkedPerson) ? 'flower-outline' : 'heart-pulse'}>{getPersonPresenceLabel(linkedPerson)}</Chip>
        <Chip compact icon="image-multiple">{t('{count} photos', { count: linkedPerson.photos.length })}</Chip>
        <Chip compact icon="source-branch">{t('{count} tree memberships', { count: getPersonTreeMembershipIds(linkedPerson).length })}</Chip>
        {preferredPhoto ? <Chip compact icon="star">{t('Preferred photo selected')}</Chip> : null}
      </View>

      <View style={personProfileStyles.detailGrid}>
        <View style={[personProfileStyles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('First name')}</Text>
          <Text variant="titleMedium">{linkedPerson.firstName || t('Unknown')}</Text>
        </View>
        {linkedPerson.middleNames?.trim() ? (
          <View style={[personProfileStyles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
            <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('Second / middle names')}</Text>
            <Text variant="titleMedium">{linkedPerson.middleNames.trim()}</Text>
          </View>
        ) : null}
        <View style={[personProfileStyles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('Last name')}</Text>
          <Text variant="titleMedium">{linkedPerson.lastName || t('Unknown')}</Text>
        </View>
        {linkedPerson.maidenName?.trim() ? (
          <View style={[personProfileStyles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
            <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('Maiden name')}</Text>
            <Text variant="titleMedium">{linkedPerson.maidenName.trim()}</Text>
          </View>
        ) : null}
        <View style={[personProfileStyles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('Birth date')}</Text>
          <Text variant="titleMedium">{linkedPerson.birthDate ? formatPersonDate(linkedPerson.birthDate) : t('Unknown')}</Text>
        </View>
        <View style={[personProfileStyles.detailCard, { backgroundColor: theme.colors.elevation.level1 }]}>
          <Text variant="labelMedium" style={[personProfileStyles.detailLabel, { color: theme.colors.onSurfaceVariant }]}>{t('Tree memberships')}</Text>
          <Text variant="titleMedium">{getPersonTreeMembershipIds(linkedPerson).join(', ') || t('Current tree only')}</Text>
        </View>
      </View>

      <View style={[personProfileStyles.notesBox, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="titleSmall">{t('Notes')}</Text>
        <Text variant="bodyMedium" style={[personProfileStyles.notesText, { color: theme.colors.onSurfaceVariant }]}>
          {linkedPerson.notes || t('No notes added yet.')}
        </Text>
      </View>
    </Surface>
  );
}
