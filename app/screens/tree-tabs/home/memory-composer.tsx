import React, { useRef, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Button, Dialog, Portal, Searchbar, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { CachedImage } from '../../../../components';
import { formatPersonName } from '../../../../components/person-formatting';
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_PERSON, preparePhotoForUpload } from '../../../../components/photo-utils';
import { useFormDraft } from '../../../../hooks/use-form-draft';
import { useI18n } from '../../../../hooks/use-i18n';
import { useTreeStore } from '../../../../stores/tree-store';
import type { SharedTabProps } from '../shared';
import { buildMemoryPayload } from './dashboard-helpers';

export function MemoryComposer({ context, initialPersonId, initialKind = 'photo', onClose }: {
  context: SharedTabProps; initialPersonId?: string; initialKind?: 'photo' | 'story'; onClose: () => void;
}) {
  const { t } = useI18n();
  const updatePerson = useTreeStore(state => state.updatePerson);
  const [value, setValue] = useState({ personId: initialPersonId ?? context.currentAssignedPerson?.id ?? '', kind: initialKind, text: '', photoUri: '' });
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const draft = useFormDraft(`dashboard-memory:${context.userId}:${context.selectedTree.id}`, true, value);
  const person = context.people.find(item => item.id === value.personId);
  const candidates = context.people.filter(item => formatPersonName(item).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const close = async () => {
    if (locked.current) return;
    try { if (draft.dirty) await draft.save(); onClose(); }
    catch { setError(t('Draft could not be saved on this device.')); }
  };
  const pickPhoto = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      if (Platform.OS !== 'web' && !(await ImagePicker.requestMediaLibraryPermissionsAsync()).granted) throw new Error(t('Photo library permission is required.'));
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false });
      if (result.canceled) return;
      const photo = await preparePhotoForUpload(result.assets[0]);
      if (photo.sizeBytes > MAX_PHOTO_BYTES) throw new Error(t('This photo is too large. Choose a smaller photo.'));
      setValue(current => ({ ...current, photoUri: photo.uri }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('Could not prepare this photo. Please try again.')); }
    finally { locked.current = false; setBusy(false); }
  };
  const save = async () => {
    if (locked.current || !person || !context.userId || !context.canEdit) return;
    locked.current = true; setBusy(true); setError('');
    try {
      if (value.kind === 'photo' && person.photos.length >= MAX_PHOTOS_PER_PERSON) throw new Error(t('This profile has reached its photo limit.'));
      await updatePerson(context.userId, person, buildMemoryPayload(person, value.text, value.kind === 'photo' ? value.photoUri : ''));
      // A draft-storage failure must never turn a successful write into a retry.
      await draft.clear(true).catch(() => undefined);
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('Could not save your memory. Please try again.')); }
    finally { locked.current = false; setBusy(false); }
  };
  return <Portal><Dialog visible onDismiss={() => void close()} style={{ borderRadius: 20, width: '94%', maxWidth: 580, alignSelf: 'center', maxHeight: '90%' }}>
    <Dialog.Title>{t('Add a memory')}</Dialog.Title>
    <Dialog.ScrollArea style={{ borderTopWidth: 0, borderBottomWidth: 0 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 16, gap: 14 }}>
      {draft.available ? <View style={{ gap: 8 }}><Text>{t('You have an unfinished draft.')}</Text>
        <Button onPress={() => { setValue(draft.available!); draft.consume(); }}>{t('Restore draft')}</Button>
        <Button onPress={() => void draft.clear().catch(() => setError(t('Draft could not be saved on this device.')))}>{t('Discard draft')}</Button>
      </View> : null}
      <SegmentedButtons value={value.kind} onValueChange={kind => setValue(current => ({ ...current, kind: kind as 'photo' | 'story' }))} buttons={[{ value: 'photo', label: t('Photo'), disabled: busy }, { value: 'story', label: t('Written memory'), disabled: busy }]} />
      <Text variant="titleSmall">{t('Who is this memory about?')}</Text>
      {person ? <View style={{ gap: 4 }}><Text>{formatPersonName(person)}</Text><Button disabled={busy} onPress={() => setValue(current => ({ ...current, personId: '' }))}>{t('Change person')}</Button></View> : <>
        <Searchbar placeholder={t('Search family members')} accessibilityLabel={t('Search family members')} value={search} onChangeText={setSearch} />
        {candidates.slice(0, 12).map(item => <Button key={item.id} disabled={busy} onPress={() => setValue(current => ({ ...current, personId: item.id }))}>{formatPersonName(item)}</Button>)}
        {!candidates.length ? <Text>{t('No family members found.')}</Text> : null}
      </>}
      {value.kind === 'photo' ? <>
        {value.photoUri ? <CachedImage uri={value.photoUri} style={{ height: 160, width: '100%', borderRadius: 12 }} /> : null}
        <Button icon="image-plus" disabled={busy} onPress={() => void pickPhoto()}>{t(value.photoUri ? 'Change photo' : 'Choose photo')}</Button>
      </> : null}
      <Text variant="titleSmall">{t(value.kind === 'photo' ? 'Photo description' : 'Written memory')}</Text>
      <TextInput accessibilityLabel={t(value.kind === 'photo' ? 'Photo description' : 'Written memory')} style={{ minHeight: 130 }} mode="outlined" multiline value={value.text} disabled={busy} onChangeText={text => setValue(current => ({ ...current, text }))} />
      {error || draft.error ? <Text accessibilityLiveRegion="polite">{error || t(draft.error)}</Text> : null}
    </ScrollView></Dialog.ScrollArea>
    <Dialog.Actions style={{ flexWrap: 'wrap' }}>
      <Button disabled={busy} onPress={() => void close()}>{t(draft.dirty ? 'Save draft and close' : 'Close')}</Button>
      <Button mode="contained" loading={busy} disabled={busy || !!draft.available || !person || !context.canEdit || !context.userId || (value.kind === 'photo' ? !value.photoUri : !value.text.trim())} onPress={() => void save()}>{t('Save memory')}</Button>
    </Dialog.Actions>
  </Dialog></Portal>;
}
