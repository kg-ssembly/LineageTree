import { httpsCallable } from 'firebase/functions';
import { functionsApi } from './firebase-provider';

type SendTreeInviteEmailPayload = {
  treeId: string;
  collaboratorUserId: string;
};

type SendPasswordResetEmailPayload = {
  email: string;
};

type SendPasswordResetEmailResult = {
  ok: boolean;
  emailRegistered: boolean;
};

function callFunction<TPayload extends object, TResult extends object = { ok: boolean }>(name: string) {
  return httpsCallable<TPayload, TResult>(functionsApi, name);
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
  const result = await callFunction<SendPasswordResetEmailPayload, SendPasswordResetEmailResult>('sendPasswordResetEmail')({
    email,
  });

  return result.data;
}
