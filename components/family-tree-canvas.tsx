// Optimized FamilyTreeCanvas
// ---------------------------------------------------------------------------
// Improvements over the original:
//   1. Tidy-tree layout (Walker) keyed by spouse-group  → no card overlap.
//   2. Lane-allocated orthogonal connectors             → no line overlap.
//   3. Viewport culling                                  → unlimited nodes.
//   4. Per-node `Pressable`                              → reliable taps at
//      any zoom level (no manual hit-testing math).
//   5. Gesture Handler + Reanimated pan/pinch            → smooth mobile zoom.
//   6. Cursor / pinch-anchored zoom                      → focus stays put.
//   7. Viewport culling + large-tree mode                → lower memory use.
//
// Uses react-native-svg/react-native-paper plus Gesture Handler, Reanimated,
// and expo-image for the high-traffic rendering paths.
// ---------------------------------------------------------------------------

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import { translate } from '../i18n';
import { I18N_KEYS as K } from '../i18n/keys';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import type { PersonRecord } from './dto/person';
import {
  getPersonFallbackAvatarIcon,
  getPersonLifeSpanLabel,
  getPersonPresenceLabel,
  getDisplayPersonPhoto,
} from './dto/person';
import type { RelationshipRecord } from './dto/relationship';
import { GlobalStyles } from '../constants/styles';

import { layoutFamilyTree } from './family-tree-layout';
import { buildConnectors } from './family-tree-connectors';
import {
  Connector,
  DEFAULT_LAYOUT_CONSTANTS,
  LayoutConstants,
} from './family-tree-types';
import {
  buildSurnameClusters,
  extractSurname,
  filterForActiveSurnames,
  findCrossSurnameChildren,
  findMaidenNameMembers,
  getSortedSurnames,
} from './family-tree-surname-clusters';
import { useI18n } from '../hooks/use-i18n';
import CachedImage from './cached-image';

const styles = GlobalStyles.familyTreeCanvas;

// ---- Tunables ----
const C: LayoutConstants = DEFAULT_LAYOUT_CONSTANTS;
const MIN_SCALE = 0.05;
const MAX_SCALE = 1.8;
const AUTO_FIT_MAX_SCALE = 0.8; // default zoom cap on initial fit
const AUTO_FIT_MIN_SCALE_INLINE = 0.7;
const AUTO_FIT_MIN_SCALE_FULLSCREEN = 0.7;
const DRAG_ACTIVATION_DISTANCE = 6; // screen px — independent of zoom
const VIEWPORT_PADDING = 24;
const CONTENT_BOUNDARY_PADDING = 80; // canvas px of extra pan room around the tree
const CULL_PADDING = 320; // px around viewport in canvas-space
const VIEWPORT_COMMIT_INTERVAL_MS = 48;
const LARGE_TREE_NODE_THRESHOLD = 140;
const LARGE_TREE_CONNECTOR_THRESHOLD = 220;
// ------------------

interface FamilyTreeCanvasProps {
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  currentTreeId?: string;
  onPressPerson: (person: PersonRecord) => void;
  currentUserPersonId?: string;
  highlightedPersonId?: string;
  initialFocusPersonId?: string;
  descendantRootPersonId?: string;
  ascendantRootPersonId?: string;
  showMaidenFamilyInNodeTitle?: boolean;
  allowFullscreen?: boolean;
  floatingControls?: boolean;
  fillAvailableSpace?: boolean;
  showControls?: boolean;
  disableSurnameClustering?: boolean;
  inlineViewportHeight?: number;
  /**
   * Optional ref that gets populated with the canvas's internal
   * navigateToSurname function, allowing a parent dialog to trigger
   * a family-cluster switch from outside the canvas.
   */
  familySwitchRef?: React.MutableRefObject<((surname: string) => void) | null>;
  /**
   * Optional ref kept in sync with the currently viewed surname cluster.
   * Lets parent components read which family is on screen (e.g. to decide
   * which alternative family to offer in a Quick-Actions dialog).
   */
  activeFamilyRef?: React.MutableRefObject<string | null>;
}

function formatPersonName(person: PersonRecord) {
  return [person.firstName, person.middleNames ?? '', person.lastName].join(' ').replace(/\s+/g, ' ').trim();
}

function formatPersonNodeTitle(person: PersonRecord, showMaidenFamilyInNodeTitle: boolean) {
  const name = formatPersonName(person);
  if (!showMaidenFamilyInNodeTitle || !person.maidenName?.trim()) {
    return name;
  }

  return name ? `${name} (${person.maidenName.trim()})` : `(${person.maidenName.trim()})`;
}

type PositionedPerson = {
  person: PersonRecord;
  x: number;
  y: number;
  bounds: { x: number; y: number; w: number; h: number };
};

type CanvasBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

const MAX_TREE_CACHE_ENTRIES = 12;
const layoutCache = new Map<string, ReturnType<typeof layoutFamilyTree>>();
const connectorCache = new Map<string, ReturnType<typeof buildConnectors>>();
const objectIdentityMap = new WeakMap<object, number>();
let nextObjectIdentity = 1;

function getCachedValue<T>(cache: Map<string, T>, key: string, compute: () => T) {
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key);
    cache.set(key, existing);
    return existing;
  }

  const nextValue = compute();
  cache.set(key, nextValue);
  if (cache.size > MAX_TREE_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  return nextValue;
}

function getObjectIdentity(value: object) {
  const existingIdentity = objectIdentityMap.get(value);
  if (existingIdentity) {
    return existingIdentity;
  }

  const nextIdentity = nextObjectIdentity;
  nextObjectIdentity += 1;
  objectIdentityMap.set(value, nextIdentity);
  return nextIdentity;
}

