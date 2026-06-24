import React from 'react';
import { useLoginScreenController } from './login-controller';
import { LoginView } from './login-view';

export default function LoginScreen({ navigation }: any) {
  const controller = useLoginScreenController(navigation);
  return <LoginView controller={controller} />;
}
