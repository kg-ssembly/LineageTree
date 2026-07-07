import type { PersonGender, PersonRecord } from '../components/dto/person';
import type { KinshipSystem } from '../components/dto/tree';
import { parsePersonDate } from '../components/dto/person';
import { getActiveLanguage, type AppLanguage } from '../i18n';

export type KinshipSide = 'maternal' | 'paternal' | 'unknown';
export type KinshipSeniority = 'older' | 'younger' | 'same' | 'unknown';

export type KinshipDescriptor =
  | { kind: 'self' }
  | { kind: 'spouse'; targetGender: PersonGender }
  | { kind: 'direct-descendant'; targetGender: PersonGender; generations: number }
  | { kind: 'direct-ancestor'; targetGender: PersonGender; generations: number }
  | { kind: 'sibling'; targetGender: PersonGender; siblingKind: 'full' | 'half' }
  | { kind: 'in-law'; targetGender: PersonGender; relation: 'child' | 'parent' | 'sibling' }
  | { kind: 'step'; targetGender: PersonGender; relation: 'child' | 'parent' | 'sibling' }
  | {
      kind: 'aunt-uncle';
      targetGender: PersonGender;
      generationsRemoved: number;
      side: KinshipSide;
      seniority: KinshipSeniority;
      viaParentGender: PersonGender;
    }
  | { kind: 'niece-nephew'; targetGender: PersonGender; generationsRemoved: number }
  | { kind: 'cousin'; degree: number; removal: number }
  | { kind: 'extended' };

function genderedLabel(gender: PersonGender, male: string, female: string, neutral: string) {
  if (gender === 'male') {
    return male;
  }

  if (gender === 'female') {
    return female;
  }

  return neutral;
}

function cousinOrdinal(degree: number) {
  if (degree === 1) return '1st';
  if (degree === 2) return '2nd';
  if (degree === 3) return '3rd';
  return `${degree}th`;
}

function formatGenericKinshipDescriptor(descriptor: KinshipDescriptor) {
  switch (descriptor.kind) {
    case 'self':
      return 'Self';
    case 'spouse':
      return genderedLabel(descriptor.targetGender, 'Husband', 'Wife', 'Spouse');
    case 'direct-descendant':
      return descriptor.generations === 1
        ? genderedLabel(descriptor.targetGender, 'Son', 'Daughter', 'Child')
        : descriptor.generations === 2
          ? genderedLabel(descriptor.targetGender, 'Grandson', 'Granddaughter', 'Grandchild')
          : `${'Great-'.repeat(descriptor.generations - 2)}${genderedLabel(descriptor.targetGender, 'Grandson', 'Granddaughter', 'Grandchild')}`;
    case 'direct-ancestor':
      return descriptor.generations === 1
        ? genderedLabel(descriptor.targetGender, 'Father', 'Mother', 'Parent')
        : descriptor.generations === 2
          ? genderedLabel(descriptor.targetGender, 'Grandfather', 'Grandmother', 'Grandparent')
          : `${'Great-'.repeat(descriptor.generations - 2)}${genderedLabel(descriptor.targetGender, 'Grandfather', 'Grandmother', 'Grandparent')}`;
    case 'sibling':
      return `${descriptor.siblingKind === 'half' ? 'Half-' : ''}${genderedLabel(descriptor.targetGender, 'Brother', 'Sister', 'Sibling')}`;
    case 'in-law':
      if (descriptor.relation === 'child') {
        return genderedLabel(descriptor.targetGender, 'Son-in-law', 'Daughter-in-law', 'Child-in-law');
      }

      if (descriptor.relation === 'parent') {
        return genderedLabel(descriptor.targetGender, 'Father-in-law', 'Mother-in-law', 'Parent-in-law');
      }

      return genderedLabel(descriptor.targetGender, 'Brother-in-law', 'Sister-in-law', 'Sibling-in-law');
    case 'step':
      if (descriptor.relation === 'child') {
        return genderedLabel(descriptor.targetGender, 'Stepson', 'Stepdaughter', 'Stepchild');
      }

      if (descriptor.relation === 'parent') {
        return genderedLabel(descriptor.targetGender, 'Stepfather', 'Stepmother', 'Step-parent');
      }

      return genderedLabel(descriptor.targetGender, 'Step-brother', 'Step-sister', 'Step-sibling');
    case 'aunt-uncle': {
      const greats = descriptor.generationsRemoved > 1 ? 'Great-'.repeat(descriptor.generationsRemoved - 1) : '';
      return descriptor.generationsRemoved === 1
        ? genderedLabel(descriptor.targetGender, 'Uncle', 'Aunt', 'Aunt/Uncle')
        : `${greats}${genderedLabel(descriptor.targetGender, 'uncle', 'aunt', 'aunt/uncle')}`;
    }
    case 'niece-nephew': {
      const greats = descriptor.generationsRemoved > 1 ? 'Great-'.repeat(descriptor.generationsRemoved - 1) : '';
      return descriptor.generationsRemoved === 1
        ? genderedLabel(descriptor.targetGender, 'Nephew', 'Niece', 'Niece/Nephew')
        : `${greats}${genderedLabel(descriptor.targetGender, 'nephew', 'niece', 'nephew/niece')}`;
    }
    case 'cousin': {
      const ordinal = cousinOrdinal(descriptor.degree);
      return descriptor.removal === 0
        ? `${ordinal} cousin`
        : `${ordinal} cousin ${descriptor.removal}× removed`;
    }
    case 'extended':
      return 'Extended family';
    default:
      return 'Extended family';
  }
}

