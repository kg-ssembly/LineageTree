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
import type { AppNotification, NotificationActivityState } from '../components/dto/notification';
import type { FamilyTree } from '../components/dto/tree';
import {
  MERGE_REQUESTS_COLLECTION,
  NOTIFICATION_ACTIVITY_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  TREES_COLLECTION,
  type ResolvedUserAccount,
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

async function resolveDirectAccessTreeForUser(targetUser: ResolvedUserAccount) {
  const ownedTreeSnapshot = await getDocs(query(
    collection(db, TREES_COLLECTION),
    where('ownerId', '==', targetUser.id),
    limit(20),
  ));

  const ownedTrees = ownedTreeSnapshot.docs.map(mapTree);
  if (ownedTrees.length === 0) {
    throw new Error('That user does not have a tree available for direct access requests.');
  }

  if (ownedTrees.length > 1) {
    throw new Error('That user has more than one family tree. Ask them for the exact tree ID instead.');
  }

  return ownedTrees[0];
}

async function ensureNoPendingTreeAccessRequest(actorUserId: string, treeId: string) {
  const existingPendingRequestSnapshot = await getDocs(query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', actorUserId),
    where('type', '==', 'tree-access-response'),
    where('sourceTreeId', '==', treeId),
    where('status', '==', 'pending'),
    limit(1),
  ));

  if (!existingPendingRequestSnapshot.empty) {
    throw new Error('You already have a pending access request for this tree.');
  }
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

export async function requestAccessToTree(
  actorUserId: string,
  treeId: string,
) {
  const [tree, requester] = await Promise.all([
    getTreeById(treeId),
    getUserProfileById(actorUserId),
  ]);

  if (tree.discoverable !== true) {
    throw new Error('That tree is not accepting public access requests right now.');
  }

  if (tree.memberIds.includes(actorUserId)) {
    throw new Error('You already have access to this tree.');
  }

  await ensureNoPendingTreeAccessRequest(actorUserId, tree.id);

  const notificationRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
  const requesterNotificationRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
  const timestamp = nowIso();
  const requesterLabel = requester.displayName || requester.email || 'A family member';

  await setDoc(notificationRef, {
    userId: tree.ownerId,
    type: 'tree-access-request',
    status: 'pending',
    requestedByUserId: actorUserId,
    requestedByLabel: requesterLabel,
    sourceTreeId: tree.id,
    sourceTreeName: tree.name,
    targetIdentifier: requester.username?.trim() || requester.email,
    message: `${requesterLabel} requested access to ${tree.name}. Approving this helps family members join the right shared tree without building a duplicate from scratch.`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await setDoc(requesterNotificationRef, {
    userId: actorUserId,
    type: 'tree-access-response',
    status: 'pending',
    requestedByUserId: tree.ownerId,
    requestedByLabel: tree.name,
    sourceTreeId: tree.id,
    sourceTreeName: tree.name,
    targetIdentifier: requester.username?.trim() || requester.email,
    message: `You requested access to ${tree.name}. We’ll let you know when the owner responds.`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function requestAccessFromIdentifier(
  actorUserId: string,
  identifier: string,
) {
  const requester = await getUserProfileById(actorUserId);
  const trimmedIdentifier = identifier.trim();
  if (!trimmedIdentifier) {
    throw new Error('Username, email, or tree ID is required.');
  }

  try {
    const targetTree = await getTreeById(trimmedIdentifier);
    if (targetTree.discoverable !== true) {
      throw new Error('That tree is not accepting public access requests right now.');
    }

    if (targetTree.memberIds.includes(actorUserId)) {
      throw new Error('You already have access to that tree.');
    }

    await ensureNoPendingTreeAccessRequest(actorUserId, targetTree.id);

    const notificationRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
    const requesterNotificationRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
    const timestamp = nowIso();
    const requesterLabel = requester.displayName || requester.email || 'A family member';

    await setDoc(notificationRef, {
      userId: targetTree.ownerId,
      type: 'tree-access-request',
      status: 'pending',
      requestedByUserId: actorUserId,
      requestedByLabel: requesterLabel,
      sourceTreeId: targetTree.id,
      sourceTreeName: targetTree.name,
      targetIdentifier: trimmedIdentifier,
      message: `${requesterLabel} requested access directly using tree ID ${targetTree.id}. Approving this helps family members join ${targetTree.name} right away.`,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await setDoc(requesterNotificationRef, {
      userId: actorUserId,
      type: 'tree-access-response',
      status: 'pending',
      requestedByUserId: targetTree.ownerId,
      requestedByLabel: targetTree.name,
      sourceTreeId: targetTree.id,
      sourceTreeName: targetTree.name,
      targetIdentifier: trimmedIdentifier,
      message: `You requested access to ${targetTree.name}. We’ll let you know when the owner responds.`,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return;
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'That family tree no longer exists.') {
      throw error;
    }
  }

  const targetUser = await findUserByIdentifier(trimmedIdentifier);

  if (targetUser.id === actorUserId) {
    throw new Error('You cannot request access from your own account.');
  }

  const targetTree = await resolveDirectAccessTreeForUser(targetUser);
  if (targetTree.memberIds.includes(actorUserId)) {
    throw new Error('You already have access to that user’s tree.');
  }

  await ensureNoPendingTreeAccessRequest(actorUserId, targetTree.id);

  const notificationRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
  const requesterNotificationRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
  const timestamp = nowIso();
  const requesterLabel = requester.displayName || requester.email || 'A family member';

  await setDoc(notificationRef, {
    userId: targetUser.id,
    type: 'tree-access-request',
    status: 'pending',
    requestedByUserId: actorUserId,
    requestedByLabel: requesterLabel,
    sourceTreeId: targetTree.id,
    sourceTreeName: targetTree.name,
    targetIdentifier: identifier.trim(),
    message: `${requesterLabel} requested access directly from you. Approving this helps family members join ${targetTree.name} without needing to search for the exact tree first.`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await setDoc(requesterNotificationRef, {
    userId: actorUserId,
    type: 'tree-access-response',
    status: 'pending',
    requestedByUserId: targetUser.id,
    requestedByLabel: targetTree.name,
    sourceTreeId: targetTree.id,
    sourceTreeName: targetTree.name,
    targetIdentifier: identifier.trim(),
    message: `You requested access to ${targetTree.name}. We’ll let you know when the owner responds.`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function respondToTreeAccessRequest(
  actorUserId: string,
  notificationId: string,
  status: 'accepted' | 'rejected',
) {
  const notificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  const resolvedState: {
    notification: AppNotification | null;
    tree: FamilyTree | null;
    timestamp: string;
  } = {
    notification: null,
    tree: null,
    timestamp: '',
  };

  await runTransaction(db, async (transaction) => {
    const notificationSnapshot = await transaction.get(notificationRef);
    if (!notificationSnapshot.exists()) {
      throw new Error('That access request no longer exists.');
    }

    const notification = mapNotification(notificationSnapshot as QueryDocumentSnapshot);
    if (notification.userId !== actorUserId || notification.type !== 'tree-access-request') {
      throw new Error('That access request belongs to another user.');
    }

    const treeRef = doc(db, TREES_COLLECTION, notification.sourceTreeId);
    const treeSnapshot = await transaction.get(treeRef);
    if (!treeSnapshot.exists()) {
      throw new Error('That family tree no longer exists.');
    }

    const tree = mapTreeData(treeSnapshot.id, treeSnapshot.data());
    if (tree.ownerId !== actorUserId) {
      throw new Error('Only the tree owner can respond to access requests.');
    }

    if (notification.status !== 'pending') {
      throw new Error('That access request has already been handled.');
    }

    const timestamp = nowIso();
    resolvedState.notification = notification;
    resolvedState.tree = tree;
    resolvedState.timestamp = timestamp;
    if (status === 'accepted' && !tree.memberIds.includes(notification.requestedByUserId)) {
      const requester = await getUserProfileById(notification.requestedByUserId);
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
            note: `${requester.displayName || requester.email} joined after requesting access to this discoverable tree.`,
            createdAt: timestamp,
          },
        ],
        updatedAt: timestamp,
      });
    }

    transaction.update(notificationRef, {
      status,
      respondedAt: timestamp,
      updatedAt: timestamp,
    });
  });

  if (!resolvedState.notification || !resolvedState.tree || !resolvedState.timestamp) {
    return;
  }

  const requesterNotificationSnapshot = await getDocs(query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', resolvedState.notification.requestedByUserId),
    where('type', '==', 'tree-access-response'),
    where('sourceTreeId', '==', resolvedState.notification.sourceTreeId),
    where('status', '==', 'pending'),
    limit(5),
  ));

  const requesterNotificationDoc = requesterNotificationSnapshot.docs
    .sort((left, right) => {
      const leftCreatedAt = String(left.data().createdAt ?? '');
      const rightCreatedAt = String(right.data().createdAt ?? '');
      return rightCreatedAt.localeCompare(leftCreatedAt);
    })[0];

  const requesterUpdate = {
    status,
    requestedByUserId: actorUserId,
    requestedByLabel: resolvedState.tree.name,
    sourceTreeId: resolvedState.tree.id,
    sourceTreeName: resolvedState.tree.name,
    targetIdentifier: resolvedState.notification.targetIdentifier,
    message: status === 'accepted'
      ? `Your access request for ${resolvedState.tree.name} was approved. You can open the tree now.`
      : `Your access request for ${resolvedState.tree.name} was declined.`,
    updatedAt: resolvedState.timestamp,
    respondedAt: resolvedState.timestamp,
  };

  if (requesterNotificationDoc) {
    await updateDoc(requesterNotificationDoc.ref, requesterUpdate);
  } else {
    const responseNotificationRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
    await setDoc(responseNotificationRef, {
      userId: resolvedState.notification.requestedByUserId,
      type: 'tree-access-response',
      createdAt: resolvedState.timestamp,
      ...requesterUpdate,
    });
  }
}

export async function cancelTreeAccessRequest(
  actorUserId: string,
  notificationId: string,
) {
  const requesterNotificationRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
  const requesterNotificationSnapshot = await getDoc(requesterNotificationRef);
  if (!requesterNotificationSnapshot.exists()) {
    throw new Error('That access request no longer exists.');
  }

  const requesterNotification = mapNotification(requesterNotificationSnapshot as QueryDocumentSnapshot);
  if (requesterNotification.userId !== actorUserId || requesterNotification.type !== 'tree-access-response' || requesterNotification.status !== 'pending') {
    throw new Error('Only your pending access requests can be cancelled.');
  }

  const timestamp = nowIso();
  await updateDoc(requesterNotificationRef, {
    status: 'dismissed',
    message: `You cancelled your access request for ${requesterNotification.sourceTreeName}.`,
    respondedAt: timestamp,
    updatedAt: timestamp,
  });

  const ownerNotificationSnapshot = await getDocs(query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', requesterNotification.requestedByUserId),
    where('type', '==', 'tree-access-request'),
    where('requestedByUserId', '==', actorUserId),
    where('sourceTreeId', '==', requesterNotification.sourceTreeId),
    where('status', '==', 'pending'),
    limit(5),
  ));

  const ownerNotificationDoc = ownerNotificationSnapshot.docs
    .sort((left, right) => {
      const leftCreatedAt = String(left.data().createdAt ?? '');
      const rightCreatedAt = String(right.data().createdAt ?? '');
      return rightCreatedAt.localeCompare(leftCreatedAt);
    })[0];

  if (ownerNotificationDoc) {
    await updateDoc(ownerNotificationDoc.ref, {
      status: 'dismissed',
      message: `${requesterNotification.targetIdentifier || 'A family member'} cancelled their access request for ${requesterNotification.sourceTreeName}.`,
      respondedAt: timestamp,
      updatedAt: timestamp,
    });
  }
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
