import React from 'react';
import { Pressable, View } from 'react-native';
import { Button, Chip, Text, useTheme } from 'react-native-paper';
import type { PersonProfileRouteMemorySection, PersonProfileRouteTab } from './dto/navigation';
import type { PendingRelationshipMode } from './person-form-dialog';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, GlobalStyles } from '../constants/styles';
import { SectionCard } from './ui';

const styles = GlobalStyles.personProfile;

export type SuggestionActionTarget =
  | { kind: 'edit-profile'; personId: string }
  | {
      kind: 'open-profile';
      personId: string;
      initialTab?: PersonProfileRouteTab;
      initialMemorySectionTab?: PersonProfileRouteMemorySection;
    }
  | { kind: 'add-relationship'; personId: string }
  | { kind: 'add-relative'; personId: string; mode: PendingRelationshipMode }
  | { kind: 'add-person' }
  | { kind: 'add-self' }
  | { kind: 'open-relationship-dialog' };

export type SuggestionItem = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  actionTarget: SuggestionActionTarget;
  scope: 'profile' | 'tree';
  category: 'identity' | 'memories' | 'relationships' | 'growth' | 'tree';
  done?: boolean;
  icon?: string;
  priority?: 'urgent' | 'easy-win' | 'recommended';
  score?: number;
};

type SuggestionListProps<TSuggestion extends SuggestionItem = SuggestionItem> = {
  suggestions: TSuggestion[];
  onPressSuggestion: (suggestion: TSuggestion) => void;
  onDismissSuggestion?: (suggestion: TSuggestion) => void;
  dismissLabel?: string;
  variant?: 'profile' | 'dashboard';
  showDoneState?: boolean;
  getCardColors?: (suggestion: TSuggestion, index: number) => { backgroundColor?: string; borderColor?: string };
  getActionMode?: (suggestion: TSuggestion, index: number) => 'text' | 'outlined' | 'contained';
};

export function SuggestionList<TSuggestion extends SuggestionItem = SuggestionItem>({
  suggestions,
  onPressSuggestion,
  onDismissSuggestion,
  dismissLabel,
  variant = 'profile',
  showDoneState = false,
  getCardColors,
  getActionMode,
}: SuggestionListProps<TSuggestion>) {
  const theme = useTheme();

  return (
    <View style={styles.suggestionList}>
      {suggestions.map((suggestion, index) => {
        const colors = getCardColors?.(suggestion, index) ?? {};
        const actionMode = getActionMode?.(suggestion, index) ?? (variant === 'profile' ? 'text' : 'outlined');

        return (
          <SectionCard
            key={suggestion.id}
            nested
            backgroundColor={colors.backgroundColor ?? theme.colors.surface}
            style={[styles.suggestionCard, { borderColor: colors.borderColor ?? theme.colors.outlineVariant }]}
          >
            <Pressable onPress={() => onPressSuggestion(suggestion)} accessibilityRole="button">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  {showDoneState && suggestion.done ? (
                    <Chip compact icon="check-circle-outline" style={{ alignSelf: 'flex-start' }}>
                      Done
                    </Chip>
                  ) : null}
                  {variant === 'profile' && suggestion.icon ? (
                    <Chip compact icon={suggestion.icon} style={[styles.suggestionChip, showDoneState && suggestion.done ? { marginTop: 8 } : null]}>
                      {suggestion.title}
                    </Chip>
                  ) : (
                    <Text variant="titleMedium" style={showDoneState && suggestion.done ? { marginTop: 8 } : null}>
                      {suggestion.title}
                    </Text>
                  )}
                  <Text variant="bodyMedium" style={[styles.suggestionBody, { color: theme.colors.onSurfaceVariant }]}>
                    {suggestion.description}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Button
                    mode={actionMode}
                    onPress={() => onPressSuggestion(suggestion)}
                    style={BUTTON_CHROME}
                    contentStyle={BUTTON_CONTENT_CHROME}
                    buttonColor={actionMode === 'contained' ? theme.colors.primary : undefined}
                    textColor={actionMode === 'contained' ? theme.colors.onPrimary : undefined}
                  >
                    {suggestion.ctaLabel}
                  </Button>
                  {onDismissSuggestion && dismissLabel ? (
                    <Button
                      mode="text"
                      compact
                      onPress={() => onDismissSuggestion(suggestion)}
                      style={BUTTON_CHROME}
                      contentStyle={BUTTON_CONTENT_CHROME}
                    >
                      {dismissLabel}
                    </Button>
                  ) : null}
                </View>
              </View>
            </Pressable>
          </SectionCard>
        );
      })}
    </View>
  );
}
