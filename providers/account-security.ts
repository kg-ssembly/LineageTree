export type AccountPhoneChallenge = {
  uid: string;
  verificationId: string;
  purpose: 'link' | 'reauthenticate';
  expiresAt: number;
  autoCode?: string;
};

export function accountError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

export function authErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code) : '';
}

export function assertSameAccount(expectedUid: string, actualUid?: string) {
  if (expectedUid !== actualUid) throw accountError('account/session-changed');
}

export function assertRecentAuthentication(authTime: unknown, now = Date.now()) {
  const timestamp = typeof authTime === 'number' ? authTime * 1000 : NaN;
  if (!Number.isFinite(timestamp) || now - timestamp > 5 * 60_000 || timestamp > now + 60_000) {
    throw accountError('auth/requires-recent-login');
  }
}

export function assertPhoneChallenge(
  challenge: AccountPhoneChallenge | null,
  uid: string,
  purpose: AccountPhoneChallenge['purpose'],
  now = Date.now(),
): asserts challenge is AccountPhoneChallenge {
  if (!challenge || challenge.purpose !== purpose || challenge.expiresAt <= now) {
    throw accountError('auth/code-expired');
  }
  assertSameAccount(challenge.uid, uid);
}

export function normalizeAccountPhone(input: string): string {
  const phone = input.trim().replace(/[\s().-]/g, '').replace(/^00/, '+');
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) throw accountError('auth/invalid-phone-number');
  return phone;
}

export function assertRemovableProvider(providers: readonly string[], providerId: string) {
  const unique = new Set(providers);
  if (!unique.has(providerId)) throw accountError('auth/no-such-provider');
  if (unique.size < 2) throw accountError('account/last-sign-in-method');
}

export function accountSecurityErrorMessage(error: unknown): string | null {
  switch (authErrorCode(error)) {
    case 'account/busy': return 'Finish the current sign-in change first.';
    case 'account/session-changed': return 'Your signed-in account changed. Start again from your profile.';
    case 'account/last-sign-in-method': return 'Connect another sign-in method before removing this one.';
    case 'account/native-auth-unavailable': return 'Google and phone sign-in require a development or store build. They are not available in Expo Go.';
    case 'account/google-token-missing': return 'Google did not return a valid sign-in credential. Check the app registration and try again.';
    case 'account/google-configuration-error': return 'Google sign-in is not configured for this app build. Install the latest build and try again.';
    case 'account/google-sign-in-failed': return 'Google could not complete sign-in. Check your Google account and try again.';
    case 'account/google-sign-in-progress': return 'Google sign-in is already open. Finish or cancel it before trying again.';
    case 'account/google-play-services-unavailable': return 'Google Play Services is unavailable or needs an update on this device.';
    case 'functions/resource-exhausted': return 'Too many email requests were made. Wait an hour, then try again.';
    case 'functions/unavailable':
    case 'functions/deadline-exceeded': return 'The email service is temporarily unavailable. Check your connection and try again.';
    case 'functions/failed-precondition': return 'The email service is not configured correctly. Please contact support.';
    case 'functions/internal':
    case 'functions/unknown': return 'The email could not be sent. Please try again later.';
    case 'auth/missing-verification-id': return 'Phone verification could not start. Check the app registration and try again.';
    case 'account/email-change': return 'Use the email address already attached to this account.';
    case 'auth/credential-already-in-use':
    case 'auth/email-already-in-use':
      return 'This sign-in method belongs to a different account. No profiles were merged. Sign into your original account to access its family trees.';
    case 'auth/account-exists-with-different-credential':
      return 'Sign in with your original method, then connect Google in Account & preferences. Your existing profile has not changed.';
    case 'auth/requires-recent-login': return 'Verify your current sign-in method, then try again.';
    case 'auth/user-mismatch': return 'Use the Google account already connected to this profile.';
    case 'auth/no-such-provider': return 'This sign-in method is no longer connected. Refresh and try again.';
    case 'auth/invalid-phone-number': return 'Enter a phone number with its country code, for example +27821234567.';
    case 'auth/missing-password': return 'Enter your current password.';
    case 'auth/invalid-verification-code': return 'Enter the six-digit code from the SMS.';
    default: return null;
  }
}
