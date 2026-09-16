import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { consumeLimit } from './request-limits';
import { mapTreeData } from '../shared/admin-family-tree-utils';

const KINSHIP_SYSTEMS = new Set(['auto', 'generic', 'northern-sotho', 'nso', 'ss', 'st', 'tn', 'ts', 've', 'zu']);

export async function createTreeRecord(db: Firestore, actor: string, input: { name: string; operationId: string }) {
  const name = String(input.name ?? '').trim();
  if (!name || name.length > 120 || !/^[\w-]{1,128}$/.test(input.operationId ?? '')) throw new HttpsError('invalid-argument', 'Enter a tree name of up to 120 characters.');
  await consumeLimit(db, 'tree-create', actor, 10, 86_400_000);
  return db.runTransaction(async tx => {
    const ref = db.collection('trees').doc(input.operationId);
    const [existing, account] = await Promise.all([tx.get(ref), tx.get(db.collection('users').doc(actor))]);
    if (existing.exists) {
      if (existing.data()?.ownerId !== actor) throw new HttpsError('already-exists', 'This tree identifier is unavailable.');
      return mapTreeData(ref.id, existing.data()!);
    }
    const timestamp = new Date().toISOString();
    const owner = { userId: actor, email: account.data()?.email ?? '', displayName: account.data()?.displayName ?? '', role: 'owner' };
    const normalized = name.toLowerCase().replace(/[^\p{L}\p{N}\s'-]+/gu, ' ').replace(/\s+/g, ' ');
    const data = { name, ownerId: actor, ownerEmail: owner.email, ownerDisplayName: owner.displayName,
      discoverable: true, searchKeywords: [...new Set([normalized, ...normalized.split(' ')])],
      kinshipSystem: KINSHIP_SYSTEMS.has(String(account.data()?.preferredKinshipSystem)) ? account.data()?.preferredKinshipSystem : 'auto',
      memberIds: [actor], editorIds: [actor], collaborators: [owner], personAssignments: {}, membershipHistory: [],
      approvalWindowHours: 24, surnameVariantGroups: [], connectedTreeIds: [], createdAt: timestamp, updatedAt: timestamp };
    tx.create(ref, data); return mapTreeData(ref.id, data);
  });
}

export async function createSurnameTree(db: Firestore, actor: string, sourceTreeId: string, surname: string) {
  if (!sourceTreeId || sourceTreeId.includes('/')) throw new HttpsError('invalid-argument', 'Choose a source tree.');
  const source = await db.collection('trees').doc(sourceTreeId).get();
  if (!source.data()?.editorIds?.includes(actor) || source.data()?.deleting) throw new HttpsError('permission-denied', 'Only a source tree editor can create a connected tree.');
  const key = surname.trim().toLowerCase();
  const operationId = createHash('sha256').update(`${actor}:${sourceTreeId}:${key}`).digest('hex');
  const tree = await createTreeRecord(db, actor, { name: surname, operationId });
  const targetRef = db.collection('trees').doc(tree.id);
  if ((await targetRef.get()).data()?.surnameCopyComplete) return tree;
  const [persons, relationships] = await Promise.all([db.collection('persons').where('treeId', '==', sourceTreeId).get(), db.collection('relationships').where('treeId', '==', sourceTreeId).get()]);
  const selected = persons.docs.filter(p => [p.data().lastName, p.data().maidenName].some(value => String(value ?? '').trim().toLowerCase() === key));
  const ids = new Map(selected.map(p => [p.id, `${tree.id}-${p.id}`]));
  for (let offset = 0; offset < selected.length; offset += 100) {
    await db.runTransaction(async tx => {
      const sourceNow = await tx.get(source.ref);
      const targetNow = await tx.get(targetRef);
      if (!sourceNow.data()?.editorIds?.includes(actor) || !targetNow.data()?.editorIds?.includes(actor)) throw new HttpsError('permission-denied', 'Tree access changed.');
      const page = selected.slice(offset, offset + 100);
      const existing = await Promise.all(page.map(p => tx.get(db.collection('persons').doc(ids.get(p.id)!))));
      const timestamp = new Date().toISOString();
      page.forEach((p, index) => {
        if (existing[index].exists) return;
        // Independent records: no private notes or media are silently published to a new tree.
        tx.create(existing[index].ref, { ...p.data(), treeId: tree.id, treeMembershipIds: [tree.id], treeMemberships: [{ treeId: tree.id, role: 'subject', joinedAt: timestamp }],
          ownerId: actor, canonicalPersonId: '', duplicatePersonIds: [], notes: '', photos: [], lifeEvents: [], preferredPhotoId: '', createdAt: timestamp, updatedAt: timestamp });
        tx.set(db.collection('personLinks').doc(ids.get(p.id)!), { sourceTreeId, targetTreeId: tree.id, sourcePersonId: p.id, targetPersonId: ids.get(p.id), active: true,
          approvals: [{ treeId: sourceTreeId, editorUserId: actor }, { treeId: tree.id, editorUserId: actor }], createdAt: timestamp });
      });
    });
  }
  const selectedEdges = relationships.docs.filter(r => ids.has(r.data().fromPersonId) && ids.has(r.data().toPersonId));
  for (let offset = 0; offset < selectedEdges.length; offset += 200) {
    const batch = db.batch();
    for (const edge of selectedEdges.slice(offset, offset + 200)) batch.set(db.collection('relationships').doc(`${tree.id}-${edge.id}`), {
      ...edge.data(), treeId: tree.id, fromPersonId: ids.get(edge.data().fromPersonId), toPersonId: ids.get(edge.data().toPersonId), ownerId: actor,
    });
    await batch.commit();
  }
  await targetRef.update({ surnameCopyComplete: true });
  return tree;
}
