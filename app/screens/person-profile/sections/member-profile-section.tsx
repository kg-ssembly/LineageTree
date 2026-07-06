import React from 'react';
import type { PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import type { RelationshipRecord } from '../../../../components/dto/relationship';
import { ProfileOverviewCard } from '../../profile-shared/profile-overview-card';

export function MemberProfileSection({
  person,
  preferredPhoto,
  relationships,
  canEdit,
  linkedCollaboratorLabel,
  isCurrentUsersPerson,
  onOpenHelperDialog,
  onEdit,
  onOpenPhotos,
  onOpenNotes,
  onAddRelationship,
}: {
  person: PersonRecord;
  preferredPhoto: PersonPhoto | null | undefined;
  relationships: RelationshipRecord[];
  canEdit: boolean;
  linkedCollaboratorLabel: string | null;
  isCurrentUsersPerson: boolean;
  onOpenHelperDialog: () => void;
  onEdit: () => void;
  onOpenPhotos: () => void;
  onOpenNotes: () => void;
  onAddRelationship: () => void;
}) {
  return (
    <ProfileOverviewCard
      person={person}
      preferredPhoto={preferredPhoto}
      relationships={relationships}
      canEdit={canEdit}
      linkedCollaboratorLabel={linkedCollaboratorLabel}
      isCurrentUsersPerson={isCurrentUsersPerson}
      onOpenHelperDialog={onOpenHelperDialog}
      onEdit={onEdit}
      onOpenPhotos={onOpenPhotos}
      onOpenNotes={onOpenNotes}
      onAddRelationship={onAddRelationship}
      delay={90}
    />
  );
}
