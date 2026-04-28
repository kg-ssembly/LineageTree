import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type AppTheme = MD3Theme;

type ThemePalette = {
  primary: string;
  primaryContainer: string;
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
    primary: '#7B61FF',
    primaryContainer: '#E9E0FF',
    secondary: '#FF8A5B',
    tertiary: '#2FAE95',
    background: '#FAF7FF',
    surface: '#FFFFFF',
    surfaceVariant: '#F3EEFF',
    secondaryContainer: '#FFE5DB',
    tertiaryContainer: '#DCF6F0',
    outline: '#8E84B8',
    outlineVariant: '#DED6F4',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onSurface: '#1C1A24',
    onSurfaceVariant: '#6A647D',
    shadow: '#140F2C',
    scrim: '#0F0B1D',
    error: '#D64545',
  },
  dark: {
    primary: '#A8C7FF',
    primaryContainer: '#1F355C',
    secondary: '#FFB38F',
    tertiary: '#7BE0C6',
    background: '#0D1320',
    surface: '#131B2B',
    surfaceVariant: '#1D2740',
    secondaryContainer: '#5A3422',
    tertiaryContainer: '#173E37',
    outline: '#8A96B3',
    outlineVariant: '#2E3A57',
    onPrimary: '#10203A',
    onSecondary: '#44200F',
    onSurface: '#ECF1FF',
    onSurfaceVariant: '#B5C0DB',
    shadow: '#000000',
    scrim: '#000000',
    error: '#FF8E8E',
  },
};

function buildPaperTheme(mode: ResolvedTheme): AppTheme {
  const baseTheme = mode === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const palette = palettes[mode];

  return {
    ...baseTheme,
    roundness: 5,
    colors: {
      ...baseTheme.colors,
      primary: palette.primary,
      secondary: palette.secondary,
      tertiary: palette.tertiary,
      background: palette.background,
      surface: palette.surface,
      surfaceVariant: palette.surfaceVariant,
      primaryContainer: palette.primaryContainer,
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
        level1: mode === 'dark' ? '#172033' : '#FDFBFF',
        level2: mode === 'dark' ? '#1D2942' : '#F7F1FF',
        level3: mode === 'dark' ? '#223151' : '#EFE5FF',
        level4: mode === 'dark' ? '#293A60' : '#E7DBFF',
        level5: mode === 'dark' ? '#30426E' : '#DED1FF',
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