function clampCanvasPan(
  panX: number,
  panY: number,
  scaleValue: number,
  viewportWidth: number,
  viewportHeight: number,
  bounds: CanvasBounds,
  boundaryPadding = 0,
) {
  'worklet';
  if (viewportWidth <= 0 || viewportHeight <= 0 || scaleValue <= 0) {
    return { x: panX, y: panY };
  }

  const viewportWidthInCanvas = viewportWidth / scaleValue;
  const viewportHeightInCanvas = viewportHeight / scaleValue;

  const minPanX = viewportWidthInCanvas - bounds.maxX - boundaryPadding;
  const maxPanX = -bounds.minX + boundaryPadding;
  const minPanY = viewportHeightInCanvas - bounds.maxY - boundaryPadding;
  const maxPanY = -bounds.minY + boundaryPadding;

  const clampedX = minPanX > maxPanX
    ? (viewportWidthInCanvas - (bounds.minX + bounds.maxX)) / 2
    : Math.min(maxPanX, Math.max(minPanX, panX));
  const clampedY = minPanY > maxPanY
    ? (viewportHeightInCanvas - (bounds.minY + bounds.maxY)) / 2
    : Math.min(maxPanY, Math.max(minPanY, panY));

  return { x: clampedX, y: clampedY };
}

// ---------------------------------------------------------------------------
// Subtree filtering (descendant / ascendant lineage) — preserved from original
// ---------------------------------------------------------------------------
function buildLineageSubtree(
    people: PersonRecord[],
    relationships: RelationshipRecord[],
    rootPersonId: string | undefined,
    direction: 'descendant' | 'ascendant',
) {
  if (!rootPersonId) return { renderedPeople: people, renderedRelationships: relationships };
  const peopleById = new Map(people.map((p) => [p.id, p]));
  if (!peopleById.has(rootPersonId)) return { renderedPeople: people, renderedRelationships: relationships };

  const linkMap = new Map<string, Set<string>>();
  const spouseMap = new Map<string, Set<string>>();

  relationships.forEach((r) => {
    if (r.type === 'parent-child') {
      const from = direction === 'descendant' ? r.fromPersonId : r.toPersonId;
      const to = direction === 'descendant' ? r.toPersonId : r.fromPersonId;
      if (!linkMap.has(from)) linkMap.set(from, new Set());
      linkMap.get(from)!.add(to);
    } else {
      [r.fromPersonId, r.toPersonId].forEach((id) => { if (!spouseMap.has(id)) spouseMap.set(id, new Set()); });
      spouseMap.get(r.fromPersonId)!.add(r.toPersonId);
      spouseMap.get(r.toPersonId)!.add(r.fromPersonId);
    }
  });

  const lineage = new Set<string>([rootPersonId]);
  const queue = [rootPersonId];
  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const cur = queue[queueIndex];
    (linkMap.get(cur) ?? new Set()).forEach((next) => {
      if (peopleById.has(next) && !lineage.has(next)) {
        lineage.add(next);
        queue.push(next);
      }
    });
  }

  const included = new Set(lineage);
  lineage.forEach((id) => (spouseMap.get(id) ?? new Set()).forEach((s) => peopleById.has(s) && included.add(s)));

  return {
    renderedPeople: people.filter((p) => included.has(p.id)),
    renderedRelationships: relationships.filter((r) => {
      if (!included.has(r.fromPersonId) || !included.has(r.toPersonId)) return false;
      if (r.type === 'spouse') return lineage.has(r.fromPersonId) || lineage.has(r.toPersonId);
      return direction === 'descendant' ? lineage.has(r.toPersonId) : lineage.has(r.fromPersonId);
    }),
  };
}

function countLineageGenerations(
  people: PersonRecord[],
  relationships: RelationshipRecord[],
  rootPersonId: string | undefined,
  direction: 'descendant' | 'ascendant',
) {
  if (!rootPersonId) {
    return 0;
  }

  const peopleById = new Map(people.map((person) => [person.id, person]));
  if (!peopleById.has(rootPersonId)) {
    return 0;
  }

  const linkMap = new Map<string, Set<string>>();
  relationships.forEach((relationship) => {
    if (relationship.type !== 'parent-child') {
      return;
    }

    const from = direction === 'descendant' ? relationship.fromPersonId : relationship.toPersonId;
    const to = direction === 'descendant' ? relationship.toPersonId : relationship.fromPersonId;
    if (!linkMap.has(from)) {
      linkMap.set(from, new Set());
    }
    linkMap.get(from)!.add(to);
  });

  const lineage = new Set<string>([rootPersonId]);
  const queue = [rootPersonId];
  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const current = queue[queueIndex];
    (linkMap.get(current) ?? new Set()).forEach((next) => {
      if (peopleById.has(next) && !lineage.has(next)) {
        lineage.add(next);
        queue.push(next);
      }
    });
  }

  return Math.max(0, lineage.size - 1);
}

