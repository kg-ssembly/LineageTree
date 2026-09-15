import SiblingEntryDialog from '../../../components/sibling-entry-dialog';
import type { FamilyConnection } from '../../../components/family-entry-guidance';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { TreePersonActions } from '../../../components/tree-exploration';
import { Button, Text } from 'react-native-paper';
import { BUTTON_CHROME } from '../../../components';
import { AdaptiveDialog, PersonPortrait } from '../../../components/ui';
import { getDisplayPersonPhoto, getPersonLifeSpanLabel } from '../../../components/dto/person';
import { PersonPhotoViewerModal } from '../person-profile/dialogs/photo-viewer-modal';
import type { PersonRecord } from '../../../components/dto/person';
import { extractSurname } from '../../../components/family-tree-surname-clusters';
import { formatPersonName } from '../../../components/person-formatting';
import { I18N_KEYS as K } from '../../../i18n/keys';
import { useTreeStore } from '../../../stores/tree-store';

const compactButton = { ...BUTTON_CHROME, alignSelf: 'flex-start' as const, maxWidth: '100%' as const };
const compactButtonContent = { minHeight: 44, paddingHorizontal: 4 };

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
  openPersonPhotos,
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
  openPersonPhotos: (person: PersonRecord) => void;
  openCreateRelativeDialog: (mode: 'parent-of' | 'child-of' | 'spouse-of' | 'sibling-of', person: PersonRecord, connections?: FamilyConnection[]) => void;
  crossSurnameChildIds: Set<string>;
  canvasActiveFamilyRef: React.MutableRefObject<string | null>;
  canvasFamilySwitchRef: React.MutableRefObject<((surname: string) => void) | null>;
  onOpenMaidenFamilyTree: (person: PersonRecord, maidenSurname: string, maritalSurname: string, isViewingMaiden: boolean) => void;
}) {
  const [siblingPerson, setSiblingPerson] = useState<PersonRecord | null>(null);
  const people = useTreeStore(state => state.people);
  const relationships = useTreeStore(state => state.relationships);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const hasParents = useTreeStore((state) => state.relationships.some((r) => r.type === 'parent-child' && r.toPersonId === person?.id));
  const photo = getDisplayPersonPhoto(person);
  const [expandedSection, setExpandedSection] = useState<'relationship' | 'family' | 'add' | null>(null);
  useEffect(() => {
    setExpandedSection(treeActions?.showRelationshipInitially ? 'relationship' : null);
    setViewerIndex(null);
  }, [person?.id, visible, treeActions?.showRelationshipInitially]);
  const toggleSection = (section: 'relationship' | 'family' | 'add') => {
    setExpandedSection(current => current === section ? null : section);
  };
  const hasFamilyOptions = !!treeActions?.onFocusBranch || treeActions?.canCollapse || !!person?.maidenName?.trim()
    || !!(person && crossSurnameChildIds.has(person.id) && canvasActiveFamilyRef.current !== extractSurname(person));
  const dismiss = () => { treeActions?.onClose(); closeNodeQuickActions(); };
  return (
    <>
      <SiblingEntryDialog visible={!!siblingPerson} fixedPerson={siblingPerson} people={people} relationships={relationships} onDismiss={() => setSiblingPerson(null)} onSubmit={(sibling, connections) => { setSiblingPerson(null); openCreateRelativeDialog('sibling-of', sibling, connections); }} />
      <AdaptiveDialog visible={visible && viewerIndex === null} onDismiss={dismiss} title={person ? formatPersonName(person) : t(K.relationship.quickActions)} actions={person ? <>
        <Button mode="contained" icon="account-arrow-right-outline" style={BUTTON_CHROME} contentStyle={compactButtonContent} onPress={() => { dismiss(); openPersonProfile(person); }}>{t(K.relationship.openProfile)}</Button>

      </> : undefined}>
        {person ? <View style={{ alignItems: 'center', gap: 10 }}>
          <Pressable disabled={!photo} accessibilityRole={photo ? 'button' : undefined} accessibilityLabel={t('View profile photo')} onPress={() => { if (photo) setViewerIndex(person.photos.findIndex(item => item.id === photo.id)); }} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
            <PersonPortrait person={person} size={128} highlighted />
          </Pressable>
          <Text variant="headlineSmall" accessibilityRole="header" style={{ textAlign: 'center', color: theme.colors.onSurface }}>{formatPersonName(person)}</Text>
          <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>{getPersonLifeSpanLabel(person)}</Text>
          {treeActions?.relationshipSentences.length === 1 ? <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.colors.primary }}>{treeActions.relationshipSentences[0]}</Text> : null}
          {!photo && canEdit ? <Button mode="text" icon="camera-plus-outline" contentStyle={compactButtonContent} disabled={mutating} onPress={() => { dismiss(); openPersonPhotos(person); }}>{t(K.personProfile.addPhotoTitle)}</Button> : null}
        </View> : null}
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
            {treeActions?.onFocusBranch ? <Button mode="text" icon="family-tree" compact style={compactButton} contentStyle={compactButtonContent} onPress={() => { closeNodeQuickActions(); treeActions.onFocusBranch?.(); }}>{t('Focus family branch')}</Button> : null}
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
          <View style={{ gap: 8 }}>
            {canEdit && person ? (
              <Button mode="outlined" icon={expandedSection === 'add' ? 'chevron-up' : 'account-plus-outline'} compact style={BUTTON_CHROME} contentStyle={compactButtonContent} disabled={mutating} accessibilityState={{ expanded: expandedSection === 'add' }} onPress={() => toggleSection('add')}>{t('Add relative')}</Button>
            ) : null}
              {canEdit && person && expandedSection === 'add' ? <View style={{ gap: 6, padding: 12, borderRadius: 16, backgroundColor: theme.colors.surfaceVariant }}>
                {([
                  { mode: 'parent-of', label: K.relationship.addParent, icon: 'account-arrow-up-outline' },
                  { mode: 'child-of', label: K.relationship.addChild, icon: 'account-arrow-down-outline' },
                  { mode: 'spouse-of', label: K.relationship.addSpouse, icon: 'account-heart-outline' },
                ] as const).map(action => <Button key={action.mode} mode="text" icon={action.icon} compact style={compactButton} contentStyle={compactButtonContent} disabled={mutating} onPress={() => { dismiss(); openCreateRelativeDialog(action.mode, person); }}>{t(action.label)}</Button>)}
                <Button mode="text" icon="account-multiple-outline" compact style={compactButton} contentStyle={compactButtonContent} disabled={mutating || !hasParents} onPress={() => { setSiblingPerson(person); dismiss(); }}>{t('Add sibling')}</Button>
                {!hasParents ? <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20, paddingHorizontal: 12, paddingBottom: 6 }}>{t('Add a parent first, then connect a sibling through that shared parent.')}</Text> : null}
                {treeActions?.siblings.map(sibling => <Button key={sibling.label} mode="text" icon="account-multiple-plus-outline" compact style={compactButton} contentStyle={compactButtonContent} disabled={mutating} onPress={() => { dismiss(); sibling.onPress(); }}>{sibling.label}</Button>)}
              </View> : null}
          </View>
      </AdaptiveDialog>
      {person && visible && viewerIndex !== null ? <PersonPhotoViewerModal person={person} viewerIndex={viewerIndex} setViewerIndex={setViewerIndex} /> : null}
    </>
  );
}
