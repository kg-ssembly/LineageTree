import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { consumeLimit } from './request-limits';

type Role = 'editor' | 'contributor' | 'viewer';
const roles: Role[] = ['editor', 'contributor', 'viewer'];

function history(treeId: string, userId: string, role: string, action: string, note: string) {
  return { id: `${treeId}-${userId}-${Date.now()}`, userId, role, action, note, createdAt: new Date().toISOString() };
}

export async function manageCollaborator(db: Firestore, actor: string, input: { treeId: string; action: 'add' | 'remove' | 'assign' | 'clear-assignment'; email?: string; userId?: string; personId?: string; role?: Role; profilePhotoUrl?: string }) {
  if (!input.treeId || input.treeId.includes('/') || !['add', 'remove', 'assign', 'clear-assignment'].includes(input.action)) throw new HttpsError('invalid-argument', 'Invalid collaborator request.');
  await consumeLimit(db, 'collaborator-change', actor, 20);
  return db.runTransaction(async tx => {
    const treeRef = db.collection('trees').doc(input.treeId);
    const tree = await tx.get(treeRef);
    const data = tree.data();
    if (!data?.editorIds?.includes(actor) || data.deleting) throw new HttpsError('permission-denied', 'Only an editor can manage collaborators.');
    let userId = input.userId ?? '';
    let user: FirebaseFirestore.DocumentData | undefined;
    if (input.action === 'add') {
      const email = String(input.email ?? '').trim().toLowerCase();
      if (!email || !roles.includes(input.role as Role)) throw new HttpsError('invalid-argument', 'Choose an account and role.');
      let authUser;
      try { authUser = await getAuth().getUserByEmail(email); }
      catch { throw new HttpsError('not-found', 'No matching account was found.'); }
      userId = authUser.uid;
      const profile = await tx.get(db.collection('users').doc(userId));
      user = profile.data() ?? { email: authUser.email ?? '', displayName: authUser.displayName ?? '' };
      if (userId === data.ownerId || data.memberIds?.includes(userId)) throw new HttpsError('already-exists', 'That account already has access.');
      const role = input.role as Role;
      tx.update(treeRef, { memberIds: [...data.memberIds, userId], editorIds: role === 'editor' ? [...data.editorIds, userId] : data.editorIds,
        collaborators: [...(data.collaborators ?? []), { userId, email: user.email ?? '', displayName: user.displayName ?? '', role }],
        membershipHistory: [...(data.membershipHistory ?? []), history(tree.id, userId, role, 'invited', `Added as ${role}`)], updatedAt: new Date().toISOString() });
      return { ok: true };
    }
    if (!userId || userId.includes('/')) throw new HttpsError('invalid-argument', 'Choose a collaborator.');
    if (input.action === 'remove') {
      if (userId === data.ownerId) throw new HttpsError('permission-denied', 'The owner cannot be removed.');
      if (!data.memberIds?.includes(userId)) return { ok: true };
      const assignments = { ...(data.personAssignments ?? {}) }; delete assignments[userId];
      tx.update(treeRef, { memberIds: data.memberIds.filter((id: string) => id !== userId), editorIds: data.editorIds.filter((id: string) => id !== userId),
        collaborators: (data.collaborators ?? []).filter((entry: { userId: string }) => entry.userId !== userId), personAssignments: assignments,
        membershipHistory: [...(data.membershipHistory ?? []), history(tree.id, userId, 'viewer', 'left', 'Removed from the tree')], updatedAt: new Date().toISOString() });
      return { ok: true };
    }
    if (input.action === 'clear-assignment') {
      if (actor !== userId && actor !== data.ownerId) throw new HttpsError('permission-denied', 'Only the owner can clear another collaborator link.');
      const assignments = { ...(data.personAssignments ?? {}) }; delete assignments[userId];
      tx.update(treeRef, { personAssignments: assignments, updatedAt: new Date().toISOString() }); return { ok: true };
    }
    if (!input.personId || input.personId.includes('/')) throw new HttpsError('invalid-argument', 'Choose a family member.');
    if (actor !== userId && actor !== data.ownerId) throw new HttpsError('permission-denied', 'Only the owner can link another collaborator.');
    if (!data.memberIds?.includes(userId)) throw new HttpsError('failed-precondition', 'That account is not a collaborator.');
    const person = await tx.get(db.collection('persons').doc(input.personId));
    if (!person.exists || person.data()?.treeId !== tree.id) throw new HttpsError('not-found', 'That family member is unavailable.');
    const assignments = { ...(data.personAssignments ?? {}) };
    if (Object.entries(assignments).some(([id, personId]) => id !== userId && personId === input.personId)) throw new HttpsError('already-exists', 'That family member is linked to another collaborator.');
    assignments[userId] = input.personId;
    const profilePhotoUrl = typeof input.profilePhotoUrl === 'string' ? input.profilePhotoUrl.trim() : '';
    const personData = person.data() ?? {};
    const hasFamilyPhoto = Array.isArray(personData.photos) && personData.photos.length > 0;
    const safeProfilePhotoUrl = profilePhotoUrl.startsWith('https://') && profilePhotoUrl.length <= 2048 ? profilePhotoUrl : '';
    tx.update(treeRef, { personAssignments: assignments, updatedAt: new Date().toISOString() });
    if (userId === actor && !hasFamilyPhoto && safeProfilePhotoUrl && !personData.profilePhotoUrl) {
      tx.update(person.ref, { profilePhotoUrl: safeProfilePhotoUrl, updatedAt: new Date().toISOString() });
    }
    return { ok: true };
  });
}
