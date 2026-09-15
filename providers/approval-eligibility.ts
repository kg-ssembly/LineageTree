import type { FamilyTree } from '../components/dto/tree';
import type { PersonRecord } from '../components/dto/person';
import type { ApprovalRequestPayload } from '../components/dto/approval';

function normaliseSurnameKey(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? '';
}

function buildSurnameCanonicalLookup(tree: FamilyTree) {
  const lookup = new Map<string, string>();

  tree.surnameVariantGroups.forEach((group) => {
    const primaryKey = normaliseSurnameKey(group.primarySurname);
    if (!primaryKey) {
      return;
    }

    lookup.set(primaryKey, primaryKey);
    group.variants.forEach((variant) => {
      const variantKey = normaliseSurnameKey(variant);
      if (variantKey) {
        lookup.set(variantKey, primaryKey);
      }
    });
  });

  return lookup;
}

function getCanonicalSurnameKeysForPerson(
  person: Pick<PersonRecord, 'lastName'> | null | undefined,
  surnameLookup: Map<string, string>,
) {
  const keys = new Set<string>();
  [person?.lastName].forEach((value) => {
    const rawKey = normaliseSurnameKey(value);
    if (!rawKey) {
      return;
    }
    keys.add(surnameLookup.get(rawKey) ?? rawKey);
  });

  return keys;
}

function intersectsSurnames(left: Set<string>, right: Set<string>) {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }
  return false;
}

function getApprovalScopeSurnames(
  tree: FamilyTree,
  peopleById: Map<string, PersonRecord>,
  payload: ApprovalRequestPayload,
) {
  const surnameLookup = buildSurnameCanonicalLookup(tree);
  const scope = new Set<string>();
  const peopleToInspect = [
    payload.beforePerson,
    payload.afterPerson,
    payload.deletedPerson,
  ].filter(Boolean) as PersonRecord[];

  if (payload.relationship) {
    const fromPerson = peopleById.get(payload.relationship.fromPersonId);
    const toPerson = peopleById.get(payload.relationship.toPersonId);
    if (fromPerson) {
      peopleToInspect.push(fromPerson);
    }
    if (toPerson) {
      peopleToInspect.push(toPerson);
    }
  }

  (payload.relationships ?? []).forEach((relationship) => {
    const fromPerson = peopleById.get(relationship.fromPersonId);
    const toPerson = peopleById.get(relationship.toPersonId);
    if (fromPerson) {
      peopleToInspect.push(fromPerson);
    }
    if (toPerson) {
      peopleToInspect.push(toPerson);
    }
  });

  peopleToInspect.forEach((person) => {
    getCanonicalSurnameKeysForPerson(person, surnameLookup).forEach((surname) => scope.add(surname));
  });

  return { scope, surnameLookup };
}

export function determineEligibleApproverIds(
  tree: FamilyTree,
  requesterUserId: string,
  payload: ApprovalRequestPayload,
  people: PersonRecord[],
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const { scope, surnameLookup } = getApprovalScopeSurnames(tree, peopleById, payload);

  const nonContributorApprovers = tree.collaborators
    .filter((collaborator) => collaborator.userId !== requesterUserId)
    .filter((collaborator) => collaborator.role === 'owner' || collaborator.role === 'editor')
    .map((collaborator) => collaborator.userId);

  const contributorApprovers = tree.collaborators
    .filter((collaborator) => collaborator.userId !== requesterUserId)
    .filter((collaborator) => collaborator.role === 'contributor');

  const matchingContributorIds = scope.size === 0
    ? contributorApprovers.map((collaborator) => collaborator.userId)
    : contributorApprovers
      .filter((collaborator) => {
        const assignedPersonId = tree.personAssignments[collaborator.userId];
        const assignedPerson = assignedPersonId ? peopleById.get(assignedPersonId) ?? null : null;
        if (!assignedPerson) {
          return false;
        }

        const contributorSurnames = getCanonicalSurnameKeysForPerson(assignedPerson, surnameLookup);
        return intersectsSurnames(scope, contributorSurnames);
      })
      .map((collaborator) => collaborator.userId);

  return {
    eligibleApproverIds: [...new Set([...nonContributorApprovers, ...matchingContributorIds])],
    autoApproveBecauseNoSameSurnameContributor: scope.size > 0 && matchingContributorIds.length === 0,
  };
}

