import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, ScrollView, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import type { PersonGender, PersonRecord } from '../../../../components/dto/person';
import { InfoDialog, Reveal, ScreenBackground } from '../../../../components';
import {
  formatPersonDate,
  getDisplayPersonPhoto,
  getPersonFallbackAvatarIcon,
  getPersonPresenceLabel,
  parsePersonDate,
} from '../../../../components/dto/person';
import { formatPersonGender, formatPersonName } from '../../../../components/person-formatting';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import type { SharedTabProps } from '../shared';

const dialogChrome = GlobalStyles.dialogChrome;
const styles = GlobalStyles.treeDetail;

type MemberFilters = {
  gender: 'all' | PersonGender;
  presence: 'all' | 'present' | 'deceased';
  hasNotes: boolean | null;
  hasParents: boolean | null;
  hasChildren: boolean | null;
  hasSpouse: boolean | null;
  birthDateFrom: string;
  birthDateTo: string;
};

const DEFAULT_FILTERS: MemberFilters = {
  gender: 'all',
  presence: 'all',
  hasNotes: null,
  hasParents: null,
  hasChildren: null,
  hasSpouse: null,
  birthDateFrom: '',
  birthDateTo: '',
};

const MEMBERS_PER_PAGE = 5;

function countActiveFilters(filters: MemberFilters): number {
  let count = 0;
  if (filters.gender !== 'all') count += 1;
  if (filters.presence !== 'all') count += 1;
  if (filters.hasNotes !== null) count += 1;
  if (filters.hasParents !== null) count += 1;
  if (filters.hasChildren !== null) count += 1;
  if (filters.hasSpouse !== null) count += 1;
  if (filters.birthDateFrom) count += 1;
  if (filters.birthDateTo) count += 1;
  return count;
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateFilterLabel(value: string, emptyLabel: string) {
  return value ? formatPersonDate(value) : emptyLabel;
}

function TriToggleChip({ label, value, onChange, disabled }: {
  label: string;
  value: boolean | null;
  onChange: (next: boolean | null) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const handlePress = () => onChange(value === null ? true : value === true ? false : null);
  const icon = value === true ? 'check' : value === false ? 'close' : undefined;
  const backgroundColor = value !== null ? (value ? theme.colors.primaryContainer : theme.colors.errorContainer) : undefined;
  const selectedColor = value !== null ? (value ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer) : undefined;

  return (
    <Chip
      selected={value !== null}
      icon={icon}
      onPress={handlePress}
      disabled={disabled}
      style={[{ marginRight: 8, marginBottom: 8 }, backgroundColor ? { backgroundColor } : undefined]}
      selectedColor={selectedColor}
    >
      {label}
    </Chip>
  );
}

export function FamilyMembersView({
  selectedTree,
  people,
  relationships,
  currentAssignedPerson,
  canEdit,
  mutating,
  loadingTreeData,
  openPersonProfile,
  onOpenAddPerson,
}: SharedTabProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [helperVisible, setHelperVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MemberFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<MemberFilters>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [birthDateFromPickerVisible, setBirthDateFromPickerVisible] = useState(false);
  const [birthDateToPickerVisible, setBirthDateToPickerVisible] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const selectedBirthDateFrom = useMemo(() => parsePersonDate(draftFilters.birthDateFrom) ?? undefined, [draftFilters.birthDateFrom]);
  const selectedBirthDateTo = useMemo(() => parsePersonDate(draftFilters.birthDateTo) ?? undefined, [draftFilters.birthDateTo]);

  const personRelStats = useMemo(() => {
    const parentOf = new Set<string>();
    const childOf = new Set<string>();
    const spouseOf = new Set<string>();
    relationships.forEach((relationship) => {
      if (relationship.type === 'parent-child') {
        parentOf.add(relationship.fromPersonId);
        childOf.add(relationship.toPersonId);
      } else if (relationship.type === 'spouse') {
        spouseOf.add(relationship.fromPersonId);
        spouseOf.add(relationship.toPersonId);
      }
    });
    return { parentOf, childOf, spouseOf };
  }, [relationships]);

  const searchablePeople = useMemo(
    () => people.map((person) => {
      const presenceLabel = getPersonPresenceLabel(person);
      return {
        person,
        presenceLabel,
        searchableText: [
          formatPersonName(person),
          person.firstName,
          person.lastName,
          person.maidenName ?? '',
          person.middleNames ?? '',
          person.nicknames?.join(' ') ?? '',
          person.birthPlace ?? '',
          person.hometown ?? '',
          person.familyBranch ?? '',
          person.clanName ?? '',
          person.surnameVariantHints?.join(' ') ?? '',
          person.birthDate,
          person.deathDate,
          person.notes,
          presenceLabel,
        ].join(' ').toLowerCase(),
      };
    }),
    [people],
  );

  const filteredPeople = useMemo(
    () => {
      const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
      return searchablePeople
        .filter(({ person, searchableText }) => {
          if (normalizedQuery && !searchableText.includes(normalizedQuery)) {
            return false;
          }

          if (filters.gender !== 'all' && person.gender !== filters.gender) return false;
          if (filters.presence === 'present' && person.deathDate) return false;
          if (filters.presence === 'deceased' && !person.deathDate) return false;
          if (filters.hasNotes === true && !person.notes.trim()) return false;
          if (filters.hasNotes === false && person.notes.trim()) return false;
          if (filters.hasParents === true && !personRelStats.childOf.has(person.id)) return false;
          if (filters.hasParents === false && personRelStats.childOf.has(person.id)) return false;
          if (filters.hasChildren === true && !personRelStats.parentOf.has(person.id)) return false;
          if (filters.hasChildren === false && personRelStats.parentOf.has(person.id)) return false;
          if (filters.hasSpouse === true && !personRelStats.spouseOf.has(person.id)) return false;
          if (filters.hasSpouse === false && personRelStats.spouseOf.has(person.id)) return false;

          if (filters.birthDateFrom || filters.birthDateTo) {
            if (!person.birthDate) return false;
            if (filters.birthDateFrom && person.birthDate < filters.birthDateFrom) return false;
            if (filters.birthDateTo && person.birthDate > filters.birthDateTo) return false;
          }

          return true;
        })
        .map(({ person }) => person);
    },
    [deferredSearchQuery, filters, personRelStats, searchablePeople],
  );

  const totalPages = Math.max(1, Math.ceil(filteredPeople.length / MEMBERS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchQuery, filters, selectedTree.id]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedPeople = useMemo(() => {
    const startIndex = (currentPage - 1) * MEMBERS_PER_PAGE;
    return filteredPeople.slice(startIndex, startIndex + MEMBERS_PER_PAGE);
  }, [currentPage, filteredPeople]);

  const openFilterModal = useCallback(() => {
    setDraftFilters(filters);
    setFilterModalVisible(true);
  }, [filters]);

  const applyFilters = useCallback(() => {
    setFilters(draftFilters);
    setFilterModalVisible(false);
  }, [draftFilters]);

  const renderMemberItem = useCallback(({ item: person, index }: { item: PersonRecord; index: number }) => {
    const preferredPhoto = getDisplayPersonPhoto(person);
    const isCurrentUsersPerson = currentAssignedPerson?.id === person.id;

    return (
      <Reveal delay={90 + index * 35}>
        <View style={styles.memberListRow}>
          <View style={styles.personPhotoWrap}>
            {preferredPhoto ? (
              <Image source={{ uri: preferredPhoto.url }} style={styles.personPhoto} />
            ) : (
              <View style={styles.personPhotoFallback}>
                <MaterialCommunityIcons name={getPersonFallbackAvatarIcon(person)} size={30} color={theme.colors.primary} />
              </View>
            )}
          </View>
          <View style={styles.memberListInfo}>
            <View style={styles.personNameRow}>
              <Text variant="titleMedium">{formatPersonName(person)}</Text>
              {isCurrentUsersPerson ? <Chip compact icon="account">{t(K.common.you)}</Chip> : null}
            </View>
            <Text variant="bodySmall" style={[styles.collaboratorMeta, { color: theme.colors.onSurfaceVariant, marginTop: 6 }]}>
              {[person.birthDate ? formatPersonDate(person.birthDate) : null, getPersonPresenceLabel(person)]
                .filter(Boolean)
                .join(' • ')}
            </Text>
          </View>
          <View style={styles.memberListTrailing}>
            <IconButton icon="chevron-right" onPress={() => openPersonProfile(person)} />
          </View>
        </View>
      </Reveal>
    );
  }, [currentAssignedPerson?.id, openPersonProfile, t, theme.colors.onSurfaceVariant, theme.colors.primary]);

  const memberListFooter = useMemo(() => {
    if (totalPages <= 1) {
      return null;
    }

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 8 }}>
        <IconButton
          icon="chevron-left"
          onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
          disabled={currentPage === 1}
          accessibilityLabel={t(K.tree.familyMembers.previousPage)}
          mode="outlined"
        />
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {t(K.tree.familyMembers.pageOf, { current: currentPage, total: totalPages })}
        </Text>
        <IconButton
          icon="chevron-right"
          onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          disabled={currentPage === totalPages}
          accessibilityLabel={t(K.tree.familyMembers.nextPage)}
          mode="outlined"
        />
      </View>
    );
  }, [currentPage, t, theme.colors.onSurfaceVariant, totalPages]);

  return (
    <View style={[styles.content, { flex: 1, paddingBottom: 0, backgroundColor: theme.colors.background }]}>
      <ScreenBackground />
      <View style={{ flex: 1 }}>
        <View style={styles.sectionHeader}>
          <View style={styles.titleWrap}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleLarge">{t(K.tree.familyMembers.title)}</Text>
              <IconButton
                icon="information-outline"
                size={20}
                style={styles.helperIconButton}
                onPress={() => setHelperVisible(true)}
                accessibilityLabel={t(K.tree.familyMembers.aboutLabel)}
              />
            </View>
          </View>
          {canEdit ? (
            <Button mode="contained" icon="account-plus" onPress={onOpenAddPerson} disabled={mutating} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
              {t(K.common.add)}
            </Button>
          ) : null}
        </View>

        <View style={styles.searchRow}>
          <TextInput
            mode="outlined"
            label={t(K.tree.familyMembers.search)}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
            left={<TextInput.Icon icon="magnify" />}
            right={searchQuery ? <TextInput.Icon icon="close" onPress={() => setSearchQuery('')} /> : undefined}
          />
          <IconButton
            mode={activeFilterCount > 0 ? 'contained' : 'outlined'}
            icon="tune"
            onPress={openFilterModal}
            style={styles.filterButton}>
          </IconButton>
        </View>

        <View style={{ flex: 1 }}>
          {loadingTreeData ? (
            <View style={styles.centeredState}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t(K.tree.familyMembers.loading)}
              </Text>
            </View>
          ) : filteredPeople.length === 0 ? (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">{t(K.tree.familyMembers.noMatches)}</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {people.length === 0
                  ? (canEdit ? t(K.tree.familyMembers.startBuilding) : t(K.tree.familyMembers.sharedTreeEmpty))
                  : t(K.tree.familyMembers.adjustSearchOrFilters)}
              </Text>
              {activeFilterCount > 0 ? (
                <Button mode="outlined" onPress={() => setFilters(DEFAULT_FILTERS)} style={[BUTTON_CHROME, { marginTop: 8 }]} contentStyle={BUTTON_CONTENT_CHROME}>
                  {t(K.tree.familyMembers.clearFilters)}
                </Button>
              ) : null}
            </View>
          ) : (
            <>
              <View style={[
                styles.resultsPill,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                },
              ]}>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t(K.tree.familyMembers.count, { count: filteredPeople.length })}
                </Text>
              </View>
              <FlatList
                data={paginatedPeople}
                keyExtractor={(person) => person.id}
                renderItem={renderMemberItem}
                style={{ flex: 1 }}
                contentContainerStyle={[styles.memberList, { paddingBottom: 48 }]}
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={8}
                removeClippedSubviews
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListFooterComponent={memberListFooter}
              />
            </>
          )}
        </View>
      </View>

      <Portal>
        <Dialog
          visible={filterModalVisible}
          onDismiss={() => setFilterModalVisible(false)}
          style={[dialogChrome.dialog, { maxHeight: '85%', backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={dialogChrome.dialogTitle}>{t(K.tree.familyMembers.filterMembers)}</Dialog.Title>
          <Dialog.ScrollArea style={dialogChrome.scrollArea}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={dialogChrome.content}>
              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t(K.personForm.gender)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['all', 'female', 'male', 'non-binary', 'other', 'unspecified'] as const).map((gender) => (
                  <Chip
                    key={gender}
                    selected={draftFilters.gender === gender}
                    onPress={() => setDraftFilters((current) => ({ ...current, gender }))}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  >
                    {gender === 'all' ? t(K.tree.familyMembers.allGenders) : formatPersonGender(gender)}
                  </Chip>
                ))}
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t(K.tree.filters.presence)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['all', 'present', 'deceased'] as const).map((presence) => (
                  <Chip
                    key={presence}
                    selected={draftFilters.presence === presence}
                    onPress={() => setDraftFilters((current) => ({ ...current, presence }))}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  >
                    {presence === 'all' ? t(K.common.any) : presence === 'present' ? t(K.common.present) : t(K.common.deceased)}
                  </Chip>
                ))}
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t(K.tree.filters.birthDateRange)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <Button mode="outlined" icon="calendar-start" onPress={() => setBirthDateFromPickerVisible(true)}>
                  {formatDateFilterLabel(draftFilters.birthDateFrom, t(K.tree.filters.fromDate))}
                </Button>
                {draftFilters.birthDateFrom ? (
                  <Button onPress={() => setDraftFilters((current) => ({ ...current, birthDateFrom: '' }))}>
                    {t(K.common.clear)}
                  </Button>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <Button mode="outlined" icon="calendar-end" onPress={() => setBirthDateToPickerVisible(true)}>
                  {formatDateFilterLabel(draftFilters.birthDateTo, t(K.tree.filters.toDate))}
                </Button>
                {draftFilters.birthDateTo ? (
                  <Button onPress={() => setDraftFilters((current) => ({ ...current, birthDateTo: '' }))}>
                    {t(K.common.clear)}
                  </Button>
                ) : null}
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t(K.tree.filters.hasNotes)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <TriToggleChip label={t(K.tree.filters.hasNotes)} value={draftFilters.hasNotes} onChange={(value) => setDraftFilters((current) => ({ ...current, hasNotes: value }))} />
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t(K.tree.familyMembers.relationships)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <TriToggleChip label={t(K.tree.filters.hasParents)} value={draftFilters.hasParents} onChange={(value) => setDraftFilters((current) => ({ ...current, hasParents: value }))} />
                <TriToggleChip label={t(K.tree.filters.hasChildren)} value={draftFilters.hasChildren} onChange={(value) => setDraftFilters((current) => ({ ...current, hasChildren: value }))} />
                <TriToggleChip label={t(K.tree.filters.hasSpouse)} value={draftFilters.hasSpouse} onChange={(value) => setDraftFilters((current) => ({ ...current, hasSpouse: value }))} />
              </View>

              <Button mode="outlined" icon="filter-remove" onPress={() => setDraftFilters(DEFAULT_FILTERS)} style={{ marginTop: 12 }}>
                {t(K.tree.familyMembers.clearAllFilters)}
              </Button>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button mode="outlined" onPress={() => setFilterModalVisible(false)}>{t(K.common.cancel)}</Button>
            <Button mode="contained" onPress={applyFilters}>{t(K.common.apply)}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <DatePickerModal
        locale="en"
        mode="single"
        visible={birthDateFromPickerVisible}
        date={selectedBirthDateFrom}
        onDismiss={() => setBirthDateFromPickerVisible(false)}
        onConfirm={({ date }) => {
          setBirthDateFromPickerVisible(false);
          if (date) {
            setDraftFilters((current) => ({ ...current, birthDateFrom: formatIsoDate(date) }));
          }
        }}
        saveLabel={t(K.common.save)}
        label={t(K.tree.familyMembers.selectEarliestBirthDate)}
      />

      <DatePickerModal
        locale="en"
        mode="single"
        visible={birthDateToPickerVisible}
        date={selectedBirthDateTo}
        onDismiss={() => setBirthDateToPickerVisible(false)}
        onConfirm={({ date }) => {
          setBirthDateToPickerVisible(false);
          if (date) {
            setDraftFilters((current) => ({ ...current, birthDateTo: formatIsoDate(date) }));
          }
        }}
        saveLabel={t(K.common.save)}
        label={t(K.tree.familyMembers.selectLatestBirthDate)}
      />

      <InfoDialog
        visible={helperVisible}
        title={t(K.tree.familyMembers.title)}
        message={t(K.tree.familyMembers.helper)}
        onDismiss={() => setHelperVisible(false)}
      />
    </View>
  );
}
