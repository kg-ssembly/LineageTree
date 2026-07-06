import type { PersonRecord } from './dto/person';
import {
  DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
  DEFAULT_SPOUSE_RELATIONSHIP_STATUS,
  type ParentChildRelationshipKind,
  type RelationshipRecord,
  type SpouseRelationshipStatus,
} from './dto/relationship';
import { getRelationshipValidationResolution } from './family-tree-validation';

export type SuggestedRelationshipMode = 'parent-of' | 'child-of' | 'spouse-of';
export type SuggestedRelationshipReason = 'parent-spouse' | 'child-other-parent' | 'spouse-child';

export type SuggestedRelationship = {
  id: string;
  mode: SuggestedRelationshipMode;
  relatedPersonId: string;
  parentChildKind?: ParentChildRelationshipKind;
  relationshipStatus?: SpouseRelationshipStatus;
  reason: SuggestedRelationshipReason;
  sourcePersonId: string;
  defaultEnabled: boolean;
};

type RelationshipSuggestionInput = {
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  subjectPersonId: string;
  pendingRelationships: Array<{
    mode: SuggestedRelationshipMode;
    relatedPersonId: string;
    parentChildKind?: ParentChildRelationshipKind;
    relationshipStatus?: SpouseRelationshipStatus;
  }>;
};

function isCurrentSpouseStatus(status?: SpouseRelationshipStatus) {
  return !status || status === 'partner' || status === 'married';
}

function getSpouseSignature(leftPersonId: string, rightPersonId: string) {
  return ['spouse', ...[leftPersonId, rightPersonId].sort()].join(':');
}

function getPendingRelationshipSignature(
  subjectPersonId: string,
  relationship: {
    mode: SuggestedRelationshipMode;
    relatedPersonId: string;
  },
) {
  if (relationship.mode === 'spouse-of') {
    return getSpouseSignature(subjectPersonId, relationship.relatedPersonId);
  }

  const fromPersonId = relationship.mode === 'child-of' ? relationship.relatedPersonId : subjectPersonId;
  const toPersonId = relationship.mode === 'child-of' ? subjectPersonId : relationship.relatedPersonId;
  return `parent-child:${fromPersonId}:${toPersonId}`;
}

function createPendingValidationRelationships(
  subjectPersonId: string,
  pendingRelationships: RelationshipSuggestionInput['pendingRelationships'],
): RelationshipRecord[] {
  return pendingRelationships
    .filter((relationship) => relationship.relatedPersonId)
    .map((relationship, index) => ({
      id: `__suggested-pending-relationship__-${index}`,
      treeId: '',
      ownerId: '',
      type: relationship.mode === 'spouse-of' ? 'spouse' : 'parent-child',
      fromPersonId: relationship.mode === 'child-of' ? relationship.relatedPersonId : subjectPersonId,
      toPersonId: relationship.mode === 'child-of' ? subjectPersonId : relationship.relatedPersonId,
      parentChildKind: relationship.mode === 'spouse-of' ? undefined : relationship.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
      relationshipStatus: relationship.mode === 'spouse-of' ? relationship.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS : undefined,
      createdAt: '',
    }));
}

export function buildRelationshipSuggestions({
  people,
  relationships,
  subjectPersonId,
  pendingRelationships,
}: RelationshipSuggestionInput): SuggestedRelationship[] {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const pendingValidationRelationships = createPendingValidationRelationships(subjectPersonId, pendingRelationships);
  const validationRelationships = [...relationships, ...pendingValidationRelationships];
  const existingRelationshipSignatures = new Set<string>();

  relationships.forEach((relationship) => {
    if (relationship.type === 'spouse') {
      existingRelationshipSignatures.add(getSpouseSignature(relationship.fromPersonId, relationship.toPersonId));
      return;
    }

    existingRelationshipSignatures.add(`parent-child:${relationship.fromPersonId}:${relationship.toPersonId}`);
  });

  pendingRelationships.forEach((relationship) => {
    existingRelationshipSignatures.add(getPendingRelationshipSignature(subjectPersonId, relationship));
  });

  const suggestions: SuggestedRelationship[] = [];
  const suggestedSignatures = new Set<string>();

  const addSuggestion = (candidate: Omit<SuggestedRelationship, 'id' | 'defaultEnabled'>) => {
    if (!candidate.relatedPersonId || candidate.relatedPersonId === subjectPersonId || !peopleById.has(candidate.relatedPersonId)) {
      return;
    }

    const signature = getPendingRelationshipSignature(subjectPersonId, candidate);
    if (existingRelationshipSignatures.has(signature) || suggestedSignatures.has(signature)) {
      return;
    }

    const validationResolution = getRelationshipValidationResolution({
      people,
      relationships: validationRelationships,
      type: candidate.mode === 'spouse-of' ? 'spouse' : 'parent-child',
      fromPersonId: candidate.mode === 'child-of' ? candidate.relatedPersonId : subjectPersonId,
      toPersonId: candidate.mode === 'child-of' ? subjectPersonId : candidate.relatedPersonId,
      parentChildKind: candidate.mode === 'spouse-of' ? undefined : candidate.parentChildKind ?? DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
      relationshipStatus: candidate.mode === 'spouse-of' ? candidate.relationshipStatus ?? DEFAULT_SPOUSE_RELATIONSHIP_STATUS : undefined,
    });

    if (validationResolution.blockingErrors.length > 0) {
      return;
    }

    suggestedSignatures.add(signature);
    suggestions.push({
      ...candidate,
      id: `suggestion:${signature}`,
      defaultEnabled: false,
    });
  };

  pendingRelationships.forEach((relationship) => {
    if (!relationship.relatedPersonId || !peopleById.has(relationship.relatedPersonId)) {
      return;
    }

    if (relationship.mode === 'child-of') {
      relationships
        .filter((candidate) => (
          candidate.type === 'spouse'
          && isCurrentSpouseStatus(candidate.relationshipStatus)
          && (candidate.fromPersonId === relationship.relatedPersonId || candidate.toPersonId === relationship.relatedPersonId)
        ))
        .forEach((candidate) => {
          const spouseId = candidate.fromPersonId === relationship.relatedPersonId
            ? candidate.toPersonId
            : candidate.fromPersonId;

          addSuggestion({
            mode: 'child-of',
            relatedPersonId: spouseId,
            parentChildKind: DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND,
            reason: 'parent-spouse',
            sourcePersonId: relationship.relatedPersonId,
          });
        });
      return;
    }

    if (relationship.mode === 'parent-of') {
      relationships
        .filter((candidate) => (
          candidate.type === 'parent-child'
          && candidate.toPersonId === relationship.relatedPersonId
          && candidate.fromPersonId !== subjectPersonId
        ))
        .forEach((candidate) => {
          addSuggestion({
            mode: 'spouse-of',
            relatedPersonId: candidate.fromPersonId,
            relationshipStatus: DEFAULT_SPOUSE_RELATIONSHIP_STATUS,
            reason: 'child-other-parent',
            sourcePersonId: relationship.relatedPersonId,
          });
        });
      return;
    }

    if (relationship.mode === 'spouse-of') {
      relationships
        .filter((candidate) => candidate.type === 'parent-child' && candidate.fromPersonId === relationship.relatedPersonId)
        .forEach((candidate) => {
          addSuggestion({
            mode: 'parent-of',
            relatedPersonId: candidate.toPersonId,
            parentChildKind: 'non-biological',
            reason: 'spouse-child',
            sourcePersonId: relationship.relatedPersonId,
          });
        });
    }
  });

  return suggestions;
}
