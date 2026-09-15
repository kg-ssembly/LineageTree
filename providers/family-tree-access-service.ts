import { parseTreeInvitationIdentifier } from '../components/tree-invitation-link';
import { httpsCallable } from 'firebase/functions';
import { functionsApi } from './firebase-provider';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { NotificationActivityState } from '../components/dto/notification';
import type { FamilyTree } from '../components/dto/tree';
import {
  MERGE_REQUESTS_COLLECTION,
  NOTIFICATION_ACTIVITY_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  TREES_COLLECTION,
  findUserByIdentifier,
  getTreeById,
  getUserProfileById,
} from './family-tree-data';
import { db } from './firebase-provider';
import { mapMergeRequest, mapNotification, mapNotificationActivityState, mapTree, mapTreeData, sortCollaborators } from './family-tree-mappers';
import { nowIso } from './family-tree-shared';

function buildMergeApprovalLabel(tree: FamilyTree, userId: string) {
  const collaborator = tree.collaborators.find((entry) => entry.userId === userId);
  return collaborator?.displayName || collaborator?.email || 'An editor';
}

function canApproveMergeForTree(tree: FamilyTree, userId: string) {
  return tree.editorIds.includes(userId);
}

async function ensureNoPendingMergeInvite(
  actorUserId: string,
  sourceTreeId: string,
  targetUserId: string,
) {
  const existingPendingInviteSnapshot = await getDocs(query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', targetUserId),
    where('type', '==', 'merge-invite'),
    where('requestedByUserId', '==', actorUserId),
    where('sourceTreeId', '==', sourceTreeId),
    where('status', '==', 'pending'),
    limit(1),
  ));

  if (!existingPendingInviteSnapshot.empty) {
    throw new Error('A pending merge invitation already exists for this tree and user.');
  }
}

export async function grantMergeRequesterViewerAccess(
  actorUserId: string,
  requestId: string,
  treeId: string,
) {
  const requestRef = doc(db, MERGE_REQUESTS_COLLECTION, requestId);
  const requestSnapshot = await getDoc(requestRef);
  if (!requestSnapshot.exists()) {
    throw new Error('That merge request no longer exists.');
  }

  const request = mapMergeRequest(requestSnapshot as QueryDocumentSnapshot);
  if (request.status !== 'applied') {
    throw new Error('Viewer access can only be granted after a merge is applied.');
  }

  if (!request.involvedTreeIds.includes(treeId)) {
    throw new Error('That tree was not part of the selected merge.');
  }

  const treeRef = doc(db, TREES_COLLECTION, treeId);
  const requester = await getUserProfileById(request.suggestedByUserId);

  await runTransaction(db, async (transaction) => {
    const treeSnapshot = await transaction.get(treeRef);
    if (!treeSnapshot.exists()) {
      throw new Error('That family tree no longer exists.');
    }

    const tree = mapTreeData(treeSnapshot.id, treeSnapshot.data());
    if (!canApproveMergeForTree(tree, actorUserId)) {
      throw new Error('Only an editor from this tree can grant viewer access.');
    }

    if (requester.id === tree.ownerId) {
      return;
    }

    if (tree.memberIds.includes(requester.id)) {
      return;
    }

    const collaborators = sortCollaborators([
      ...tree.collaborators,
      {
        userId: requester.id,
        email: requester.email,
        displayName: requester.displayName,
        role: 'viewer',
      },
    ]);

    transaction.update(treeRef, {
      collaborators,
      memberIds: [...tree.memberIds, requester.id],
      membershipHistory: [
        ...tree.membershipHistory,
        {
          id: `${tree.id}-${requester.id}-${Date.now()}`,
          userId: requester.id,
          role: 'viewer',
          action: 'joined',
          note: `Granted viewer access after merge ${requestId}`,
          createdAt: nowIso(),
        },
      ],
      updatedAt: nowIso(),
    });
  });
}

export async function requestAccessToTree(actorUserId: string, treeId: string) {
  await httpsCallable(functionsApi, 'requestTreeAccessServer')({ treeId });
}

