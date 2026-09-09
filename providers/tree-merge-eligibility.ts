import type { FamilyTree } from '../components/dto/tree';

type MergeTree = Pick<FamilyTree, 'id' | 'name' | 'surnameVariantGroups'>;

function surnameKey(value: string) {
  return value.normalize('NFKC').trim().toLowerCase()
    .replace(/[.'’_\-\s]+/g, '');
}

function treeSurnameKey(name: string) {
  return surnameKey(name.trim().replace(/(?:\s+(?:family|tree|branch))+$/i, ''));
}

type MergePerson = { lastName: string };

function surnameKeys(tree: MergeTree, people: MergePerson[]) {
  return new Set([
    treeSurnameKey(tree.name),
    ...tree.surnameVariantGroups.flatMap((group) => [group.primarySurname, ...group.variants]).map(surnameKey),
    ...people.map((person) => surnameKey(person.lastName)),
  ].filter(Boolean));
}

export function areTreesMergeCompatible(
  source: MergeTree, target: MergeTree,
  sourcePeople: MergePerson[] = [], targetPeople: MergePerson[] = [],
) {
  if (source.id === target.id) return false;
  const sourceKeys = surnameKeys(source, sourcePeople);
  const targetKeys = surnameKeys(target, targetPeople);
  return [...sourceKeys].some((key) => targetKeys.has(key));
}

export function assertTreesMergeCompatible(
  source: MergeTree, target: MergeTree,
  sourcePeople: MergePerson[] = [], targetPeople: MergePerson[] = [],
) {
  if (!areTreesMergeCompatible(source, target, sourcePeople, targetPeople)) {
    throw new Error('Only trees sharing a surname through their names, saved variants, or members’ current surnames can merge. Maiden surnames do not qualify.');
  }
}
