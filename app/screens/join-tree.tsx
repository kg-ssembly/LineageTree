import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../components/dto/navigation';
import { useAuthStore } from '../../stores/auth-store';
import { useTreeStore } from '../../stores/tree-store';
import { resolveAccessCandidates, requestAccessToTree } from '../../providers/family-tree-access-service';
import { SectionCard } from '../../components/ui';
import LoginScreen from './auth/login';
import SignUpScreen from './auth/sign-up';
import { useI18n } from '../../hooks/use-i18n';

export default function JoinTreeScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'JoinTree'>) {
  const user = useAuthStore((state) => state.user);
  const { t } = useI18n();
  const userId = user?.id;
  const [signup, setSignup] = useState(false);
  const [tree, setTree] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const existingTree = useTreeStore((state) => state.trees.find((item) => item.id === route.params.treeId));
  const selectTree = useTreeStore((state) => state.selectTree);
  useEffect(() => {
    if (!userId || existingTree) return;
    let active = true;
    setTree(null); setMessage(''); setResolving(true);
    void resolveAccessCandidates(route.params.treeId, userId).then((results) => {
      if (!active) return;
      setTree(results[0] ?? null);
      if (!results.length) setMessage('This invitation is unavailable or you already have access.');
    }).catch((e) => { if (active) setMessage(e.message); }).finally(() => { if (active) setResolving(false); });
    return () => { active = false; };
  }, [userId, route.params.treeId, existingTree, attempt]);
  // Keep the invitation route mounted through authentication, including sign-up.
  if (!user) return signup
    ? <SignUpScreen navigation={{ navigate: () => setSignup(false) }} />
    : <LoginScreen navigation={{ navigate: () => setSignup(true) }} />;
  return <ScrollView contentContainerStyle={{ padding: 16 }}><SectionCard>
    <Text variant="headlineSmall">{t('Join a family tree')}</Text>
    {existingTree ? <>
      <Text>{existingTree.name}</Text>
      <Text>{t('You have access. Open this family tree to find your profile and link yourself.')}</Text>
      <Button mode="contained" onPress={() => { selectTree(existingTree.id); navigation.replace('Main', { screen: 'home' }); }}>{t('Open this family tree')}</Button>
    </> : null}
    {resolving && !existingTree ? <Text accessibilityLiveRegion="polite">{t('Checking invitation…')}</Text> : null}
    {tree && !existingTree ? <><Text variant="titleMedium">{tree.name}</Text><Text>{t('The owner will review your access request.')}</Text>
      <Button disabled={busy} loading={busy} onPress={async () => {
        setBusy(true);
        try { await requestAccessToTree(user.id, tree.id); setMessage('Access requested. You can follow its progress in Notifications.'); setTree(null); }
        catch (e) { setMessage(e instanceof Error ? e.message : 'Request failed. Try again.'); } finally { setBusy(false); }
      }}>{t('Request access')}</Button></> : null}
    {!existingTree ? <Text accessibilityLiveRegion="polite">{t(message)}</Text> : null}
    {!existingTree && !resolving && message ? <Button disabled={busy} onPress={() => setAttempt((value) => value + 1)}>{t('Check again')}</Button> : null}
    <Button onPress={() => navigation.replace('Main', { screen: message.startsWith('Access requested') ? 'notifications' : 'home' })}>{t('Open my workspace')}</Button>
  </SectionCard></ScrollView>;
}
