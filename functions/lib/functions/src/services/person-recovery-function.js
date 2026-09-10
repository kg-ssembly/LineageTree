"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.archivePerson = archivePerson;
exports.restoreDeletedPerson = restoreDeletedPerson;
const https_1 = require("firebase-functions/v2/https");
const family_tree_validation_1 = require("../../../components/family-tree-validation");
async function archivePerson(db, treeId, personId, actorId) {
    return db.runTransaction(async (tx) => {
        const treeRef = db.doc(`trees/${treeId}`);
        const personRef = db.doc(`persons/${personId}`);
        const [tree, person, outgoing, incoming] = await Promise.all([
            tx.get(treeRef), tx.get(personRef),
            tx.get(db.collection('relationships').where('treeId', '==', treeId).where('fromPersonId', '==', personId)),
            tx.get(db.collection('relationships').where('treeId', '==', treeId).where('toPersonId', '==', personId)),
        ]);
        if (!tree.exists || (actorId && !tree.data()?.editorIds?.includes(actorId)))
            throw new https_1.HttpsError('permission-denied', 'Only a tree editor can remove this person.');
        if (!person.exists)
            return { ok: true };
        if (person.data()?.treeId !== treeId)
            throw new https_1.HttpsError('permission-denied', 'This person belongs to another tree.');
        if ((person.data()?.treeMembershipIds?.length ?? 1) > 1)
            throw new https_1.HttpsError('failed-precondition', 'This person is shared between trees. Resolve their memberships before deleting them.');
        const links = [...new Map([...outgoing.docs, ...incoming.docs].map((r) => [r.id, r])).values()];
        const parentIds = [...new Set(incoming.docs.filter((r) => r.data().type === 'parent-child').map((r) => String(r.data().fromPersonId)))];
        const parents = await Promise.all(parentIds.map((id) => tx.get(db.doc(`persons/${id}`))));
        if (links.length + parents.length > 400)
            throw new https_1.HttpsError('failed-precondition', 'This person needs administrator-assisted deletion.');
        tx.set(db.doc(`personTrash/${personId}`), {
            treeId, person: { ...person.data(), id: personId },
            relationships: links.map((r) => ({ ...r.data(), id: r.id })),
            deletedAt: new Date().toISOString(), deletedByUserId: actorId ?? '',
        });
        links.forEach((r) => tx.delete(r.ref));
        parents.filter((p) => p.exists).forEach((p) => tx.update(p.ref, {
            lifeEvents: (p.data()?.lifeEvents ?? []).filter((event) => event.id !== `child-born-${personId}`),
            updatedAt: new Date().toISOString(),
        }));
        tx.delete(personRef);
        const assignments = { ...(tree.data()?.personAssignments ?? {}) };
        Object.keys(assignments).forEach((id) => { if (assignments[id] === personId)
            delete assignments[id]; });
        tx.update(treeRef, { personAssignments: assignments, updatedAt: new Date().toISOString() });
        return { ok: true };
    });
}
async function restoreDeletedPerson(db, actorId, treeId, personId, restoreLinks = true) {
    if (!treeId || !personId || treeId.includes('/') || personId.includes('/'))
        throw new https_1.HttpsError('invalid-argument', 'Choose a deleted person.');
    return db.runTransaction(async (tx) => {
        const treeRef = db.doc(`trees/${treeId}`);
        const trashRef = db.doc(`personTrash/${personId}`);
        const personRef = db.doc(`persons/${personId}`);
        const [tree, trash, current] = await Promise.all([tx.get(treeRef), tx.get(trashRef), tx.get(personRef)]);
        if (!tree.exists || tree.data()?.ownerId !== actorId)
            throw new https_1.HttpsError('permission-denied', 'Only the tree owner can restore deleted records.');
        if (!trash.exists || trash.data()?.treeId !== treeId)
            throw new https_1.HttpsError('not-found', 'This deleted record is no longer available.');
        if (current.exists)
            throw new https_1.HttpsError('failed-precondition', 'This person already exists. Refresh the tree.');
        const person = trash.data().person;
        const relationships = (restoreLinks ? trash.data().relationships ?? [] : []);
        if (relationships.length > 400)
            throw new https_1.HttpsError('failed-precondition', 'This record needs administrator-assisted recovery.');
        const otherIds = [...new Set(relationships.flatMap((r) => [r.fromPersonId, r.toPersonId]).filter((id) => id !== personId))];
        const otherPeople = await Promise.all(otherIds.map((id) => tx.get(db.doc(`persons/${id}`))));
        const existingRelationships = await Promise.all(relationships.map((r) => tx.get(db.doc(`relationships/${r.id}`))));
        if (otherPeople.some((p) => !p.exists || p.data()?.treeId !== treeId) || existingRelationships.some((r) => r.exists)) {
            throw new https_1.HttpsError('failed-precondition', 'A connected person is missing or a relationship has changed. Restore connected people first or ask an administrator to resolve the conflict.');
        }
        if (relationships.length) {
            const [peopleSnapshot, linksSnapshot] = await Promise.all([
                tx.get(db.collection('persons').where('treeId', '==', treeId)),
                tx.get(db.collection('relationships').where('treeId', '==', treeId)),
            ]);
            const people = [person, ...peopleSnapshot.docs.map((p) => ({ ...p.data(), id: p.id }))];
            const currentLinks = linksSnapshot.docs.map((r) => ({ ...r.data(), id: r.id }));
            for (const relationship of relationships) {
                const error = (0, family_tree_validation_1.validateProposedRelationship)({ people, relationships: currentLinks, ...relationship });
                if (error)
                    throw new https_1.HttpsError('failed-precondition', `Relationships cannot be restored: ${error} Restore the person only and review their connections.`);
                currentLinks.push(relationship);
            }
        }
        const timestamp = new Date().toISOString();
        tx.create(personRef, { ...person, updatedAt: timestamp });
        relationships.forEach((relationship) => tx.create(db.doc(`relationships/${relationship.id}`), relationship));
        if (person.birthDate) {
            const parentIds = new Set(relationships.filter((r) => r.type === 'parent-child' && r.toPersonId === personId).map((r) => r.fromPersonId));
            otherPeople.filter((p) => parentIds.has(p.id)).forEach((p) => tx.update(p.ref, {
                lifeEvents: [...(p.data()?.lifeEvents ?? []).filter((event) => event.id !== `child-born-${personId}`), {
                        id: `child-born-${personId}`, type: 'child-born', title: `Welcomed ${person.firstName} ${person.lastName}`,
                        date: person.birthDate, description: `${person.firstName} ${person.lastName} was born on ${person.birthDate}.`,
                    }], updatedAt: timestamp,
            }));
        }
        tx.delete(trashRef);
        tx.create(db.collection('approvalRequests').doc(), {
            treeId, entityType: 'person', operation: 'create-person', targetId: personId,
            title: `Restore ${person.firstName} ${person.lastName}`, description: 'Restored from trash by the tree owner.',
            status: 'applied', decisionMode: 'immediate', requestedByUserId: actorId,
            requestedByLabel: tree.data()?.collaborators?.find((c) => c.userId === actorId)?.displayName || 'Tree owner',
            eligibleApproverIds: [], payload: { afterPerson: person, relationships },
            expiresAt: timestamp, expiresAtMillis: Date.now(), createdAt: timestamp, updatedAt: timestamp, appliedAt: timestamp,
        });
        return { ok: true };
    });
}
