// Shared types used by the optimized family tree canvas.
// Keeps layout / routing / rendering modules decoupled.

import type { PersonRecord } from './dto/person';
import type { RelationshipRecord } from './dto/relationship';

export type NodePosition = { x: number; y: number };

export type SpouseGroup = {
  id: string;
  memberIds: string[]; // ordered left-to-right for rendering
};

export type LayoutResult = {
  positionsByPersonId: Map<string, NodePosition>;
  spouseGroupsById: Map<string, SpouseGroup>;
  spouseGroupIdByPersonId: Map<string, string>;
  levelBySpouseGroupId: Map<string, number>;
  /** Computed bounding box of laid-out content (no padding included). */
  contentWidth: number;
  contentHeight: number;
};

export type Connector = {
  key: string;
  d: string;
  stroke: string;
  strokeWidth: number;
  /** Bounding box in canvas coordinates — used for viewport culling. */
  bounds: { x: number; y: number; w: number; h: number };
  /** If set, the connector is rendered as a dashed line (cross-family bridge). */
  dashArray?: string;
  /** Optional label to show on the connector (e.g., bridge person's name). */
  label?: string;
  /** Midpoint for label placement. */
  labelPosition?: { x: number; y: number };
};

export type FamilyGraph = {
  people: PersonRecord[];
  relationships: RelationshipRecord[];
};

export type LayoutConstants = {
  NODE_WIDTH: number;
  NODE_HEIGHT: number;
  HORIZONTAL_GAP: number; // between sibling subtrees
  SPOUSE_GAP: number;     // between spouses inside the same couple
  VERTICAL_GAP: number;   // between generations
  PADDING: number;        // outer padding around content
};

export const DEFAULT_LAYOUT_CONSTANTS: LayoutConstants = {
  NODE_WIDTH: 176,
  NODE_HEIGHT: 92,
  HORIZONTAL_GAP: 48,
  SPOUSE_GAP: 12,
  // Wider so each band has enough vertical room to host multiple
  // connector lanes without forcing the renderer to skip them.
  VERTICAL_GAP: 160,
  PADDING: 64,
};

