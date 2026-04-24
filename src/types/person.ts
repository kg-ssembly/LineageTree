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
  createdAt: string;
  updatedAt: string;
}

export interface PersonInput {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: PersonGender;
  notes: string;
}

export interface PersonMutationPayload extends PersonInput {
  existingPhotos: PersonPhoto[];
  removedPhotos: PersonPhoto[];
  newPhotoUris: string[];
}

