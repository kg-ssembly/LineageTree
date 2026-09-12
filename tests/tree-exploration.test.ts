import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeFamilyStep, naturalRelationship, connectorOnPath, lineageIds, scopeIds, relationshipPath } from '../components/tree-exploration';
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
