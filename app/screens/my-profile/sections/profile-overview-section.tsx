import React from 'react';
import type { PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import type { RelationshipRecord } from '../../../../components/dto/relationship';
import { ProfileOverviewCard } from '../../profile-shared/profile-overview-card';

export function ProfileOverviewSection({
  linkedPerson,
  preferredPhoto,
  relationships,
  canEdit,
  onEdit,
  onOpenPhotos,
  onOpenNotes,
  onAddRelationship,
}: {
  linkedPerson: PersonRecord;
  preferredPhoto: PersonPhoto | null | undefined;
  relationships: RelationshipRecord[];
  canEdit: boolean;
  onEdit: () => void;
  onOpenPhotos: () => void;
  onOpenNotes: () => void;
  onAddRelationship: () => void;
}) {
  return (
    <ProfileOverviewCard
      person={linkedPerson}
      preferredPhoto={preferredPhoto}
      relationships={relationships}
      canEdit={canEdit}
      onEdit={onEdit}
      onOpenPhotos={onOpenPhotos}
      onOpenNotes={onOpenNotes}
      onAddRelationship={onAddRelationship}
      delay={70}
    />
  );
}
