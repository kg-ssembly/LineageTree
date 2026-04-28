import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';
import type { PersonRecord } from './dto/person';
import {
  getPersonFallbackAvatarIcon,
  getPersonLifeSpanLabel,
  getPersonPresenceLabel,
  getPreferredPersonPhoto,
} from './dto/person';
import type { RelationshipRecord } from './dto/relationship';
import { GlobalStyles } from '../constants/styles';

const styles = GlobalStyles.familyTreeCanvas;

interface FamilyTreeCanvasProps {
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  onPressPerson: (person: PersonRecord) => void;
  currentUserPersonId?: string;
  initialFocusPersonId?: string;
  descendantRootPersonId?: string;
  ascendantRootPersonId?: string;
  allowFullscreen?: boolean;
  floatingControls?: boolean;
  fillAvailableSpace?: boolean;
}

type NodePosition = {
  x: number;
  y: number;
};

const NODE_WIDTH = 152;
const NODE_HEIGHT = 84;
const HORIZONTAL_GAP = 40;
const SPOUSE_GAP = 12;
const VERTICAL_GAP = 120;
const PADDING = 48;
const VIEWPORT_PADDING = 24;
const MIN_SCALE = 0.7;
const MAX_SCALE = 1.8;
const DRAG_ACTIVATION_DISTANCE = 6;
const FREE_PAN_PADDING = 96;

type GenerationLayout = {
  groupedPeople: Map<number, PersonRecord[]>;
  spouseGroupIdsByPersonId: Map<string, string>;
  spouseGroupMembersById: Map<string, string[]>;
  levelBySpouseGroupId: Map<string, number>;
  parentGroupIdsByChildGroupId: Map<string, Set<string>>;
  childGroupIdsByParentGroupId: Map<string, Set<string>>;
};

type TreeConnectorPath = {
  key: string;
  d: string;
  stroke: string;
  strokeWidth: number;
};

type ObstacleBox = { x: number, y: number, w: number, h: number };

