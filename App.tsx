import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { getAppThemes } from './src/lib/theme';
import linking from './src/navigation/linking';
import RootNavigator from './src/navigation/RootNavigator';
import { useThemeStore } from './src/store/themeStore';

export default function App() {
  const systemColorScheme = useColorScheme();
  const preference = useThemeStore((state) => state.preference);
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const { paperTheme, navigationTheme, resolvedTheme } = getAppThemes(preference, systemColorScheme);

  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
        <NavigationContainer theme={navigationTheme} linking={linking}>
          <RootNavigator />
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
