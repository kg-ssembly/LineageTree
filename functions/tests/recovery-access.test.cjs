const test = require('node:test');
const assert = require('node:assert/strict');
const { archivePerson, restoreDeletedPerson } = require('../lib/functions/src/services/person-recovery-function');
const { requestTreeAccess, respondToAccess } = require('../lib/functions/src/services/tree-access-function');

// Transaction double stages writes until success, so failure tests verify no partial mutations.
function database(seed) {
  const records = new Map(Object.entries(structuredClone(seed)));
  let sequence = 0;
  const doc = (path) => ({ path, id: path.split('/').pop() });
  const collection = (path, filters = []) => ({
    path, filters, where: (field, op, value) => collection(path, [...filters, [field, op, value]]),
    doc: (id = `generated-${++sequence}`) => doc(`${path}/${id}`),
  });
  const snapshot = (path) => ({ id: doc(path).id, ref: doc(path), exists: records.has(path), data: () => structuredClone(records.get(path)) });
  return {
    records, doc, collection,
    runTransaction: async (callback) => {
      const writes = [];
      const result = await callback({
        get: async (ref) => ref.filters
          ? { docs: [...records.keys()].filter((path) => path.startsWith(`${ref.path}/`) && ref.filters.every(([field, , value]) => records.get(path)[field] === value)).map(snapshot) }
          : snapshot(ref.path),
        set: (ref, data) => writes.push(() => records.set(ref.path, structuredClone(data))),
        create: (ref, data) => { assert.ok(!records.has(ref.path)); writes.push(() => records.set(ref.path, structuredClone(data))); },
        update: (ref, data) => writes.push(() => records.set(ref.path, { ...records.get(ref.path), ...structuredClone(data) })),
        delete: (ref) => writes.push(() => records.delete(ref.path)),
      });
      writes.forEach((write) => write());
      return result;
    },
  };
}
const tree = { name: 'Test family', ownerId: 'owner', editorIds: ['owner', 'editor'], memberIds: ['owner', 'editor'], collaborators: [], membershipHistory: [], personAssignments: { editor: 'child' }, discoverable: true };
const person = (id) => ({ id, treeId: 'tree', treeMembershipIds: ['tree'], firstName: id, lastName: 'Test', photos: [], birthDate: '', deathDate: '', updatedAt: 'original' });
const relationship = { id: 'link', treeId: 'tree', type: 'parent-child', fromPersonId: 'parent', toPersonId: 'child' };
const seed = () => ({ 'trees/tree': tree, 'persons/parent': person('parent'), 'persons/child': person('child'), 'relationships/link': relationship, 'users/requester': { displayName: 'Test requester', email: 'test@example.invalid' } });

test('archive and restore retain the person, photos and relationships', async () => {
  const db = database(seed());
  await archivePerson(db, 'tree', 'child', 'editor');
  assert.ok(!db.records.has('persons/child'));
  assert.ok(!db.records.has('relationships/link'));
  assert.equal(db.records.get('personTrash/child').person.firstName, 'child');
  assert.deepEqual(db.records.get('trees/tree').personAssignments, {});
  await restoreDeletedPerson(db, 'owner', 'tree', 'child');
  assert.ok(db.records.has('persons/child'));
  assert.ok(db.records.has('relationships/link'));
  assert.ok(!db.records.has('personTrash/child'));
  assert.ok([...db.records.keys()].some((key) => key.startsWith('approvalRequests/')));
});

test('unauthorised archive and restore leave all records untouched', async () => {
  const db = database(seed());
  await assert.rejects(archivePerson(db, 'tree', 'child', 'stranger'), { code: 'permission-denied' });
  assert.ok(db.records.has('persons/child'));
  await archivePerson(db, 'tree', 'child', 'owner');
  await assert.rejects(restoreDeletedPerson(db, 'editor', 'tree', 'child'), { code: 'permission-denied' });
  assert.ok(db.records.has('personTrash/child'));
});

test('restore refuses missing relatives and permits explicit person-only recovery', async () => {
  const db = database(seed());
  await archivePerson(db, 'tree', 'child', 'owner');
  db.records.delete('persons/parent');
  await assert.rejects(restoreDeletedPerson(db, 'owner', 'tree', 'child'), { code: 'failed-precondition' });
  assert.ok(!db.records.has('persons/child'));
  await restoreDeletedPerson(db, 'owner', 'tree', 'child', false);
  assert.ok(db.records.has('persons/child'));
  assert.ok(!db.records.has('relationships/link'));
});

test('restore never overwrites an existing person or relationship', async () => {
  const db = database(seed());
  await archivePerson(db, 'tree', 'child', 'owner');
  db.records.set('persons/child', { ...person('child'), firstName: 'New version' });
  await assert.rejects(restoreDeletedPerson(db, 'owner', 'tree', 'child'), { code: 'failed-precondition' });
  assert.equal(db.records.get('persons/child').firstName, 'New version');
});

test('access request retries do not create duplicate notifications', async () => {
  const db = database(seed());
  await requestTreeAccess(db, 'requester', 'tree');
  await requestTreeAccess(db, 'requester', 'tree');
  assert.equal([...db.records.keys()].filter((key) => key.startsWith('notifications/')).length, 2);
});

test('private trees reject requests without writing notifications', async () => {
  const db = database({ ...seed(), 'trees/tree': { ...tree, discoverable: false } });
  await assert.rejects(requestTreeAccess(db, 'requester', 'tree'), { code: 'not-found' });
  assert.equal([...db.records.keys()].filter((key) => key.startsWith('notifications/')).length, 0);
});

test('owner acceptance atomically grants viewer membership and updates both notices', async () => {
  const db = database(seed());
  await requestTreeAccess(db, 'requester', 'tree');
  await assert.rejects(respondToAccess(db, 'editor', 'access-tree-requester', 'accepted'), { code: 'permission-denied' });
  await respondToAccess(db, 'owner', 'access-tree-requester', 'accepted');
  assert.ok(db.records.get('trees/tree').memberIds.includes('requester'));
  assert.ok(!db.records.get('trees/tree').editorIds.includes('requester'));
  assert.equal(db.records.get('notifications/access-response-tree-requester').status, 'accepted');
  await respondToAccess(db, 'owner', 'access-tree-requester', 'accepted');
  assert.equal(db.records.get('trees/tree').memberIds.filter((id) => id === 'requester').length, 1);
});

test('requester cancellation updates both notices and grants no membership', async () => {
  const db = database(seed());
  await requestTreeAccess(db, 'requester', 'tree');
  await respondToAccess(db, 'requester', 'access-response-tree-requester', 'dismissed');
  assert.equal(db.records.get('notifications/access-tree-requester').status, 'dismissed');
  assert.ok(!db.records.get('trees/tree').memberIds.includes('requester'));
});