// ---------------------------------------------------------------------------
// Memoized PersonNode — wrapped in Pressable so taps work at any zoom level
// ---------------------------------------------------------------------------
type PersonNodeProps = {
  person: PersonRecord;
  x: number;
  y: number;
  showMaidenFamilyInNodeTitle: boolean;
  isCurrentUser: boolean;
  isFocusedPerson: boolean;
  isGhost: boolean;
  isCrossSurnameChild: boolean;
  isMaidenNameMember: boolean;
  surfaceColor: string;
  outlineColor: string;
  primaryColor: string;
  tertiaryColor: string;
  onTertiaryColor: string;
  variantSurface: string;
  variantOnSurface: string;
  onPrimaryColor: string;
  deferPhoto: boolean;
  compactDetails: boolean;
  onPress: (person: PersonRecord) => void;
};
const PersonNode = React.memo(function PersonNode(props: PersonNodeProps) {
  const {
    person, x, y, showMaidenFamilyInNodeTitle, isCurrentUser, isFocusedPerson, isGhost, isCrossSurnameChild, isMaidenNameMember,
    surfaceColor, outlineColor, primaryColor, tertiaryColor, onTertiaryColor,
    variantSurface, variantOnSurface, onPrimaryColor,
    deferPhoto, compactDetails,
    onPress,
  } = props;
  const photo = getDisplayPersonPhoto(person);

  const handlePress = useCallback(() => {
    onPress(person);
  }, [person, onPress]);

  const isHighlighted = isMaidenNameMember || isCrossSurnameChild || isFocusedPerson;
  const borderColor = isFocusedPerson
    ? primaryColor
    : isHighlighted
    ? tertiaryColor
    : isGhost
    ? primaryColor
    : outlineColor;
  const borderWidth = isFocusedPerson ? 2.5 : isHighlighted ? 2 : 1;

  const badgeLabel = isMaidenNameMember
    ? `${person.maidenName!.trim()}`
    : isCrossSurnameChild
    ? '⬡ Mixed'
    : null;

  return (
      <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={formatPersonNodeTitle(person, showMaidenFamilyInNodeTitle)}
          accessibilityState={{ selected: isFocusedPerson }}
          hitSlop={6}
          style={({ pressed }) => [
            styles.node,
            {
              backgroundColor: surfaceColor,
              borderColor,
              borderWidth,
              borderStyle: isGhost ? 'dashed' as const : 'solid' as const,
              left: x,
              top: y,
              width: C.NODE_WIDTH,
              height: C.NODE_HEIGHT,
              opacity: pressed ? 0.85 : isGhost ? 0.7 : 1,
              ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
            },
          ]}
      >
        {isCurrentUser ? (
            <View style={[styles.nodeBadge, { backgroundColor: primaryColor }]}>
              <Text variant="labelSmall" style={[styles.nodeBadgeText, { color: onPrimaryColor }]}>{translate(K.common.you)}</Text>
            </View>
        ) : isFocusedPerson ? (
            <View style={[styles.nodeBadge, { backgroundColor: primaryColor }]}>
              <Text variant="labelSmall" style={[styles.nodeBadgeText, { color: onPrimaryColor }]}>{translate(K.common.open)}</Text>
            </View>
        ) : badgeLabel ? (
            <View style={[styles.nodeBadge, { backgroundColor: tertiaryColor }]}>
              <Text variant="labelSmall" style={[styles.nodeBadgeText, { color: onTertiaryColor }]} numberOfLines={1}>{badgeLabel}</Text>
            </View>
        ) : null}
        <View style={styles.nodeInnerRow}>
          <View style={styles.nodeAvatarColumn}>
            <View style={styles.nodeAvatarWrap}>
              {photo && !deferPhoto ? (
                <CachedImage
                  uri={photo.url}
                  style={styles.nodeAvatar}
                  priority="low"
                  recyclingKey={`${person.id}:${photo.id}`}
                />
              ) : (
                <View style={[styles.nodeAvatarFallback, { borderColor: outlineColor, backgroundColor: variantSurface }]}>
                  <MaterialCommunityIcons name={getPersonFallbackAvatarIcon(person)} size={28} color={isHighlighted ? tertiaryColor : primaryColor} />
                </View>
              )}
            </View>
          </View>
          <View style={styles.nodeTextWrap}>
            <Text variant="titleSmall" style={styles.nodeTitle} numberOfLines={2}>
              {formatPersonNodeTitle(person, showMaidenFamilyInNodeTitle)}
            </Text>
            {compactDetails ? null : (
              <>
                <Text variant="bodySmall" style={[styles.nodeMeta, { color: variantOnSurface }]} numberOfLines={1}>{getPersonLifeSpanLabel(person)}</Text>
                <Text variant="bodySmall" style={[styles.nodeMeta, { color: variantOnSurface }]} numberOfLines={1}>{getPersonPresenceLabel(person)}</Text>
              </>
            )}
          </View>
        </View>
      </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function FamilyTreeCanvas({
                            people,
                            relationships,
                            currentTreeId,
                            onPressPerson,
                            currentUserPersonId,
                            highlightedPersonId,
                            initialFocusPersonId,
                            descendantRootPersonId,
                            ascendantRootPersonId,
                            showMaidenFamilyInNodeTitle = false,
                            allowFullscreen = true,
                            floatingControls = false,
                            fillAvailableSpace = false,
                            showControls = true,
                            disableSurnameClustering = false,
                            inlineViewportHeight: inlineViewportHeightOverride,
                            familySwitchRef,
                            activeFamilyRef,
}: FamilyTreeCanvasProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const { height: windowHeight } = useWindowDimensions();
  const inlineViewportHeight = inlineViewportHeightOverride ?? Math.max(420, windowHeight - 360);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inlineViewportSize, setInlineViewportSize] = useState({ width: 0, height: 0 });
  const [fullscreenViewportSize, setFullscreenViewportSize] = useState({ width: 0, height: 0 });
  const [activeSurnames, setActiveSurnames] = useState<string[]>([]);

  // Refs that need to stay current inside gesture callbacks.
  const scaleRef = useRef(scale);
  const panRef = useRef(pan);
  scaleRef.current = scale;
  panRef.current = pan;
  const scaleShared = useSharedValue(scale);
  const panXShared = useSharedValue(pan.x);
  const panYShared = useSharedValue(pan.y);
  const gestureStartPanX = useSharedValue(0);
  const gestureStartPanY = useSharedValue(0);
  const gestureStartScale = useSharedValue(1);
  const pendingViewportRef = useRef<{ scale: number; pan: { x: number; y: number } } | null>(null);
  const viewportCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [interactionActive, setInteractionActive] = useState(false);

  const commitViewportState = useCallback(() => {
    viewportCommitTimerRef.current = null;
    const pendingViewport = pendingViewportRef.current;
    if (!pendingViewport) return;
    pendingViewportRef.current = null;
    setScale((currentScale) => (currentScale === pendingViewport.scale ? currentScale : pendingViewport.scale));
    setPan((currentPan) => (
      currentPan.x === pendingViewport.pan.x && currentPan.y === pendingViewport.pan.y
        ? currentPan
        : pendingViewport.pan
    ));
  }, []);

  const scheduleViewportState = useCallback((nextPan: { x: number; y: number }, nextScale: number) => {
    panRef.current = nextPan;
    scaleRef.current = nextScale;
    panXShared.value = nextPan.x;
    panYShared.value = nextPan.y;
    scaleShared.value = nextScale;
    pendingViewportRef.current = { pan: nextPan, scale: nextScale };
    if (viewportCommitTimerRef.current !== null) return;
    viewportCommitTimerRef.current = setTimeout(commitViewportState, VIEWPORT_COMMIT_INTERVAL_MS);
  }, [commitViewportState, panXShared, panYShared, scaleShared]);

  const scheduleGestureViewportState = useCallback((nextPanX: number, nextPanY: number, nextScale: number) => {
    panRef.current = { x: nextPanX, y: nextPanY };
    scaleRef.current = nextScale;
    pendingViewportRef.current = { pan: { x: nextPanX, y: nextPanY }, scale: nextScale };
    if (viewportCommitTimerRef.current !== null) return;
    viewportCommitTimerRef.current = setTimeout(commitViewportState, VIEWPORT_COMMIT_INTERVAL_MS);
  }, [commitViewportState]);

  const flushViewportState = useCallback(() => {
    if (viewportCommitTimerRef.current !== null) {
      clearTimeout(viewportCommitTimerRef.current);
      viewportCommitTimerRef.current = null;
    }
    commitViewportState();
  }, [commitViewportState]);

  useEffect(() => () => {
    if (viewportCommitTimerRef.current !== null) {
      clearTimeout(viewportCommitTimerRef.current);
    }
  }, []);

  // ---- Lineage filter ----
  const lineageMode = ascendantRootPersonId ? 'ascendant' : descendantRootPersonId ? 'descendant' : 'full';
  const { renderedPeople, renderedRelationships } = useMemo(() => {
    if (ascendantRootPersonId) return buildLineageSubtree(people, relationships, ascendantRootPersonId, 'ascendant');
    if (descendantRootPersonId) return buildLineageSubtree(people, relationships, descendantRootPersonId, 'descendant');
    return { renderedPeople: people, renderedRelationships: relationships };
  }, [people, relationships, ascendantRootPersonId, descendantRootPersonId]);

  // ---- Surname clustering ----
  const surnameClusters = useMemo(
    () => buildSurnameClusters(renderedPeople, currentTreeId),
    [currentTreeId, renderedPeople],
  );
  const sortedSurnames = useMemo(
    () => getSortedSurnames(surnameClusters),
    [surnameClusters],
  );

  // Determine the "seed" person for initial surname selection (doesn't depend on layout).
  const seedFocusPersonId = initialFocusPersonId ?? ascendantRootPersonId ?? descendantRootPersonId ?? renderedPeople[0]?.id;
  const renderedPeopleById = useMemo(
    () => new Map(renderedPeople.map((person) => [person.id, person])),
    [renderedPeople],
  );

  // Auto-select initial surnames when data changes.
  useEffect(() => {
    if (sortedSurnames.length === 0) return;
    setActiveSurnames((current) => {
      if (current.length > 0 && current.every((surname) => surnameClusters.has(surname))) {
        return current;
      }

      // Default to the largest surname. If the focused person has a surname, start there.
      let startSurname = sortedSurnames[0];
      if (seedFocusPersonId) {
        const focusPerson = renderedPeopleById.get(seedFocusPersonId);
        if (focusPerson) {
          const fs = extractSurname(focusPerson, currentTreeId);
          if (surnameClusters.has(fs)) startSurname = fs;
        }
      }
      return [startSurname];
    });
  }, [currentTreeId, sortedSurnames, seedFocusPersonId, renderedPeopleById, surnameClusters]);

  // Determine if clustering is active (more than 1 surname in the data → show one family at a time).
  const clusteringActive = !disableSurnameClustering && sortedSurnames.length >= 2;

  // Filter people/relationships to active surnames.
  const {
    filteredPeople: clusterPeople,
    filteredRelationships: clusterRelationships,
    ghostPersonIds,
  } = useMemo(() => {
    if (!clusteringActive || activeSurnames.length === 0) {
      return {
        filteredPeople: renderedPeople,
        filteredRelationships: renderedRelationships,
        ghostPersonIds: new Set<string>(),
        activeBridges: [],
        externalBridges: [],
      };
    }
    return filterForActiveSurnames(renderedPeople, renderedRelationships, activeSurnames, currentTreeId);
  }, [activeSurnames, clusteringActive, currentTreeId, renderedPeople, renderedRelationships]);

  // Navigation: switch to a different surname (one family shown at a time).
  const navigateToSurname = useCallback((targetSurname: string) => {
    setActiveSurnames([targetSurname]);
  }, []);

  // Expose navigateToSurname to the parent via an optional ref so the Quick
  // Actions dialog (or any parent component) can trigger a family switch.
  useEffect(() => {
    if (familySwitchRef) {
      familySwitchRef.current = navigateToSurname;
    }
    return () => {
      if (familySwitchRef) familySwitchRef.current = null;
    };
  }, [familySwitchRef, navigateToSurname]);

  // Keep activeFamilyRef in sync with the current surname cluster.
  useEffect(() => {
    if (activeFamilyRef) {
      activeFamilyRef.current = activeSurnames[0] ?? null;
    }
  }, [activeFamilyRef, activeSurnames]);

  const layoutCacheKey = `${getObjectIdentity(clusterPeople)}:${getObjectIdentity(clusterRelationships)}`;

  // ---- Layout (tidy tree) ----
  const layout = useMemo(
      () => getCachedValue(layoutCache, layoutCacheKey, () => layoutFamilyTree(clusterPeople, clusterRelationships, C)),
      [clusterPeople, clusterRelationships, layoutCacheKey],
  );
  const { positionsByPersonId, contentWidth, contentHeight } = layout;
  const positionedPeople = useMemo<PositionedPerson[]>(
    () => clusterPeople.flatMap((person) => {
      const pos = positionsByPersonId.get(person.id);
      if (!pos) {
        return [];
      }
      return [{
        person,
        x: pos.x,
        y: pos.y,
        bounds: { x: pos.x, y: pos.y, w: C.NODE_WIDTH, h: C.NODE_HEIGHT },
      }];
    }),
    [clusterPeople, positionsByPersonId],
  );

  const contentBounds = useMemo(() => {
    if (positionedPeople.length === 0) {
      return {
        minX: 0,
        minY: 0,
        maxX: contentWidth,
        maxY: contentHeight,
        width: Math.max(contentWidth, C.NODE_WIDTH),
        height: Math.max(contentHeight, C.NODE_HEIGHT),
      };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    positionedPeople.forEach(({ x, y }) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + C.NODE_WIDTH);
      maxY = Math.max(maxY, y + C.NODE_HEIGHT);
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(maxX - minX, C.NODE_WIDTH),
        height: Math.max(maxY - minY, C.NODE_HEIGHT),
      };
  }, [positionedPeople, contentWidth, contentHeight]);

  // ---- Connectors (lane-allocated) ----
  const connectorCacheKey = useMemo(() => [
    getObjectIdentity(layout),
    getObjectIdentity(clusterRelationships),
    [...ghostPersonIds].sort().join('|'),
    theme.colors.primary,
    theme.colors.secondary,
    theme.colors.tertiary ?? theme.colors.outline,
    '#B7791F',
    '#2E7D6B',
    theme.colors.outline,
  ].join('::'), [clusterRelationships, ghostPersonIds, layout, theme.colors.outline, theme.colors.primary, theme.colors.secondary, theme.colors.tertiary]);
  const { spouseConnectors, parentChildConnectors } = useMemo(
      () => getCachedValue(connectorCache, connectorCacheKey, () => buildConnectors(clusterRelationships, layout, C, {
        parentChild: theme.colors.primary,
        spouse: theme.colors.secondary,
        secondaryParent: theme.colors.tertiary ?? theme.colors.outline,
        stepChild: '#B7791F',
        adoptedChild: '#2E7D6B',
        guardianChild: theme.colors.outline,
      }, ghostPersonIds)),
      [clusterRelationships, connectorCacheKey, ghostPersonIds, layout, theme.colors.outline, theme.colors.primary, theme.colors.secondary, theme.colors.tertiary],
  );
  const allConnectors = useMemo(() => [...parentChildConnectors, ...spouseConnectors], [parentChildConnectors, spouseConnectors]);
  const isLargeTreeMode = clusterPeople.length >= LARGE_TREE_NODE_THRESHOLD
    || allConnectors.length >= LARGE_TREE_CONNECTOR_THRESHOLD;

  // ---- Cross-surname children ----
  // Detect children whose parents have different surnames (full pre-cluster dataset).
  const crossSurnameChildIds = useMemo(
    () => findCrossSurnameChildren(renderedPeople, renderedRelationships, currentTreeId),
    [currentTreeId, renderedPeople, renderedRelationships],
  );

  // ---- Maiden name members ----
  const maidenNameMemberIds = useMemo(
    () => findMaidenNameMembers(renderedPeople),
    [renderedPeople],
  );

  // ---- Active viewport ----
  const activeViewportSize = isFullscreen ? fullscreenViewportSize : inlineViewportSize;

  const clampPanToViewport = useCallback((
    nextPan: { x: number; y: number },
    nextScale: number,
    viewportWidth: number,
    viewportHeight: number,
    boundaryPadding: number = 0,
  ) => {
    return clampCanvasPan(nextPan.x, nextPan.y, nextScale, viewportWidth, viewportHeight, contentBounds, boundaryPadding);
  }, [contentBounds]);

  // ---- Auto-fit on first layout / when canvas size or focus changes ----
  const lastAutoFitKey = useRef<string | null>(null);
  const effectiveFocusId = useMemo(() => {
    if (initialFocusPersonId && positionsByPersonId.has(initialFocusPersonId)) return initialFocusPersonId;
    if (ascendantRootPersonId && positionsByPersonId.has(ascendantRootPersonId)) return ascendantRootPersonId;
    if (descendantRootPersonId && positionsByPersonId.has(descendantRootPersonId)) return descendantRootPersonId;
    return clusterPeople[0]?.id ?? renderedPeople[0]?.id;
  }, [initialFocusPersonId, ascendantRootPersonId, descendantRootPersonId, positionsByPersonId, clusterPeople, renderedPeople]);

  const fitTo = useCallback((vw: number, vh: number, focusPersonId?: string, mode: 'inline' | 'fullscreen' = 'inline') => {
    if (vw <= 0 || vh <= 0) return;
    const padW = Math.max(120, vw - VIEWPORT_PADDING * 2);
    const padH = Math.max(120, vh - VIEWPORT_PADDING * 2);
    const fitScale = Math.min(padW / contentBounds.width, padH / contentBounds.height);
    const minOpeningScale = mode === 'fullscreen' ? AUTO_FIT_MIN_SCALE_FULLSCREEN : AUTO_FIT_MIN_SCALE_INLINE;
    const nextScale = Math.min(
      AUTO_FIT_MAX_SCALE,
      Math.max(focusPersonId ? minOpeningScale : MIN_SCALE, fitScale),
    );

    let targetCx = contentBounds.minX + contentBounds.width / 2;
    let targetCy = contentBounds.minY + contentBounds.height / 2;
    if (focusPersonId) {
      const fp = positionsByPersonId.get(focusPersonId);
      if (fp) {
        targetCx = fp.x + C.NODE_WIDTH / 2;
        targetCy = fp.y + C.NODE_HEIGHT / 2;
      }
    }
    const nextPan = {
      x: vw / 2 / nextScale - targetCx,
      y: vh / 2 / nextScale - targetCy,
    };
    scheduleViewportState(clampPanToViewport(nextPan, nextScale, vw, vh), nextScale);
  }, [clampPanToViewport, contentBounds, positionsByPersonId, scheduleViewportState]);

  useEffect(() => {
    if (activeViewportSize.width <= 0 || activeViewportSize.height <= 0) return;
    const key = `${isFullscreen}:${activeViewportSize.width}x${activeViewportSize.height}:${contentWidth}x${contentHeight}:${effectiveFocusId ?? ''}`;
    if (lastAutoFitKey.current === key) return;
    fitTo(activeViewportSize.width, activeViewportSize.height, effectiveFocusId, isFullscreen ? 'fullscreen' : 'inline');
    lastAutoFitKey.current = key;
  }, [activeViewportSize.width, activeViewportSize.height, contentWidth, contentHeight, effectiveFocusId, isFullscreen, fitTo]);

  // ---- Anchored zoom ----
  // Keeps the canvas point under (focalX, focalY) in viewport space stationary.
  const zoomAt = useCallback((focalX: number, focalY: number, nextScale: number) => {
    if (activeViewportSize.width <= 0 || activeViewportSize.height <= 0) return;
    const s0 = scaleRef.current;
    const p0 = panRef.current;
    const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    if (ns === s0) return;
    // Canvas point currently under focal:
    const cx = focalX / s0 - p0.x;
    const cy = focalY / s0 - p0.y;
    // Solve so the same canvas point lands at the same focal after scale change:
    const np = { x: focalX / ns - cx, y: focalY / ns - cy };
    scheduleViewportState(clampPanToViewport(np, ns, activeViewportSize.width, activeViewportSize.height), ns);
  }, [activeViewportSize.height, activeViewportSize.width, clampPanToViewport, scheduleViewportState]);

  const zoomBy = useCallback((delta: number) => {
    const vw = (isFullscreen ? fullscreenViewportSize : inlineViewportSize).width;
    const vh = (isFullscreen ? fullscreenViewportSize : inlineViewportSize).height;
    zoomAt(vw / 2, vh / 2, scaleRef.current * (1 + delta));
  }, [zoomAt, isFullscreen, fullscreenViewportSize, inlineViewportSize]);

  const handlePersonPress = useCallback((pressedPerson: PersonRecord) => {
    onPressPerson(pressedPerson);
  }, [onPressPerson]);

  // ---- Web wheel: scroll = pan, ctrl/⌘+wheel = zoom ----
  const handleWheel = useCallback((e: any) => {
    if (Platform.OS !== 'web') return;
    const ne = e?.nativeEvent ?? e;
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const dx = Number(ne?.deltaX ?? 0);
    const dy = Number(ne?.deltaY ?? 0);
    if (ne?.ctrlKey || ne?.metaKey) {
      const focalX = ne?.offsetX ?? (activeViewportSize.width / 2);
      const focalY = ne?.offsetY ?? (activeViewportSize.height / 2);
      zoomAt(focalX, focalY, scaleRef.current * (dy < 0 ? 1.12 : 1 / 1.12));
      return;
    }
    scheduleViewportState(
      clampPanToViewport({
        x: panRef.current.x - dx / scaleRef.current,
        y: panRef.current.y - dy / scaleRef.current,
      }, scaleRef.current, activeViewportSize.width, activeViewportSize.height, CONTENT_BOUNDARY_PADDING),
      scaleRef.current,
    );
  }, [activeViewportSize.width, activeViewportSize.height, clampPanToViewport, scheduleViewportState, zoomAt]);

  // ---- Pan + pinch via Gesture Handler + Reanimated ----
  const setInteractionActiveOnJS = useCallback((active: boolean) => {
    setInteractionActive(active);
  }, []);

  const commitGestureOnJS = useCallback((nextPanX: number, nextPanY: number, nextScale: number) => {
    scheduleGestureViewportState(nextPanX, nextPanY, nextScale);
  }, [scheduleGestureViewportState]);

  const flushGestureOnJS = useCallback((nextPanX: number, nextPanY: number, nextScale: number) => {
    scheduleGestureViewportState(nextPanX, nextPanY, nextScale);
    flushViewportState();
    setInteractionActive(false);
  }, [flushViewportState, scheduleGestureViewportState]);

  const treeGesture = useMemo(() => {
    const clampForGesture = (panXValue: number, panYValue: number, scaleValue: number) => {
      'worklet';
      return clampCanvasPan(
        panXValue,
        panYValue,
        scaleValue,
        activeViewportSize.width,
        activeViewportSize.height,
        contentBounds,
        CONTENT_BOUNDARY_PADDING,
      );
    };

    const panGesture = Gesture.Pan()
      .minDistance(DRAG_ACTIVATION_DISTANCE)
      .onBegin(() => {
        gestureStartPanX.value = panXShared.value;
        gestureStartPanY.value = panYShared.value;
        runOnJS(setInteractionActiveOnJS)(true);
      })
      .onUpdate((event) => {
        const nextScale = scaleShared.value;
        const clamped = clampForGesture(
          gestureStartPanX.value + event.translationX / nextScale,
          gestureStartPanY.value + event.translationY / nextScale,
          nextScale,
        );
        panXShared.value = clamped.x;
        panYShared.value = clamped.y;
        runOnJS(commitGestureOnJS)(clamped.x, clamped.y, nextScale);
      })
      .onFinalize(() => {
        const clamped = clampForGesture(panXShared.value, panYShared.value, scaleShared.value);
        panXShared.value = clamped.x;
        panYShared.value = clamped.y;
        runOnJS(flushGestureOnJS)(clamped.x, clamped.y, scaleShared.value);
      });

    const pinchGesture = Gesture.Pinch()
      .onBegin(() => {
        gestureStartScale.value = scaleShared.value;
        gestureStartPanX.value = panXShared.value;
        gestureStartPanY.value = panYShared.value;
        runOnJS(setInteractionActiveOnJS)(true);
      })
      .onUpdate((event) => {
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, gestureStartScale.value * event.scale));
        const canvasFocalX = event.focalX / gestureStartScale.value - gestureStartPanX.value;
        const canvasFocalY = event.focalY / gestureStartScale.value - gestureStartPanY.value;
        const clamped = clampForGesture(
          event.focalX / nextScale - canvasFocalX,
          event.focalY / nextScale - canvasFocalY,
          nextScale,
        );
        scaleShared.value = nextScale;
        panXShared.value = clamped.x;
        panYShared.value = clamped.y;
        runOnJS(commitGestureOnJS)(clamped.x, clamped.y, nextScale);
      })
      .onFinalize(() => {
        const clamped = clampForGesture(panXShared.value, panYShared.value, scaleShared.value);
        panXShared.value = clamped.x;
        panYShared.value = clamped.y;
        runOnJS(flushGestureOnJS)(clamped.x, clamped.y, scaleShared.value);
      });

    return Gesture.Simultaneous(panGesture, pinchGesture);
  }, [
    activeViewportSize.height,
    activeViewportSize.width,
    commitGestureOnJS,
    contentBounds,
    flushGestureOnJS,
    gestureStartPanX,
    gestureStartPanY,
    gestureStartScale,
    panXShared,
    panYShared,
    scaleShared,
    setInteractionActiveOnJS,
  ]);

  // ---- Viewport culling ----
  // Compute the visible canvas-space rect to skip off-screen nodes/connectors.
  const deferredPan = useDeferredValue(pan);
  const deferredScale = useDeferredValue(scale);
  const viewportRect = useMemo(() => {
    if (activeViewportSize.width <= 0 || activeViewportSize.height <= 0) {
      return { x: -Infinity, y: -Infinity, w: Infinity, h: Infinity };
    }
    return {
      x: -deferredPan.x - CULL_PADDING / deferredScale,
      y: -deferredPan.y - CULL_PADDING / deferredScale,
      w: activeViewportSize.width / deferredScale + (2 * CULL_PADDING) / deferredScale,
      h: activeViewportSize.height / deferredScale + (2 * CULL_PADDING) / deferredScale,
    };
  }, [deferredPan.x, deferredPan.y, deferredScale, activeViewportSize.width, activeViewportSize.height]);

  const intersects = useCallback((b: { x: number; y: number; w: number; h: number }) => (
      b.x + b.w >= viewportRect.x &&
      b.x <= viewportRect.x + viewportRect.w &&
      b.y + b.h >= viewportRect.y &&
      b.y <= viewportRect.y + viewportRect.h
  ), [viewportRect]);

  const visiblePeople = useMemo(
    () => positionedPeople.filter(({ bounds }) => intersects(bounds)),
    [intersects, positionedPeople],
  );

  const visibleConnectors = useMemo(
      () => allConnectors.filter((c: Connector) => intersects(c.bounds)),
      [allConnectors, intersects],
  );

  // ---- Layout handlers ----
  const onLayoutInline = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setInlineViewportSize((cur) => (cur.width === width && cur.height === height ? cur : { width, height }));
  }, []);
  const onLayoutFullscreen = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setFullscreenViewportSize((cur) => (cur.width === width && cur.height === height ? cur : { width, height }));
  }, []);

  // ---- Labels ----
  const lineageCounts = useMemo(() => {
    if (ascendantRootPersonId) {
      return {
        descendants: 0,
        ancestors: countLineageGenerations(renderedPeople, renderedRelationships, ascendantRootPersonId, 'ascendant'),
      };
    }

    if (descendantRootPersonId) {
      return {
        descendants: countLineageGenerations(renderedPeople, renderedRelationships, descendantRootPersonId, 'descendant'),
        ancestors: 0,
      };
    }

    return null;
  }, [ascendantRootPersonId, descendantRootPersonId, renderedPeople, renderedRelationships]);
  const controlsLabel = lineageCounts
    ? `${lineageCounts.descendants} ${t(K.lineage.descendants)}, ${lineageCounts.ancestors} ${t(K.lineage.ancestors)}`
    : lineageMode === 'ascendant'
      ? t(K.lineage.canvasControlsAscendants)
      : lineageMode === 'descendant'
          ? t(K.lineage.canvasControlsDescendants)
          : t(K.lineage.canvasControlsGeneric);
  const fullscreenTitle = lineageMode === 'ascendant' ? t(K.lineage.fullScreenAscendantTree)
      : lineageMode === 'descendant' ? t(K.lineage.fullScreenDescendantTree) : t(K.lineage.fullScreenFamilyTree);

  // ---- Render helpers ----
  const transformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panXShared.value * scaleShared.value },
      { translateY: panYShared.value * scaleShared.value },
      { scale: scaleShared.value },
    ],
    transformOrigin: '0 0' as const,
  }), [panXShared, panYShared, scaleShared]);

  const renderFloatingControls = (mode: 'inline' | 'fullscreen') => (
      <View pointerEvents="box-none" style={styles.viewportOverlay}>
        <View style={[styles.floatingHintCard, { backgroundColor: theme.colors.surface }]}>
          <Text variant="bodySmall" style={[styles.floatingHintText, { color: theme.colors.onSurface }]}>{controlsLabel}</Text>
        </View>
        <View style={[styles.floatingControlsCard, { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 }]}>
          <Chip compact icon="magnify">{scale.toFixed(2)}x</Chip>
          <IconButton icon="minus" size={24} accessibilityLabel={t('Zoom out')} disabled={scale <= MIN_SCALE} mode="contained-tonal" onPress={() => zoomBy(-0.15)} />
          <IconButton icon="plus" size={24} accessibilityLabel={t('Zoom in')} disabled={scale >= MAX_SCALE} mode="contained-tonal" onPress={() => zoomBy(0.15)} />
          <IconButton icon="fit-to-screen-outline" size={24} mode="contained-tonal" accessibilityLabel={t('Fit tree to screen')} onPress={() => fitTo(activeViewportSize.width, activeViewportSize.height, undefined, mode)} />
          {allowFullscreen ? (
              mode === 'fullscreen'
                  ? <Button compact mode="contained" icon="close" onPress={() => setIsFullscreen(false)}>{t(K.common.close)}</Button>
                  : <Button compact mode="contained" icon="fullscreen" onPress={() => setIsFullscreen(true)}>{t(K.common.fullscreen)}</Button>
          ) : null}
        </View>
      </View>
  );

  const renderViewport = (mode: 'inline' | 'fullscreen', viewportStyle?: object) => (
    <GestureDetector gesture={treeGesture}>
      <View
          {...(Platform.OS === 'web' ? ({ onWheel: handleWheel } as any) : {})}
          style={[
            styles.viewport,
            { borderColor: 'transparent', borderWidth: 0, backgroundColor: 'transparent', overflow: 'hidden' },
            Platform.OS === 'web'
                ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as any)
                : null,
            viewportStyle,
          ]}
          onLayout={mode === 'fullscreen' ? onLayoutFullscreen : onLayoutInline}
      >
        {/* The transformed canvas — nodes are Pressables so tap hit-testing
          uses the platform's transform-aware hit pipeline. */}
        <Animated.View
            style={[
              styles.canvas,
              {
                width: contentWidth,
                height: contentHeight,
                backgroundColor: 'transparent',
              },
              transformStyle,
            ]}
            pointerEvents="box-none"
            renderToHardwareTextureAndroid={!isLargeTreeMode}
            shouldRasterizeIOS={!isLargeTreeMode}
        >
          <Svg
              width={contentWidth}
              height={contentHeight}
              style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
              pointerEvents="none"
          >
            {visibleConnectors.map((c) => (
                <React.Fragment key={c.key}>
                  <Path
                      d={c.d}
                      fill="none"
                      stroke={c.stroke}
                      strokeWidth={c.strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      {...(c.dashArray ? { strokeDasharray: c.dashArray } : {})}
                  />
                  {!isLargeTreeMode && c.label && c.labelPosition ? (
                    <SvgText
                      x={c.labelPosition.x}
                      y={c.labelPosition.y - 6}
                      fontSize={10}
                      fill={c.stroke}
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {c.label}
                    </SvgText>
                  ) : null}
                </React.Fragment>
            ))}
          </Svg>

          {visiblePeople.map(({ person, x, y }) => {
            return (
                <PersonNode
                    key={person.id}
                    person={person}
                    x={x}
                    y={y}
                    showMaidenFamilyInNodeTitle={showMaidenFamilyInNodeTitle}
                    isCurrentUser={currentUserPersonId === person.id}
                    isFocusedPerson={highlightedPersonId === person.id}
                    isGhost={ghostPersonIds.has(person.id)}
                    isCrossSurnameChild={crossSurnameChildIds.has(person.id)}
                    isMaidenNameMember={maidenNameMemberIds.has(person.id)}
                    surfaceColor={theme.colors.surface}
                    outlineColor={theme.colors.outlineVariant}
                    primaryColor={theme.colors.primary}
                    tertiaryColor={theme.colors.tertiary ?? theme.colors.secondary}
                    onTertiaryColor={(theme.colors as any).onTertiary ?? theme.colors.onPrimary}
                    variantSurface={theme.colors.surfaceVariant}
                    variantOnSurface={theme.colors.onSurfaceVariant}
                    onPrimaryColor={theme.colors.onPrimary}
                    deferPhoto={interactionActive || isLargeTreeMode}
                    compactDetails={isLargeTreeMode}
                    onPress={handlePersonPress}
                />
            );
          })}
        </Animated.View>


        {floatingControls ? renderFloatingControls(mode) : null}
      </View>
    </GestureDetector>
  );

  return (
      <View style={[styles.container, fillAvailableSpace ? styles.containerFill : null]}>
        {!floatingControls && showControls ? (
            <View style={styles.controlsRow}>
              <Text variant="bodyMedium">{controlsLabel}</Text>
              <View style={styles.zoomButtonsRow}>
                <Chip compact icon="magnify-minus">{scale.toFixed(2)}x</Chip>
                <Button compact accessibilityLabel={t('Zoom out')} mode="outlined" onPress={() => zoomBy(-0.15)}>-</Button>
                <Button compact accessibilityLabel={t('Zoom in')} mode="outlined" onPress={() => zoomBy(0.15)}>+</Button>
                <Button compact mode="outlined" onPress={() => fitTo(activeViewportSize.width, activeViewportSize.height)}>{t('Fit tree to screen')}</Button>
                {allowFullscreen ? <Button compact mode="contained-tonal" icon="fullscreen" onPress={() => setIsFullscreen(true)}>{t(K.common.fullscreen)}</Button> : null}
              </View>
            </View>
        ) : null}

        {renderViewport('inline', fillAvailableSpace ? styles.inlineViewportFill : { height: inlineViewportHeight })}

        <Modal visible={isFullscreen} animationType="slide" onRequestClose={() => setIsFullscreen(false)}>
          <View style={[styles.fullscreenContainer, { backgroundColor: theme.colors.background }]}>
            {floatingControls ? (
                renderViewport('fullscreen', styles.fullscreenViewport)
            ) : (
                <>
                  <View style={styles.fullscreenHeader}>
                    <Text variant="titleLarge">{fullscreenTitle}</Text>
                    <IconButton icon="close" accessibilityLabel={t(K.common.close)} onPress={() => setIsFullscreen(false)} />
                  </View>
                  {renderViewport('fullscreen', { height: Math.max(320, windowHeight - 172), borderRadius: 5 })}
                </>
            )}
          </View>
        </Modal>
      </View>
  );
}

export default React.memo(FamilyTreeCanvas);