export async function resolveAccessCandidates(identifier: string, actorUserId: string) {
 const value = parseTreeInvitationIdentifier(identifier);
 const search = httpsCallable<{treeId?: string; ownerId?: string}, {trees: Array<{id: string; name: string}>}>(functionsApi, 'searchTreeDirectoryServer');
 const direct = await search({treeId: value});
 if (direct.data.trees.length) return direct.data.trees;
 const user = await findUserByIdentifier(value);
 return (await search({ownerId: user.id})).data.trees;
}

export async function requestAccessFromIdentifier(actorUserId: string, identifier: string) {
  const candidates = await resolveAccessCandidates(identifier, actorUserId);
  if (candidates.length !== 1) throw new Error('Find available trees and choose the family tree you want to join.');
  await requestAccessToTree(actorUserId, candidates[0].id);
}

export async function respondToTreeAccessRequest(actorUserId: string, notificationId: string, status: 'accepted' | 'rejected') {
  await httpsCallable(functionsApi, 'respondToTreeAccessServer')({ notificationId, status });
}
export async function cancelTreeAccessRequest(actorUserId: string, notificationId: string) {
  await httpsCallable(functionsApi, 'respondToTreeAccessServer')({ notificationId, status: 'dismissed' });
}

export async function sendMergeInviteByIdentifier(
  actorUserId: string,
  sourceTreeId: string,
  identifier: string,
) {
  const [sourceTree, targetUser] = await Promise.all([
    getTreeById(sourceTreeId),
    findUserByIdentifier(identifier),
  ]);

  if (!sourceTree.editorIds.includes(actorUserId)) {
    throw new Error('Only an editor can send merge invitations for this tree.');
  }

  if (targetUser.id === actorUserId) {
    throw new Error('You already have access to this account. Use tree IDs to merge your own trees directly.');
  }

  await ensureNoPendingMergeInvite(actorUserId, sourceTree.id, targetUser.id);

  const notificationRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
  const timestamp = nowIso();
  const requestedByLabel = buildMergeApprovalLabel(sourceTree, actorUserId);

  await setDoc(notificationRef, {
    userId: targetUser.id,
    type: 'merge-invite',
    status: 'pending',
    requestedByUserId: actorUserId,
    requestedByLabel,
    sourceTreeId: sourceTree.id,
    sourceTreeName: sourceTree.name,
    targetIdentifier: identifier.trim(),
    message: `${requestedByLabel} asked you to review a tree merge with ${sourceTree.name}.`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function respondToMergeInvite(
  actorUserId: string,
  notificationId: string,
  status: 'accepted' | 'dismissed',
) {
  const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  const notificationSnapshot = await getDoc(notificationRef);
  if (!notificationSnapshot.exists()) {
    throw new Error('That merge invitation no longer exists.');
  }

  const notification = mapNotification(notificationSnapshot as QueryDocumentSnapshot);
  if (notification.userId !== actorUserId) {
    throw new Error('That merge invitation belongs to another user.');
  }

  await updateDoc(notificationRef, {
    status,
    respondedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export async function markNotificationSeen(actorUserId: string, notificationId: string) {
  const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  const notificationSnapshot = await getDoc(notificationRef);
  if (!notificationSnapshot.exists()) {
    throw new Error('That notification no longer exists.');
  }

  const notification = mapNotification(notificationSnapshot as QueryDocumentSnapshot);
  if (notification.userId !== actorUserId) {
    throw new Error('That notification belongs to another user.');
  }

  await updateDoc(notificationRef, {
    seenAt: notification.seenAt ?? nowIso(),
    updatedAt: nowIso(),
  });
}

export async function markNotificationOpened(actorUserId: string, notificationId: string) {
  const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  const notificationSnapshot = await getDoc(notificationRef);
  if (!notificationSnapshot.exists()) {
    throw new Error('That notification no longer exists.');
  }

  const notification = mapNotification(notificationSnapshot as QueryDocumentSnapshot);
  if (notification.userId !== actorUserId) {
    throw new Error('That notification belongs to another user.');
  }

  await updateDoc(notificationRef, {
    seenAt: notification.seenAt ?? nowIso(),
    openedAt: notification.openedAt ?? nowIso(),
    updatedAt: nowIso(),
  });
}

export async function markNotificationActivityActioned(
  actorUserId: string,
  sourceKind: NotificationActivityState['sourceKind'],
  sourceId: string,
) {
  const activityRef = doc(db, NOTIFICATION_ACTIVITY_COLLECTION, `${actorUserId}-${sourceKind}-${sourceId}`);
  const snapshot = await getDoc(activityRef);
  const timestamp = nowIso();

  if (snapshot.exists()) {
    await updateDoc(activityRef, {
      actionedAt: timestamp,
      updatedAt: timestamp,
    });
    return;
  }

  await setDoc(activityRef, {
    userId: actorUserId,
    sourceKind,
    sourceId,
    actionedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function deleteNotification(
  actorUserId: string,
  notificationId: string,
) {
  const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  const notificationSnapshot = await getDoc(notificationRef);
  if (!notificationSnapshot.exists()) {
    throw new Error('That notification no longer exists.');
  }

  const notification = mapNotification(notificationSnapshot as QueryDocumentSnapshot);
  if (notification.userId !== actorUserId) {
    throw new Error('That notification belongs to another user.');
  }

  await deleteDoc(notificationRef);
}

export async function deleteNotificationActivity(
  actorUserId: string,
  sourceKind: NotificationActivityState['sourceKind'],
  sourceId: string,
) {
  const activityRef = doc(db, NOTIFICATION_ACTIVITY_COLLECTION, `${actorUserId}-${sourceKind}-${sourceId}`);
  const snapshot = await getDoc(activityRef);
  const timestamp = nowIso();

  if (snapshot.exists()) {
    const existing = mapNotificationActivityState(snapshot as QueryDocumentSnapshot);
    if (existing.userId !== actorUserId) {
      throw new Error('That notification activity belongs to another user.');
    }

    await updateDoc(activityRef, {
      deletedAt: timestamp,
      updatedAt: timestamp,
    });
    return;
  }

  await setDoc(activityRef, {
    userId: actorUserId,
    sourceKind,
    sourceId,
    deletedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function deleteAllNotifications(
  actorUserId: string,
  notificationIds: string[],
  activityTargets: Array<{
    sourceKind: NotificationActivityState['sourceKind'];
    sourceId: string;
  }>,
) {
  const uniqueNotificationIds = [...new Set(notificationIds.filter(Boolean))];
  const uniqueActivityTargets = activityTargets.filter((target, index, array) => (
    Boolean(target.sourceId)
    && array.findIndex((entry) => entry.sourceKind === target.sourceKind && entry.sourceId === target.sourceId) === index
  ));
  const timestamp = nowIso();

  const notificationSnapshots = await Promise.all(
    uniqueNotificationIds.map((notificationId) => getDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId))),
  );

  notificationSnapshots.forEach((snapshot) => {
    if (!snapshot.exists()) {
      return;
    }

    const notification = mapNotification(snapshot as QueryDocumentSnapshot);
    if (notification.userId !== actorUserId) {
      throw new Error('One of these notifications belongs to another user.');
    }
  });

  const activitySnapshots = await Promise.all(
    uniqueActivityTargets.map((target) => getDoc(doc(db, NOTIFICATION_ACTIVITY_COLLECTION, `${actorUserId}-${target.sourceKind}-${target.sourceId}`))),
  );

  activitySnapshots.forEach((snapshot) => {
    if (!snapshot.exists()) {
      return;
    }

    const activityState = mapNotificationActivityState(snapshot as QueryDocumentSnapshot);
    if (activityState.userId !== actorUserId) {
      throw new Error('One of these notification activity items belongs to another user.');
    }
  });

  const batch = writeBatch(db);

  uniqueNotificationIds.forEach((notificationId) => {
    batch.delete(doc(db, NOTIFICATIONS_COLLECTION, notificationId));
  });

  uniqueActivityTargets.forEach((target, index) => {
    const activityRef = doc(db, NOTIFICATION_ACTIVITY_COLLECTION, `${actorUserId}-${target.sourceKind}-${target.sourceId}`);
    const snapshot = activitySnapshots[index];
    if (snapshot?.exists()) {
      batch.update(activityRef, {
        deletedAt: timestamp,
        updatedAt: timestamp,
      });
      return;
    }

    batch.set(activityRef, {
      userId: actorUserId,
      sourceKind: target.sourceKind,
      sourceId: target.sourceId,
      deletedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  await batch.commit();
}
