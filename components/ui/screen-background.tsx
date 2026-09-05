import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from 'react-native-paper';

export type ScreenBackgroundVariant =
  | 'soft-circles'
  | 'aurora'
  | 'canopy'
  | 'sunrise'
  | 'lagoon'
  | 'ember'
  | 'grove'
  | 'mist';

type GlowStop = {
  offset: string;
  opacity: number;
};

type GlowShape = {
  type: 'circle' | 'ellipse';
  gradientId: string;
  colorToken: 'primaryContainer' | 'secondaryContainer' | 'tertiaryContainer';
  cx: number;
  cy: number;
  radius?: number;
  rx?: number;
  ry?: number;
  gradientCx: string;
  gradientCy: string;
  gradientR: string;
  stops: GlowStop[];
};

type ScreenBackgroundProps = {
  variant?: ScreenBackgroundVariant;
};

const fadeStops: GlowStop[] = [
  { offset: '0%', opacity: 0.84 },
  { offset: '68%', opacity: 0.34 },
  { offset: '100%', opacity: 0 },
];

const variants: Record<ScreenBackgroundVariant, GlowShape[]> = {
  'soft-circles': [
    {
      type: 'circle',
      gradientId: 'screenSecondaryGlow',
      colorToken: 'secondaryContainer',
      cx: 92,
      cy: 112,
      radius: 172,
      gradientCx: '32%',
      gradientCy: '26%',
      gradientR: '68%',
      stops: [
        { offset: '0%', opacity: 0.9 },
        { offset: '56%', opacity: 0.54 },
        { offset: '100%', opacity: 0 },
      ],
    },
    {
      type: 'circle',
      gradientId: 'screenTertiaryGlow',
      colorToken: 'tertiaryContainer',
      cx: 356,
      cy: 648,
      radius: 152,
      gradientCx: '76%',
      gradientCy: '72%',
      gradientR: '64%',
      stops: [
        { offset: '0%', opacity: 0.86 },
        { offset: '58%', opacity: 0.44 },
        { offset: '100%', opacity: 0 },
      ],
    },
    {
      type: 'ellipse',
      gradientId: 'screenSoftPrimaryGlow',
      colorToken: 'primaryContainer',
      cx: 238,
      cy: 402,
      rx: 148,
      ry: 184,
      gradientCx: '52%',
      gradientCy: '48%',
      gradientR: '62%',
      stops: [
        { offset: '0%', opacity: 0.42 },
        { offset: '52%', opacity: 0.18 },
        { offset: '100%', opacity: 0 },
      ],
    },
  ],
  aurora: [
    {
      type: 'ellipse',
      gradientId: 'screenAuroraPrimaryGlow',
      colorToken: 'primaryContainer',
      cx: 236,
      cy: 96,
      rx: 232,
      ry: 144,
      gradientCx: '50%',
      gradientCy: '22%',
      gradientR: '74%',
      stops: fadeStops,
    },
    {
      type: 'circle',
      gradientId: 'screenAuroraSecondaryGlow',
      colorToken: 'secondaryContainer',
      cx: 68,
      cy: 388,
      radius: 158,
      gradientCx: '24%',
      gradientCy: '48%',
      gradientR: '60%',
      stops: [
        { offset: '0%', opacity: 0.7 },
        { offset: '65%', opacity: 0.28 },
        { offset: '100%', opacity: 0 },
      ],
    },
    {
      type: 'ellipse',
      gradientId: 'screenAuroraTertiaryGlow',
      colorToken: 'tertiaryContainer',
      cx: 344,
      cy: 640,
      rx: 188,
      ry: 210,
      gradientCx: '76%',
      gradientCy: '78%',
      gradientR: '68%',
      stops: [
        { offset: '0%', opacity: 0.72 },
        { offset: '66%', opacity: 0.26 },
        { offset: '100%', opacity: 0 },
      ],
    },
  ],
  canopy: [
    {
      type: 'circle',
      gradientId: 'screenCanopyPrimaryGlow',
      colorToken: 'primaryContainer',
      cx: 46,
      cy: 102,
      radius: 148,
      gradientCx: '18%',
      gradientCy: '18%',
      gradientR: '64%',
      stops: fadeStops,
    },
    {
      type: 'ellipse',
      gradientId: 'screenCanopySecondaryGlow',
      colorToken: 'secondaryContainer',
      cx: 328,
      cy: 248,
      rx: 174,
      ry: 132,
      gradientCx: '84%',
      gradientCy: '34%',
      gradientR: '64%',
      stops: [
        { offset: '0%', opacity: 0.78 },
        { offset: '64%', opacity: 0.3 },
        { offset: '100%', opacity: 0 },
      ],
    },
    {
      type: 'circle',
      gradientId: 'screenCanopyTertiaryGlow',
      colorToken: 'tertiaryContainer',
      cx: 190,
      cy: 724,
      radius: 178,
      gradientCx: '52%',
      gradientCy: '82%',
      gradientR: '72%',
      stops: [
        { offset: '0%', opacity: 0.76 },
        { offset: '66%', opacity: 0.24 },
        { offset: '100%', opacity: 0 },
      ],
    },
  ],
  sunrise: [
    {
      type: 'ellipse',
      gradientId: 'screenSunrisePrimaryGlow',
      colorToken: 'secondaryContainer',
      cx: 332,
      cy: 74,
      rx: 170,
      ry: 122,
      gradientCx: '84%',
      gradientCy: '16%',
      gradientR: '58%',
      stops: [
        { offset: '0%', opacity: 0.86 },
        { offset: '66%', opacity: 0.34 },
        { offset: '100%', opacity: 0 },
      ],
    },
    {
      type: 'circle',
      gradientId: 'screenSunriseSecondaryGlow',
      colorToken: 'primaryContainer',
      cx: 112,
      cy: 244,
      radius: 152,
      gradientCx: '30%',
      gradientCy: '36%',
      gradientR: '66%',
      stops: fadeStops,
    },
    {
      type: 'ellipse',
      gradientId: 'screenSunriseTertiaryGlow',
      colorToken: 'tertiaryContainer',
      cx: 286,
      cy: 676,
      rx: 220,
      ry: 164,
      gradientCx: '68%',
      gradientCy: '80%',
      gradientR: '70%',
      stops: [
        { offset: '0%', opacity: 0.74 },
        { offset: '68%', opacity: 0.22 },
        { offset: '100%', opacity: 0 },
      ],
    },
  ],
  lagoon: [
    {
      type: 'ellipse',
      gradientId: 'screenLagoonPrimaryGlow',
      colorToken: 'primaryContainer',
      cx: 210,
      cy: 126,
      rx: 248,
      ry: 156,
      gradientCx: '46%',
      gradientCy: '24%',
      gradientR: '76%',
      stops: [
        { offset: '0%', opacity: 0.88 },
        { offset: '62%', opacity: 0.34 },
        { offset: '100%', opacity: 0 },
      ],
    },
    {
      type: 'circle',
      gradientId: 'screenLagoonSecondaryGlow',
      colorToken: 'tertiaryContainer',
      cx: 356,
      cy: 404,
      radius: 168,
      gradientCx: '78%',
      gradientCy: '50%',
      gradientR: '62%',
      stops: [
        { offset: '0%', opacity: 0.72 },
        { offset: '64%', opacity: 0.28 },
        { offset: '100%', opacity: 0 },
      ],
    },
    {
      type: 'ellipse',
      gradientId: 'screenLagoonTertiaryGlow',
      colorToken: 'secondaryContainer',
      cx: 92,
      cy: 708,
      rx: 178,
      ry: 206,
      gradientCx: '18%',
      gradientCy: '82%',
      gradientR: '70%',
      stops: [
        { offset: '0%', opacity: 0.7 },
        { offset: '66%', opacity: 0.22 },
        { offset: '100%', opacity: 0 },
      ],
    },
  ],
  ember: [
    {
      type: 'circle',
      gradientId: 'screenEmberPrimaryGlow',
      colorToken: 'secondaryContainer',
      cx: 318,
      cy: 84,
      radius: 146,
      gradientCx: '80%',
      gradientCy: '20%',
      gradientR: '58%',
      stops: [
        { offset: '0%', opacity: 0.9 },
        { offset: '60%', opacity: 0.4 },
        { offset: '100%', opacity: 0 },
      ],
    },
    {
      type: 'ellipse',
      gradientId: 'screenEmberSecondaryGlow',
      colorToken: 'tertiaryContainer',
      cx: 120,
      cy: 342,
      rx: 204,
      ry: 148,
      gradientCx: '28%',
      gradientCy: '46%',
      gradientR: '70%',
      stops: [
        { offset: '0%', opacity: 0.76 },
        { offset: '62%', opacity: 0.3 },
        { offset: '100%', opacity: 0 },
      ],
    },
    {
      type: 'ellipse',
      gradientId: 'screenEmberTertiaryGlow',
      colorToken: 'primaryContainer',
      cx: 286,
      cy: 700,
      rx: 230,
      ry: 172,
      gradientCx: '66%',
      gradientCy: '82%',
      gradientR: '72%',
      stops: [
        { offset: '0%', opacity: 0.66 },
        { offset: '64%', opacity: 0.22 },
        { offset: '100%', opacity: 0 },
      ],
    },
  ],
  grove: [
    {
      type: 'ellipse',
      gradientId: 'screenGrovePrimaryGlow',
      colorToken: 'primaryContainer',
      cx: 44,
      cy: 166,
      rx: 166,
      ry: 220,
      gradientCx: '14%',
      gradientCy: '24%',
      gradientR: '66%',
      stops: fadeStops,
    },
    {
      type: 'ellipse',
      gradientId: 'screenGroveSecondaryGlow',
      colorToken: 'secondaryContainer',
      cx: 332,
      cy: 250,
      rx: 152,
      ry: 126,
      gradientCx: '84%',
      gradientCy: '34%',
      gradientR: '60%',
      stops: [
        { offset: '0%', opacity: 0.72 },
        { offset: '62%', opacity: 0.28 },
        { offset: '100%', opacity: 0 },
      ],
    },
    {
      type: 'circle',
      gradientId: 'screenGroveTertiaryGlow',
      colorToken: 'tertiaryContainer',
      cx: 208,
      cy: 620,
      radius: 194,
      gradientCx: '54%',
      gradientCy: '76%',
      gradientR: '74%',
      stops: [
        { offset: '0%', opacity: 0.74 },
        { offset: '68%', opacity: 0.26 },
        { offset: '100%', opacity: 0 },
      ],
    },
  ],
  mist: [
    {
      type: 'ellipse',
      gradientId: 'screenMistPrimaryGlow',
      colorToken: 'tertiaryContainer',
      cx: 212,
      cy: 78,
      rx: 260,
      ry: 116,
      gradientCx: '50%',
      gradientCy: '18%',
      gradientR: '76%',
      stops: [
        { offset: '0%', opacity: 0.64 },
        { offset: '58%', opacity: 0.22 },
        { offset: '100%', opacity: 0 },
      ],
    },
    {
      type: 'circle',
      gradientId: 'screenMistSecondaryGlow',
      colorToken: 'primaryContainer',
      cx: 92,
      cy: 462,
      radius: 184,
      gradientCx: '26%',
      gradientCy: '56%',
      gradientR: '66%',
      stops: [
        { offset: '0%', opacity: 0.68 },
        { offset: '64%', opacity: 0.24 },
        { offset: '100%', opacity: 0 },
      ],
    },
    {
      type: 'ellipse',
      gradientId: 'screenMistTertiaryGlow',
      colorToken: 'secondaryContainer',
      cx: 324,
      cy: 694,
      rx: 188,
      ry: 154,
      gradientCx: '74%',
      gradientCy: '82%',
      gradientR: '66%',
      stops: [
        { offset: '0%', opacity: 0.62 },
        { offset: '60%', opacity: 0.2 },
        { offset: '100%', opacity: 0 },
      ],
    },
  ],
};

