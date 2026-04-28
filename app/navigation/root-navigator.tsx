import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/auth-store';
import { useTreeStore } from '../../stores/tree-store';
import LoginScreen from '../screens/auth/login-screen';
import SignUpScreen from '../screens/auth/sign-up-screen';
import HomeScreen from '../screens/home-screen';
import TreeDetailScreen from '../screens/tree-detail-screen';
import PersonProfileScreen from '../screens/person-profile-screen';
import type { RootStackParamList } from '../../components/dto/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const theme = useTheme();
  const { user, loading, init } = useAuthStore();
  const syncFamilyData = useTreeStore((state) => state.syncFamilyData);

  useEffect(() => {
    return init();
  }, [init]);

  useEffect(() => {
    syncFamilyData(user?.id ?? null);
  }, [syncFamilyData, user?.id]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.onSurface,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="TreeDetail"
              component={TreeDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PersonProfile"
              component={PersonProfileScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </SafeAreaView>
  );
}

