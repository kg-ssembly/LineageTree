import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import { Platform } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';

export type ThemePreference = 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type AppTheme = MD3Theme;

type ThemePalette = {
  primary: string;
  primaryContainer: string;
  secondary: string;
  secondaryContainer: string;
  tertiary: string;
  tertiaryContainer: string;
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceDisabled: string;
  outline: string;
  outlineVariant: string;
  onPrimary: string;
  onPrimaryContainer: string;
  onSecondary: string;
  onSecondaryContainer: string;
  onTertiary: string;
  onTertiaryContainer: string;
  onSurface: string;
  onSurfaceVariant: string;
  shadow: string;
  scrim: string;
  error: string;
  errorContainer: string;
  onErrorContainer: string;
  backdrop: string;
};

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
}) ?? 'System';

const displayFontFamily = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
}) ?? 'Georgia';

const appFonts = configureFonts({
  config: {
    displayLarge: { fontFamily: displayFontFamily, fontWeight: '700', letterSpacing: -0.8, lineHeight: 54, fontSize: 44 },
    displayMedium: { fontFamily: displayFontFamily, fontWeight: '700', letterSpacing: -0.6, lineHeight: 48, fontSize: 38 },
    displaySmall: { fontFamily: displayFontFamily, fontWeight: '700', letterSpacing: -0.4, lineHeight: 42, fontSize: 32 },
    headlineLarge: { fontFamily: displayFontFamily, fontWeight: '700', letterSpacing: -0.4, lineHeight: 40, fontSize: 30 },
    headlineMedium: { fontFamily: displayFontFamily, fontWeight: '700', letterSpacing: -0.2, lineHeight: 36, fontSize: 28 },
    headlineSmall: { fontFamily: displayFontFamily, fontWeight: '700', letterSpacing: -0.2, lineHeight: 32, fontSize: 24 },
    titleLarge: { fontFamily: displayFontFamily, fontWeight: '700', letterSpacing: -0.1, lineHeight: 28, fontSize: 22 },
    titleMedium: { fontFamily, fontWeight: '600', letterSpacing: 0, lineHeight: 24, fontSize: 17 },
    titleSmall: { fontFamily, fontWeight: '600', letterSpacing: 0.1, lineHeight: 22, fontSize: 15 },
    bodyLarge: { fontFamily, fontWeight: '400', letterSpacing: 0, lineHeight: 24, fontSize: 17 },
    bodyMedium: { fontFamily, fontWeight: '400', letterSpacing: 0, lineHeight: 22, fontSize: 15 },
    bodySmall: { fontFamily, fontWeight: '400', letterSpacing: 0.1, lineHeight: 20, fontSize: 13 },
    labelLarge: { fontFamily, fontWeight: '600', letterSpacing: 0.1, lineHeight: 20, fontSize: 14 },
    labelMedium: { fontFamily, fontWeight: '600', letterSpacing: 0.1, lineHeight: 18, fontSize: 12 },
    labelSmall: { fontFamily, fontWeight: '600', letterSpacing: 0.1, lineHeight: 16, fontSize: 11 },
  },
});

