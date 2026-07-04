import type { NewPersonPhotoInput, PersonInput, PersonMutationPayload, PersonRecord } from '../../components/dto/person';
import type { FamilyTree } from '../../components/dto/tree';
import { getUserNameParts, type UserProfile } from '../../components/dto/user';
import type { ParentChildRelationshipKind, RelationshipRecord, SpouseRelationshipStatus } from '../../components/dto/relationship';
import { DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND, DEFAULT_SPOUSE_RELATIONSHIP_STATUS } from '../../components/dto/relationship';
import type { PendingRelationshipSubmission, PersonFormSubmission } from '../../components/person-form-dialog';
import { getRelationshipValidationFeedback } from '../../components/family-tree-validation';
import { treeMatchesSurname } from '../../providers/maiden-tree-search';
export { findMaidenTreeCandidates, normaliseSurnameKey, type MaidenTreeSuggestionCandidate } from '../../providers/maiden-tree-search';

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
  peopleForValidation?: PersonRecord[];
  relationshipsForValidation?: RelationshipRecord[];
  selectedTree: Pick<FamilyTree, 'id'> | null;
  userId?: string | null;
};

function buildPendingValidationRelationships(
  pendingRelationships: PendingRelationshipSubmission[],
  subjectPersonId: string,
): RelationshipRecord[] {
  return pendingRelationships
    .filter((relationship) => relationship.relatedPersonId)
    .map((relationship, index) => ({
      id: `__pending-relationship__-${index}`,
      treeId: '',
      ownerId: '',
      type: relationship.mode === 'spouse-of' ? 'spouse' : 'parent-child',
      fromPersonId: relationship.mode === 'child-of' ? relationship.relatedPersonId : subjectPersonId,
      toPersonId: relationship.mode === 'child-of' ? subjectPersonId : relationship.relatedPersonId,
      parentChildKind: relationship.mode === 'spouse-of'
        ? undefined
        : relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
      relationshipStatus: relationship.mode === 'spouse-of'
        ? relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS
        : undefined,
      createdAt: '',
    }));
}

export function getFirstPendingRelationshipValidationError({
  subjectPerson,
  pendingRelationships,
  people,
  relationships,
}: {
  subjectPerson: PersonRecord;
  pendingRelationships: PendingRelationshipSubmission[];
  people: PersonRecord[];
  relationships: RelationshipRecord[];
}) {
  const validationPeople = [
    subjectPerson,
    ...new Map(people.map((person) => [person.id, person])).values(),
  ];
  const pendingValidationRelationships = buildPendingValidationRelationships(
    pendingRelationships,
    subjectPerson.id,
  );
  const allRelationships = [...relationships, ...pendingValidationRelationships];
  const pendingRelationshipIdByCompositeKey = new Map<string, string>();

  pendingValidationRelationships.forEach((relationship) => {
    pendingRelationshipIdByCompositeKey.set(
      `${relationship.type}:${relationship.fromPersonId}:${relationship.toPersonId}`,
      relationship.id,
    );
  });

  for (const relationship of pendingRelationships) {
    if (!relationship.relatedPersonId) {
      continue;
    }

    const relationshipType = relationship.mode === 'spouse-of' ? 'spouse' : 'parent-child';
    const fromPersonId = relationship.mode === 'child-of' ? relationship.relatedPersonId : subjectPerson.id;
    const toPersonId = relationship.mode === 'child-of' ? subjectPerson.id : relationship.relatedPersonId;
    const feedback = getRelationshipValidationFeedback({
      people: validationPeople,
      relationships: allRelationships,
      type: relationshipType,
      fromPersonId,
      toPersonId,
      parentChildKind: relationship.mode === 'spouse-of' ? undefined : relationship.parentChildKind,
      relationshipStatus: relationship.mode === 'spouse-of' ? relationship.relationshipStatus : undefined,
      ignoreRelationshipId: pendingRelationshipIdByCompositeKey.get(
        `${relationshipType}:${fromPersonId}:${toPersonId}`,
      ),
    });

    if (feedback.errors.length > 0) {
      return feedback.errors[0] ?? null;
    }
  }

  return null;
}

export async function createPersonFromFormSubmission(
  {
    addParentChildRelationship,
    addSpouseRelationship,
    createPerson,
    peopleForValidation = [],
    relationshipsForValidation = [],
    selectedTree,
    userId,
  }: CreatePersonFromFormSubmissionParams,
  payload: PersonFormSubmission,
) {
  if (!userId || !selectedTree) {
    return null;
  }

  if (payload.pendingRelationships.length > 0 && peopleForValidation.length > 0) {
    const validationError = getFirstPendingRelationshipValidationError({
      subjectPerson: {
        id: '__new-person__',
        treeId: selectedTree.id,
        treeMembershipIds: [],
        treeMemberships: [],
        ownerId: userId,
        firstName: payload.firstName,
        middleNames: payload.middleNames,
        lastName: payload.lastName,
        maidenName: payload.maidenName,
        nicknames: [],
        clanName: '',
        familyBranch: '',
        hometown: '',
        birthPlace: '',
        surnameVariantHints: [],
        canonicalPersonId: '',
        duplicatePersonIds: [],
        birthDate: payload.birthDate,
        deathDate: payload.deathDate,
        gender: payload.gender,
        notes: payload.notes,
        lifeEvents: payload.lifeEvents,
        photos: [],
        preferredPhotoId: '',
        createdAt: '',
        updatedAt: '',
      },
      pendingRelationships: payload.pendingRelationships,
      people: peopleForValidation,
      relationships: relationshipsForValidation,
    });

    if (validationError) {
      throw new Error(validationError);
    }
  }

  const createdPerson = await createPerson(
    userId,
    selectedTree.id,
    {
      firstName: payload.firstName,
      middleNames: payload.middleNames,
      lastName: payload.lastName,
      maidenName: payload.maidenName,
      surnameVariantHints: payload.surnameVariantHints,
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

    await addSpouseRelationship(
      userId,
      selectedTree.id,
      createdPerson.id,
      pendingRelationship.relatedPersonId,
      pendingRelationship.relationshipStatus,
    );
  }

  return createdPerson;
}
