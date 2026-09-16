import React from 'react';
import { Searchbar, useTheme, type SearchbarProps } from 'react-native-paper';

/** Shared search treatment with an explicit empty-state search affordance. */
export function AppSearchbar({
  accessibilityLabel,
  icon,
  traileringIcon,
  traileringIconAccessibilityLabel,
  style,
  ...props
}: SearchbarProps) {
  const theme = useTheme();
  return (
    <Searchbar
      {...props}
      accessibilityLabel={accessibilityLabel}
      icon={icon ?? 'magnify'}
      traileringIcon={traileringIcon ?? 'magnify'}
      traileringIconColor={theme.colors.primary}
      traileringIconAccessibilityLabel={traileringIconAccessibilityLabel ?? accessibilityLabel}
      style={[{ borderRadius: 20 }, style]}
    />
  );
}
