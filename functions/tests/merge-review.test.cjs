const test = require('node:test');
const assert = require('node:assert/strict');
const { MergeReviewFunction } = require('../lib/functions/src/services/merge-review-function');

function fixture(targetName = 'Zulu') {
  const records = {
    'trees/source': { name: 'Khumalo', ownerId: 'editor', editorIds: ['editor'] },
    'trees/target': { name: targetName, ownerId: 'other', editorIds: ['other'] },
    'mergeRequests/request': {
      sourceTreeId: 'source', targetTreeId: 'target', status: 'pending',
      selectedMatchIds: ['one', 'two'],
      preview: { matches: [
        { id: 'one', sourcePersonId: 's', targetPersonId: 't1' },
        { id: 'two', sourcePersonId: 's', targetPersonId: 't2' },
      ] },
    },
  };
  const snapshot = (path) => ({ id: path.split('/')[1], exists: !!records[path], data: () => records[path] });
  const writes = [];
  const db = {
    collection: (collection) => ({
      where: (field, operator, value) => ({ get: async () => ({ docs: Object.keys(records)
        .filter((path) => path.startsWith(`${collection}/`) && (operator === 'array-contains'
          ? records[path][field]?.includes(value) : records[path][field] === value))
        .map(snapshot) }) }),
      doc: (id = 'new-request') => ({
        id, path: `${collection}/${id}`, get: async () => snapshot(`${collection}/${id}`),
        set: async (data) => writes.push(data),
      }),
    }),
    runTransaction: async (callback) => callback({
      get: async (ref) => snapshot(ref.path),
      update: (ref, data) => {
        // Firestore rejects undefined values, including nested approval fields.
        const validate = (value) => {
          assert.notEqual(value, undefined);
          if (value && typeof value === 'object') Object.values(value).forEach(validate);
        };
        validate(data);
        writes.push(data);
      },
    }),
  };
  return { service: new MergeReviewFunction(db), writes, records };
}

for (const decision of ['reject', 'request-changes']) {
  test(`${decision} handles incompatible legacy requests and ambiguous matches without a comment`, async () => {
    const { service, writes } = fixture();
    await service.review('editor', { requestId: 'request', decision });
    assert.equal(writes.length, 1);
    assert.equal(writes[0].status, decision === 'reject' ? 'rejected' : 'changes-requested');
  });
}

test('server blocks approval of unrelated tree surnames before writing', async () => {
  const { service, writes } = fixture();
  await assert.rejects(service.review('editor', { requestId: 'request', decision: 'approve' }),
    (error) => error.code === 'failed-precondition' && /sharing a surname/.test(error.message));
  assert.equal(writes.length, 0);
});

test('server returns a readable precondition error for ambiguous approvals', async () => {
  const { service, writes } = fixture('Khumalo');
  await assert.rejects(service.review('editor', { requestId: 'request', decision: 'approve' }),
    (error) => error.code === 'failed-precondition' && /only be matched once/.test(error.message));
  assert.equal(writes.length, 0);
});


test('server creation blocks unrelated trees and maiden-only surname overlap', async () => {
  const { service, writes, records } = fixture();
  records['trees/target'].editorIds = ['editor'];
  records['persons/person'] = { treeId: 'target', treeMembershipIds: ['target'], lastName: 'Zulu', maidenName: 'Khumalo' };
  await assert.rejects(service.create('editor', 'source', 'target'),
    (error) => error.code === 'failed-precondition' && /sharing a surname/.test(error.message));
  assert.equal(writes.length, 0);
});

test('server creation accepts current surname overlap and selects each person once', async () => {
  const { service, writes, records } = fixture();
  records['trees/target'].editorIds = ['editor'];
  for (const [id, treeId] of [['s', 'source'], ['t1', 'target'], ['t2', 'target']]) {
    records[`persons/${id}`] = {
      treeId, treeMembershipIds: [treeId], firstName: 'Nomsa', lastName: 'Khumalo', birthDate: '1960-03-10', gender: 'female', hometown: 'Durban', birthPlace: 'Durban', clanName: 'Zulu',
    };
  }
  const result = await service.create('editor', 'source', 'target');
  assert.equal(result.id, 'new-request');
  assert.equal(result.preview.matches.length, 2);
  assert.equal(writes[0].selectedMatchIds.length, 1);
});
