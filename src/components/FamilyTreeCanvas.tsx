import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import Svg, { Line } from 'react-native-svg';
import type { PersonRecord } from '../types/person';
import { getPersonLifeSpanLabel, getPersonPresenceLabel, getPreferredPersonPhoto } from '../types/person';
import type { RelationshipRecord } from '../types/relationship';

interface FamilyTreeCanvasProps {
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  onPressPerson: (person: PersonRecord) => void;
  currentUserPersonId?: string;
  initialFocusPersonId?: string;
  allowFullscreen?: boolean;
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

type GenerationLayout = {
  groupedPeople: Map<number, PersonRecord[]>;
  spouseGroupIdsByPersonId: Map<string, string>;
};

function formatPersonName(person: PersonRecord) {
  return `${person.firstName} ${person.lastName}`.trim();
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

  spouseGroupIdsByLevel.forEach((spouseGroupIds, level) => {
    spouseGroupIds
      .sort((left, right) => {
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
  };
}

export default function FamilyTreeCanvas({
  people,
  relationships,
  onPressPerson,
  currentUserPersonId,
  initialFocusPersonId,
  allowFullscreen = true,
}: FamilyTreeCanvasProps) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragStartPanRef = useRef({ x: 0, y: 0 });
  const lastAutoFitKeyRef = useRef<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inlineViewportSize, setInlineViewportSize] = useState({ width: 0, height: 0 });
  const [fullscreenViewportSize, setFullscreenViewportSize] = useState({ width: 0, height: 0 });

  const { positionsByPersonId, canvasWidth, canvasHeight } = useMemo(() => {
    const { groupedPeople, spouseGroupIdsByPersonId } = buildGenerations(people, relationships);
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
  }, [people, relationships]);

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
    const minTranslateX = scaledCanvasWidth <= activeSize.width ? centeredTranslateX : activeSize.width - scaledCanvasWidth;
    const maxTranslateX = scaledCanvasWidth <= activeSize.width ? centeredTranslateX : 0;
    const minTranslateY = scaledCanvasHeight <= activeSize.height ? centeredTranslateY : activeSize.height - scaledCanvasHeight;
    const maxTranslateY = scaledCanvasHeight <= activeSize.height ? centeredTranslateY : 0;

    return {
      x: Math.min(maxTranslateX / safeScale, Math.max(minTranslateX / safeScale, desiredPan.x)),
      y: Math.min(maxTranslateY / safeScale, Math.max(minTranslateY / safeScale, desiredPan.y)),
    };
  };

  const clampCurrentPanToViewport = (targetScale: number) => {
    pan.stopAnimation((value) => {
      pan.setValue(clampPanPoint(value, targetScale));
    });
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.stopAnimation((value) => {
          dragStartPanRef.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const desiredPan = {
          x: dragStartPanRef.current.x + (gestureState.dx / scale),
          y: dragStartPanRef.current.y + (gestureState.dy / scale),
        };
        pan.setValue(clampPanPoint(desiredPan, scale));
      },
      onPanResponderRelease: () => {
        clampCurrentPanToViewport(scale);
      },
      onPanResponderTerminate: () => {
        clampCurrentPanToViewport(scale);
      },
    }),
    [canvasHeight, canvasWidth, fullscreenViewportSize, inlineViewportSize, isFullscreen, pan, scale],
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
    pan.setValue({
      x: clampedTranslateX / safeScale,
      y: clampedTranslateY / safeScale,
    });
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
      initialFocusPersonId ?? '',
    ].join(':');

    if (lastAutoFitKeyRef.current === autoFitKey) {
      return;
    }

    applyFitTransform(activeViewportSize.width, activeViewportSize.height, initialFocusPersonId);
    lastAutoFitKeyRef.current = autoFitKey;
  }, [
    activeViewportSize.height,
    activeViewportSize.width,
    canvasHeight,
    canvasWidth,
    initialFocusPersonId,
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

  const renderCanvasViewport = (mode: 'inline' | 'fullscreen', viewportStyle?: object) => (
    <View
      style={[styles.viewport, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.elevation.level1 }, viewportStyle]}
      onLayout={handleViewportLayout(mode)}
    >
      <Animated.View
        {...panResponder.panHandlers}
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
        <Svg width={canvasWidth} height={canvasHeight} style={StyleSheet.absoluteFill}>
          {relationships.map((relationship) => {
            const fromPosition = positionsByPersonId.get(relationship.fromPersonId);
            const toPosition = positionsByPersonId.get(relationship.toPersonId);

            if (!fromPosition || !toPosition) {
              return null;
            }

            const isSpouse = relationship.type === 'spouse';
            const x1 = fromPosition.x + NODE_WIDTH / 2;
            const y1 = fromPosition.y + (isSpouse ? NODE_HEIGHT / 2 : NODE_HEIGHT);
            const x2 = toPosition.x + NODE_WIDTH / 2;
            const y2 = toPosition.y + (isSpouse ? NODE_HEIGHT / 2 : 0);

            return (
              <Line
                key={relationship.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isSpouse ? theme.colors.secondary : theme.colors.primary}
                strokeWidth={isSpouse ? 4 : 3}
                strokeDasharray={isSpouse ? '0' : '8 4'}
              />
            );
          })}
        </Svg>

        {people.map((person) => {
          const position = positionsByPersonId.get(person.id);
          const preferredPhoto = getPreferredPersonPhoto(person);
          const isCurrentUsersPerson = currentUserPersonId === person.id;
          if (!position) {
            return null;
          }

          return (
            <Pressable
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
              onPress={() => onPressPerson(person)}
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
                      <MaterialCommunityIcons name="account" size={28} color={theme.colors.primary} />
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
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.controlsRow}>
        <Text variant="bodyMedium">Drag to pan, use zoom controls to focus on branches.</Text>
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

      {renderCanvasViewport('inline')}

      <Modal visible={isFullscreen} animationType="slide" onRequestClose={() => setIsFullscreen(false)}>
        <View style={[styles.fullscreenContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.fullscreenHeader}>
            <Text variant="titleLarge">Full-screen family tree</Text>
            <IconButton icon="close" onPress={() => setIsFullscreen(false)} />
          </View>
          <Text variant="bodyMedium" style={[styles.fullscreenSubtitle, { color: theme.colors.onSurfaceVariant }]}>Pan around the full tree and zoom into branches in more detail.</Text>
          {renderCanvasViewport('fullscreen', { height: Math.max(320, windowHeight - 172), borderRadius: 5 })}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  zoomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  viewport: {
    height: 360,
    overflow: 'hidden',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#DDD8FF',
    backgroundColor: '#F5F2FF',
  },
  fullscreenContainer: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fullscreenSubtitle: {
    marginTop: 4,
    marginBottom: 12,
  },
  canvas: {
    backgroundColor: '#F5F2FF',
  },
  node: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#CFC5FF',
    padding: 12,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  nodeInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nodeAvatarWrap: {
    flexShrink: 0,
  },
  nodeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#CFC5FF',
    backgroundColor: '#ECE8FF',
  },
  nodeAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#CFC5FF',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeTextWrap: {
    flex: 1,
  },
  nodeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 1,
  },
  nodeBadgeText: {
    fontWeight: '700',
  },
  nodeTitle: {
    fontWeight: '700',
  },
  nodeMeta: {
    color: '#6B6B74',
    marginTop: 4,
  },
});

