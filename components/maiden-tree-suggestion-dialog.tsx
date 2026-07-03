import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import type { MaidenTreeSuggestionCandidate } from '../app/screens/tree-screen-helpers';
import { GlobalStyles } from '../constants/styles';
import { I18N_KEYS as K } from '../i18n/keys';

const dialogChrome = GlobalStyles.dialogChrome;
const PAGE_SIZE = 5;

export function MaidenTreeSuggestionDialog({
  visible,
  surname,
  candidates,
  theme,
  t,
  onDismiss,
  onOpenTree,
  onRequestAccess,
}: {
  visible: boolean;
  surname: string;
  candidates: MaidenTreeSuggestionCandidate[];
  theme: any;
  t: (message: string, params?: Record<string, string | number | null | undefined>) => string;
  onDismiss: () => void;
  onOpenTree: (treeId: string) => void;
  onRequestAccess: (treeId: string) => void;
}) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!visible) {
      setPage(0);
    }
  }, [visible, surname, candidates.length]);

  const totalPages = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
  const pagedCandidates = useMemo(
    () => candidates.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [candidates, page],
  );

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  if (!visible) {
    return null;
  }

  return (
    <Portal>
      <Dialog visible onDismiss={onDismiss} style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}>
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>
          {t(K.relationship.createMaidenFamilyTreeTitle, { surname })}
        </Dialog.Title>
        <Dialog.Content style={dialogChrome.content}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t(K.relationship.createMaidenFamilyTreeMessage, { surname })}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
            {t(K.app.similarFamilyTreesFound)}
          </Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {pagedCandidates.map((candidate) => (
              <View
                key={candidate.id}
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                  borderRadius: 16,
                  padding: 14,
                  backgroundColor: theme.colors.surface,
                }}
              >
                <Text variant="titleMedium">{candidate.name}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  {t(K.relationship.maidenTreeOwnerLabel, { owner: candidate.ownerLabel })}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                  {t(K.relationship.maidenTreeMatchLabel, { match: candidate.matchedLabel })}
                </Text>
                <Button
                  mode="text"
                  onPress={() => {
                    if (candidate.accessible) {
                      onOpenTree(candidate.id);
                      return;
                    }

                    onRequestAccess(candidate.id);
                  }}
                  style={{ marginTop: 10, alignSelf: 'flex-start' }}
                >
                  {candidate.accessible ? t(K.personForm.addParentInThisTree) : t(K.app.requestAccess)}
                </Button>
              </View>
            ))}
          </View>
          {totalPages > 1 ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                {t(K.app.resultsPageCount, { current: page + 1, total: totalPages })}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
                <Button mode="outlined" onPress={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>
                  {t(K.common.previous)}
                </Button>
                <Button mode="outlined" onPress={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1}>
                  {t(K.common.next)}
                </Button>
              </View>
            </View>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button mode="contained" onPress={onDismiss}>
            {t(K.personForm.chooseAnotherMember)}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
