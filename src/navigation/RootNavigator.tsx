import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { useTreeStore } from '../store/treeStore';
import { theme } from '../lib/theme';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import HomeScreen from '../screens/HomeScreen';
import TreeDetailScreen from '../screens/TreeDetailScreen';
import PersonProfileScreen from '../screens/PersonProfileScreen';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator>
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

