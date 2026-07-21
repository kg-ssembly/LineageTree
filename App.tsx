import React, { Component, type ErrorInfo, type ReactNode, useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { en as paperDatesEn, registerTranslation } from 'react-native-paper-dates';
import { getAppThemes } from './constants/theme';
import linking from './app/navigation/app-linking';
import { setActiveLanguage } from './i18n';
import { useLanguageStore } from './stores/language-store';
import { useThemeStore } from './stores/theme-store';

// react-native-paper-dates only renders cleanly after a locale is registered.
// We register the built-in English pack for every app language so the date
// picker stays quiet even when we switch the app UI to a non-supported locale.
for (const locale of ['en', 'af', 'de', 'es', 'fr', 'it', 'pt', 'st', 'ss', 'tn', 'ts', 've', 'xh', 'zu', 'nso', 'nr']) {
  registerTranslation(locale, paperDatesEn);
}

type StartupErrorBoundaryState = {
  error: Error | null;
};

class StartupErrorBoundary extends Component<{ children: ReactNode }, StartupErrorBoundaryState> {
  state: StartupErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StartupErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Startup render failed', error, errorInfo.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 24,
          backgroundColor: '#ffffff',
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12, color: '#111111' }}>
          Startup error
        </Text>
        <Text selectable style={{ fontSize: 14, color: '#333333', marginBottom: 12 }}>
          {this.state.error.message}
        </Text>
        <Text selectable style={{ fontSize: 12, color: '#666666' }}>
          {this.state.error.stack}
        </Text>
      </ScrollView>
    );
  }
}

function RootNavigatorLoader() {
  const RootNavigator = require('./app/navigation/root-navigator').default;
  return <RootNavigator />;
}

function AppShell() {
  const preference = useThemeStore((state) => state.preference);
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const language = useLanguageStore((state) => state.language);
  const hydrateLanguage = useLanguageStore((state) => state.hydrate);
  const { paperTheme, navigationTheme, resolvedTheme } = getAppThemes(preference);
  const [fontsLoaded] = useFonts({
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    hydrateTheme();
    hydrateLanguage();
  }, [hydrateLanguage, hydrateTheme]);

  useEffect(() => {
    setActiveLanguage(language);
  }, [language]);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: paperTheme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={paperTheme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
        <NavigationContainer theme={navigationTheme} linking={linking}>
          <RootNavigatorLoader />
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <StartupErrorBoundary>
      <AppShell />
    </StartupErrorBoundary>
  );
}
