import type { PersonGender, PersonRecord } from './dto/person';
import { translate } from '../i18n';

function joinPersonNameParts(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

export function formatPersonName(person?: PersonRecord | null) {
  if (!person) {
    return translate('Unknown family member');
  }

  const name = joinPersonNameParts([person.firstName, person.middleNames, person.lastName]);
  if (person.maidenName?.trim()) {
    return `${name} (${person.maidenName.trim()})`;
  }
  return name;
}

export function formatPersonNameShort(person?: PersonRecord | null) {
  if (!person) return translate('Unknown family member');
  return joinPersonNameParts([person.firstName, person.middleNames, person.lastName]);
}

export function formatPersonGender(gender: PersonGender) {
  if (gender === 'non-binary') {
    return translate('Non-binary');
  }

  const labels: Record<PersonGender, string> = {
    unspecified: translate('Unspecified'),
    female: translate('Female'),
    male: translate('Male'),
    'non-binary': translate('Non-binary'),
    other: translate('Other'),
  };

  return labels[gender];
}
