// Surname-based clustering for the family tree.
//
// Groups people by surname into distinct visual clusters. Cross-family
// marriages are represented as dotted "bridge" connectors showing exactly
// which person connects the two families.
//
// The component shows at most 2 surname clusters at a time. Users can
// navigate between clusters by clicking on bridge connectors or using
// a family selector UI.

import type { PersonRecord } from './dto/person';
import type { RelationshipRecord } from './dto/relationship';

export type SurnameCluster = {
  surname: string;
  /** Person IDs belonging to this surname (by birth or primary identity). */
  memberIds: Set<string>;
};

export type FamilyBridge = {
  /** The person who "bridges" two families (married into the other surname). */
  bridgePersonId: string;
  /** The spouse in the other family. */
  spousePersonId: string;
  /** Surname of the bridge person's birth family. */
  fromSurname: string;
  /** Surname of the family they married into. */
  toSurname: string;
  relationshipId: string;
};

/**
 * Extract the surname from a PersonRecord.
 * Uses the last word of `lastName`, or falls back to 'Unknown'.
 */
export function extractSurname(person: PersonRecord): string {
  const last = (person.lastName ?? '').trim();
  if (!last) return 'Unknown';
  // Use the full lastName as the surname key (handles multi-word surnames).
  return last;
}

/**
 * Build surname clusters from a list of people.
 * Each person is assigned to their lastName cluster.
 * People with a maiden name are ALSO counted in their maiden surname cluster
 * (so the chip appears in the family selector), but they render as ghost nodes
 * when a non-current-name family is viewed.
 */
export function buildSurnameClusters(
  people: PersonRecord[],
): Map<string, SurnameCluster> {
  const clusters = new Map<string, SurnameCluster>();

  for (const person of people) {
    const surname = extractSurname(person);
    if (!clusters.has(surname)) {
      clusters.set(surname, { surname, memberIds: new Set() });
    }
    clusters.get(surname)!.memberIds.add(person.id);

    // Also register in maiden-name cluster so the chip appears.
    const maiden = person.maidenName?.trim();
    if (maiden && maiden !== surname) {
      if (!clusters.has(maiden)) {
        clusters.set(maiden, { surname: maiden, memberIds: new Set() });
      }
      clusters.get(maiden)!.memberIds.add(person.id);
    }
  }

  return clusters;
}

/**
 * Identify cross-family bridges: spouse relationships where the two
 * people have different surnames. Each bridge tells you exactly who
 * connects family A to family B.
 */
export function findFamilyBridges(
  people: PersonRecord[],
  relationships: RelationshipRecord[],
): FamilyBridge[] {
  const personById = new Map(people.map((p) => [p.id, p]));
  const bridges: FamilyBridge[] = [];

  for (const rel of relationships) {
    if (rel.type !== 'spouse') continue;
    const a = personById.get(rel.fromPersonId);
    const b = personById.get(rel.toPersonId);
    if (!a || !b) continue;

    const surnameA = extractSurname(a);
    const surnameB = extractSurname(b);
    if (surnameA === surnameB) continue;

    bridges.push({
      bridgePersonId: rel.fromPersonId,
      spousePersonId: rel.toPersonId,
      fromSurname: surnameA,
      toSurname: surnameB,
      relationshipId: rel.id,
    });
  }

  return bridges;
}

/**
 * Given the full dataset and a set of active surnames (max 2),
 * return the filtered people and relationships to render.
 *
 * - All members of the active surname clusters are included.
 * - Spouse relationships that cross into a non-active surname are kept
 *   but only the bridge person from the non-active family is added
 *   (as a "ghost" node — visually distinct).
 * - Parent-child relationships are kept if both ends are in the active set.
 */
