import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Dialog, HelperText, IconButton, List, Portal, Switch, Text, useTheme } from 'react-native-paper';
import type { PersonRecord } from './dto/person';
import { formatPersonName } from './person-formatting';
import type { SuggestedRelationship } from './relationship-suggestions';
import { GlobalStyles } from '../constants/styles';
import { useI18n } from '../hooks/use-i18n';
import { I18N_KEYS as K } from '../i18n/keys';

const dialogChrome = GlobalStyles.dialogChrome;
const styles = GlobalStyles.personFormDialog;

type RelationshipSuggestionsDialogProps = {
  visible: boolean;
  suggestions: SuggestedRelationship[];
  peopleById: Map<string, PersonRecord>;
  loading?: boolean;
  onDismiss: () => void;
  onApply: (selectedSuggestions: SuggestedRelationship[]) => void;
};

function getSuggestionLabel(
  suggestion: SuggestedRelationship,
  relatedPersonName: string,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  return t(
    suggestion.mode === 'spouse-of'
      ? K.relationship.spouseOfName
      : suggestion.mode === 'child-of'
        ? K.relationship.childOfName
        : K.relationship.parentOfName,
    { name: relatedPersonName },
  );
}

function getSuggestionReason(
  suggestion: SuggestedRelationship,
  peopleById: Map<string, PersonRecord>,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const sourcePerson = peopleById.get(suggestion.sourcePersonId);
  const relatedPerson = peopleById.get(suggestion.relatedPersonId);
  const sourcePersonName = sourcePerson ? formatPersonName(sourcePerson) : suggestion.sourcePersonId;
  const relatedPersonName = relatedPerson ? formatPersonName(relatedPerson) : suggestion.relatedPersonId;

  if (suggestion.reason === 'parent-spouse') {
    return t(K.personForm.relationshipSuggestionParentSpouseReason, {
      source: sourcePersonName,
      name: relatedPersonName,
    });
  }

  if (suggestion.reason === 'child-other-parent') {
    return t(K.personForm.relationshipSuggestionChildOtherParentReason, {
      source: sourcePersonName,
      name: relatedPersonName,
    });
  }

  return t(K.personForm.relationshipSuggestionSpouseChildReason, {
    source: sourcePersonName,
    name: relatedPersonName,
  });
}

export default function RelationshipSuggestionsDialog({
  visible,
  suggestions,
  peopleById,
  loading = false,
  onDismiss,
  onApply,
}: RelationshipSuggestionsDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [enabledById, setEnabledById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!visible) {
      return;
    }

    setEnabledById(Object.fromEntries(suggestions.map((suggestion) => [suggestion.id, suggestion.defaultEnabled])));
  }, [suggestions, visible]);

  const selectedSuggestions = useMemo(
    () => suggestions.filter((suggestion) => enabledById[suggestion.id]),
    [enabledById, suggestions],
  );

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loading ? undefined : onDismiss}
        style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose, styles.dialogTitle]}>
          {t(K.personForm.relationshipSuggestionsTitle)}
        </Dialog.Title>
        <IconButton icon="close" onPress={onDismiss} disabled={loading} accessibilityLabel={t(K.common.close)} style={dialogChrome.closeButton} />
        <Dialog.ScrollArea style={[dialogChrome.scrollArea, styles.scrollArea]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t(K.personForm.relationshipSuggestionsHelper)}
            </Text>
            <HelperText type="info" visible>
              {t(K.personForm.relationshipSuggestionsHelperSecondary)}
            </HelperText>
            <View style={styles.relationshipSuggestionsList}>
              {suggestions.map((suggestion) => {
                const relatedPerson = peopleById.get(suggestion.relatedPersonId);
                const relatedPersonName = relatedPerson ? formatPersonName(relatedPerson) : suggestion.relatedPersonId;

                return (
                  <View
                    key={suggestion.id}
                    style={[styles.relationshipSuggestionCard, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }]}
                  >
                    <List.Item
                      style={styles.pendingRelationshipItem}
                      title={getSuggestionLabel(suggestion, relatedPersonName, t)}
                      description={getSuggestionReason(suggestion, peopleById, t)}
                      left={(props) => (
                        <List.Icon
                          {...props}
                          icon={
                            suggestion.mode === 'child-of'
                              ? 'account-arrow-up-outline'
                              : suggestion.mode === 'parent-of'
                                ? 'account-arrow-down-outline'
                                : 'account-heart-outline'
                          }
                        />
                      )}
                      right={() => (
                        <Switch
                          value={Boolean(enabledById[suggestion.id])}
                          onValueChange={(value) => setEnabledById((current) => ({ ...current, [suggestion.id]: value }))}
                          disabled={loading}
                        />
                      )}
                    />
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={[dialogChrome.dialogActions, styles.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button onPress={onDismiss} disabled={loading}>
            {t(K.common.close)}
          </Button>
          <Button mode="contained" onPress={() => onApply(selectedSuggestions)} disabled={loading || selectedSuggestions.length === 0}>
            {t(K.personForm.addSelectedSuggestions, { count: selectedSuggestions.length })}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
