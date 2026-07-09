import type { PersonRecord } from '../../../../components/dto/person';

export type BranchGrowthItem = {
  surname: string;
  total: number;
  fresh: number;
  newestCreatedAt: string;
  representativePersonId: string | null;
};

export function buildBranchGrowth(people: PersonRecord[], unknownLabel: string) {
  const counts = new Map<string, BranchGrowthItem>();
  const newestBoundary = Date.now() - (1000 * 60 * 60 * 24 * 45);

  people.forEach((person) => {
    const surname = person.lastName.trim() || person.maidenName?.trim() || unknownLabel;
    const current = counts.get(surname) ?? {
      surname,
      total: 0,
      fresh: 0,
      newestCreatedAt: '',
      representativePersonId: null,
    };
    current.total += 1;
    const createdAt = Date.parse(person.createdAt);
    if (Number.isFinite(createdAt) && createdAt >= newestBoundary) {
      current.fresh += 1;
    }
    if ((person.createdAt ?? '') > current.newestCreatedAt) {
      current.newestCreatedAt = person.createdAt ?? '';
      current.representativePersonId = person.id;
    }
    counts.set(surname, current);
  });

  return [...counts.values()]
    .sort((left, right) => (
      right.fresh - left.fresh
      || right.total - left.total
      || right.newestCreatedAt.localeCompare(left.newestCreatedAt)
      || left.surname.localeCompare(right.surname)
    ));
}
