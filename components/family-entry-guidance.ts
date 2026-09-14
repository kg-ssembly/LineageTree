import type { PersonGender, PersonRecord } from './dto/person';
import type { RelationshipRecord } from './dto/relationship';

export type FamilyConnection = {
  mode: 'parent-of' | 'child-of' | 'spouse-of';
  relatedPersonId: string;
  parentChildKind?: RelationshipRecord['parentChildKind'];
  relationshipStatus?: RelationshipRecord['relationshipStatus'];
};
export type FamilyEntryChoice = {
  label: string;
  gender?: PersonGender;
  connections: FamilyConnection[];
};

export function recordedParents(personId: string, relationships: RelationshipRecord[]): FamilyConnection[] {
  return relationships.filter((r) => r.type === 'parent-child' && r.toPersonId === personId)
    .map((r) => ({ mode: 'child-of', relatedPersonId: r.fromPersonId, parentChildKind: r.parentChildKind ?? 'biological' }));
}

export function nextFamilyEntries(
  saved: Pick<PersonRecord, 'id' | 'gender'> | null,
  connections: FamilyConnection[],
  people: PersonRecord[],
  relationships: RelationshipRecord[],
): FamilyEntryChoice[] {
  const anchor = connections[0];
  if (!anchor) return [];
  if (anchor.mode === 'parent-of') {
    const parents = relationships.filter((r) => r.type === 'parent-child' && r.toPersonId === anchor.relatedPersonId);
    const otherGender: PersonGender | undefined = saved?.gender === 'male' ? 'female' : saved?.gender === 'female' ? 'male' : undefined;
    const alreadyRecorded = otherGender && parents.some((r) => people.find((p) => p.id === r.fromPersonId)?.gender === otherGender);
    return [
      ...(!alreadyRecorded && otherGender ? [{ label: otherGender === 'female' ? 'Add mother' : 'Add father', gender: otherGender, connections: connections.filter((c) => c.mode === 'parent-of') }] : []),
      { label: 'Add another parent', connections: connections.filter((c) => c.mode === 'parent-of') },
    ];
  }
  if (anchor.mode === 'child-of') return [{ label: 'Add sibling', connections: connections.filter((c) => c.mode === 'child-of') }];
  if (saved?.id) return [{ label: 'Add their child', connections: [
    { mode: 'child-of', relatedPersonId: anchor.relatedPersonId, parentChildKind: 'biological' },
    { mode: 'child-of', relatedPersonId: saved.id, parentChildKind: 'biological' },
  ] }];
  return [];
}

export function findFamilyMatches(firstName: string, lastName: string, people: PersonRecord[]) {
  const normalise = (value: string) => value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const first = normalise(firstName), last = normalise(lastName);
  if (first.length < 2) return [];
  return people.filter((person) => [person.firstName, ...(person.nicknames ?? [])].some((name) => normalise(name).startsWith(first)))
    .sort((a, b) => Number(normalise(b.lastName) === last) - Number(normalise(a.lastName) === last) || a.id.localeCompare(b.id))
    .slice(0, 4);
}

export function possibleFamilyConnections(anchor: FamilyConnection | undefined, people: PersonRecord[], relationships: RelationshipRecord[]) {
  if (!anchor) return [];
  const anchorId = anchor.relatedPersonId;
  const parentsOf = (id: string) => relationships.filter((r) => r.type === 'parent-child' && r.toPersonId === id).map((r) => r.fromPersonId);
  const childrenOf = (id: string) => relationships.filter((r) => r.type === 'parent-child' && r.fromPersonId === id).map((r) => r.toPersonId);
  const partnersOf = (id: string) => relationships.filter((r) => r.type === 'spouse' && [r.fromPersonId, r.toPersonId].includes(id))
    .map((r) => r.fromPersonId === id ? r.toPersonId : r.fromPersonId);
  const existing = new Set(anchor.mode === 'spouse-of' ? partnersOf(anchorId) : anchor.mode === 'parent-of' ? parentsOf(anchorId) : childrenOf(anchorId));
  const ids = new Set(anchor.mode === 'spouse-of'
    ? childrenOf(anchorId).flatMap(parentsOf)
    : anchor.mode === 'parent-of'
      ? [...parentsOf(anchorId).flatMap(partnersOf), ...parentsOf(anchorId).flatMap(childrenOf).flatMap(parentsOf)]
      : partnersOf(anchorId).flatMap(childrenOf));
  return people.filter((p) => p.id !== anchorId && ids.has(p.id) && !existing.has(p.id))
    .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id));
}
