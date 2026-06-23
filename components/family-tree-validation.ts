import type { PersonInput, PersonRecord } from './dto/person';
import { parsePersonDate } from './dto/person';
import type { ParentChildRelationshipKind, RelationshipRecord, RelationshipType } from './dto/relationship';
import { translate } from '../i18n';

const MIN_BIOLOGICAL_PARENT_AGE = 12;

type RelationshipValidationInput = {
  people?: PersonRecord[];
  relationships: RelationshipRecord[];
  type: RelationshipType;
  fromPersonId: string;
  toPersonId: string;
  parentChildKind?: ParentChildRelationshipKind;
  ignoreRelationshipId?: string | null;
};

type PersonValidationInput = {
  people: PersonRecord[];
  person: Pick<PersonInput, 'firstName' | 'middleNames' | 'lastName' | 'maidenName' | 'birthDate' | 'deathDate'>;
  ignorePersonId?: string | null;
};

type ValidationFeedback = {
  errors: string[];
  warnings: string[];
};

function normaliseNamePart(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';
}

function getFirstToken(value?: string) {
  return normaliseNamePart(value).split(' ').filter(Boolean)[0] ?? '';
}

const NICKNAME_GROUPS = [
  ['john', 'jon', 'johnny', 'jonny', 'jonathan'],
  ['katherine', 'catherine', 'kathryn', 'kathy', 'katie', 'kate', 'kat'],
  ['margaret', 'maggie', 'meg', 'megan', 'peggy', 'rita'],
  ['elizabeth', 'liz', 'beth', 'lizzy', 'eliza', 'betsy'],
  ['william', 'bill', 'billy', 'will', 'willy', 'liam'],
  ['robert', 'rob', 'robbie', 'bob', 'bobby'],
  ['james', 'jim', 'jimmy', 'jamie'],
  ['joseph', 'joe', 'joey'],
  ['daniel', 'dan', 'danny'],
  ['michael', 'mike', 'mikey'],
  ['andrew', 'andy', 'drew'],
  ['anthony', 'tony'],
  ['nicholas', 'nick', 'nicky'],
  ['steven', 'stephen', 'steve'],
  ['sarah', 'sara'],
  ['rebecca', 'rebekah', 'becky', 'becca'],
  ['christopher', 'chris'],
];

function canonicalGivenName(value?: string) {
  const token = getFirstToken(value);
  if (!token) {
    return '';
  }

  const matchedGroup = NICKNAME_GROUPS.find((group) => group.includes(token));
  return matchedGroup?.[0] ?? token;
}

function getEditDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }
  if (!left.length) {
    return right.length;
  }
  if (!right.length) {
    return left.length;
  }

  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let column = 1; column <= right.length; column += 1) {
    let previous = rows[0];
    rows[0] = column;

    for (let row = 1; row <= left.length; row += 1) {
      const current = rows[row];
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row] = Math.min(
        rows[row] + 1,
        rows[row - 1] + 1,
        previous + cost,
      );
      previous = current;
    }
  }

  return rows[left.length];
}

function isNearDuplicateGivenName(left?: string, right?: string) {
  const canonicalLeft = canonicalGivenName(left);
  const canonicalRight = canonicalGivenName(right);
  if (!canonicalLeft || !canonicalRight) {
    return false;
  }
  if (canonicalLeft === canonicalRight) {
    return true;
  }

  const maxLength = Math.max(canonicalLeft.length, canonicalRight.length);
  if (maxLength < 4) {
    return false;
  }

  return getEditDistance(canonicalLeft, canonicalRight) <= 1;
}

function getAgeDifferenceInYears(olderDateValue: string, youngerDateValue: string) {
  const olderDate = parsePersonDate(olderDateValue);
  const youngerDate = parsePersonDate(youngerDateValue);
  if (!olderDate || !youngerDate) {
    return null;
  }

  let years = youngerDate.getFullYear() - olderDate.getFullYear();
  const monthDelta = youngerDate.getMonth() - olderDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && youngerDate.getDate() < olderDate.getDate())) {
    years -= 1;
  }

  return years;
}

function isNonBiologicalParentChildKind(kind?: ParentChildRelationshipKind) {
  return kind === 'non-biological' || kind === 'step' || kind === 'adopted' || kind === 'foster' || kind === 'guardian';
}

