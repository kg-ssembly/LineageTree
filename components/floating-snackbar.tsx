import React from 'react';
import { Snackbar, type SnackbarProps } from 'react-native-paper';
import { Portal } from 'react-native-paper';

type FloatingSnackbarProps = SnackbarProps & {
  bottomOffset?: number;
};

export function FloatingSnackbar({
  bottomOffset = 88,
  style,
  ...props
}: FloatingSnackbarProps) {
  return (
    <Portal>
      <Snackbar
        {...props}
        style={[{ marginBottom: bottomOffset, borderRadius: 16, width: '94%', maxWidth: 560, alignSelf: 'center' }, style]}
      />
    </Portal>
  );
}
