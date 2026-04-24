import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { useAuthStore } from '../store/authStore';
import { useTreeStore } from '../store/treeStore';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import HomeScreen from '../screens/HomeScreen';
import TreeDetailScreen from '../screens/TreeDetailScreen';
import PersonProfileScreen from '../screens/PersonProfileScreen';
import type { RootStackParamList } from '../types/navigation';

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
            options={({ route }) => ({
              title: route.params.treeName ?? 'Family tree',
            })}
          />
          <Stack.Screen
            name="PersonProfile"
            component={PersonProfileScreen}
            options={({ route }) => ({
              title: route.params.personName ?? 'Person profile',
            })}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}

