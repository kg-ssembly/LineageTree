import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from 'react-native-paper';

type ScreenBackgroundProps = {
  variant?: 'soft-circles';
};

export function ScreenBackground({ variant = 'soft-circles' }: ScreenBackgroundProps) {
  const theme = useTheme();

  if (variant !== 'soft-circles') {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.backdrop, { backgroundColor: theme.colors.background }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <RadialGradient id="screenSecondaryGlow" cx="35%" cy="30%" r="62%">
            <Stop offset="0%" stopColor={theme.colors.secondaryContainer} stopOpacity={0.82} />
            <Stop offset="72%" stopColor={theme.colors.secondaryContainer} stopOpacity={0.36} />
            <Stop offset="100%" stopColor={theme.colors.secondaryContainer} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="screenTertiaryGlow" cx="72%" cy="68%" r="58%">
            <Stop offset="0%" stopColor={theme.colors.tertiaryContainer} stopOpacity={0.8} />
            <Stop offset="72%" stopColor={theme.colors.tertiaryContainer} stopOpacity={0.34} />
            <Stop offset="100%" stopColor={theme.colors.tertiaryContainer} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={92} cy={112} r={144} fill="url(#screenSecondaryGlow)" />
        <Circle cx={356} cy={648} r={124} fill="url(#screenTertiaryGlow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
