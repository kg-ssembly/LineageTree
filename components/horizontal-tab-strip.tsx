import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';

type TabItem<Key extends string> = {
  key: Key;
  label: string;
};

interface HorizontalTabStripProps<Key extends string> {
  items: Array<TabItem<Key>>;
  activeKey: Key;
  onChange: (key: Key) => void;
  containerStyle?: any;
  contentContainerStyle?: any;
  itemStyle?: any;
}

export default function HorizontalTabStrip<Key extends string>({
  items,
  activeKey,
  onChange,
  containerStyle,
  contentContainerStyle,
  itemStyle,
}: HorizontalTabStripProps<Key>) {
  const theme = useTheme();
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  const hasOverflow = contentWidth > viewportWidth + 4;
  const showLeftHint = hasOverflow && scrollOffset > 12;
  const showRightHint = hasOverflow && scrollOffset < contentWidth - viewportWidth - 12;

  const hintBackground = useMemo(
    () => theme.dark ? 'rgba(18, 18, 18, 0.88)' : 'rgba(255, 255, 255, 0.92)',
    [theme.dark],
  );

  return (
    <View style={[styles.container, containerStyle]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContentWidth(width)}
        onScroll={(event) => setScrollOffset(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
      >
        {items.map((tab) => {
          const isActive = activeKey === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={[
                styles.item,
                itemStyle,
                isActive && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 },
              ]}
            >
              <Text variant="labelLarge" style={{ color: isActive ? theme.colors.primary : theme.colors.onSurfaceVariant }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {showLeftHint ? (
        <View pointerEvents="none" style={[styles.hint, styles.leftHint, { backgroundColor: hintBackground }]}>
          <MaterialCommunityIcons name="chevron-left" size={16} color={theme.colors.onSurfaceVariant} />
        </View>
      ) : null}

      {showRightHint ? (
        <View pointerEvents="none" style={[styles.hint, styles.rightHint, { backgroundColor: hintBackground, borderColor: theme.colors.outlineVariant }]}>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            More
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={theme.colors.onSurfaceVariant} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 2,
  },
  hint: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftHint: {
    left: 0,
    paddingLeft: 6,
    paddingRight: 4,
  },
  rightHint: {
    right: 0,
    flexDirection: 'row',
    gap: 2,
    paddingLeft: 10,
    paddingRight: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
});
