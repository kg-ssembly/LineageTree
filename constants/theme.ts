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

// ─────────────────────────────────────────────────────────────────────────────
// THEME SELECTION
// Change ACTIVE_THEME to switch between the three options below:
//   'forest'   – warm earthy greens & terracotta  (organic, grounded feel)
//   'ocean'    – deep teal & golden amber          (cool, professional)
//   'midnight' – rich purples & warm gold          (current-style, refined)
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVE_THEME: 'forest' | 'ocean' | 'midnight' = 'forest';

// ── Option A: Forest Heritage ─────────────────────────────────────────────────
const forestPalettes: Record<ResolvedTheme, ThemePalette> = {
  light: {
    primary: '#2D6A4F',
    primaryContainer: '#C8E6D2',
    secondary: '#E07B39',
    tertiary: '#7B5E2A',
    background: '#F6F3ED',
    surface: '#FDFAF5',
    surfaceVariant: '#EBE5D9',
    secondaryContainer: '#DFE8DC',
    tertiaryContainer: '#D8E5D6',
    outline: '#6E8B65',
    outlineVariant: '#CFCAB8',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onSurface: '#1A1C18',
    onSurfaceVariant: '#605C4A',
    shadow: '#0E1209',
    scrim: '#000000',
    error: '#BA1A1A',
  },
  dark: {
    primary: '#52B788',
    primaryContainer: '#1C4A34',
    secondary: '#FFB77B',
    tertiary: '#C9A96E',
    background: '#131510',
    surface: '#1B1E16',
    surfaceVariant: '#252A1E',
    secondaryContainer: '#5A3518',
    tertiaryContainer: '#3D3013',
    outline: '#8E956E',
    outlineVariant: '#323829',
    onPrimary: '#092818',
    onSecondary: '#401E08',
    onSurface: '#E2E5D6',
    onSurfaceVariant: '#BAC0A4',
    shadow: '#000000',
    scrim: '#000000',
    error: '#ffb4ab',
  },
};

// ── Option B: Ocean Archive ───────────────────────────────────────────────────
const oceanPalettes: Record<ResolvedTheme, ThemePalette> = {
  light: {
    primary: '#0E618F',
    primaryContainer: '#C5E5F8',
    secondary: '#C8760A',
    tertiary: '#2A7D78',
    background: '#F3F8FC',
    surface: '#FAFCFF',
    surfaceVariant: '#E0EEF6',
    secondaryContainer: '#FFE0B2',
    tertiaryContainer: '#C8EDE9',
    outline: '#567B90',
    outlineVariant: '#BDD1DC',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onSurface: '#0D1B24',
    onSurfaceVariant: '#3F606E',
    shadow: '#000000',
    scrim: '#000000',
    error: '#BA1A1A',
  },
  dark: {
    primary: '#72B7E6',
    primaryContainer: '#073D5E',
    secondary: '#FFB74D',
    tertiary: '#4DB6AC',
    background: '#0C131A',
    surface: '#141D25',
    surfaceVariant: '#1C2A35',
    secondaryContainer: '#5D3B00',
    tertiaryContainer: '#0D3D39',
    outline: '#5D8FA0',
    outlineVariant: '#243845',
    onPrimary: '#00293D',
    onSecondary: '#3D2700',
    onSurface: '#D8E8F4',
    onSurfaceVariant: '#94B8C8',
    shadow: '#000000',
    scrim: '#000000',
    error: '#FFB4AB',
  },
};

// ── Option C: Midnight Amber (original purple, refined) ───────────────────────
const midnightPalettes: Record<ResolvedTheme, ThemePalette> = {
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

const themeMap = {
  forest: forestPalettes,
  ocean: oceanPalettes,
  midnight: midnightPalettes,
};

const palettes = themeMap[ACTIVE_THEME];

function buildPaperTheme(mode: ResolvedTheme): AppTheme {
  const baseTheme = mode === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const palette = palettes[mode];

  return {
    ...baseTheme,
    roundness: 6,
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
        level1: mode === 'dark' ? '#1C2118' : '#FDFAF5',
        level2: mode === 'dark' ? '#222819' : '#F8F4EB',
        level3: mode === 'dark' ? '#272E20' : '#F2EDE2',
        level4: mode === 'dark' ? '#2D3524' : '#ECE6D8',
        level5: mode === 'dark' ? '#323B28' : '#E6DFCE',
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
