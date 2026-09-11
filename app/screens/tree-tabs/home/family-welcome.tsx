import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Avatar, Button, Icon, Text, useTheme } from 'react-native-paper';
import { CachedImage, Reveal, SectionCard } from '../../../../components';
import { formatPersonName } from '../../../../components/person-formatting';
import { getDisplayPersonPhoto } from '../../../../components/dto/person';
import { useI18n } from '../../../../hooks/use-i18n';
import type { SharedTabProps } from '../shared';

export function FamilyWelcome(props: SharedTabProps & { onOpenOccasions: () => void }) {
  const { people, selectedTree, currentUserLabel, currentAssignedPerson, openPersonProfile } = props;
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
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
  const openMemory = (section: 'photos' | 'notes') => currentAssignedPerson
    ? openPersonProfile(currentAssignedPerson, { initialTab: 'memories-gallery', initialMemorySectionTab: section })
    : props.onOpenAddSelf();
  const portrait = currentAssignedPerson ? getDisplayPersonPhoto(currentAssignedPerson) : null;
  const quickEntries = [
    { icon: 'notebook-outline', title: t('A story to keep'), description: t('What family tradition do you hope we never forget?'), label: t('Write a memory'), action: () => openMemory('notes') },
    { icon: 'calendar-heart', title: t('Days that matter'), description: t('Birthdays, anniversaries and the moments we share.'), label: t('Family occasions'), action: props.onOpenOccasions },
  ];
  return <View style={{ gap: 24, marginBottom: 24 }}>
    {welcomeName ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.primary }}>{t('Our family story has grown')} · {welcomeName}</Text> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{selectedTree.name} · {t('Our family journal')}</Text>
        <Text variant="headlineLarge">{t('Hi')}, {currentUserLabel.split(' ')[0]}</Text>
      </View>
      {currentAssignedPerson ? <Pressable accessibilityRole="button" accessibilityLabel={t('Open my family profile')} onPress={() => openPersonProfile(currentAssignedPerson)}>
        {portrait ? <CachedImage uri={portrait.url} style={{ width: 48, height: 48, borderRadius: 24 }} /> : <Avatar.Text size={48} label={currentUserLabel.slice(0, 1)} style={{ backgroundColor: theme.colors.primaryContainer }} color={theme.colors.onPrimaryContainer} />}
      </Pressable> : null}
    </View>
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'stretch' }}>
      <View style={{ flex: wide ? 1.35 : undefined, minWidth: 0, gap: 12 }}>
        <Text variant="titleLarge">{t('Our journal')}</Text>
        <Reveal distance={6}>
          <SectionCard elevation={0} backgroundColor={theme.colors.primaryContainer} style={{ borderRadius: 28, padding: 24, gap: 14, overflow: 'hidden', minHeight: 270 }}>
            <Text variant="labelLarge" style={{ color: theme.colors.primary }}>{t('A little moment, a lasting memory')}</Text>
            <Text variant="headlineMedium" style={{ color: theme.colors.onPrimaryContainer, maxWidth: 380 }}>{t('There is a story only you can tell.')}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, maxWidth: 360 }}>{t('An old photograph. A favourite day. Keep a piece of your family story here.')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Button mode="contained" icon="image-plus" onPress={() => openMemory('photos')} style={{ flexShrink: 1 }}>{t('Add a memory')}</Button>
              <View accessible={false}><Icon source="tree-outline" size={72} color={theme.colors.primary} /></View>
            </View>
          </SectionCard>
        </Reveal>
      </View>
      <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 12 }}>
        <Text variant="titleLarge">{t('A little inspiration')}</Text>
        <ScrollView horizontal={!wide} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {quickEntries.map(entry => <Pressable key={entry.icon} accessibilityRole="button" accessibilityLabel={entry.label} onPress={entry.action} style={{ width: wide ? '100%' : 206 }}>
            <SectionCard elevation={0} backgroundColor={theme.colors.surface} style={{ borderRadius: 20, padding: 16, gap: 8, minHeight: wide ? 104 : 180, borderWidth: 1, borderColor: theme.colors.outlineVariant }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon source={entry.icon} size={20} color={theme.colors.primary} /><Text variant="titleSmall">{entry.title}</Text></View>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{entry.description}</Text>
              <Text variant="labelMedium" style={{ color: theme.colors.primary }}>{entry.label} →</Text>
            </SectionCard>
          </Pressable>)}
        </ScrollView>
      </View>
    </View>
    <View style={{ gap: 12 }}>
      <Text variant="titleLarge">{t('From the family album')}</Text>
      {memories.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 4 }}>
        {memories.map(({ person, photo }) => <Pressable key={`${person.id}-${photo.id}`} accessibilityRole="button" accessibilityLabel={`${t('View memories')}: ${formatPersonName(person)}`} onPress={() => openPersonProfile(person, { initialTab: 'memories-gallery', initialMemorySectionTab: 'photos' })} style={{ width: wide ? 260 : 220, gap: 8 }}>
          <CachedImage uri={photo.url} style={{ height: 190, width: '100%', borderRadius: 20 }} />
          <Text numberOfLines={2} variant="titleSmall">{photo.description || t('A moment worth remembering')}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{formatPersonName(person)}</Text>
        </Pressable>)}
      </ScrollView> : <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('Your first family memory belongs here. Add a photo to begin.')}</Text>}
    </View>
    {recentPeople.length ? <View style={{ gap: 12 }}>
      <Text variant="titleLarge">{t('Our people')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
        {recentPeople.map(person => {
          const photo = getDisplayPersonPhoto(person);
          return <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={formatPersonName(person)} onPress={() => openPersonProfile(person)} style={{ width: 72, alignItems: 'center', gap: 8 }}>
            {photo ? <CachedImage uri={photo.url} style={{ width: 60, height: 60, borderRadius: 30 }} /> : <Avatar.Text size={60} label={`${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`} style={{ backgroundColor: theme.colors.surfaceVariant }} color={theme.colors.onSurfaceVariant} />}
            <Text numberOfLines={1} variant="labelMedium">{person.firstName}</Text>
          </Pressable>;
        })}
      </ScrollView>
    </View> : null}
  </View>;
}
