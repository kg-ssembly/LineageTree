import React from 'react';
import { Surface } from 'react-native-paper';

type PanelSurfaceProps = React.ComponentProps<typeof Surface>;

export function PanelSurface(props: PanelSurfaceProps) {
  return <Surface {...props} />;
}
