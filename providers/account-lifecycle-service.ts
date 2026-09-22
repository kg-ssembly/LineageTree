import { httpsCallable } from 'firebase/functions';
import { functionsApi } from './firebase-provider';

export async function markAccountActiveServer() {
  await httpsCallable<Record<string, never>, { ok: boolean }>(functionsApi, 'markAccountActiveServer')({});
}

export async function deleteMyAccountServer() {
  await httpsCallable<Record<string, never>, { ok: boolean }>(functionsApi, 'deleteMyAccountServer')({});
}
