import type { MergePreview, MergeRequestRecord } from '../components/dto/merge';
import type { PersonLifeEvent, PersonPhoto } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';
import { normalizeRelationshipEndpoints } from '../components/family-tree-validation';
import { nowIso } from './family-tree-shared';

export function getMergeSelectedMatches(request: MergeRequestRecord) {
  const selectedMatchIds = new Set(request.selectedMatchIds);
  return request.preview.matches.filter((match) => selectedMatchIds.has(match.id));
}

export function validateSelectedMergeMatches(request: MergeRequestRecord) {
  const sourcePersonIds = new Set<string>();
  const targetPersonIds = new Set<string>();

  getMergeSelectedMatches(request).forEach((match) => {
    if (sourcePersonIds.has(match.sourcePersonId)) {
      throw new Error('Each source family member can only be matched once in a merge.');
    }

    if (targetPersonIds.has(match.targetPersonId)) {
      throw new Error('Each target family member can only be matched once in a merge.');
    }

    sourcePersonIds.add(match.sourcePersonId);
    targetPersonIds.add(match.targetPersonId);
  });
}

function mapPhoto(photo: any, index: number): PersonPhoto {
  return {
    id: photo?.id ?? `${photo?.path ?? photo?.url ?? 'photo'}-${index}`,
    url: photo?.url ?? '',
    path: photo?.path ?? '',
    displayUrl: photo?.displayUrl ?? '',
    displayPath: photo?.displayPath ?? '',
    description: photo?.description ?? '',
    linkedLifeEventId: photo?.linkedLifeEventId ?? '',
    createdAt: photo?.createdAt ?? nowIso(),
  };
}

function mapLifeEvent(event: any, index: number): PersonLifeEvent {
  return {
    id: event?.id ?? `event-${index}`,
    type: event?.type ?? 'custom',
    title: event?.title ?? '',
    date: event?.date ?? '',
    description: event?.description ?? '',
  };
}

