import React from 'react';
import type { ReactNode } from 'react';
import { Surface, useTheme } from 'react-native-paper';
import { GlobalStyles } from '../../constants/styles';

type SectionCardProps = {
  children: ReactNode;
  variant?: 'person' | 'tree';
  backgroundColor?: string;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  style?: any;
};

const personStyles = GlobalStyles.personProfile;
const treeStyles = GlobalStyles.treeDetail;

export function SectionCard({
  children,
  variant = 'tree',
  backgroundColor,
  elevation = 1,
  style,
}: SectionCardProps) {
  const theme = useTheme();
  const baseStyle = variant === 'person' ? personStyles.sectionCard : treeStyles.sectionCard;

  return (
    <Surface style={[baseStyle, { backgroundColor: backgroundColor ?? theme.colors.surface }, style]} elevation={elevation}>
      {children}
    </Surface>
  );
}
