import React from 'react';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Surface, useTheme } from 'react-native-paper';

type TabStripCardProps = {
  children: ReactNode;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  style?: any;
};

export function TabStripCard({ children, elevation = 2, style }: TabStripCardProps) {
  const theme = useTheme();

  return (
    <Surface style={[styles.card, { backgroundColor: theme.colors.surface }, style]} elevation={elevation}>
      {children}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#1F2C1B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
