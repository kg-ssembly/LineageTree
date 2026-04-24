import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
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
  allowFullscreen?: boolean;
}

type NodePosition = {
  x: number;
  y: number;
};

const NODE_WIDTH = 152;
const NODE_HEIGHT = 84;
const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 120;
const PADDING = 48;
const MIN_SCALE = 0.7;
const MAX_SCALE = 1.8;

function formatPersonName(person: PersonRecord) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function buildGenerations(people: PersonRecord[], relationships: RelationshipRecord[]) {
  const parentChildRelationships = relationships.filter((relationship) => relationship.type === 'parent-child');
  const parentIdsByChildId = new Map<string, Set<string>>();
  const childIdsByParentId = new Map<string, Set<string>>();

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

  const levelByPersonId = new Map<string, number>();
  const roots = people
    .filter((person) => !parentIdsByChildId.get(person.id)?.size)
    .sort((left, right) => formatPersonName(left).localeCompare(formatPersonName(right)));
  const queue = roots.map((person) => ({ personId: person.id, level: 0 }));

  roots.forEach((person) => levelByPersonId.set(person.id, 0));

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = [...(childIdsByParentId.get(current.personId) ?? new Set<string>())];

    children.forEach((childId) => {
      const nextLevel = current.level + 1;
      if (!levelByPersonId.has(childId) || nextLevel > levelByPersonId.get(childId)!) {
        levelByPersonId.set(childId, nextLevel);
        queue.push({ personId: childId, level: nextLevel });
      }
    });
  }

  let fallbackLevel = Math.max(0, ...levelByPersonId.values()) + 1;
  people.forEach((person) => {
    if (!levelByPersonId.has(person.id)) {
      levelByPersonId.set(person.id, fallbackLevel);
      fallbackLevel += 1;
    }
  });

  const groupedPeople = new Map<number, PersonRecord[]>();
  people.forEach((person) => {
    const level = levelByPersonId.get(person.id) ?? 0;
    if (!groupedPeople.has(level)) {
      groupedPeople.set(level, []);
    }
    groupedPeople.get(level)!.push(person);
  });

  [...groupedPeople.values()].forEach((levelPeople) => {
    levelPeople.sort((left, right) => formatPersonName(left).localeCompare(formatPersonName(right)));
  });

  return groupedPeople;
}

export default function FamilyTreeCanvas({ people, relationships, onPressPerson, allowFullscreen = true }: FamilyTreeCanvasProps) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { positionsByPersonId, canvasWidth, canvasHeight } = useMemo(() => {
    const groupedPeople = buildGenerations(people, relationships);
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
      const rowWidth = levelPeople.length * NODE_WIDTH + Math.max(0, levelPeople.length - 1) * HORIZONTAL_GAP;
      const startX = Math.max(PADDING, (calculatedCanvasWidth - rowWidth) / 2);
      const y = PADDING + level * (NODE_HEIGHT + VERTICAL_GAP);

      levelPeople.forEach((person, index) => {
        positions.set(person.id, {
          x: startX + index * (NODE_WIDTH + HORIZONTAL_GAP),
          y,
        });
      });
    });

    return {
      positionsByPersonId: positions,
      canvasWidth: calculatedCanvasWidth,
      canvasHeight: calculatedCanvasHeight,
    };
  }, [people, relationships]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.extractOffset();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
      },
    }),
    [pan],
  );

  const handleZoom = (delta: number) => {
    setScale((current) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((current + delta).toFixed(2)))));
  };

  const resetView = () => {
    setScale(1);
    pan.setValue({ x: 0, y: 0 });
    pan.setOffset({ x: 0, y: 0 });
  };

  const renderCanvasViewport = (viewportStyle?: object) => (
    <View style={[styles.viewport, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.elevation.level1 }, viewportStyle]}>
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

      {renderCanvasViewport()}

      <Modal visible={isFullscreen} animationType="slide" onRequestClose={() => setIsFullscreen(false)}>
        <View style={[styles.fullscreenContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.fullscreenHeader}>
            <Text variant="titleLarge">Full-screen family tree</Text>
            <IconButton icon="close" onPress={() => setIsFullscreen(false)} />
          </View>
          <Text variant="bodyMedium" style={[styles.fullscreenSubtitle, { color: theme.colors.onSurfaceVariant }]}>Pan around the full tree and zoom into branches in more detail.</Text>
          {renderCanvasViewport({ height: Math.max(320, windowHeight - 172), borderRadius: 24 })}
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
    borderRadius: 20,
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
    borderRadius: 16,
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
  nodeTitle: {
    fontWeight: '700',
  },
  nodeMeta: {
    color: '#6B6B74',
    marginTop: 4,
  },
});