function formatNorthernSothoKinshipDescriptor(descriptor: KinshipDescriptor) {
  if (descriptor.kind === 'self') {
    return 'Nna';
  }

  if (descriptor.kind === 'spouse') {
    return genderedLabel(descriptor.targetGender, 'monna', 'mosadi', 'mohatsa');
  }

  if (descriptor.kind === 'direct-descendant') {
    return genderedLabel(descriptor.targetGender, 'mora', 'moradi', 'motjhana');
  }

  if (descriptor.kind === 'direct-ancestor') {
    if (descriptor.generations === 1) {
      return genderedLabel(descriptor.targetGender, 'ntate', 'mme', 'motswadi');
    }

    return genderedLabel(descriptor.targetGender, 'ntatemoholo', 'nkgono', 'mogologolo');
  }

  if (descriptor.kind === 'sibling') {
    return genderedLabel(descriptor.targetGender, 'abuti', 'ausi', 'kgaitsedi');
  }

  if (descriptor.kind === 'in-law') {
    if (descriptor.relation === 'child') {
      return genderedLabel(descriptor.targetGender, 'mokgwenyana', 'ngwetsi', 'motjhana');
    }

    if (descriptor.relation === 'parent') {
      return genderedLabel(descriptor.targetGender, 'ratsale', 'mmatsale', 'matsale');
    }

    return 'matsale';
  }

  if (descriptor.kind === 'step') {
    if (descriptor.relation === 'child') {
      return genderedLabel(descriptor.targetGender, 'mora', 'moradi', 'motjhana');
    }

    if (descriptor.relation === 'parent') {
      return genderedLabel(descriptor.targetGender, 'ntate', 'mme', 'motswadi');
    }

    return genderedLabel(descriptor.targetGender, 'abuti', 'ausi', 'kgaitsedi');
  }

  if (
    descriptor.kind === 'aunt-uncle'
    && descriptor.generationsRemoved === 1
  ) {
      if (descriptor.side === 'maternal') {
        if (descriptor.targetGender === 'female') {
          if (descriptor.seniority === 'older') {
            return 'mmamoholo';
          }

          if (descriptor.seniority === 'younger') {
            return 'mmane';
          }

        return 'mmamoholo';
        }

      if (descriptor.targetGender === 'male') {
        return 'malome';
      }
    }

    if (descriptor.side === 'paternal') {
      if (descriptor.targetGender === 'female') {
        return 'rakgadi';
      }

      if (descriptor.targetGender === 'male') {
        if (descriptor.seniority === 'older') {
          return 'ntatemoholo';
        }

        if (descriptor.seniority === 'younger') {
          return 'rangwane';
        }

        return 'ntatemoholo';
      }
    }
  }

  if (descriptor.kind === 'niece-nephew') {
    return 'motjhana';
  }

  if (descriptor.kind === 'cousin') {
    return 'motswala';
  }

  return null;
}

function getKinshipSystemLanguage(kinshipSystem: KinshipSystem): AppLanguage | null {
  if (kinshipSystem === 'northern-sotho') {
    return 'nso';
  }

  return null;
}

function formatSpecificKinshipDescriptor(
  descriptor: KinshipDescriptor,
  kinshipSystem: KinshipSystem,
) {
  if (kinshipSystem === 'northern-sotho') {
    return formatNorthernSothoKinshipDescriptor(descriptor);
  }

  return null;
}

export function formatKinshipDescriptor(
  descriptor: KinshipDescriptor,
  options?: { language?: AppLanguage; kinshipSystem?: KinshipSystem },
) {
  const language = options?.language ?? getActiveLanguage();
  const kinshipSystem = options?.kinshipSystem ?? 'auto';
  const genericLabel = formatGenericKinshipDescriptor(descriptor);

  if (kinshipSystem === 'generic') {
    return genericLabel;
  }

  if (kinshipSystem === 'northern-sotho') {
    const specificLabel = formatSpecificKinshipDescriptor(descriptor, kinshipSystem);
    if (!specificLabel) {
      return genericLabel;
    }

    return getKinshipSystemLanguage(kinshipSystem) === language
      ? specificLabel
      : `${genericLabel} (${specificLabel})`;
  }

  if (language === 'nso') {
    return formatNorthernSothoKinshipDescriptor(descriptor) ?? genericLabel;
  }

  return genericLabel;
}

export function getRelativeSeniority(referencePerson?: PersonRecord | null, comparedPerson?: PersonRecord | null): KinshipSeniority {
  const referenceDate = parsePersonDate(referencePerson?.birthDate ?? '');
  const comparedDate = parsePersonDate(comparedPerson?.birthDate ?? '');

  if (!referenceDate || !comparedDate) {
    return 'unknown';
  }

  const referenceTime = referenceDate.getTime();
  const comparedTime = comparedDate.getTime();

  if (referenceTime === comparedTime) {
    return 'same';
  }

  return comparedTime < referenceTime ? 'older' : 'younger';
}