function formatPersonName(person: PersonRecord) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function applyRoundedCorners(pathStr: string, radius: number): string {
  const commands = pathStr.match(/[A-Z][^A-Z]*/gi);
  if (!commands) return pathStr;

  let newPath = '';
  const points: { type: string; x: number; y: number }[] = [];

  for (const cmd of commands) {
    const type = cmd[0];
    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
    if (type.toUpperCase() === 'M' || type.toUpperCase() === 'L') {
      points.push({ type, x: coords[0], y: coords[1] });
    }
  }

  if (points.length < 3) return pathStr;

  newPath += `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[i + 1];

    if (p2.type.toUpperCase() === 'M' || p3.type.toUpperCase() === 'M') {
      newPath += ` ${p2.type} ${p2.x} ${p2.y}`;
      continue;
    }

    const d1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const d2 = Math.hypot(p3.x - p2.x, p3.y - p2.y);

    if (d1 === 0 || d2 === 0) {
      newPath += ` L ${p2.x} ${p2.y}`;
      continue;
    }

    const r = Math.min(radius, d1 / 2, d2 / 2);

    const vx1 = (p1.x - p2.x) / d1;
    const vy1 = (p1.y - p2.y) / d1;

    const vx2 = (p3.x - p2.x) / d2;
    const vy2 = (p3.y - p2.y) / d2;

    const startX = p2.x + vx1 * r;
    const startY = p2.y + vy1 * r;

    const endX = p2.x + vx2 * r;
    const endY = p2.y + vy2 * r;

    newPath += ` L ${startX} ${startY} Q ${p2.x} ${p2.y} ${endX} ${endY}`;
  }

  const lastPoint = points[points.length - 1];
  newPath += ` ${lastPoint.type} ${lastPoint.x} ${lastPoint.y}`;

  return newPath;
}

function routeVertical(x: number, y1: number, y2: number, obstacles: ObstacleBox[]): string {
  if (Math.abs(y1 - y2) < 1) {
    return `L ${x} ${y2}`;
  }

  const startY = Math.min(y1, y2);
  const endY = Math.max(y1, y2);
  const direction = y2 > y1 ? 1 : -1;
  const padX = 8;

  // Search for obstacles strictly between startY and endY
  const hit = obstacles.filter(o =>
    x > o.x - padX &&
    x < o.x + o.w + padX &&
    o.y > startY + 10 &&
    o.y + o.h < endY - 10
  );

  if (hit.length === 0) {
    return `L ${x} ${y2}`;
  }

  const rowHits = new Map<number, ObstacleBox[]>();
  hit.forEach(o => {
    if (!rowHits.has(o.y)) rowHits.set(o.y, []);
    rowHits.get(o.y)!.push(o);
  });
  
  const sortedRowYs = [...rowHits.keys()].sort((a, b) => direction === 1 ? a - b : b - a);

  let path = '';
  let currentX = x;
  let currentY = y1;

  for (const rowY of sortedRowYs) {
    const rowObstacles = rowHits.get(rowY)!;
    const o = rowObstacles[0];
    
    // Pause routing slightly before the obstacle
    const dodgeY = direction === 1 ? o.y - 20 : o.y + o.h + 20;
    if ((direction === 1 && dodgeY > currentY) || (direction === -1 && dodgeY < currentY)) {
      path += ` L ${currentX} ${dodgeY}`;
      currentY = dodgeY;
    }

    // Resume point below the obstacle
    const passY = direction === 1 ? o.y + o.h + 20 : o.y - 20;

    // Attempt lateral dodge to the nearest gap between columns
    const leftX = o.x - HORIZONTAL_GAP / 2;
    const rightX = o.x + o.w + HORIZONTAL_GAP / 2;

    const isClear = (cx: number) => !obstacles.some(ob => cx > ob.x - padX && cx < ob.x + ob.w + padX && ob.y === o.y);

    let clearX = currentX;
    if (Math.abs(leftX - x) <= Math.abs(rightX - x) && isClear(leftX)) {
      clearX = leftX;
    } else if (isClear(rightX)) {
      clearX = rightX;
    } else {
      clearX = leftX;
    }

    if (clearX !== currentX) {
      path += ` L ${clearX} ${currentY} L ${clearX} ${passY} L ${x} ${passY}`;
    } else {
      path += ` L ${x} ${passY}`;
    }

    currentX = x;
    currentY = passY;
  }

  if ((direction === 1 && y2 > currentY) || (direction === -1 && y2 < currentY)) {
    path += ` L ${x} ${y2}`;
  }
  return path.trim();
}

function createTreeBranchPath(
  parentX: number,
  parentY: number,
  junctionY: number,
  childrenPoints: { x: number; topY: number }[],
  obstacles: ObstacleBox[]
) {
  if (childrenPoints.length === 0) {
    return '';
  }

  const parts: string[] = [];

  childrenPoints.forEach((child) => {
    const trunk = routeVertical(parentX, parentY, junctionY, obstacles);
    let childPath = `M ${parentX} ${parentY} ${trunk}`;
    if (parentX !== child.x) {
      childPath += ` L ${child.x} ${junctionY}`;
    }
    const drop = routeVertical(child.x, junctionY, child.topY, obstacles);
    childPath += ` ${drop}`;
    
    parts.push(applyRoundedCorners(childPath, 16));
  });

  return parts.filter(Boolean).join(' ');
}

function buildGenerations(people: PersonRecord[], relationships: RelationshipRecord[]): GenerationLayout {
  const parentChildRelationships = relationships.filter((relationship) => relationship.type === 'parent-child');
  const spouseRelationships = relationships.filter((relationship) => relationship.type === 'spouse');
  const parentIdsByChildId = new Map<string, Set<string>>();
  const childIdsByParentId = new Map<string, Set<string>>();
  const personById = new Map(people.map((person) => [person.id, person]));

  const spouseRootByPersonId = new Map<string, string>();
  people.forEach((person) => {
    spouseRootByPersonId.set(person.id, person.id);
  });

  const findSpouseRoot = (personId: string): string => {
    const directRoot = spouseRootByPersonId.get(personId) ?? personId;
    if (directRoot === personId) {
      return directRoot;
    }

    const resolvedRoot = findSpouseRoot(directRoot);
    spouseRootByPersonId.set(personId, resolvedRoot);
    return resolvedRoot;
  };

  const unionSpouses = (personAId: string, personBId: string) => {
    const rootA = findSpouseRoot(personAId);
    const rootB = findSpouseRoot(personBId);
    if (rootA === rootB) {
      return;
    }

    const [nextRoot, mergedRoot] = [rootA, rootB].sort((left, right) => left.localeCompare(right));
    spouseRootByPersonId.set(mergedRoot, nextRoot);
  };

  spouseRelationships.forEach((relationship) => {
    unionSpouses(relationship.fromPersonId, relationship.toPersonId);
  });

  const spouseGroupIdsByPersonId = new Map<string, string>();
  const spouseGroupMembersById = new Map<string, string[]>();

  people.forEach((person) => {
    const spouseGroupId = findSpouseRoot(person.id);
    spouseGroupIdsByPersonId.set(person.id, spouseGroupId);
    if (!spouseGroupMembersById.has(spouseGroupId)) {
      spouseGroupMembersById.set(spouseGroupId, []);
    }
    spouseGroupMembersById.get(spouseGroupId)!.push(person.id);
  });

  parentChildRelationships.forEach((relationship) => {
    if (!parentIdsByChildId.has(relationship.toPersonId)) {
      parentIdsByChildId.set(relationship.toPersonId, new Set());
    }
    if (!childIdsByParentId.has(relationship.fromPersonId)) {
      childIdsByParentId.set(relationship.fromPersonId, new Set());
    }

    parentIdsByChildId.get(relationship.toPersonId)!.add(relationship.fromPersonId);
    childIdsByParentId.get(relationship.fromPersonId)!.add(relationship.toPersonId);
  });

  const parentGroupIdsByChildGroupId = new Map<string, Set<string>>();
  const childGroupIdsByParentGroupId = new Map<string, Set<string>>();

  parentChildRelationships.forEach((relationship) => {
    const parentGroupId = spouseGroupIdsByPersonId.get(relationship.fromPersonId) ?? relationship.fromPersonId;
    const childGroupId = spouseGroupIdsByPersonId.get(relationship.toPersonId) ?? relationship.toPersonId;

    if (parentGroupId === childGroupId) {
      return;
    }

    if (!parentGroupIdsByChildGroupId.has(childGroupId)) {
      parentGroupIdsByChildGroupId.set(childGroupId, new Set());
    }
    if (!childGroupIdsByParentGroupId.has(parentGroupId)) {
      childGroupIdsByParentGroupId.set(parentGroupId, new Set());
    }

    parentGroupIdsByChildGroupId.get(childGroupId)!.add(parentGroupId);
    childGroupIdsByParentGroupId.get(parentGroupId)!.add(childGroupId);
  });

  const formatGroupAnchorName = (spouseGroupId: string) => (
    (spouseGroupMembersById.get(spouseGroupId) ?? [])
      .map((personId) => personById.get(personId))
      .filter((person): person is PersonRecord => Boolean(person))
      .map((person) => formatPersonName(person))
      .sort((left, right) => left.localeCompare(right))[0] ?? spouseGroupId
  );

  const levelBySpouseGroupId = new Map<string, number>();
  const rootSpouseGroupIds = [...spouseGroupMembersById.keys()]
    .filter((spouseGroupId) => !parentGroupIdsByChildGroupId.get(spouseGroupId)?.size)
    .sort((left, right) => formatGroupAnchorName(left).localeCompare(formatGroupAnchorName(right)));
  const queue = rootSpouseGroupIds.map((spouseGroupId) => ({ spouseGroupId, level: 0 }));

  rootSpouseGroupIds.forEach((spouseGroupId) => levelBySpouseGroupId.set(spouseGroupId, 0));

  while (queue.length > 0) {
    const current = queue.shift()!;
    const childSpouseGroupIds = [...(childGroupIdsByParentGroupId.get(current.spouseGroupId) ?? new Set<string>())];

    childSpouseGroupIds.forEach((childSpouseGroupId) => {
      const nextLevel = current.level + 1;
      if (!levelBySpouseGroupId.has(childSpouseGroupId) || nextLevel > levelBySpouseGroupId.get(childSpouseGroupId)!) {
        levelBySpouseGroupId.set(childSpouseGroupId, nextLevel);
        queue.push({ spouseGroupId: childSpouseGroupId, level: nextLevel });
      }
    });
  }

  let fallbackLevel = Math.max(0, ...levelBySpouseGroupId.values()) + 1;
  spouseGroupMembersById.forEach((_, spouseGroupId) => {
    if (!levelBySpouseGroupId.has(spouseGroupId)) {
      levelBySpouseGroupId.set(spouseGroupId, fallbackLevel);
      fallbackLevel += 1;
    }
  });

  const groupedPeople = new Map<number, PersonRecord[]>();
  const spouseGroupSortKeys = new Map<string, { familyKey: string; anchorName: string }>();

  spouseGroupMembersById.forEach((memberIds, spouseGroupId) => {
    const familyKey = memberIds
      .map((personId) => [...(parentIdsByChildId.get(personId) ?? new Set<string>())].sort().join('|'))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))[0]
      ?? `solo:${memberIds.slice().sort((left, right) => left.localeCompare(right)).join('|')}`;

    spouseGroupSortKeys.set(spouseGroupId, {
      familyKey,
      anchorName: formatGroupAnchorName(spouseGroupId),
    });
  });

  const spouseGroupIdsByLevel = new Map<number, string[]>();
  spouseGroupMembersById.forEach((_, spouseGroupId) => {
    const level = levelBySpouseGroupId.get(spouseGroupId) ?? 0;
    if (!spouseGroupIdsByLevel.has(level)) {
      spouseGroupIdsByLevel.set(level, []);
    }
    spouseGroupIdsByLevel.get(level)!.push(spouseGroupId);
  });

  const orderScoreBySpouseGroupId = new Map<string, number>();

  spouseGroupIdsByLevel.forEach((spouseGroupIds, level) => {
    spouseGroupIds
      .sort((left, right) => {
        const leftParentScores = [...(parentGroupIdsByChildGroupId.get(left) ?? new Set<string>())]
          .map((groupId) => orderScoreBySpouseGroupId.get(groupId))
          .filter((value): value is number => typeof value === 'number');
        const rightParentScores = [...(parentGroupIdsByChildGroupId.get(right) ?? new Set<string>())]
          .map((groupId) => orderScoreBySpouseGroupId.get(groupId))
          .filter((value): value is number => typeof value === 'number');
        const leftBarycenter = leftParentScores.length > 0
          ? leftParentScores.reduce((sum, value) => sum + value, 0) / leftParentScores.length
          : Number.POSITIVE_INFINITY;
        const rightBarycenter = rightParentScores.length > 0
          ? rightParentScores.reduce((sum, value) => sum + value, 0) / rightParentScores.length
          : Number.POSITIVE_INFINITY;

        if (leftBarycenter !== rightBarycenter) {
          return leftBarycenter - rightBarycenter;
        }

        const leftKey = spouseGroupSortKeys.get(left);
        const rightKey = spouseGroupSortKeys.get(right);

        if (leftKey?.familyKey !== rightKey?.familyKey) {
          return (leftKey?.familyKey ?? '').localeCompare(rightKey?.familyKey ?? '');
        }

        return (leftKey?.anchorName ?? '').localeCompare(rightKey?.anchorName ?? '');
      })
      .forEach((spouseGroupId) => {
        const levelPeople = groupedPeople.get(level) ?? [];
        const spouseGroupPeople = (spouseGroupMembersById.get(spouseGroupId) ?? [])
          .map((personId) => personById.get(personId))
          .filter((person): person is PersonRecord => Boolean(person))
          .sort((left, right) => formatPersonName(left).localeCompare(formatPersonName(right)));

        orderScoreBySpouseGroupId.set(spouseGroupId, level * 1000 + (groupedPeople.get(level)?.length ?? 0));
        groupedPeople.set(level, [...levelPeople, ...spouseGroupPeople]);
      });
  });

  people.forEach((person) => {
    const level = levelBySpouseGroupId.get(spouseGroupIdsByPersonId.get(person.id) ?? person.id) ?? 0;
    if (!groupedPeople.has(level)) {
      groupedPeople.set(level, []);
    }
    if (!groupedPeople.get(level)!.some((currentPerson) => currentPerson.id === person.id)) {
      groupedPeople.get(level)!.push(person);
    }
  });

  return {
    groupedPeople,
    spouseGroupIdsByPersonId,
    spouseGroupMembersById,
    levelBySpouseGroupId,
    parentGroupIdsByChildGroupId,
    childGroupIdsByParentGroupId,
  };
}

function buildDescendantSubtree(
  people: PersonRecord[],
  relationships: RelationshipRecord[],
  rootPersonId?: string,
) {
  if (!rootPersonId) {
    return { renderedPeople: people, renderedRelationships: relationships };
  }

  const peopleById = new Map(people.map((person) => [person.id, person]));
  if (!peopleById.has(rootPersonId)) {
    return { renderedPeople: people, renderedRelationships: relationships };
  }

  const childIdsByParentId = new Map<string, Set<string>>();
  const spouseIdsByPersonId = new Map<string, Set<string>>();

  relationships.forEach((relationship) => {
    if (relationship.type === 'parent-child') {
      if (!childIdsByParentId.has(relationship.fromPersonId)) {
        childIdsByParentId.set(relationship.fromPersonId, new Set());
      }

      childIdsByParentId.get(relationship.fromPersonId)!.add(relationship.toPersonId);
      return;
    }

    if (!spouseIdsByPersonId.has(relationship.fromPersonId)) {
      spouseIdsByPersonId.set(relationship.fromPersonId, new Set());
    }
    if (!spouseIdsByPersonId.has(relationship.toPersonId)) {
      spouseIdsByPersonId.set(relationship.toPersonId, new Set());
    }

    spouseIdsByPersonId.get(relationship.fromPersonId)!.add(relationship.toPersonId);
    spouseIdsByPersonId.get(relationship.toPersonId)!.add(relationship.fromPersonId);
  });

  const lineageIds = new Set<string>([rootPersonId]);
  const queue = [rootPersonId];

  while (queue.length > 0) {
    const currentPersonId = queue.shift()!;
    const childIds = [...(childIdsByParentId.get(currentPersonId) ?? new Set<string>())].sort((left, right) => left.localeCompare(right));

    childIds.forEach((childId) => {
      if (!peopleById.has(childId) || lineageIds.has(childId)) {
        return;
      }

      lineageIds.add(childId);
      queue.push(childId);
    });
  }

  const includedIds = new Set(lineageIds);
  lineageIds.forEach((personId) => {
    (spouseIdsByPersonId.get(personId) ?? new Set<string>()).forEach((spouseId) => {
      if (peopleById.has(spouseId)) {
        includedIds.add(spouseId);
      }
    });
  });

  return {
    renderedPeople: people.filter((person) => includedIds.has(person.id)),
    renderedRelationships: relationships.filter((relationship) => {
      if (!includedIds.has(relationship.fromPersonId) || !includedIds.has(relationship.toPersonId)) {
        return false;
      }

      if (relationship.type === 'spouse') {
        return lineageIds.has(relationship.fromPersonId) || lineageIds.has(relationship.toPersonId);
      }

      return lineageIds.has(relationship.toPersonId);
    }),
  };
}

function buildAscendantSubtree(
  people: PersonRecord[],
  relationships: RelationshipRecord[],
  rootPersonId?: string,
) {
  if (!rootPersonId) {
    return { renderedPeople: people, renderedRelationships: relationships };
  }

  const peopleById = new Map(people.map((person) => [person.id, person]));
  if (!peopleById.has(rootPersonId)) {
    return { renderedPeople: people, renderedRelationships: relationships };
  }

  const parentIdsByChildId = new Map<string, Set<string>>();
  const spouseIdsByPersonId = new Map<string, Set<string>>();

  relationships.forEach((relationship) => {
    if (relationship.type === 'parent-child') {
      if (!parentIdsByChildId.has(relationship.toPersonId)) {
        parentIdsByChildId.set(relationship.toPersonId, new Set());
      }

      parentIdsByChildId.get(relationship.toPersonId)!.add(relationship.fromPersonId);
      return;
    }

    if (!spouseIdsByPersonId.has(relationship.fromPersonId)) {
      spouseIdsByPersonId.set(relationship.fromPersonId, new Set());
    }
    if (!spouseIdsByPersonId.has(relationship.toPersonId)) {
      spouseIdsByPersonId.set(relationship.toPersonId, new Set());
    }

    spouseIdsByPersonId.get(relationship.fromPersonId)!.add(relationship.toPersonId);
    spouseIdsByPersonId.get(relationship.toPersonId)!.add(relationship.fromPersonId);
  });

  const lineageIds = new Set<string>([rootPersonId]);
  const queue = [rootPersonId];

  while (queue.length > 0) {
    const currentPersonId = queue.shift()!;
    const parentIds = [...(parentIdsByChildId.get(currentPersonId) ?? new Set<string>())].sort((left, right) => left.localeCompare(right));

    parentIds.forEach((parentId) => {
      if (!peopleById.has(parentId) || lineageIds.has(parentId)) {
        return;
      }

      lineageIds.add(parentId);
      queue.push(parentId);
    });
  }

  const includedIds = new Set(lineageIds);
  lineageIds.forEach((personId) => {
    (spouseIdsByPersonId.get(personId) ?? new Set<string>()).forEach((spouseId) => {
      if (peopleById.has(spouseId)) {
        includedIds.add(spouseId);
      }
    });
  });

  return {
    renderedPeople: people.filter((person) => includedIds.has(person.id)),
    renderedRelationships: relationships.filter((relationship) => {
      if (!includedIds.has(relationship.fromPersonId) || !includedIds.has(relationship.toPersonId)) {
        return false;
      }

      if (relationship.type === 'spouse') {
        return lineageIds.has(relationship.fromPersonId) || lineageIds.has(relationship.toPersonId);
      }

      return lineageIds.has(relationship.fromPersonId);
    }),
  };
}

function FamilyTreeCanvas({
  people,
  relationships,
  onPressPerson,
  currentUserPersonId,
  initialFocusPersonId,
  descendantRootPersonId,
  ascendantRootPersonId,
  allowFullscreen = true,
  floatingControls = false,
  fillAvailableSpace = false,
}: FamilyTreeCanvasProps) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const inlineViewportHeight = Math.max(420, windowHeight - 360);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const currentPanRef = useRef({ x: 0, y: 0 });
  const dragStartPanRef = useRef({ x: 0, y: 0 });
  const gestureMovedRef = useRef(false);
  const gestureTargetPersonIdRef = useRef<string | null>(null);
  const lastAutoFitKeyRef = useRef<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inlineViewportSize, setInlineViewportSize] = useState({ width: 0, height: 0 });
  const [fullscreenViewportSize, setFullscreenViewportSize] = useState({ width: 0, height: 0 });

  const lineageMode = ascendantRootPersonId ? 'ascendant' : descendantRootPersonId ? 'descendant' : 'full';

  const { renderedPeople, renderedRelationships } = useMemo(() => {
    if (ascendantRootPersonId) {
      return buildAscendantSubtree(people, relationships, ascendantRootPersonId);
    }

    if (descendantRootPersonId) {
      return buildDescendantSubtree(people, relationships, descendantRootPersonId);
    }

    return { renderedPeople: people, renderedRelationships: relationships };
  }, [ascendantRootPersonId, descendantRootPersonId, people, relationships]);

  const peopleById = useMemo(
    () => new Map(renderedPeople.map((person) => [person.id, person])),
    [renderedPeople],
  );

  const generationLayout = useMemo(
    () => buildGenerations(renderedPeople, renderedRelationships),
    [renderedPeople, renderedRelationships],
  );

  const {
    groupedPeople,
    spouseGroupIdsByPersonId,
    spouseGroupMembersById,
    levelBySpouseGroupId,
  } = generationLayout;

  const { positionsByPersonId, canvasWidth, canvasHeight } = useMemo(() => {
    const levels = [...groupedPeople.keys()].sort((left, right) => left - right);
    const largestLevelSize = Math.max(1, ...levels.map((level) => groupedPeople.get(level)?.length ?? 0));
    const calculatedCanvasWidth = Math.max(
      320,
      PADDING * 2 + largestLevelSize * NODE_WIDTH + Math.max(0, largestLevelSize - 1) * HORIZONTAL_GAP,
    );
    const calculatedCanvasHeight = Math.max(
      240,
      PADDING * 2 + levels.length * NODE_HEIGHT + Math.max(0, levels.length - 1) * VERTICAL_GAP,
    );
    const positions = new Map<string, NodePosition>();

    levels.forEach((level) => {
      const levelPeople = groupedPeople.get(level) ?? [];
      const rowWidth = levelPeople.reduce((width, person, index) => {
        if (index === 0) {
          return NODE_WIDTH;
        }

        const previousPerson = levelPeople[index - 1];
        const gap = spouseGroupIdsByPersonId.get(previousPerson.id) === spouseGroupIdsByPersonId.get(person.id)
          ? SPOUSE_GAP
          : HORIZONTAL_GAP;

        return width + gap + NODE_WIDTH;
      }, 0);
      const startX = Math.max(PADDING, (calculatedCanvasWidth - rowWidth) / 2);
      const y = PADDING + level * (NODE_HEIGHT + VERTICAL_GAP);
      let currentX = startX;

      levelPeople.forEach((person, index) => {
        positions.set(person.id, {
          x: currentX,
          y,
        });

        const nextPerson = levelPeople[index + 1];
        if (!nextPerson) {
          return;
        }

        const gap = spouseGroupIdsByPersonId.get(person.id) === spouseGroupIdsByPersonId.get(nextPerson.id)
          ? SPOUSE_GAP
          : HORIZONTAL_GAP;
        currentX += NODE_WIDTH + gap;
      });
    });

    return {
      positionsByPersonId: positions,
      canvasWidth: calculatedCanvasWidth,
      canvasHeight: calculatedCanvasHeight,
    };
  }, [groupedPeople, spouseGroupIdsByPersonId]);

  const { spouseSegments, parentChildPaths } = useMemo(() => {
    const groupBoundsById = new Map<string, { left: number; right: number; centerX: number; topY: number; bottomY: number }>();

    spouseGroupMembersById.forEach((memberIds, spouseGroupId) => {
      const positions = memberIds
        .map((personId) => positionsByPersonId.get(personId))
        .filter((position): position is NodePosition => Boolean(position));

      if (positions.length === 0) {
        return;
      }

      const left = Math.min(...positions.map((position) => position.x));
      const right = Math.max(...positions.map((position) => position.x + NODE_WIDTH));
      const topY = Math.min(...positions.map((position) => position.y));
      const bottomY = Math.max(...positions.map((position) => position.y + NODE_HEIGHT));

      groupBoundsById.set(spouseGroupId, {
        left,
        right,
        centerX: (left + right) / 2,
        topY,
        bottomY,
      });
    });

    const obstacles: ObstacleBox[] = [...positionsByPersonId.values()].map(pos => ({
      x: pos.x,
      y: pos.y,
      w: NODE_WIDTH,
      h: NODE_HEIGHT
    }));

    const spouseSegments: TreeConnectorPath[] = renderedRelationships
      .filter((relationship) => relationship.type === 'spouse')
      .map((relationship) => {
        const fromPosition = positionsByPersonId.get(relationship.fromPersonId);
        const toPosition = positionsByPersonId.get(relationship.toPersonId);

        if (!fromPosition || !toPosition) {
          return null;
        }

        const isLeftRight = fromPosition.x < toPosition.x;
        const leftPerson = isLeftRight ? fromPosition : toPosition;
        const rightPerson = isLeftRight ? toPosition : fromPosition;
        const isAdjacent = Math.abs(rightPerson.x - leftPerson.x) <= NODE_WIDTH + SPOUSE_GAP + 5;
        
        let pathD = '';
        if (isAdjacent) {
          pathD = `M ${leftPerson.x + NODE_WIDTH} ${leftPerson.y + NODE_HEIGHT / 2} L ${rightPerson.x} ${rightPerson.y + NODE_HEIGHT / 2}`;
        } else {
          // Route above the nodes to avoid passing through other spouses
          const startX = leftPerson.x + NODE_WIDTH / 2;
          const endX = rightPerson.x + NODE_WIDTH / 2;
          const yTop = leftPerson.y - 14;
          pathD = `M ${startX} ${leftPerson.y} L ${startX} ${yTop} L ${endX} ${yTop} L ${endX} ${rightPerson.y}`;
          pathD = applyRoundedCorners(pathD, 12);
        }

        return {
          key: relationship.id,
          d: pathD,
          stroke: theme.colors.secondary,
          strokeWidth: 4,
        } satisfies TreeConnectorPath;
      })
      .filter((segment): segment is TreeConnectorPath => Boolean(segment));

    const familyConnectionsByChildLevel = new Map<number, Array<{ parentGroupId: string; childPersonIds: string[] }>>();

    renderedRelationships.forEach((relationship) => {
      if (relationship.type !== 'parent-child') {
        return;
      }

      const parentGroupId = spouseGroupIdsByPersonId.get(relationship.fromPersonId) ?? relationship.fromPersonId;
      const childGroupId = spouseGroupIdsByPersonId.get(relationship.toPersonId) ?? relationship.toPersonId;
      const childLevel = levelBySpouseGroupId.get(childGroupId);

      if (typeof childLevel !== 'number') {
        return;
      }

      if (!familyConnectionsByChildLevel.has(childLevel)) {
        familyConnectionsByChildLevel.set(childLevel, []);
      }

      const levelEntries = familyConnectionsByChildLevel.get(childLevel)!;
      let entry = levelEntries.find((currentEntry) => currentEntry.parentGroupId === parentGroupId);

      if (!entry) {
        entry = { parentGroupId, childPersonIds: [] };
        levelEntries.push(entry);
      }

      if (!entry.childPersonIds.includes(relationship.toPersonId)) {
        entry.childPersonIds.push(relationship.toPersonId);
      }
    });

    const parentChildPaths: TreeConnectorPath[] = [];

    [...familyConnectionsByChildLevel.entries()]
      .sort(([leftLevel], [rightLevel]) => leftLevel - rightLevel)
      .forEach(([childLevel, familyEntries]) => {
        familyEntries
          .sort((left, right) => {
            const leftBounds = groupBoundsById.get(left.parentGroupId);
            const rightBounds = groupBoundsById.get(right.parentGroupId);
            return (leftBounds?.centerX ?? 0) - (rightBounds?.centerX ?? 0);
          })
          .forEach((entry, index) => {
            const parentBounds = groupBoundsById.get(entry.parentGroupId);
            const childCenters = entry.childPersonIds
              .map((personId) => positionsByPersonId.get(personId))
              .filter((position): position is NodePosition => Boolean(position))
              .map((position) => ({ x: position.x + NODE_WIDTH / 2, topY: position.y }))
              .sort((left, right) => left.x - right.x);

            if (!parentBounds || childCenters.length === 0) {
              return;
            }

            const parentBottomY = parentBounds.bottomY;
            const childTopY = Math.min(...childCenters.map((child) => child.topY));
            const availableBand = Math.max(18, childTopY - parentBottomY - 18);
            const laneStep = Math.max(10, Math.min(18, availableBand / Math.max(2, familyEntries.length + 1)));
            const junctionY = Math.min(childTopY - 10, parentBottomY + 10 + index * laneStep);
            const parentCenterX = parentBounds.centerX;

            parentChildPaths.push({
              key: `child-${childLevel}-${entry.parentGroupId}`,
              d: createTreeBranchPath(parentCenterX, parentBottomY, junctionY, childCenters, obstacles),
              stroke: theme.colors.primary,
              strokeWidth: 3,
            });
          });
      });

    return { spouseSegments, parentChildPaths };
  }, [levelBySpouseGroupId, positionsByPersonId, renderedRelationships, spouseGroupIdsByPersonId, spouseGroupMembersById, theme.colors.primary, theme.colors.secondary]);

  const effectiveInitialFocusPersonId = useMemo(() => {
    if (initialFocusPersonId && positionsByPersonId.has(initialFocusPersonId)) {
      return initialFocusPersonId;
    }

    if (ascendantRootPersonId && positionsByPersonId.has(ascendantRootPersonId)) {
      return ascendantRootPersonId;
    }

    if (descendantRootPersonId && positionsByPersonId.has(descendantRootPersonId)) {
      return descendantRootPersonId;
    }

    return renderedPeople[0]?.id;
  }, [ascendantRootPersonId, descendantRootPersonId, initialFocusPersonId, positionsByPersonId, renderedPeople]);

  const controlsLabel = lineageMode === 'ascendant'
    ? 'Drag to pan through earlier generations and zoom to follow parents and grandparents.'
    : lineageMode === 'descendant'
      ? 'Drag to pan through this family branch and zoom to follow younger generations.'
      : 'Drag to pan, use zoom controls to focus on branches.';
  const fullscreenTitle = lineageMode === 'ascendant'
    ? 'Full-screen ascendant tree'
    : lineageMode === 'descendant'
      ? 'Full-screen descendant tree'
      : 'Full-screen family tree';
  const fullscreenSubtitle = lineageMode === 'ascendant'
    ? 'Pan through this family member’s parents and grandparents and zoom into earlier generations in more detail.'
    : lineageMode === 'descendant'
      ? 'Pan through this family member’s descendants and zoom into each generation in more detail.'
      : 'Pan around the full tree and zoom into branches in more detail.';

  const clampPanPoint = (desiredPan: { x: number; y: number }, targetScale: number) => {
    const activeSize = isFullscreen ? fullscreenViewportSize : inlineViewportSize;
    if (activeSize.width <= 0 || activeSize.height <= 0) {
      return desiredPan;
    }

    const safeScale = targetScale || 1;
    const scaledCanvasWidth = canvasWidth * safeScale;
    const scaledCanvasHeight = canvasHeight * safeScale;
    const centeredTranslateX = (activeSize.width - scaledCanvasWidth) / 2;
    const centeredTranslateY = (activeSize.height - scaledCanvasHeight) / 2;
    const horizontalFreePanPadding = scaledCanvasWidth <= activeSize.width
      ? Math.max(FREE_PAN_PADDING, activeSize.width * 0.35)
      : FREE_PAN_PADDING;
    const verticalFreePanPadding = scaledCanvasHeight <= activeSize.height
      ? Math.max(FREE_PAN_PADDING, activeSize.height * 0.35)
      : FREE_PAN_PADDING;
    const minTranslateX = scaledCanvasWidth <= activeSize.width
      ? centeredTranslateX - horizontalFreePanPadding
      : activeSize.width - scaledCanvasWidth - horizontalFreePanPadding;
    const maxTranslateX = scaledCanvasWidth <= activeSize.width
      ? centeredTranslateX + horizontalFreePanPadding
      : horizontalFreePanPadding;
    const minTranslateY = scaledCanvasHeight <= activeSize.height
      ? centeredTranslateY - verticalFreePanPadding
      : activeSize.height - scaledCanvasHeight - verticalFreePanPadding;
    const maxTranslateY = scaledCanvasHeight <= activeSize.height
      ? centeredTranslateY + verticalFreePanPadding
      : verticalFreePanPadding;

    return {
      x: Math.min(maxTranslateX / safeScale, Math.max(minTranslateX / safeScale, desiredPan.x)),
      y: Math.min(maxTranslateY / safeScale, Math.max(minTranslateY / safeScale, desiredPan.y)),
    };
  };

  const clampCurrentPanToViewport = (targetScale: number) => {
    pan.stopAnimation((value) => {
      const nextPan = clampPanPoint(value, targetScale);
      currentPanRef.current = nextPan;
      pan.setValue(nextPan);
    });
  };

  const setPanPosition = (nextPan: { x: number; y: number }) => {
    currentPanRef.current = nextPan;
    pan.setValue(nextPan);
  };

  const getCanvasCoordinatesFromViewportPoint = (locationX: number, locationY: number) => {
    const centerOffsetX = (canvasWidth * (1 - scale)) / 2;
    const centerOffsetY = (canvasHeight * (1 - scale)) / 2;

    return {
      x: (locationX - centerOffsetX) / scale - currentPanRef.current.x,
      y: (locationY - centerOffsetY) / scale - currentPanRef.current.y,
    };
  };

  const getPersonAtViewportPoint = (locationX: number, locationY: number) => {
    const canvasPoint = getCanvasCoordinatesFromViewportPoint(locationX, locationY);

    return renderedPeople.find((person) => {
      const position = positionsByPersonId.get(person.id);
      if (!position) {
        return false;
      }

      const HitSlop = 6;
      return canvasPoint.x >= position.x - HitSlop
        && canvasPoint.x <= position.x + NODE_WIDTH + HitSlop
        && canvasPoint.y >= position.y - HitSlop
        && canvasPoint.y <= position.y + NODE_HEIGHT + HitSlop;
    }) ?? null;
  };

  const handleWheelPan = (event: any) => {
    if (Platform.OS !== 'web') {
      return;
    }

    const nativeEvent = event?.nativeEvent ?? event;
    const deltaX = Number(nativeEvent?.deltaX ?? 0);
    const deltaY = Number(nativeEvent?.deltaY ?? 0);
    const ctrlKey = Boolean(nativeEvent?.ctrlKey);
    const metaKey = Boolean(nativeEvent?.metaKey);

    if (!deltaX && !deltaY) {
      return;
    }

    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (ctrlKey || metaKey) {
      handleZoom(deltaY < 0 ? 0.12 : -0.12);
      return;
    }

    pan.stopAnimation((value) => {
      const nextPan = clampPanPoint({
        x: value.x - deltaX / scale,
        y: value.y - deltaY / scale,
      }, scale);
      currentPanRef.current = nextPan;
      pan.setValue(nextPan);
    });
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => (
        Math.abs(gestureState.dx) > DRAG_ACTIVATION_DISTANCE
        || Math.abs(gestureState.dy) > DRAG_ACTIVATION_DISTANCE
      ),
      onMoveShouldSetPanResponderCapture: (_, gestureState) => (
        Math.abs(gestureState.dx) > DRAG_ACTIVATION_DISTANCE
        || Math.abs(gestureState.dy) > DRAG_ACTIVATION_DISTANCE
      ),
      onPanResponderGrant: (event) => {
        gestureMovedRef.current = false;

        // On Web, nativeEvent.locationX can occasionally misreport or be relative to window
        // if nested deeply. offsetX/offsetY are standard DOM properties that are robust here.
        const pointX = (event.nativeEvent as any).offsetX ?? event.nativeEvent.locationX;
        const pointY = (event.nativeEvent as any).offsetY ?? event.nativeEvent.locationY;

        gestureTargetPersonIdRef.current = getPersonAtViewportPoint(pointX, pointY)?.id ?? null;

        pan.stopAnimation((value) => {
          dragStartPanRef.current = value;
          currentPanRef.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        if (!gestureMovedRef.current) {
          gestureMovedRef.current = Math.abs(gestureState.dx) > DRAG_ACTIVATION_DISTANCE
            || Math.abs(gestureState.dy) > DRAG_ACTIVATION_DISTANCE;
        }

        const desiredPan = {
          x: dragStartPanRef.current.x + (gestureState.dx / scale),
          y: dragStartPanRef.current.y + (gestureState.dy / scale),
        };
        setPanPosition(clampPanPoint(desiredPan, scale));
      },
      onPanResponderRelease: () => {
        if (!gestureMovedRef.current && gestureTargetPersonIdRef.current) {
          const person = peopleById.get(gestureTargetPersonIdRef.current);
          if (person) {
            onPressPerson(person);
          }
        }

        gestureTargetPersonIdRef.current = null;
        clampCurrentPanToViewport(scale);
      },
      onPanResponderTerminate: () => {
        gestureTargetPersonIdRef.current = null;
        clampCurrentPanToViewport(scale);
      },
      onPanResponderTerminationRequest: () => false,
    }),
    [canvasHeight, canvasWidth, fullscreenViewportSize, getPersonAtViewportPoint, inlineViewportSize, isFullscreen, onPressPerson, pan, peopleById, scale],
  );

  const handleZoom = (delta: number) => {
    let nextScale = scale;
    setScale((current) => {
      nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((current + delta).toFixed(2))));
      return nextScale;
    });

    requestAnimationFrame(() => {
      clampCurrentPanToViewport(nextScale);
    });
  };

  const applyFitTransform = (viewportWidth: number, viewportHeight: number, focusPersonId?: string) => {
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    const paddedViewportWidth = Math.max(120, viewportWidth - VIEWPORT_PADDING * 2);
    const paddedViewportHeight = Math.max(120, viewportHeight - VIEWPORT_PADDING * 2);
    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(
        MIN_SCALE,
        Math.min(paddedViewportWidth / canvasWidth, paddedViewportHeight / canvasHeight),
      ),
    );

    const scaledCanvasWidth = canvasWidth * nextScale;
    const scaledCanvasHeight = canvasHeight * nextScale;
    const centeredTranslateX = (viewportWidth - scaledCanvasWidth) / 2;
    const centeredTranslateY = (viewportHeight - scaledCanvasHeight) / 2;
    const focusedPosition = focusPersonId ? positionsByPersonId.get(focusPersonId) : null;
    const desiredTranslateX = focusedPosition
      ? viewportWidth / 2 - (focusedPosition.x + NODE_WIDTH / 2) * nextScale
      : centeredTranslateX;
    const desiredTranslateY = focusedPosition
      ? viewportHeight / 2 - (focusedPosition.y + NODE_HEIGHT / 2) * nextScale
      : centeredTranslateY;

    const minTranslateX = scaledCanvasWidth <= viewportWidth ? centeredTranslateX : viewportWidth - scaledCanvasWidth;
    const maxTranslateX = scaledCanvasWidth <= viewportWidth ? centeredTranslateX : 0;
    const minTranslateY = scaledCanvasHeight <= viewportHeight ? centeredTranslateY : viewportHeight - scaledCanvasHeight;
    const maxTranslateY = scaledCanvasHeight <= viewportHeight ? centeredTranslateY : 0;
    const clampedTranslateX = Math.min(maxTranslateX, Math.max(minTranslateX, desiredTranslateX));
    const clampedTranslateY = Math.min(maxTranslateY, Math.max(minTranslateY, desiredTranslateY));
    const safeScale = nextScale || 1;

    setScale(nextScale);
    pan.setOffset({ x: 0, y: 0 });
    const nextPan = {
      x: clampedTranslateX / safeScale,
      y: clampedTranslateY / safeScale,
    };
    currentPanRef.current = nextPan;
    pan.setValue(nextPan);
  };

  const resetView = () => {
    const activeViewportSize = isFullscreen ? fullscreenViewportSize : inlineViewportSize;
    applyFitTransform(activeViewportSize.width, activeViewportSize.height);
  };

  const activeViewportSize = isFullscreen ? fullscreenViewportSize : inlineViewportSize;

  useEffect(() => {
    if (activeViewportSize.width <= 0 || activeViewportSize.height <= 0) {
      return;
    }

    const autoFitKey = [
      isFullscreen ? 'fullscreen' : 'inline',
      activeViewportSize.width,
      activeViewportSize.height,
      canvasWidth,
      canvasHeight,
      effectiveInitialFocusPersonId ?? '',
    ].join(':');

    if (lastAutoFitKeyRef.current === autoFitKey) {
      return;
    }

    applyFitTransform(activeViewportSize.width, activeViewportSize.height, effectiveInitialFocusPersonId);
    lastAutoFitKeyRef.current = autoFitKey;
  }, [
    activeViewportSize.height,
    activeViewportSize.width,
    canvasHeight,
    canvasWidth,
    effectiveInitialFocusPersonId,
    isFullscreen,
    positionsByPersonId,
  ]);

  const handleViewportLayout = (mode: 'inline' | 'fullscreen') => (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const nextSize = { width, height };

    if (mode === 'fullscreen') {
      setFullscreenViewportSize((current) => (current.width === width && current.height === height ? current : nextSize));
      return;
    }

    setInlineViewportSize((current) => (current.width === width && current.height === height ? current : nextSize));
  };

  const renderFloatingControls = (mode: 'inline' | 'fullscreen') => (
    <View pointerEvents="box-none" style={styles.viewportOverlay}>
      <View style={[styles.floatingHintCard, { backgroundColor: theme.colors.backdrop }]}>
        <Text variant="bodySmall" style={[styles.floatingHintText, { color: theme.colors.onPrimary }]}>{controlsLabel}</Text>
      </View>

      <View style={[styles.floatingControlsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <Chip compact icon="magnify">{scale.toFixed(1)}x</Chip>
        <IconButton icon="minus" size={18} mode="contained-tonal" onPress={() => handleZoom(-0.15)} />
        <IconButton icon="plus" size={18} mode="contained-tonal" onPress={() => handleZoom(0.15)} />
        <Button compact mode="contained-tonal" onPress={resetView}>
          Reset
        </Button>
        {allowFullscreen ? (
          mode === 'fullscreen' ? (
            <Button compact mode="contained" icon="close" onPress={() => setIsFullscreen(false)}>
              Close
            </Button>
          ) : (
            <Button compact mode="contained" icon="fullscreen" onPress={() => setIsFullscreen(true)}>
              Fullscreen
            </Button>
          )
        ) : null}
      </View>
    </View>
  );

  const renderCanvasViewport = (mode: 'inline' | 'fullscreen', viewportStyle?: object) => (
    <View
      {...(Platform.OS === 'web' ? ({ onWheel: handleWheelPan } as any) : {})}
      style={[
        styles.viewport,
        { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.elevation.level1 },
        viewportStyle,
      ]}
      onLayout={handleViewportLayout(mode)}
    >
      <Animated.View
        style={[
          styles.canvas,
          {
            width: canvasWidth,
            height: canvasHeight,
            backgroundColor: theme.colors.elevation.level1,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale },
            ],
          },
        ]}
      >
        <Svg width={canvasWidth} height={canvasHeight} style={[StyleSheet.absoluteFill, { zIndex: -1 }]}>
          {parentChildPaths.map((connector) => (
            <Path
              key={connector.key}
              d={connector.d}
              fill="none"
              stroke={connector.stroke}
              strokeWidth={connector.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {spouseSegments.map((segment) => (
            <Path
              key={segment.key}
              d={segment.d}
              fill="none"
              stroke={segment.stroke}
              strokeWidth={segment.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>

        {renderedPeople.map((person) => {
          const position = positionsByPersonId.get(person.id);
          const preferredPhoto = getPreferredPersonPhoto(person);
          const isCurrentUsersPerson = currentUserPersonId === person.id;
          if (!position) {
            return null;
          }

          return (
            <View
              key={person.id}
              style={[
                styles.node,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outlineVariant,
                },
                {
                  left: position.x,
                  top: position.y,
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                },
              ]}
            >
              {isCurrentUsersPerson ? (
                <View style={[styles.nodeBadge, { backgroundColor: theme.colors.primary }]}>
                  <Text variant="labelSmall" style={[styles.nodeBadgeText, { color: theme.colors.onPrimary }]}>You</Text>
                </View>
              ) : null}
              <View style={styles.nodeInnerRow}>
                <View style={styles.nodeAvatarWrap}>
                  {preferredPhoto ? (
                    <Image source={{ uri: preferredPhoto.url }} style={styles.nodeAvatar} />
                  ) : (
                    <View style={[styles.nodeAvatarFallback, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceVariant }]}>
                      <MaterialCommunityIcons name={getPersonFallbackAvatarIcon(person)} size={28} color={theme.colors.primary} />
                    </View>
                  )}
                </View>
                <View style={styles.nodeTextWrap}>
                  <Text variant="titleSmall" style={styles.nodeTitle} numberOfLines={2}>
                    {formatPersonName(person)}
                  </Text>
                  <Text variant="bodySmall" style={[styles.nodeMeta, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                    {getPersonLifeSpanLabel(person)}
                  </Text>
                  <Text variant="bodySmall" style={[styles.nodeMeta, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                    {getPersonPresenceLabel(person)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </Animated.View>

      <View
        {...panResponder.panHandlers}
        style={[
          styles.gestureLayer,
          Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as any) : null,
        ]}
      />

      {floatingControls ? renderFloatingControls(mode) : null}
    </View>
  );

  return (
    <View style={[styles.container, fillAvailableSpace ? styles.containerFill : null]}>
      {!floatingControls ? (
        <View style={styles.controlsRow}>
          <Text variant="bodyMedium">{controlsLabel}</Text>
          <View style={styles.zoomButtonsRow}>
            <Chip compact icon="magnify-minus">{scale.toFixed(1)}x</Chip>
            <Button compact mode="outlined" onPress={() => handleZoom(-0.15)}>
              -
            </Button>
            <Button compact mode="outlined" onPress={() => handleZoom(0.15)}>
              +
            </Button>
            <Button compact onPress={resetView}>Reset</Button>
            {allowFullscreen ? <Button compact mode="contained-tonal" icon="fullscreen" onPress={() => setIsFullscreen(true)}>Fullscreen</Button> : null}
          </View>
        </View>
      ) : null}

      {renderCanvasViewport('inline', fillAvailableSpace ? styles.inlineViewportFill : { height: inlineViewportHeight })}

      <Modal visible={isFullscreen} animationType="slide" onRequestClose={() => setIsFullscreen(false)}>
        <View style={[styles.fullscreenContainer, { backgroundColor: theme.colors.background }]}>
          {floatingControls ? (
            renderCanvasViewport('fullscreen', styles.fullscreenViewport)
          ) : (
            <>
              <View style={styles.fullscreenHeader}>
                <Text variant="titleLarge">{fullscreenTitle}</Text>
                <IconButton icon="close" onPress={() => setIsFullscreen(false)} />
              </View>
              <Text variant="bodyMedium" style={[styles.fullscreenSubtitle, { color: theme.colors.onSurfaceVariant }]}>{fullscreenSubtitle}</Text>
              {renderCanvasViewport('fullscreen', { height: Math.max(320, windowHeight - 172), borderRadius: 5 })}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

export default React.memo(FamilyTreeCanvas);
