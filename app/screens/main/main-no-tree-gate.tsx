import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Chip, Surface, Text } from 'react-native-paper';
import { Reveal } from '../../../components';
import { GlobalStyles } from '../../../constants/styles';
import { I18N_KEYS as K } from '../../../i18n/keys';
import type { useMainScreenController } from './main-controller';

const homeStyles = GlobalStyles.home;

const localStyles = StyleSheet.create({
  noTreeGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backgroundOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.7,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 30,
    padding: 28,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  crest: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  noTreeGateText: {
    textAlign: 'center',
  },
  title: {
    marginBottom: 10,
  },
  body: {
    maxWidth: 360,
    marginBottom: 22,
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
      <View style={[localStyles.backgroundOrb, {
        width: 220,
        height: 220,
        top: 70,
        left: -40,
        backgroundColor: controller.theme.colors.secondaryContainer,
      }]} />
      <View style={[localStyles.backgroundOrb, {
        width: 180,
        height: 180,
        bottom: 60,
        right: -20,
        backgroundColor: controller.theme.colors.tertiaryContainer,
      }]} />

      <Reveal delay={60}>
        <Surface style={[localStyles.card, {
          backgroundColor: controller.theme.colors.surface,
          borderColor: controller.theme.colors.outlineVariant,
        }]} elevation={2}>
          <View style={[localStyles.crest, { backgroundColor: controller.theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="family-tree" size={48} color={controller.theme.colors.primary} />
          </View>

          <View style={localStyles.chipRow}>
            <Chip compact icon="account-group-outline">{controller.t(K.navigation.members)}</Chip>
            <Chip compact icon="timeline-text-outline">{controller.t(K.navigation.tree)}</Chip>
            <Chip compact icon="image-outline">Memories</Chip>
          </View>

          <Text variant="headlineMedium" style={[localStyles.noTreeGateText, localStyles.title, { color: controller.theme.colors.onSurface }]}>
            {controller.t(K.app.noFamilyTreeYet)}
          </Text>
          <Text variant="bodyLarge" style={[localStyles.noTreeGateText, localStyles.body, { color: controller.theme.colors.onSurfaceVariant }]}>
            {controller.t(K.app.createFirstFamilyTree)}
          </Text>
          <Button mode="contained" icon="plus" onPress={onCreateTree} contentStyle={homeStyles.headerButtonContent}>
            {controller.t(K.app.createFamilyTree)}
          </Button>
        </Surface>
      </Reveal>
    </View>
  );
}
