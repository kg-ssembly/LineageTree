import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Checkbox, Dialog, List, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useI18n } from '../hooks/use-i18n';
import { GlobalStyles } from '../constants/styles';
import type { PersonRecord } from './dto/person';
import type { RelationshipRecord } from './dto/relationship';
import { recordedParents, type FamilyConnection } from './family-entry-guidance';
import { formatPersonName } from './person-formatting';

export default function SiblingEntryDialog({ visible, people, relationships, fixedPerson, onDismiss, onSubmit }: {
  visible: boolean;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  fixedPerson?: PersonRecord | null;
  onDismiss: () => void;
  onSubmit: (person: PersonRecord, connections: FamilyConnection[]) => void;
}) {
  const { t } = useI18n();
  const [person, setPerson] = useState<PersonRecord | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [kinds, setKinds] = useState<Record<string, 'biological' | 'non-biological'>>({});
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (visible) { setPerson(fixedPerson ?? null); setSelected([]); setKinds({}); setQuery(''); }
  }, [visible, fixedPerson]);
  const parents = person ? recordedParents(person.id, relationships).filter(c => people.some(p => p.id === c.relatedPersonId)) : [];
  return <Portal><Dialog visible={visible} onDismiss={onDismiss} style={GlobalStyles.dialogChrome.dialog}>
    <Dialog.Title>{t(person ? 'Choose shared parents' : 'Select an existing sibling')}</Dialog.Title>
    <Dialog.ScrollArea><ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
      {person ? <View style={{ paddingVertical: 12, gap: 8 }}>
        <Text>{t('Choose which parents the new person shares with {name}. Review each relationship type in the person form.', { name: formatPersonName(person) })}</Text>
        {parents.map(c => <View key={c.relatedPersonId}><Checkbox.Item label={formatPersonName(people.find(p => p.id === c.relatedPersonId)!)} status={selected.includes(c.relatedPersonId) ? 'checked' : 'unchecked'} onPress={() => setSelected(ids => ids.includes(c.relatedPersonId) ? ids.filter(id => id !== c.relatedPersonId) : [...ids, c.relatedPersonId])} />{selected.includes(c.relatedPersonId) ? <SegmentedButtons value={kinds[c.relatedPersonId] ?? 'biological'} onValueChange={value => setKinds(current => ({ ...current, [c.relatedPersonId]: value as 'biological' | 'non-biological' }))} buttons={[{ value: 'biological', label: t('Biological') }, { value: 'non-biological', label: t('Non-biological') }]} /> : null}</View>)}
        {!parents.length ? <Text>{t('Add a parent first, then connect a sibling through that shared parent.')}</Text> : null}
        {!fixedPerson ? <Button onPress={() => { setPerson(null); setSelected([]); }}>{t('Back')}</Button> : null}
      </View> : <View>
        <TextInput label={t('Search family members')} value={query} onChangeText={setQuery} />
        {people.filter(p => formatPersonName(p).toLowerCase().includes(query.trim().toLowerCase())).map(p => <List.Item key={p.id} title={formatPersonName(p)} onPress={() => { setPerson(p); setSelected([]); }} />)}
      </View>}
    </ScrollView></Dialog.ScrollArea>
    <Dialog.Actions>
      <Button onPress={onDismiss}>{t('Cancel')}</Button>
      <Button mode="contained" disabled={!person || !parents.some(c => selected.includes(c.relatedPersonId))} onPress={() => {
        if (person) onSubmit(person, parents.filter(c => selected.includes(c.relatedPersonId)).map(c => ({ ...c, parentChildKind: kinds[c.relatedPersonId] ?? 'biological' })));
      }}>{t('Continue')}</Button>
    </Dialog.Actions>
  </Dialog></Portal>;
}
