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

type KinshipLocale = Extract<AppLanguage, 'nso' | 'ss' | 'st' | 'tn' | 'ts' | 've' | 'zu'>;

type KinshipLabelSet = {
  self: string;
  spouse: { male: string; female: string; neutral: string };
  directDescendant: { male: string; female: string; neutral: string };
  directAncestor: { male: string; female: string; neutral: string };
  sibling: { male: string; female: string; neutral: string };
  inLawChild: { male: string; female: string; neutral: string };
  inLawParent: { male: string; female: string; neutral: string };
  inLawSibling: { male: string; female: string; neutral: string };
  stepChild: { male: string; female: string; neutral: string };
  stepParent: { male: string; female: string; neutral: string };
  stepSibling: { male: string; female: string; neutral: string };
  auntUncle?: {
    generic: { male: string; female: string; neutral: string };
    maternal?: {
      generic?: { male: string; female: string; neutral: string };
      older?: { male: string; female: string; neutral: string };
      younger?: { male: string; female: string; neutral: string };
    };
    paternal?: {
      generic?: { male: string; female: string; neutral: string };
      older?: { male: string; female: string; neutral: string };
      younger?: { male: string; female: string; neutral: string };
    };
  };
  nieceNephew: { male: string; female: string; neutral: string };
  cousin: string;
  extended: string;
};

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

function formatGreatPrefix(count: number) {
  return count > 0 ? `${'Great-'.repeat(count)}` : '';
}

