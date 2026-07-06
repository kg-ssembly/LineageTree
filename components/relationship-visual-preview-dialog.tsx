import React from 'react';
import { ScrollView } from 'react-native';
import { Dialog, IconButton, Portal, useTheme } from 'react-native-paper';
import FamilyTreeCanvas from './family-tree-canvas';
import type { PersonRecord } from './dto/person';
import type { RelationshipRecord } from './dto/relationship';
import { GlobalStyles } from '../constants/styles';
import { useI18n } from '../hooks/use-i18n';
import { I18N_KEYS as K } from '../i18n/keys';

const dialogChrome = GlobalStyles.dialogChrome;
const styles = GlobalStyles.personFormDialog;

interface RelationshipVisualPreviewDialogProps {
  visible: boolean;
  people: PersonRecord[];
  relationships: RelationshipRecord[];
  currentTreeId?: string;
  highlightedPersonId: string;
  onDismiss: () => void;
}

export default function RelationshipVisualPreviewDialog({
  visible,
  people,
  relationships,
  currentTreeId,
  highlightedPersonId,
  onDismiss,
}: RelationshipVisualPreviewDialogProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[dialogChrome.dialog, styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose, styles.dialogTitle]}>
          Visual Preview
        </Dialog.Title>
        <IconButton
          icon="close"
          onPress={onDismiss}
          accessibilityLabel={t(K.common.cancel)}
          style={dialogChrome.closeButton}
        />
        <Dialog.ScrollArea style={[dialogChrome.scrollArea, styles.scrollArea]}>
          <ScrollView contentContainerStyle={styles.content}>
            <FamilyTreeCanvas
              people={people}
              relationships={relationships}
              currentTreeId={currentTreeId}
              onPressPerson={() => {}}
              highlightedPersonId={highlightedPersonId}
              initialFocusPersonId={highlightedPersonId}
              allowFullscreen={false}
              floatingControls={false}
              fillAvailableSpace={false}
              showControls={false}
              disableSurnameClustering
              inlineViewportHeight={360}
            />
          </ScrollView>
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}
