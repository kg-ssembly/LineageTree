import { startMetric, finishMetric } from './components/performance-metrics';
import React, { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { en as paperDatesEn, registerTranslation } from 'react-native-paper-dates';
import { getAppThemes } from './constants/theme';
import linking from './app/navigation/app-linking';
import { setActiveLanguage } from './i18n';
import { useLanguageStore } from './stores/language-store';
import { useThemeStore } from './stores/theme-store';
import { useAuthStore } from './stores/auth-store';

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

startMetric('startup.ready.ms');
function AppShell() {
  const authLoading = useAuthStore((state) => state.loading);
  const initAuth = useAuthStore((state) => state.init);
  const [authReady, setAuthReady] = useState(!authLoading);
  const [updateCheckComplete, setUpdateCheckComplete] = useState(false);
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

  useEffect(() => initAuth(), [initAuth]);
  useEffect(() => { if (!authLoading) setAuthReady(true); }, [authLoading]);

  useEffect(() => {
    let cancelled = false;

    async function updateBeforeStartup() {
      // Development builds run a JS bundle from Metro and reject this API.
      // Native release builds check the configured EAS channel and reload once
      // the downloaded bundle is ready.
      if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) {
        if (!cancelled) setUpdateCheckComplete(true);
        return;
      }

      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          const downloaded = await Updates.fetchUpdateAsync();
          if (downloaded.isNew) {
            await Updates.reloadAsync();
            return;
          }
        }
      } catch (error) {
        // A failed update check must never prevent the cached app from
        // starting, especially when the device is offline.
        console.warn('Unable to check for an app update', error);
      }

      if (!cancelled) setUpdateCheckComplete(true);
    }

    void updateBeforeStartup();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setActiveLanguage(language);
  }, [language]);

  useEffect(() => { if (fontsLoaded && authReady && updateCheckComplete) finishMetric('startup.ready.ms'); }, [fontsLoaded, authReady, updateCheckComplete]);

  if (!fontsLoaded || !authReady || !updateCheckComplete) {
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