function isKinshipLocale(language: AppLanguage): language is KinshipLocale {
  return language === 'nso'
    || language === 'ss'
    || language === 'st'
    || language === 'tn'
    || language === 'ts'
    || language === 've'
    || language === 'zu';
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
          : `${formatGreatPrefix(descriptor.generations - 2)}${genderedLabel(descriptor.targetGender, 'Grandson', 'Granddaughter', 'Grandchild')}`;
    case 'direct-ancestor':
      return descriptor.generations === 1
        ? genderedLabel(descriptor.targetGender, 'Father', 'Mother', 'Parent')
        : descriptor.generations === 2
          ? genderedLabel(descriptor.targetGender, 'Grandfather', 'Grandmother', 'Grandparent')
          : `${formatGreatPrefix(descriptor.generations - 2)}${genderedLabel(descriptor.targetGender, 'Grandfather', 'Grandmother', 'Grandparent')}`;
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
      const greats = descriptor.generationsRemoved > 1 ? formatGreatPrefix(descriptor.generationsRemoved - 1) : '';
      return descriptor.generationsRemoved === 1
        ? genderedLabel(descriptor.targetGender, 'Uncle', 'Aunt', 'Aunt/Uncle')
        : `${greats}${genderedLabel(descriptor.targetGender, 'uncle', 'aunt', 'aunt/uncle')}`;
    }
    case 'niece-nephew': {
      const greats = descriptor.generationsRemoved > 1 ? formatGreatPrefix(descriptor.generationsRemoved - 1) : '';
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

const KINSHIP_LABELS: Record<KinshipLocale, KinshipLabelSet> = {
  nso: {
    self: 'Nna',
    spouse: { male: 'monna', female: 'mosadi', neutral: 'mohatsa' },
    directDescendant: { male: 'mora', female: 'moradi', neutral: 'ngwana' },
    directAncestor: { male: 'papa', female: 'mme', neutral: 'motswadi' },
    sibling: { male: 'bhuti', female: 'kgaitsedi', neutral: 'kgaitsedi' },
    inLawChild: { male: 'mokgwenyana', female: 'ngwetsi', neutral: 'ngwana' },
    inLawParent: { male: 'ratsale', female: 'mmatsale', neutral: 'matsale' },
    inLawSibling: { male: 'matsale', female: 'matsale', neutral: 'matsale' },
    stepChild: { male: 'mora', female: 'moradi', neutral: 'ngwana' },
    stepParent: { male: 'papa', female: 'mme', neutral: 'motswadi' },
    stepSibling: { male: 'kgaitsedi', female: 'kgaitsedi', neutral: 'kgaitsedi' },
    auntUncle: {
      generic: { male: 'malome', female: 'rakgadi', neutral: 'motswala' },
      maternal: {
        generic: { male: 'malome', female: 'mangwane', neutral: 'mangwane' },
        older: { male: 'malome', female: 'mamoholo', neutral: 'mamoholo' },
        younger: { male: 'malome', female: 'mangwane', neutral: 'mangwane' },
      },
      paternal: {
        generic: { male: 'rangwane', female: 'rakgadi', neutral: 'rangwane' },
        older: { male: 'ramoholo', female: 'kgadi', neutral: 'ramoholo' },
        younger: { male: 'rangwane', female: 'rakgadi', neutral: 'rangwane' },
      },
    },
    nieceNephew: { male: 'motjhana', female: 'motjhana', neutral: 'motjhana' },
    cousin: 'motswala',
    extended: 'Leloko le le atolositšwego',
  },
  ss: {
    self: 'Mine',
    spouse: { male: 'umlingani', female: 'umlingani', neutral: 'umlingani' },
    directDescendant: { male: 'indvodzana', female: 'indvodzakati', neutral: 'umntfwana' },
    directAncestor: { male: 'babe', female: 'make', neutral: 'umzali' },
    sibling: { male: 'bhuti', female: 'sisi', neutral: 'sihlobo' },
    inLawChild: { male: 'mkhwenyana', female: 'makoti', neutral: 'umntfwana-mohlobo' },
    inLawParent: { male: 'utsalwabo', female: 'umtsalawo', neutral: 'umkhwekati' },
    inLawSibling: { male: 'mnaketfu-mkakho', female: 'dzadzewabo', neutral: 'sihlobo-semlingani' },
    stepChild: { male: 'umntfwana', female: 'umntfwana', neutral: 'umntfwana' },
    stepParent: { male: 'usingababe', female: 'usingamake', neutral: 'usingamzali' },
    stepSibling: { male: 'bhuti', female: 'sisi', neutral: 'sihlobo' },
    auntUncle: {
      generic: { male: 'malume', female: 'anti', neutral: 'anti' },
      maternal: {
        generic: { male: 'malume', female: 'anti', neutral: 'anti' },
        older: { male: 'malume', female: 'make lomkhulu', neutral: 'make lomkhulu' },
        younger: { male: 'malume', female: 'make lomncane', neutral: 'make lomncane' },
      },
      paternal: {
        generic: { male: 'babe lomncane', female: 'babekati', neutral: 'babekati' },
        older: { male: 'babe lomkhulu', female: 'babekati', neutral: 'babe lomkhulu' },
        younger: { male: 'babe lomncane', female: 'babekati', neutral: 'babe lomncane' },
      },
    },
    nieceNephew: { male: 'umshana', female: 'umshana', neutral: 'umshana' },
    cousin: 'mzala',
    extended: 'Umndeni longene',
  },
  st: {
    self: 'Nna',
    spouse: { male: 'monna', female: 'mosadi', neutral: 'molekane' },
    directDescendant: { male: 'mora', female: 'moradi', neutral: 'ngwana' },
    directAncestor: { male: 'ntate', female: 'mme', neutral: 'motswadi' },
    sibling: { male: 'abuti', female: 'ausi', neutral: 'kgaitsedi' },
    inLawChild: { male: 'mokgwenyana', female: 'ngwetsi', neutral: 'mohlako' },
    inLawParent: { male: 'ratsala', female: 'mmatsala', neutral: 'matsala' },
    inLawSibling: { male: 'matsala', female: 'matsala', neutral: 'matsala' },
    stepChild: { male: 'ngwana', female: 'ngwana', neutral: 'ngwana' },
    stepParent: { male: 'ntate', female: 'mme', neutral: 'motswadi' },
    stepSibling: { male: 'abuti', female: 'ausi', neutral: 'kgaitsedi' },
    auntUncle: {
      generic: { male: 'malome', female: 'mangwane', neutral: 'mangwane' },
      maternal: {
        generic: { male: 'malome', female: 'mangwane', neutral: 'mangwane' },
        older: { male: 'malome', female: 'mmakgolo', neutral: 'mmakgolo' },
        younger: { male: 'malome', female: 'mangwane', neutral: 'mangwane' },
      },
      paternal: {
        generic: { male: 'rangwane', female: 'rakgadi', neutral: 'rakgadi' },
        older: { male: 'ramokgolo', female: 'rakgadi', neutral: 'ramokgolo' },
        younger: { male: 'rangwane', female: 'rakgadi', neutral: 'rakgadi' },
      },
    },
    nieceNephew: { male: 'motjhana', female: 'motjhana', neutral: 'motjhana' },
    cousin: 'motswala',
    extended: 'Leloko le le atolositšwego',
  },
  tn: {
    self: 'Nna',
    spouse: { male: 'monna', female: 'mosadi', neutral: 'molekane' },
    directDescendant: { male: 'morwa', female: 'moradi', neutral: 'ngwana' },
    directAncestor: { male: 'rre', female: 'mme', neutral: 'motsadi' },
    sibling: { male: 'abuti', female: 'ausi', neutral: 'kgaitsedi' },
    inLawChild: { male: 'mokgwenyana', female: 'ngwetsi', neutral: 'molekane-wa-ngwana' },
    inLawParent: { male: 'rratsale', female: 'mmatsale', neutral: 'matsale' },
    inLawSibling: { male: 'matsale', female: 'matsale', neutral: 'matsale' },
    stepChild: { male: 'morwa', female: 'moradi', neutral: 'ngwana' },
    stepParent: { male: 'rre', female: 'mme', neutral: 'motsadi' },
    stepSibling: { male: 'abuti', female: 'ausi', neutral: 'kgaitsedi' },
    auntUncle: {
      generic: { male: 'malome', female: 'mangwane', neutral: 'mangwane' },
      maternal: {
        generic: { male: 'malome', female: 'mangwane', neutral: 'mangwane' },
        older: { male: 'malome', female: 'mmakgolo', neutral: 'mmakgolo' },
        younger: { male: 'malome', female: 'mangwane', neutral: 'mangwane' },
      },
      paternal: {
        generic: { male: 'rangwane', female: 'rakgadi', neutral: 'rakgadi' },
        older: { male: 'ramokgolo', female: 'rakgadi', neutral: 'ramokgolo' },
        younger: { male: 'rangwane', female: 'rakgadi', neutral: 'rakgadi' },
      },
    },
    nieceNephew: { male: 'motjhana', female: 'motjhana', neutral: 'motjhana' },
    cousin: 'motswala',
    extended: 'Lelapa le le anamaletseng',
  },
  ts: {
    self: 'Ndzi',
    spouse: { male: 'nuna', female: 'nsati', neutral: 'molekane' },
    directDescendant: { male: 'nwana wa jaha', female: 'nwana wa xisati', neutral: "n'wana" },
    directAncestor: { male: 'tatana', female: 'mana', neutral: 'mutswari' },
    sibling: { male: 'makwerhu', female: 'makwerhu', neutral: 'makwerhu' },
    inLawChild: { male: 'mukwetsiwa', female: 'mukwetsiwa', neutral: 'mukwetsiwa' },
    inLawParent: { male: 'mukhwe', female: 'mukhwe', neutral: 'mukhwe' },
    inLawSibling: { male: 'makwerhu', female: 'makwerhu', neutral: 'makwerhu' },
    stepChild: { male: 'nwana', female: 'nwana', neutral: "n'wana" },
    stepParent: { male: 'tatana', female: 'mana', neutral: 'mutswari' },
    stepSibling: { male: 'makwerhu', female: 'makwerhu', neutral: 'makwerhu' },
    auntUncle: {
      generic: { male: 'malume', female: 'hahane', neutral: 'hahane' },
      maternal: {
        generic: { male: 'malume', female: 'manana ntsongo', neutral: 'manana ntsongo' },
        older: { male: 'malume', female: 'manana nkulu', neutral: 'manana nkulu' },
        younger: { male: 'malume', female: 'manana ntsongo', neutral: 'manana ntsongo' },
      },
      paternal: {
        generic: { male: 'tatana ntsongo', female: 'hahane', neutral: 'hahane' },
        older: { male: 'tatana nkulu', female: 'hahane', neutral: 'tatana nkulu' },
        younger: { male: 'tatana ntsongo', female: 'hahane', neutral: 'tatana ntsongo' },
      },
    },
    nieceNephew: { male: 'ntukulu', female: 'ntukulu', neutral: 'ntukulu' },
    cousin: 'mzala',
    extended: 'Ndyangu lowu andlariweke',
  },
  ve: {
    self: 'Nne',
    spouse: { male: 'mufarisi', female: 'mufarisi', neutral: 'mufarisi' },
    directDescendant: { male: 'murwa', female: 'muradi', neutral: 'mwana' },
    directAncestor: { male: 'khotsi', female: 'mme', neutral: 'mubebi' },
    sibling: { male: 'mukomana', female: 'murathu', neutral: 'mukomana' },
    inLawChild: { male: 'mukwasha', female: 'muhadzi', neutral: 'mukwasha' },
    inLawParent: { male: 'mukhwe', female: 'mukhwe', neutral: 'mukhwe' },
    inLawSibling: { male: 'mukomana', female: 'murathu', neutral: 'mukomana' },
    stepChild: { male: 'mwana', female: 'mwana', neutral: 'mwana' },
    stepParent: { male: 'khotsi', female: 'mme', neutral: 'mubebi' },
    stepSibling: { male: 'mukomana', female: 'murathu', neutral: 'mukomana' },
    auntUncle: {
      generic: { male: 'malume', female: 'makhadzi', neutral: 'makhadzi' },
      maternal: {
        generic: { male: 'malume', female: 'mmane', neutral: 'mmane' },
        older: { male: 'malume', female: 'mme muhulu', neutral: 'mme muhulu' },
        younger: { male: 'malume', female: 'mmane', neutral: 'mmane' },
      },
      paternal: {
        generic: { male: 'khotsi munene', female: 'makhadzi', neutral: 'makhadzi' },
        older: { male: 'khotsi muhulu', female: 'makhadzi', neutral: 'khotsi muhulu' },
        younger: { male: 'khotsi munene', female: 'makhadzi', neutral: 'khotsi munene' },
      },
    },
    nieceNephew: { male: 'mwana', female: 'mwana', neutral: 'mwana' },
    cousin: 'muzwala',
    extended: 'Muṱa wo andadzwa',
  },
  zu: {
    self: 'Mina',
    spouse: { male: 'umyeni', female: 'unkosikazi', neutral: 'umlingani' },
    directDescendant: { male: 'indodana', female: 'indodakazi', neutral: 'ingane' },
    directAncestor: { male: 'ubaba', female: 'umama', neutral: 'umzali' },
    sibling: { male: 'umfowethu', female: 'udadewethu', neutral: 'ingane yakwethu' },
    inLawChild: { male: 'umkhwenyana', female: 'umalokazana', neutral: 'ingane yomthetho' },
    inLawParent: { male: 'umukhwe', female: 'umamezala', neutral: 'umkhwekazi' },
    inLawSibling: { male: 'umlamu', female: 'umlamu', neutral: 'umlamu' },
    stepChild: { male: 'ingane', female: 'ingane', neutral: 'ingane' },
    stepParent: { male: 'usingababa', female: 'usingamama', neutral: 'usingumzali' },
    stepSibling: { male: 'umfowethu', female: 'udadewethu', neutral: 'ingane yakwethu' },
    auntUncle: {
      generic: { male: 'umalume', female: 'anti', neutral: 'anti' },
      maternal: {
        generic: { male: 'umalume', female: 'anti', neutral: 'anti' },
        older: { male: 'umalume', female: 'umamkhulu', neutral: 'umamkhulu' },
        younger: { male: 'umalume', female: 'umamncane', neutral: 'umamncane' },
      },
      paternal: {
        generic: { male: 'ubaba omncane', female: 'ubabekazi', neutral: 'ubabekazi' },
        older: { male: 'ubaba omkhulu', female: 'ubabekazi', neutral: 'ubaba omkhulu' },
        younger: { male: 'ubaba omncane', female: 'ubabekazi', neutral: 'ubaba omncane' },
      },
    },
    nieceNephew: { male: 'umshana', female: 'umshana', neutral: 'umshana' },
    cousin: 'mzala',
    extended: 'Umndeni owandisiwe',
  },
};

function getKinshipSystemLanguage(kinshipSystem: KinshipSystem): AppLanguage | null {
  switch (kinshipSystem) {
    case 'nso':
    case 'northern-sotho':
      return 'nso';
    case 'ss':
    case 'st':
    case 'tn':
    case 'ts':
    case 've':
    case 'zu':
      return kinshipSystem;
    default:
      return null;
  }
}

function formatLocalizedLabel(
  language: KinshipLocale,
  descriptor: KinshipDescriptor,
): string | null {
  const labels = KINSHIP_LABELS[language];

  switch (descriptor.kind) {
    case 'self':
      return labels.self;
    case 'spouse':
      return genderedLabel(descriptor.targetGender, labels.spouse.male, labels.spouse.female, labels.spouse.neutral);
    case 'direct-descendant':
      if (descriptor.generations === 1) {
        return genderedLabel(descriptor.targetGender, labels.directDescendant.male, labels.directDescendant.female, labels.directDescendant.neutral);
      }

      if (language === 'nso') {
        return 'setlogolo';
      }

      return `${formatGreatPrefix(descriptor.generations - 2)}Grand-${genderedLabel(descriptor.targetGender, labels.directDescendant.male, labels.directDescendant.female, labels.directDescendant.neutral)}`;
    case 'direct-ancestor':
      if (descriptor.generations === 1) {
        return genderedLabel(descriptor.targetGender, labels.directAncestor.male, labels.directAncestor.female, labels.directAncestor.neutral);
      }

      if (language === 'nso') {
        return 'koko';
      }

      return `${formatGreatPrefix(descriptor.generations - 2)}Grand-${genderedLabel(descriptor.targetGender, labels.directAncestor.male, labels.directAncestor.female, labels.directAncestor.neutral)}`;
    case 'sibling':
      return `${descriptor.siblingKind === 'half' ? 'Half-' : ''}${genderedLabel(descriptor.targetGender, labels.sibling.male, labels.sibling.female, labels.sibling.neutral)}`;
    case 'in-law':
      if (descriptor.relation === 'child') {
        return genderedLabel(descriptor.targetGender, labels.inLawChild.male, labels.inLawChild.female, labels.inLawChild.neutral);
      }

      if (descriptor.relation === 'parent') {
        return genderedLabel(descriptor.targetGender, labels.inLawParent.male, labels.inLawParent.female, labels.inLawParent.neutral);
      }

      return genderedLabel(descriptor.targetGender, labels.inLawSibling.male, labels.inLawSibling.female, labels.inLawSibling.neutral);
    case 'step':
      if (descriptor.relation === 'child') {
        return genderedLabel(descriptor.targetGender, labels.stepChild.male, labels.stepChild.female, labels.stepChild.neutral);
      }

      if (descriptor.relation === 'parent') {
        return genderedLabel(descriptor.targetGender, labels.stepParent.male, labels.stepParent.female, labels.stepParent.neutral);
      }

      return genderedLabel(descriptor.targetGender, labels.stepSibling.male, labels.stepSibling.female, labels.stepSibling.neutral);
    case 'aunt-uncle': {
      const sideLabels = labels.auntUncle;
      if (!sideLabels) {
        return null;
      }

      const side = descriptor.side === 'maternal'
        ? sideLabels.maternal
        : descriptor.side === 'paternal'
          ? sideLabels.paternal
          : undefined;
      const chosen = descriptor.seniority === 'older'
        ? side?.older ?? side?.generic ?? sideLabels.generic
        : descriptor.seniority === 'younger'
          ? side?.younger ?? side?.generic ?? sideLabels.generic
          : side?.generic ?? sideLabels.generic;
      if (!chosen) {
        return null;
      }

      return genderedLabel(descriptor.targetGender, chosen.male, chosen.female, chosen.neutral);
    }
    case 'niece-nephew':
      return genderedLabel(descriptor.targetGender, labels.nieceNephew.male, labels.nieceNephew.female, labels.nieceNephew.neutral);
    case 'cousin':
      return descriptor.removal === 0 ? labels.cousin : `${labels.cousin} ${descriptor.removal}×`;
    case 'extended':
      return labels.extended;
    default:
      return null;
  }
}

function formatSpecificKinshipDescriptor(descriptor: KinshipDescriptor, kinshipSystem: KinshipSystem) {
  const language = getKinshipSystemLanguage(kinshipSystem);
  if (!language) {
    return null;
  }

  return formatLocalizedLabel(language as KinshipLocale, descriptor);
}

export function formatKinshipDescriptor(
  descriptor: KinshipDescriptor,
  options?: { language?: AppLanguage; kinshipSystem?: KinshipSystem },
) {
  const language = options?.language ?? getActiveLanguage();
  const kinshipSystem = options?.kinshipSystem ?? 'auto';
  const genericLabel = formatGenericKinshipDescriptor(descriptor);

  if (kinshipSystem === 'generic') {
    return isKinshipLocale(language) ? (formatLocalizedLabel(language, descriptor) ?? genericLabel) : genericLabel;
  }

  if (kinshipSystem !== 'auto') {
    const specificLabel = formatSpecificKinshipDescriptor(descriptor, kinshipSystem);
    if (!specificLabel) {
      return genericLabel;
    }

    return getKinshipSystemLanguage(kinshipSystem) === language
      ? specificLabel
      : `${genericLabel} (${specificLabel})`;
  }

  if (isKinshipLocale(language)) {
    return formatLocalizedLabel(language, descriptor) ?? genericLabel;
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
