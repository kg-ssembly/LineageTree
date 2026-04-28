export type RelationshipType = 'parent-child' | 'spouse';

export interface RelationshipRecord {
  id: string;
  treeId: string;
  ownerId: string;
  type: RelationshipType;
  fromPersonId: string;
  toPersonId: string;
  createdAt: string;
}

