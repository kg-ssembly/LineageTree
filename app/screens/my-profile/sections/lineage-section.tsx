import React from 'react';
import type { PersonRecord } from '../../../../components/dto/person';
import type { RelationshipRecord } from '../../../../components/dto/relationship';
import { PersonLineageSection } from '../../profile-shared';

export function LineageSection({
  title,
  count,
  countSingular,
  countPlural,
  linkedPerson,
  people,
  relationships,
  onPressPerson,
  mode,
}: {
  title: string;
  count: number;
  countSingular: string;
  countPlural: string;
  linkedPerson: PersonRecord;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  onPressPerson: (person: PersonRecord) => void;
  mode: 'ascendants' | 'descendants';
}) {
  return (
    <PersonLineageSection
      title={title}
      helperLabel={title}
      count={count}
      person={linkedPerson}
      people={people}
      relationships={relationships}
      currentAssignedPersonId={linkedPerson.id}
      onOpenHelperDialog={() => undefined}
      onPressPerson={onPressPerson}
      mode={mode === 'descendants' ? 'descendant' : 'ascendant'}
    />
  );
}
