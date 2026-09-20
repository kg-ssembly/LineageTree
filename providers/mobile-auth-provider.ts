import { accountError } from './account-security';

export const mobileAuthAvailable = false;

export async function getMobileGoogleIdToken(): Promise<string> {
  throw accountError('account/native-auth-unavailable');
}

export async function requestMobilePhoneVerification(_phoneNumber: string): Promise<{ verificationId: string; code?: string }> {
  throw accountError('account/native-auth-unavailable');
}
