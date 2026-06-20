import type { MergeConflict, MergeMatchSignal, MergePersonMatch, MergePreview } from '../components/dto/merge';
import { getMatchStrengthLabel } from '../components/dto/merge';
import type { PersonRecord } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';
import type { FamilyTree, SurnameVariantGroup } from '../components/dto/tree';

type TreeBundle = {
  tree: FamilyTree;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
};

function normalise(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.'’_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function tokenize(value: string) {
  return normalise(value)
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function getDisplayName(person: PersonRecord) {
  return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim();
}

function getBirthYear(person: PersonRecord) {
  return person.birthDate ? Number.parseInt(person.birthDate.slice(0, 4), 10) : null;
}

function buildSurnameSet(person: PersonRecord, groups: SurnameVariantGroup[]) {
  const values = new Set<string>();
  const rawValues = [
    person.lastName,
    person.maidenName ?? '',
    ...(person.surnameVariantHints ?? []),
  ];

  rawValues.forEach((value) => {
    const normalized = normalise(value);
    if (normalized) {
      values.add(normalized);
    }
  });

  groups.forEach((group) => {
    const variants = [group.primarySurname, ...group.variants].map(normalise);
    if (variants.some((variant) => values.has(variant))) {
      variants.forEach((variant) => {
        if (variant) {
          values.add(variant);
        }
      });
    }
  });

  return values;
}

function getRelationshipNames(
  personId: string,
  peopleById: Map<string, PersonRecord>,
  relationships: RelationshipRecord[],
) {
  const parentNames = new Set<string>();
  const childNames = new Set<string>();
  const spouseNames = new Set<string>();

  relationships.forEach((relationship) => {
    if (relationship.type === 'parent-child') {
      if (relationship.toPersonId === personId) {
        const parent = peopleById.get(relationship.fromPersonId);
        if (parent) {
          parentNames.add(normalise(getDisplayName(parent)));
        }
      }

      if (relationship.fromPersonId === personId) {
        const child = peopleById.get(relationship.toPersonId);
        if (child) {
          childNames.add(normalise(getDisplayName(child)));
        }
      }
    }

    if (relationship.type === 'spouse') {
      const spouseId = relationship.fromPersonId === personId
        ? relationship.toPersonId
        : relationship.toPersonId === personId
          ? relationship.fromPersonId
          : null;
      if (spouseId) {
        const spouse = peopleById.get(spouseId);
        if (spouse) {
          spouseNames.add(normalise(getDisplayName(spouse)));
        }
      }
    }
  });

  return { parentNames, childNames, spouseNames };
}

function hasOverlap(left: Set<string>, right: Set<string>) {
  return [...left].some((value) => right.has(value));
}

function createSignal(label: string, weight: number, matched: boolean, detail: string): MergeMatchSignal {
  return { label, weight, matched, detail };
}

function comparePeople(source: TreeBundle, target: TreeBundle, sourcePerson: PersonRecord, targetPerson: PersonRecord): MergePersonMatch {
  const sourcePeopleById = new Map(source.people.map((person) => [person.id, person]));
  const targetPeopleById = new Map(target.people.map((person) => [person.id, person]));
  const sourceFullName = normalise(getDisplayName(sourcePerson));
  const targetFullName = normalise(getDisplayName(targetPerson));
  const sourceFirst = normalise(sourcePerson.firstName);
  const targetFirst = normalise(targetPerson.firstName);
  const sourceMiddle = new Set(tokenize(sourcePerson.middleNames ?? ''));
  const targetMiddle = new Set(tokenize(targetPerson.middleNames ?? ''));
  const sourceSurnames = buildSurnameSet(sourcePerson, source.tree.surnameVariantGroups);
  const targetSurnames = buildSurnameSet(targetPerson, target.tree.surnameVariantGroups);
  const sourceBirthYear = getBirthYear(sourcePerson);
  const targetBirthYear = getBirthYear(targetPerson);
  const sourceRelations = getRelationshipNames(sourcePerson.id, sourcePeopleById, source.relationships);
  const targetRelations = getRelationshipNames(targetPerson.id, targetPeopleById, target.relationships);
  const signals: MergeMatchSignal[] = [];

  signals.push(createSignal(
    'Full name',
    24,
    sourceFullName === targetFullName || sourceFirst === targetFirst,
    `${getDisplayName(sourcePerson)} vs ${getDisplayName(targetPerson)}`,
  ));
  signals.push(createSignal(
    'Middle names',
    6,
    sourceMiddle.size > 0 && targetMiddle.size > 0 && hasOverlap(sourceMiddle, targetMiddle),
    `${sourcePerson.middleNames ?? 'Unknown'} vs ${targetPerson.middleNames ?? 'Unknown'}`,
  ));
  signals.push(createSignal(
    'Surname variants',
    18,
    hasOverlap(sourceSurnames, targetSurnames),
    `${sourcePerson.lastName} vs ${targetPerson.lastName}`,
  ));
  signals.push(createSignal(
    'Gender',
    4,
    sourcePerson.gender !== 'unspecified' && sourcePerson.gender === targetPerson.gender,
    `${sourcePerson.gender} vs ${targetPerson.gender}`,
  ));
  signals.push(createSignal(
    'Birth year',
    10,
    sourceBirthYear !== null && targetBirthYear !== null && Math.abs(sourceBirthYear - targetBirthYear) <= 2,
    `${sourceBirthYear ?? 'Unknown'} vs ${targetBirthYear ?? 'Unknown'}`,
  ));
  signals.push(createSignal(
    'Parents',
    12,
    hasOverlap(sourceRelations.parentNames, targetRelations.parentNames),
    `${sourceRelations.parentNames.size} vs ${targetRelations.parentNames.size} parent links`,
  ));
  signals.push(createSignal(
    'Spouse',
    10,
    hasOverlap(sourceRelations.spouseNames, targetRelations.spouseNames),
    `${sourceRelations.spouseNames.size} vs ${targetRelations.spouseNames.size} spouse links`,
  ));
  signals.push(createSignal(
    'Children',
    7,
    hasOverlap(sourceRelations.childNames, targetRelations.childNames),
    `${sourceRelations.childNames.size} vs ${targetRelations.childNames.size} child links`,
  ));
  signals.push(createSignal(
    'Birthplace / hometown',
    5,
    Boolean(sourcePerson.birthPlace && targetPerson.birthPlace && normalise(sourcePerson.birthPlace) === normalise(targetPerson.birthPlace))
    || Boolean(sourcePerson.hometown && targetPerson.hometown && normalise(sourcePerson.hometown) === normalise(targetPerson.hometown)),
    `${sourcePerson.birthPlace || sourcePerson.hometown || 'Unknown'} vs ${targetPerson.birthPlace || targetPerson.hometown || 'Unknown'}`,
  ));
  signals.push(createSignal(
    'Clan / branch',
    4,
    Boolean(sourcePerson.clanName && targetPerson.clanName && normalise(sourcePerson.clanName) === normalise(targetPerson.clanName))
    || Boolean(sourcePerson.familyBranch && targetPerson.familyBranch && normalise(sourcePerson.familyBranch) === normalise(targetPerson.familyBranch)),
    `${sourcePerson.clanName || sourcePerson.familyBranch || 'Unknown'} vs ${targetPerson.clanName || targetPerson.familyBranch || 'Unknown'}`,
  ));
  signals.push(createSignal(
    'Photos',
    4,
    sourcePerson.photos.length > 0 && targetPerson.photos.length > 0,
    `${sourcePerson.photos.length} vs ${targetPerson.photos.length} photos`,
  ));

  const baseScore = signals.reduce((sum, signal) => sum + (signal.matched ? signal.weight : 0), 0);
  const guidedQuestions = [
    {
      id: `same-person-${sourcePerson.id}-${targetPerson.id}`,
      prompt: `Is ${getDisplayName(sourcePerson)} the same person as ${getDisplayName(targetPerson)}?`,
    },
    {
      id: `same-parent-${sourcePerson.id}-${targetPerson.id}`,
      prompt: `Do these two people belong to the same family branch or share the same parents?`,
    },
  ];

  const conflicts: MergeConflict[] = [];
  if (sourcePerson.birthDate && targetPerson.birthDate && sourcePerson.birthDate !== targetPerson.birthDate) {
    conflicts.push({ field: 'birthDate', sourceValue: sourcePerson.birthDate, targetValue: targetPerson.birthDate });
  }
  if (sourcePerson.lastName && targetPerson.lastName && normalise(sourcePerson.lastName) !== normalise(targetPerson.lastName)) {
    conflicts.push({ field: 'surname', sourceValue: sourcePerson.lastName, targetValue: targetPerson.lastName });
  }
  if (sourcePerson.hometown && targetPerson.hometown && normalise(sourcePerson.hometown) !== normalise(targetPerson.hometown)) {
    conflicts.push({ field: 'hometown', sourceValue: sourcePerson.hometown, targetValue: targetPerson.hometown });
  }

  return {
    id: `${sourcePerson.id}:${targetPerson.id}`,
    sourcePersonId: sourcePerson.id,
    targetPersonId: targetPerson.id,
    confidenceScore: Math.max(0, Math.min(99, baseScore)),
    confidenceLabel: getMatchStrengthLabel(baseScore),
    signals,
    guidedQuestions,
    conflicts,
  };
}

export function buildMergePreview(source: TreeBundle, target: TreeBundle): MergePreview {
  const matches = source.people
    .flatMap((sourcePerson) => target.people.map((targetPerson) => comparePeople(source, target, sourcePerson, targetPerson)))
    .filter((match) => match.confidenceScore >= 35)
    .sort((left, right) => right.confidenceScore - left.confidenceScore)
    .slice(0, 25);

  return {
    sourceTree: {
      treeId: source.tree.id,
      treeName: source.tree.name,
      personCount: source.people.length,
    },
    targetTree: {
      treeId: target.tree.id,
      treeName: target.tree.name,
      personCount: target.people.length,
    },
    matches,
    duplicateCount: matches.filter((match) => match.confidenceScore >= 65).length,
    connectedRelationshipCount: matches.reduce((sum, match) => sum + match.signals.filter((signal) => signal.matched).length, 0),
    newBranchCount: Math.max(0, source.people.length - matches.length),
    conflicts: matches.flatMap((match) => match.conflicts),
    combinedAssetCount: source.people.reduce((sum, person) => sum + person.photos.length + person.lifeEvents.length, 0)
      + target.people.reduce((sum, person) => sum + person.photos.length + person.lifeEvents.length, 0),
  };
}
