import { expandTreeGraph, loadCompleteTreeGraph, searchTreeGraph } from '../../../../providers/tree-graph-service';
import { useTreeStore } from '../../../../stores/tree-store';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text, useTheme } from 'react-native-paper';
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
  const graphMore = useTreeStore(state => state.graphMore);
  const graphComplete = useTreeStore(state => state.graphComplete);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<typeof people>([]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!searchTerm.trim()) { setSearchResults([]); return; }
      void searchTreeGraph(selectedTree.id, searchTerm).then(results => { if (active) setSearchResults(results); }).catch(error => { if (active) setPageError(error.message); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [searchTerm, selectedTree.id]);
  const load = async (action: () => Promise<unknown>) => {
    setPageLoading(true); setPageError('');
    try { await action(); } catch (error) { setPageError(error instanceof Error ? error.message : 'Could not load this branch. Try again.'); }
    finally { setPageLoading(false); }
  };
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
    [...hiddenChildIds(p.id, relationships, visibleIds).filter(id => peopleById.has(id)), ...(!graphComplete && graphMore[p.id + ':children'] !== null ? ['__unloaded__'] : [])]])), [visiblePeople, relationships, visibleIds, peopleById, graphMore, graphComplete]);
  const hiddenParents = useMemo(() => new Map(visiblePeople.map(p => [p.id,
    [...hiddenParentIds(p.id, relationships, visibleIds).filter(id => peopleById.has(id)), ...(!graphComplete && graphMore[p.id + ':parents'] !== null ? ['__unloaded__'] : [])]])), [visiblePeople, relationships, visibleIds, peopleById, graphMore, graphComplete]);
  const revealParents = (personId: string) => { void load(async () => {
    const next = [...(hiddenParents.get(personId) ?? []).filter(id => id !== '__unloaded__'), ...await expandTreeGraph(selectedTree.id, personId, 'parents')];
    setRevealed(current => [...new Set([...current, ...next])]);
    setCollapsed(current => current.filter(id => !next.some(parentId => lineageIds(id, relationships, 'descendants').has(parentId))));
    setTraceFrom(null); setTraceTo(null);
  }); };
  const revealChildren = (personId: string) => { void load(async () => {
    const hiddenIds = (moreChildren.get(personId) ?? []).filter(id => id !== '__unloaded__');
    const next = hiddenIds.length ? hiddenIds.slice(0, 4) : await expandTreeGraph(selectedTree.id, personId, 'children');
    setRevealed(current => [...new Set([...current, ...next])]);
    setCollapsed(current => current.filter(id => !next.some(nextId => lineageIds(id, relationships, 'descendants').has(nextId))));
    setTraceFrom(null); setTraceTo(null);
  }); };
  const focusBranch = (personId: string) => {
    void load(() => expandTreeGraph(selectedTree.id, personId));
    setRootId(personId); setScope('branch'); setRevealed([]); setCollapsed([]);
    setTraceFrom(null); setTraceTo(null);
    setFocusRequest({ personId, token: Date.now() });
  };
  const selectPerson = (person: typeof people[number]) => { void load(async () => {
    await loadCompleteTreeGraph(selectedTree.id);
    const relationships = useTreeStore.getState().relationships;
    const peopleById = new Map(useTreeStore.getState().people.map(p => [p.id, p]));
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
  }); };
  const changeScope = (next: TreeScope) => { if (next === 'full') void load(() => loadCompleteTreeGraph(selectedTree.id)); setScope(next); setRevealed([]); setRootId(selectedId ?? focusRoot); setCollapsed([]); setTraceFrom(null); setTraceTo(null); setFocusRequest(undefined); };


  return (
    <View style={[styles.visualisationTabContainer, { backgroundColor: theme.colors.background }]}>
      <ScreenBackground variant="soft-circles" />
      {pageLoading ? <View style={{padding: 8, flexDirection: 'row', gap: 8}}><ActivityIndicator /><Text accessibilityLiveRegion="polite">{t('Loading family records…')}</Text></View> : null}
      {pageError ? <Text accessibilityRole="alert" style={{padding: 12, color: theme.colors.error}}>{pageError} {t('Use the same control to retry.')}</Text> : null}
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
          searchPeople={searchTerm ? searchResults : people}
          onSearchQueryChange={setSearchTerm}
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
          moreMenuItems={[
            { key: 'full', label: 'Full tree', icon: 'unfold-more-horizontal', selected: scope === 'full', onPress: () => changeScope('full') },
            { key: 'branch', label: 'Family branch', icon: 'family-tree', selected: scope === 'branch', onPress: () => changeScope('branch') },
            { key: 'ancestors', label: 'Ancestors', icon: 'arrow-up-bold-outline', selected: scope === 'ancestors', onPress: () => changeScope('ancestors') },
            { key: 'descendants', label: 'Descendants', icon: 'arrow-down-bold-outline', selected: scope === 'descendants', onPress: () => changeScope('descendants') },
            ...(selectedId && selectedId !== focusRoot ? [{ key: 'focus-branch', label: 'Focus family branch', icon: 'crosshairs-gps', onPress: () => focusBranch(selectedId) }] : []),
          ]}
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
