import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConnectorPaths, type ConnectorRoute } from '../components/family-tree-routing';
import { createViewportIndex } from '../components/family-tree-viewport';
import { buildConnectors } from '../components/family-tree-connectors';
import { DEFAULT_LAYOUT_CONSTANTS as C, type LayoutResult } from '../components/family-tree-types';
import type { RelationshipRecord } from '../components/dto/relationship';
import type { PersonRecord } from '../components/dto/person';
import { layoutFamilyTree } from '../components/family-tree-layout';

const colors = { parentChild: 'green', spouse: 'brown', secondaryParent: 'gray', stepChild: 'orange', adoptedChild: 'blue', guardianChild: 'purple' };

function multipleMarriageFamily() {
  const people: PersonRecord[] = ['mampshe', 'sebabole', 'wife1', 'wife2', 'wife3', 'child1', 'child2', 'soloChild'].map((id) => ({
    id, firstName: id, lastName: 'Mfubha', treeId: 'tree', ownerId: 'owner',
    treeMembershipIds: ['tree'], treeMemberships: [], birthDate: '', deathDate: '',
    gender: 'unspecified', notes: '', lifeEvents: [], photos: [], preferredPhotoId: '', createdAt: '', updatedAt: '',
  }));
  const edge = (fromPersonId: string, toPersonId: string, type: RelationshipRecord['type']): RelationshipRecord => ({
    id: `${fromPersonId}-${toPersonId}`, fromPersonId, toPersonId, type, treeId: 'tree', ownerId: 'owner', createdAt: '',
  });
  const relationships = [
    edge('mampshe', 'sebabole', 'parent-child'),
    ...['wife1', 'wife2', 'wife3'].map((wife) => edge('sebabole', wife, 'spouse')),
    edge('sebabole', 'child1', 'parent-child'), edge('wife1', 'child1', 'parent-child'),
    edge('sebabole', 'child2', 'parent-child'), edge('wife3', 'child2', 'parent-child'),
    edge('sebabole', 'soloChild', 'parent-child'),
  ];
  return { people, relationships };
}

test('adding a father keeps all three spouses in the child’s generation without overlapping cards', () => {
  const { people, relationships } = multipleMarriageFamily();
  const layout = layoutFamilyTree(people, relationships);
  const positions = layout.positionsByPersonId;
  const father = positions.get('mampshe')!;
  const son = positions.get('sebabole')!;
  assert.ok(father.y < son.y);
  for (const wife of ['wife1', 'wife2', 'wife3']) assert.equal(positions.get(wife)!.y, son.y);
  for (const child of ['child1', 'child2', 'soloChild']) assert.ok(positions.get(child)!.y > son.y);
  for (const [id, a] of positions) for (const [other, b] of positions) {
    if (id !== other && a.y === b.y) assert.ok(Math.abs(a.x - b.x) >= C.NODE_WIDTH + C.SPOUSE_GAP);
  }
  const reversed = layoutFamilyTree([...people].reverse(), [...relationships].reverse());
  assert.deepEqual(reversed.positionsByPersonId, positions);
});

test('multiple marriages retain separate spouse connections and exact recorded parent sets', () => {
  const { people, relationships } = multipleMarriageFamily();
  const layout = layoutFamilyTree(people, relationships);
  const paths = buildConnectors(relationships, layout, C, colors);
  assert.equal(paths.spouseConnectors.length, 3);
  for (const marriage of paths.spouseConnectors) {
    assert.equal(marriage.personIds!.length, 2);
    assert.ok(marriage.personIds!.includes('sebabole'));
    assert.ok(!marriage.personIds!.includes('mampshe'));
  }
  for (const [child, parents] of [['child1', ['sebabole', 'wife1']], ['child2', ['sebabole', 'wife3']], ['soloChild', ['sebabole']]] as const) {
    const connections = paths.parentChildConnectors.filter((p) => p.personIds?.includes(child));
    assert.equal(connections.length, 1);
    assert.deepEqual(new Set(connections[0].personIds), new Set([...parents, child]));
  }
  const solo = paths.parentChildConnectors.find((p) => p.personIds?.includes('soloChild'))!;
  const son = layout.positionsByPersonId.get('sebabole')!;
  assert.ok(solo.d.startsWith(`M ${son.x + C.NODE_WIDTH / 2 + 12} ${son.y + C.NODE_HEIGHT}`));
});
function route(networkId: string, points: { x: number; y: number }[]): ConnectorRoute {
  return { key: networkId, networkId, points, stroke: 'green', strokeWidth: 2, personIds: [networkId] };
}

test('unrelated perpendicular relationships have a gap, not a false junction', () => {
  const paths = buildConnectorPaths([
    route('family-a', [{ x: 0, y: 50 }, { x: 100, y: 50 }]),
    route('family-b', [{ x: 50, y: 0 }, { x: 50, y: 100 }]),
  ]);
  assert.equal(paths[0].d, 'M 0 50 L 43 50 M 57 50 L 100 50');
  assert.equal(paths[1].d, 'M 50 0 L 50 100');
});

