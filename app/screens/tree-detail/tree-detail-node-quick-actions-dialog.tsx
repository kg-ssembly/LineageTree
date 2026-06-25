import React from 'react';
import { Dialog, IconButton, List, Portal, Text } from 'react-native-paper';
import type { PersonRecord } from '../../../components/dto/person';
import type { FamilyTree } from '../../../components/dto/tree';
import { extractSurname } from '../../../components/family-tree-surname-clusters';
import { formatPersonName } from '../../../components/person-formatting';
import { GlobalStyles } from '../../../constants/styles';
import { I18N_KEYS as K } from '../../../i18n/keys';

const dialogChrome = GlobalStyles.dialogChrome;
const styles = GlobalStyles.treeDetail;

export function TreeDetailNodeQuickActionsDialog({
  visible,
  person,
  theme,
  t,
  canEdit,
  mutating,
  selectedTree,
  trees,
  closeNodeQuickActions,
  openPersonProfile,
  openCreateRelativeDialog,
  crossSurnameChildIds,
  canvasActiveFamilyRef,
  canvasFamilySwitchRef,
  findConnectedTreeForSurname,
  navigation,
}: {
  visible: boolean;
  person: PersonRecord | null;
  theme: any;
  t: (message: string, params?: Record<string, string | number | null | undefined>) => string;
  canEdit: boolean;
  mutating: boolean;
  selectedTree: FamilyTree | null;
  trees: FamilyTree[];
  closeNodeQuickActions: () => void;
  openPersonProfile: (person: PersonRecord) => void;
  openCreateRelativeDialog: (mode: 'parent-of' | 'child-of' | 'spouse-of', person: PersonRecord) => void;
  crossSurnameChildIds: Set<string>;
  canvasActiveFamilyRef: React.MutableRefObject<string | null>;
  canvasFamilySwitchRef: React.MutableRefObject<((surname: string) => void) | null>;
  findConnectedTreeForSurname: typeof import('../tree-screen-helpers').findConnectedTreeForSurname;
  navigation: any;
}) {
  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={closeNodeQuickActions}
        style={[dialogChrome.dialog, styles.quickActionDialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{person ? formatPersonName(person) : 'Quick actions'}</Dialog.Title>
        <IconButton
          icon="close"
          size={20}
          onPress={closeNodeQuickActions}
          style={dialogChrome.closeButton}
          accessibilityLabel={t(K.common.close)}
        />
        <Dialog.Content style={dialogChrome.content}>
          <Text variant="bodyMedium" style={[styles.quickActionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            {t('Choose what you want to do with this family member in the tree.')}
          </Text>
          <List.Item
            title={t(K.relationship.openProfile)}
            description={t(K.relationship.relationshipSummaryHint)}
            left={(props) => <List.Icon {...props} icon="account-arrow-right-outline" />}
            onPress={() => {
              if (!person) {
                return;
              }
              closeNodeQuickActions();
              openPersonProfile(person);
            }}
          />
          {person?.maidenName?.trim() ? (() => {
            const maiden = person.maidenName!.trim();
            const marital = extractSurname(person);
            const currentFamily = canvasActiveFamilyRef.current;
            const isViewingMaiden = currentFamily === maiden;
            const targetSurname = isViewingMaiden ? marital : maiden;
            const label = isViewingMaiden
              ? t(K.relationship.viewMaritalFamilyTree, { surname: marital })
              : t(K.relationship.viewMaidenFamilyTree, { surname: maiden });
            const description = isViewingMaiden
              ? t(K.relationship.switchToFamilyByMarriage, { surname: marital })
              : t(K.relationship.switchToBirthFamily, { surname: maiden });
            const linkedTree = findConnectedTreeForSurname(person, targetSurname, selectedTree, trees);
            return (
              <List.Item
                title={label}
                description={description}
                left={(props) => <List.Icon {...props} icon="family-tree" />}
                onPress={() => {
                  closeNodeQuickActions();
                  if (linkedTree) {
                    navigation.push('TreeDetail', {
                      treeId: linkedTree.id,
                      initialTab: 'VisualisationTab',
                      returnTreeId: selectedTree?.id,
                    });
                    return;
                  }
                  canvasFamilySwitchRef.current?.(targetSurname);
                }}
              />
            );
          })() : null}
          {person && !person.maidenName?.trim() && crossSurnameChildIds.has(person.id) ? (() => {
            const surname = extractSurname(person);
            const alreadyViewing = canvasActiveFamilyRef.current === surname;
            if (alreadyViewing) return null;
            return (
              <List.Item
                title={t(K.relationship.viewSurnameFamilyTree, { surname })}
                description={t(K.relationship.crossFamilyParentsHint)}
                left={(props) => <List.Icon {...props} icon="source-branch" />}
                onPress={() => {
                  closeNodeQuickActions();
                  canvasFamilySwitchRef.current?.(surname);
                }}
              />
            );
          })() : null}
          {canEdit && person ? (
            <>
              <List.Item
                title={t(K.relationship.addParent)}
                description={t(K.relationship.createParentForName, { name: formatPersonName(person) })}
                left={(props) => <List.Icon {...props} icon="account-arrow-up-outline" />}
                onPress={() => openCreateRelativeDialog('parent-of', person)}
                disabled={mutating}
              />
              <List.Item
                title={t(K.relationship.addChild)}
                description={t(K.relationship.createChildForName, { name: formatPersonName(person) })}
                left={(props) => <List.Icon {...props} icon="account-arrow-down-outline" />}
                onPress={() => openCreateRelativeDialog('child-of', person)}
                disabled={mutating}
              />
              <List.Item
                title={t(K.relationship.addSpouse)}
                description={t(K.relationship.createSpouseForName, { name: formatPersonName(person) })}
                left={(props) => <List.Icon {...props} icon="account-heart-outline" />}
                onPress={() => openCreateRelativeDialog('spouse-of', person)}
                disabled={mutating}
              />
            </>
          ) : null}
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}