const softPalettes: Record<ResolvedTheme, ThemePalette> = {
  light: {
    primary: '#2E7D67',
    primaryContainer: '#D9EEE6',
    secondary: '#B8643C',
    secondaryContainer: '#F8E1D4',
    tertiary: '#8B6A42',
    tertiaryContainer: '#F1E5D3',
    background: '#FBF6F0',
    surface: '#FFFDFC',
    surfaceVariant: '#F3EADF',
    surfaceDisabled: '#E6DDD3',
    outline: '#B7A693',
    outlineVariant: '#DECFC1',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#163E33',
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#55301D',
    onTertiary: '#FFFFFF',
    onTertiaryContainer: '#43311C',
    onSurface: '#201A16',
    onSurfaceVariant: '#6D5C4E',
    shadow: '#201814',
    scrim: '#140F0C',
    error: '#C43D37',
    errorContainer: '#FDE9E7',
    onErrorContainer: '#742824',
    backdrop: 'rgba(20, 15, 12, 0.28)',
  },
  dark: {
    primary: '#A7D7C6',
    primaryContainer: '#25453B',
    secondary: '#F0B08C',
    secondaryContainer: '#6C4029',
    tertiary: '#D5BB96',
    tertiaryContainer: '#52402A',
    background: '#161210',
    surface: '#1E1815',
    surfaceVariant: '#2A221D',
    surfaceDisabled: '#342A24',
    outline: '#65564A',
    outlineVariant: '#43372F',
    onPrimary: '#103126',
    onPrimaryContainer: '#D9EEE6',
    onSecondary: '#3D2112',
    onSecondaryContainer: '#FEE0CF',
    onTertiary: '#312213',
    onTertiaryContainer: '#F2E3CA',
    onSurface: '#F8F2EC',
    onSurfaceVariant: '#C5B3A5',
    shadow: '#000000',
    scrim: '#000000',
    error: '#FF8A84',
    errorContainer: '#5C1F1B',
    onErrorContainer: '#FFDAD6',
    backdrop: 'rgba(0, 0, 0, 0.36)',
  },
};

function buildPaperTheme(mode: ResolvedTheme): AppTheme {
  const baseTheme = mode === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const palette = softPalettes[mode];

  return {
    ...baseTheme,
    roundness: 24,
    fonts: appFonts,
    colors: {
      ...baseTheme.colors,
      primary: palette.primary,
      primaryContainer: palette.primaryContainer,
      secondary: palette.secondary,
      secondaryContainer: palette.secondaryContainer,
      tertiary: palette.tertiary,
      tertiaryContainer: palette.tertiaryContainer,
      background: palette.background,
      surface: palette.surface,
      surfaceVariant: palette.surfaceVariant,
      surfaceDisabled: palette.surfaceDisabled,
      outline: palette.outline,
      outlineVariant: palette.outlineVariant,
      onPrimary: palette.onPrimary,
      onPrimaryContainer: palette.onPrimaryContainer,
      onSecondary: palette.onSecondary,
      onSecondaryContainer: palette.onSecondaryContainer,
      onTertiary: palette.onTertiary,
      onTertiaryContainer: palette.onTertiaryContainer,
      onSurface: palette.onSurface,
      onSurfaceVariant: palette.onSurfaceVariant,
      shadow: palette.shadow,
      scrim: palette.scrim,
      error: palette.error,
      errorContainer: palette.errorContainer,
      onErrorContainer: palette.onErrorContainer,
      backdrop: palette.backdrop,
      elevation: {
        level0: palette.background,
        level1: mode === 'dark' ? '#221B17' : '#F8F0E7',
        level2: mode === 'dark' ? '#281F1A' : '#FFF9F4',
        level3: mode === 'dark' ? '#302620' : '#FFFFFF',
        level4: mode === 'dark' ? '#382C25' : '#FFFFFF',
        level5: mode === 'dark' ? '#43342C' : '#FFFFFF',
      },
    },
  };
}

function buildNavigationTheme(mode: ResolvedTheme): NavigationTheme {
  const baseTheme = mode === 'dark' ? NavigationDarkTheme : NavigationLightTheme;
  const palette = softPalettes[mode];

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.surface,
      text: palette.onSurface,
      border: palette.outlineVariant,
      notification: palette.secondary,
    },
  };
}

export function resolveThemePreference(preference: ThemePreference): ResolvedTheme {
  return preference;
}

export function getAppThemes(preference: ThemePreference) {
  const resolvedTheme = resolveThemePreference(preference);

  return {
    resolvedTheme,
    paperTheme: buildPaperTheme(resolvedTheme),
    navigationTheme: buildNavigationTheme(resolvedTheme),
  };
}

export const theme = buildPaperTheme('light');
