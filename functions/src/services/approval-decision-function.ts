import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import type { Firestore, Transaction, DocumentData } from 'firebase-admin/firestore';
import type { ApprovalRequestPayload } from '../../../components/dto/approval';
import { archivePerson } from './person-recovery-function';
import { mapApprovalRequestData, mapPersonData, mapRelationshipData, normaliseLifeEvents, deleteStoragePhotos } from '../shared/admin-family-tree-utils';
import { getPersonValidationFeedback, validateProposedRelationship } from '../../../components/family-tree-validation';

type Write = () => void;

export class ApprovalDecisionFunction {
  constructor(private readonly db: Firestore) {}

  async decide(actorUserId: string, requestId: string, decision: 'approve' | 'reject', auto = false) {
    const requestRef = this.db.collection('approvalRequests').doc(requestId);
    const cleanup = await this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(requestRef);
      if (!snapshot.exists) throw new HttpsError('not-found', 'That approval request no longer exists.');
      const request = mapApprovalRequestData(snapshot.id, snapshot.data() ?? {});
      const linkId = snapshot.data()?.linkId as string | undefined;
      const tree = await tx.get(this.db.collection('trees').doc(request.treeId));
      if (!tree.exists || tree.data()?.deleting) throw new HttpsError('not-found', 'That tree is unavailable.');
      if (!auto && (!tree.data()?.memberIds?.includes(actorUserId) || !request.eligibleApproverIds.includes(actorUserId) || actorUserId === request.requestedByUserId)) {
        throw new HttpsError('permission-denied', 'You cannot review this approval request.');
      }
      if (request.status !== 'pending') return [];
      if (linkId && decision === 'approve') {
        const link = await tx.get(this.db.collection('personLinks').doc(linkId));
        const data = link.data();
        if (!data?.active || ![data.sourcePersonId, data.targetPersonId].includes(request.targetId) || ![data.sourceTreeId, data.targetTreeId].includes(request.treeId)) {
          throw new HttpsError('failed-precondition', 'The profile link is no longer active.');
        }
        const otherTreeId = data.sourceTreeId === request.treeId ? data.targetTreeId : data.sourceTreeId;
        const otherTree = await tx.get(this.db.collection('trees').doc(otherTreeId));
        if (!otherTree.exists || otherTree.data()?.deleting) throw new HttpsError('failed-precondition', 'The linked tree is unavailable.');
      }
      if (decision === 'approve' && !linkId && !tree.data()?.editorIds?.includes(request.requestedByUserId)) {
        throw new HttpsError('failed-precondition', 'The requester no longer has permission to change this tree.');
      }
      if (auto && (!Number.isFinite(request.expiresAtMillis) || request.expiresAtMillis <= 0 || request.expiresAtMillis > Date.now())) {
        throw new HttpsError('failed-precondition', 'This approval is not due yet.');
      }
      const timestamp = new Date().toISOString();
      const label = tree.data()?.collaborators?.find((entry: { userId: string }) => entry.userId === actorUserId);
      if (decision === 'approve') {
        await this.validate(tx, request.treeId, request.operation, request.payload);
        await this.apply(tx, request.treeId, request.operation, request.payload, timestamp);
        if (linkId && request.payload.afterPerson) tx.update(this.db.collection('persons').doc(request.targetId), { linkedOrigin: requestId });
      }
      // The domain mutations and terminal status commit together. Retries cannot reapply a change.
      tx.update(requestRef, {
        status: decision === 'approve' ? 'applied' : 'rejected',
        decisionMode: auto ? 'auto' : 'manual', decidedAt: timestamp,
        decidedByUserId: auto ? '' : actorUserId,
        decidedByLabel: auto ? 'Automatic approval timer' : label?.displayName || label?.email || 'A collaborator',
        ...(decision === 'approve' ? { appliedAt: timestamp } : {}), updatedAt: timestamp,
      });
      tx.update(tree.ref, { updatedAt: timestamp });
      return decision === 'reject' ? [...(request.payload.uploadedPhotos ?? []), ...(request.payload.cleanupPhotos ?? [])] : [];
    });
    // Storage cleanup must never cause the committed decision to be reported as failed.
    if (cleanup.length) {
      try { await deleteStoragePhotos(cleanup); }
      catch { logger.warn('Approval photo cleanup requires retry', { requestId }); }
    }
    return { ok: true };
  }

  async processExpired(actorUserId: string, treeId: string) {
    const tree = await this.db.collection('trees').doc(treeId).get();
    if (!tree.exists || !tree.data()?.editorIds?.includes(actorUserId)) throw new HttpsError('permission-denied', 'Only a tree editor can process expired approvals.');
    const snapshot = await this.db.collection('approvalRequests').where('treeId', '==', treeId).where('status', '==', 'pending').get();
    for (const doc of snapshot.docs) {
      const expires = Number(doc.data().expiresAtMillis);
      if (expires > 0 && expires <= Date.now()) await this.decide('', doc.id, 'approve', true);
    }
    return { ok: true };
  }

  async processScheduledExpirations() {
    // Bounded pages, but failed requests do not starve later records. A fresh run retries failures.
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    let applied = 0;
    let failed = 0;
    const dueAt = Date.now();
    for (let page = 0; page < 10; page += 1) {
      let query = this.db.collection('approvalRequests').where('status', '==', 'pending')
        .where('expiresAtMillis', '>', 0).where('expiresAtMillis', '<=', dueAt)
        .orderBy('expiresAtMillis').limit(50);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      if (!snapshot.docs.length) break;
      for (const doc of snapshot.docs) {
        try { await this.decide('', doc.id, 'approve', true); applied += 1; }
        catch (error) {
          failed += 1;
          const attempts = Number(doc.data().autoAttempts ?? 0) + 1;
          const code = (error as { code?: string }).code ?? 'unknown';
          const needsAttention = attempts >= 5 || ['failed-precondition', 'permission-denied', 'invalid-argument', 'not-found'].includes(code);
          await this.db.runTransaction(async tx => {
            const fresh = await tx.get(doc.ref);
            if (fresh.data()?.status !== 'pending') return;
            tx.update(doc.ref, { autoAttempts: attempts, needsAttention,
              expiresAtMillis: needsAttention ? 0 : Date.now() + Math.min(60, 2 ** attempts) * 60_000,
              ...(needsAttention ? { description: 'This change could not be applied automatically. Review or reject it and submit a fresh change.', updatedAt: new Date().toISOString() } : {}),
            });
          });
          logger.error('Scheduled approval failed', { requestId: doc.id, code: (error as { code?: string }).code ?? 'unknown' });
        }
      }
      cursor = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.docs.length < 50) break;
    }
    logger.info('Approval expiry run completed', { applied, failed });
    return { applied, failed };
  }

  async validate(tx: Transaction, treeId: string, operation: string, payload: ApprovalRequestPayload) {
    const [persons, edges] = await Promise.all([
      tx.get(this.db.collection('persons').where('treeId', '==', treeId)),
      tx.get(this.db.collection('relationships').where('treeId', '==', treeId)),
    ]);
    const people = persons.docs.map(d => mapPersonData(d.id, d.data()));
    const relationships = edges.docs.map(d => mapRelationshipData(d.id, d.data()));
    if (payload.afterPerson) {
      // Approval requests can predate newer optional profile fields. Normalise the
      // proposed record before applying the shared client/server validation so a
      // valid legacy profile is not rejected merely because a field is absent.
      const next = mapPersonData(payload.afterPerson.id, payload.afterPerson as unknown as DocumentData);
      payload.afterPerson = next;
      const feedback = getPersonValidationFeedback({ people, person: next, existingPhotos: next.photos, ignorePersonId: operation === 'update-person' ? next.id : undefined });
      if (feedback.errors.length) throw new HttpsError('invalid-argument', feedback.errors[0]);
      if (operation === 'create-person') people.push(next);
      else { const index = people.findIndex(p => p.id === next.id); if (index >= 0) people[index] = next; }
    }
    for (const relationship of [...(payload.relationships ?? []), ...(payload.relationship && operation !== 'delete-relationship' ? [payload.relationship] : [])]) {
      if (relationship.treeId !== treeId || !people.some(p => p.id === relationship.fromPersonId) || !people.some(p => p.id === relationship.toPersonId)) {
        throw new HttpsError('permission-denied', 'Choose relatives in this tree.');
      }
      const message = validateProposedRelationship({ people, relationships, ...relationship, ignoreRelationshipId: operation === 'update-relationship' ? relationship.id : undefined });
      if (message) throw new HttpsError('invalid-argument', message);
      if (operation !== 'update-relationship') relationships.push(relationship);
    }
  }

  async apply(tx: Transaction, treeId: string, operation: string, payload: ApprovalRequestPayload, timestamp: string) {
    const writes: Write[] = [];
    const personRef = (id: string) => this.db.collection('persons').doc(id);
    const relationshipRef = (id: string) => this.db.collection('relationships').doc(id);
    const checkTree = (record: { treeId: string }) => {
      if (record.treeId !== treeId) throw new HttpsError('permission-denied', 'This change belongs to another tree.');
    };
    const parentEvents = async (parentIds: string[], child: { id: string; firstName: string; lastName: string; birthDate: string }) => {
      for (const id of new Set(parentIds)) {
        const parent = await tx.get(personRef(id));
        if (!parent.exists) continue;
        const data = parent.data()!;
        if (data.treeId !== treeId && !data.treeMembershipIds?.includes(treeId)) continue;
        const eventId = `child-born-${child.id}`;
        const events = (data.lifeEvents ?? []).filter((event: { id: string }) => event.id !== eventId);
        if (child.birthDate) {
          const name = `${child.firstName} ${child.lastName}`.trim();
          events.push({ id: eventId, type: 'child-born', title: `Welcomed ${name}`, date: child.birthDate, description: `${name} was born on ${child.birthDate}.` });
        }
        writes.push(() => tx.update(parent.ref, { lifeEvents: normaliseLifeEvents(events), updatedAt: timestamp }));
      }
    };
    if (operation === 'delete-person') {
      const person = payload.deletedPerson;
      if (!person) throw new HttpsError('failed-precondition', 'The deleted profile is missing.');
      checkTree(person);
      await archivePerson(this.db, treeId, person.id, undefined, tx);
      return;
    }
    if (operation === 'create-person' || operation === 'update-person') {
      const next = payload.afterPerson;
      if (!next) throw new HttpsError('failed-precondition', 'The changed profile is missing.');
      checkTree(next);
      const ref = personRef(next.id);
      const current = await tx.get(ref);
      if (operation === 'create-person' && current.exists) throw new HttpsError('already-exists', 'This family member already exists.');
      if (operation === 'update-person' && (!current.exists || current.data()?.updatedAt !== payload.beforePerson?.updatedAt)) {
        throw new HttpsError('failed-precondition', 'This profile changed after the request. Submit a fresh change from the latest profile.');
      }
      if (current.exists && current.data()?.treeId !== treeId) throw new HttpsError('permission-denied', 'This profile belongs to another tree.');
      // Only editable profile fields; memberships and ownership are not supplied by an approval.
      const fields: DocumentData = {};
      for (const key of ['firstName', 'middleNames', 'lastName', 'maidenName', 'birthSurnameStatus', 'nicknames', 'clanName', 'familyBranch', 'hometown', 'birthPlace', 'surnameVariantHints', 'birthDate', 'deathDate', 'lifeStatus', 'gender', 'notes', 'photos', 'preferredPhotoId'] as const) {
        if (next[key] !== undefined) fields[key] = next[key];
      }
      fields.lifeEvents = normaliseLifeEvents(next.lifeEvents);
      fields.updatedAt = timestamp;
      fields.linkedOrigin = '';
      if (operation === 'create-person') {
        Object.assign(fields, { treeId, treeMembershipIds: [treeId], treeMemberships: next.treeMemberships ?? [], ownerId: next.ownerId, createdAt: next.createdAt });
        writes.push(() => tx.create(ref, fields));
        for (const relationship of payload.relationships ?? []) {
          checkTree(relationship);
          const existing = await tx.get(relationshipRef(relationship.id));
          if (existing.exists) throw new HttpsError('already-exists', 'A proposed relationship already exists.');
          for (const id of new Set([relationship.fromPersonId, relationship.toPersonId])) {
            if (id === next.id) continue;
            const relative = await tx.get(personRef(id));
            if (!relative.exists || (relative.data()?.treeId !== treeId && !relative.data()?.treeMembershipIds?.includes(treeId))) {
              throw new HttpsError('failed-precondition', 'A connected family member is missing or belongs to another tree.');
            }
          }
          writes.push(() => tx.create(existing.ref, relationship));
        }
        await parentEvents((payload.relationships ?? []).filter((r) => r.type === 'parent-child' && r.toPersonId === next.id).map((r) => r.fromPersonId), next);
      } else {
        writes.push(() => tx.update(ref, fields));
        const parents = await tx.get(this.db.collection('relationships').where('treeId', '==', treeId).where('type', '==', 'parent-child').where('toPersonId', '==', next.id));
        await parentEvents(parents.docs.map((r) => String(r.data().fromPersonId)), next);
      }
    } else {
      const relationship = payload.relationship;
      if (!relationship) throw new HttpsError('failed-precondition', 'The changed relationship is missing.');
      checkTree(relationship);
      const ref = relationshipRef(relationship.id);
      const current = await tx.get(ref);
      if (current.exists && current.data()?.treeId !== treeId) throw new HttpsError('permission-denied', 'This relationship belongs to another tree.');
      if (operation === 'create-relationship') {
        if (current.exists) throw new HttpsError('already-exists', 'This relationship already exists.');
        const [from, to] = await Promise.all([tx.get(personRef(relationship.fromPersonId)), tx.get(personRef(relationship.toPersonId))]);
        if (!from.exists || !to.exists) throw new HttpsError('failed-precondition', 'A connected family member no longer exists.');
        if ([from, to].some((person) => person.data()?.treeId !== treeId && !person.data()?.treeMembershipIds?.includes(treeId))) throw new HttpsError('permission-denied', 'A connected family member belongs to another tree.');
        writes.push(() => tx.create(ref, relationship));
      } else if (operation === 'update-relationship') {
        if (!current.exists) throw new HttpsError('not-found', 'This relationship no longer exists.');
        writes.push(() => tx.update(ref, { relationshipStatus: relationship.relationshipStatus ?? '', parentChildKind: relationship.parentChildKind ?? '', updatedAt: timestamp }));
      } else if (operation === 'delete-relationship') {
        writes.push(() => tx.delete(ref));
      } else throw new HttpsError('invalid-argument', 'Unsupported approval request.');
      if (relationship.type === 'parent-child' && operation !== 'update-relationship') {
        const child = await tx.get(personRef(relationship.toPersonId));
        if (child.exists) {
          const data = child.data()!;
          await parentEvents([relationship.fromPersonId], { id: child.id, firstName: data.firstName ?? '', lastName: data.lastName ?? '', birthDate: operation === 'delete-relationship' ? '' : data.birthDate ?? '' });
        }
      }
    }
    if (writes.length > 400) throw new HttpsError('failed-precondition', 'This change needs administrator assistance.');
    writes.forEach((write) => write());
  }
}
