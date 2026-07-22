import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useTheme } from 'react-native-paper';
import { useI18n } from '../hooks/use-i18n';

type TabItem<Key extends string> = {
  key: Key;
  label: string;
  icon?: string;
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
  const { t } = useI18n();
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

  const tabItems = items.map((tab) => {
    const isActive = activeKey === tab.key;
    return (
      <Pressable
        key={tab.key}
        onPress={() => onChange(tab.key)}
        style={[
          styles.item,
          itemStyle,
          Platform.OS === 'web' ? styles.webItem : null,
          {
            backgroundColor: isActive ? theme.colors.primaryContainer : theme.colors.surface,
            borderColor: isActive ? theme.colors.primary : theme.colors.outlineVariant,
          },
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
      >
        <View style={[styles.activeBar, { backgroundColor: isActive ? theme.colors.primary : 'transparent' }]} />
        {tab.icon ? <MaterialCommunityIcons name={tab.icon as never} size={18} color={isActive ? theme.colors.primary : theme.colors.onSurfaceVariant} /> : null}
        <Text variant="labelMedium" style={{ flex: 1, color: isActive ? theme.colors.primary : theme.colors.onSurfaceVariant }}>
          {tab.label}
        </Text>
      </Pressable>
    );
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {Platform.OS === 'web' ? (
        <View style={[styles.content, styles.webContent, contentContainerStyle]}>{tabItems}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
          onContentSizeChange={(width) => setContentWidth(width)}
          onScroll={(event) => setScrollOffset(event.nativeEvent.contentOffset.x)}
          scrollEventThrottle={16}
        >
          {tabItems}
        </ScrollView>
      )}

      {Platform.OS !== 'web' && showLeftHint ? (
        <View pointerEvents="none" style={[styles.hint, styles.leftHint, { backgroundColor: hintBackground }]}>
          <MaterialCommunityIcons name="chevron-left" size={16} color={theme.colors.onSurfaceVariant} />
        </View>
      ) : null}

      {Platform.OS !== 'web' && showRightHint ? (
        <View pointerEvents="none" style={[styles.hint, styles.rightHint, { backgroundColor: hintBackground, borderColor: theme.colors.outlineVariant }]}>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('More')}
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
    gap: 8,
  },
  webContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  item: {
    minHeight: 46,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  webItem: {
    flex: 1,
    flexBasis: 0,
  },
  activeBar: {
    width: 3,
    height: 20,
    borderRadius: 2,
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
