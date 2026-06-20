// Optimized FamilyTreeCanvas
// ---------------------------------------------------------------------------
// Improvements over the original:
//   1. Tidy-tree layout (Walker) keyed by spouse-group  → no card overlap.
//   2. Lane-allocated orthogonal connectors             → no line overlap.
//   3. Viewport culling                                  → unlimited nodes.
//   4. Per-node `Pressable`                              → reliable taps at
//      any zoom level (no manual hit-testing math).
//   5. Two-finger pinch + drag pan via PanResponder      → mobile zoom.
//   6. Cursor / pinch-anchored zoom                      → focus stays put.
//   7. CSS transform on web                              → 60fps pan/zoom.
//
// No new dependencies required — uses only react-native + react-native-svg
// + react-native-paper which are already in the project.
// ---------------------------------------------------------------------------

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Chip, IconButton, Menu, Text, useTheme } from 'react-native-paper';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import type { PersonRecord } from './dto/person';
import {
  getPersonFallbackAvatarIcon,
  getPersonLifeSpanLabel,
  getPersonPresenceLabel,
  getPreferredPersonPhoto,
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
  findFamilyBridges,
  findMaidenNameMembers,
  getConnectedSurnames,
  getSortedSurnames,
} from './family-tree-surname-clusters';

const styles = GlobalStyles.familyTreeCanvas;

// ---- Tunables ----
const C: LayoutConstants = DEFAULT_LAYOUT_CONSTANTS;
const MIN_SCALE = 0.15;
const MAX_SCALE = 4.0;
const AUTO_FIT_MAX_SCALE = 0.8; // default zoom cap on initial fit
const AUTO_FIT_MIN_SCALE_INLINE = 0.32;
const AUTO_FIT_MIN_SCALE_FULLSCREEN = 0.22;
const DRAG_ACTIVATION_DISTANCE = 6; // screen px — independent of zoom
const VIEWPORT_PADDING = 24;
const CULL_PADDING = 200; // px around viewport in canvas-space
// ------------------

interface FamilyTreeCanvasProps {
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  onPressPerson: (person: PersonRecord) => void;
  currentUserPersonId?: string;
  initialFocusPersonId?: string;
  descendantRootPersonId?: string;
  ascendantRootPersonId?: string;
  showMaidenFamilyInNodeTitle?: boolean;
  allowFullscreen?: boolean;
  floatingControls?: boolean;
  fillAvailableSpace?: boolean;
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
  return `${person.firstName} ${person.lastName}`.trim();
}

