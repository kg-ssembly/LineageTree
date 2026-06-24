import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Text } from 'react-native-paper';
import { GlobalStyles } from '../../../constants/styles';
import { I18N_KEYS as K } from '../../../i18n/keys';
import type { useMainScreenController } from './main-controller';

const homeStyles = GlobalStyles.home;

const localStyles = StyleSheet.create({
  noTreeGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  noTreeGateText: {
    textAlign: 'center',
  },
});

export function MainNoTreeGate({
  onCreateTree,
  controller,
}: {
  onCreateTree: () => void;
  controller: ReturnType<typeof useMainScreenController>;
}) {
  return (
    <View style={[localStyles.noTreeGate, { backgroundColor: controller.theme.colors.background }]}>
      <MaterialCommunityIcons name="family-tree" size={64} color={controller.theme.colors.primary} />
      <Text variant="headlineSmall" style={[localStyles.noTreeGateText, { color: controller.theme.colors.onSurface }]}>
        {controller.t(K.app.noFamilyTreeYet)}
      </Text>
      <Text variant="bodyMedium" style={[localStyles.noTreeGateText, { color: controller.theme.colors.onSurfaceVariant }]}>
        {controller.t(K.app.createFirstFamilyTree)}
      </Text>
      <Button mode="contained" icon="plus" onPress={onCreateTree} contentStyle={homeStyles.headerButtonContent}>
        {controller.t(K.app.createFamilyTree)}
      </Button>
    </View>
  );
}
