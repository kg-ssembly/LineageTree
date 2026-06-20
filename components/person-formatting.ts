import type { PersonGender, PersonRecord } from './dto/person';

function joinPersonNameParts(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

export function formatPersonName(person?: PersonRecord | null) {
  if (!person) {
    return 'Unknown family member';
  }

  const name = joinPersonNameParts([person.firstName, person.middleNames, person.lastName]);
  if (person.maidenName?.trim()) {
    return `${name} (${person.maidenName.trim()})`;
  }
  return name;
}

export function formatPersonNameShort(person?: PersonRecord | null) {
  if (!person) return 'Unknown family member';
  return joinPersonNameParts([person.firstName, person.middleNames, person.lastName]);
}

export function formatPersonGender(gender: PersonGender) {
  if (gender === 'non-binary') {
    return 'Non-binary';
  }

  return gender.charAt(0).toUpperCase() + gender.slice(1);
}
