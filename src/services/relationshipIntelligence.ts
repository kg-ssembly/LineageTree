import type { PersonGender, PersonRecord } from '../../components/dto/person';
import type { RelationshipRecord } from '../../components/dto/relationship';

type ConnectionRelation = 'parent' | 'child' | 'spouse';

type FamilyIndex = {
  personById: Map<string, PersonRecord>;
  parentIdsByChildId: Map<string, Set<string>>;
  childIdsByParentId: Map<string, Set<string>>;
  spouseIdsByPersonId: Map<string, Set<string>>;
};

export interface RelationshipInsight {
  relationship: string;
  pathPersonIds: string[];
  pathRelations: ConnectionRelation[];
}

function ensureSet(map: Map<string, Set<string>>, key: string) {
  if (!map.has(key)) {
    map.set(key, new Set());
  }

  return map.get(key)!;
}

function genderedLabel(gender: PersonGender, male: string, female: string, neutral: string) {
  if (gender === 'male') {
    return male;
  }

  if (gender === 'female') {
    return female;
  }

  return neutral;
}

function describeAncestor(distance: number, gender: PersonGender) {
  if (distance === 1) {
    return genderedLabel(gender, 'Father', 'Mother', 'Parent');
  }

  if (distance === 2) {
    return genderedLabel(gender, 'Grandfather', 'Grandmother', 'Grandparent');
  }

  return `${'Great-'.repeat(distance - 2)}${genderedLabel(gender, 'Grandfather', 'Grandmother', 'Grandparent')}`;
}

function describeDescendant(distance: number, gender: PersonGender) {
  if (distance === 1) {
    return genderedLabel(gender, 'Son', 'Daughter', 'Child');
  }

  if (distance === 2) {
    return genderedLabel(gender, 'Grandson', 'Granddaughter', 'Grandchild');
  }

  return `${'Great-'.repeat(distance - 2)}${genderedLabel(gender, 'Grandson', 'Granddaughter', 'Grandchild')}`;
}

function buildFamilyIndex(people: PersonRecord[], relationships: RelationshipRecord[]): FamilyIndex {
  const personById = new Map(people.map((person) => [person.id, person]));
  const parentIdsByChildId = new Map<string, Set<string>>();
  const childIdsByParentId = new Map<string, Set<string>>();
  const spouseIdsByPersonId = new Map<string, Set<string>>();

  relationships.forEach((relationship) => {
    if (relationship.type === 'parent-child') {
      ensureSet(parentIdsByChildId, relationship.toPersonId).add(relationship.fromPersonId);
      ensureSet(childIdsByParentId, relationship.fromPersonId).add(relationship.toPersonId);
      return;
    }

    ensureSet(spouseIdsByPersonId, relationship.fromPersonId).add(relationship.toPersonId);
    ensureSet(spouseIdsByPersonId, relationship.toPersonId).add(relationship.fromPersonId);
  });

  return {
    personById,
    parentIdsByChildId,
    childIdsByParentId,
    spouseIdsByPersonId,
  };
}

function getParents(index: FamilyIndex, personId: string) {
  return [...(index.parentIdsByChildId.get(personId) ?? new Set<string>())];
}

function getChildren(index: FamilyIndex, personId: string) {
  return [...(index.childIdsByParentId.get(personId) ?? new Set<string>())];
}

function getSpouses(index: FamilyIndex, personId: string) {
  return [...(index.spouseIdsByPersonId.get(personId) ?? new Set<string>())];
}

function shareParent(index: FamilyIndex, personAId: string, personBId: string) {
  const firstParents = new Set(getParents(index, personAId));
  return getParents(index, personBId).some((parentId) => firstParents.has(parentId));
}

function isSibling(index: FamilyIndex, personAId: string, personBId: string) {
  return personAId !== personBId && shareParent(index, personAId, personBId);
}

function findAncestorDistance(index: FamilyIndex, ancestorId: string, descendantId: string) {
  if (ancestorId === descendantId) {
    return 0;
  }

  const queue: Array<{ personId: string; distance: number }> = [{ personId: descendantId, distance: 0 }];
  const visited = new Set([descendantId]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const parentId of getParents(index, current.personId)) {
      if (parentId === ancestorId) {
        return current.distance + 1;
      }

      if (!visited.has(parentId)) {
        visited.add(parentId);
        queue.push({ personId: parentId, distance: current.distance + 1 });
      }
    }
  }

  return null;
}

