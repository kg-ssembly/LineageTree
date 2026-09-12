import React, { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import type { TreePersonActions } from '../../../components/tree-exploration';
import { Button, Dialog, IconButton, Portal, Text } from 'react-native-paper';
import { BUTTON_CHROME, GlobalStyles } from '../../../components';
import type { PersonRecord } from '../../../components/dto/person';
import { extractSurname } from '../../../components/family-tree-surname-clusters';
import { formatPersonName } from '../../../components/person-formatting';
import { I18N_KEYS as K } from '../../../i18n/keys';

const dialogChrome = GlobalStyles.dialogChrome;
const compactButton = { ...BUTTON_CHROME, alignSelf: 'flex-start' as const, maxWidth: '100%' as const };
const compactButtonContent = { minHeight: 40, paddingHorizontal: 4 };

export function TreeDetailNodeQuickActionsDialog({
  visible,
  person,
  treeActions,
  theme,
  t,
  canEdit,
  mutating,
  closeNodeQuickActions,
  openPersonProfile,
  openCreateRelativeDialog,
  crossSurnameChildIds,
  canvasActiveFamilyRef,
  canvasFamilySwitchRef,
  onOpenMaidenFamilyTree,
}: {
  visible: boolean;
  treeActions?: TreePersonActions;
  person: PersonRecord | null;
  theme: any;
  t: (message: string, params?: Record<string, string | number | null | undefined>) => string;
  canEdit: boolean;
  mutating: boolean;
  closeNodeQuickActions: () => void;
  openPersonProfile: (person: PersonRecord) => void;
  openCreateRelativeDialog: (mode: 'parent-of' | 'child-of' | 'spouse-of', person: PersonRecord) => void;
  crossSurnameChildIds: Set<string>;
  canvasActiveFamilyRef: React.MutableRefObject<string | null>;
  canvasFamilySwitchRef: React.MutableRefObject<((surname: string) => void) | null>;
  onOpenMaidenFamilyTree: (person: PersonRecord, maidenSurname: string, maritalSurname: string, isViewingMaiden: boolean) => void;
}) {
  const { height } = useWindowDimensions();
  const [expandedSection, setExpandedSection] = useState<'relationship' | 'family' | 'add' | null>(null);
  useEffect(() => {
    setExpandedSection(treeActions?.showRelationshipInitially ? 'relationship' : null);
  }, [person?.id, visible, treeActions?.showRelationshipInitially]);
  const toggleSection = (section: 'relationship' | 'family' | 'add') => {
    setExpandedSection(current => current === section ? null : section);
  };
  const hasFamilyOptions = treeActions?.canCollapse || !!person?.maidenName?.trim()
    || !!(person && crossSurnameChildIds.has(person.id) && canvasActiveFamilyRef.current !== extractSurname(person));
  const dismiss = () => { treeActions?.onClose(); closeNodeQuickActions(); };
  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={dismiss}
        style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{person ? formatPersonName(person) : t(K.relationship.quickActions)}</Dialog.Title>
        <IconButton
          icon="close"
          size={20}
          onPress={dismiss}
          style={dialogChrome.closeButton}
          accessibilityLabel={t(K.common.close)}
        />
        <Dialog.ScrollArea style={[dialogChrome.scrollArea, { maxHeight: height * 0.65 }]}>
        <ScrollView contentContainerStyle={[dialogChrome.content, { gap: 6, paddingTop: 4 }]} keyboardShouldPersistTaps="handled">
          {canEdit && person ? (
            <>
              <Button mode="contained" icon={expandedSection === 'add' ? 'chevron-up' : 'account-plus-outline'} compact style={compactButton} contentStyle={compactButtonContent} accessibilityState={{ expanded: expandedSection === 'add' }} onPress={() => toggleSection('add')}>{t('Add relative')}</Button>
              {expandedSection === 'add' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 8 }}>
                {([
                  { mode: 'parent-of', label: K.relationship.addParent, icon: 'account-arrow-up-outline' },
                  { mode: 'child-of', label: K.relationship.addChild, icon: 'account-arrow-down-outline' },
                  { mode: 'spouse-of', label: K.relationship.addSpouse, icon: 'account-heart-outline' },
                ] as const).map(action => <Button key={action.mode} mode="text" icon={action.icon} compact style={compactButton} contentStyle={compactButtonContent} disabled={mutating} onPress={() => { dismiss(); openCreateRelativeDialog(action.mode, person); }}>{t(action.label)}</Button>)}
                {treeActions?.siblings.map(sibling => <Button key={sibling.label} mode="text" icon="account-multiple-plus-outline" compact style={compactButton} contentStyle={compactButtonContent} disabled={mutating} onPress={() => { dismiss(); sibling.onPress(); }}>{sibling.label}</Button>)}
              </View> : null}
            </>
          ) : null}
          <Button mode="outlined" icon="account-arrow-right-outline" compact style={compactButton} contentStyle={compactButtonContent} onPress={() => {
            if (!person) return;
            closeNodeQuickActions();
            openPersonProfile(person);
          }}>{t(K.relationship.openProfile)}</Button>
          {treeActions ? <>
            <Button mode={expandedSection === 'relationship' ? 'contained-tonal' : 'text'} icon={expandedSection === 'relationship' ? 'chevron-up' : 'chevron-down'} compact style={compactButton} contentStyle={compactButtonContent} accessibilityState={{ expanded: expandedSection === 'relationship' }} onPress={() => { toggleSection('relationship'); if (expandedSection !== 'relationship') treeActions.onTrace(); }}>{t('How are we related?')}</Button>
            {expandedSection === 'relationship' ?
            <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderLeftWidth: 2, borderColor: theme.colors.outlineVariant }}>
              {treeActions.relationshipSentences.map((sentence, index) => <Text key={index} style={{ color: theme.colors.onSurface }}>{sentence}</Text>)}
              {treeActions.hasConnection ? <Button mode="text" icon="family-tree" compact style={compactButton} contentStyle={compactButtonContent} onPress={closeNodeQuickActions}>{t('View highlighted connection')}</Button> : null}
              <Button mode="text" icon="account-switch-outline" compact style={compactButton} contentStyle={compactButtonContent} onPress={() => { closeNodeQuickActions(); treeActions.onCompare(); }}>{t('Compare with someone else')}</Button>
            </View> : null}
          </> : null}
          {hasFamilyOptions ? <>
            <Button mode={expandedSection === 'family' ? 'contained-tonal' : 'text'} icon={expandedSection === 'family' ? 'chevron-up' : 'chevron-down'} compact style={compactButton} contentStyle={compactButtonContent} accessibilityState={{ expanded: expandedSection === 'family' }} onPress={() => toggleSection('family')}>{t('Family tree options')}</Button>
            {expandedSection === 'family' ? <View style={{ gap: 6, paddingLeft: 8 }}>
            {treeActions?.canCollapse ? <Button mode="text" icon="unfold-more-horizontal" compact style={compactButton} contentStyle={compactButtonContent} onPress={() => { closeNodeQuickActions(); treeActions.onToggleBranch(); }}>{t(treeActions.branchCollapsed ? 'Expand branch' : 'Collapse descendants')}</Button> : null}
          {person?.maidenName?.trim() ? (() => {
            const maiden = person.maidenName!.trim();
            const marital = extractSurname(person);
            const currentFamily = canvasActiveFamilyRef.current;
            const isViewingMaiden = currentFamily === maiden;
            const label = isViewingMaiden
              ? t(K.relationship.viewMaritalFamilyTree, { surname: marital })
              : t(K.relationship.viewMaidenFamilyTree, { surname: maiden });
            const description = isViewingMaiden
              ? t(K.relationship.switchToFamilyByMarriage, { surname: marital })
              : t(K.relationship.switchToBirthFamily, { surname: maiden });
            return (
              <View style={{ gap: 6 }}>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{description}</Text>
                <Button mode="text" icon="family-tree" compact style={compactButton} contentStyle={compactButtonContent} onPress={() => onOpenMaidenFamilyTree(person, maiden, marital, isViewingMaiden)}>{label}</Button>
              </View>
            );
          })() : null}
          {person && !person.maidenName?.trim() && crossSurnameChildIds.has(person.id) ? (() => {
            const surname = extractSurname(person);
            const alreadyViewing = canvasActiveFamilyRef.current === surname;
            if (alreadyViewing) return null;
            return (
              <Button mode="text" icon="source-branch" compact style={compactButton} contentStyle={compactButtonContent} onPress={() => { closeNodeQuickActions(); canvasFamilySwitchRef.current?.(surname); }}>{t(K.relationship.viewSurnameFamilyTree, { surname })}</Button>
            );
          })() : null}
            </View> : null}
          </> : null}
        </ScrollView>
        </Dialog.ScrollArea>

      </Dialog>
    </Portal>
  );
}
