import { measureWork, recordMetric } from './performance-metrics';
// Optimized FamilyTreeCanvas
// ---------------------------------------------------------------------------
// Improvements over the original:
//   1. Tidy-tree layout (Walker) keyed by spouse-group  → no card overlap.
//   2. Shared family buses and gaps at unrelated intersections.
//   3. Viewport culling                                  → unlimited nodes.
//   4. Per-node `Pressable`                              → reliable taps at
//      any zoom level (no manual hit-testing math).
//   5. Two-finger pinch + drag pan with PanResponder     → stable mobile zoom.
//   6. Cursor / pinch-anchored zoom                      → focus stays put.
//   7. Viewport culling + large-tree mode                → lower memory use.
//
// Uses react-native-svg/react-native-paper and standard React Native gestures
// to keep the runtime path stable on native builds.
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
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  Keyboard,
  Modal,
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button, Chip, IconButton, Menu, Searchbar, Text, useTheme } from 'react-native-paper';
import { translate } from '../i18n';
import { I18N_KEYS as K } from '../i18n/keys';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import type { PersonRecord } from './dto/person';
import {
  getPersonLifeSpanLabel,
} from './dto/person';
import type { RelationshipRecord } from './dto/relationship';
import { GlobalStyles } from '../constants/styles';

import { connectorOnPath } from './tree-exploration';
import { layoutFamilyTree } from './family-tree-layout';
import { buildConnectors } from './family-tree-connectors';
import { createViewportIndex } from './family-tree-viewport';
import {
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
import { AdaptiveDialog } from './ui/adaptive-dialog';
import { Checkbox } from 'react-native-paper';
import { PersonPortrait } from './ui/person-portrait';

const styles = GlobalStyles.familyTreeCanvas;

// ---- Tunables ----
const COMPACT_LAYOUT: LayoutConstants = { ...DEFAULT_LAYOUT_CONSTANTS, NODE_WIDTH: 208, NODE_HEIGHT: 152, HORIZONTAL_GAP: 32 };
const PORTRAIT_SIZE = {
  compact: 60,
  compactHighlighted: 72,
  regular: 92,
  regularHighlighted: 104,
} as const;
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
  compactCards?: boolean;
  searchPeople?: PersonRecord[];
  onSearchPerson?: (personId: string) => void;
  hiddenParents?: Map<string, string[]>;
  onRevealParents?: (personId: string) => void;
  moreChildren?: Map<string, string[]>;
  onRevealChildren?: (personId: string) => void;
  preserveAnchorPersonId?: string;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  currentTreeId?: string;
  onPressPerson: (person: PersonRecord) => void;
  currentUserPersonId?: string;
  highlightedPersonId?: string;
  highlightedPathIds?: string[];
  focusRequest?: { personId: string; token: number };
  viewportStorageKey?: string;
  initialFocusPersonId?: string;
  descendantRootPersonId?: string;
  ascendantRootPersonId?: string;
  showMaidenFamilyInNodeTitle?: boolean;
  allowFullscreen?: boolean;
  floatingControls?: boolean;
  /** Optional view controls displayed with the tree search in both canvas modes. */
  searchControls?: React.ReactNode;
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

const savedViewports = new Map<string, { pan: { x: number; y: number }; scale: number; width: number; height: number }>();
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
  dimensions: LayoutConstants;
  compactCards: boolean;
  hasHiddenParents: boolean;
  onShowParents?: (personId: string) => void;
  moreCount: number;
  onReveal?: (personId: string) => void;
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
  isInspected: boolean;
  isDimmed: boolean;
  onInspect: (id?: string) => void;
  onPress: (person: PersonRecord) => void;
};
const PersonNode = React.memo(function PersonNode(props: PersonNodeProps) {
  const {
    dimensions: C, compactCards, hasHiddenParents, onShowParents, moreCount, onReveal, person, x, y, showMaidenFamilyInNodeTitle, isCurrentUser, isFocusedPerson, isGhost, isCrossSurnameChild, isMaidenNameMember,
    surfaceColor, outlineColor, primaryColor,
    variantSurface, variantOnSurface, onPrimaryColor,
    deferPhoto, compactDetails, isInspected, isDimmed, onInspect,
    onPress,
  } = props;

  const handlePress = useCallback(() => {
    onPress(person);
  }, [person, onPress]);

  const isHighlighted = isMaidenNameMember || isCrossSurnameChild || isFocusedPerson;
  const portraitHighlighted = isFocusedPerson || isInspected;
  const portraitSize = compactCards
    ? portraitHighlighted ? PORTRAIT_SIZE.compactHighlighted : PORTRAIT_SIZE.compact
    : portraitHighlighted ? PORTRAIT_SIZE.regularHighlighted : PORTRAIT_SIZE.regular;
  const borderColor = isFocusedPerson || isInspected
    ? primaryColor
    : isHighlighted
    ? outlineColor
    : isGhost
    ? primaryColor
    : outlineColor;
  const borderWidth = isFocusedPerson || isInspected ? 2.5 : isHighlighted ? 2 : 1;

  const badgeLabel = isMaidenNameMember
    ? `${person.maidenName!.trim()}`
    : isCrossSurnameChild
    ? '⬡ Mixed'
    : null;

  return (
      <View style={{ position: 'absolute', left: x, top: y, width: C.NODE_WIDTH, height: C.NODE_HEIGHT }}>
      <Pressable
          onPress={handlePress}
          onHoverIn={() => onInspect(person.id)}
          onHoverOut={() => onInspect(undefined)}
          onFocus={() => onInspect(person.id)}
          onBlur={() => onInspect(undefined)}
          accessibilityRole="button"
          accessibilityLabel={`${formatPersonNodeTitle(person, showMaidenFamilyInNodeTitle)}, ${getPersonLifeSpanLabel(person)}`}
          accessibilityState={{ selected: isFocusedPerson }}
          hitSlop={6}
          style={({ pressed }) => [
            styles.node,
            {
              backgroundColor: surfaceColor,
              borderColor,
              borderWidth,
              borderStyle: isGhost ? 'dashed' as const : 'solid' as const,
              left: 0,
              top: 0,
              width: C.NODE_WIDTH,
              height: C.NODE_HEIGHT,
              padding: compactCards ? 10 : 14,
              paddingBottom: compactCards && moreCount > 0 ? 54 : compactCards ? 10 : 14,
              opacity: isDimmed ? 0.45 : pressed ? 0.85 : isGhost ? 0.8 : 1,
              transform: [{ translateY: isInspected ? -3 : 0 }, { scale: pressed ? 0.98 : 1 }],
              shadowOpacity: isInspected ? 0.16 : 0.05,
              elevation: isInspected ? 5 : 2,
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
              <Text variant="labelSmall" style={[styles.nodeBadgeText, { color: onPrimaryColor }]}>{translate('Selected')}</Text>
            </View>
        ) : badgeLabel ? (
            <View style={[styles.nodeBadge, { backgroundColor: variantSurface }]}>
              <Text variant="labelSmall" style={[styles.nodeBadgeText, { color: variantOnSurface }]} numberOfLines={1}>{badgeLabel}</Text>
            </View>
        ) : null}
        <View style={styles.nodeInnerRow}>
          <View style={styles.nodeAvatarColumn}>
            <PersonPortrait person={person} size={portraitSize} highlighted={portraitHighlighted} deferPhoto={deferPhoto} />
          </View>
          <View style={styles.nodeTextWrap}>
            <Text variant="titleSmall" style={styles.nodeTitle} numberOfLines={2}>
              {formatPersonNodeTitle(person, showMaidenFamilyInNodeTitle)}
            </Text>
            {compactDetails ? null : (
              <>
                <Text variant="bodySmall" style={[styles.nodeMeta, { color: variantOnSurface }]} numberOfLines={1}>{person.deathDate ? `${translate('In memory')} · ` : ''}{[person.birthDate?.slice(0, 4), person.deathDate?.slice(0, 4)].filter(Boolean).join(' – ') || getPersonLifeSpanLabel(person)}</Text>
              </>
            )}
          </View>
        </View>
      </Pressable>
      {hasHiddenParents ? <Button compact mode="contained-tonal" icon="arrow-up" onPress={() => onShowParents?.(person.id)} style={{ position: 'absolute', top: -48, width: C.NODE_WIDTH }} contentStyle={{ minHeight: 44 }} accessibilityLabel={translate('Show parents') + ': ' + formatPersonName(person)}>{translate('Show parents')}</Button> : null}
      {moreCount > 0 ? <Button compact mode="contained-tonal" icon="plus" accessibilityLabel={translate('Show more children') + ' (' + moreCount + ')'} onPress={() => onReveal?.(person.id)} style={{ position: 'absolute', bottom: 0, width: C.NODE_WIDTH }} contentStyle={{ minHeight: 44 }}>
        {moreCount} {translate(moreCount === 1 ? 'more child' : 'more children')}
      </Button> : null}
      </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function FamilyTreeCanvas({
                            compactCards = false,
                            searchPeople,
                            onSearchPerson,
                            hiddenParents,
                            onRevealParents,
                            moreChildren,
                            onRevealChildren,
                            preserveAnchorPersonId,
                            people,
                            relationships,
                            currentTreeId,
                            onPressPerson,
                            currentUserPersonId,
                            highlightedPersonId,
                            highlightedPathIds,
                            focusRequest,
                            viewportStorageKey,
                            initialFocusPersonId,
                            descendantRootPersonId,
                            ascendantRootPersonId,
                            showMaidenFamilyInNodeTitle = false,
                            allowFullscreen = true,
                            floatingControls = false,
                            searchControls,
                            fillAvailableSpace = false,
                            showControls = true,
                            disableSurnameClustering = false,
                            inlineViewportHeight: inlineViewportHeightOverride,
                            familySwitchRef,
                            activeFamilyRef,
}: FamilyTreeCanvasProps) {
  const C = compactCards ? COMPACT_LAYOUT : DEFAULT_LAYOUT_CONSTANTS;
  const theme = useTheme();
  const { t } = useI18n();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const inlineViewportHeight = inlineViewportHeightOverride ?? Math.max(420, windowHeight - 360);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inlineViewportSize, setInlineViewportSize] = useState({ width: 0, height: 0 });
  const [fullscreenViewportSize, setFullscreenViewportSize] = useState({ width: 0, height: 0 });
  const [activeSurnames, setActiveSurnames] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  const [lineOptionsVisible, setLineOptionsVisible] = useState(false);
  const [hiddenLineKinds, setHiddenLineKinds] = useState<Set<string>>(new Set());
  const lineOptions = [
    { key: 'biological', label: 'Biological · solid', color: theme.colors.primary },
    { key: 'non-biological', label: 'Non-biological · dotted', color: theme.colors.tertiary },
    { key: 'step', label: 'Step-parent · dotted', color: '#B7791F' },
    { key: 'adopted', label: 'Adoptive · dotted', color: '#2E7D6B' },
    { key: 'foster', label: 'Foster · dotted', color: theme.colors.outline },
    { key: 'guardian', label: 'Guardian · dotted', color: theme.colors.outline },
    { key: 'spouse', label: 'Spouse / partner', color: theme.colors.secondary },
  ];

  const restoredViewportKey = useRef<string | undefined>(undefined);
  const [searchFocusId, setSearchFocusId] = useState<string>();
  const [inspectedPersonId, setInspectedPersonId] = useState<string>();
  const inspectPerson = useCallback((id?: string) => setInspectedPersonId(id), []);
  // Refs that need to stay current inside gesture callbacks.
  const scaleRef = useRef(scale);
  const panRef = useRef(pan);
  // Gesture refs are updated synchronously by scheduleViewportState; copying
  // deferred React state here would rewind an in-flight pan on hover renders.
  const scaleAnim = useRef(new Animated.Value(scale)).current;
  const panXAnim = useRef(new Animated.Value(pan.x)).current;
  const panYAnim = useRef(new Animated.Value(pan.y)).current;
  const pendingViewportRef = useRef<{ scale: number; pan: { x: number; y: number } } | null>(null);
  const viewportCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    panXAnim.setValue(nextPan.x * nextScale);
    panYAnim.setValue(nextPan.y * nextScale);
    scaleAnim.setValue(nextScale);
    pendingViewportRef.current = { pan: nextPan, scale: nextScale };
    if (viewportCommitTimerRef.current !== null) return;
    viewportCommitTimerRef.current = setTimeout(commitViewportState, VIEWPORT_COMMIT_INTERVAL_MS);
  }, [commitViewportState, panXAnim, panYAnim, scaleAnim]);

  const flushViewportState = useCallback(() => {
    if (viewportCommitTimerRef.current !== null) {
      clearTimeout(viewportCommitTimerRef.current);
      viewportCommitTimerRef.current = null;
    }
    const started = performance.now();
    commitViewportState();
    requestAnimationFrame(() => recordMetric('tree.viewport.frame.ms', performance.now() - started));
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
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return query ? (searchPeople ?? renderedPeople).filter((person) => formatPersonName(person).toLocaleLowerCase().includes(query)).slice(0, 5) : [];
  }, [renderedPeople, searchQuery, searchPeople]);
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
    if (disableSurnameClustering) {
      const target = renderedPeople.find(person => extractSurname(person, currentTreeId) === targetSurname);
      if (target) setSearchFocusId(target.id);
    }
  }, [disableSurnameClustering, renderedPeople, currentTreeId]);

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

  const layoutCacheKey = `${getObjectIdentity(clusterPeople)}:${getObjectIdentity(clusterRelationships)}:${compactCards}`;

  // ---- Layout (tidy tree) ----
  const layout = useMemo(
      () => getCachedValue(layoutCache, layoutCacheKey, () => measureWork('tree.layout.ms', () => layoutFamilyTree(clusterPeople, clusterRelationships, C))),
      [clusterPeople, clusterRelationships, layoutCacheKey, C],
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
    [clusterPeople, positionsByPersonId, C],
  );

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
      [C, clusterRelationships, connectorCacheKey, ghostPersonIds, layout, theme.colors.outline, theme.colors.primary, theme.colors.secondary, theme.colors.tertiary],
  );
  const allConnectors = useMemo(() => [...parentChildConnectors, ...spouseConnectors], [parentChildConnectors, spouseConnectors]);
  const activeInspectionId = inspectedPersonId ?? highlightedPersonId;
  const relatedPersonIds = useMemo(() => {
    if (highlightedPathIds) return new Set(highlightedPathIds);
    if (!activeInspectionId) return null;
    const ids = new Set([activeInspectionId]);
    relationships.forEach((r) => {
      if (r.fromPersonId === activeInspectionId) ids.add(r.toPersonId);
      if (r.toPersonId === activeInspectionId) ids.add(r.fromPersonId);
    });
    allConnectors.forEach((connector) => {
      if (connector.personIds?.includes(activeInspectionId)) connector.personIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [activeInspectionId, highlightedPathIds, relationships, allConnectors]);

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

    allConnectors.forEach(({ bounds }) => {
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.w);
      maxY = Math.max(maxY, bounds.y + bounds.h);
    });
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(maxX - minX, C.NODE_WIDTH),
        height: Math.max(maxY - minY, C.NODE_HEIGHT),
      };
  }, [positionedPeople, allConnectors, contentWidth, contentHeight, C]);

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
  const viewportCacheKey = viewportStorageKey ? `${viewportStorageKey}:${isFullscreen}:${activeViewportSize.width}x${activeViewportSize.height}` : undefined;

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
  const anchorOverride = useRef<string | undefined>(undefined);
  const previousLayout = useRef<{ positions: typeof positionsByPersonId; context: string; width: number; height: number } | null>(null);
  const lastAutoFitKey = useRef<string | null>(null);
  const effectiveFocusId = useMemo(() => {
    if (searchFocusId && positionsByPersonId.has(searchFocusId)) return searchFocusId;
    if (initialFocusPersonId && positionsByPersonId.has(initialFocusPersonId)) return initialFocusPersonId;
    if (ascendantRootPersonId && positionsByPersonId.has(ascendantRootPersonId)) return ascendantRootPersonId;
    if (descendantRootPersonId && positionsByPersonId.has(descendantRootPersonId)) return descendantRootPersonId;
    return clusterPeople[0]?.id ?? renderedPeople[0]?.id;
  }, [searchFocusId, initialFocusPersonId, ascendantRootPersonId, descendantRootPersonId, positionsByPersonId, clusterPeople, renderedPeople]);

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
  }, [clampPanToViewport, contentBounds, positionsByPersonId, scheduleViewportState, C]);

  useEffect(() => {
    if (activeViewportSize.width <= 0 || activeViewportSize.height <= 0) return;
    const key = `${viewportStorageKey ?? ''}:${isFullscreen}:${activeViewportSize.width}x${activeViewportSize.height}:${contentWidth}x${contentHeight}:${effectiveFocusId ?? ''}`;
    if (lastAutoFitKey.current === key && previousLayout.current?.positions === positionsByPersonId) return;
    const context = viewportStorageKey + ':' + isFullscreen;
    const previous = previousLayout.current;
    previousLayout.current = { positions: positionsByPersonId, context, width: activeViewportSize.width, height: activeViewportSize.height };
    const anchor = anchorOverride.current ?? preserveAnchorPersonId;
    anchorOverride.current = undefined;
    const before = anchor ? previous?.positions.get(anchor) : undefined;
    const after = anchor ? positionsByPersonId.get(anchor) : undefined;
    if (previous?.context === context && previous.width === activeViewportSize.width && previous.height === activeViewportSize.height && before && after) {
      scheduleViewportState({ x: panRef.current.x + before.x - after.x, y: panRef.current.y + before.y - after.y }, scaleRef.current);
      lastAutoFitKey.current = key;
      return;
    }
    if (viewportCacheKey && restoredViewportKey.current !== viewportCacheKey) {
      restoredViewportKey.current = viewportCacheKey;
      const saved = savedViewports.get(viewportCacheKey);
      if (saved && saved.width === activeViewportSize.width && saved.height === activeViewportSize.height) {
        scheduleViewportState(saved.pan, saved.scale);
        lastAutoFitKey.current = key;
        return;
      }
    }
    fitTo(activeViewportSize.width, activeViewportSize.height, effectiveFocusId, isFullscreen ? 'fullscreen' : 'inline');
    lastAutoFitKey.current = key;
  }, [activeViewportSize.width, activeViewportSize.height, contentWidth, contentHeight, effectiveFocusId, isFullscreen, fitTo, viewportStorageKey, viewportCacheKey, scheduleViewportState, positionsByPersonId, preserveAnchorPersonId]);

  useEffect(() => {
    if (!viewportCacheKey || !activeViewportSize.width || !activeViewportSize.height) return;
    return () => {
      savedViewports.set(viewportCacheKey, { pan: panRef.current, scale: scaleRef.current, width: activeViewportSize.width, height: activeViewportSize.height });
      if (savedViewports.size > 30) savedViewports.delete(savedViewports.keys().next().value!);
    };
  }, [viewportCacheKey, activeViewportSize.width, activeViewportSize.height]);

  const handledFocusRequest = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (focusRequest && handledFocusRequest.current !== focusRequest.token && positionsByPersonId.has(focusRequest.personId) && activeViewportSize.width > 0) {
      handledFocusRequest.current = focusRequest.token;
      fitTo(activeViewportSize.width, activeViewportSize.height, focusRequest.personId, isFullscreen ? 'fullscreen' : 'inline');
    }
  }, [focusRequest, positionsByPersonId, activeViewportSize.width, activeViewportSize.height, fitTo, isFullscreen]);

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
    setIsFullscreen(false);
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

  // ---- Pan + pinch via PanResponder (mobile + web touch) ----
  const gestureMovedRef = useRef(false);
  const dragStartPanRef = useRef({ x: 0, y: 0 });
  const pinchStateRef = useRef<{ startDist: number; startScale: number; focal: { x: number; y: number } } | null>(null);

  const distanceBetweenTouches = (e: GestureResponderEvent) => {
    const ts = e.nativeEvent.touches;
    if (ts.length < 2) return 0;
    return Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
  };

  const focalOfTouches = (e: GestureResponderEvent) => {
    const ts = e.nativeEvent.touches;
    if (ts.length < 2) return { x: 0, y: 0 };
    return {
      x: (ts[0].locationX + ts[1].locationX) / 2,
      y: (ts[0].locationY + ts[1].locationY) / 2,
    };
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (e, g: PanResponderGestureState) => {
        if (e.nativeEvent.touches.length >= 2) return true;
        return Math.hypot(g.dx, g.dy) > DRAG_ACTIVATION_DISTANCE;
      },
      onMoveShouldSetPanResponderCapture: (e, g) => {
        if (e.nativeEvent.touches.length >= 2) return true;
        return Math.hypot(g.dx, g.dy) > DRAG_ACTIVATION_DISTANCE;
      },
      onPanResponderGrant: (e) => {
        gestureMovedRef.current = false;
        dragStartPanRef.current = panRef.current;
        if (e.nativeEvent.touches.length >= 2) {
          pinchStateRef.current = {
            startDist: distanceBetweenTouches(e),
            startScale: scaleRef.current,
            focal: focalOfTouches(e),
          };
        } else {
          pinchStateRef.current = null;
        }
      },
      onPanResponderMove: (e, g) => {
        if (!gestureMovedRef.current) {
          gestureMovedRef.current = Math.hypot(g.dx, g.dy) > DRAG_ACTIVATION_DISTANCE;
        }

        if (e.nativeEvent.touches.length >= 2) {
          if (!pinchStateRef.current) {
            pinchStateRef.current = {
              startDist: distanceBetweenTouches(e),
              startScale: scaleRef.current,
              focal: focalOfTouches(e),
            };
            return;
          }
          const dist = distanceBetweenTouches(e);
          if (dist <= 0 || pinchStateRef.current.startDist <= 0) return;
          const next = pinchStateRef.current.startScale * (dist / pinchStateRef.current.startDist);
          zoomAt(pinchStateRef.current.focal.x, pinchStateRef.current.focal.y, next);
          return;
        }

        pinchStateRef.current = null;
        scheduleViewportState(
          clampPanToViewport({
            x: dragStartPanRef.current.x + g.dx / scaleRef.current,
            y: dragStartPanRef.current.y + g.dy / scaleRef.current,
          }, scaleRef.current, activeViewportSize.width, activeViewportSize.height, CONTENT_BOUNDARY_PADDING),
          scaleRef.current,
        );
      },
      onPanResponderRelease: () => {
        pinchStateRef.current = null;
        flushViewportState();
      },
      onPanResponderTerminate: () => {
        pinchStateRef.current = null;
        flushViewportState();
      },
      onPanResponderTerminationRequest: () => false,
    }),
    [activeViewportSize.height, activeViewportSize.width, clampPanToViewport, flushViewportState, scheduleViewportState, zoomAt],
  );

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

  const queryPeople = useMemo(() => createViewportIndex(positionedPeople), [positionedPeople]);
  const queryConnectors = useMemo(() => createViewportIndex(allConnectors), [allConnectors]);
  const visiblePeople = useMemo(() => queryPeople(viewportRect), [queryPeople, viewportRect]);
  const visibleConnectors = useMemo(() => queryConnectors(viewportRect).filter(c =>
    !hiddenLineKinds.has(c.relationshipType === 'spouse' ? 'spouse' : c.parentChildKind ?? 'biological')
    || !!(activeInspectionId && c.personIds?.includes(activeInspectionId))
    || !!(highlightedPathIds && connectorOnPath(c.personIds, highlightedPathIds))),
    [queryConnectors, viewportRect, hiddenLineKinds, activeInspectionId, highlightedPathIds]);

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
  const transformStyle = useMemo(() => ({
    transform: [
      { translateX: panXAnim },
      { translateY: panYAnim },
      { scale: scaleAnim },
    ],
    transformOrigin: '0 0' as const,
  }), [panXAnim, panYAnim, scaleAnim]);

  const focusPerson = (person: PersonRecord, mode: 'inline' | 'fullscreen') => {
    Keyboard.dismiss();
    if (!positionsByPersonId.has(person.id)) navigateToSurname(extractSurname(person, currentTreeId));
    setSearchFocusId(person.id);
    setSearchQuery('');
    setSearchExpanded(false);
    if (positionsByPersonId.has(person.id)) fitTo(activeViewportSize.width, activeViewportSize.height, person.id, mode);
  };

  const renderFloatingControls = (mode: 'inline' | 'fullscreen') => (
      <View pointerEvents="box-none" style={styles.viewportOverlay}>
        <View style={[styles.floatingHintCard, { backgroundColor: theme.colors.surface, width: searchExpanded ? 360 : 'auto', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 28 }]}>
          {searchExpanded ? <Searchbar
            autoFocus
            placeholder={t('Find a family member')}
            accessibilityLabel={t('Find a family member')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            icon="arrow-left"
            onIconPress={() => { setSearchExpanded(false); setSearchQuery(''); Keyboard.dismiss(); }}
            searchAccessibilityLabel={t('Close search')}
            style={{ backgroundColor: theme.colors.surface, height: 44 }}
            inputStyle={{ minHeight: 44, fontSize: 14 }}
          /> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {!searchControls ? <Text numberOfLines={1} variant="titleSmall" style={{ color: theme.colors.primary, flexShrink: 1, paddingHorizontal: 8 }}>{activeSurnames[0] || t('Family tree')}</Text> : null}
            {searchControls}
            <Text variant="labelSmall" accessibilityLabel={`${clusterPeople.length} ${t('people')}`} style={{ color: theme.colors.onSurfaceVariant, paddingHorizontal: 4 }}>{clusterPeople.length}</Text>
            <IconButton icon="magnify" size={23} accessibilityLabel={t('Find a family member')} onPress={() => setSearchExpanded(true)} style={{ margin: 0, width: 44, height: 44 }} />
          </View>}
          {searchExpanded && searchQuery.trim() ? (
            <View style={{ marginTop: 8 }}>
              {searchResults.map((person) => (
                <Button key={person.id} icon="account-search-outline" contentStyle={{ justifyContent: 'flex-start' }} onPress={() => { if (onSearchPerson) { setSearchQuery(''); onSearchPerson(person.id); } else focusPerson(person, mode); }}>
                  {formatPersonName(person)}
                </Button>
              ))}
              {searchResults.length === 0 ? <Text variant="bodySmall">{t('No family members found')}</Text> : null}
            </View>
          ) : null}
        </View>
        <View style={[styles.floatingControlsCard, { backgroundColor: theme.colors.surface, borderWidth: 0, borderRadius: 28 }]}>
          <Chip compact icon="magnify">{Math.round(scale * 100)}%</Chip>
          {currentUserPersonId && renderedPeopleById.has(currentUserPersonId) ? (
            windowWidth >= 900 ? <Button icon="account-star-outline" contentStyle={{ minHeight: 44 }} onPress={() => focusPerson(renderedPeopleById.get(currentUserPersonId)!, mode)}>{t('Find me in the tree')}</Button> : <IconButton icon="account-star-outline" size={24} accessibilityLabel={t('Find me in the tree')} onPress={() => focusPerson(renderedPeopleById.get(currentUserPersonId)!, mode)} />
          ) : null}
          <IconButton icon="minus" size={24} accessibilityLabel={t('Zoom out')} disabled={scale <= MIN_SCALE} mode="contained-tonal" onPress={() => zoomBy(-0.15)} />
          <IconButton icon="plus" size={24} accessibilityLabel={t('Zoom in')} disabled={scale >= MAX_SCALE} mode="contained-tonal" onPress={() => zoomBy(0.15)} />
          {windowWidth >= 900 ? <Button icon="fit-to-screen-outline" contentStyle={{ minHeight: 44 }} onPress={() => fitTo(activeViewportSize.width, activeViewportSize.height, undefined, mode)}>{t('Fit tree to screen')}</Button> : <IconButton icon="fit-to-screen-outline" size={24} mode="contained-tonal" accessibilityLabel={t('Fit tree to screen')} onPress={() => fitTo(activeViewportSize.width, activeViewportSize.height, undefined, mode)} />}
          <IconButton icon="vector-line" accessibilityLabel={t('Relationship lines')} onPress={() => setLineOptionsVisible(true)} />
          {allowFullscreen ? <Menu visible={toolsVisible} onDismiss={() => setToolsVisible(false)} anchor={<IconButton icon="dots-horizontal" accessibilityLabel={t('Tree tools')} onPress={() => setToolsVisible(true)} />}>
            <Menu.Item title={t(mode === 'fullscreen' ? 'Exit fullscreen' : 'Fullscreen')} leadingIcon="fullscreen" onPress={() => { setToolsVisible(false); setIsFullscreen(mode !== 'fullscreen'); }} />
          </Menu> : null}
        </View>
      </View>
  );

  const renderLineOptions = () => (
    <AdaptiveDialog visible={lineOptionsVisible} onDismiss={() => setLineOptionsVisible(false)} title={t('Relationship lines')}
      actions={<Button onPress={() => setLineOptionsVisible(false)}>{t('Done')}</Button>}>
      <Text variant="titleMedium">{t('Relationship lines')}</Text>
      <Text variant="bodySmall">{t('Choose visible lines. Hidden connections appear when you highlight someone involved.')}</Text>
      {lineOptions.map(option => <Checkbox.Item key={option.key} label={t(option.label)} labelStyle={{ color: option.color }}
        status={hiddenLineKinds.has(option.key) ? 'unchecked' : 'checked'}
        accessibilityLabel={t(option.label) + ': ' + t(hiddenLineKinds.has(option.key) ? 'Hidden' : 'Visible')}
        onPress={() => setHiddenLineKinds(current => { const next = new Set(current); if (next.has(option.key)) next.delete(option.key); else next.add(option.key); return next; })} />)}
    </AdaptiveDialog>
  );

  const renderViewport = (mode: 'inline' | 'fullscreen', viewportStyle?: object) => (
      <View
          {...panResponder.panHandlers}
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
            {[...visibleConnectors].sort((a, b) => {
              const active = (c: typeof a) => highlightedPathIds ? connectorOnPath(c.personIds, highlightedPathIds) : !!activeInspectionId && !!c.personIds?.includes(activeInspectionId);
              return Number(active(a)) - Number(active(b));
            }).map((c) => (
                <React.Fragment key={c.key}>
                  <Path
                      d={(highlightedPathIds ? connectorOnPath(c.personIds, highlightedPathIds) : activeInspectionId && c.personIds?.includes(activeInspectionId)) ? c.highlightedD ?? c.d : c.d}
                      fill="none"
                      stroke={c.stroke}
                      strokeWidth={c.strokeWidth + (highlightedPathIds && connectorOnPath(c.personIds, highlightedPathIds) ? 2 : activeInspectionId && c.personIds?.includes(activeInspectionId) ? 1.5 : 0)}
                      opacity={highlightedPathIds ? (connectorOnPath(c.personIds, highlightedPathIds) ? 1 : 0.12) : !activeInspectionId || c.personIds?.includes(activeInspectionId) ? 1 : 0.18}
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
                    dimensions={C}
                    compactCards={compactCards}
                    hasHiddenParents={!!hiddenParents?.get(person.id)?.length}
                    onShowParents={id => { anchorOverride.current = id; onRevealParents?.(id); }}
                    moreCount={moreChildren?.get(person.id)?.length ?? 0}
                    onReveal={id => { anchorOverride.current = id; onRevealChildren?.(id); }}
                    person={person}
                    x={x}
                    y={y}
                    showMaidenFamilyInNodeTitle={showMaidenFamilyInNodeTitle}
                    isCurrentUser={currentUserPersonId === person.id}
                    isFocusedPerson={highlightedPersonId === person.id || searchFocusId === person.id}
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
                    deferPhoto={false}
                    compactDetails={isLargeTreeMode && scale < 0.45}
                    isInspected={activeInspectionId === person.id}
                    isDimmed={!!relatedPersonIds && !relatedPersonIds.has(person.id)}
                    onInspect={inspectPerson}
                    onPress={handlePersonPress}
                />
            );
          })}
        </Animated.View>


        {floatingControls ? renderFloatingControls(mode) : null}
      </View>
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
                <IconButton icon="vector-line" accessibilityLabel={t('Relationship lines')} onPress={() => setLineOptionsVisible(true)} />
                {allowFullscreen ? <Button compact mode="contained-tonal" icon="fullscreen" onPress={() => setIsFullscreen(true)}>{t(K.common.fullscreen)}</Button> : null}
              </View>
            </View>
        ) : null}

        {renderViewport('inline', fillAvailableSpace ? styles.inlineViewportFill : { height: inlineViewportHeight })}
        {!isFullscreen ? renderLineOptions() : null}

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
            {isFullscreen ? renderLineOptions() : null}
          </View>
        </Modal>
      </View>
  );
}

const MemoizedCanvas = React.memo(FamilyTreeCanvas);
export default function ProfiledFamilyTreeCanvas(props: React.ComponentProps<typeof FamilyTreeCanvas>) {
  return <React.Profiler id="family-tree" onRender={(_id, _phase, actualDuration) => recordMetric('tree.render.ms', actualDuration)}><MemoizedCanvas {...props} /></React.Profiler>;
}