export function filterForActiveSurnames(
  people: PersonRecord[],
  relationships: RelationshipRecord[],
  activeSurnames: string[],
): {
  filteredPeople: PersonRecord[];
  filteredRelationships: RelationshipRecord[];
  /** Person IDs that are "ghost" nodes (from outside active clusters, included only for bridge display). */
  ghostPersonIds: Set<string>;
  /** Bridges between the active surnames. */
  activeBridges: FamilyBridge[];
  /** Bridges leading to non-active surnames (shown as navigation hints). */
  externalBridges: FamilyBridge[];
} {
  const personById = new Map(people.map((p) => [p.id, p]));
  const activeSet = new Set(activeSurnames);

  // Determine which people are in active clusters (by current lastName).
  const activePersonIds = new Set<string>();
  for (const person of people) {
    if (activeSet.has(extractSurname(person))) {
      activePersonIds.add(person.id);
    }
  }

  const bridges = findFamilyBridges(people, relationships);
  const ghostPersonIds = new Set<string>();
  const activeBridges: FamilyBridge[] = [];
  const externalBridges: FamilyBridge[] = [];

  for (const bridge of bridges) {
    const fromActive = activeSet.has(bridge.fromSurname);
    const toActive = activeSet.has(bridge.toSurname);

    if (fromActive && toActive) {
      activeBridges.push(bridge);
    } else if (fromActive || toActive) {
      externalBridges.push(bridge);
      // Add the person from the non-active side as a ghost node.
      const ghostId = fromActive ? bridge.spousePersonId : bridge.bridgePersonId;
      if (personById.has(ghostId)) {
        ghostPersonIds.add(ghostId);
      }
    }
  }

  // People whose MAIDEN name matches the active surname (but current lastName does not)
  // appear as ghost nodes in that family's view — they "originally belonged" to this family.
  for (const person of people) {
    const maiden = person.maidenName?.trim();
    if (maiden && activeSet.has(maiden) && !activePersonIds.has(person.id)) {
      ghostPersonIds.add(person.id);
    }
  }

  // Include active people + ghost people.
  const includedIds = new Set([...activePersonIds, ...ghostPersonIds]);
  const filteredPeople = people.filter((p) => includedIds.has(p.id));

  // Filter relationships: keep if both ends are included.
  const filteredRelationships = relationships.filter(
    (r) => includedIds.has(r.fromPersonId) && includedIds.has(r.toPersonId),
  );

  return {
    filteredPeople,
    filteredRelationships,
    ghostPersonIds,
    activeBridges,
    externalBridges,
  };
}

/**
 * Return the set of person IDs that have a non-empty maiden name recorded.
 * These are highlighted in the tree with a "née" badge and offer a
 * "View [maiden] family tree" option when tapped.
 */
export function findMaidenNameMembers(people: PersonRecord[]): Set<string> {
  const result = new Set<string>();
  for (const person of people) {
    if (person.maidenName?.trim()) {
      result.add(person.id);
    }
  }
  return result;
}

/**
 * Identify children who have parents from two different surname families.
 * These are children of cross-family marriages (one parent from each surname).
 * Uses the full (unfiltered) people + relationships list so ghost nodes don't
 * cause missed detections.
 */
export function findCrossSurnameChildren(
  people: PersonRecord[],
  relationships: RelationshipRecord[],
): Set<string> {
  const personById = new Map(people.map((p) => [p.id, p]));
  // childId → set of parent surnames
  const parentSurnamesByChild = new Map<string, Set<string>>();

  for (const rel of relationships) {
    if (rel.type !== 'parent-child') continue;
    const parent = personById.get(rel.fromPersonId);
    if (!parent) continue;
    if (!parentSurnamesByChild.has(rel.toPersonId)) {
      parentSurnamesByChild.set(rel.toPersonId, new Set());
    }
    parentSurnamesByChild.get(rel.toPersonId)!.add(extractSurname(parent));
  }

  const result = new Set<string>();
  for (const [childId, surnames] of parentSurnamesByChild) {
    if (surnames.size > 1) {
      result.add(childId);
    }
  }
  return result;
}

/**
 * Get all unique surnames sorted by cluster size (largest first).
 */
export function getSortedSurnames(clusters: Map<string, SurnameCluster>): string[] {
  return [...clusters.entries()]
    .sort((a, b) => b[1].memberIds.size - a[1].memberIds.size || a[0].localeCompare(b[0]))
    .map((entry) => entry[0]);
}

/**
 * Given a person ID, find which surnames are connected to their family
 * through marriage bridges. Useful for suggesting the next cluster to view.
 */
export function getConnectedSurnames(
  surname: string,
  bridges: FamilyBridge[],
): string[] {
  const connected = new Set<string>();
  for (const b of bridges) {
    if (b.fromSurname === surname) connected.add(b.toSurname);
    if (b.toSurname === surname) connected.add(b.fromSurname);
  }
  return [...connected].sort();
}

