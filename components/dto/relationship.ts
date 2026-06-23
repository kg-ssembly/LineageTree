export type RelationshipType = 'parent-child' | 'spouse';
export type SpouseRelationshipStatus = 'married' | 'partner' | 'separated' | 'divorced' | 'widowed';
export type ParentChildRelationshipKind = 'biological' | 'non-biological' | 'step' | 'adopted' | 'foster' | 'guardian';

export interface RelationshipRecord {
  id: string;
  treeId: string;
  ownerId: string;
  type: RelationshipType;
  fromPersonId: string;
  toPersonId: string;
  relationshipStatus?: SpouseRelationshipStatus;
  parentChildKind?: ParentChildRelationshipKind;
  createdAt: string;
}

export const DEFAULT_SPOUSE_RELATIONSHIP_STATUS: SpouseRelationshipStatus = 'partner';
export const DEFAULT_PARENT_CHILD_RELATIONSHIP_KIND: ParentChildRelationshipKind = 'biological';
