import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import { Platform } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';

export type ThemePreference = 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type AppTheme = MD3Theme;
type LightThemeVariant = 'vibrant' | 'jade' | 'emeraldBrown' | 'premium';

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
  web: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'System',
}) ?? 'System';

const displayFontFamily = fontFamily;

const appFonts = configureFonts({
  config: {
    displayLarge: { fontFamily: displayFontFamily, fontWeight: '700', letterSpacing: -0.8, lineHeight: 54, fontSize: 44 },
    displayMedium: { fontFamily: displayFontFamily, fontWeight: '700', letterSpacing: -0.6, lineHeight: 48, fontSize: 38 },
    displaySmall: { fontFamily: displayFontFamily, fontWeight: '700', letterSpacing: -0.4, lineHeight: 42, fontSize: 32 },
    headlineLarge: { fontFamily: displayFontFamily, fontWeight: '700', letterSpacing: -0.4, lineHeight: 40, fontSize: 30 },
    headlineMedium: { fontFamily: displayFontFamily, fontWeight: '700', letterSpacing: -0.2, lineHeight: 36, fontSize: 28 },
    headlineSmall: { fontFamily: displayFontFamily, fontWeight: '600', letterSpacing: -0.2, lineHeight: 32, fontSize: 24 },
    titleLarge: { fontFamily: displayFontFamily, fontWeight: '600', letterSpacing: -0.1, lineHeight: 28, fontSize: 22 },
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

const lightEmeraldPalettes: Record<LightThemeVariant, ThemePalette> = {
  vibrant: {
    primary: '#0F8A5F',
    primaryContainer: '#D6F3E8',
    secondary: '#3AAE8C',
    secondaryContainer: '#D8F5EC',
    tertiary: '#2D6E56',
    tertiaryContainer: '#DDEFE8',
    background: '#F7FCFA',
    surface: '#FFFFFF',
    surfaceVariant: '#EDF8F3',
    surfaceDisabled: '#D9E8E1',
    outline: '#7FA593',
    outlineVariant: '#CBE0D7',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#063325',
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#12493D',
    onTertiary: '#FFFFFF',
    onTertiaryContainer: '#103A2E',
    onSurface: '#1B2622',
    onSurfaceVariant: '#5D746B',
    shadow: '#15211D',
    scrim: '#0C1512',
    error: '#C43D37',
    errorContainer: '#FDE9E7',
    onErrorContainer: '#742824',
    backdrop: 'rgba(12, 21, 18, 0.28)',
  },
  jade: {
    primary: '#16846A',
    primaryContainer: '#D8F0E8',
    secondary: '#4E9D7A',
    secondaryContainer: '#DDEFE6',
    tertiary: '#6B8F4E',
    tertiaryContainer: '#E3F0D8',
    background: '#F6FBF8',
    surface: '#FFFFFF',
    surfaceVariant: '#EEF6F1',
    surfaceDisabled: '#D8E7E0',
    outline: '#7C9B8E',
    outlineVariant: '#C8DAD3',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#08392F',
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#153E33',
    onTertiary: '#FFFFFF',
    onTertiaryContainer: '#31431F',
    onSurface: '#1A2421',
    onSurfaceVariant: '#5D726B',
    shadow: '#14211D',
    scrim: '#091310',
    error: '#C43D37',
    errorContainer: '#FDE9E7',
    onErrorContainer: '#742824',
    backdrop: 'rgba(9, 19, 16, 0.28)',
  },
  emeraldBrown: {
    primary: '#1B7F5A',
    primaryContainer: '#DDEBE1',
    secondary: '#8A6242',
    secondaryContainer: '#F0E1D2',
    tertiary: '#6D8A4C',
    tertiaryContainer: '#E3ECD7',
    background: '#FBF7F1',
    surface: '#FFFFFF',
    surfaceVariant: '#F2E8DD',
    surfaceDisabled: '#E2D7CA',
    outline: '#A68C74',
    outlineVariant: '#D7C7B6',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#103227',
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#4E3320',
    onTertiary: '#FFFFFF',
    onTertiaryContainer: '#33401E',
    onSurface: '#241D18',
    onSurfaceVariant: '#6E5D4D',
    shadow: '#201814',
    scrim: '#130F0C',
    error: '#C43D37',
    errorContainer: '#FDE9E7',
    onErrorContainer: '#742824',
    backdrop: 'rgba(19, 15, 12, 0.28)',
  },
  premium: {
    primary: '#477B25',
    primaryContainer: '#E6F1D9',
    secondary: '#586C48',
    secondaryContainer: '#EAF0E2',
    tertiary: '#79674E',
    tertiaryContainer: '#F1EBDD',
    background: '#F9FBF6',
    surface: '#FFFFFF',
    surfaceVariant: '#F0F4EB',
    surfaceDisabled: '#E5E9DF',
    outline: '#858D7D',
    outlineVariant: '#E0E6D9',
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#30451F',
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#3D4B32',
    onTertiary: '#FFFFFF',
    onTertiaryContainer: '#514333',
    onSurface: '#514942',
    onSurfaceVariant: '#696A60',
    shadow: '#35432B',
    scrim: '#20251B',
    error: '#B33F38',
    errorContainer: '#FBECE9',
    onErrorContainer: '#792C27',
    backdrop: 'rgba(32, 37, 27, 0.32)',
  },
};

const ACTIVE_LIGHT_THEME_VARIANT: LightThemeVariant = 'premium';

const softPalettes: Record<ResolvedTheme, ThemePalette> = {
  light: lightEmeraldPalettes[ACTIVE_LIGHT_THEME_VARIANT],
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
        level1: mode === 'dark' ? '#221B17' : '#F2F5ED',
        level2: mode === 'dark' ? '#281F1A' : '#F6F8F2',
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
