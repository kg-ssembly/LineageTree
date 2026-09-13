import React from 'react';
import { View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useAuthStore } from '../stores/auth-store';
import { useSyncStatusStore } from '../stores/sync-status-store';
import { useTreeStore } from '../stores/tree-store';
import { useI18n } from '../hooks/use-i18n';

export function SyncStatusBanner() {
  const source = useSyncStatusStore((state) => state.source);
  const pendingWrites = useSyncStatusStore((state) => state.pendingWrites);
  const upload = useSyncStatusStore((state) => state.upload);
  const mutating = useTreeStore((state) => state.mutating);
  const error = useTreeStore((state) => state.error);
  const syncFamilyData = useTreeStore((state) => state.syncFamilyData);
  const userId = useAuthStore((state) => state.user?.id);
  const theme = useTheme();
  const { t } = useI18n();
  const label = source === 'error' ? 'Connection interrupted. Retry to refresh your family data.'
    : error ? 'Last action failed. Review the message and retry; unsaved person changes remain in the form.'
    : mutating || pendingWrites || upload ? 'Saving changes…'
      : source === 'cache' ? 'Showing saved data. Waiting for connection; you can prepare a person draft.'
        : source === 'connecting' ? 'Connecting…' : null;
  if (!label) {
    return null;
  }
  return <View style={{ paddingHorizontal: 16, paddingVertical: 6, backgroundColor: theme.colors.surfaceVariant }}>
    <Text variant="labelSmall" accessibilityLiveRegion="polite">{t(label)}</Text>
    {source === 'error' && userId ? <Button compact onPress={() => syncFamilyData(userId)}>{t('Retry connection')}</Button> : null}
  </View>;
}
