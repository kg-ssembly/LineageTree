import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text, Tooltip, useTheme } from 'react-native-paper';
import { EmptyState, FamilyTreeCanvas, GlobalStyles, ScreenBackground, BUTTON_CHROME, BUTTON_CONTENT_CHROME } from '../../../../components';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import type { SharedTabProps } from '../shared';

import { branchIds, hiddenParentIds, hiddenChildIds, describeFamilyStep, lineageIds, scopeIds, relationshipPath, type TreeScope } from '../../../../components/tree-exploration';

const styles = GlobalStyles.treeDetail;

export function FamilyTreeView({
  selectedTree,
  people,
  relationships,
  onOpenPersonQuickActions,
  onOpenAddPersonForRelationship,
  currentAssignedPerson,
  loadingTreeData,
  familySwitchRef,
  activeFamilyRef,
  canEdit,
  mutating,
  onOpenAddPerson,
  onOpenRelationshipDialog,
}: SharedTabProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scope, setScope] = useState<TreeScope>('branch');
  const [revealed, setRevealed] = useState<string[]>([]);
  const [rootId, setRootId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [traceFrom, setTraceFrom] = useState<string | null>(null);
  const [traceTo, setTraceTo] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ personId: string; token: number }>();
  useEffect(() => {
    setSelectedId(null); setRootId(null); setScope('branch'); setCollapsed([]); setRevealed([]);
    setTraceFrom(null); setTraceTo(null); setFocusRequest(undefined);
  }, [selectedTree.id]);
  const peopleById = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
  const focusRoot = rootId ?? currentAssignedPerson?.id ?? people[0]?.id ?? '';
  const path = useMemo(() => traceFrom && traceTo ? relationshipPath(traceFrom, traceTo, relationships) : null, [traceFrom, traceTo, relationships]);
  const pathIds = useMemo(() => path ? [traceFrom!, ...path.map(step => step.to)] : undefined, [path, traceFrom]);
  const scoped = useMemo(() => {
    const base = scope === 'ancestors' || scope === 'descendants' ? branchIds(focusRoot, relationships, scope) : scopeIds(focusRoot, relationships, scope);
    if (base) revealed.forEach(id => base.add(id));
    return base;
  }, [focusRoot, relationships, scope, revealed]);
  const hidden = useMemo(() => {
    const ids = new Set<string>();
    collapsed.forEach(id => lineageIds(id, relationships, 'descendants').forEach(child => { if (child !== id) ids.add(child); }));
    return ids;
  }, [collapsed, relationships]);
  const visiblePeople = useMemo(() => people.filter(p => (!scoped || scoped.has(p.id)) && !hidden.has(p.id)), [people, scoped, hidden]);
  const visibleRelationships = useMemo(() => {
    const ids = new Set(visiblePeople.map(p => p.id));
    return relationships.filter(r => ids.has(r.fromPersonId) && ids.has(r.toPersonId));
  }, [visiblePeople, relationships]);
  const visibleIds = useMemo(() => new Set(visiblePeople.map(p => p.id)), [visiblePeople]);
  const moreChildren = useMemo(() => new Map(visiblePeople.map(p => [p.id,
    hiddenChildIds(p.id, relationships, visibleIds).filter(id => peopleById.has(id))])), [visiblePeople, relationships, visibleIds, peopleById]);
  const hiddenParents = useMemo(() => new Map(visiblePeople.map(p => [p.id,
    hiddenParentIds(p.id, relationships, visibleIds).filter(id => peopleById.has(id))])), [visiblePeople, relationships, visibleIds, peopleById]);
  const revealParents = (personId: string) => {
    const next = hiddenParents.get(personId) ?? [];
    setRevealed(current => [...new Set([...current, ...next])]);
    setCollapsed(current => current.filter(id => !next.some(parentId => lineageIds(id, relationships, 'descendants').has(parentId))));
    setTraceFrom(null); setTraceTo(null);
  };
  const revealChildren = (personId: string) => {
    const next = (moreChildren.get(personId) ?? []).slice(0, 4);
    setRevealed(current => [...new Set([...current, ...next])]);
    setCollapsed(current => current.filter(id => !next.some(nextId => lineageIds(id, relationships, 'descendants').has(nextId))));
    setTraceFrom(null); setTraceTo(null);
  };
  const focusBranch = (personId: string) => {
    setRootId(personId); setScope('branch'); setRevealed([]); setCollapsed([]);
    setTraceFrom(null); setTraceTo(null);
    setFocusRequest({ personId, token: Date.now() });
  };
  const selectPerson = (person: typeof people[number]) => {
    setSelectedId(person.id);
    const comparing = !!traceFrom && !traceTo;
    const fromId = comparing ? traceFrom : currentAssignedPerson?.id;
    const connection = fromId ? relationshipPath(fromId, person.id, relationships) : null;
    if (comparing) setTraceTo(person.id);
    const sentences = !fromId ? [t('Link your profile to see your connection, or compare with someone else.')]
      : fromId === person.id ? [t(person.id === currentAssignedPerson?.id ? 'This is you.' : 'These are the same person.')]
      : connection ? connection.map(step => describeFamilyStep(step, peopleById, t)).filter(Boolean)
      : [t('No connection is recorded between these people yet.')];
    const parents = relationships.filter(r => r.type === 'parent-child' && r.toPersonId === person.id).map(r => peopleById.get(r.fromPersonId)).filter(p => !!p);
    onOpenPersonQuickActions(person, {
      relationshipSentences: sentences,
      hasConnection: !!connection?.length,
      showRelationshipInitially: comparing,
      onTrace: () => { if (fromId) { setTraceFrom(fromId); setTraceTo(person.id); setScope('full'); setCollapsed([]); } },
      onCompare: () => { setTraceFrom(person.id); setTraceTo(null); setScope('full'); setCollapsed([]); setSelectedId(null); },
      onClose: () => setSelectedId(null),
      onFocusBranch: () => focusBranch(person.id),
      branchCollapsed: collapsed.includes(person.id),
      canCollapse: lineageIds(person.id, relationships, 'descendants').size > 1,
      onToggleBranch: () => {
        setTraceFrom(null); setTraceTo(null);
        setCollapsed(current => current.includes(person.id) ? current.filter(id => id !== person.id) : [...current, person.id]);
        setFocusRequest({ personId: person.id, token: Date.now() });
      },
      siblings: canEdit ? parents.map(parent => ({ label: `${t('Add sibling through')} ${parent.firstName}`, onPress: () => onOpenAddPersonForRelationship('child-of', parent) })) : [],
    });
  };
  const changeScope = (next: TreeScope) => { setScope(next); setRevealed([]); setRootId(selectedId ?? focusRoot); setCollapsed([]); setTraceFrom(null); setTraceTo(null); setFocusRequest(undefined); };


  return (
    <View style={[styles.visualisationTabContainer, { backgroundColor: theme.colors.background }]}>
      <ScreenBackground variant="soft-circles" />
      {collapsed.length > 0 || traceFrom ? <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
        {collapsed.length ? <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{collapsed.map(id => <Button key={id} compact icon="unfold-more-horizontal" onPress={() => setCollapsed(current => current.filter(item => item !== id))}>{peopleById.get(id)?.firstName}: {hiddenChildIds(id, relationships, visibleIds).length} {t('more children')}</Button>)}</ScrollView> : null}
        {traceFrom ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ flex: 1 }} accessibilityLiveRegion="polite">{traceTo ? path ? t('The highlighted line shows the recorded connection.') : t('No connection is recorded between these people.') : t('Select another person on the tree to trace your connection.')}</Text><IconButton icon="close" accessibilityLabel={t('Clear relationship trace')} onPress={() => { setTraceFrom(null); setTraceTo(null); }} /></View> : null}
      </View> : null}
      {people.length > 1 && relationships.length === 0 && canEdit && !loadingTreeData ? (
        <View style={{ padding: 16, gap: 8, backgroundColor: theme.colors.surface }}>
          <Text variant="bodyMedium">{t(K.home.linkPeopleTogetherSoTheTreeBecomesAConnectedFamilyInsteadOfSeparatePages)}</Text>
          <Button mode="outlined" icon="family-tree" onPress={onOpenRelationshipDialog} disabled={mutating} style={[BUTTON_CHROME, { alignSelf: 'flex-start' }]} contentStyle={BUTTON_CONTENT_CHROME}>
            {t(K.relationship.addRelationship)}
          </Button>
        </View>
      ) : null}
      {people.length > 0 ? (
        <FamilyTreeCanvas
          people={visiblePeople}
          compactCards
          searchPeople={people}
          onSearchPerson={focusBranch}
          hiddenParents={hiddenParents}
          onRevealParents={revealParents}
          moreChildren={moreChildren}
          onRevealChildren={revealChildren}
          preserveAnchorPersonId={selectedId ?? focusRoot}
          relationships={visibleRelationships}
          currentTreeId={selectedTree.id}
          onPressPerson={selectPerson}
          highlightedPersonId={selectedId ?? undefined}
          highlightedPathIds={pathIds}
          focusRequest={focusRequest}
          viewportStorageKey={`${selectedTree.id}:${scope}:${focusRoot}`}
          disableSurnameClustering
          currentUserPersonId={currentAssignedPerson?.id ?? undefined}
          initialFocusPersonId={scope === 'full' ? currentAssignedPerson?.id : focusRoot}
          floatingControls
          searchControls={<View style={{ flexShrink: 1, gap: 2 }}>
            {scope !== 'full' ? <Text variant="labelSmall" style={{ paddingHorizontal: 8 }}>{peopleById.get(focusRoot)?.firstName} · {t(scope === 'close' ? 'Close family' : 'Starts with 2 generations')} · {visiblePeople.length}/{people.length}</Text> : null}
            {selectedId && selectedId !== focusRoot ? <Button compact onPress={() => focusBranch(selectedId)}>{t('Focus family branch')}</Button> : null}
            {width < 900 ? <Text variant="labelMedium" style={{ paddingHorizontal: 8, color: theme.colors.primary }}>{t(scope === 'branch' ? 'Family branch' : scope === 'close' ? 'Close family' : scope === 'ancestors' ? 'Ancestors' : scope === 'descendants' ? 'Descendants' : 'Full tree')}</Text> : null}
            <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 0 }}>
              {([
                { key: 'branch', label: 'Family branch', icon: 'family-tree' },
                { key: 'ancestors', label: 'Ancestors', icon: 'arrow-up-bold-outline' },
                { key: 'descendants', label: 'Descendants', icon: 'arrow-down-bold-outline' },
              ] as const).map(item => width >= 900 ? <Button key={item.key} compact icon={item.icon} mode={scope === item.key ? 'contained-tonal' : 'text'} accessibilityRole="tab" accessibilityLabel={t(item.label)} accessibilityState={{ selected: scope === item.key }} onPress={() => changeScope(item.key)} contentStyle={{ minHeight: 44 }} style={{ borderRadius: 24 }}>{t(item.label)}</Button> : <Tooltip key={item.key} title={t(item.label)}>
                <IconButton icon={item.icon} size={23} mode={scope === item.key ? 'contained' : undefined} containerColor={scope === item.key ? theme.colors.primaryContainer : undefined} iconColor={scope === item.key ? theme.colors.primary : theme.colors.onSurfaceVariant} accessibilityRole="tab" accessibilityLabel={t(item.label)} accessibilityState={{ selected: scope === item.key }} onPress={() => changeScope(item.key)} style={{ margin: 0, width: 44, height: 44 }} />
              </Tooltip>)}
            </View>
          </View>}
          fillAvailableSpace
          familySwitchRef={familySwitchRef}
          activeFamilyRef={activeFamilyRef}
        />
      ) : loadingTreeData ? (
        <View style={[styles.visualisationEmptyState, { backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent' }]}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant, marginTop: 14 }]}>
            {t(K.tree.familyMembers.loading)}
          </Text>
        </View>
      ) : (
        <View style={[styles.visualisationEmptyState, { backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent' }]}>
          <EmptyState
            icon="family-tree"
            title={t(K.lineage.noVisualTreeYet)}
            message={t(canEdit ? K.tree.familyMembers.startBuilding : K.tree.familyMembers.sharedTreeEmpty)}
            actionLabel={canEdit ? t(K.home.addFamilyMember) : undefined}
            onAction={canEdit ? onOpenAddPerson : undefined}
            disabled={mutating}
          />
        </View>
      )}
    </View>
  );
}
