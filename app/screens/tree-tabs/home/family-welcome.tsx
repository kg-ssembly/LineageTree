import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Avatar, Button, Searchbar, Text, useTheme } from 'react-native-paper';
import { CachedImage, SectionCard } from '../../../../components';
import { formatPersonName } from '../../../../components/person-formatting';
import { getDisplayPersonPhoto, type PersonRecord } from '../../../../components/dto/person';
import { useI18n } from '../../../../hooks/use-i18n';
import type { SharedTabProps } from '../shared';
import { PersonPhotoViewerModal } from '../../person-profile/dialogs/photo-viewer-modal';
import { MemoryComposer } from './memory-composer';
import { upcomingOccasions } from './dashboard-helpers';

export function FamilyWelcome(props: SharedTabProps & { onOpenOccasions: () => void; updates?: React.ReactNode; nextStep?: React.ReactNode }) {
  const { people, selectedTree, currentUserLabel, currentAssignedPerson, openPersonProfile } = props;
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { t, language } = useI18n();
  const knownPeople = useRef<Set<string> | null>(null);
  const [welcomeName, setWelcomeName] = useState('');
  useEffect(() => {
    if (props.loadingTreeData) return;
    const added = knownPeople.current ? people.find(person => !knownPeople.current!.has(person.id)) : null;
    knownPeople.current = new Set(people.map(person => person.id));
    if (added) setWelcomeName(formatPersonName(added));
  }, [people, props.loadingTreeData]);
  useEffect(() => {
    if (!welcomeName) return;
    const timer = setTimeout(() => setWelcomeName(''), 6000);
    return () => clearTimeout(timer);
  }, [welcomeName]);
  const [composer, setComposer] = useState<{ personId?: string; kind: 'photo' | 'story' } | null>(null);
  const [viewer, setViewer] = useState<{ personId: string; photoId: string } | null>(null);
  const [allPhotos, setAllPhotos] = useState(false);
  const [allPeople, setAllPeople] = useState(false);
  const [query, setQuery] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [hiddenPromptIds, setHiddenPromptIds] = useState<string[]>([]);
  const memories = useMemo(() => people.flatMap(person => person.photos.map(photo => ({ person, photo })))
    .sort((a, b) => b.photo.createdAt.localeCompare(a.photo.createdAt)), [people]);
  const occasion = upcomingOccasions(people)[0];
  const prompts = useMemo(() => [
    ...people.filter(person => person.id !== currentAssignedPerson?.id).slice(0, 8).map(person => ({ id: person.id, personId: person.id, photo: false, text: t('What is a favourite memory of {name}?', { name: formatPersonName(person) }) })),
    ...memories.slice(0, 3).map(({ person, photo }) => ({ id: photo.id, personId: person.id, photo: true, text: t('Tell the story behind this photograph of {name}.', { name: formatPersonName(person) }) })),
    { id: 'tradition', personId: currentAssignedPerson?.id, photo: false, text: t('What family tradition do you hope we never forget?') },
  ].filter(prompt => !hiddenPromptIds.includes(prompt.id)), [people, currentAssignedPerson, memories, t, hiddenPromptIds]);
  const prompt = prompts[promptIndex % Math.max(1, prompts.length)];
  const directory = useMemo(() => [...people].filter(person => formatPersonName(person).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => {
      const ai = recentIds.indexOf(a.id); const bi = recentIds.indexOf(b.id);
      return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi) || formatPersonName(a).localeCompare(formatPersonName(b));
    }), [people, query, recentIds]);
  const openPerson = (person: PersonRecord) => {
    setRecentIds(ids => [person.id, ...ids.filter(id => id !== person.id)].slice(0, 12));
    openPersonProfile(person);
  };
  const portrait = currentAssignedPerson ? getDisplayPersonPhoto(currentAssignedPerson) : null;
  const viewerPerson = people.find(person => person.id === viewer?.personId);
  const viewerIndex = viewerPerson?.photos.findIndex(photo => photo.id === viewer?.photoId) ?? -1;
  const openComposer = (kind: 'photo' | 'story', personId?: string) => setComposer({ kind, personId });
  return <View style={{ gap: 20, marginBottom: 20 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{selectedTree.name} · {t('Our family journal')}</Text>
        <Text variant="headlineLarge">{t('Hi')}, {currentUserLabel.split(' ')[0]}</Text>
      </View>
      {currentAssignedPerson ? <Pressable accessibilityRole="button" accessibilityLabel={t('Open my family profile')} onPress={() => openPerson(currentAssignedPerson)}>
        {portrait ? <CachedImage uri={portrait.url} style={{ width: 48, height: 48, borderRadius: 24 }} /> : <Avatar.Text size={48} label={currentUserLabel.slice(0, 1)} />}
      </Pressable> : null}
    </View>
    {welcomeName ? <Text accessibilityLiveRegion="polite">{t('Our family story has grown')} · {welcomeName}</Text> : null}
    {props.updates}
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'stretch' }}>
      <View style={{ flex: wide ? 1.35 : undefined, minWidth: 0 }}>
        <SectionCard elevation={0} backgroundColor={theme.colors.primaryContainer} style={{ borderRadius: 28, padding: 24, gap: 14 }}>
          <Text variant="labelLarge">{t('Our journal')}</Text>
          <Text variant="headlineMedium" style={{ color: theme.colors.onPrimaryContainer }}>{prompt?.text ?? t('There is a story only you can tell.')}</Text>
          <Text style={{ color: theme.colors.onPrimaryContainer }}>{t('An old photograph. A favourite day. Keep a piece of your family story here.')}</Text>
          {prompt?.photo ? <CachedImage uri={memories.find(item => item.photo.id === prompt.id)?.photo.url ?? ''} style={{ width: '100%', height: 150, borderRadius: 12 }} /> : null}
          {props.canEdit && people.length > 0 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button mode="contained" icon="image-plus" onPress={() => openComposer('photo')}>{t('Add a memory')}</Button>
            <Button mode="outlined" onPress={() => openComposer('story', prompt?.personId)}>{t('Write a memory')}</Button>
          </View> : null}
          {prompts.length > 0 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button onPress={() => setPromptIndex(index => index + 1)} disabled={prompts.length < 2}>{t('Another prompt')}</Button>
            <Button onPress={() => setHiddenPromptIds(ids => [...ids, prompt.id])}>{t('Hide')}</Button>
          </View> : hiddenPromptIds.length ? <Button onPress={() => setHiddenPromptIds([])}>{t('Restore prompts')}</Button> : null}
        </SectionCard>
      </View>
      <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 12 }}>
        <SectionCard style={{ gap: 10 }}>
          <Text variant="titleMedium">{t('Days that matter')}</Text>
          {occasion ? <>
            <Text variant="titleSmall">{occasion.birthday ? t('{name}’s birthday', { name: formatPersonName(occasion.person) }) : occasion.title}</Text>
            {!occasion.birthday ? <Text>{formatPersonName(occasion.person)}</Text> : null}
            <Text>{occasion.next.toLocaleDateString(language, { month: 'long', day: 'numeric' })}</Text>
            {props.canEdit ? <Button mode="outlined" onPress={() => openComposer('story', occasion.person.id)}>{t('Write a memory')}</Button> : null}
          </> : <Text>{t('No recorded occasions in the next 90 days.')}</Text>}
          <Button onPress={props.onOpenOccasions}>{t('Family occasions')}</Button>
        </SectionCard>
        {props.nextStep}
      </View>
    </View>
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="titleLarge">{t('From the family album')}</Text>
        {memories.length > 6 ? <Button onPress={() => setAllPhotos(value => !value)}>{t(allPhotos ? 'Show less' : 'View all')}</Button> : null}
      </View>
      {memories.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {(allPhotos ? memories : memories.slice(0, 6)).map(({ person, photo }) => <Pressable key={`${person.id}-${photo.id}`} accessibilityRole="button" accessibilityLabel={`${t('View memories')}: ${formatPersonName(person)} · ${photo.description || t('Photo')}`} onPress={() => setViewer({ personId: person.id, photoId: photo.id })} style={{ width: wide ? '31%' : '47%', gap: 6 }}>
          <CachedImage uri={photo.url} style={{ height: wide ? 190 : 130, width: '100%', borderRadius: 16 }} />
          <Text numberOfLines={2} variant="titleSmall">{photo.description || t('A moment worth remembering')}</Text>
          <Text variant="bodySmall">{formatPersonName(person)}</Text>
        </Pressable>)}
      </View> : <Text>{t('Your first family memory belongs here. Add a photo to begin.')}</Text>}
    </View>
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
        <Text variant="titleLarge">{t('Our people')}</Text>
        {people.length > 7 ? <Button onPress={() => setAllPeople(value => !value)}>{t(allPeople ? 'Show less' : 'View all')}</Button> : null}
      </View>
      <Searchbar placeholder={t('Search family members')} accessibilityLabel={t('Search family members')} value={query} onChangeText={setQuery} />
      {recentIds.length && !query ? <Text variant="bodySmall">{t('Recently viewed people appear first.')}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {(allPeople || query ? directory : directory.slice(0, 7)).map(person => {
          const photo = getDisplayPersonPhoto(person);
          return <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={formatPersonName(person)} onPress={() => openPerson(person)} style={{ width: 84, alignItems: 'center', gap: 8 }}>
            {photo ? <CachedImage uri={photo.url} style={{ width: 60, height: 60, borderRadius: 30 }} /> : <Avatar.Text size={60} label={`${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`} />}
            <Text numberOfLines={2} variant="labelMedium" style={{ textAlign: 'center' }}>{formatPersonName(person)}</Text>
          </Pressable>;
        })}
      </View>
      {!directory.length && query ? <Text>{t('No family members found.')}</Text> : null}
    </View>
    {composer ? <MemoryComposer context={props} initialPersonId={composer.personId} initialKind={composer.kind} onClose={() => setComposer(null)} /> : null}
    {viewerPerson && viewerIndex >= 0 ? <PersonPhotoViewerModal person={viewerPerson} viewerIndex={viewerIndex} setViewerIndex={update => { const index = typeof update === 'function' ? update(viewerIndex) : update; setViewer(index === null ? null : { personId: viewerPerson.id, photoId: viewerPerson.photos[index].id }); }} /> : null}
  </View>;
}
