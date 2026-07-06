import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import type { CollaboratorRole } from '../components/dto/tree';
import { appendUniqueId, buildMembershipHistoryEntry, mapTreeData, setCollaboratorRole, upsertCollaborator } from './family-tree-mappers';
import { db } from './firebase-provider';
import { findUserByEmail, PEOPLE_COLLECTION, TREES_COLLECTION } from './family-tree-data';
import { nowIso } from './family-tree-shared';

export async function addCollaboratorToTree(actorUserId: string, treeId: string, email: string, role: CollaboratorRole) {
  const collaboratorUser = await findUserByEmail(email);
  const treeRef = doc(db, TREES_COLLECTION, treeId);

  await runTransaction(db, async (transaction) => {
    const treeSnapshot = await transaction.get(treeRef);
    if (!treeSnapshot.exists()) {
      throw new Error('That family tree no longer exists.');
    }

    const tree = mapTreeData(treeSnapshot.id, treeSnapshot.data());
    if (!tree.editorIds.includes(actorUserId)) {
      throw new Error('Only an editor can manage collaborators for this tree.');
    }

    if (collaboratorUser.id === tree.ownerId) {
      throw new Error('The owner already has access to this tree.');
    }

    if (tree.memberIds.includes(collaboratorUser.id)) {
      throw new Error('That collaborator already has access to this tree.');
    }

    const timestamp = nowIso();
    const collaborators = upsertCollaborator(tree.collaborators, {
      userId: collaboratorUser.id,
      email: collaboratorUser.email,
      displayName: collaboratorUser.displayName,
      role,
    });

    transaction.update(treeRef, {
      collaborators,
      memberIds: appendUniqueId(tree.memberIds, collaboratorUser.id),
      editorIds: role === 'editor' ? appendUniqueId(tree.editorIds, collaboratorUser.id) : tree.editorIds,
      membershipHistory: [
        ...tree.membershipHistory,
        buildMembershipHistoryEntry(treeId, collaboratorUser.id, role, 'invited', timestamp, `Added as ${role}`),
      ],
      updatedAt: timestamp,
    });
  });
}

export async function removeCollaboratorFromTree(actorUserId: string, treeId: string, collaboratorUserId: string) {
  const treeRef = doc(db, TREES_COLLECTION, treeId);

  await runTransaction(db, async (transaction) => {
    const treeSnapshot = await transaction.get(treeRef);
    if (!treeSnapshot.exists()) {
      throw new Error('That family tree no longer exists.');
    }

    const tree = mapTreeData(treeSnapshot.id, treeSnapshot.data());
    if (!tree.editorIds.includes(actorUserId)) {
      throw new Error('Only an editor can manage collaborators for this tree.');
    }

    if (collaboratorUserId === tree.ownerId) {
      throw new Error('The owner cannot be removed from the tree.');
    }

    if (!tree.memberIds.includes(collaboratorUserId)) {
      throw new Error('That collaborator is no longer on this tree.');
    }

    const nextPersonAssignments = Object.fromEntries(
      Object.entries(tree.personAssignments).filter(([userId]) => userId !== collaboratorUserId),
    );
    const timestamp = nowIso();

    transaction.update(treeRef, {
      collaborators: tree.collaborators.filter((collaborator) => collaborator.userId !== collaboratorUserId),
      memberIds: tree.memberIds.filter((memberId) => memberId !== collaboratorUserId),
      editorIds: tree.editorIds.filter((editorId) => editorId !== collaboratorUserId),
      personAssignments: nextPersonAssignments,
      membershipHistory: [
        ...tree.membershipHistory,
        buildMembershipHistoryEntry(treeId, collaboratorUserId, 'viewer', 'left', timestamp),
      ],
      updatedAt: timestamp,
    });
  });
}

