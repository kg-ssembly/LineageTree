import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFamilyEntries, possibleFamilyConnections, recordedParents, findFamilyMatches } from '../components/family-entry-guidance';
import type { PersonRecord } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';

const person = (id: string, gender: PersonRecord['gender'] = 'unspecified'): PersonRecord => ({
  id, gender, firstName: id, lastName: 'Family', treeId: 'tree', ownerId: 'owner', treeMembershipIds: ['tree'], treeMemberships: [],
  birthDate: '', deathDate: '', photos: [], lifeEvents: [], notes: '', preferredPhotoId: '', createdAt: '', updatedAt: '',
});
const edge = (fromPersonId: string, toPersonId: string, type: RelationshipRecord['type'] = 'parent-child'): RelationshipRecord => ({
  id: `${fromPersonId}:${toPersonId}`, fromPersonId, toPersonId, type, treeId: 'tree', ownerId: 'owner', createdAt: '',
});

test('a new father suggests a mother linked to the original child, without a marriage', () => {
  const choices = nextFamilyEntries(person('father', 'male'), [{ mode: 'parent-of', relatedPersonId: 'child' }], [], []);
  assert.equal(choices[0].gender, 'female');
  assert.deepEqual(choices[0].connections, [{ mode: 'parent-of', relatedPersonId: 'child' }]);
  assert.equal(nextFamilyEntries(person('mother', 'female'), choices[0].connections, [person('father', 'male')], [edge('father', 'child')])[0].label, 'Add another parent');
});
test('repeat children retain exact selected parents and their relationship types', () => {
  const connections = [{ mode: 'child-of' as const, relatedPersonId: 'father', parentChildKind: 'biological' as const },
    { mode: 'child-of' as const, relatedPersonId: 'mother', parentChildKind: 'adopted' as const }];
  assert.deepEqual(nextFamilyEntries(person('child'), connections, [], [])[0].connections, connections);
  assert.deepEqual(recordedParents('child', [{ ...edge('father', 'child'), parentChildKind: 'adopted' }]), [{ mode: 'child-of', relatedPersonId: 'father', parentChildKind: 'adopted' }]);
});
test('spouse suggestions return only recorded co-parents, excluding an existing spouse', () => {
  const people = ['father', 'mother', 'unrelated', 'child'].map((id) => person(id));
  const links = [edge('father', 'child'), edge('mother', 'child')];
  assert.deepEqual(possibleFamilyConnections({ mode: 'spouse-of', relatedPersonId: 'father' }, people, links).map((p) => p.id), ['mother']);
  assert.deepEqual(possibleFamilyConnections({ mode: 'spouse-of', relatedPersonId: 'father' }, people, [...links, edge('mother', 'father', 'spouse')]), []);
});
test('parent and child suggestions are relevant and exclude recorded connections', () => {
  const people = ['father', 'mother', 'child', 'unrelated'].map((id) => person(id));
  const links = [edge('father', 'child'), edge('father', 'mother', 'spouse')];
  assert.deepEqual(possibleFamilyConnections({ mode: 'parent-of', relatedPersonId: 'child' }, people, links).map((p) => p.id), ['mother']);
  assert.deepEqual(possibleFamilyConnections({ mode: 'child-of', relatedPersonId: 'mother' }, people, links).map((p) => p.id), ['child']);
});
test('pending saves cannot be used as a new child anchor; name matching needs two characters', () => {
  assert.deepEqual(nextFamilyEntries(null, [{ mode: 'spouse-of', relatedPersonId: 'father' }], [], []), []);
  assert.deepEqual(findFamilyMatches('m', '', [person('mother')]), []);
  assert.equal(findFamilyMatches('MO', 'Family', [person('mother')]).length, 1);
});
