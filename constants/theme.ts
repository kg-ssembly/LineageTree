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

const appFonts = configureFonts({
  config: {
    displayLarge: { fontFamily, fontWeight: '700', letterSpacing: -0.8, lineHeight: 54, fontSize: 44 },
    displayMedium: { fontFamily, fontWeight: '700', letterSpacing: -0.6, lineHeight: 48, fontSize: 38 },
    displaySmall: { fontFamily, fontWeight: '700', letterSpacing: -0.4, lineHeight: 42, fontSize: 32 },
    headlineLarge: { fontFamily, fontWeight: '700', letterSpacing: -0.4, lineHeight: 40, fontSize: 30 },
    headlineMedium: { fontFamily, fontWeight: '700', letterSpacing: -0.2, lineHeight: 36, fontSize: 28 },
    headlineSmall: { fontFamily, fontWeight: '700', letterSpacing: -0.2, lineHeight: 32, fontSize: 24 },
    titleLarge: { fontFamily, fontWeight: '700', letterSpacing: -0.1, lineHeight: 28, fontSize: 22 },
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
    primary: '#7BC6A4',
    primaryContainer: '#E4F5EC',
    secondary: '#5BA384',
    secondaryContainer: '#D4EBE2',
    tertiary: '#8AA4D6',
    tertiaryContainer: '#EAF0FB',
    background: '#F5F5F7',
    surface: '#FCFCFD',
    surfaceVariant: '#F0F1F4',
    surfaceDisabled: '#E7E8EC',
    outline: '#C9CDD5',
    outlineVariant: '#E2E4E9',
    onPrimary: '#11382B',
    onPrimaryContainer: '#183D30',
    onSecondary: '#5C201A',
    onSecondaryContainer: '#642620',
    onTertiary: '#243556',
    onTertiaryContainer: '#31446A',
    onSurface: '#15181E',
    onSurfaceVariant: '#6A7280',
    shadow: '#1A1D24',
    scrim: '#11141A',
    error: '#C43D37',
    errorContainer: '#FDE9E7',
    onErrorContainer: '#742824',
    backdrop: 'rgba(17, 20, 26, 0.26)',
  },
  dark: {
    primary: '#9EDCC0',
    primaryContainer: '#234136',
    secondary: '#96C5AA',
    secondaryContainer: '#3D6B55',
    tertiary: '#B8CBF0',
    tertiaryContainer: '#2E3B57',
    background: '#111317',
    surface: '#171A20',
    surfaceVariant: '#20242C',
    surfaceDisabled: '#282D36',
    outline: '#4A5160',
    outlineVariant: '#313643',
    onPrimary: '#10261E',
    onPrimaryContainer: '#DDF4E8',
    onSecondary: '#3A1613',
    onSecondaryContainer: '#FFD8D2',
    onTertiary: '#1C2943',
    onTertiaryContainer: '#DFE8FA',
    onSurface: '#F4F6FA',
    onSurfaceVariant: '#B0B6C3',
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
    roundness: 20,
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
        level1: mode === 'dark' ? '#1B1F26' : '#F8F8FA',
        level2: mode === 'dark' ? '#20242D' : '#FDFDFD',
        level3: mode === 'dark' ? '#252A33' : '#FFFFFF',
        level4: mode === 'dark' ? '#2A303A' : '#FFFFFF',
        level5: mode === 'dark' ? '#313844' : '#FFFFFF',
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
