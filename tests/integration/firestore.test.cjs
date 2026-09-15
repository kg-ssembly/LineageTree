const { readFileSync } = require('node:fs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, updateDoc, setDoc, collection, query, where, orderBy, limit, getDocs, or } = require('firebase/firestore');
const { createRequire } = require('node:module');
const backend = createRequire(require('node:path').resolve('functions/package.json'));
const { initializeApp, deleteApp } = backend('firebase-admin/app');
const { getFirestore } = backend('firebase-admin/firestore');
const { ApprovalDecisionFunction } = require('../../functions/lib/functions/src/services/approval-decision-function');
const { ref, uploadBytes, getBytes } = require('firebase/storage');
let env, app, admin;
const tree = { ownerId: 'owner', memberIds: ['owner', 'editor', 'viewer'], editorIds: ['owner', 'editor'], collaborators: [], personAssignments: {}, membershipHistory: [], discoverable: false };
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run through test:integration; production access is forbidden.');
  env = await initializeTestEnvironment({ projectId: 'demo-lineagetree', firestore: { rules: readFileSync('firestore.rules', 'utf8') }, storage: { rules: readFileSync('storage.rules', 'utf8') } });
  app = initializeApp({ projectId: 'demo-lineagetree' }, 'integration'); admin = getFirestore(app);
  await admin.doc('trees/test').set(tree);
  await admin.doc('persons/test').set({ treeId: 'test', ownerId: 'owner', treeMembershipIds: ['test'], firstName: 'Before', lastName: 'Family', lifeEvents: [], photos: [], updatedAt: 'original' });
});
after(async () => { await env?.cleanup(); if (app) await deleteApp(app); });
test('viewer can read but cannot change family data; outsider cannot read private data', async () => {
  const viewer = env.authenticatedContext('viewer').firestore();
  await assertSucceeds(getDoc(doc(viewer, 'persons/test')));
  await assertFails(updateDoc(doc(viewer, 'persons/test'), { firstName: 'Forbidden' }));
  await assertFails(getDoc(doc(env.authenticatedContext('outsider').firestore(), 'persons/test')));
});

test('clients cannot forge trees, memberships, approvals, or family records', async () => {
  const editor = env.authenticatedContext('editor').firestore();
  await assertFails(setDoc(doc(editor, 'trees/forged'), { ownerId: 'editor', memberIds: ['editor'], editorIds: ['editor'] }));
  await assertFails(updateDoc(doc(editor, 'trees/test'), { memberIds: ['owner', 'editor', 'viewer', 'outsider'] }));
  await assertFails(setDoc(doc(editor, 'persons/forged'), { treeId: 'test', ownerId: 'editor' }));
  await assertFails(setDoc(doc(editor, 'relationships/forged'), { treeId: 'test', ownerId: 'editor' }));
  await assertFails(setDoc(doc(editor, 'approvalRequests/forged'), { treeId: 'test', requestedByUserId: 'editor' }));
  await assertFails(setDoc(doc(editor, 'mergeHistory/forged'), { involvedTreeIds: ['test'] }));
});

test('discoverability does not expose private tree or account documents', async () => {
  await admin.doc('trees/discoverable').set({ ...tree, ownerId: 'owner', memberIds: ['owner'], editorIds: ['owner'], discoverable: true });
  await admin.doc('users/owner').set({ email: 'owner@example.test', displayName: 'Owner' });
  const outsider = env.authenticatedContext('outsider').firestore();
  await assertFails(getDoc(doc(outsider, 'trees/discoverable')));
  await assertFails(getDoc(doc(outsider, 'users/owner')));
});
test('private user photo folders reject reads and writes from other accounts', async () => {
  const owner = env.authenticatedContext('owner').storage();
  const outsider = env.authenticatedContext('outsider').storage();
  await assertSucceeds(uploadBytes(ref(owner, 'users/owner/test.jpg'), new Uint8Array([1, 2, 3])));
  await assertFails(getBytes(ref(outsider, 'users/owner/test.jpg')));
  await assertFails(uploadBytes(ref(outsider, 'users/owner/forbidden.jpg'), new Uint8Array([1])));
});

