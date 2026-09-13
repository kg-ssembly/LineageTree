// Default is an audit. Writes require --apply and an explicitly selected project.
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const backend = createRequire(resolve(__dirname, '../functions/package.json'));
const { initializeApp } = backend('firebase-admin/app');
const { getFirestore, FieldPath } = backend('firebase-admin/firestore');
const project = process.argv.find((arg) => arg.startsWith('--project='))?.slice(10);
if (!project) throw new Error('Specify --project=YOUR_PROJECT. Default is audit-only; add --apply to migrate.');
initializeApp({ projectId: project });
const db = getFirestore();
const apply = process.argv.includes('--apply');

async function run() {
  const totals = {};
  for (const collection of ['persons', 'approvalRequests', 'mergeRequests', 'mergeHistory', 'notifications', 'notificationActivity']) {
    let cursor;
    let scanned = 0;
    let missing = 0;
    let invalid = 0;
    while (true) {
      let query = db.collection(collection).orderBy(FieldPath.documentId()).limit(200);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      if (!snapshot.size) break;
      const candidates = [];
      for (const doc of snapshot.docs) {
        scanned += 1;
        const data = doc.data();
        const patch = {};
        if (typeof data.updatedAt !== 'string' || !data.updatedAt) {
          const date = data.updatedAt?.toDate?.() ?? data.createdAt?.toDate?.() ?? new Date(data.createdAt ?? 0);
          if (Number.isFinite(date.getTime())) patch.updatedAt = date.toISOString();
          else { invalid += 1; continue; }
        }
        if (collection === 'persons' && (!data.treeId || (Array.isArray(data.treeMembershipIds) && !data.treeMembershipIds.length))) {
          invalid += 1; continue;
        }
        if (collection === 'persons' && !Array.isArray(data.treeMembershipIds) && data.treeId) {
          patch.treeMembershipIds = [data.treeId];
          if (!Array.isArray(data.treeMemberships)) patch.treeMemberships = [{ treeId: data.treeId, role: 'member', joinedAt: data.createdAt || patch.updatedAt || data.updatedAt }];
        }
        if (collection === 'mergeHistory' && Array.isArray(data.involvedTreeIds)) {
          if (!data.sourceTreeId && data.involvedTreeIds[0]) patch.sourceTreeId = data.involvedTreeIds[0];
          if (!data.targetTreeId && data.involvedTreeIds[1]) patch.targetTreeId = data.involvedTreeIds[1];
        }
        if (collection === 'approvalRequests' && !data.expiresAtMillis && Number.isFinite(Date.parse(data.expiresAt))) patch.expiresAtMillis = Date.parse(data.expiresAt);
        if (Object.keys(patch).length) { missing += 1; candidates.push({ doc, patch }); }
      }
      if (apply && candidates.length) {
        const batch = db.batch();
        // Refuse to overwrite records edited after this audit read. Reruns are safe.
        candidates.forEach(({ doc, patch }) => batch.update(doc.ref, patch, { lastUpdateTime: doc.updateTime }));
        await batch.commit();
      }
      cursor = snapshot.docs[snapshot.size - 1];
    }
    totals[collection] = { scanned, needingMigration: missing, requiringManualReview: invalid };
  }
  console.log(JSON.stringify({ project, mode: apply ? 'apply' : 'audit', totals }, null, 2));
  if (Object.values(totals).some((entry) => entry.requiringManualReview || (!apply && entry.needingMigration))) process.exitCode = 2;
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
