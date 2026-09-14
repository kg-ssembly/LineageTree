"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalDecisionFunction = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const person_recovery_function_1 = require("./person-recovery-function");
const admin_family_tree_utils_1 = require("../shared/admin-family-tree-utils");
class ApprovalDecisionFunction {
    db;
    constructor(db) {
        this.db = db;
    }
    async decide(actorUserId, requestId, decision, auto = false) {
        const requestRef = this.db.collection('approvalRequests').doc(requestId);
        const cleanup = await this.db.runTransaction(async (tx) => {
            const snapshot = await tx.get(requestRef);
            if (!snapshot.exists)
                throw new https_1.HttpsError('not-found', 'That approval request no longer exists.');
            const request = (0, admin_family_tree_utils_1.mapApprovalRequestData)(snapshot.id, snapshot.data() ?? {});
            const tree = await tx.get(this.db.collection('trees').doc(request.treeId));
            if (!tree.exists)
                throw new https_1.HttpsError('not-found', 'That tree no longer exists.');
            if (!auto && (!tree.data()?.memberIds?.includes(actorUserId) || !request.eligibleApproverIds.includes(actorUserId) || actorUserId === request.requestedByUserId)) {
                throw new https_1.HttpsError('permission-denied', 'You cannot review this approval request.');
            }
            if (request.status !== 'pending')
                return [];
            if (decision === 'approve' && !tree.data()?.editorIds?.includes(request.requestedByUserId)) {
                throw new https_1.HttpsError('failed-precondition', 'The requester no longer has permission to change this tree.');
            }
            if (auto && (!Number.isFinite(request.expiresAtMillis) || request.expiresAtMillis <= 0 || request.expiresAtMillis > Date.now())) {
                throw new https_1.HttpsError('failed-precondition', 'This approval is not due yet.');
            }
            const timestamp = new Date().toISOString();
            const label = tree.data()?.collaborators?.find((entry) => entry.userId === actorUserId);
            if (decision === 'approve') {
                await this.apply(tx, request.treeId, request.operation, request.payload, timestamp);
            }
            // The domain mutations and terminal status commit together. Retries cannot reapply a change.
            tx.update(requestRef, {
                status: decision === 'approve' ? 'applied' : 'rejected',
                decisionMode: auto ? 'auto' : 'manual', decidedAt: timestamp,
                decidedByUserId: auto ? '' : actorUserId,
                decidedByLabel: auto ? 'Automatic approval timer' : label?.displayName || label?.email || 'A collaborator',
                ...(decision === 'approve' ? { appliedAt: timestamp } : {}), updatedAt: timestamp,
            });
            return decision === 'reject' ? [...(request.payload.uploadedPhotos ?? []), ...(request.payload.cleanupPhotos ?? [])] : [];
        });
        // Storage cleanup must never cause the committed decision to be reported as failed.
        if (cleanup.length) {
            try {
                await (0, admin_family_tree_utils_1.deleteStoragePhotos)(cleanup);
            }
            catch {
                firebase_functions_1.logger.warn('Approval photo cleanup requires retry', { requestId });
            }
        }
        return { ok: true };
    }
    async processExpired(actorUserId, treeId) {
        const tree = await this.db.collection('trees').doc(treeId).get();
        if (!tree.exists || !tree.data()?.editorIds?.includes(actorUserId))
            throw new https_1.HttpsError('permission-denied', 'Only a tree editor can process expired approvals.');
        const snapshot = await this.db.collection('approvalRequests').where('treeId', '==', treeId).where('status', '==', 'pending').get();
        for (const doc of snapshot.docs) {
            const expires = Number(doc.data().expiresAtMillis);
            if (expires > 0 && expires <= Date.now())
                await this.decide('', doc.id, 'approve', true);
        }
        return { ok: true };
    }
    async processScheduledExpirations() {
        // Bounded pages, but failed requests do not starve later records. A fresh run retries failures.
        let cursor;
        let applied = 0;
        let failed = 0;
        const dueAt = Date.now();
        for (let page = 0; page < 10; page += 1) {
            let query = this.db.collection('approvalRequests').where('status', '==', 'pending')
                .where('expiresAtMillis', '>', 0).where('expiresAtMillis', '<=', dueAt)
                .orderBy('expiresAtMillis').limit(50);
            if (cursor)
                query = query.startAfter(cursor);
            const snapshot = await query.get();
            if (!snapshot.docs.length)
                break;
            for (const doc of snapshot.docs) {
                try {
                    await this.decide('', doc.id, 'approve', true);
                    applied += 1;
                }
                catch (error) {
                    failed += 1;
                    firebase_functions_1.logger.error('Scheduled approval failed', { requestId: doc.id, code: error.code ?? 'unknown' });
                }
            }
            cursor = snapshot.docs[snapshot.docs.length - 1];
            if (snapshot.docs.length < 50)
                break;
        }
        firebase_functions_1.logger.info('Approval expiry run completed', { applied, failed });
        return { applied, failed };
    }
    async apply(tx, treeId, operation, payload, timestamp) {
        const writes = [];
        const personRef = (id) => this.db.collection('persons').doc(id);
        const relationshipRef = (id) => this.db.collection('relationships').doc(id);
        const checkTree = (record) => {
            if (record.treeId !== treeId)
                throw new https_1.HttpsError('permission-denied', 'This change belongs to another tree.');
        };
        const parentEvents = async (parentIds, child) => {
            for (const id of new Set(parentIds)) {
                const parent = await tx.get(personRef(id));
                if (!parent.exists)
                    continue;
                const data = parent.data();
                if (data.treeId !== treeId && !data.treeMembershipIds?.includes(treeId))
                    continue;
                const eventId = `child-born-${child.id}`;
                const events = (data.lifeEvents ?? []).filter((event) => event.id !== eventId);
                if (child.birthDate) {
                    const name = `${child.firstName} ${child.lastName}`.trim();
                    events.push({ id: eventId, type: 'child-born', title: `Welcomed ${name}`, date: child.birthDate, description: `${name} was born on ${child.birthDate}.` });
                }
                writes.push(() => tx.update(parent.ref, { lifeEvents: (0, admin_family_tree_utils_1.normaliseLifeEvents)(events), updatedAt: timestamp }));
            }
        };
        if (operation === 'delete-person') {
            const person = payload.deletedPerson;
            if (!person)
                throw new https_1.HttpsError('failed-precondition', 'The deleted profile is missing.');
            checkTree(person);
            await (0, person_recovery_function_1.archivePerson)(this.db, treeId, person.id, undefined, tx);
            return;
        }
        if (operation === 'create-person' || operation === 'update-person') {
            const next = payload.afterPerson;
            if (!next)
                throw new https_1.HttpsError('failed-precondition', 'The changed profile is missing.');
            checkTree(next);
            const ref = personRef(next.id);
            const current = await tx.get(ref);
            if (operation === 'create-person' && current.exists)
                throw new https_1.HttpsError('already-exists', 'This family member already exists.');
            if (operation === 'update-person' && (!current.exists || current.data()?.updatedAt !== payload.beforePerson?.updatedAt)) {
                throw new https_1.HttpsError('failed-precondition', 'This profile changed after the request. Submit a fresh change from the latest profile.');
            }
            if (current.exists && current.data()?.treeId !== treeId)
                throw new https_1.HttpsError('permission-denied', 'This profile belongs to another tree.');
            // Only editable profile fields; memberships and ownership are not supplied by an approval.
            const fields = {};
            for (const key of ['firstName', 'middleNames', 'lastName', 'maidenName', 'birthSurnameStatus', 'nicknames', 'clanName', 'familyBranch', 'hometown', 'birthPlace', 'surnameVariantHints', 'birthDate', 'deathDate', 'lifeStatus', 'gender', 'notes', 'photos', 'preferredPhotoId']) {
                if (next[key] !== undefined)
                    fields[key] = next[key];
            }
            fields.lifeEvents = (0, admin_family_tree_utils_1.normaliseLifeEvents)(next.lifeEvents);
            fields.updatedAt = timestamp;
            if (operation === 'create-person') {
                Object.assign(fields, { treeId, treeMembershipIds: [treeId], treeMemberships: next.treeMemberships ?? [], ownerId: next.ownerId, createdAt: next.createdAt });
                writes.push(() => tx.create(ref, fields));
                for (const relationship of payload.relationships ?? []) {
                    checkTree(relationship);
                    const existing = await tx.get(relationshipRef(relationship.id));
                    if (existing.exists)
                        throw new https_1.HttpsError('already-exists', 'A proposed relationship already exists.');
                    for (const id of new Set([relationship.fromPersonId, relationship.toPersonId])) {
                        if (id === next.id)
                            continue;
                        const relative = await tx.get(personRef(id));
                        if (!relative.exists || (relative.data()?.treeId !== treeId && !relative.data()?.treeMembershipIds?.includes(treeId))) {
                            throw new https_1.HttpsError('failed-precondition', 'A connected family member is missing or belongs to another tree.');
                        }
                    }
                    writes.push(() => tx.create(existing.ref, relationship));
                }
                await parentEvents((payload.relationships ?? []).filter((r) => r.type === 'parent-child' && r.toPersonId === next.id).map((r) => r.fromPersonId), next);
            }
            else {
                writes.push(() => tx.update(ref, fields));
                const parents = await tx.get(this.db.collection('relationships').where('treeId', '==', treeId).where('type', '==', 'parent-child').where('toPersonId', '==', next.id));
                await parentEvents(parents.docs.map((r) => String(r.data().fromPersonId)), next);
            }
        }
        else {
            const relationship = payload.relationship;
            if (!relationship)
                throw new https_1.HttpsError('failed-precondition', 'The changed relationship is missing.');
            checkTree(relationship);
            const ref = relationshipRef(relationship.id);
            const current = await tx.get(ref);
            if (current.exists && current.data()?.treeId !== treeId)
                throw new https_1.HttpsError('permission-denied', 'This relationship belongs to another tree.');
            if (operation === 'create-relationship') {
                if (current.exists)
                    throw new https_1.HttpsError('already-exists', 'This relationship already exists.');
                const [from, to] = await Promise.all([tx.get(personRef(relationship.fromPersonId)), tx.get(personRef(relationship.toPersonId))]);
                if (!from.exists || !to.exists)
                    throw new https_1.HttpsError('failed-precondition', 'A connected family member no longer exists.');
                if ([from, to].some((person) => person.data()?.treeId !== treeId && !person.data()?.treeMembershipIds?.includes(treeId)))
                    throw new https_1.HttpsError('permission-denied', 'A connected family member belongs to another tree.');
                writes.push(() => tx.create(ref, relationship));
            }
            else if (operation === 'update-relationship') {
                if (!current.exists)
                    throw new https_1.HttpsError('not-found', 'This relationship no longer exists.');
                writes.push(() => tx.update(ref, { relationshipStatus: relationship.relationshipStatus ?? '', parentChildKind: relationship.parentChildKind ?? '', updatedAt: timestamp }));
            }
            else if (operation === 'delete-relationship') {
                writes.push(() => tx.delete(ref));
            }
            else
                throw new https_1.HttpsError('invalid-argument', 'Unsupported approval request.');
            if (relationship.type === 'parent-child' && operation !== 'update-relationship') {
                const child = await tx.get(personRef(relationship.toPersonId));
                if (child.exists) {
                    const data = child.data();
                    await parentEvents([relationship.fromPersonId], { id: child.id, firstName: data.firstName ?? '', lastName: data.lastName ?? '', birthDate: operation === 'delete-relationship' ? '' : data.birthDate ?? '' });
                }
            }
        }
        if (writes.length > 400)
            throw new https_1.HttpsError('failed-precondition', 'This change needs administrator assistance.');
        writes.forEach((write) => write());
    }
}
exports.ApprovalDecisionFunction = ApprovalDecisionFunction;
