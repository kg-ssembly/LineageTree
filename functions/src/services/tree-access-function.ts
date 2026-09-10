import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

export async function requestTreeAccess(db: Firestore, actorId: string, treeId: string) {
  if (!treeId || treeId.includes('/')) throw new HttpsError('invalid-argument', 'Choose a tree.');
  return db.runTransaction(async (tx) => {
    const ownerNotice = db.doc(`notifications/access-${treeId}-${actorId}`);
    const responseNotice = db.doc(`notifications/access-response-${treeId}-${actorId}`);
    const [tree, user, pending] = await Promise.all([tx.get(db.doc(`trees/${treeId}`)), tx.get(db.doc(`users/${actorId}`)), tx.get(ownerNotice)]);
    const data = tree.data();
    if (!tree.exists || data?.discoverable !== true) throw new HttpsError('not-found', 'This tree is not available for access requests.');
    if (data.memberIds?.includes(actorId)) throw new HttpsError('already-exists', 'You already have access to this tree.');
    if (pending.data()?.status === 'pending') return { ok: true };
    const timestamp = new Date().toISOString();
    const common = { sourceTreeId: treeId, sourceTreeName: data.name, status: 'pending', targetIdentifier: treeId, createdAt: timestamp, updatedAt: timestamp };
    tx.set(ownerNotice, { ...common, type: 'tree-access-request', userId: data.ownerId, requestedByUserId: actorId,
      requestedByLabel: user.data()?.displayName || 'A family member', message: `A family member requested access to ${data.name}.`, pairedNotificationId: responseNotice.id });
    tx.set(responseNotice, { ...common, type: 'tree-access-response', userId: actorId, requestedByUserId: data.ownerId,
      requestedByLabel: data.name, message: `Your request to join ${data.name} is awaiting owner approval.`, pairedNotificationId: ownerNotice.id });
    return { ok: true };
  });
}

export async function respondToAccess(db: Firestore, actorId: string, notificationId: string, status: string) {
  if (!notificationId || notificationId.includes('/') || !['accepted', 'rejected', 'dismissed'].includes(status)) throw new HttpsError('invalid-argument', 'Choose an access request and response.');
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`notifications/${notificationId}`);
    const notice = await tx.get(ref);
    const n = notice.data();
    if (!n || n.userId !== actorId) throw new HttpsError('permission-denied', 'This request belongs to another user.');
    const cancel = status === 'dismissed';
    if (n.type !== (cancel ? 'tree-access-response' : 'tree-access-request')) throw new HttpsError('invalid-argument', 'Choose an access request.');
    if (n.status !== 'pending') return { ok: true };
    const treeRef = db.doc(`trees/${n.sourceTreeId}`);
    const tree = await tx.get(treeRef);
    const data = tree.data();
    if (!data || (!cancel && data.ownerId !== actorId)) throw new HttpsError('permission-denied', 'Only the tree owner can respond.');
    const requesterId = cancel ? actorId : n.requestedByUserId;
    const requester = await tx.get(db.doc(`users/${requesterId}`));
    // Query also covers invitations created before paired IDs were introduced.
    const other = await tx.get(db.collection('notifications').where('userId', '==', cancel ? data.ownerId : requesterId).where('sourceTreeId', '==', n.sourceTreeId));
    const timestamp = new Date().toISOString();
    if (status === 'accepted' && !data.memberIds.includes(requesterId)) {
      tx.update(treeRef, {
        memberIds: [...data.memberIds, requesterId],
        collaborators: [...(data.collaborators ?? []), { userId: requesterId, email: requester.data()?.email ?? '', displayName: requester.data()?.displayName ?? '', role: 'viewer' }],
        membershipHistory: [...(data.membershipHistory ?? []), { id: `${requesterId}-${Date.now()}`, userId: requesterId, role: 'viewer', action: 'joined', createdAt: timestamp }],
        updatedAt: timestamp,
      });
    }
    tx.update(ref, { status, updatedAt: timestamp, respondedAt: timestamp });
    other.docs.filter((d) => d.data().status === 'pending' && d.data().type === (cancel ? 'tree-access-request' : 'tree-access-response') && (!cancel || d.data().requestedByUserId === requesterId))
      .forEach((d) => tx.update(d.ref, { status, updatedAt: timestamp, respondedAt: timestamp, message: cancel ? 'The requester cancelled this request.' : `Your access request was ${status === 'accepted' ? 'approved' : 'declined'}.` }));
    return { ok: true };
  });
}
