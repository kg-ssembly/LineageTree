import React from 'react';
import { AuthFormView } from '../shared/auth-form-view';
import type { useLoginScreenController } from './login-controller';

export function LoginView({ controller }: { controller: ReturnType<typeof useLoginScreenController> }) {
  return <AuthFormView variant="login" {...controller} />;
}