function getAncestorDistances(index: FamilyIndex, personId: string) {
  const distances = new Map<string, number>();
  const queue: Array<{ currentPersonId: string; distance: number }> = [{ currentPersonId: personId, distance: 0 }];
  const visited = new Set([personId]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const parentId of getParents(index, current.currentPersonId)) {
      const nextDistance = current.distance + 1;
      if (!distances.has(parentId) || nextDistance < distances.get(parentId)!) {
        distances.set(parentId, nextDistance);
      }

      if (!visited.has(parentId)) {
        visited.add(parentId);
        queue.push({ currentPersonId: parentId, distance: nextDistance });
      }
    }
  }

  return distances;
}

function findConnectionPath(index: FamilyIndex, fromPersonId: string, toPersonId: string) {
  if (fromPersonId === toPersonId) {
    return { pathPersonIds: [fromPersonId], pathRelations: [] as ConnectionRelation[] };
  }

  const queue: string[] = [fromPersonId];
  const previous = new Map<string, { previousPersonId: string; relation: ConnectionRelation }>();
  const visited = new Set([fromPersonId]);

  while (queue.length > 0) {
    const currentPersonId = queue.shift()!;
    const neighbors: Array<{ personId: string; relation: ConnectionRelation }> = [
      ...getParents(index, currentPersonId).map((personId) => ({ personId, relation: 'parent' as const })),
      ...getChildren(index, currentPersonId).map((personId) => ({ personId, relation: 'child' as const })),
      ...getSpouses(index, currentPersonId).map((personId) => ({ personId, relation: 'spouse' as const })),
    ];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.personId)) {
        continue;
      }

      visited.add(neighbor.personId);
      previous.set(neighbor.personId, {
        previousPersonId: currentPersonId,
        relation: neighbor.relation,
      });

      if (neighbor.personId === toPersonId) {
        const pathPersonIds = [toPersonId];
        const pathRelations: ConnectionRelation[] = [];
        let walkerId = toPersonId;

        while (previous.has(walkerId)) {
          const step = previous.get(walkerId)!;
          pathPersonIds.unshift(step.previousPersonId);
          pathRelations.unshift(step.relation);
          walkerId = step.previousPersonId;
        }

        return { pathPersonIds, pathRelations };
      }

      queue.push(neighbor.personId);
    }
  }

  return null;
}

export function computeRelationshipInsight(
  people: PersonRecord[],
  relationships: RelationshipRecord[],
  fromPersonId: string,
  toPersonId: string,
): RelationshipInsight | null {
  const index = buildFamilyIndex(people, relationships);
  const fromPerson = index.personById.get(fromPersonId);
  const toPerson = index.personById.get(toPersonId);

  if (!fromPerson || !toPerson) {
    return null;
  }

  const path = findConnectionPath(index, fromPersonId, toPersonId);
  if (!path) {
    return null;
  }

  if (fromPersonId === toPersonId) {
    return { relationship: 'Self', ...path };
  }

  if (getSpouses(index, fromPersonId).includes(toPersonId)) {
    return { relationship: 'Spouse', ...path };
  }

  const ancestorDistance = findAncestorDistance(index, fromPersonId, toPersonId);
  if (ancestorDistance) {
    return {
      relationship: describeAncestor(ancestorDistance, fromPerson.gender),
      ...path,
    };
  }

  const descendantDistance = findAncestorDistance(index, toPersonId, fromPersonId);
  if (descendantDistance) {
    return {
      relationship: describeDescendant(descendantDistance, fromPerson.gender),
      ...path,
    };
  }

  if (isSibling(index, fromPersonId, toPersonId)) {
    return {
      relationship: genderedLabel(fromPerson.gender, 'Brother', 'Sister', 'Sibling'),
      ...path,
    };
  }

  if (getParents(index, toPersonId).some((parentId) => isSibling(index, fromPersonId, parentId))) {
    return {
      relationship: genderedLabel(fromPerson.gender, 'Uncle', 'Aunt', 'Aunt/Uncle'),
      ...path,
    };
  }

  if (getParents(index, fromPersonId).some((parentId) => isSibling(index, toPersonId, parentId))) {
    return {
      relationship: genderedLabel(fromPerson.gender, 'Nephew', 'Niece', 'Niece/Nephew'),
      ...path,
    };
  }

  const fromAncestorDistances = getAncestorDistances(index, fromPersonId);
  const toAncestorDistances = getAncestorDistances(index, toPersonId);
  const sharedAncestors = [...fromAncestorDistances.keys()].filter((ancestorId) => toAncestorDistances.has(ancestorId));

  if (sharedAncestors.some((ancestorId) => fromAncestorDistances.get(ancestorId) === 2 && toAncestorDistances.get(ancestorId) === 2)) {
    return {
      relationship: 'Cousin',
      ...path,
    };
  }

  return {
    relationship: 'Extended family',
    ...path,
  };
}

