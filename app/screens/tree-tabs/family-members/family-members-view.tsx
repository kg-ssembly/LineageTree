import React, { useEffect, useMemo, useState } from 'react';
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
import {
  formatPersonDate,
  getDisplayPersonPhoto,
  getPersonFallbackAvatarIcon,
  getPersonPresenceLabel,
  parsePersonDate,
} from '../../../../components/dto/person';
import { formatPersonGender, formatPersonName } from '../../../../components/person-formatting';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
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

  const filteredPeople = useMemo(
    () => people.filter((person) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (normalizedQuery) {
        const searchableText = [
          formatPersonName(person),
          person.middleNames ?? '',
          person.nicknames?.join(' ') ?? '',
          person.birthPlace ?? '',
          person.hometown ?? '',
          person.familyBranch ?? '',
          person.clanName ?? '',
          person.surnameVariantHints?.join(' ') ?? '',
          ...(selectedTree?.surnameVariantGroups.flatMap((group) => [group.primarySurname, ...group.variants]) ?? []),
          person.birthDate,
          person.deathDate,
          person.notes,
          getPersonPresenceLabel(person),
        ].join(' ').toLowerCase();
        if (!searchableText.includes(normalizedQuery)) {
          return false;
        }
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
    }),
    [filters, people, searchQuery, personRelStats, selectedTree?.surnameVariantGroups],
  );

  const totalPages = Math.max(1, Math.ceil(filteredPeople.length / MEMBERS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, people, selectedTree.id]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedPeople = useMemo(() => {
    const startIndex = (currentPage - 1) * MEMBERS_PER_PAGE;
    return filteredPeople.slice(startIndex, startIndex + MEMBERS_PER_PAGE);
  }, [currentPage, filteredPeople]);

  const openFilterModal = () => {
    setDraftFilters(filters);
    setFilterModalVisible(true);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setFilterModalVisible(false);
  };

  const renderMemberItem = ({ item: person }: { item: PersonRecord }) => {
    const preferredPhoto = getDisplayPersonPhoto(person);
    const isCurrentUsersPerson = currentAssignedPerson?.id === person.id;

    return (
      <View>
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
              {isCurrentUsersPerson ? <Chip compact icon="account">{t('You')}</Chip> : null}
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
      </View>
    );
  };

  return (
    <View style={[styles.content, { flex: 1, paddingBottom: 0 }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.sectionHeader}>
          <View style={styles.titleWrap}>
            <View style={styles.titleWithHelperRow}>
              <Text variant="titleLarge">{t('Family members')}</Text>
              <IconButton
                icon="information-outline"
                size={20}
                style={styles.helperIconButton}
                onPress={() => setHelperVisible(true)}
                accessibilityLabel={t('About family members')}
              />
            </View>
            <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {t('Tap a card to open a profile.')}
            </Text>
          </View>
          {canEdit ? (
            <Button mode="contained" icon="account-plus" onPress={onOpenAddPerson} disabled={mutating}>
              {t('Add')}
            </Button>
          ) : null}
        </View>

        <View style={styles.searchRow}>
          <TextInput
            mode="outlined"
            label={t('Search family members')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
            left={<TextInput.Icon icon="magnify" />}
            right={searchQuery ? <TextInput.Icon icon="close" onPress={() => setSearchQuery('')} /> : undefined}
          />
          <Button
            mode={activeFilterCount > 0 ? 'contained' : 'outlined'}
            onPress={openFilterModal}
            style={styles.filterButton}
            contentStyle={styles.filterButtonContent}
            compact
          >
            <View style={styles.filterButtonInner}>
              <MaterialCommunityIcons name="tune" size={18} color={activeFilterCount > 0 ? theme.colors.onPrimary : theme.colors.primary} />
              {activeFilterCount > 0 ? (
                <Text variant="labelLarge" style={{ color: theme.colors.onPrimary }}>
                  ({activeFilterCount})
                </Text>
              ) : null}
            </View>
          </Button>
        </View>

        <View style={{ flex: 1 }}>
          {loadingTreeData ? (
            <View style={styles.centeredState}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {t('Loading tree details...')}
              </Text>
            </View>
          ) : filteredPeople.length === 0 ? (
            <View style={styles.emptyState}>
              <Text variant="titleMedium">{t('No matching family members')}</Text>
              <Text variant="bodyMedium" style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>
                {people.length === 0
                  ? (canEdit ? t('Add a family member to start building this family tree.') : t('This shared tree does not have any family members yet.'))
                  : t('Try adjusting the search or filters.')}
              </Text>
              {activeFilterCount > 0 ? (
                <Button mode="outlined" onPress={() => setFilters(DEFAULT_FILTERS)} style={{ marginTop: 8 }}>
                  {t('Clear filters')}
                </Button>
              ) : null}
            </View>
          ) : (
            <>
              <View style={[styles.resultsPill, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t('{count} member(s)', { count: filteredPeople.length })}
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
                ListFooterComponent={totalPages > 1 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 8 }}>
                    <IconButton
                      icon="chevron-left"
                      onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      accessibilityLabel={t('Previous page')}
                    />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t('Page {current} of {total}', { current: currentPage, total: totalPages })}
                    </Text>
                    <IconButton
                      icon="chevron-right"
                      onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      accessibilityLabel={t('Next page')}
                    />
                  </View>
                ) : null}
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
          <Dialog.Title style={dialogChrome.dialogTitle}>{t('Filter members')}</Dialog.Title>
          <Dialog.ScrollArea style={dialogChrome.scrollArea}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={dialogChrome.content}>
              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t('Gender')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['all', 'female', 'male', 'non-binary', 'other', 'unspecified'] as const).map((gender) => (
                  <Chip
                    key={gender}
                    selected={draftFilters.gender === gender}
                    onPress={() => setDraftFilters((current) => ({ ...current, gender }))}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  >
                    {gender === 'all' ? t('All genders') : formatPersonGender(gender)}
                  </Chip>
                ))}
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t('Presence')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['all', 'present', 'deceased'] as const).map((presence) => (
                  <Chip
                    key={presence}
                    selected={draftFilters.presence === presence}
                    onPress={() => setDraftFilters((current) => ({ ...current, presence }))}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  >
                    {presence === 'all' ? t('Any') : t(presence.charAt(0).toUpperCase() + presence.slice(1))}
                  </Chip>
                ))}
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t('Birth date range')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <Button mode="outlined" icon="calendar-start" onPress={() => setBirthDateFromPickerVisible(true)}>
                  {formatDateFilterLabel(draftFilters.birthDateFrom, t('From date'))}
                </Button>
                {draftFilters.birthDateFrom ? (
                  <Button onPress={() => setDraftFilters((current) => ({ ...current, birthDateFrom: '' }))}>
                    {t('Clear')}
                  </Button>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <Button mode="outlined" icon="calendar-end" onPress={() => setBirthDateToPickerVisible(true)}>
                  {formatDateFilterLabel(draftFilters.birthDateTo, t('To date'))}
                </Button>
                {draftFilters.birthDateTo ? (
                  <Button onPress={() => setDraftFilters((current) => ({ ...current, birthDateTo: '' }))}>
                    {t('Clear')}
                  </Button>
                ) : null}
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t('Has notes')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <TriToggleChip label={t('Has notes')} value={draftFilters.hasNotes} onChange={(value) => setDraftFilters((current) => ({ ...current, hasNotes: value }))} />
              </View>

              <Text variant="titleSmall" style={{ marginTop: 8, marginBottom: 4 }}>{t('Relationships')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <TriToggleChip label={t('Has parents')} value={draftFilters.hasParents} onChange={(value) => setDraftFilters((current) => ({ ...current, hasParents: value }))} />
                <TriToggleChip label={t('Has children')} value={draftFilters.hasChildren} onChange={(value) => setDraftFilters((current) => ({ ...current, hasChildren: value }))} />
                <TriToggleChip label={t('Has spouse')} value={draftFilters.hasSpouse} onChange={(value) => setDraftFilters((current) => ({ ...current, hasSpouse: value }))} />
              </View>

              <Button mode="outlined" icon="filter-remove" onPress={() => setDraftFilters(DEFAULT_FILTERS)} style={{ marginTop: 12 }}>
                {t('Clear all filters')}
              </Button>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={[dialogChrome.dialogActions, { borderTopColor: theme.colors.outlineVariant }]}>
            <Button mode="outlined" onPress={() => setFilterModalVisible(false)}>{t('Cancel')}</Button>
            <Button mode="contained" onPress={applyFilters}>{t('Apply')}</Button>
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
        saveLabel={t('Save')}
        label={t('Select earliest birth date')}
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
        saveLabel={t('Save')}
        label={t('Select latest birth date')}
      />

      <Portal>
        <Dialog
          visible={helperVisible}
          onDismiss={() => setHelperVisible(false)}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t('Family members')}</Dialog.Title>
          <IconButton
            icon="close"
            size={20}
            onPress={() => setHelperVisible(false)}
            style={dialogChrome.closeButton}
            accessibilityLabel={t('Close')}
          />
          <Dialog.Content style={dialogChrome.content}>
            <Text variant="bodyMedium">
              {t('Each card represents one person in this family tree. Tap a card to open their full profile. Use the search bar and Filters button to narrow by name, gender, presence, birth date, photos, notes, or relationship status. The tri-state filter chips cycle through unset, must have, and must not have.')}
            </Text>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </View>
  );
}
