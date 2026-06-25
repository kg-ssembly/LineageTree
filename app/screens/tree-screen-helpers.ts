import type { NewPersonPhotoInput, PersonInput, PersonMutationPayload, PersonRecord } from '../../components/dto/person';
import type { FamilyTree } from '../../components/dto/tree';
import { getUserNameParts, type UserProfile } from '../../components/dto/user';
import type { ParentChildRelationshipKind, SpouseRelationshipStatus } from '../../components/dto/relationship';
import type { PersonFormSubmission } from '../../components/person-form-dialog';

export function normaliseSurnameKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function treeMatchesSurname(tree: FamilyTree, surname: string) {
  const key = normaliseSurnameKey(surname);
  if (!key) {
    return false;
  }

  if (normaliseSurnameKey(tree.name) === key) {
    return true;
  }

  return tree.surnameVariantGroups.some((group) => (
    [group.primarySurname, ...group.variants]
      .map(normaliseSurnameKey)
      .includes(key)
  ));
}

export function findConnectedTreeForSurname(
  person: PersonRecord,
  surname: string,
  selectedTree: FamilyTree | null,
  trees: FamilyTree[],
) {
  if (!selectedTree) {
    return null;
  }

  const membershipIds = new Set(person.treeMembershipIds);
  return trees.find((tree) => (
    tree.id !== selectedTree.id
    && selectedTree.connectedTreeIds.includes(tree.id)
    && membershipIds.has(tree.id)
    && treeMatchesSurname(tree, surname)
  )) ?? null;
}

export function buildSelfPersonInitialValues(
  user?: Pick<UserProfile, 'displayName' | 'email'> | null,
): Partial<PersonMutationPayload> {
  const selfUserNameParts = getUserNameParts(user);

  return {
    firstName: selfUserNameParts.firstName,
    lastName: selfUserNameParts.lastName,
    gender: 'unspecified',
    birthDate: '',
    deathDate: '',
    notes: '',
    lifeEvents: [],
    existingPhotos: [],
    removedPhotos: [],
    newPhotoUris: [],
    preferredPhotoRef: '',
  };
}

type CreatePersonFromFormSubmissionParams = {
  addParentChildRelationship: (
    ownerId: string,
    treeId: string,
    parentId: string,
    childId: string,
    parentChildKind?: ParentChildRelationshipKind,
  ) => Promise<void>;
  addSpouseRelationship: (
    ownerId: string,
    treeId: string,
    personAId: string,
    personBId: string,
    relationshipStatus?: SpouseRelationshipStatus,
  ) => Promise<void>;
  createPerson: (
    ownerId: string,
    treeId: string,
    input: PersonInput,
    newPhotos: NewPersonPhotoInput[],
  ) => Promise<PersonRecord>;
  selectedTree: Pick<FamilyTree, 'id'> | null;
  userId?: string | null;
};

export async function createPersonFromFormSubmission(
  {
    addParentChildRelationship,
    addSpouseRelationship,
    createPerson,
    selectedTree,
    userId,
  }: CreatePersonFromFormSubmissionParams,
  payload: PersonFormSubmission,
) {
  if (!userId || !selectedTree) {
    return null;
  }

  const createdPerson = await createPerson(
    userId,
    selectedTree.id,
    {
      firstName: payload.firstName,
      middleNames: payload.middleNames,
      lastName: payload.lastName,
      maidenName: payload.maidenName,
      birthDate: payload.birthDate,
      deathDate: payload.deathDate,
      gender: payload.gender,
      notes: payload.notes,
      lifeEvents: payload.lifeEvents,
      preferredPhotoRef: payload.preferredPhotoRef,
    },
    (payload.newPhotos ?? payload.newPhotoUris.map((uri) => ({ uri }))),
  );

  for (const pendingRelationship of payload.pendingRelationships) {
    if (pendingRelationship.mode === 'parent-of') {
      await addParentChildRelationship(
        userId,
        selectedTree.id,
        createdPerson.id,
        pendingRelationship.relatedPersonId,
        pendingRelationship.parentChildKind,
      );
      continue;
    }

    if (pendingRelationship.mode === 'child-of') {
      await addParentChildRelationship(
        userId,
        selectedTree.id,
        pendingRelationship.relatedPersonId,
        createdPerson.id,
        pendingRelationship.parentChildKind,
      );
      continue;
    }

    await addSpouseRelationship(userId, selectedTree.id, createdPerson.id, pendingRelationship.relatedPersonId);
  }

  return createdPerson;
}
