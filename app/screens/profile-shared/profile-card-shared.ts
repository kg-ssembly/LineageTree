import { StyleSheet } from 'react-native';

export function getFamilyMemberCardStyle(
  theme: { colors: { outlineVariant: string; surface: string } },
  backgroundColor?: string,
) {
  return {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: backgroundColor ?? theme.colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  } as const;
}
