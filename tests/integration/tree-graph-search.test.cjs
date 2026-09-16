const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const backend = createRequire(require('node:path').resolve('functions/package.json'));
const { initializeApp, deleteApp } = backend('firebase-admin/app');
const { getFirestore } = backend('firebase-admin/firestore');
const { readTreeGraph } = require('../../functions/lib/functions/src/services/tree-graph-function');

const treeId = 'graph-search-tree';
const personId = name => `${treeId}-${name}`;
let app, db;

before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Local emulator required.');
  app = initializeApp({ projectId: 'demo-lineagetree' }, treeId);
  db = getFirestore(app);
  const batch = db.batch();
  batch.set(db.doc(`trees/${treeId}`), { memberIds: ['graph-search-user'], personAssignments: { 'graph-search-user': personId('self') } });
  for (const name of ['self', 'parent', 'grandparent', 'target', 'target-child', 'unrelated']) {
    batch.set(db.doc(`persons/${personId(name)}`), { treeId, firstName: name, lastName: 'Family' });
  }
  [['parent', 'self'], ['grandparent', 'parent'], ['grandparent', 'target'], ['target', 'target-child']].forEach(([from, to], index) => {
    batch.set(db.doc(`relationships/${treeId}-${index}`), { treeId, type: 'parent-child', fromPersonId: personId(from), toPersonId: personId(to) });
  });
  await batch.commit();
});

after(async () => { if (app) await deleteApp(app); });

test('branch responses include the full tree count', async () => {
  const result = await readTreeGraph(db, 'graph-search-user', { treeId });
  assert.equal(result.totalPeople, 6);
  assert.ok(result.people.some(person => person.id === personId('self')));
});

test('search connection appends the shortest path and the selected persons branch', async () => {
  const result = await readTreeGraph(db, 'graph-search-user', { treeId, personId: personId('target'), mode: 'connect' });
  const ids = new Set(result.people.map(person => person.id));
  for (const required of ['self', 'parent', 'grandparent', 'target', 'target-child']) assert.ok(ids.has(personId(required)), required);
  assert.equal(ids.has(personId('unrelated')), false);
  assert.equal(result.relationships.length, 4);
  assert.equal(result.totalPeople, 6);
});

test('outsiders cannot request connecting paths', async () => {
  await assert.rejects(readTreeGraph(db, 'outsider', { treeId, personId: personId('target'), mode: 'connect' }), error => error.code === 'permission-denied');
});
