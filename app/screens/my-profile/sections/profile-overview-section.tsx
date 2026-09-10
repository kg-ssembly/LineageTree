import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { SectionCard } from '../../../../components';
import { formatPersonDate } from '../../../../components/dto/person';
import { useI18n } from '../../../../hooks/use-i18n';
import { getFamilyMemberCardStyle } from '../../profile-shared/profile-card-shared';
import type { PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import type { RelationshipRecord } from '../../../../components/dto/relationship';
import { ProfileOverviewCard } from '../../profile-shared/profile-overview-card';

export function ProfileOverviewSection({
  linkedPerson,
  preferredPhoto,
  relationships,
  canEdit,
  onEdit,
  onOpenPhotos,
  onOpenNotes,
  onAddRelationship,
}: {
  linkedPerson: PersonRecord;
  preferredPhoto: PersonPhoto | null | undefined;
  relationships: RelationshipRecord[];
  canEdit: boolean;
  onEdit: () => void;
  onOpenPhotos: () => void;
  onOpenNotes: () => void;
  onAddRelationship: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [showSuggestions, setShowSuggestions] = useState(false);
  return (<>
    <SectionCard variant="person" style={[getFamilyMemberCardStyle(theme), { gap: 16 }]}>
      <Text variant="titleLarge">{t('About')}</Text>
      {[['Birth date', formatPersonDate(linkedPerson.birthDate)], ['Place of origin', linkedPerson.birthPlace], ['Hometown', linkedPerson.hometown], ['Maiden name', linkedPerson.maidenName], ...(linkedPerson.deathDate ? [['Death date', formatPersonDate(linkedPerson.deathDate)]] : [])].filter(([, value]) => !!value).map(([label, value]) => <View key={label} style={{ gap: 4 }}><Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>{t(label ?? '')}</Text><Text variant="bodyLarge">{value}</Text></View>)}
      <Text variant="titleMedium">{t('Biography')}</Text>
      <Text>{linkedPerson.notes || t('Add a few words about your story using Edit profile.')}</Text>
      <Button icon={showSuggestions ? 'chevron-up' : 'chevron-down'} style={{ alignSelf: 'flex-start' }} onPress={() => setShowSuggestions(value => !value)}>{t('Profile completeness & suggestions')}</Button>
    </SectionCard>
    {showSuggestions ? <ProfileOverviewCard
      person={linkedPerson}
      preferredPhoto={preferredPhoto}
      relationships={relationships}
      canEdit={canEdit}
      onEdit={onEdit}
      onOpenPhotos={onOpenPhotos}
      onOpenNotes={onOpenNotes}
      onAddRelationship={onAddRelationship}
      delay={70}
    /> : null}
  </>);
}
