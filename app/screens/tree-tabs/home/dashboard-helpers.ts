import type { PersonMutationPayload, PersonRecord } from '../../../../components/dto/person';
import { isExactPersonDate } from '../../../../components/person-date';

export function buildMemoryPayload(person: PersonRecord, text: string, photoUri: string): PersonMutationPayload {
  return {
    firstName: person.firstName, middleNames: person.middleNames ?? '', lastName: person.lastName,
    maidenName: person.maidenName ?? '', birthSurnameStatus: person.birthSurnameStatus,
    birthPlace: person.birthPlace ?? '', hometown: person.hometown ?? '',
    surnameVariantHints: person.surnameVariantHints, birthDate: person.birthDate, deathDate: person.deathDate,
    lifeStatus: person.lifeStatus, gender: person.gender,
    notes: photoUri ? person.notes : [person.notes.trim(), text.trim()].filter(Boolean).join('\n\n'),
    lifeEvents: person.lifeEvents, preferredPhotoRef: person.preferredPhotoId,
    existingPhotos: person.photos, removedPhotos: [], newPhotoUris: photoUri ? [photoUri] : [],
    newPhotos: photoUri ? [{ uri: photoUri, description: text.trim() }] : [],
  };
}

export function upcomingOccasions(people: PersonRecord[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return people.flatMap(person => {
    const events = [
      ...(person.lifeStatus !== 'deceased' && !person.deathDate ? [{ id: 'birthday', date: person.birthDate, title: '', birthday: true }] : []),
      ...person.lifeEvents.filter(event => event.type === 'married' || event.type === 'milestone' || event.type === 'death')
        .map(event => ({ ...event, birthday: false })),
    ];
    return events.flatMap(event => {
      if (!isExactPersonDate(event.date)) return [];
      const [year, month, day] = event.date.split('-').map(Number);
      let next: Date | null = null;
      for (let offset = 0; offset <= 8; offset++) {
        const candidate = new Date(today.getFullYear() + offset, month - 1, day);
        if (candidate.getMonth() === month - 1 && candidate.getDate() === day && candidate >= today && candidate.getFullYear() >= year) { next = candidate; break; }
      }
      return next ? [{ ...event, person, next, daysUntil: Math.round((next.getTime() - today.getTime()) / 86400000) }] : [];
    });
  }).filter(event => event.daysUntil <= 90).sort((a, b) => a.next.getTime() - b.next.getTime());
}
