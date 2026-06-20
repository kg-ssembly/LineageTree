import type { PersonGender, PersonRecord } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';

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

  return { personById, parentIdsByChildId, childIdsByParentId, spouseIdsByPersonId };
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

function getSiblings(index: FamilyIndex, personId: string): string[] {
  const siblingsSet = new Set<string>();
  for (const parentId of getParents(index, personId)) {
    for (const childId of getChildren(index, parentId)) {
      if (childId !== personId) {
        siblingsSet.add(childId);
      }
    }
  }

  return [...siblingsSet];
}

function shareAnyParent(index: FamilyIndex, personAId: string, personBId: string) {
  const aParents = new Set(getParents(index, personAId));
  return getParents(index, personBId).some((parentId) => aParents.has(parentId));
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

function cousinOrdinal(degree: number) {
  if (degree === 1) return '1st';
  if (degree === 2) return '2nd';
  if (degree === 3) return '3rd';
  return `${degree}th`;
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

  // ── Self ─────────────────────────────────────────────────────────────────
  if (fromPersonId === toPersonId) {
    return { relationship: 'Self', ...path };
  }

  // ── Spouse ───────────────────────────────────────────────────────────────
  if (getSpouses(index, fromPersonId).includes(toPersonId)) {
    return { relationship: genderedLabel(toPerson.gender, 'Husband', 'Wife', 'Spouse'), ...path };
  }

  // ── Direct line: descendant of fromPerson ────────────────────────────────
  const ancestorDistance = findAncestorDistance(index, fromPersonId, toPersonId);
  if (ancestorDistance) {
    const label = ancestorDistance === 1
      ? genderedLabel(toPerson.gender, 'Son', 'Daughter', 'Child')
      : ancestorDistance === 2
        ? genderedLabel(toPerson.gender, 'Grandson', 'Granddaughter', 'Grandchild')
        : `${'Great-'.repeat(ancestorDistance - 2)}${genderedLabel(toPerson.gender, 'Grandson', 'Granddaughter', 'Grandchild')}`;
    return { relationship: label, ...path };
  }

  // ── Direct line: ancestor of fromPerson ───────────────────────────────────
  const descendantDistance = findAncestorDistance(index, toPersonId, fromPersonId);
  if (descendantDistance) {
    const label = descendantDistance === 1
      ? genderedLabel(toPerson.gender, 'Father', 'Mother', 'Parent')
      : descendantDistance === 2
        ? genderedLabel(toPerson.gender, 'Grandfather', 'Grandmother', 'Grandparent')
        : `${'Great-'.repeat(descendantDistance - 2)}${genderedLabel(toPerson.gender, 'Grandfather', 'Grandmother', 'Grandparent')}`;
    return { relationship: label, ...path };
  }

  const fromParentIds = new Set(getParents(index, fromPersonId));
  const toParentIds = new Set(getParents(index, toPersonId));
  const sharedParentIds = [...fromParentIds].filter((p) => toParentIds.has(p));

  // ── Full / Half sibling ───────────────────────────────────────────────────
  if (sharedParentIds.length > 0) {
    const isHalf = sharedParentIds.length < Math.max(fromParentIds.size, toParentIds.size);
    const prefix = isHalf ? 'Half-' : '';
    return {
      relationship: `${prefix}${genderedLabel(toPerson.gender, 'brother', 'sister', 'sibling')}`,
      ...path,
    };
  }

  // ── In-laws ───────────────────────────────────────────────────────────────
  // toPerson is child-in-law (they are married to fromPerson's child)
  if (getChildren(index, fromPersonId).some((cId) => getSpouses(index, cId).includes(toPersonId))) {
    return {
      relationship: genderedLabel(toPerson.gender, 'Son-in-law', 'Daughter-in-law', 'Child-in-law'),
      ...path,
    };
  }

  // toPerson is parent-in-law (they are the parent of fromPerson's spouse)
  if (getChildren(index, toPersonId).some((cId) => getSpouses(index, cId).includes(fromPersonId))) {
    return {
      relationship: genderedLabel(toPerson.gender, 'Father-in-law', 'Mother-in-law', 'Parent-in-law'),
      ...path,
    };
  }

  // toPerson is sibling-in-law (they are married to fromPerson's sibling)
  if (getSiblings(index, fromPersonId).some((sib) => getSpouses(index, sib).includes(toPersonId))) {
    return {
      relationship: genderedLabel(toPerson.gender, 'Brother-in-law', 'Sister-in-law', 'Sibling-in-law'),
      ...path,
    };
  }

  // toPerson is sibling-in-law (they are the sibling of fromPerson's spouse)
  if (getSpouses(index, fromPersonId).some((sp) => getSiblings(index, toPersonId).includes(sp))) {
    return {
      relationship: genderedLabel(toPerson.gender, 'Brother-in-law', 'Sister-in-law', 'Sibling-in-law'),
      ...path,
    };
  }

  // ── Step-relationships ────────────────────────────────────────────────────
  // toPerson is step-child of fromPerson
  const toParentsArr = getParents(index, toPersonId);
  if (
    toParentsArr.some((p) => getSpouses(index, p).includes(fromPersonId))
    && !toParentsArr.includes(fromPersonId)
  ) {
    return {
      relationship: genderedLabel(toPerson.gender, 'Stepson', 'Stepdaughter', 'Stepchild'),
      ...path,
    };
  }

  // toPerson is step-parent of fromPerson
  const fromParentsArr = getParents(index, fromPersonId);
  if (
    fromParentsArr.some((p) => getSpouses(index, p).includes(toPersonId))
    && !fromParentsArr.includes(toPersonId)
  ) {
    return {
      relationship: genderedLabel(toPerson.gender, 'Stepfather', 'Stepmother', 'Step-parent'),
      ...path,
    };
  }

  // toPerson is step-sibling of fromPerson (share a step-parent but no biological parent)
  const isStepSibling = fromParentsArr.some((p) =>
    getSpouses(index, p).some((sp) => getChildren(index, sp).includes(toPersonId)),
  ) && !shareAnyParent(index, fromPersonId, toPersonId);

  if (isStepSibling) {
    return {
      relationship: genderedLabel(toPerson.gender, 'Step-brother', 'Step-sister', 'Step-sibling'),
      ...path,
    };
  }

  // ── Lateral relatives via shared biological ancestor ──────────────────────
  const fromAncestorDistances = getAncestorDistances(index, fromPersonId);
  const toAncestorDistances = getAncestorDistances(index, toPersonId);
  const sharedAncestors = [...fromAncestorDistances.keys()].filter((id) => toAncestorDistances.has(id));

  if (sharedAncestors.length > 0) {
    // Pick the pair that minimises total distance (closest shared ancestor)
    let bestD1 = Infinity;
    let bestD2 = Infinity;

    for (const id of sharedAncestors) {
      const d1 = fromAncestorDistances.get(id)!;
      const d2 = toAncestorDistances.get(id)!;
      if (d1 + d2 < bestD1 + bestD2) {
        bestD1 = d1;
        bestD2 = d2;
      }
    }

    const fromIsShorter = bestD1 <= bestD2;
    const shorter = Math.min(bestD1, bestD2);
    const longer = Math.max(bestD1, bestD2);
    const degree = shorter - 1;
    const removal = longer - shorter;

    if (degree === 0) {
      // One side is exactly one step from the shared ancestor → uncle/niece axis
      // removal tells us how many "Great-" prefixes
      const greats = removal > 1 ? 'Great-'.repeat(removal - 1) : '';
      if (fromIsShorter) {
        // toPerson is the younger-generation relative.
        return {
          relationship: removal === 1
            ? genderedLabel(toPerson.gender, 'Nephew', 'Niece', 'Niece/Nephew')
            : `${greats}${genderedLabel(toPerson.gender, 'nephew', 'niece', 'nephew/niece')}`,
          ...path,
        };
      }

      return {
        relationship: removal === 1
          ? genderedLabel(toPerson.gender, 'Uncle', 'Aunt', 'Aunt/Uncle')
          : `${greats}${genderedLabel(toPerson.gender, 'uncle', 'aunt', 'aunt/uncle')}`,
        ...path,
      };
    }

    // degree ≥ 1 → cousin relationship
    const ordinal = cousinOrdinal(degree);
    if (removal === 0) {
      return { relationship: `${ordinal} cousin`, ...path };
    }

    return { relationship: `${ordinal} cousin ${removal}× removed`, ...path };
  }

  return { relationship: 'Extended family', ...path };
}
