import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Text, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../components/dto/navigation';
import { useAuthStore } from '../../stores/auth-store';
import { useTreeStore } from '../../stores/tree-store';
import { resolveAccessCandidates, requestAccessToTree } from '../../providers/family-tree-access-service';
import { Reveal, ScreenBackground, SectionCard } from '../../components';
import LoginScreen from './auth/login';
import SignUpScreen from './auth/sign-up';
import { useI18n } from '../../hooks/use-i18n';

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, width: '100%', maxWidth: 720, alignSelf: 'center' },
  hero: { marginBottom: 24 },
  heroTitle: { marginTop: 14, fontWeight: '700' },
  heroSubtitle: { marginTop: 8, lineHeight: 24 },
  card: { borderRadius: 28, padding: 28, gap: 14 },
  title: { fontWeight: '700' },
  message: { lineHeight: 23 },
  detailCard: { borderRadius: 20, padding: 18, gap: 5 },
  actions: { gap: 10, marginTop: 8 },
  button: { borderRadius: 14 },
});

export default function JoinTreeScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'JoinTree'>) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const { t } = useI18n();
  const userId = user?.id;
  // Deep links can be opened without the required path segment (for example,
  // from an old or manually entered invitation URL). Navigation types cannot
  // guarantee params exist at runtime, so keep this screen renderable.
  const treeId = route.params?.treeId?.trim();
  const [signup, setSignup] = useState(false);
  const [tree, setTree] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const existingTree = useTreeStore((state) => state.trees.find((item) => item.id === treeId));
  const selectTree = useTreeStore((state) => state.selectTree);
  useEffect(() => {
    // A normal /login route must never fall through to the invitation shell.
    // Keep genuine /join/:treeId links here so every auth provider can resume
    // the invitation flow after authentication.
    if (userId && !treeId) {
      navigation.replace('Main', { screen: 'home' });
    }
  }, [navigation, treeId, userId]);
  useEffect(() => {
    if (!userId || !treeId || existingTree) return;
    let active = true;
    setTree(null); setMessage(''); setResolving(true);
    void resolveAccessCandidates(treeId, userId).then((results) => {
      if (!active) return;
      setTree(results[0] ?? null);
      if (!results.length) setMessage('This invitation is unavailable or you already have access.');
    }).catch((e) => { if (active) setMessage(e.message); }).finally(() => { if (active) setResolving(false); });
    return () => { active = false; };
  }, [userId, treeId, existingTree, attempt]);
  // Keep the invitation route mounted through authentication, including sign-up.
  if (!user) return <View style={styles.page}>
    <ScreenBackground />
    {signup
      ? <SignUpScreen navigation={{ navigate: () => setSignup(false) }} />
      : <LoginScreen navigation={{ navigate: () => setSignup(true) }} />}
  </View>;
  return <View style={styles.page}>
    <ScreenBackground />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Chip icon="account-group-outline" style={{ alignSelf: 'flex-start', backgroundColor: theme.colors.secondaryContainer }}>
          {t('Family connection')}
        </Chip>
        <Text variant="displaySmall" style={[styles.heroTitle, { color: theme.colors.onSurface }]}>
          {t('Join a family tree')}
        </Text>
        <Text variant="bodyLarge" style={[styles.heroSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          {t('Continue into your family workspace through this invitation.')}
        </Text>
      </View>

      <Reveal delay={60}>
        <SectionCard style={[styles.card, { borderColor: theme.colors.outlineVariant, borderWidth: 1 }]} elevation={2}>
          {existingTree ? <>
            <Chip icon="check-circle-outline" style={{ alignSelf: 'flex-start' }}>{t('Already connected')}</Chip>
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>{existingTree.name}</Text>
            <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>{t('You have access. Open this family tree to find your profile and link yourself.')}</Text>
            <Button mode="contained" style={styles.button} onPress={() => { selectTree(existingTree.id); navigation.replace('Main', { screen: 'home' }); }}>{t('Open this family tree')}</Button>
          </> : null}
          {resolving && !existingTree ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>{t('Checking invitation…')}</Text> : null}
          {tree && !existingTree ? <>
            <Chip icon="tree-outline" style={{ alignSelf: 'flex-start' }}>{t('Invitation found')}</Chip>
            <View style={[styles.detailCard, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>{t('Family tree')}</Text>
              <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>{tree.name}</Text>
            </View>
            <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>{t('The owner will review your access request.')}</Text>
            <Button disabled={busy} loading={busy} mode="contained" style={styles.button} onPress={async () => {
        setBusy(true);
        try { await requestAccessToTree(user.id, tree.id); setMessage('Access requested. You can follow its progress in Notifications.'); setTree(null); }
        catch (e) { setMessage(e instanceof Error ? e.message : 'Request failed. Try again.'); } finally { setBusy(false); }
            }}>{t('Request access')}</Button>
          </> : null}
          {!existingTree ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>{t(treeId ? message : 'This invitation link is incomplete. Ask the family tree owner to send a new link.')}</Text> : null}
          {!existingTree && Boolean(treeId) && !resolving && message ? <Button mode="outlined" style={styles.button} disabled={busy} onPress={() => setAttempt((value) => value + 1)}>{t('Check again')}</Button> : null}
          <View style={styles.actions}>
            <Button mode={existingTree || tree ? 'outlined' : 'contained'} style={styles.button} onPress={() => navigation.replace('Main', { screen: message.startsWith('Access requested') ? 'notifications' : 'home' })}>{t('Open my workspace')}</Button>
          </View>
        </SectionCard>
      </Reveal>
    </ScrollView>
  </View>;
}