function isBiologicalParentChildKind(kind?: ParentChildRelationshipKind) {
  return !kind || kind === 'biological';
}

function getBiologicalParentIdsForChild(
  relationships: RelationshipRecord[],
  childId: string,
  ignoreRelationshipId?: string | null,
) {
  return relationships
    .filter((relationship) => relationship.id !== ignoreRelationshipId)
    .filter((relationship) => relationship.type === 'parent-child' && relationship.toPersonId === childId)
    .filter((relationship) => isBiologicalParentChildKind(relationship.parentChildKind))
    .map((relationship) => relationship.fromPersonId);
}

export function getPersonValidationFeedback({
  people,
  person,
  ignorePersonId,
}: PersonValidationInput): ValidationFeedback {
  const errors: string[] = [];
  const warnings: string[] = [];
  const firstName = normaliseNamePart(person.firstName);
  const middleNames = normaliseNamePart(person.middleNames);
  const lastName = normaliseNamePart(person.lastName);
  const birthDate = person.birthDate.trim();
  const deathDate = person.deathDate.trim();

  if (!firstName) {
    errors.push(translate('First name is required.'));
  }

  if (birthDate && deathDate && deathDate < birthDate) {
    errors.push(translate('Death date cannot be earlier than birth date.'));
  }

  const matches = people.filter((candidate) => {
    if (candidate.id === ignorePersonId) {
      return false;
    }

    return normaliseNamePart(candidate.firstName) === firstName
      && normaliseNamePart(candidate.middleNames) === middleNames
      && normaliseNamePart(candidate.lastName) === lastName;
  });

  const exactDuplicate = matches.find((candidate) => {
    const sameBirth = birthDate && candidate.birthDate === birthDate;
    const sameDeath = deathDate && candidate.deathDate === deathDate;
    return sameBirth || sameDeath;
  });

  if (exactDuplicate) {
    errors.push(translate('A family member with the same name and date already exists. Review before saving a duplicate.'));
  } else if (matches.length > 0) {
    warnings.push(translate('A family member with the same name already exists. Please check that this is not a duplicate.'));
  }

  const nearDuplicate = people.find((candidate) => {
    if (candidate.id === ignorePersonId) {
      return false;
    }

    const sameLastName = normaliseNamePart(candidate.lastName) === lastName && Boolean(lastName);
    if (!sameLastName) {
      return false;
    }

    const directNearMatch = isNearDuplicateGivenName(person.firstName, candidate.firstName);
    const swappedMatch = normaliseNamePart(person.firstName) === getFirstToken(candidate.middleNames)
      && getFirstToken(person.middleNames) === normaliseNamePart(candidate.firstName);

    return directNearMatch || swappedMatch;
  });

  if (nearDuplicate) {
    warnings.push(translate('This looks very similar to an existing family member name. Please check for a near-duplicate before saving.'));
  }

  if (!lastName && person.maidenName?.trim()) {
    warnings.push(translate('This person has a maiden name recorded but no current surname yet.'));
  }

  return { errors, warnings };
}

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

function buildParentChildIndex(relationships: RelationshipRecord[], ignoreRelationshipId?: string | null) {
  const childrenByParentId = new Map<string, Set<string>>();
  const parentIdsByChildId = new Map<string, Set<string>>();

  relationships.forEach((relationship) => {
    if (relationship.id === ignoreRelationshipId || relationship.type !== 'parent-child') {
      return;
    }

    if (!childrenByParentId.has(relationship.fromPersonId)) {
      childrenByParentId.set(relationship.fromPersonId, new Set());
    }
    childrenByParentId.get(relationship.fromPersonId)!.add(relationship.toPersonId);

    if (!parentIdsByChildId.has(relationship.toPersonId)) {
      parentIdsByChildId.set(relationship.toPersonId, new Set());
    }
    parentIdsByChildId.get(relationship.toPersonId)!.add(relationship.fromPersonId);
  });

  return { childrenByParentId, parentIdsByChildId };
}

