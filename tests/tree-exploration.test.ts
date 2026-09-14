import { test } from 'node:test';
import assert from 'node:assert/strict';
import { branchIds, hiddenParentIds, hiddenChildIds, describeFamilyStep, naturalRelationship, connectorOnPath, lineageIds, scopeIds, relationshipPath } from '../components/tree-exploration';
import type { RelationshipRecord } from '../components/dto/relationship';

const edge = (from: string, to: string, type: RelationshipRecord['type'] = 'parent-child', extra: Partial<RelationshipRecord> = {}): RelationshipRecord => ({
  id: `${from}-${to}`, fromPersonId: from, toPersonId: to, type, treeId: 'tree', ownerId: 'owner', createdAt: '', ...extra,
});
const family = [edge('grandparent', 'parent'), edge('parent', 'me'), edge('parent', 'sibling'), edge('me', 'child'), edge('me', 'partner', 'spouse'), edge('sibling', 'niece')];

test('close family includes siblings and excludes distant relatives', () => {
  assert.deepEqual(scopeIds('me', family, 'close'), new Set(['me', 'parent', 'sibling', 'child', 'partner']));
  assert.equal(scopeIds('me', family, 'full'), null);
});
test('lineage views follow parent direction and terminate on malformed cycles', () => {
  assert.deepEqual(lineageIds('me', family, 'ancestors'), new Set(['me', 'parent', 'grandparent']));
  assert.deepEqual(lineageIds('parent', family, 'descendants'), new Set(['parent', 'me', 'sibling', 'child', 'niece']));
  assert.equal(lineageIds('a', [edge('a', 'b'), edge('b', 'a')], 'descendants').size, 2);
});
test('trace gives directional steps, shortest route and disconnected state', () => {
  assert.deepEqual(relationshipPath('me', 'sibling', family)?.map(s => s.relation), ['parent', 'child']);
  assert.deepEqual(relationshipPath('me', 'me', family), []);
  assert.equal(relationshipPath('me', 'unknown', family), null);
  assert.equal(relationshipPath('me', 'partner', family)?.length, 1);
});
test('trace preserves non-biological and former partner meanings', () => {
  assert.equal(relationshipPath('parent', 'child', [edge('parent', 'child', 'parent-child', { parentChildKind: 'adopted' })])?.[0].relation, 'adopted child');
  assert.equal(relationshipPath('a', 'b', [edge('a', 'b', 'spouse', { relationshipStatus: 'divorced' })])?.[0].relation, 'former partner');
});

test('tracing keeps shared connector runs without highlighting nonconsecutive people', () => {
  assert.equal(connectorOnPath(['parent', 'me', 'sibling'], ['me', 'parent', 'grandparent']), true);
  assert.equal(connectorOnPath(['me', 'grandparent'], ['me', 'parent', 'grandparent']), false);
  assert.equal(connectorOnPath(undefined, ['me', 'parent']), false);
});

test('relationship sentences use possessives and the related person gender', () => {
  const people = new Map([
    ['steve', { id: 'steve', firstName: 'Steve', gender: 'male' as const }],
    ['maseiso', { id: 'maseiso', firstName: 'Maseiso', gender: 'female' as const }],
  ]);
  assert.equal(describeFamilyStep({ from: 'maseiso', to: 'steve', relation: 'parent' }, people), "Steve is Maseiso's father.");
  assert.equal(describeFamilyStep({ from: 'steve', to: 'maseiso', relation: 'child' }, people), "Maseiso is Steve's daughter.");
  assert.equal(naturalRelationship('parent', 'female'), 'mother');
  assert.equal(naturalRelationship('parent', 'unspecified'), 'parent');
  assert.equal(naturalRelationship('child', 'non-binary'), 'child');
  assert.equal(naturalRelationship('spouse', 'male'), 'husband');
  assert.equal(naturalRelationship('spouse', 'female'), 'wife');
  assert.equal(naturalRelationship('step parent', 'female'), 'stepmother');
  assert.equal(naturalRelationship('adopted parent', 'male'), 'adoptive father');
});


test('branch starts at two generations in both directions and includes partners without their ancestry', () => {
  const links = [...family, edge('great', 'grandparent'), edge('child', 'grandchild'), edge('grandchild', 'greatchild'), edge('partner-parent', 'partner')];
  const ids = branchIds('me', links);
  for (const id of ['me', 'parent', 'grandparent', 'child', 'grandchild', 'partner', 'sibling']) assert.ok(ids.has(id), id);
  for (const id of ['great', 'greatchild', 'niece', 'partner-parent']) assert.ok(!ids.has(id), id);
  assert.deepEqual(hiddenChildIds('parent', links, ids), []);
  assert.deepEqual(hiddenChildIds('grandchild', links, ids), ['greatchild']);
});

test('wide child sets are bounded, shared relationships count once, and cycles terminate', () => {
  const links = Array.from({ length: 12 }, (_, i) => edge('me', 'child-' + i));
  links.push(edge('me', 'child-0'), edge('child-0', 'me'));
  const ids = branchIds('me', links, 'descendants');
  assert.equal(ids.size, 5);
  assert.equal(hiddenChildIds('me', links, ids).length, 8);
  assert.deepEqual(branchIds('me', [...family], 'ancestors'), new Set(['me', 'parent', 'grandparent', 'partner']));
});


test('family branch includes all siblings through either parent without their descendants', () => {
  const links = [edge('mother', 'me'), edge('father', 'me'), ...Array.from({ length: 7 }, (_, i) => edge('mother', 'sibling-' + i)), edge('father', 'half-sibling'), edge('mother', 'sibling-0'), edge('sibling-0', 'niece')];
  const ids = branchIds('me', links);
  for (let i = 0; i < 7; i++) assert.ok(ids.has('sibling-' + i));
  assert.ok(ids.has('half-sibling'));
  assert.ok(!ids.has('niece'));
  assert.ok(!branchIds('me', links, 'ancestors').has('sibling-0'));
});

test('more children excludes hidden parents and partners and deduplicates children', () => {
  const links = [edge('parent', 'me'), edge('me', 'partner', 'spouse'), edge('me', 'child'), edge('me', 'child'), edge('me', 'visible')];
  assert.deepEqual(hiddenChildIds('me', links, new Set(['me', 'visible'])), ['child']);
});


test('show parents includes only hidden recorded parents, deduplicated across edges', () => {
  const links = [edge('mother', 'me'), edge('father', 'me'), edge('father', 'me'), edge('me', 'partner', 'spouse'), edge('me', 'child')];
  assert.deepEqual(hiddenParentIds('me', links, new Set(['me', 'mother'])), ['father']);
  assert.deepEqual(hiddenParentIds('partner', links, new Set(['partner'])), []);
});
