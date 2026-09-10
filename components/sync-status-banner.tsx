import React from 'react';
import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSyncStatusStore } from '../stores/sync-status-store';
import { useTreeStore } from '../stores/tree-store';
import { useI18n } from '../hooks/use-i18n';

export function SyncStatusBanner() {
  const { source, pendingWrites } = useSyncStatusStore();
  const mutating = useTreeStore((state) => state.mutating);
  const error = useTreeStore((state) => state.error);
  const theme = useTheme();
  const { t } = useI18n();
  const label = error ? 'Last action failed. Review the message and retry; unsaved person changes remain in the form.'
    : mutating || pendingWrites ? 'Saving changes…'
      : source === 'cache' ? 'Showing saved data. Waiting for connection; you can prepare a person draft.'
        : source === 'connecting' ? 'Connecting…' : 'Connected · changes saved';
  return <View style={{ paddingHorizontal: 16, paddingVertical: 6, backgroundColor: theme.colors.surfaceVariant }}>
    <Text variant="labelSmall" accessibilityLiveRegion="polite">{t(label)}</Text>
  </View>;
}
