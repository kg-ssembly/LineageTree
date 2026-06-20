export type PersonGender = 'unspecified' | 'female' | 'male' | 'non-binary' | 'other';

export type PersonLifeEventType = 'married' | 'divorced' | 'moved' | 'graduated' | 'retired' | 'milestone' | 'death' | 'child-born' | 'custom';

export interface PersonLifeEvent {
  id: string;
  type: PersonLifeEventType;
  title: string;
  date: string;
  description: string;
}

export interface PersonPhoto {
  id: string;
  url: string;
  path: string;
  createdAt: string;
}

export interface PersonTreeMembership {
  treeId: string;
  role: 'member' | 'subject' | 'branch-member' | 'canonical';
  joinedAt: string;
  addedByUserId?: string;
  source?: 'manual' | 'merge' | 'invite';
}

export interface PersonRecord {
  id: string;
  treeId: string;
  treeMembershipIds: string[];
  treeMemberships: PersonTreeMembership[];
  ownerId: string;
  firstName: string;
  middleNames?: string;
  lastName: string;
  /** Maiden name (birth surname before marriage). Optional. */
  maidenName?: string;
  nicknames?: string[];
  clanName?: string;
  familyBranch?: string;
  hometown?: string;
  birthPlace?: string;
  surnameVariantHints?: string[];
  canonicalPersonId?: string;
  duplicatePersonIds?: string[];
  birthDate: string;
  deathDate: string;
  gender: PersonGender;
  notes: string;
  lifeEvents: PersonLifeEvent[];
  photos: PersonPhoto[];
  preferredPhotoId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonInput {
  firstName: string;
  middleNames?: string;
  lastName: string;
  /** Maiden name (birth surname before marriage). Optional. */
  maidenName?: string;
  birthDate: string;
  deathDate: string;
  gender: PersonGender;
  notes: string;
  lifeEvents: PersonLifeEvent[];
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

export function getPersonTreeMembershipIds(person?: PersonRecord | null) {
  if (!person) {
    return [];
  }

  if (Array.isArray(person.treeMembershipIds) && person.treeMembershipIds.length > 0) {
    return [...new Set(person.treeMembershipIds)];
  }

  return person.treeId ? [person.treeId] : [];
}

export function getDisplayPersonPhoto(person?: PersonRecord | null) {
  return getPreferredPersonPhoto(person) ?? person?.photos[0] ?? null;
}

function getPersonAgeInYears(person?: PersonRecord | null) {
  if (!person?.birthDate) {
    return null;
  }

  const birthDate = parsePersonDate(person.birthDate);
  if (!birthDate) {
    return null;
  }

  const endDate = parsePersonDate(person.deathDate) ?? new Date();
  let age = endDate.getFullYear() - birthDate.getFullYear();
  const monthDelta = endDate.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && endDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

export function getPersonFallbackAvatarIcon(person?: PersonRecord | null) {
  const ageInYears = getPersonAgeInYears(person);
  if (typeof ageInYears === 'number' && ageInYears >= 0 && ageInYears <= 2) {
    return 'baby-face-outline';
  }

  if (person?.gender === 'female') {
    return 'human-female';
  }

  if (person?.gender === 'male') {
    return 'human-male';
  }

  return 'account';
}

export function parsePersonDate(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatPersonDate(value: string) {
  const parsed = parsePersonDate(value);
  if (!parsed) {
    return value || 'Unknown';
  }

  return formatDate(parsed);
}

export function formatDate(date: Date) {
  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

export function isPersonDeceased(person?: PersonRecord | null) {
  return Boolean(person?.deathDate?.trim());
}

export function getPersonPresenceLabel(person?: PersonRecord | null) {
  if (person?.deathDate) {
    return `In memory • ${formatPersonDate(person.deathDate)}`;
  }

  return 'Present';
}

export function getPersonLifeSpanLabel(person?: PersonRecord | null) {
  if (!person) {
    return 'Unknown lifespan';
  }

  const birthLabel = person.birthDate ? formatPersonDate(person.birthDate) : 'Birth date unknown';
  const deathLabel = person.deathDate ? formatPersonDate(person.deathDate) : 'Present';
  return `${birthLabel} – ${deathLabel}`;
}

export function getLifeEventTypeLabel(type: PersonLifeEventType) {
  switch (type) {
    case 'married':
      return 'Married';
    case 'divorced':
      return 'Divorced';
    case 'moved':
      return 'Moved';
    case 'graduated':
      return 'Graduated';
    case 'retired':
      return 'Retired';
    case 'milestone':
      return 'Milestone';
    case 'death':
      return 'Death';
    case 'child-born':
      return 'Had a child';
    default:
      return 'Custom';
  }
}
