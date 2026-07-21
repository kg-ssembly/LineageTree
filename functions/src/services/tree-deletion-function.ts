import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import {
  APPROVAL_REQUESTS_COLLECTION,
  MERGE_HISTORY_COLLECTION,
  MERGE_REQUESTS_COLLECTION,
  PEOPLE_COLLECTION,
  RELATIONSHIPS_COLLECTION,
  TREES_COLLECTION,
  deleteDocumentRefs,
  deleteStoragePhotos,
  getPeopleByTreeId,
  getTreeById,
  mapMergeRequestData,
  nowIso,
} from '../shared/admin-family-tree-utils';

export class TreeDeletionFunction {
  constructor(private readonly db: Firestore) {}

  async deleteTree(actorUserId: string, treeId: string) {
    const tree = await getTreeById(this.db, treeId);
    if (tree.ownerId !== actorUserId) {
      throw new HttpsError('permission-denied', 'Only the tree owner can delete this tree.');
    }

    const people = await getPeopleByTreeId(this.db, tree.id);
    const [relationshipSnapshot, approvalRequestsSnapshot, mergeRequestsSnapshot, mergeHistorySnapshot] = await Promise.all([
      this.db.collection(RELATIONSHIPS_COLLECTION).where('treeId', '==', tree.id).get(),
      this.db.collection(APPROVAL_REQUESTS_COLLECTION).where('treeId', '==', tree.id).get(),
      this.db.collection(MERGE_REQUESTS_COLLECTION).where('involvedTreeIds', 'array-contains', tree.id).get(),
      this.db.collection(MERGE_HISTORY_COLLECTION).where('involvedTreeIds', 'array-contains', tree.id).get(),
    ]);

    const peopleToDelete = people.filter((person) => person.treeMembershipIds.length <= 1);
    await deleteStoragePhotos(peopleToDelete.flatMap((person) => person.photos));

    await Promise.all(
      people
        .filter((person) => person.treeMembershipIds.length > 1)
        .map((person) => this.db.collection(PEOPLE_COLLECTION).doc(person.id).update({
          treeMembershipIds: person.treeMembershipIds.filter((membershipTreeId) => membershipTreeId !== tree.id),
          treeMemberships: person.treeMemberships.filter((membership) => membership.treeId !== tree.id),
          updatedAt: nowIso(),
        })),
    );

    const treeDeletionTimestamp = nowIso();
    await Promise.all(
      mergeRequestsSnapshot.docs.map(async (snapshot) => {
        const request = mapMergeRequestData(snapshot.id, snapshot.data());
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
      }),
    );

    await Promise.all(
      mergeHistorySnapshot.docs.map(async (snapshot) => {
        const historyData = snapshot.data();
        const involvedTreeIds = Array.isArray(historyData.involvedTreeIds) ? historyData.involvedTreeIds.filter((value): value is string => typeof value === 'string') : [];
        const remainingTreeIds = involvedTreeIds.filter((currentTreeId) => currentTreeId !== tree.id);

        if (remainingTreeIds.length === 0) {
          return;
        }

        await snapshot.ref.update({
          involvedTreeIds: remainingTreeIds,
          updatedAt: treeDeletionTimestamp,
        });
      }),
    );

    await Promise.all(
      tree.connectedTreeIds.map(async (connectedTreeId) => {
        const connectedTreeRef = this.db.collection(TREES_COLLECTION).doc(connectedTreeId);
        const connectedTreeSnapshot = await connectedTreeRef.get();
        if (!connectedTreeSnapshot.exists) {
          return;
        }

        const connectedTreeIds = Array.isArray(connectedTreeSnapshot.data()?.connectedTreeIds)
          ? connectedTreeSnapshot.data()!.connectedTreeIds.filter((value: unknown): value is string => typeof value === 'string')
          : [];
        await connectedTreeRef.update({
          connectedTreeIds: connectedTreeIds.filter((currentTreeId: string) => currentTreeId !== tree.id),
          updatedAt: treeDeletionTimestamp,
        });
      }),
    );

    const refsToDelete = [
      ...peopleToDelete.map((person) => this.db.collection(PEOPLE_COLLECTION).doc(person.id)),
      ...relationshipSnapshot.docs.map((snapshot) => snapshot.ref),
      ...approvalRequestsSnapshot.docs.map((snapshot) => snapshot.ref),
      ...mergeRequestsSnapshot.docs
        .filter((snapshot) => {
        const request = mapMergeRequestData(snapshot.id, snapshot.data());
          return request.involvedTreeIds.filter((currentTreeId: string) => currentTreeId !== tree.id).length === 0;
        })
        .map((snapshot) => snapshot.ref),
      ...mergeHistorySnapshot.docs
        .filter((snapshot) => {
          const involvedTreeIds = Array.isArray(snapshot.data().involvedTreeIds)
            ? snapshot.data().involvedTreeIds.filter((value: unknown): value is string => typeof value === 'string')
            : [];
          return involvedTreeIds.filter((currentTreeId: string) => currentTreeId !== tree.id).length === 0;
        })
        .map((snapshot) => snapshot.ref),
      this.db.collection(TREES_COLLECTION).doc(tree.id),
    ];

    await deleteDocumentRefs(this.db, refsToDelete);
    return { ok: true };
  }
}
