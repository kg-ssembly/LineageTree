import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPhoneChallenge, assertRecentAuthentication, assertRemovableProvider, normalizeAccountPhone, accountSecurityErrorMessage } from '../providers/account-security';

test('account changes require a recent real authentication, not just a refreshed token', () => {
  const now = 1_000_000;
  assert.doesNotThrow(() => assertRecentAuthentication(999, now));
  for (const authTime of [undefined, '999', NaN, 0, 699, 1061]) {
    assert.throws(() => assertRecentAuthentication(authTime, now), { code: 'auth/requires-recent-login' });
  }
});

test('SMS challenges cannot cross accounts, purposes, or expiry', () => {
  const challenge = { uid: 'original', verificationId: 'secret', purpose: 'link' as const, expiresAt: 1000 };
  assert.doesNotThrow(() => assertPhoneChallenge(challenge, 'original', 'link', 999));
  assert.throws(() => assertPhoneChallenge(challenge, 'other', 'link', 999), { code: 'account/session-changed' });
  assert.throws(() => assertPhoneChallenge(challenge, 'original', 'reauthenticate', 999), { code: 'auth/code-expired' });
  assert.throws(() => assertPhoneChallenge(challenge, 'original', 'link', 1000), { code: 'auth/code-expired' });
  assert.throws(() => assertPhoneChallenge(null, 'original', 'link'), { code: 'auth/code-expired' });
});

test('removing the last unique method or an absent method is rejected', () => {
  assert.throws(() => assertRemovableProvider(['password', 'password'], 'password'), { code: 'account/last-sign-in-method' });
  assert.throws(() => assertRemovableProvider(['password'], 'phone'), { code: 'auth/no-such-provider' });
  assert.doesNotThrow(() => assertRemovableProvider(['password', 'phone'], 'password'));
});

test('phone numbers require an explicit country code and preserve international numbers', () => {
  assert.equal(normalizeAccountPhone(' +27 (82) 123-4567 '), '+27821234567');
  assert.equal(normalizeAccountPhone('0044 7700 900123'), '+447700900123');
  for (const input of ['0821234567', '+012345678', '+27abc1234567', '+1', '+1234567890123456']) {
    assert.throws(() => normalizeAccountPhone(input), { code: 'auth/invalid-phone-number' });
  }
});

test('occupied credentials do not promise an automatic merge or expose another account', () => {
  for (const code of ['auth/credential-already-in-use', 'auth/email-already-in-use']) {
    assert.match(accountSecurityErrorMessage({ code }) ?? '', /No profiles were merged/);
  }
});
