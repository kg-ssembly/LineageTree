import type { FamilyTree } from '../components/dto/tree';
import type { PersonRecord } from '../components/dto/person';
import type { DiscoverableTreeSummary } from './family-tree-service';

export function normaliseSurnameKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export type MaidenTreeSuggestionCandidate = {
  id: string;
  name: string;
  ownerLabel: string;
  matchedBy: DiscoverableTreeSummary['matchedBy'] | 'accessible';
  matchedLabel: string;
  accessible: boolean;
};

export function treeMatchesSurname(tree: FamilyTree, surname: string) {
  const key = normaliseSurnameKey(surname);
  if (!key) {
    return false;
  }

  if (normaliseSurnameKey(tree.name) === key) {
    return true;
  }

  return tree.surnameVariantGroups.some((group) => (
    [group.primarySurname, ...group.variants]
      .map(normaliseSurnameKey)
      .includes(key)
  ));
}

function buildSurnameAliases(person: Pick<PersonRecord, 'maidenName' | 'surnameVariantHints'>) {
  return [...new Set([
    person.maidenName ?? '',
    ...(person.surnameVariantHints ?? []),
  ].map((value) => value.trim()).filter(Boolean))];
}

function getTreeOwnerLabel(tree: FamilyTree) {
  return tree.collaborators.find((entry) => entry.userId === tree.ownerId)?.displayName
    || tree.collaborators.find((entry) => entry.userId === tree.ownerId)?.email
    || tree.name;
}

function dedupeCandidates(candidates: MaidenTreeSuggestionCandidate[]) {
  return [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
}

export async function findMaidenTreeCandidates(
  person: Pick<PersonRecord, 'maidenName' | 'surnameVariantHints'>,
  trees: FamilyTree[],
  searchDiscoverableTrees: (searchTerm: string) => Promise<DiscoverableTreeSummary[]>,
  selectedTreeId?: string | null,
) {
  const aliases = buildSurnameAliases(person);
  if (aliases.length === 0) {
    return [] as MaidenTreeSuggestionCandidate[];
  }

  const accessibleCandidates: MaidenTreeSuggestionCandidate[] = aliases.flatMap((alias) => (
    trees
      .filter((tree) => tree.id !== selectedTreeId && treeMatchesSurname(tree, alias))
      .map((tree) => ({
        id: tree.id,
        name: tree.name,
        ownerLabel: getTreeOwnerLabel(tree),
        matchedBy: 'accessible',
        matchedLabel: alias,
        accessible: true,
      } satisfies MaidenTreeSuggestionCandidate))
  ));

  const discoverableResults = await Promise.all(aliases.map((alias) => searchDiscoverableTrees(alias)));
  const discoverableCandidates: MaidenTreeSuggestionCandidate[] = discoverableResults.flat().map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    ownerLabel: candidate.ownerDisplayName || candidate.ownerUsername || candidate.name,
    matchedBy: candidate.matchedBy,
    matchedLabel: candidate.matchedLabel,
    accessible: false,
  }));

  return dedupeCandidates([
    ...accessibleCandidates,
    ...discoverableCandidates,
  ]).sort((left, right) => {
    if (left.accessible !== right.accessible) {
      return left.accessible ? -1 : 1;
    }

    if (left.name !== right.name) {
      return left.name.localeCompare(right.name);
    }

    return left.ownerLabel.localeCompare(right.ownerLabel);
  });
}
