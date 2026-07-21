import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import type { PersonRecord } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';
import { layoutFamilyTree } from '../components/family-tree-layout';
import { buildConnectors } from '../components/family-tree-connectors';
import { DEFAULT_LAYOUT_CONSTANTS } from '../components/family-tree-types';

function buildPerson(index: number): PersonRecord {
  const familyIndex = Math.floor(index / 2);
  return {
    id: `person-${index}`,
    treeId: 'benchmark-tree',
    treeMembershipIds: ['benchmark-tree'],
    treeMemberships: [{
      treeId: 'benchmark-tree',
      role: 'member',
      joinedAt: '2026-01-01T00:00:00.000Z',
    }],
    ownerId: 'benchmark-user',
    firstName: `Person${index}`,
    lastName: `Family${familyIndex % 24}`,
    birthDate: '',
    deathDate: '',
    gender: 'unspecified',
    notes: '',
    lifeEvents: [],
    photos: [],
    preferredPhotoId: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function buildSyntheticTree(size: number) {
  const people = Array.from({ length: size }, (_, index) => buildPerson(index));
  const relationships: RelationshipRecord[] = [];

  for (let index = 1; index < size; index += 1) {
    const parentIndex = Math.floor((index - 1) / 2);
    relationships.push({
      id: `parent-child-${parentIndex}-${index}`,
      treeId: 'benchmark-tree',
      ownerId: 'benchmark-user',
      fromPersonId: `person-${parentIndex}`,
      toPersonId: `person-${index}`,
      type: 'parent-child',
      parentChildKind: 'biological',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  }

  for (let index = 2; index + 1 < size; index += 14) {
    relationships.push({
      id: `spouse-${index}-${index + 1}`,
      treeId: 'benchmark-tree',
      ownerId: 'benchmark-user',
      fromPersonId: `person-${index}`,
      toPersonId: `person-${index + 1}`,
      type: 'spouse',
      relationshipStatus: 'married',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  }

  return { people, relationships };
}

test('family tree layout and connector building stay bounded for large synthetic trees', () => {
  const cases = [
    { size: 300, maxMs: 300 },
    { size: 1000, maxMs: 1200 },
    { size: 2000, maxMs: 3000 },
  ];

  for (const { size, maxMs } of cases) {
    const { people, relationships } = buildSyntheticTree(size);
    const startedAt = performance.now();
    const layout = layoutFamilyTree(people, relationships, DEFAULT_LAYOUT_CONSTANTS);
    const connectors = buildConnectors(relationships, layout, DEFAULT_LAYOUT_CONSTANTS, {
      parentChild: '#166B51',
      spouse: '#6B5B4C',
      secondaryParent: '#7D6B5B',
      stepChild: '#B7791F',
      adoptedChild: '#2E7D6B',
      guardianChild: '#6B5B4C',
    });
    const elapsedMs = performance.now() - startedAt;

    assert.equal(layout.positionsByPersonId.size, size);
    assert.ok(connectors.parentChildConnectors.length > 0);
    assert.ok(elapsedMs < maxMs, `${size} people took ${elapsedMs.toFixed(1)}ms, expected < ${maxMs}ms`);
  }
});
