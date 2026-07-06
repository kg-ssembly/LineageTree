import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import type { NewPersonPhotoInput, PersonPhoto } from '../components/dto/person';
import { cropPhotoForPreferredDisplay, MAX_PHOTO_BYTES } from '../components/photo-utils';
import { storage } from './firebase-provider';
import { nowIso } from './family-tree-shared';

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

export async function uploadPersonPhotos(
  actorUserId: string,
  treeId: string,
  personId: string,
  newPhotos: NewPersonPhotoInput[],
): Promise<PersonPhoto[]> {
  const uploadedPhotos: PersonPhoto[] = [];

  for (let index = 0; index < newPhotos.length; index += 1) {
    const photoInput = newPhotos[index];
    const uri = photoInput.uri;
    const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
    const safeExtension = extension === 'jpg' ? 'jpeg' : extension;
    const photoId = `${Date.now()}-${index}`;
    const path = `treePhotos/${treeId}/${personId}/${actorUserId}-${photoId}.${extension}`;
    const blob = await uriToBlob(uri);
    if (blob.size > MAX_PHOTO_BYTES) {
      throw new Error('Each photo must be smaller than 2 MB before upload.');
    }
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: `image/${safeExtension}` });
    const url = await getDownloadURL(storageRef);

    uploadedPhotos.push({
      id: photoId,
      url,
      path,
      description: photoInput.description?.trim() ?? '',
      linkedLifeEventId: photoInput.linkedLifeEventId?.trim() ?? '',
      createdAt: nowIso(),
    });
  }

  return uploadedPhotos;
}

export async function uploadPreferredPhotoDisplayVariant(
  actorUserId: string,
  treeId: string,
  personId: string,
  preferredPhotoId: string,
  sourceUri: string,
) {
  const croppedPreferred = await cropPhotoForPreferredDisplay(sourceUri);
  if (croppedPreferred.sizeBytes > MAX_PHOTO_BYTES) {
    throw new Error('The preferred photo could not be cropped and compressed below 2 MB.');
  }

  const path = `treePhotos/${treeId}/${personId}/${actorUserId}-${preferredPhotoId}-preferred.jpeg`;
  const blob = await uriToBlob(croppedPreferred.uri);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(storageRef);

  return { url, path };
}

export function applyPreferredPhotoDisplayVariant(
  photos: PersonPhoto[],
  preferredPhotoId: string,
  preferredDisplayPhoto?: { url: string; path: string } | null,
) {
  return photos.map((photo) => {
    if (photo.id !== preferredPhotoId) {
      return {
        ...photo,
        displayUrl: '',
        displayPath: '',
      };
    }

    return {
      ...photo,
      displayUrl: preferredDisplayPhoto?.url ?? '',
      displayPath: preferredDisplayPhoto?.path ?? '',
    };
  });
}

export function resolvePreferredPhotoId(
  preferredPhotoRef: string | undefined,
  existingPhotos: PersonPhoto[],
  newPhotoUris: string[],
  uploadedPhotos: PersonPhoto[],
) {
  if (!preferredPhotoRef) {
    return '';
  }

  const existingPhoto = existingPhotos.find((photo) => photo.id === preferredPhotoRef);
  if (existingPhoto) {
    return existingPhoto.id;
  }

  const uploadedPhotoIndex = newPhotoUris.findIndex((uri) => uri === preferredPhotoRef);
  if (uploadedPhotoIndex >= 0) {
    return uploadedPhotos[uploadedPhotoIndex]?.id ?? '';
  }

  return '';
}

export function resolvePreferredPhotoSourceUri(
  preferredPhotoRef: string | undefined,
  existingPhotos: PersonPhoto[],
  newPhotos: NewPersonPhotoInput[],
) {
  if (!preferredPhotoRef) {
    return '';
  }

  const existingPhoto = existingPhotos.find((photo) => photo.id === preferredPhotoRef);
  if (existingPhoto) {
    return existingPhoto.url;
  }

  return newPhotos.find((photo) => photo.uri === preferredPhotoRef)?.uri ?? '';
}

export function normaliseNewPhotoInputs(
  newPhotoUris: string[],
  newPhotos?: NewPersonPhotoInput[],
) {
  if (Array.isArray(newPhotos) && newPhotos.length > 0) {
    return newPhotos.map((photo) => ({
      uri: photo.uri,
      description: photo.description?.trim() ?? '',
      linkedLifeEventId: photo.linkedLifeEventId?.trim() ?? '',
    }));
  }

  return newPhotoUris.map((uri) => ({ uri, description: '', linkedLifeEventId: '' }));
}

export async function deletePhotos(photos: PersonPhoto[]) {
  await Promise.all(
    photos
      .flatMap((photo) => [photo.path, photo.displayPath].filter(Boolean))
      .map(async (path) => {
        try {
          await deleteObject(ref(storage, path!));
        } catch {
          // Ignore missing objects so a partially deleted tree can still be cleaned up.
        }
      }),
  );
}