function isAncestorOf(
  childrenByParentId: Map<string, Set<string>>,
  ancestorId: string,
  descendantId: string,
) {
  const stack = [...(childrenByParentId.get(ancestorId) ?? new Set<string>())];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (currentId === descendantId) {
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

function sharesParent(
  parentIdsByChildId: Map<string, Set<string>>,
  personAId: string,
  personBId: string,
) {
  const personAParents = parentIdsByChildId.get(personAId) ?? new Set<string>();
  return [...(parentIdsByChildId.get(personBId) ?? new Set<string>())].some((parentId) => personAParents.has(parentId));
}

export function validateProposedRelationship({
  people,
  relationships,
  type,
  fromPersonId,
  toPersonId,
  parentChildKind,
  ignoreRelationshipId,
}: RelationshipValidationInput) {
  return getRelationshipValidationFeedback({
    people,
    relationships,
    type,
    fromPersonId,
    toPersonId,
    parentChildKind,
    ignoreRelationshipId,
  }).errors[0] ?? null;
}

export function getRelationshipValidationFeedback({
  people,
  relationships,
  type,
  fromPersonId,
  toPersonId,
  parentChildKind,
  ignoreRelationshipId,
}: RelationshipValidationInput): ValidationFeedback {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fromPersonId || !toPersonId) {
    return { errors, warnings };
  }

  if (fromPersonId === toPersonId) {
    errors.push(type === 'spouse'
      ? translate('A family member cannot be their own spouse.')
      : translate('A family member cannot be their own parent or child.'));
    return { errors, warnings };
  }

  if (people && people.length > 0) {
    const peopleById = new Map(people.map((person) => [person.id, person]));
    if (!peopleById.has(fromPersonId) || !peopleById.has(toPersonId)) {
      errors.push(translate('Select valid family members for this relationship.'));
      return { errors, warnings };
    }

    if (type === 'parent-child') {
      const parent = peopleById.get(fromPersonId)!;
      const child = peopleById.get(toPersonId)!;
      const biologicalParentIds = getBiologicalParentIdsForChild(relationships, toPersonId, ignoreRelationshipId);
      const nextBiologicalParentIds = isBiologicalParentChildKind(parentChildKind)
        ? [...new Set([...biologicalParentIds, fromPersonId])]
        : biologicalParentIds;

      if (isBiologicalParentChildKind(parentChildKind) && nextBiologicalParentIds.length > 2) {
        warnings.push(translate('This child would have more than two biological parents recorded. Please double-check the relationship type.'));
      }

      if (parent.birthDate && child.birthDate) {
        const ageGap = getAgeDifferenceInYears(parent.birthDate, child.birthDate);
        if (typeof ageGap === 'number') {
          if (ageGap < 0) {
            if (parentChildKind === 'biological' || !isNonBiologicalParentChildKind(parentChildKind)) {
              errors.push(translate('A biological parent cannot be younger than their child.'));
            } else {
              warnings.push(translate('This parent is younger than the child. If that is intentional, keep this as a non-biological relationship.'));
            }
          } else if (ageGap < MIN_BIOLOGICAL_PARENT_AGE) {
            if (parentChildKind === 'biological' || !isNonBiologicalParentChildKind(parentChildKind)) {
              errors.push(translate('A biological parent should be at least {years} years older than the child.', { years: MIN_BIOLOGICAL_PARENT_AGE }));
            } else {
              warnings.push(translate('This parent is less than {years} years older than the child. Double-check the dates and relationship type.', { years: MIN_BIOLOGICAL_PARENT_AGE }));
            }
          }
        }
      }

      if (parent.deathDate && child.birthDate && parent.deathDate < child.birthDate) {
        warnings.push(translate('This child was recorded as born after the parent died. Please double-check the dates.'));
      }

      if (isBiologicalParentChildKind(parentChildKind) && child.lastName.trim()) {
        const biologicalParents = nextBiologicalParentIds
          .map((parentId) => peopleById.get(parentId))
          .filter((candidate): candidate is PersonRecord => Boolean(candidate));
        const noNonBiologicalContext = relationships
          .filter((relationship) => relationship.id !== ignoreRelationshipId)
          .filter((relationship) => relationship.type === 'parent-child' && relationship.toPersonId === toPersonId)
          .every((relationship) => isBiologicalParentChildKind(relationship.parentChildKind))
          && isBiologicalParentChildKind(parentChildKind);

        const childSurname = normaliseNamePart(child.lastName);
        const childMaidenName = normaliseNamePart(child.maidenName);
        const differsFromAllBiologicalParents = biologicalParents.length >= 2 && biologicalParents.every((biologicalParent) => {
          const parentCurrentSurname = normaliseNamePart(biologicalParent.lastName);
          const parentBirthSurname = normaliseNamePart(biologicalParent.maidenName);
          return childSurname !== parentCurrentSurname
            && childSurname !== parentBirthSurname
            && (!childMaidenName || childMaidenName !== parentCurrentSurname);
        });

        if (differsFromAllBiologicalParents && noNonBiologicalContext && !child.maidenName?.trim()) {
          warnings.push(translate('This child surname differs from both biological parents and there is no maiden-name or non-biological context recorded.'));
        }
      }
    }

    if (type === 'spouse') {
      const biologicalChildrenForParent = (parentId: string) => new Set(
        relationships
          .filter((relationship) => relationship.id !== ignoreRelationshipId)
          .filter((relationship) => relationship.type === 'parent-child' && relationship.fromPersonId === parentId)
          .filter((relationship) => isBiologicalParentChildKind(relationship.parentChildKind))
          .map((relationship) => relationship.toPersonId),
      );
      const firstParentChildren = biologicalChildrenForParent(fromPersonId);
      const sharedBiologicalChildIds = [...biologicalChildrenForParent(toPersonId)]
        .filter((childId) => firstParentChildren.has(childId));

      const hasImplausibleSharedChildTimeline = sharedBiologicalChildIds.some((childId) => {
        const child = peopleById.get(childId);
        const firstParent = peopleById.get(fromPersonId);
        const secondParent = peopleById.get(toPersonId);
        if (!child?.birthDate || !firstParent || !secondParent) {
          return false;
        }

        const firstAgeGap = firstParent.birthDate ? getAgeDifferenceInYears(firstParent.birthDate, child.birthDate) : null;
        const secondAgeGap = secondParent.birthDate ? getAgeDifferenceInYears(secondParent.birthDate, child.birthDate) : null;
        const bornAfterFirstParentDeath = Boolean(firstParent.deathDate && firstParent.deathDate < child.birthDate);
        const bornAfterSecondParentDeath = Boolean(secondParent.deathDate && secondParent.deathDate < child.birthDate);

        return bornAfterFirstParentDeath
          || bornAfterSecondParentDeath
          || (typeof firstAgeGap === 'number' && firstAgeGap < MIN_BIOLOGICAL_PARENT_AGE)
          || (typeof secondAgeGap === 'number' && secondAgeGap < MIN_BIOLOGICAL_PARENT_AGE);
      });

      if (hasImplausibleSharedChildTimeline) {
        warnings.push(translate('These spouses have shared children whose recorded timelines look implausible. Please double-check the parents and birth dates.'));
      }
    }
  }

  if (findDuplicateRelationship(relationships, type, fromPersonId, toPersonId, ignoreRelationshipId)) {
    errors.push(translate('That relationship already exists.'));
    return { errors, warnings };
  }

  const { childrenByParentId, parentIdsByChildId } = buildParentChildIndex(relationships, ignoreRelationshipId);

  if (type === 'spouse') {
    if (isAncestorOf(childrenByParentId, fromPersonId, toPersonId) || isAncestorOf(childrenByParentId, toPersonId, fromPersonId)) {
      errors.push(translate('A spouse relationship cannot be added between an ancestor and descendant.'));
    }

    if (sharesParent(parentIdsByChildId, fromPersonId, toPersonId)) {
      errors.push(translate('A spouse relationship cannot be added between siblings.'));
    }
  }

  if (type === 'parent-child') {
    if (findDuplicateRelationship(relationships, 'spouse', fromPersonId, toPersonId, ignoreRelationshipId)) {
      errors.push(translate('A parent-child relationship cannot also be a spouse relationship.'));
    }

    if (isAncestorOf(childrenByParentId, fromPersonId, toPersonId)) {
      errors.push(translate('That family member is already an ancestor of this person.'));
    }

    if (sharesParent(parentIdsByChildId, fromPersonId, toPersonId)) {
      errors.push(translate('Siblings cannot be linked as a parent and child.'));
    }
  }

  if (type === 'parent-child' && buildsCircularAncestry(relationships, fromPersonId, toPersonId, ignoreRelationshipId)) {
    errors.push(translate('That parent-child link would create a circular ancestry loop.'));
  }

  return { errors, warnings };
}
