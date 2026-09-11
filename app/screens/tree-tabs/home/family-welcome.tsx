import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar, Button, Icon, Text, useTheme } from 'react-native-paper';
import { CachedImage, Reveal, SectionCard } from '../../../../components';
import { formatPersonName } from '../../../../components/person-formatting';
import { getDisplayPersonPhoto } from '../../../../components/dto/person';
import { useI18n } from '../../../../hooks/use-i18n';
import type { SharedTabProps } from '../shared';

export function FamilyWelcome(props: SharedTabProps & { onOpenActivity: () => void }) {
  const { people, selectedTree, currentUserLabel, currentAssignedPerson, openPersonProfile, onOpenActivity } = props;
  const theme = useTheme();
  const { t } = useI18n();
  const memories = people.flatMap(person => person.photos.map(photo => ({ person, photo })))
    .sort((a, b) => b.photo.createdAt.localeCompare(a.photo.createdAt)).slice(0, 6);
  const recentPeople = [...people].sort((a, b) => Number(!!getDisplayPersonPhoto(b)) - Number(!!getDisplayPersonPhoto(a)) || b.createdAt.localeCompare(a.createdAt)).slice(0, 7);
  const knownPeople = useRef<Set<string> | null>(null);
  const [welcomeName, setWelcomeName] = useState('');
  useEffect(() => { knownPeople.current = null; setWelcomeName(''); }, [selectedTree.id]);
  useEffect(() => {
    if (props.loadingTreeData) return;
    const added = knownPeople.current ? people.find(person => !knownPeople.current!.has(person.id)) : null;
    knownPeople.current = new Set(people.map(person => person.id));
    if (added) setWelcomeName(formatPersonName(added));
  }, [people, props.loadingTreeData, selectedTree.id]);
  useEffect(() => { if (!welcomeName) return; const timer = setTimeout(() => setWelcomeName(''), 6000); return () => clearTimeout(timer); }, [welcomeName]);
  return <View style={{ gap: 32, marginBottom: 24 }}>
    {welcomeName ? <Reveal distance={6}><Text accessibilityLiveRegion="polite" style={{ padding: 16, borderRadius: 16, backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface }}>{t('Our family story has grown')} · {welcomeName}</Text></Reveal> : null}
    <Reveal distance={8}>
      <View style={{ paddingVertical: 20, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>{selectedTree.name}</Text></View>
        <Text variant="headlineLarge" style={{ color: theme.colors.onSurface }}>{t('Welcome home')}, {currentUserLabel.split(' ')[0]}.</Text>
        <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>{t('A place to keep our stories and feel a little closer.')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Button mode="contained" icon="image-plus" onPress={() => currentAssignedPerson ? openPersonProfile(currentAssignedPerson, { initialTab: 'memories-gallery', initialMemorySectionTab: 'photos' }) : props.onOpenAddSelf()}>{t('Add a family memory')}</Button>
          <Button mode="text" icon="bell-outline" onPress={onOpenActivity}>{t('Family updates')}</Button>
        </View>
      </View>
    </Reveal>
    {recentPeople.length ? <View style={{ gap: 12 }}>
      <Text variant="titleLarge">{t('Our people')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 4 }}>
        {recentPeople.map((person) => {
          const photo = getDisplayPersonPhoto(person);
          return <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={formatPersonName(person)} onPress={() => openPersonProfile(person)} style={{ width: 92, alignItems: 'center', gap: 8 }}>
            {photo ? <CachedImage uri={photo.url} style={{ width: 76, height: 76, borderRadius: 38 }} /> : <Avatar.Text size={76} label={`${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`} style={{ backgroundColor: theme.colors.surfaceVariant }} color={theme.colors.onSurfaceVariant} />}
            <Text numberOfLines={2} variant="labelLarge" style={{ textAlign: 'center' }}>{person.firstName}</Text>
          </Pressable>;
        })}
      </ScrollView>
    </View> : null}
    <View style={{ gap: 12 }}>
      <Text variant="titleLarge">{t('Pages from our family story')}</Text>
      {memories.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 8 }}>
        {memories.map(({ person, photo }) => <Pressable key={`${person.id}-${photo.id}`} accessibilityRole="button" accessibilityLabel={`${t('View memories')}: ${formatPersonName(person)}`} onPress={() => openPersonProfile(person, { initialTab: 'memories-gallery', initialMemorySectionTab: 'photos' })} style={{ width: 272, gap: 10 }}>
          <CachedImage uri={photo.url} style={{ height: 230, width: '100%', borderRadius: 8 }} />
          <Text numberOfLines={2} variant="titleSmall">{photo.description || t('A moment worth remembering')}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{formatPersonName(person)}</Text>
        </Pressable>)}
      </ScrollView> : <SectionCard style={{ backgroundColor: theme.colors.surface, borderRadius: 22, padding: 20, gap: 8 }}><Icon source="image-album" size={32} color={theme.colors.onSurfaceVariant} /><Text variant="titleMedium">{t('Every family album starts with one memory')}</Text><Text>{t('Bring an old photograph or a favourite story. There is room for both here.')}</Text></SectionCard>}
    </View>
    <View style={{ paddingVertical: 24, borderTopWidth: 1, borderColor: theme.colors.outlineVariant, gap: 12 }}>
      <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>{t('Around the family table')}</Text>
      <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>{t('What is a family tradition you hope we never forget?')}</Text>
      <Button mode="outlined" style={{ alignSelf: 'flex-start' }} onPress={() => currentAssignedPerson ? openPersonProfile(currentAssignedPerson, { initialTab: 'memories-gallery', initialMemorySectionTab: 'notes' }) : props.onOpenAddSelf()}>{t('Tell your story')}</Button>
    </View>
  </View>;
}
