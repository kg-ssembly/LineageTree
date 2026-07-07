import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Portal, Text, useTheme } from 'react-native-paper';

type SharedLoaderProps = {
  visible: boolean;
  label?: string;
  description?: string;
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 20,
  },
});

export default function SharedLoader({
  visible,
  label,
  description,
}: SharedLoaderProps) {
  const theme = useTheme();

  if (!visible) {
    return null;
  }

  return (
    <Portal>
      <View style={styles.overlay} pointerEvents="auto">
        <View
          style={[
            styles.backdrop,
            { backgroundColor: theme.colors.backdrop, opacity: 0.5 },
          ]}
        />
        <View
          style={[
            styles.content,
            {
              backgroundColor: theme.colors.elevation.level2,
              borderWidth: 1,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
          {label ? (
            <Text variant="titleMedium" style={{ textAlign: 'center', color: theme.colors.onSurface }}>
              {label}
            </Text>
          ) : null}
          {description ? (
            <Text variant="bodySmall" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>
    </Portal>
  );
}