function formatPersonNodeTitle(person: PersonRecord, showMaidenFamilyInNodeTitle: boolean) {
  const name = formatPersonName(person);
  if (!showMaidenFamilyInNodeTitle || !person.maidenName?.trim()) {
    return name;
  }

  return `${name} (${person.maidenName.trim()})`;
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
  while (queue.length) {
    const cur = queue.shift()!;
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

// ---------------------------------------------------------------------------
// Memoized PersonNode — wrapped in Pressable so taps work at any zoom level
// ---------------------------------------------------------------------------
type PersonNodeProps = {
  person: PersonRecord;
  x: number;
  y: number;
  showMaidenFamilyInNodeTitle: boolean;
  isCurrentUser: boolean;
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
  onPress: (person: PersonRecord) => void;
};
const PersonNode = React.memo(function PersonNode(props: PersonNodeProps) {
  const {
    person, x, y, showMaidenFamilyInNodeTitle, isCurrentUser, isGhost, isCrossSurnameChild, isMaidenNameMember,
    surfaceColor, outlineColor, primaryColor, tertiaryColor, onTertiaryColor,
    variantSurface, variantOnSurface, onPrimaryColor,
    onPress,
  } = props;
  const photo = getPreferredPersonPhoto(person);

  const handlePress = useCallback(() => {
    onPress(person);
  }, [person, onPress]);

  const isHighlighted = isMaidenNameMember || isCrossSurnameChild;
  const borderColor = isHighlighted
    ? tertiaryColor
    : isGhost
    ? primaryColor
    : outlineColor;
  const borderWidth = isHighlighted ? 2.5 : 1;

  const badgeLabel = isMaidenNameMember
    ? `${person.maidenName!.trim()}`
    : isCrossSurnameChild
    ? '⬡ Mixed'
    : null;

  return (
      <Pressable
          onPress={handlePress}
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
              <Text variant="labelSmall" style={[styles.nodeBadgeText, { color: onPrimaryColor }]}>You</Text>
            </View>
        ) : badgeLabel ? (
            <View style={[styles.nodeBadge, { backgroundColor: tertiaryColor }]}>
              <Text variant="labelSmall" style={[styles.nodeBadgeText, { color: onTertiaryColor }]} numberOfLines={1}>{badgeLabel}</Text>
            </View>
        ) : null}
        <View style={styles.nodeInnerRow}>
          <View style={styles.nodeAvatarWrap}>
            {photo ? (
                <Image source={{ uri: photo.url }} style={styles.nodeAvatar} />
            ) : (
                <View style={[styles.nodeAvatarFallback, { borderColor: outlineColor, backgroundColor: variantSurface }]}>
                  <MaterialCommunityIcons name={getPersonFallbackAvatarIcon(person)} size={28} color={isHighlighted ? tertiaryColor : primaryColor} />
                </View>
            )}
          </View>
          <View style={styles.nodeTextWrap}>
            <Text variant="titleSmall" style={styles.nodeTitle} numberOfLines={2}>
              {formatPersonNodeTitle(person, showMaidenFamilyInNodeTitle)}
            </Text>
            <Text variant="bodySmall" style={[styles.nodeMeta, { color: variantOnSurface }]} numberOfLines={1}>{getPersonLifeSpanLabel(person)}</Text>
            <Text variant="bodySmall" style={[styles.nodeMeta, { color: variantOnSurface }]} numberOfLines={1}>{getPersonPresenceLabel(person)}</Text>
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
                            onPressPerson,
                            currentUserPersonId,
                            initialFocusPersonId,
                            descendantRootPersonId,
                            ascendantRootPersonId,
                            showMaidenFamilyInNodeTitle = false,
                            allowFullscreen = true,
                            floatingControls = false,
                            fillAvailableSpace = false,
                            familySwitchRef,
                            activeFamilyRef,
                          }: FamilyTreeCanvasProps) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const inlineViewportHeight = Math.max(420, windowHeight - 360);

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

  // ---- Lineage filter ----
  const lineageMode = ascendantRootPersonId ? 'ascendant' : descendantRootPersonId ? 'descendant' : 'full';
  const { renderedPeople, renderedRelationships } = useMemo(() => {
    if (ascendantRootPersonId) return buildLineageSubtree(people, relationships, ascendantRootPersonId, 'ascendant');
    if (descendantRootPersonId) return buildLineageSubtree(people, relationships, descendantRootPersonId, 'descendant');
    return { renderedPeople: people, renderedRelationships: relationships };
  }, [people, relationships, ascendantRootPersonId, descendantRootPersonId]);

  // ---- Surname clustering ----
  const surnameClusters = useMemo(
    () => buildSurnameClusters(renderedPeople),
    [renderedPeople],
  );
  const sortedSurnames = useMemo(
    () => getSortedSurnames(surnameClusters),
    [surnameClusters],
  );
  const allBridges = useMemo(
    () => findFamilyBridges(renderedPeople, renderedRelationships),
    [renderedPeople, renderedRelationships],
  );

  // Determine the "seed" person for initial surname selection (doesn't depend on layout).
  const seedFocusPersonId = initialFocusPersonId ?? ascendantRootPersonId ?? descendantRootPersonId ?? renderedPeople[0]?.id;

  // Auto-select initial surnames when data changes.
  useEffect(() => {
    if (sortedSurnames.length === 0) return;
    // Default to the largest surname. If the focused person has a surname, start there.
    let startSurname = sortedSurnames[0];
    if (seedFocusPersonId) {
      const focusPerson = renderedPeople.find((p) => p.id === seedFocusPersonId);
      if (focusPerson) {
        const fs = extractSurname(focusPerson);
        if (surnameClusters.has(fs)) startSurname = fs;
      }
    }
    setActiveSurnames([startSurname]);
  }, [sortedSurnames, seedFocusPersonId, renderedPeople, surnameClusters]);

  // Determine if clustering is active (more than 1 surname in the data → show one family at a time).
  const clusteringActive = sortedSurnames.length >= 2;

  // Filter people/relationships to active surnames.
  const {
    filteredPeople: clusterPeople,
    filteredRelationships: clusterRelationships,
    ghostPersonIds,
    activeBridges: clusterActiveBridges,
    externalBridges: clusterExternalBridges,
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
    return filterForActiveSurnames(renderedPeople, renderedRelationships, activeSurnames);
  }, [clusteringActive, renderedPeople, renderedRelationships, activeSurnames]);

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

  // State for the family-selector dropdown menu.
  const [familySelectorMenuVisible, setFamilySelectorMenuVisible] = useState(false);

  // ---- Layout (tidy tree) ----
  const layout = useMemo(
      () => layoutFamilyTree(clusterPeople, clusterRelationships, C),
      [clusterPeople, clusterRelationships],
  );
  const { positionsByPersonId, contentWidth, contentHeight } = layout;

  const contentBounds = useMemo(() => {
    if (positionsByPersonId.size === 0) {
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

    positionsByPersonId.forEach(({ x, y }) => {
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
  }, [positionsByPersonId, contentWidth, contentHeight]);

  // ---- Connectors (lane-allocated) ----
  const { spouseConnectors, parentChildConnectors } = useMemo(
      () => buildConnectors(clusterRelationships, layout, C, {
        parentChild: theme.colors.primary,
        spouse: theme.colors.secondary,
        secondaryParent: theme.colors.tertiary ?? theme.colors.outline,
      }, ghostPersonIds),
      [clusterRelationships, layout, theme.colors.primary, theme.colors.secondary, theme.colors.tertiary, theme.colors.outline, ghostPersonIds],
  );
  const allConnectors = useMemo(() => [...parentChildConnectors, ...spouseConnectors], [parentChildConnectors, spouseConnectors]);

  // ---- Cross-surname children ----
  // Detect children whose parents have different surnames (full pre-cluster dataset).
  const crossSurnameChildIds = useMemo(
    () => findCrossSurnameChildren(renderedPeople, renderedRelationships),
    [renderedPeople, renderedRelationships],
  );

  // ---- Maiden name members ----
  const maidenNameMemberIds = useMemo(
    () => findMaidenNameMembers(renderedPeople),
    [renderedPeople],
  );

  // ---- Active viewport ----
  const activeViewportSize = isFullscreen ? fullscreenViewportSize : inlineViewportSize;

  // ---- Auto-fit on first layout / when canvas size or focus changes ----
  const lastAutoFitKey = useRef<string | null>(null);
  const effectiveFocusId = useMemo(() => {
    if (initialFocusPersonId && positionsByPersonId.has(initialFocusPersonId)) return initialFocusPersonId;
    if (ascendantRootPersonId && positionsByPersonId.has(ascendantRootPersonId)) return ascendantRootPersonId;
    if (descendantRootPersonId && positionsByPersonId.has(descendantRootPersonId)) return descendantRootPersonId;
    return renderedPeople[0]?.id;
  }, [initialFocusPersonId, ascendantRootPersonId, descendantRootPersonId, positionsByPersonId, renderedPeople]);

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
    setScale(nextScale);
    setPan(nextPan);
  }, [contentBounds, positionsByPersonId]);

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
    const s0 = scaleRef.current;
    const p0 = panRef.current;
    const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    if (ns === s0) return;
    // Canvas point currently under focal:
    const cx = focalX / s0 - p0.x;
    const cy = focalY / s0 - p0.y;
    // Solve so the same canvas point lands at the same focal after scale change:
    const np = { x: focalX / ns - cx, y: focalY / ns - cy };
    setScale(ns);
    setPan(np);
  }, []);

  const zoomBy = useCallback((delta: number) => {
    const vw = (isFullscreen ? fullscreenViewportSize : inlineViewportSize).width;
    const vh = (isFullscreen ? fullscreenViewportSize : inlineViewportSize).height;
    zoomAt(vw / 2, vh / 2, scaleRef.current * (1 + delta));
  }, [zoomAt, isFullscreen, fullscreenViewportSize, inlineViewportSize]);

  const resetView = useCallback(() => {
    fitTo(activeViewportSize.width, activeViewportSize.height, effectiveFocusId, isFullscreen ? 'fullscreen' : 'inline');
  }, [fitTo, activeViewportSize, effectiveFocusId, isFullscreen]);

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
    setPan((cur) => ({ x: cur.x - dx / scaleRef.current, y: cur.y - dy / scaleRef.current }));
  }, [activeViewportSize.width, activeViewportSize.height, zoomAt]);

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
    // PanResponder gives us pageX; we need the focal in viewport-local coords.
    // We approximate using the average of the two touches relative to the
    // viewport origin, assuming the gesture layer covers it.
    return {
      x: (ts[0].locationX + ts[1].locationX) / 2,
      y: (ts[0].locationY + ts[1].locationY) / 2,
    };
  };

  const panResponder = useMemo(
      () => PanResponder.create({
        // Don't capture taps — let the underlying Pressable receive them.
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

          // Pinch?
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

          // Single-finger drag → pan in canvas space.
          pinchStateRef.current = null;
          setPan({
            x: dragStartPanRef.current.x + g.dx / scaleRef.current,
            y: dragStartPanRef.current.y + g.dy / scaleRef.current,
          });
        },
        onPanResponderRelease: () => { pinchStateRef.current = null; },
        onPanResponderTerminate: () => { pinchStateRef.current = null; },
        onPanResponderTerminationRequest: () => false,
      }),
      [zoomAt],
  );

  // ---- Viewport culling ----
  // Compute the visible canvas-space rect to skip off-screen nodes/connectors.
  const viewportRect = useMemo(() => {
    if (activeViewportSize.width <= 0 || activeViewportSize.height <= 0) {
      return { x: -Infinity, y: -Infinity, w: Infinity, h: Infinity };
    }
    return {
      x: -pan.x - CULL_PADDING / scale,
      y: -pan.y - CULL_PADDING / scale,
      w: activeViewportSize.width / scale + (2 * CULL_PADDING) / scale,
      h: activeViewportSize.height / scale + (2 * CULL_PADDING) / scale,
    };
  }, [pan.x, pan.y, scale, activeViewportSize.width, activeViewportSize.height]);

  const intersects = (b: { x: number; y: number; w: number; h: number }) => (
      b.x + b.w >= viewportRect.x &&
      b.x <= viewportRect.x + viewportRect.w &&
      b.y + b.h >= viewportRect.y &&
      b.y <= viewportRect.y + viewportRect.h
  );

  const visiblePeople = useMemo(() => clusterPeople.filter((p) => {
    const pos = positionsByPersonId.get(p.id);
    if (!pos) return false;
    return intersects({ x: pos.x, y: pos.y, w: C.NODE_WIDTH, h: C.NODE_HEIGHT });
  }), [clusterPeople, positionsByPersonId, viewportRect]);

  const visibleConnectors = useMemo(
      () => allConnectors.filter((c: Connector) => intersects(c.bounds)),
      [allConnectors, viewportRect],
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
  const controlsLabel = lineageMode === 'ascendant'
      ? 'Drag to pan, pinch / Ctrl-scroll to zoom through earlier generations.'
      : lineageMode === 'descendant'
          ? 'Drag to pan, pinch / Ctrl-scroll to zoom through descendants.'
          : 'Drag to pan, pinch or Ctrl+scroll to zoom.';
  const fullscreenTitle = lineageMode === 'ascendant' ? 'Full-screen ascendant tree'
      : lineageMode === 'descendant' ? 'Full-screen descendant tree' : 'Full-screen family tree';

  // ---- Render helpers ----
  const transformStyle = Platform.OS === 'web'
      ? ({ transform: `translate3d(${pan.x * scale}px, ${pan.y * scale}px, 0) scale(${scale})`, transformOrigin: '0 0' } as any)
      : { transform: [{ translateX: pan.x * scale }, { translateY: pan.y * scale }, { scale }], };

  const renderFloatingControls = (mode: 'inline' | 'fullscreen') => (
      <View pointerEvents="box-none" style={styles.viewportOverlay}>
        <View style={[styles.floatingHintCard, { backgroundColor: theme.colors.backdrop }]}>
          <Text variant="bodySmall" style={[styles.floatingHintText, { color: theme.colors.onPrimary }]}>{controlsLabel}</Text>
        </View>
        <View style={[styles.floatingControlsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
          <Chip compact icon="magnify">{scale.toFixed(2)}x</Chip>
          <IconButton icon="minus" size={18} mode="contained-tonal" onPress={() => zoomBy(-0.15)} />
          <IconButton icon="plus" size={18} mode="contained-tonal" onPress={() => zoomBy(0.15)} />
          <Button compact mode="contained-tonal" onPress={resetView}>Reset</Button>
          {allowFullscreen ? (
              mode === 'fullscreen'
                  ? <Button compact mode="contained" icon="close" onPress={() => setIsFullscreen(false)}>Close</Button>
                  : <Button compact mode="contained" icon="fullscreen" onPress={() => setIsFullscreen(true)}>Fullscreen</Button>
          ) : null}
        </View>
      </View>
  );

  const renderViewport = (mode: 'inline' | 'fullscreen', viewportStyle?: object) => (
      <View
          {...panResponder.panHandlers}
          {...(Platform.OS === 'web' ? ({ onWheel: handleWheel } as any) : {})}
          style={[
            styles.viewport,
            { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.elevation.level1, overflow: 'hidden' },
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
                backgroundColor: theme.colors.elevation.level1,
              },
              transformStyle,
            ]}
            pointerEvents="box-none"
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
                  {c.label && c.labelPosition ? (
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

          {visiblePeople.map((person) => {
            const pos = positionsByPersonId.get(person.id);
            if (!pos) return null;
            return (
                <PersonNode
                    key={person.id}
                    person={person}
                    x={pos.x}
                    y={pos.y}
                    showMaidenFamilyInNodeTitle={showMaidenFamilyInNodeTitle}
                    isCurrentUser={currentUserPersonId === person.id}
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
                    onPress={onPressPerson}
                />
            );
          })}
        </Animated.View>


        {floatingControls ? renderFloatingControls(mode) : null}
      </View>
  );

  // ---- Surname selector bar ----
  // Shows the CURRENT family prominently. Tapping it opens a menu of the
  // OTHER available families to switch to.
  const renderSurnameSelector = () => {
    if (!clusteringActive) return null;

    const currentSurname = activeSurnames[0] ?? '';
    const otherSurnames = sortedSurnames.filter((s) => s !== currentSurname);

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>Viewing:</Text>
        <Menu
          visible={familySelectorMenuVisible}
          onDismiss={() => setFamilySelectorMenuVisible(false)}
          anchor={
            <Chip
              compact
              selected
              mode="flat"
              icon="check"
              closeIcon="chevron-down"
              onPress={() => setFamilySelectorMenuVisible(true)}
              onClose={() => setFamilySelectorMenuVisible(true)}
              style={{ backgroundColor: theme.colors.primaryContainer }}
              textStyle={{ color: theme.colors.onPrimaryContainer }}
            >
              {currentSurname} family
            </Chip>
          }
        >
          {otherSurnames.length > 0 ? (
            otherSurnames.map((surname) => {
              const isConnected = getConnectedSurnames(currentSurname, allBridges).includes(surname);
              return (
                <Menu.Item
                  key={surname}
                  leadingIcon={isConnected ? 'link-variant' : 'swap-horizontal'}
                  title={`${surname} family`}
                  onPress={() => {
                    setFamilySelectorMenuVisible(false);
                    navigateToSurname(surname);
                  }}
                />
              );
            })
          ) : (
            <Menu.Item title="No other families found" disabled />
          )}
        </Menu>
      </View>
    );
  };

  return (
      <View style={[styles.container, fillAvailableSpace ? styles.containerFill : null]}>
        {renderSurnameSelector()}
        {!floatingControls ? (
            <View style={styles.controlsRow}>
              <Text variant="bodyMedium">{controlsLabel}</Text>
              <View style={styles.zoomButtonsRow}>
                <Chip compact icon="magnify-minus">{scale.toFixed(2)}x</Chip>
                <Button compact mode="outlined" onPress={() => zoomBy(-0.15)}>-</Button>
                <Button compact mode="outlined" onPress={() => zoomBy(0.15)}>+</Button>
                <Button compact onPress={resetView}>Reset</Button>
                {allowFullscreen ? <Button compact mode="contained-tonal" icon="fullscreen" onPress={() => setIsFullscreen(true)}>Fullscreen</Button> : null}
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
                    <IconButton icon="close" onPress={() => setIsFullscreen(false)} />
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
