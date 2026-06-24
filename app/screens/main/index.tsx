import React from 'react';
import { MainScreenView } from './main-view';
import { useMainScreenController } from './main-controller';

export default function MainScreen(props: Parameters<typeof useMainScreenController>[0]) {
  const controller = useMainScreenController(props);
  return <MainScreenView controller={controller} />;
}
