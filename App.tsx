import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { getAppThemes } from './constants/theme';
import linking from './app/navigation/app-linking';
import RootNavigator from './app/navigation/root-navigator';
import { useThemeStore } from './stores/theme-store';

export default function App() {
  const systemColorScheme = useColorScheme();
  const preference = useThemeStore((state) => state.preference);
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const { paperTheme, navigationTheme, resolvedTheme } = getAppThemes(preference, systemColorScheme);
  const [fontsLoaded] = useFonts({
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  if (!fontsLoaded) {
    return null;
  }

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
