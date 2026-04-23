import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, Surface, Text } from 'react-native-paper';
import { useAuthStore } from '../store/authStore';

export default function HomeScreen() {
  const { user, signOut, loading } = useAuthStore();

  return (
    <View style={styles.container}>
      <Surface style={styles.card} elevation={2}>
        <Avatar.Text
          size={72}
          label={user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : '??'}
          style={styles.avatar}
        />
        <Text variant="headlineSmall" style={styles.name}>{user?.displayName ?? 'Welcome!'}</Text>
        <Text variant="bodyMedium" style={styles.email}>{user?.email}</Text>

        <Button
          mode="contained"
          onPress={signOut}
          disabled={loading}
          buttonColor="#E24A4A"
          contentStyle={styles.buttonContent}
          style={styles.button}
        >
          Log Out
        </Button>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { borderRadius: 16, padding: 32, alignItems: 'center', width: '100%', maxWidth: 400 },
  avatar: { marginBottom: 16 },
  name: { fontWeight: '700', marginBottom: 4 },
  email: { color: '#888', marginBottom: 32 },
  button: { borderRadius: 8, width: '100%' },
  buttonContent: { height: 48 },
});

