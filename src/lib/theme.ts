import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type AppTheme = MD3Theme;

type ThemePalette = {
  primary: string;
  secondary: string;
  tertiary: string;
  background: string;
  surface: string;
  surfaceVariant: string;
  secondaryContainer: string;
  tertiaryContainer: string;
  outline: string;
  outlineVariant: string;
  onPrimary: string;
  onSecondary: string;
  onSurface: string;
  onSurfaceVariant: string;
  shadow: string;
  scrim: string;
  error: string;
};

const palettes: Record<ResolvedTheme, ThemePalette> = {
  light: {
    primary: '#6C5CE7',
    secondary: '#FF7A59',
    tertiary: '#2CB7A0',
    background: '#F6F4FF',
    surface: '#FFFFFF',
    surfaceVariant: '#F0ECFF',
    secondaryContainer: '#FFE3DA',
    tertiaryContainer: '#D8F6EF',
    outline: '#8C84B7',
    outlineVariant: '#D9D3F5',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onSurface: '#1E1B2E',
    onSurfaceVariant: '#69637F',
    shadow: '#140F2C',
    scrim: '#0F0B1D',
    error: '#D64545',
  },
  dark: {
    primary: '#B8ACFF',
    secondary: '#FFAB91',
    tertiary: '#74E2CC',
    background: '#11111A',
    surface: '#191926',
    surfaceVariant: '#232335',
    secondaryContainer: '#553327',
    tertiaryContainer: '#173D37',
    outline: '#978FB6',
    outlineVariant: '#37334A',
    onPrimary: '#231B56',
    onSecondary: '#4E1F11',
    onSurface: '#F4F1FF',
    onSurfaceVariant: '#B9B3D0',
    shadow: '#000000',
    scrim: '#000000',
    error: '#FF8C8C',
  },
};

function buildPaperTheme(mode: ResolvedTheme): AppTheme {
  const baseTheme = mode === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const palette = palettes[mode];

  return {
    ...baseTheme,
    roundness: 24,
    colors: {
      ...baseTheme.colors,
      primary: palette.primary,
      secondary: palette.secondary,
      tertiary: palette.tertiary,
      background: palette.background,
      surface: palette.surface,
      surfaceVariant: palette.surfaceVariant,
      primaryContainer: palette.secondaryContainer,
      secondaryContainer: palette.secondaryContainer,
      tertiaryContainer: palette.tertiaryContainer,
      outline: palette.outline,
      outlineVariant: palette.outlineVariant,
      onPrimary: palette.onPrimary,
      onSecondary: palette.onSecondary,
      onSurface: palette.onSurface,
      onSurfaceVariant: palette.onSurfaceVariant,
      shadow: palette.shadow,
      scrim: palette.scrim,
      error: palette.error,
      elevation: {
        level0: palette.background,
        level1: mode === 'dark' ? '#1D1D2D' : '#FCFBFF',
        level2: mode === 'dark' ? '#232337' : '#F7F3FF',
        level3: mode === 'dark' ? '#2A2842' : '#EFE8FF',
        level4: mode === 'dark' ? '#312D4A' : '#E7DEFF',
        level5: mode === 'dark' ? '#383255' : '#DDD3FF',
      },
    },
  };
}

function buildNavigationTheme(mode: ResolvedTheme): NavigationTheme {
  const baseTheme = mode === 'dark' ? NavigationDarkTheme : NavigationLightTheme;
  const palette = palettes[mode];

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.surface,
      text: palette.onSurface,
      border: palette.outlineVariant,
      notification: palette.tertiary,
    },
  };
}

export function resolveThemePreference(preference: ThemePreference, systemColorScheme?: string | null): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }

  return systemColorScheme === 'dark' ? 'dark' : 'light';
}

export function getAppThemes(preference: ThemePreference, systemColorScheme?: string | null) {
  const resolvedTheme = resolveThemePreference(preference, systemColorScheme);

  return {
    resolvedTheme,
    paperTheme: buildPaperTheme(resolvedTheme),
    navigationTheme: buildNavigationTheme(resolvedTheme),
  };
}

export const theme = buildPaperTheme('light');
