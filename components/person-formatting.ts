import type { PersonGender, PersonRecord } from './dto/person';
import { translate } from '../i18n';
import { I18N_KEYS as K } from '../i18n/keys';

function joinPersonNameParts(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

export function formatPersonName(person?: PersonRecord | null) {
  if (!person) {
    return translate(K.relationship.unknownFamilyMember);
  }

  const name = joinPersonNameParts([person.firstName, person.middleNames, person.lastName]);
  if (person.maidenName?.trim()) {
    return `${name} (${person.maidenName.trim()})`;
  }
  return name;
}

export function formatPersonNameShort(person?: PersonRecord | null) {
  if (!person) return translate(K.relationship.unknownFamilyMember);
  return joinPersonNameParts([person.firstName, person.middleNames, person.lastName]);
}

export function formatPersonGender(gender: PersonGender) {
  if (gender === 'non-binary') {
    return translate(K.common.nonBinary);
  }

  const labels: Record<PersonGender, string> = {
    unspecified: translate(K.common.unspecified),
    female: translate(K.common.female),
    male: translate(K.common.male),
    'non-binary': translate(K.common.nonBinary),
    other: translate(K.common.other),
  };

  return labels[gender];
}
