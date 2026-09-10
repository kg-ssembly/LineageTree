import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Dialog, HelperText, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functionsApi } from '../providers/firebase-provider';
import { submitPersonUpdateApproval } from '../providers/family-tree-approval-service';
import { SectionCard } from './ui';
import { GlobalStyles } from '../constants/styles';
import HorizontalTabStrip from './horizontal-tab-strip';
import ConfirmDialog from './confirm-dialog';
import { getPersonLifeStatus, type PersonRecord } from './dto/person';
import type { ApprovalRequest } from './dto/approval';
import { useI18n } from '../hooks/use-i18n';
import { buildPersonApprovalPreviewFields, buildRelationshipApprovalPreviewFields, getTreeSettingsFamilyMemberCardStyle, getApprovalOperationLabel } from '../app/screens/tree-tabs/tree-settings/tree-settings-shared';

type TrashRecord = { id: string; person: PersonRecord; deletedAt: string };

export function PersonRecoveryPanel({ treeId, userId, isOwner, canEdit, people, history }: {
  treeId: string; userId: string; isOwner: boolean; canEdit: boolean; people: PersonRecord[]; history: ApprovalRequest[];
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [tab, setTab] = useState<'changes' | 'deleted'>('changes');
  const [trash, setTrash] = useState<TrashRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [count, setCount] = useState(10);
  const [retry, setRetry] = useState(0);
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [deletedPerson, setDeletedPerson] = useState<TrashRecord | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => Promise<void> } | null>(null);
  useEffect(() => {
    setTrash([]); setError(''); setCount(10); setLoading(true); setRequest(null); setDeletedPerson(null);
    return onSnapshot(query(collection(db, 'personTrash'), where('treeId', '==', treeId)), snapshot => {
      setLoading(false);
      setTrash(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as TrashRecord)).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)));
    }, () => { setLoading(false); setError('Recovery records could not be loaded. Check your connection and try again.'); });
  }, [treeId, retry]);
  const matches = (name: string) => name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const revisions = history.filter(r => r.status === 'applied' && matches(`${r.title} ${r.requestedByLabel}`))
    .sort((a, b) => (b.appliedAt ?? b.createdAt).localeCompare(a.appliedAt ?? a.createdAt));
  const deleted = trash.filter(item => matches(`${item.person.firstName} ${item.person.lastName}`));
  const restoreRevision = async (change: ApprovalRequest) => {
    const current = people.find(person => person.id === change.targetId);
    const before = change.payload.beforePerson!;
    if (!current) throw new Error('Restore this person from trash first.');
    const result = await submitPersonUpdateApproval(userId, current, {
      ...before, existingPhotos: before.photos, removedPhotos: [], newPhotoUris: [], preferredPhotoRef: before.preferredPhotoId,
    });
    setNotice(result.message);
  };
  const detailFields = request?.entityType === 'person'
    ? buildPersonApprovalPreviewFields(request.payload.beforePerson ?? request.payload.deletedPerson, request.payload.afterPerson)
    : request?.payload.relationship ? buildRelationshipApprovalPreviewFields(request.operation === 'delete-relationship' ? request.payload.relationship : null, request.operation === 'delete-relationship' ? null : request.payload.relationship, new Map(people.map(person => [person.id, person]))) : [];
  const closeDetail = () => { if (!busy) { setRequest(null); setDeletedPerson(null); } };
  const canRestore = request?.operation === 'update-person' && !!request.payload.beforePerson;
  return <SectionCard style={[getTreeSettingsFamilyMemberCardStyle(theme), { gap: 16 }]}>
    <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('Browse completed changes or recover a deleted family member.')}</Text>
    <HorizontalTabStrip items={[{ key: 'changes', label: t('Change history'), icon: 'history' }, { key: 'deleted', label: t('Deleted people'), icon: 'delete-restore' }]} activeKey={tab} onChange={key => { setTab(key); setCount(10); }} />
    <TextInput mode="outlined" label={t('Search history')} value={search} left={<TextInput.Icon icon="magnify" />} onChangeText={value => { setSearch(value); setCount(10); }} />
    {notice ? <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.primary }}>{t(notice)}</Text> : null}
    {tab === 'deleted' && error ? <View><HelperText type="error" visible>{t(error)}</HelperText><Button icon="refresh" onPress={() => setRetry(value => value + 1)}>{t('Try again')}</Button></View> : null}
    {tab === 'deleted' && loading ? <ActivityIndicator accessibilityLabel={t('Loading deleted people')} /> : null}
    {tab === 'changes' ? revisions.slice(0, count).map(item => <SectionCard key={item.id} nested style={[getTreeSettingsFamilyMemberCardStyle(theme), { gap: 6 }]}>
      <Text variant="titleMedium">{item.title}</Text>
      <Text variant="labelMedium" style={{ color: theme.colors.primary }}>{getApprovalOperationLabel(item.operation)}</Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{item.requestedByLabel} · {(item.appliedAt ?? item.createdAt).slice(0, 10)}</Text>
      <Button style={{ alignSelf: 'flex-start' }} icon="text-box-search-outline" onPress={() => setRequest(item)}>{t('View changes')}</Button>
    </SectionCard>) : deleted.slice(0, count).map(item => <SectionCard key={item.id} nested style={[getTreeSettingsFamilyMemberCardStyle(theme), { gap: 6 }]}>
      <Text variant="titleMedium">{item.person.firstName} {item.person.lastName}</Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{t('Deleted')} · {item.deletedAt.slice(0, 10)}</Text>
      <Button style={{ alignSelf: 'flex-start' }} icon="delete-restore" onPress={() => setDeletedPerson(item)}>{t('View recovery options')}</Button>
    </SectionCard>)}
    {(tab === 'changes' && revisions.length === 0) || (tab === 'deleted' && !loading && !error && deleted.length === 0) ? <View style={{ padding: 24, gap: 8 }}>
      <Text variant="titleMedium">{t(search ? 'No matching records' : tab === 'changes' ? 'No completed changes yet' : 'No deleted people')}</Text>
      <Text style={{ color: theme.colors.onSurfaceVariant }}>{t(search ? 'Try another name or clear your search.' : 'Records will appear here when your tree changes.')}</Text>
    </View> : null}
    {(tab === 'changes' ? revisions.length : deleted.length) > count ? <Button mode="outlined" onPress={() => setCount(count + 10)}>{t('Show more')}</Button> : null}
    <Portal><Dialog visible={!!request || !!deletedPerson} onDismiss={closeDetail} style={[GlobalStyles.dialogChrome.dialog, { maxHeight: '85%', backgroundColor: theme.colors.surface }]}>
      <Dialog.Title style={GlobalStyles.dialogChrome.dialogTitle}>{request?.title ?? `${deletedPerson?.person.firstName ?? ''} ${deletedPerson?.person.lastName ?? ''}`}</Dialog.Title>
      <Dialog.ScrollArea style={GlobalStyles.dialogChrome.scrollArea}><ScrollView contentContainerStyle={{ paddingVertical: 16, gap: 16 }}>
        {request ? <>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{request.requestedByLabel} · {(request.appliedAt ?? request.createdAt).slice(0, 10)}</Text>
          <Text>{request.description}</Text>
          {detailFields.map(field => <View key={field.label} style={{ padding: 12, gap: 6, borderRadius: 12, backgroundColor: theme.colors.surfaceVariant }}>
            <Text variant="titleSmall">{field.label}</Text>
            {field.before != null ? <Text>{t('Before')}: {field.before}</Text> : null}
            {field.after != null ? <Text>{t('After')}: {field.after}</Text> : null}
          </View>)}
          {detailFields.length === 0 ? <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('No field-level details were recorded for this change.')}</Text> : null}
          {canRestore && !people.some(person => person.id === request.targetId) ? <Text>{t('This profile is no longer in the tree. Restore it from Deleted people first.')}</Text> : null}
          {canRestore && getPersonLifeStatus(request.payload.beforePerson) !== getPersonLifeStatus(request.payload.afterPerson) ? <Text>{t('Life status')}: {t(getPersonLifeStatus(request.payload.beforePerson))} → {t(getPersonLifeStatus(request.payload.afterPerson))}</Text> : null}
          {canEdit && canRestore ? <><Text style={{ color: theme.colors.onSurfaceVariant }}>{t('Restoring a profile follows the normal approval process.')}</Text><Button mode="outlined" icon="backup-restore" disabled={busy || !people.some(person => person.id === request.targetId)} onPress={() => setConfirm({ message: 'Restore the profile values from before this change? Current profile details will be replaced; relationships stay as they are.', action: () => restoreRevision(request) })}>{t('Restore previous profile')}</Button></> : null}
        </> : deletedPerson ? <>
          <Text>{t('Deleted')} · {deletedPerson.deletedAt.slice(0, 10)}</Text>
          <Text>{t('Restore the person with saved relationships, or restore the profile alone and reconnect it after reviewing the tree.')}</Text>
          {isOwner ? [true, false].map(links => <Button key={String(links)} mode={links ? 'contained' : 'outlined'} disabled={busy} onPress={() => setConfirm({ message: links ? 'Restore this person and their saved relationships? Recovery stops if any connected record has changed.' : 'Restore this person without relationships?', action: async () => { await httpsCallable(functionsApi, 'restorePersonServer')({ treeId, personId: deletedPerson.id, restoreLinks: links }); setNotice('Person restored.'); } })}>{t(links ? 'Restore with relationships' : 'Restore person only')}</Button>) : <Text>{t('Ask the tree owner to restore this person.')}</Text>}
        </> : null}
      </ScrollView></Dialog.ScrollArea>
      <Dialog.Actions><Button disabled={busy} onPress={closeDetail}>{t('Close')}</Button></Dialog.Actions>
    </Dialog></Portal>
    <ConfirmDialog visible={!!confirm} title={t('Restore record')} message={t(confirm?.message ?? '')} loading={busy} confirmLabel="Restore" onDismiss={() => { if (!busy) setConfirm(null); }} onConfirm={async () => {
      setBusy(true);
      try { await confirm?.action(); setConfirm(null); setRequest(null); setDeletedPerson(null); }
      catch (e) { setNotice(e instanceof Error ? e.message : 'Restore failed.'); setConfirm(null); }
      finally { setBusy(false); }
    }} />
  </SectionCard>;
}
