"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeDeletionFunction = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin_family_tree_utils_1 = require("../shared/admin-family-tree-utils");
class TreeDeletionFunction {
    db;
    constructor(db) {
        this.db = db;
    }
    async deleteTree(actorUserId, treeId) {
        const tree = await (0, admin_family_tree_utils_1.getTreeById)(this.db, treeId);
        if (tree.ownerId !== actorUserId) {
            throw new https_1.HttpsError('permission-denied', 'Only the tree owner can delete this tree.');
        }
        const people = await (0, admin_family_tree_utils_1.getPeopleByTreeId)(this.db, tree.id);
        const [relationshipSnapshot, approvalRequestsSnapshot, mergeRequestsSnapshot, mergeHistorySnapshot] = await Promise.all([
            this.db.collection(admin_family_tree_utils_1.RELATIONSHIPS_COLLECTION).where('treeId', '==', tree.id).get(),
            this.db.collection(admin_family_tree_utils_1.APPROVAL_REQUESTS_COLLECTION).where('treeId', '==', tree.id).get(),
            this.db.collection(admin_family_tree_utils_1.MERGE_REQUESTS_COLLECTION).where('involvedTreeIds', 'array-contains', tree.id).get(),
            this.db.collection(admin_family_tree_utils_1.MERGE_HISTORY_COLLECTION).where('involvedTreeIds', 'array-contains', tree.id).get(),
        ]);
        const peopleToDelete = people.filter((person) => person.treeMembershipIds.length <= 1);
        await (0, admin_family_tree_utils_1.deleteStoragePhotos)(peopleToDelete.flatMap((person) => person.photos));
        await Promise.all(people
            .filter((person) => person.treeMembershipIds.length > 1)
            .map((person) => this.db.collection(admin_family_tree_utils_1.PEOPLE_COLLECTION).doc(person.id).update({
            treeMembershipIds: person.treeMembershipIds.filter((membershipTreeId) => membershipTreeId !== tree.id),
            treeMemberships: person.treeMemberships.filter((membership) => membership.treeId !== tree.id),
            updatedAt: (0, admin_family_tree_utils_1.nowIso)(),
        })));
        const treeDeletionTimestamp = (0, admin_family_tree_utils_1.nowIso)();
        await Promise.all(mergeRequestsSnapshot.docs.map(async (snapshot) => {
            const request = (0, admin_family_tree_utils_1.mapMergeRequestData)(snapshot.id, snapshot.data());
            const remainingTreeIds = request.involvedTreeIds.filter((currentTreeId) => currentTreeId !== tree.id);
            if (remainingTreeIds.length === 0) {
                return;
            }
            await snapshot.ref.update({
                involvedTreeIds: remainingTreeIds,
                status: request.status === 'pending' || request.status === 'changes-requested' || request.status === 'approved'
                    ? 'rejected'
                    : request.status,
                reviewerComments: [
                    ...request.reviewerComments,
                    `${tree.name} was deleted on ${treeDeletionTimestamp}.`,
                ],
                updatedAt: treeDeletionTimestamp,
            });
        }));
        await Promise.all(mergeHistorySnapshot.docs.map(async (snapshot) => {
            const historyData = snapshot.data();
            const involvedTreeIds = Array.isArray(historyData.involvedTreeIds) ? historyData.involvedTreeIds.filter((value) => typeof value === 'string') : [];
            const remainingTreeIds = involvedTreeIds.filter((currentTreeId) => currentTreeId !== tree.id);
            if (remainingTreeIds.length === 0) {
                return;
            }
            await snapshot.ref.update({
                involvedTreeIds: remainingTreeIds,
                updatedAt: treeDeletionTimestamp,
            });
        }));
        await Promise.all(tree.connectedTreeIds.map(async (connectedTreeId) => {
            const connectedTreeRef = this.db.collection(admin_family_tree_utils_1.TREES_COLLECTION).doc(connectedTreeId);
            const connectedTreeSnapshot = await connectedTreeRef.get();
            if (!connectedTreeSnapshot.exists) {
                return;
            }
            const connectedTreeIds = Array.isArray(connectedTreeSnapshot.data()?.connectedTreeIds)
                ? connectedTreeSnapshot.data().connectedTreeIds.filter((value) => typeof value === 'string')
                : [];
            await connectedTreeRef.update({
                connectedTreeIds: connectedTreeIds.filter((currentTreeId) => currentTreeId !== tree.id),
                updatedAt: treeDeletionTimestamp,
            });
        }));
        const refsToDelete = [
            ...peopleToDelete.map((person) => this.db.collection(admin_family_tree_utils_1.PEOPLE_COLLECTION).doc(person.id)),
            ...relationshipSnapshot.docs.map((snapshot) => snapshot.ref),
            ...approvalRequestsSnapshot.docs.map((snapshot) => snapshot.ref),
            ...mergeRequestsSnapshot.docs
                .filter((snapshot) => {
                const request = (0, admin_family_tree_utils_1.mapMergeRequestData)(snapshot.id, snapshot.data());
                return request.involvedTreeIds.filter((currentTreeId) => currentTreeId !== tree.id).length === 0;
            })
                .map((snapshot) => snapshot.ref),
            ...mergeHistorySnapshot.docs
                .filter((snapshot) => {
                const involvedTreeIds = Array.isArray(snapshot.data().involvedTreeIds)
                    ? snapshot.data().involvedTreeIds.filter((value) => typeof value === 'string')
                    : [];
                return involvedTreeIds.filter((currentTreeId) => currentTreeId !== tree.id).length === 0;
            })
                .map((snapshot) => snapshot.ref),
            this.db.collection(admin_family_tree_utils_1.TREES_COLLECTION).doc(tree.id),
        ];
        await (0, admin_family_tree_utils_1.deleteDocumentRefs)(this.db, refsToDelete);
        return { ok: true };
    }
}
exports.TreeDeletionFunction = TreeDeletionFunction;
