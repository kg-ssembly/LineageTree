import { createHash } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import type { ApprovalOperation, ApprovalRequestPayload } from '../../../components/dto/approval';
import type { PersonRecord } from '../../../components/dto/person';
import { determineEligibleApproverIds } from '../../../providers/approval-eligibility';
import { mapTreeData, mapPersonData } from '../shared/admin-family-tree-utils';
import { ApprovalDecisionFunction } from './approval-decision-function';
import { consumeLimit } from './request-limits';

const operations = ['create-person', 'update-person', 'delete-person', 'create-relationship', 'update-relationship', 'delete-relationship'];
export class ApprovalSubmissionFunction {
  constructor(private readonly db: Firestore) {}

  async submit(actor: string, input: { treeId: string; operation: ApprovalOperation; payload: ApprovalRequestPayload; operationId: string }) {
    if (!input || !operations.includes(input.operation) || !input.treeId || input.treeId.includes('/') || !/^[\w-]{1,128}$/.test(input.operationId ?? '')) {
      throw new HttpsError('invalid-argument', 'Invalid change request.');
    }
    if (Buffer.byteLength(JSON.stringify(input)) > 500_000) throw new HttpsError('invalid-argument', 'This change is too large.');
    await consumeLimit(this.db, 'family-change', actor, 30);
    const requestId = createHash('sha256').update(`${actor}:${input.operationId}`).digest('hex');
    const ref = this.db.collection('approvalRequests').doc(requestId);
    const service = new ApprovalDecisionFunction(this.db);
    return this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      const treeSnapshot = await tx.get(this.db.collection('trees').doc(input.treeId));
      if (!treeSnapshot.exists || !treeSnapshot.data()?.editorIds?.includes(actor) || treeSnapshot.data()?.deleting) {
        throw new HttpsError('permission-denied', 'You cannot change this tree.');
      }
      if (existing.exists) return { status: existing.data()?.status === 'applied' ? 'applied' : 'queued', requestId, message: 'This change has already been submitted.' };
      const tree = mapTreeData(treeSnapshot.id, treeSnapshot.data()!);
      const snapshot = await tx.get(this.db.collection('persons').where('treeId', '==', tree.id));
      const people = snapshot.docs.map(d => mapPersonData(d.id, d.data()));
      const payload = input.payload;
      const target = payload.afterPerson ?? payload.deletedPerson ?? payload.relationship;
      if (!target || !/^[\w-]{1,200}$/.test(target.id) || target.treeId !== tree.id) throw new HttpsError('invalid-argument', 'Choose a record in this tree.');
      const current = people.find(p => p.id === target.id);
      if (input.operation === 'update-person' || input.operation === 'delete-person') {
        if (!current || current.updatedAt !== (payload.beforePerson ?? payload.deletedPerson)?.updatedAt) throw new HttpsError('failed-precondition', 'This profile changed. Reopen it before saving.');
        payload.beforePerson = current;
        if (input.operation === 'delete-person') payload.deletedPerson = current;
      }
      if (payload.afterPerson) {
        payload.afterPerson.ownerId = current?.ownerId ?? actor;
        payload.afterPerson.treeMembershipIds = [tree.id];
        payload.afterPerson.treeMemberships = [{ treeId: tree.id, role: 'subject', joinedAt: new Date().toISOString(), addedByUserId: actor, source: 'manual' }];
        const approvedPaths = new Set((current?.photos ?? []).flatMap(p => [p.path, p.displayPath]).filter(Boolean));
        for (const photo of payload.afterPerson.photos ?? []) {
          for (const path of [photo.path, photo.displayPath].filter(Boolean) as string[]) {
            if (!approvedPaths.has(path) && !path.startsWith(`treePhotos/${tree.id}/${target.id}/${actor}-`)) throw new HttpsError('permission-denied', 'A photo belongs to another profile.');
          }
        }
      }
      // Never trust caller-provided Storage cleanup paths.
      payload.cleanupPhotos = [];
      payload.uploadedPhotos = [];
      const { eligibleApproverIds } = determineEligibleApproverIds(tree, actor, payload, people);
      const immediate = tree.approvalWindowHours === 0 || eligibleApproverIds.length === 0;
      const timestamp = new Date().toISOString();
      const expiresAtMillis = Date.now() + Math.max(0, Math.min(168, tree.approvalWindowHours)) * 3_600_000;
      // Validate even queued changes. The decision transaction validates again against current data.
      await service.validate(tx, tree.id, input.operation, payload);
      if (immediate) await service.apply(tx, tree.id, input.operation, payload, timestamp);
      tx.create(ref, {
        treeId: tree.id, entityType: input.operation.endsWith('person') ? 'person' : 'relationship', operation: input.operation,
        targetId: target.id, title: input.operation.replace(/-/g, ' '), description: 'Family change submitted for review.',
        status: immediate ? 'applied' : 'pending', decisionMode: immediate ? 'immediate' : 'manual',
        requestedByUserId: actor, requestedByLabel: tree.collaborators.find(c => c.userId === actor)?.displayName ?? 'A collaborator',
        eligibleApproverIds, payload, expiresAtMillis, expiresAt: new Date(expiresAtMillis).toISOString(),
        createdAt: timestamp, updatedAt: timestamp, ...(immediate ? { appliedAt: timestamp } : {}),
      });
      // Serializes graph changes against other submissions, decisions, and deletion.
      tx.update(treeSnapshot.ref, { updatedAt: timestamp });
      return { status: immediate ? 'applied' : 'queued', requestId, person: immediate ? payload.afterPerson as PersonRecord ?? null : null,
        message: immediate ? 'Your change was applied.' : 'Your change was submitted for approval.' };
    });
  }
}
