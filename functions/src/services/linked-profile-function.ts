import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { mapPersonData } from '../shared/admin-family-tree-utils';

const sharedFields = ['firstName', 'middleNames', 'lastName', 'maidenName', 'birthSurnameStatus', 'birthDate', 'deathDate', 'lifeStatus', 'gender', 'birthPlace'] as const;

export async function proposeLinkedUpdates(db: Firestore, personId: string, before: FirebaseFirestore.DocumentData, after: FirebaseFirestore.DocumentData, eventId: string) {
  if (after.linkedOrigin) return; // Accepted proposals must not echo back or circulate.
  const changed = sharedFields.filter(key => JSON.stringify(before[key] ?? '') !== JSON.stringify(after[key] ?? ''));
  if (!changed.length) return;
  const snapshots = await Promise.all(['sourcePersonId', 'targetPersonId'].map(field => db.collection('personLinks').where(field, '==', personId).where('active', '==', true).get()));
  const links = new Map(snapshots.flatMap(s => s.docs).map(d => [d.id, d]));
  for (const entry of links.values()) {
    const requestId = createHash('sha256').update(`${eventId}:${entry.id}`).digest('hex');
    await db.runTransaction(async tx => {
      const link = await tx.get(entry.ref);
      const existing = await tx.get(db.collection('approvalRequests').doc(requestId));
      if (existing.exists || !link.data()?.active) return;
      const data = link.data()!;
      const forward = data.sourcePersonId === personId;
      const destinationId = forward ? data.targetPersonId : data.sourcePersonId;
      const treeId = forward ? data.targetTreeId : data.sourceTreeId;
      const sourceTreeId = forward ? data.sourceTreeId : data.targetTreeId;
      const [target, tree, sourceTree] = await Promise.all([tx.get(db.collection('persons').doc(destinationId)), tx.get(db.collection('trees').doc(treeId)), tx.get(db.collection('trees').doc(sourceTreeId))]);
      if (!target.exists || target.data()?.treeId !== treeId || !tree.exists || tree.data()?.deleting || !sourceTree.exists || sourceTree.data()?.deleting) return;
      const beforePerson = mapPersonData(target.id, target.data()!);
      const afterPerson = { ...beforePerson };
      for (const key of changed) (afterPerson as unknown as Record<string, unknown>)[key] = after[key] ?? '';
      if (changed.every(key => JSON.stringify(beforePerson[key] ?? '') === JSON.stringify(afterPerson[key] ?? ''))) return;
      const timestamp = new Date().toISOString();
      const expiresAtMillis = Date.now() + Math.max(0, Math.min(168, Number(tree.data()?.approvalWindowHours ?? 24))) * 3_600_000;
      tx.create(db.collection('approvalRequests').doc(requestId), {
        treeId, operation: 'update-person', entityType: 'person', targetId: destinationId,
        title: 'Review linked profile update', description: 'A linked tree proposed changes to shared profile facts. Your notes and photos are unchanged.',
        requestedByUserId: 'linked-profile', requestedByLabel: 'Linked family tree', eligibleApproverIds: tree.data()?.editorIds ?? [],
        payload: { beforePerson, afterPerson }, linkId: link.id, sourcePersonId: personId,
        status: 'pending', decisionMode: 'manual', expiresAtMillis, expiresAt: new Date(expiresAtMillis).toISOString(), createdAt: timestamp, updatedAt: timestamp,
      });
    });
  }
}

export async function unlinkProfiles(db: Firestore, actor: string, requestId: string) {
  await db.runTransaction(async tx => {
    const requestRef = db.collection('mergeRequests').doc(requestId);
    const request = await tx.get(requestRef);
    const data = request.data();
    if (!data || data.mode !== 'linked-profiles') throw new HttpsError('failed-precondition', 'Legacy merges require a migration review before undo.');
    const trees = await Promise.all([data.sourceTreeId, data.targetTreeId].map(id => tx.get(db.collection('trees').doc(id))));
    if (!trees.some(t => t.data()?.editorIds?.includes(actor))) throw new HttpsError('permission-denied', 'Only an affected tree editor can unlink profiles.');
    const links = await tx.get(db.collection('personLinks').where('mergeRequestId', '==', requestId));
    for (const link of links.docs) tx.update(link.ref, { active: false, updatedAt: new Date().toISOString() });
    tx.update(requestRef, { status: 'undone', undoneAt: new Date().toISOString() });
    tx.set(db.collection('mergeHistory').doc(requestId), { status: 'undone', updatedAt: new Date().toISOString() }, { merge: true });
  });
}
