import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLoginPassword, validateSignUpPassword } from '../app/screens/auth/shared/auth-validation';

const translate = (value: string) => value;

test('login and sign-up password validation use the same policy', () => {
  const invalid = ['', 'short', 'lowercase1', 'UPPERCASE1', 'lowercase!'];
  for (const password of invalid) {
    assert.equal(validateLoginPassword(password, translate), validateSignUpPassword(password, translate));
  }
  assert.equal(validateLoginPassword('Safe-password1', translate), null);
  assert.equal(validateSignUpPassword('Safe-password1', translate), null);
});
