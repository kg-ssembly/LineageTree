import test from 'node:test';
import assert from 'node:assert/strict';
import type { FamilyTree } from '../components/dto/tree';
import { findMaidenTreeCandidates } from '../providers/maiden-tree-search';

function makeTree(overrides: Partial<FamilyTree> & Pick<FamilyTree, 'id' | 'ownerId' | 'name'>): FamilyTree {
  return {
    discoverable: true,
    searchKeywords: [],
    memberIds: [overrides.ownerId],
    editorIds: [overrides.ownerId],
    collaborators: [{
      userId: overrides.ownerId,
      email: `${overrides.ownerId}@example.com`,
      displayName: `${overrides.ownerId} Owner`,
      role: 'owner',
    }],
    personAssignments: {},
    approvalWindowHours: 24,
    surnameVariantGroups: [],
    connectedTreeIds: [],
    membershipHistory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('prioritizes accessible maiden trees before discoverable matches', async () => {
  const trees = [
    makeTree({
      id: 'selected',
      ownerId: 'owner-a',
      name: 'Selected Tree',
    }),
    makeTree({
      id: 'accessible-tree',
      ownerId: 'owner-b',
      name: 'Smith Family',
      surnameVariantGroups: [{
        id: 'group-1',
        primarySurname: 'Smith',
        variants: ['Smyth'],
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
    }),
  ];

  const results = await findMaidenTreeCandidates(
    {
      maidenName: 'Smith',
      surnameVariantHints: ['Smyth'],
    },
    trees,
    async () => ([
      {
        id: 'discoverable-tree',
        name: 'Smith Clan',
        ownerId: 'owner-c',
        ownerDisplayName: 'Owner C',
        ownerUsername: 'ownerc',
        discoverable: true,
        matchedBy: 'surname',
        matchedLabel: 'Smith',
      },
    ]),
    'selected',
  );

  assert.equal(results[0].id, 'accessible-tree');
  assert.equal(results[0].accessible, true);
  assert.equal(results[1].id, 'discoverable-tree');
  assert.equal(results[1].accessible, false);
});

test('excludes the current tree from maiden suggestions', async () => {
  const trees = [
    makeTree({
      id: 'selected',
      ownerId: 'owner-a',
      name: 'Smith Family',
      surnameVariantGroups: [{
        id: 'group-1',
        primarySurname: 'Smith',
        variants: [],
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
    }),
  ];

  const results = await findMaidenTreeCandidates(
    { maidenName: 'Smith' },
    trees,
    async () => [],
    'selected',
  );

  assert.deepEqual(results, []);
});

test('deduplicates aliases that resolve to the same accessible and discoverable tree id', async () => {
  const trees = [
    makeTree({
      id: 'accessible-tree',
      ownerId: 'owner-a',
      name: 'Smith Family',
      surnameVariantGroups: [{
        id: 'group-1',
        primarySurname: 'Smith',
        variants: ['Smyth'],
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
    }),
  ];

  const results = await findMaidenTreeCandidates(
    { maidenName: 'Smith', surnameVariantHints: ['Smyth'] },
    trees,
    async () => ([
      {
        id: 'accessible-tree',
        name: 'Smith Family',
        ownerId: 'owner-a',
        ownerDisplayName: 'Owner A',
        ownerUsername: 'ownera',
        discoverable: true,
        matchedBy: 'surname',
        matchedLabel: 'Smith',
      },
    ]),
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'accessible-tree');
  assert.equal(results[0].accessible, false);
  assert.equal(results[0].matchedBy, 'surname');
});

test('sorts accessible matches by tree name and then owner label', async () => {
  const results = await findMaidenTreeCandidates(
    { maidenName: 'Smith' },
    [
      makeTree({ id: 'b', ownerId: 'owner-b', name: 'Zulu Family' }),
      makeTree({ id: 'a', ownerId: 'owner-a', name: 'Adams Family' }),
      makeTree({
        id: 'a-2',
        ownerId: 'owner-c',
        name: 'Adams Family',
        collaborators: [{
          userId: 'owner-c',
          email: 'owner-c@example.com',
          displayName: 'Zanele Owner',
          role: 'owner',
        }],
      }),
    ].map((tree) => ({
      ...tree,
      surnameVariantGroups: [{
        id: `${tree.id}-group`,
        primarySurname: 'Smith',
        variants: [],
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
    })),
    async () => [],
  );

  assert.deepEqual(results.map((candidate) => candidate.id), ['a', 'a-2', 'b']);
});

test('returns no maiden suggestions and skips discoverable lookup when there are no aliases', async () => {
  let lookupCount = 0;

  const results = await findMaidenTreeCandidates(
    { maidenName: '', surnameVariantHints: [] },
    [],
    async () => {
      lookupCount += 1;
      return [];
    },
  );

  assert.deepEqual(results, []);
  assert.equal(lookupCount, 0);
});
