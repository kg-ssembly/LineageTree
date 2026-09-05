import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text, useTheme } from 'react-native-paper';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME } from '../../constants/styles';

type EmptyStateProps = {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
};

export function EmptyState({ icon, title, message, actionLabel, onAction, disabled }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.icon, { backgroundColor: theme.colors.primaryContainer }]}>
        <Icon source={icon} size={36} color={theme.colors.onPrimaryContainer} />
      </View>
      <Text variant="headlineSmall" accessibilityRole="header" style={styles.copy}>{title}</Text>
      <Text variant="bodyMedium" style={[styles.copy, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Button mode="contained" onPress={onAction} disabled={disabled} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'center', padding: 24, gap: 16 },
  icon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  copy: { textAlign: 'center' },
});
