export type PersonGender = 'unspecified' | 'female' | 'male' | 'non-binary' | 'other';

export interface PersonPhoto {
  id: string;
  url: string;
  path: string;
  createdAt: string;
}

export interface PersonRecord {
  id: string;
  treeId: string;
  ownerId: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: PersonGender;
  notes: string;
  photos: PersonPhoto[];
  preferredPhotoId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonInput {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: PersonGender;
  notes: string;
  preferredPhotoRef?: string;
}

export interface PersonMutationPayload extends PersonInput {
  existingPhotos: PersonPhoto[];
  removedPhotos: PersonPhoto[];
  newPhotoUris: string[];
}

export function getPreferredPersonPhoto(person?: PersonRecord | null) {
  if (!person?.preferredPhotoId) {
    return null;
  }

  return person.photos.find((photo) => photo.id === person.preferredPhotoId) ?? null;
}

export function getDisplayPersonPhoto(person?: PersonRecord | null) {
  return getPreferredPersonPhoto(person) ?? person?.photos[0] ?? null;
}

