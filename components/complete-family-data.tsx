import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useIsFocused } from '@react-navigation/native';
import { useTreeStore } from '../stores/tree-store';
import { loadCompleteTreeGraph } from '../providers/tree-graph-service';
import { useI18n } from '../hooks/use-i18n';
import SharedLoader from './shared-loader';

/** Directory/statistical screens must not mistake the loaded branch for the entire family. */
export function CompleteFamilyData({ treeId, children, loadingLabel = 'Loading family records…', loadingDescription }: { treeId: string; children: React.ReactNode; loadingLabel?: string; loadingDescription?: string }) {
  const focused = useIsFocused();
  const complete = useTreeStore(state => state.graphComplete && state.treeDataTreeId === treeId);
  const ready = useTreeStore(state => !state.loadingTreeData && state.treeDataTreeId === treeId);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const { t } = useI18n();
  useEffect(() => {
    if (!focused || !ready || complete) return;
    let active = true; setError('');
    void loadCompleteTreeGraph(treeId).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [focused, ready, complete, treeId, attempt]);
  if (complete) return <>{children}</>;
  return <View style={{ padding: 24, gap: 12 }}>
    {error ? <><Text accessibilityRole="alert">{error}</Text><Button onPress={() => setAttempt(n => n + 1)}>{t('Retry')}</Button></> : <SharedLoader visible={focused} label={t(loadingLabel)} description={loadingDescription ? t(loadingDescription) : undefined} />}
  </View>;
}
