import React from 'react';
import type { PersonRecord } from '../../../../components/dto/person';
import type { RelationshipRecord } from '../../../../components/dto/relationship';
import { PersonRelationshipsSection } from '../../profile-shared';

export type RelationshipSectionTabKey = 'insight' | 'list';

export function RelationshipsSection({
  linkedPerson,
  people,
  relationships,
  relationshipSectionTab,
  setRelationshipSectionTab,
  relationshipEntries,
  canEditLinkedProfile,
  mutating,
  onAddRelationship,
  onEditRelationship,
}: {
  linkedPerson: PersonRecord;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  relationshipSectionTab: RelationshipSectionTabKey;
  setRelationshipSectionTab: (tab: RelationshipSectionTabKey) => void;
  relationshipEntries: Array<{
    relationship: RelationshipRecord;
    mode: 'parent-of' | 'child-of' | 'spouse-of';
    relatedPerson: PersonRecord | null;
    subtitle: string;
  }>;
  canEditLinkedProfile: boolean;
  mutating: boolean;
  onAddRelationship: () => void;
  onEditRelationship: (relationship: RelationshipRecord) => void;
}) {
  return (
    <PersonRelationshipsSection
      person={linkedPerson}
      people={people}
      relationships={relationships}
      canEdit={canEditLinkedProfile}
      mutating={mutating}
      relationshipSectionTab={relationshipSectionTab}
      setRelationshipSectionTab={setRelationshipSectionTab}
      paginatedRelationships={relationshipEntries.map((entry) => ({
        ...entry,
        title: entry.relatedPerson?.firstName ?? '',
      }))}
      relationshipPage={1}
      totalRelationshipPages={1}
      setRelationshipPage={() => undefined}
      onOpenHelperDialog={() => undefined}
      onAddRelationship={onAddRelationship}
      onEditRelationship={onEditRelationship}
    />
  );
}
