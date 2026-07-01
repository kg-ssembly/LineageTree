import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/auth-store';
import { useTreeStore } from '../../stores/tree-store';
import LoginScreen from '../screens/auth/login';
import SignUpScreen from '../screens/auth/sign-up';
import type { RootStackParamList } from '../../components/dto/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

function getMainScreen() {
  return require('../screens/main').default;
}

function getTreeDetailScreen() {
  return require('../screens/tree-detail').default;
}

function getPersonProfileScreen() {
  return require('../screens/person-profile').default;
}

export default function RootNavigator() {
  const theme = useTheme();
  const { user, loading, init } = useAuthStore();
  const syncFamilyData = useTreeStore((state) => state.syncFamilyData);
  const safeAreaEdges = ['top'] as const;

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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={safeAreaEdges}>
      <Stack.Navigator
        screenOptions={{
          animation: 'fade_from_bottom',
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.onSurface,
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {user ? (
          <>
            <Stack.Screen name="Main" getComponent={getMainScreen} options={{ headerShown: false }} />
            <Stack.Screen name="TreeDetail" getComponent={getTreeDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PersonProfile" getComponent={getPersonProfileScreen} options={{ headerShown: false }} />
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
