import React from 'react';
import type { PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import { PersonPhotoViewerModal } from '../../profile-shared';

export function PhotoViewerModal({
  linkedPerson,
  viewerIndex,
  setViewerIndex,
  onEditPhoto,
}: {
  linkedPerson: PersonRecord | null;
  viewerIndex: number | null;
  setViewerIndex: React.Dispatch<React.SetStateAction<number | null>>;
  onEditPhoto?: (photo: PersonPhoto) => void;
}) {
  if (!linkedPerson) {
    return null;
  }

  return (
    <PersonPhotoViewerModal
      person={linkedPerson}
      viewerIndex={viewerIndex}
      setViewerIndex={setViewerIndex}
      onEditPhoto={onEditPhoto}
    />
  );
}