test('tree viewers cannot upload or replace photos', async () => {
  const viewer = env.authenticatedContext('viewer').storage();
  const editor = env.authenticatedContext('editor').storage();
  await assertFails(uploadBytes(ref(viewer, 'treePhotos/test/test/viewer-photo.jpg'), new Uint8Array([1])));
  await assertSucceeds(uploadBytes(ref(editor, 'treePhotos/test/test/editor-photo.jpg'), new Uint8Array([1]), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(editor, 'treePhotos/test/test/oversize.jpg'), new Uint8Array(2 * 1024 * 1024 + 1), { contentType: 'image/jpeg' }));
});
test('ordered activity includes newest records and pending work remains separately accessible', async () => {
  const batch = admin.batch();
  for (let i = 0; i < 125; i++) batch.set(admin.doc(`notifications/n${String(i).padStart(3, '0')}`), {
    userId: 'owner', status: i === 0 ? 'pending' : 'accepted', updatedAt: new Date(1700000000000 + i * 1000).toISOString(),
  });
  await batch.commit();
  const db = env.authenticatedContext('owner').firestore();
  const latest = await getDocs(query(collection(db, 'notifications'), where('userId', '==', 'owner'), orderBy('updatedAt', 'desc'), limit(120)));
  assert.equal(latest.docs[0].id, 'n124');
  assert.equal(latest.docs.some((doc) => doc.id === 'n000'), false);
  const pending = await getDocs(query(collection(db, 'notifications'), where('userId', '==', 'owner'), where('status', '==', 'pending')));
  assert.equal(pending.docs[0].id, 'n000');
  await assertFails(getDocs(query(collection(env.authenticatedContext('outsider').firestore(), 'notifications'), where('userId', '==', 'owner'))));
});
test('approval change and status are atomic, repeat-safe, and reject stale edits', async () => {
  const service = new ApprovalDecisionFunction(admin);
  const beforePerson = { id: 'test', treeId: 'test', firstName: 'Before', lastName: 'Family', lifeEvents: [], photos: [], updatedAt: 'original' };
  const request = { treeId: 'test', operation: 'update-person', status: 'pending', requestedByUserId: 'editor', eligibleApproverIds: ['owner'], expiresAtMillis: Date.now() - 1000, payload: { beforePerson, afterPerson: { ...beforePerson, firstName: 'After' } } };
  await admin.doc('approvalRequests/atomic').set(request);
  await Promise.all([service.decide('owner', 'atomic', 'approve'), service.decide('', 'atomic', 'approve', true)]);
  assert.equal((await admin.doc('persons/test').get()).data().firstName, 'After');
  assert.equal((await admin.doc('approvalRequests/atomic').get()).data().status, 'applied');
  await admin.doc('approvalRequests/stale').set(request);
  await assert.rejects(service.decide('owner', 'stale', 'approve'), { code: 'failed-precondition' });
  assert.equal((await admin.doc('approvalRequests/stale').get()).data().status, 'pending');
  assert.equal((await admin.doc('persons/test').get()).data().firstName, 'After');
});
test('scheduled processing applies due work without an editor session and skips future work', async () => {
  const request = { treeId: 'test', operation: 'delete-relationship', status: 'pending', requestedByUserId: 'editor', eligibleApproverIds: [], payload: { relationship: { id: 'expired-link', treeId: 'test', type: 'spouse', fromPersonId: 'a', toPersonId: 'b' } }, expiresAtMillis: Date.now() - 1000 };
  await admin.doc('relationships/expired-link').set(request.payload.relationship);
  await admin.doc('approvalRequests/due').set(request);
  await admin.doc('approvalRequests/future').set({ ...request, expiresAtMillis: Date.now() + 60000 });
  await new ApprovalDecisionFunction(admin).processScheduledExpirations();
  assert.equal((await admin.doc('approvalRequests/due').get()).data().status, 'applied');
  assert.equal((await admin.doc('approvalRequests/future').get()).data().status, 'pending');
});

test('member queries used by the live workspace satisfy Firestore rules', async () => {
 const db = env.authenticatedContext('owner').firestore();
 await assertSucceeds(getDocs(query(collection(db, 'persons'), where('treeMembershipIds', 'array-contains', 'test'), where('treeId', 'in', ['test']))));
 await assertSucceeds(getDocs(query(collection(db, 'relationships'), where('treeId', '==', 'test'))));
 await assertSucceeds(getDocs(query(collection(db, 'mergeRequests'), or(where('sourceTreeId', '==', 'test'), where('targetTreeId', '==', 'test')), orderBy('updatedAt', 'desc'), limit(81))));
 await assertSucceeds(getDocs(query(collection(db, 'mergeHistory'), or(where('sourceTreeId', '==', 'test'), where('targetTreeId', '==', 'test')), orderBy('updatedAt', 'desc'), limit(81))));
});

test('approved creation commits the person, relationship, parent event and decision together', async () => {
  const timestamp = new Date().toISOString();
  const person = { id: 'new-child', treeId: 'test', ownerId: 'editor', firstName: 'Child', lastName: 'Family', birthDate: '2000-01-01', deathDate: '', lifeEvents: [], photos: [], createdAt: timestamp, updatedAt: timestamp };
  const relationship = { id: 'new-parent-link', treeId: 'test', ownerId: 'editor', type: 'parent-child', fromPersonId: 'test', toPersonId: 'new-child', createdAt: timestamp };
  await admin.doc('approvalRequests/create-bundle').set({ treeId: 'test', requestedByUserId: 'editor', eligibleApproverIds: ['owner'], operation: 'create-person', status: 'pending', payload: { afterPerson: person, relationships: [relationship] } });
  const service = new ApprovalDecisionFunction(admin);
  await service.decide('owner', 'create-bundle', 'approve');
  await service.decide('owner', 'create-bundle', 'approve');
  assert.equal((await admin.doc('persons/new-child').get()).data().firstName, 'Child');
  assert.equal((await admin.doc('relationships/new-parent-link').get()).exists, true);
  assert.equal((await admin.doc('persons/test').get()).data().lifeEvents.filter((event) => event.id === 'child-born-new-child').length, 1);
  assert.equal((await admin.doc('approvalRequests/create-bundle').get()).data().status, 'applied');
});

test('approved deletion archives the person and removes links atomically with its decision', async () => {
  const person = { id: 'new-child', ...(await admin.doc('persons/new-child').get()).data() };
  await admin.doc('approvalRequests/delete-bundle').set({ treeId: 'test', requestedByUserId: 'editor', eligibleApproverIds: ['owner'], operation: 'delete-person', status: 'pending', payload: { deletedPerson: person } });
  const service = new ApprovalDecisionFunction(admin);
  await service.decide('owner', 'delete-bundle', 'approve');
  await service.decide('owner', 'delete-bundle', 'approve');
  assert.equal((await admin.doc('persons/new-child').get()).exists, false);
  assert.equal((await admin.doc('relationships/new-parent-link').get()).exists, false);
  assert.equal((await admin.doc('personTrash/new-child').get()).exists, true);
  assert.equal((await admin.doc('approvalRequests/delete-bundle').get()).data().status, 'applied');
});
