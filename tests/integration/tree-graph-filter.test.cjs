const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const backend = createRequire(require('node:path').resolve('functions/package.json'));
const { initializeApp, deleteApp } = backend('firebase-admin/app');
const { getFirestore } = backend('firebase-admin/firestore');
const { readTreeGraph } = require('../../functions/lib/functions/src/services/tree-graph-function');
let app, db;
const treeId = 'branch-filter-test';
const personId = name => `${treeId}-${name}`;
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('Local emulator required.');
  app = initializeApp({ projectId: 'demo-lineagetree' }, treeId);
  db = getFirestore(app);
  const batch = db.batch();
  batch.set(db.doc(`trees/${treeId}`), { memberIds: ['branch-viewer'], personAssignments: { 'branch-viewer': personId('root') } });
  const names = ['root', 'parent', 'grandparent', 'great-grandparent', 'sibling', 'niece', 'partner', 'grandchild', 'great-grandchild', 'unrelated', ...Array.from({ length: 7 }, (_, i) => `child${i}`)];
  names.forEach(name => batch.set(db.doc(`persons/${personId(name)}`), { treeId, firstName: name, lastName: 'Family' }));
  const edges = [ ['parent', 'root'], ['grandparent', 'parent'], ['great-grandparent', 'grandparent'], ['parent', 'sibling'], ['sibling', 'niece'], ['child0', 'grandchild'], ['grandchild', 'great-grandchild'], ...Array.from({ length: 7 }, (_, i) => ['root', `child${i}`]) ];
  edges.forEach(([from, to], i) => batch.set(db.doc(`relationships/${treeId}-${i}`), { treeId, type: 'parent-child', fromPersonId: personId(from), toPersonId: personId(to) }));
  batch.set(db.doc(`relationships/${treeId}-partner`), { treeId, type: 'spouse', fromPersonId: personId('root'), toPersonId: personId('partner') });
  await batch.commit();
});
after(async () => { if (app) await deleteApp(app); });

test('initial response contains two generations, siblings and partners without expanding other branches', async () => {
  const result = await readTreeGraph(db, 'branch-viewer', { treeId });
  const names = result.people.map(p => p.firstName).sort();
  assert.deepEqual(names, ['root', 'parent', 'grandparent', 'sibling', 'partner', 'grandchild', 'child0', 'child1', 'child2', 'child3'].sort());
  assert.equal(result.relatives[personId('root')].children.length, 7);
  assert.deepEqual(result.relatives[personId('grandparent')].parents, [personId('great-grandparent')]);
  assert.equal(result.cursor, null);
});

test('child expansion returns every direct child in one response and does not fetch grandchildren', async () => {
  const result = await readTreeGraph(db, 'branch-viewer', { treeId, personId: personId('root'), direction: 'children' });
  assert.deepEqual(result.people.map(p => p.firstName).sort(), ['root', ...Array.from({ length: 7 }, (_, i) => `child${i}`)].sort());
  assert.equal(result.relationships.length, 7);
  assert.equal(result.cursor, null);
});

test('parent expansion fetches only that cards recorded parents and rejects outsiders', async () => {
  const result = await readTreeGraph(db, 'branch-viewer', { treeId, personId: personId('grandparent'), direction: 'parents' });
  assert.deepEqual(result.people.map(p => p.firstName).sort(), ['grandparent', 'great-grandparent']);
  await assert.rejects(readTreeGraph(db, 'outsider', { treeId }), error => error.code === 'permission-denied');
});
