import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

/** Fixed windows stored server-side; keys never expose raw email addresses. */
export async function consumeLimit(db: Firestore, action: string, identity: string, maximum: number, windowMs = 60_000) {
  const window = Math.floor(Date.now() / windowMs);
  const key = createHash('sha256').update(`${action}:${identity}:${window}`).digest('hex');
  const ref = db.collection('requestLimits').doc(key);
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const count = Number(snapshot.data()?.count ?? 0);
    if (count >= maximum) throw new HttpsError('resource-exhausted', 'Too many requests. Please try again later.');
    tx.set(ref, { count: count + 1, expiresAt: new Date((window + 2) * windowMs) });
  });
}
