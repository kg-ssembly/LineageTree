import React from 'react';
import { AuthFormView } from '../shared/auth-form-view';
import type { useSignUpScreenController } from './sign-up-controller';

export function SignUpView({ controller }: { controller: ReturnType<typeof useSignUpScreenController> }) {
  return <AuthFormView variant="signUp" {...controller} />;
}
