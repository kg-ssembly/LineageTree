import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { consumeLimit } from './request-limits';

export function directorySummary(id: string, data: FirebaseFirestore.DocumentData) {
  return { id, name: String(data.name ?? ''), ownerId: String(data.ownerId ?? ''),
    ownerDisplayName: String(data.ownerDisplayName ?? ''), ownerUsername: '', discoverable: true,
    matchedBy: 'tree-name', matchedLabel: String(data.name ?? '') };
}

/** Always rechecks the private source; a stale index cannot publish a private tree. */
export async function searchTreeDirectory(db: Firestore, actor: string, input: { term?: string; ownerId?: string; cursor?: string; treeId?: string }) {
  await consumeLimit(db, 'directory', actor, 30);
  if (input.treeId) {
    if (input.treeId.includes('/')) throw new HttpsError('invalid-argument', 'Invalid tree identifier.');
    const snapshot = await db.collection('trees').doc(input.treeId).get();
    const data = snapshot.data();
    return { trees: data?.discoverable === true && !data.memberIds?.includes(actor) ? [directorySummary(snapshot.id, data)] : [], cursor: null };
  }
  const term = String(input.term ?? '').trim().toLowerCase().replace(/[^\p{L}\p{N}\s'-]+/gu, ' ').replace(/\s+/g, ' ');
  let base = db.collection('trees').where('discoverable', '==', true);
  if (input.ownerId) base = base.where('ownerId', '==', input.ownerId);
  else if (term) base = base.where('searchKeywords', 'array-contains', term);
  else return { trees: [], cursor: null };
  let cursor = input.cursor;
  const trees: ReturnType<typeof directorySummary>[] = [];
  // Continue past existing memberships rather than dropping results after the limit.
  for (let page = 0; page < 5; page++) {
    let query = base.orderBy(FieldPath.documentId()).limit(12);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    for (const doc of snapshot.docs) {
      cursor = doc.id;
      if (!doc.data().memberIds?.includes(actor)) trees.push(directorySummary(doc.id, doc.data()));
      if (trees.length === 12) return { trees, cursor };
    }
    if (snapshot.size < 12) return { trees, cursor: null };
  }
  return { trees, cursor: cursor ?? null };
}

export async function lookupAccount(db: Firestore, actor: string, input: { identifier?: string; userId?: string }) {
  await consumeLimit(db, 'account-lookup', actor, 20);
  let snapshot: FirebaseFirestore.DocumentSnapshot | undefined;
  if (input.userId) {
    if (input.userId.includes('/')) throw new HttpsError('invalid-argument', 'Invalid account identifier.');
    snapshot = await db.collection('users').doc(input.userId).get();
  } else {
    const identifier = String(input.identifier ?? '').trim().toLowerCase();
    if (!identifier || identifier.length > 254) throw new HttpsError('invalid-argument', 'Enter an email address or username.');
    for (const field of identifier.includes('@') ? ['normalizedEmail', 'email'] : ['username']) {
      const result = await db.collection('users').where(field, '==', identifier).limit(2).get();
      if (result.size > 1) throw new HttpsError('failed-precondition', 'Use an email address to identify this account.');
      if (result.size) { snapshot = result.docs[0]; break; }
    }
  }
  if (!snapshot?.exists) throw new HttpsError('not-found', 'No matching account was found.');
  const data = snapshot.data()!;
  // A lookup is not permission to read the private account document or its email.
  return { id: snapshot.id, displayName: String(data.displayName ?? ''), username: String(data.username ?? ''), email: '' };
}