export function ScreenBackground({ variant = 'soft-circles' }: ScreenBackgroundProps) {
  const theme = useTheme();
  const shapes = variants[variant];

  return (
    <View pointerEvents="none" style={[styles.backdrop, { backgroundColor: theme.colors.background }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
        <Defs>
          {shapes.map((shape) => (
            <RadialGradient
              key={shape.gradientId}
              id={shape.gradientId}
              cx={shape.gradientCx}
              cy={shape.gradientCy}
              r={shape.gradientR}
            >
              {shape.stops.map((stop) => (
                <Stop
                  key={`${shape.gradientId}-${stop.offset}`}
                  offset={stop.offset}
                  stopColor={theme.colors[shape.colorToken]}
                  stopOpacity={stop.opacity * (theme.dark ? 0.25 : 0.45)}
                />
              ))}
            </RadialGradient>
          ))}
        </Defs>
        {shapes.map((shape) => (
          shape.type === 'circle' ? (
            <Circle
              key={shape.gradientId}
              cx={shape.cx}
              cy={shape.cy}
              r={shape.radius ?? 0}
              fill={`url(#${shape.gradientId})`}
            />
          ) : (
            <Ellipse
              key={shape.gradientId}
              cx={shape.cx}
              cy={shape.cy}
              rx={shape.rx ?? 0}
              ry={shape.ry ?? 0}
              fill={`url(#${shape.gradientId})`}
            />
          )
        ))}
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