export async function assignTreePersonToUser(actorUserId: string, treeId: string, userId: string, personId: string) {
  const treeRef = doc(db, TREES_COLLECTION, treeId);
  const personRef = doc(db, PEOPLE_COLLECTION, personId);

  if (actorUserId === userId) {
    const otherTreeSnapshots = await getDocs(query(collection(db, TREES_COLLECTION), where('memberIds', 'array-contains', userId)));
    const otherLinkedTree = otherTreeSnapshots.docs.find((snapshot) => {
      if (snapshot.id === treeId) {
        return false;
      }

      const assignedPersonId = snapshot.data().personAssignments?.[userId];
      return typeof assignedPersonId === 'string' && assignedPersonId.trim().length > 0;
    });

    if (otherLinkedTree) {
      const otherTreeName = typeof otherLinkedTree.data().name === 'string' && otherLinkedTree.data().name.trim()
        ? otherLinkedTree.data().name.trim()
        : 'your other family tree';
      throw new Error(`Unlink your profile from "${otherTreeName}" before claiming yourself in another family tree.`);
    }
  }

  await runTransaction(db, async (transaction) => {
    const [treeSnapshot, personSnapshot] = await Promise.all([
      transaction.get(treeRef),
      transaction.get(personRef),
    ]);

    if (!treeSnapshot.exists()) {
      throw new Error('That family tree no longer exists.');
    }

    const tree = mapTreeData(treeSnapshot.id, treeSnapshot.data());
    if (!tree.memberIds.includes(actorUserId)) {
      throw new Error('You are no longer a collaborator on this tree.');
    }

    if (actorUserId !== userId && tree.ownerId !== actorUserId) {
      throw new Error('Only the tree owner can link another collaborator to a family member.');
    }

    if (!tree.memberIds.includes(userId)) {
      throw new Error('You are no longer a collaborator on this tree.');
    }

    if (!personSnapshot.exists()) {
      throw new Error('That family member no longer exists.');
    }

    const personMembershipIds = Array.isArray(personSnapshot.data().treeMembershipIds)
      ? personSnapshot.data().treeMembershipIds
      : [personSnapshot.data().treeId].filter(Boolean);
    if (!personMembershipIds.includes(treeId)) {
      throw new Error('That family member belongs to a different family tree.');
    }

    const currentAssignedPersonId = tree.personAssignments[userId] ?? null;
    if (currentAssignedPersonId === personId) {
      return;
    }

    if (actorUserId === userId && currentAssignedPersonId) {
      throw new Error('Unlink your current claimed profile before claiming another family member.');
    }

    const assignedUserId = Object.entries(tree.personAssignments).find(
      ([currentUserId, currentPersonId]) => currentPersonId === personId && currentUserId !== userId,
    )?.[0];
    if (assignedUserId) {
      throw new Error('That family member is already linked to another collaborator.');
    }

    const timestamp = nowIso();
    const nextCollaborators = userId === tree.ownerId
      ? tree.collaborators
      : setCollaboratorRole(tree.collaborators, userId, 'editor');
    const nextEditorIds = userId === tree.ownerId
      ? tree.editorIds
      : appendUniqueId(tree.editorIds, userId);

    transaction.update(treeRef, {
      collaborators: nextCollaborators,
      memberIds: appendUniqueId(tree.memberIds, userId),
      editorIds: nextEditorIds,
      personAssignments: {
        ...tree.personAssignments,
        [userId]: personId,
      },
      membershipHistory: [
        ...tree.membershipHistory,
        buildMembershipHistoryEntry(
          treeId,
          userId,
          userId === tree.ownerId ? 'owner' : 'editor',
          'linked-person',
          timestamp,
          'Linked to a family member profile and granted editor access.',
        ),
      ],
      updatedAt: timestamp,
    });
  });
}

export async function clearTreePersonAssignment(treeId: string, userId: string) {
  const treeRef = doc(db, TREES_COLLECTION, treeId);

  await runTransaction(db, async (transaction) => {
    const treeSnapshot = await transaction.get(treeRef);
    if (!treeSnapshot.exists()) {
      throw new Error('That family tree no longer exists.');
    }

    const tree = mapTreeData(treeSnapshot.id, treeSnapshot.data());
    if (!tree.memberIds.includes(userId)) {
      throw new Error('You are no longer a collaborator on this tree.');
    }

    if (!tree.personAssignments[userId]) {
      return;
    }

    const nextAssignments = { ...tree.personAssignments };
    delete nextAssignments[userId];
    const timestamp = nowIso();
    const nextCollaborators = userId === tree.ownerId
      ? tree.collaborators
      : setCollaboratorRole(tree.collaborators, userId, 'viewer');
    const nextEditorIds = userId === tree.ownerId
      ? tree.editorIds
      : tree.editorIds.filter((editorId) => editorId !== userId);

    transaction.update(treeRef, {
      collaborators: nextCollaborators,
      editorIds: nextEditorIds,
      personAssignments: nextAssignments,
      membershipHistory: [
        ...tree.membershipHistory,
        buildMembershipHistoryEntry(
          treeId,
          userId,
          userId === tree.ownerId ? 'owner' : 'viewer',
          'role-changed',
          timestamp,
          'Profile link removed. Access returned to viewer.',
        ),
      ],
      updatedAt: timestamp,
    });
  });
}