test('shared family runs are drawn once and retain all member identities', () => {
  const a = route('family', [{ x: 20, y: 0 }, { x: 20, y: 50 }, { x: 100, y: 50 }]);
  const b = { ...route('family', [{ x: 20, y: 0 }, { x: 20, y: 50 }, { x: 150, y: 50 }]), personIds: ['child-b'] };
  const paths = buildConnectorPaths([a, b]);
  assert.equal(paths.length, 1);
  assert.equal((paths[0].d.match(/M /g) ?? []).length, 1);
  assert.ok(paths[0].d.includes('Q '));
  assert.deepEqual(paths[0].personIds, ['family', 'child-b']);
});

test('spatial culling matches brute force at boundaries, negative coordinates, and overview zoom', () => {
  const items = Array.from({ length: 2000 }, (_, id) => ({ id, bounds: { x: (id % 50) * 250 - 500, y: Math.floor(id / 50) * 200, w: 232, h: 108 } }));
  items.push({ id: 2000, bounds: { x: -10000, y: 0, w: 30000, h: 9000 } });
  const query = createViewportIndex(items);
  for (const v of [{ x: -500, y: 0, w: 232, h: 108 }, { x: 400, y: 512, w: 1300, h: 900 }, { x: -100000, y: -100000, w: 200000, h: 200000 }]) {
    assert.deepEqual(query(v), items.filter(({ bounds: b }) => b.x + b.w >= v.x && b.x <= v.x + v.w && b.y + b.h >= v.y && b.y <= v.y + v.h));
  }
});

function fixture(relationships: RelationshipRecord[]) {
  const layout: LayoutResult = {
    positionsByPersonId: new Map([['parent', { x: 64, y: 64 }], ['partner', { x: 64 + C.NODE_WIDTH + C.SPOUSE_GAP, y: 64 }], ['child', { x: 64, y: 400 }]]),
    spouseGroupIdByPersonId: new Map([['parent', 'couple'], ['partner', 'couple'], ['child', 'child']]),
    spouseGroupsById: new Map([['couple', { id: 'couple', memberIds: ['parent', 'partner'] }], ['child', { id: 'child', memberIds: ['child'] }]]),
    levelBySpouseGroupId: new Map([['couple', 0], ['child', 1]]), contentWidth: 800, contentHeight: 600,
  };
  return buildConnectors(relationships, layout, C, colors);
}
function parent(fromPersonId: string, kind: RelationshipRecord['parentChildKind'] = 'biological'): RelationshipRecord {
  return { id: fromPersonId, fromPersonId, toPersonId: 'child', type: 'parent-child', parentChildKind: kind, treeId: 'tree', ownerId: 'owner', createdAt: '' };
}

test('a parent’s partner is not implicitly drawn as a second parent', () => {
  const paths = fixture([parent('parent')]).parentChildConnectors;
  assert.deepEqual(paths[0].personIds, ['parent', 'child']);
  assert.ok(paths[0].d.startsWith(`M ${64 + C.NODE_WIDTH / 2} ${64 + C.NODE_HEIGHT}`));
});

test('recorded co-parents share a bus connected to the couple midpoint', () => {
  const paths = fixture([parent('parent'), parent('partner')]).parentChildConnectors;
  assert.equal(paths.length, 1);
  assert.deepEqual(new Set(paths[0].personIds), new Set(['parent', 'partner', 'child']));
  assert.ok(paths[0].d.includes(`${64 + C.NODE_WIDTH + C.SPOUSE_GAP / 2} ${64 + C.NODE_HEIGHT / 2}`));
});

test('different parent-child kinds retain separate styles', () => {
  const paths = fixture([parent('parent'), parent('partner', 'step')]).parentChildConnectors;
  assert.equal(paths.length, 2);
  assert.deepEqual(new Set(paths.map((p) => p.stroke)), new Set(['green', 'orange']));
  assert.equal(paths.find((p) => p.stroke === 'orange')?.dashArray, '8,5');
});


test('the shared child trunk joins a recorded couple without erasing the spouse line', () => {
  const paths = fixture([parent('parent'), parent('partner'), {
    id: 'spouses', fromPersonId: 'parent', toPersonId: 'partner', type: 'spouse', relationshipStatus: 'married', treeId: 'tree', ownerId: 'owner', createdAt: '',
  }]);
  assert.equal(paths.spouseConnectors.length, 1);
  assert.equal(paths.spouseConnectors[0].d, `M ${64 + C.NODE_WIDTH} ${64 + C.NODE_HEIGHT / 2} L ${64 + C.NODE_WIDTH + C.SPOUSE_GAP} ${64 + C.NODE_HEIGHT / 2}`);
});


test('corner smoothing cannot introduce a crossing with a nearby unrelated run', () => {
  const paths = buildConnectorPaths([
    route('family-a', [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }]),
    route('family-b', [{ x: 45, y: 5 }, { x: 59, y: 5 }]),
  ]);
  assert.ok(paths[0].d.includes('Q 60 0 60 0'));
  assert.equal(paths[1].d, 'M 45 5 L 59 5');
});
