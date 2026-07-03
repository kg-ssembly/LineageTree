import React from 'react';
import type { NewPersonPhotoInput, PersonLifeEvent, PersonPhoto, PersonRecord } from '../../../../components/dto/person';
import { PersonMemoriesSection } from '../../profile-shared';

export type MemorySectionTabKey = 'events' | 'photos' | 'notes';

export function MemoriesSection({
  linkedPerson,
  preferredPhoto,
  memorySectionTab,
  setMemorySectionTab,
  memoryTimeline,
  canEditLinkedProfile,
  mutating,
  selectedPhotoId,
  setSelectedPhotoId,
  onOpenNotesDialog,
  onAddPhotoFromLibrary,
  onAddPhotoFromCamera,
  onRemovePhoto,
  onSetPreferredPhoto,
  onUpdatePhotoDetails,
  photoProcessing,
  onAddLifeEvent,
  onEditLifeEvent,
  onOpenViewer,
}: {
  linkedPerson: PersonRecord;
  preferredPhoto: PersonPhoto | null | undefined;
  memorySectionTab: MemorySectionTabKey;
  setMemorySectionTab: (tab: MemorySectionTabKey) => void;
  memoryTimeline: Array<{ id: string; date: string; title: string; description: string; badgeLabel: string; system: boolean }>;
  canEditLinkedProfile: boolean;
  mutating: boolean;
  onOpenNotesDialog: () => void;
  onAddPhotoFromLibrary: () => void;
  onAddPhotoFromCamera: () => void;
  onRemovePhoto: (photo: PersonPhoto) => void;
  onSetPreferredPhoto: (photo: PersonPhoto, crop: boolean) => void;
  onUpdatePhotoDetails: (photo: PersonPhoto, values: Pick<NewPersonPhotoInput, 'description' | 'linkedLifeEventId'>) => void;
  photoProcessing: boolean;
  onAddLifeEvent: () => void;
  onEditLifeEvent: (event: PersonLifeEvent) => void;
  onOpenViewer: (index: number) => void;
  selectedPhotoId: string | null;
  setSelectedPhotoId: (photoId: string | null) => void;
}) {
  return (
    <PersonMemoriesSection
      person={linkedPerson}
      preferredPhoto={preferredPhoto}
      canEdit={canEditLinkedProfile}
      mutating={mutating}
      selectedPhotoId={selectedPhotoId}
      setSelectedPhotoId={setSelectedPhotoId}
      memorySectionTab={memorySectionTab}
      setMemorySectionTab={setMemorySectionTab}
      memoryTimeline={memoryTimeline}
      onOpenHelperDialog={() => undefined}
      onOpenNotesDialog={onOpenNotesDialog}
      onAddPhotoFromLibrary={onAddPhotoFromLibrary}
      onAddPhotoFromCamera={onAddPhotoFromCamera}
      onRemovePhoto={onRemovePhoto}
      onSetPreferredPhoto={onSetPreferredPhoto}
      onUpdatePhotoDetails={onUpdatePhotoDetails}
      photoProcessing={photoProcessing}
      onOpenViewer={onOpenViewer}
      onAddLifeEvent={onAddLifeEvent}
      onEditLifeEvent={onEditLifeEvent}
    />
  );
}
