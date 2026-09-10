import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { resolveAccessCandidates } from '../providers/family-tree-access-service';
import { useI18n } from '../hooks/use-i18n';

export function TreeAccessChooser({ userId, onRequest }: { userId: string; onRequest: (treeId: string) => Promise<void> }) {
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState('');
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to request access.'); } finally { setBusy(false); }
  };
  return <View style={{ gap: 8 }}>
    <TextInput mode="outlined" label={t('Username, email, tree ID or invitation link')} value={identifier} editable={!busy}
      autoCapitalize="none" onChangeText={(value) => { setIdentifier(value); setResults([]); setMessage(''); }} />
    <Button loading={busy} disabled={busy || !identifier.trim()} onPress={() => { void run(async () => {
      const candidates = await resolveAccessCandidates(identifier, userId); setResults(candidates);
      if (!candidates.length) setMessage('No available discoverable trees found. Ask the owner to enable discovery or add you as a collaborator.');
    }); }}>{t('Find available trees')}</Button>
    {results.map((tree) => <View key={tree.id}>
      <Text>{tree.name}</Text>
      <Button disabled={busy} onPress={() => { void run(async () => { await onRequest(tree.id); setResults((current) => current.filter((r) => r.id !== tree.id)); setMessage('Access requested. The owner will review your request.'); }); }}>{t('Request access')}</Button>
    </View>)}
    {message ? <Text accessibilityLiveRegion="polite">{t(message)}</Text> : null}
    {error ? <HelperText type="error" visible>{t(error)}</HelperText> : null}
  </View>;
}
