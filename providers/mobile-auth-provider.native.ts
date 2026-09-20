import { Platform } from 'react-native';
import { getAuth, verifyPhoneNumber } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { accountError } from './account-security';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  || '942129733688-mh6cllv4vcrtsk5le7et0mkrco7eviui.apps.googleusercontent.com';

let googleConfigured = false;

function configureGoogle() {
  if (googleConfigured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  googleConfigured = true;
}

export const mobileAuthAvailable = true;

export async function getMobileGoogleIdToken(): Promise<string> {
  configureGoogle();
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success') throw accountError('auth/popup-closed-by-user');
  if (!response.data.idToken) throw accountError('account/google-token-missing');
  return response.data.idToken;
}

export async function requestMobilePhoneVerification(phoneNumber: string): Promise<{ verificationId: string; code?: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const listener = verifyPhoneNumber(getAuth(), phoneNumber);
    listener.on('state_changed', snapshot => {
      if (settled) return;
      if (snapshot.error || snapshot.state === 'error') {
        settled = true;
        reject(snapshot.error ?? accountError('auth/missing-verification-id'));
        return;
      }
      if ((snapshot.state === 'sent' || snapshot.state === 'verified') && snapshot.verificationId) {
        settled = true;
        resolve({ verificationId: snapshot.verificationId, ...(snapshot.code ? { code: snapshot.code } : {}) });
      }
    }, error => {
      if (!settled) { settled = true; reject(error); }
    });
  });
}
