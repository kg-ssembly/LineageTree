import React from 'react';
import { useSignUpScreenController } from './sign-up-controller';
import { SignUpView } from './sign-up-view';

export default function SignUpScreen({ navigation }: any) {
  const controller = useSignUpScreenController(navigation);
  return <SignUpView controller={controller} />;
}