function normaliseLifeEvents(lifeEvents: PersonLifeEvent[]) {
  return lifeEvents.map((event, index) => ({
    id: event.id?.trim() || `event-${Date.now()}-${index}`,
    type: event.type ?? 'custom',
    title: event.title.trim(),
    date: event.date.trim(),
    description: event.description.trim(),
  }));
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function mergeUniqueStrings(...values: Array<unknown>) {
  return [...new Set(values.flatMap(asStringArray).map((value) => value.trim()).filter(Boolean))];
}

function mergeTextBlocks(targetValue: unknown, sourceValue: unknown) {
  const targetText = typeof targetValue === 'string' ? targetValue.trim() : '';
  const sourceText = typeof sourceValue === 'string' ? sourceValue.trim() : '';

  if (!targetText) {
    return sourceText;
  }

  if (!sourceText || targetText.includes(sourceText)) {
    return targetText;
  }

  return `${targetText}\n\nMerged note:\n${sourceText}`;
}

function mergeLifeEvents(targetEvents: unknown, sourceEvents: unknown) {
  const eventsByKey = new Map<string, PersonLifeEvent>();
  const addEvent = (event: any, prefix = '') => {
    if (!event) {
      return;
    }

    const normalized = mapLifeEvent(event, eventsByKey.size);
    const contentKey = [
      normalized.type,
      normalized.title.trim().toLowerCase(),
      normalized.date,
      normalized.description.trim().toLowerCase(),
    ].join('|');

    if (eventsByKey.has(contentKey)) {
      return;
    }

    const idInUse = [...eventsByKey.values()].some((existing) => existing.id === normalized.id);
    eventsByKey.set(contentKey, {
      ...normalized,
      id: idInUse ? `${prefix}${normalized.id}` : normalized.id,
    });
  };

  (Array.isArray(targetEvents) ? targetEvents : []).forEach((event) => addEvent(event));
  (Array.isArray(sourceEvents) ? sourceEvents : []).forEach((event) => addEvent(event, 'merged-'));

  return normaliseLifeEvents([...eventsByKey.values()]);
}

function mergePhotos(targetPhotos: unknown, sourcePhotos: unknown, sourcePersonId: string) {
  const photosByKey = new Map<string, PersonPhoto>();
  const usedIds = new Set<string>();
  const addPhoto = (photo: any, fromSource = false) => {
    if (!photo) {
      return;
    }

    const normalized = mapPhoto(photo, photosByKey.size);
    const key = normalized.path || normalized.url || normalized.displayPath || normalized.displayUrl || normalized.id;
    if (!key || photosByKey.has(key)) {
      return;
    }

    const nextId = usedIds.has(normalized.id) && fromSource
      ? `${sourcePersonId}-${normalized.id}`
      : normalized.id;
    usedIds.add(nextId);
    photosByKey.set(key, {
      ...normalized,
      id: nextId,
    });
  };

  (Array.isArray(targetPhotos) ? targetPhotos : []).forEach((photo) => addPhoto(photo));
  (Array.isArray(sourcePhotos) ? sourcePhotos : []).forEach((photo) => addPhoto(photo, true));

  return [...photosByKey.values()];
}

function resolveMergeConflictValue(
  matchId: string,
  field: string,
  request: MergeRequestRecord,
  sourceSnapshot: Record<string, any>,
  targetSnapshot: Record<string, any>,
) {
  const choice = request.conflictChoices.find((entry) => entry.matchId === matchId && entry.field === field);
  if (!choice) {
    return undefined;
  }

  if (choice.resolvedValue !== undefined) {
    return Array.isArray(choice.resolvedValue) ? choice.resolvedValue.join(', ') : choice.resolvedValue;
  }

  if (choice.keep === 'source') {
    return field === 'surname' ? sourceSnapshot.lastName : sourceSnapshot[field];
  }

  if (choice.keep === 'target') {
    return field === 'surname' ? targetSnapshot.lastName : targetSnapshot[field];
  }

  if (choice.keep === 'both') {
    const sourceValue = field === 'surname' ? sourceSnapshot.lastName : sourceSnapshot[field];
    const targetValue = field === 'surname' ? targetSnapshot.lastName : targetSnapshot[field];
    return [targetValue, sourceValue].map((value) => String(value ?? '').trim()).filter(Boolean).join(' / ');
  }

  return undefined;
}

export function buildMergedTargetPersonUpdate(
  request: MergeRequestRecord,
  match: MergePreview['matches'][number],
  sourceSnapshot: Record<string, any>,
  targetSnapshot: Record<string, any>,
  timestamp: string,
) {
  const photos = mergePhotos(targetSnapshot.photos, sourceSnapshot.photos, match.sourcePersonId);
  const sourcePreferredPhotoId = typeof sourceSnapshot.preferredPhotoId === 'string' ? sourceSnapshot.preferredPhotoId : '';
  const copiedSourcePreferredPhoto = sourcePreferredPhotoId
    ? photos.find((photo) => photo.id === sourcePreferredPhotoId || photo.id === `${match.sourcePersonId}-${sourcePreferredPhotoId}`)
    : null;
  const targetPreferredPhotoId = typeof targetSnapshot.preferredPhotoId === 'string' ? targetSnapshot.preferredPhotoId : '';

  return {
    firstName: targetSnapshot.firstName || sourceSnapshot.firstName || '',
    middleNames: targetSnapshot.middleNames || sourceSnapshot.middleNames || '',
    lastName: resolveMergeConflictValue(match.id, 'surname', request, sourceSnapshot, targetSnapshot) ?? targetSnapshot.lastName ?? sourceSnapshot.lastName ?? '',
    maidenName: targetSnapshot.maidenName || sourceSnapshot.maidenName || '',
    nicknames: mergeUniqueStrings(targetSnapshot.nicknames, sourceSnapshot.nicknames),
    clanName: targetSnapshot.clanName || sourceSnapshot.clanName || '',
    familyBranch: targetSnapshot.familyBranch || sourceSnapshot.familyBranch || '',
    hometown: resolveMergeConflictValue(match.id, 'hometown', request, sourceSnapshot, targetSnapshot) ?? targetSnapshot.hometown ?? sourceSnapshot.hometown ?? '',
    birthPlace: targetSnapshot.birthPlace || sourceSnapshot.birthPlace || '',
    surnameVariantHints: mergeUniqueStrings(targetSnapshot.surnameVariantHints, sourceSnapshot.surnameVariantHints),
    birthDate: resolveMergeConflictValue(match.id, 'birthDate', request, sourceSnapshot, targetSnapshot) ?? targetSnapshot.birthDate ?? sourceSnapshot.birthDate ?? '',
    deathDate: targetSnapshot.deathDate || sourceSnapshot.deathDate || '',
    gender: targetSnapshot.gender && targetSnapshot.gender !== 'unspecified' ? targetSnapshot.gender : sourceSnapshot.gender ?? targetSnapshot.gender ?? 'unspecified',
    notes: mergeTextBlocks(targetSnapshot.notes, sourceSnapshot.notes),
    lifeEvents: mergeLifeEvents(targetSnapshot.lifeEvents, sourceSnapshot.lifeEvents),
    photos,
    preferredPhotoId: photos.some((photo) => photo.id === targetPreferredPhotoId)
      ? targetPreferredPhotoId
      : copiedSourcePreferredPhoto?.id ?? '',
    updatedAt: timestamp,
  };
}

export function getRelationshipCanonicalKey(
  relationship: Pick<RelationshipRecord, 'type' | 'fromPersonId' | 'toPersonId' | 'relationshipStatus' | 'parentChildKind'>,
) {
  const normalized = normalizeRelationshipEndpoints(relationship.type, relationship.fromPersonId, relationship.toPersonId);
  return [
    relationship.type,
    normalized.fromPersonId,
    normalized.toPersonId,
    relationship.type === 'spouse' ? relationship.relationshipStatus ?? '' : '',
    relationship.type === 'parent-child' ? relationship.parentChildKind ?? '' : '',
  ].join(':');
}
