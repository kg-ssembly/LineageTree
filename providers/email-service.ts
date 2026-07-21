import { httpsCallable } from 'firebase/functions';
import { functionsApi } from './firebase-provider';

type SendTreeInviteEmailPayload = {
  treeId: string;
  collaboratorUserId: string;
};

type SendPasswordResetEmailPayload = {
  email: string;
};

function callFunction<TPayload extends object>(name: string) {
  return httpsCallable<TPayload, { ok: boolean }>(functionsApi, name);
}

export async function sendWelcomeEmailNotification() {
  await callFunction<Record<string, never>>('sendWelcomeEmail')({});
}

export async function sendTreeInviteEmailNotification(treeId: string, collaboratorUserId: string) {
  await callFunction<SendTreeInviteEmailPayload>('sendTreeInviteEmail')({
    treeId,
    collaboratorUserId,
  });
}

export async function sendPasswordResetEmailNotification(email: string) {
  await callFunction<SendPasswordResetEmailPayload>('sendPasswordResetEmail')({
    email,
  });
}
