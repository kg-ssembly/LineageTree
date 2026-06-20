import type { PersonRecord } from './dto/person';
import type { RelationshipRecord, RelationshipType } from './dto/relationship';

type RelationshipValidationInput = {
  people?: PersonRecord[];
  relationships: RelationshipRecord[];
  type: RelationshipType;
  fromPersonId: string;
  toPersonId: string;
  ignoreRelationshipId?: string | null;
};

export function normalizeRelationshipEndpoints(
  type: RelationshipType,
  fromPersonId: string,
  toPersonId: string,
) {
  if (type !== 'spouse') {
    return { fromPersonId, toPersonId };
  }

  const [firstId, secondId] = [fromPersonId, toPersonId].sort();
  return { fromPersonId: firstId, toPersonId: secondId };
}

export function findDuplicateRelationship(
  relationships: RelationshipRecord[],
  type: RelationshipType,
  fromPersonId: string,
  toPersonId: string,
  ignoreRelationshipId?: string | null,
) {
  const normalized = normalizeRelationshipEndpoints(type, fromPersonId, toPersonId);
  return relationships.some((relationship) => {
    if (relationship.id === ignoreRelationshipId) {
      return false;
    }
    if (relationship.type !== type) {
      return false;
    }

    const current = normalizeRelationshipEndpoints(
      relationship.type,
      relationship.fromPersonId,
      relationship.toPersonId,
    );

    return current.fromPersonId === normalized.fromPersonId
      && current.toPersonId === normalized.toPersonId;
  });
}

function buildsCircularAncestry(
  relationships: RelationshipRecord[],
  parentId: string,
  childId: string,
  ignoreRelationshipId?: string | null,
) {
  const childrenByParentId = new Map<string, Set<string>>();

  relationships.forEach((relationship) => {
    if (relationship.id === ignoreRelationshipId || relationship.type !== 'parent-child') {
      return;
    }

    if (!childrenByParentId.has(relationship.fromPersonId)) {
      childrenByParentId.set(relationship.fromPersonId, new Set());
    }
    childrenByParentId.get(relationship.fromPersonId)!.add(relationship.toPersonId);
  });

  const stack = [childId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (currentId === parentId) {
      return true;
    }
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);
    (childrenByParentId.get(currentId) ?? new Set()).forEach((nextId) => {
      if (!visited.has(nextId)) {
        stack.push(nextId);
      }
    });
  }

  return false;
}

export function validateProposedRelationship({
  people,
  relationships,
  type,
  fromPersonId,
  toPersonId,
  ignoreRelationshipId,
}: RelationshipValidationInput) {
  if (!fromPersonId || !toPersonId) {
    return null;
  }

  if (fromPersonId === toPersonId) {
    return type === 'spouse'
      ? 'A family member cannot be their own spouse.'
      : 'A family member cannot be their own parent or child.';
  }

  if (people && people.length > 0) {
    const peopleById = new Set(people.map((person) => person.id));
    if (!peopleById.has(fromPersonId) || !peopleById.has(toPersonId)) {
      return 'Select valid family members for this relationship.';
    }
  }

  if (findDuplicateRelationship(relationships, type, fromPersonId, toPersonId, ignoreRelationshipId)) {
    return 'That relationship already exists.';
  }

  if (type === 'parent-child' && buildsCircularAncestry(relationships, fromPersonId, toPersonId, ignoreRelationshipId)) {
    return 'That parent-child link would create a circular ancestry loop.';
  }

  return null;
}
