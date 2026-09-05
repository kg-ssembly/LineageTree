import React from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Surface, useTheme } from 'react-native-paper';
import { GlobalStyles } from '../../constants/styles';

type SectionCardProps = {
  children: ReactNode;
  variant?: 'person' | 'tree';
  nested?: boolean;
  backgroundColor?: string;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
};

const personStyles = GlobalStyles.personProfile;
const treeStyles = GlobalStyles.treeDetail;

export function SectionCard({
  children,
  variant = 'tree',
  nested = false,
  backgroundColor,
  elevation = 1,
  style,
  onLayout,
}: SectionCardProps) {
  const theme = useTheme();
  const baseStyle = variant === 'person' ? personStyles.sectionCard : treeStyles.sectionCard;
  const nestedStyle = nested ? {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.outlineVariant,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  } : null;

  return (
    <Surface
      style={[baseStyle, { backgroundColor: backgroundColor ?? theme.colors.surface }, style, nestedStyle]}
      elevation={nested ? 0 : elevation}
      onLayout={onLayout}
    >
      {children}
    </Surface>
  );
}
