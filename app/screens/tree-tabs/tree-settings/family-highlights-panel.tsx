import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { Reveal } from '../../../../components';
import type { PersonLifeEvent, PersonRecord } from '../../../../components/dto/person';
import { formatPersonDate, parsePersonDate } from '../../../../components/dto/person';
import { formatPersonName } from '../../../../components/person-formatting';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';

const styles = GlobalStyles.treeDetail;

type HighlightAnniversary = {
  id: string;
  date: string;
  title: string;
  subtitle: string;
};

type HighlightPanelKey = 'recent' | 'anniversary' | 'growth';

function getAnniversaryDateForYear(dateValue: string, year: number) {
  if (!dateValue) {
    return null;
  }

  const parsed = parsePersonDate(dateValue);
  if (!parsed) {
    return null;
  }

  return new Date(year, parsed.getMonth(), parsed.getDate());
}

function getDaysUntil(date: Date, now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function buildBranchGrowth(people: PersonRecord[]) {
  const counts = new Map<string, { surname: string; total: number; fresh: number }>();
  const newestBoundary = Date.now() - (1000 * 60 * 60 * 24 * 45);

  people.forEach((person) => {
    const surname = person.lastName.trim() || person.maidenName?.trim() || 'Unknown';
    const current = counts.get(surname) ?? { surname, total: 0, fresh: 0 };
    current.total += 1;
    const createdAt = Date.parse(person.createdAt);
    if (Number.isFinite(createdAt) && createdAt >= newestBoundary) {
      current.fresh += 1;
    }
    counts.set(surname, current);
  });

  return [...counts.values()]
    .sort((left, right) => right.total - left.total || right.fresh - left.fresh || left.surname.localeCompare(right.surname));
}

function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}

export function FamilyHighlightsPanel({
  people,
  currentAssignedPerson,
  openPersonProfile,
}: {
  people: PersonRecord[];
  currentAssignedPerson: PersonRecord | null;
  openPersonProfile: (person: PersonRecord) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const pageSize = 3;
  const [expandedPanel, setExpandedPanel] = useState<HighlightPanelKey | null>(null);
  const [recentPage, setRecentPage] = useState(0);
  const [anniversaryPage, setAnniversaryPage] = useState(0);
  const [growthPage, setGrowthPage] = useState(0);

  const togglePanel = (panel: HighlightPanelKey) => {
    setExpandedPanel((current) => (current === panel ? null : panel));
  };

  const recentAdditions = useMemo(
    () => [...people]
      .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? '')),
    [people],
  );

  const anniversaries = useMemo<HighlightAnniversary[]>(() => {
    const now = new Date();
    const candidates: HighlightAnniversary[] = [];

    people.forEach((person) => {
      const birthThisYear = getAnniversaryDateForYear(person.birthDate, now.getFullYear());
      if (birthThisYear) {
        let date = birthThisYear;
        if (getDaysUntil(date, now) < 0) {
          date = getAnniversaryDateForYear(person.birthDate, now.getFullYear() + 1) ?? birthThisYear;
        }
        candidates.push({
          id: `birth-${person.id}`,
          date: date.toISOString(),
          title: `${formatPersonName(person)}'s birthday`,
          subtitle: person.birthDate ? `Born ${formatPersonDate(person.birthDate)}` : 'Birthday remembered in the tree',
        });
      }

      person.lifeEvents.forEach((event: PersonLifeEvent) => {
        const eventThisYear = getAnniversaryDateForYear(event.date, now.getFullYear());
        if (!eventThisYear) {
          return;
        }
        let date = eventThisYear;
        if (getDaysUntil(date, now) < 0) {
          date = getAnniversaryDateForYear(event.date, now.getFullYear() + 1) ?? eventThisYear;
        }
        candidates.push({
          id: `${person.id}-${event.id}`,
          date: date.toISOString(),
          title: event.title || `${formatPersonName(person)} memory`,
          subtitle: `${formatPersonName(person)} • ${event.description || t(K.memories.rememberedFamilyMoment)}`,
        });
      });
    });

    return candidates
      .map((item) => ({ ...item, daysUntil: getDaysUntil(new Date(item.date), now) }))
      .filter((item) => item.daysUntil >= 0 && item.daysUntil <= 90)
      .sort((left, right) => left.daysUntil - right.daysUntil)
      .map(({ daysUntil: _daysUntil, ...item }) => item);
  }, [people, t]);

  const branchGrowth = useMemo(() => buildBranchGrowth(people), [people]);
  const recentPageCount = Math.max(1, Math.ceil(recentAdditions.length / pageSize));
  const anniversaryPageCount = Math.max(1, Math.ceil(anniversaries.length / pageSize));
  const growthPageCount = Math.max(1, Math.ceil(branchGrowth.length / pageSize));
  const recentPageItems = paginateItems(recentAdditions, recentPage, pageSize);
  const anniversaryPageItems = paginateItems(anniversaries, anniversaryPage, pageSize);
  const growthPageItems = paginateItems(branchGrowth, growthPage, pageSize);

  const recentExpanded = expandedPanel === 'recent';
  const anniversaryExpanded = expandedPanel === 'anniversary';
  const growthExpanded = expandedPanel === 'growth';

  return (
    <Reveal delay={80}>
      <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface, marginBottom: 18 }]} elevation={1}>
        <View style={styles.sectionHeader}>
          <View style={styles.titleWrap}>
            <Text variant="titleLarge">{t(K.home.familyHighlights)}</Text>
            <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Fresh faces, remembered dates, and the branches growing around you.
            </Text>
          </View>
        </View>

        <View style={styles.highlightGrid}>
          <View style={[styles.highlightColumn, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
            <View style={styles.highlightColumnHeader}>
              <View style={styles.sectionHeader}>
                <View style={styles.titleWrap}>
                  <Text variant="titleMedium">{t(K.home.recentAdditions)}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    The newest people added to this family story.
                  </Text>
                </View>
                <IconButton
                  icon={recentExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  onPress={() => togglePanel('recent')}
                />
              </View>
            </View>
            {recentExpanded && recentAdditions.length > 0 ? recentPageItems.map((person, index) => (
              <Reveal key={person.id} delay={140 + index * 60}>
                <View style={[styles.highlightStoryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                  <Text variant="titleSmall">{formatPersonName(person)}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Added {formatPersonDate(person.createdAt.slice(0, 10))}
                  </Text>
                  <Button compact mode="text" onPress={() => openPersonProfile(person)} style={styles.highlightAction}>
                    Discover their story
                  </Button>
                </View>
              </Reveal>
            )) : (
              recentExpanded ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  The next person you add will start this chapter.
                </Text>
              ) : null
            )}
            {recentExpanded && recentAdditions.length > pageSize ? (
              <View style={styles.dashboardActionRow}>
                <Button mode="text" disabled={recentPage === 0} onPress={() => setRecentPage((current) => Math.max(0, current - 1))}>
                  Previous
                </Button>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                  Page {recentPage + 1} of {recentPageCount}
                </Text>
                <Button mode="text" disabled={recentPage >= recentPageCount - 1} onPress={() => setRecentPage((current) => Math.min(recentPageCount - 1, current + 1))}>
                  Next
                </Button>
              </View>
            ) : null}
          </View>

          <View style={[styles.highlightColumn, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
            <View style={styles.highlightColumnHeader}>
              <View style={styles.sectionHeader}>
                <View style={styles.titleWrap}>
                  <Text variant="titleMedium">{t(K.home.comingUp)}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    Birthdays and milestones that are approaching soon.
                  </Text>
                </View>
                <IconButton
                  icon={anniversaryExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  onPress={() => togglePanel('anniversary')}
                />
              </View>
            </View>
            {anniversaryExpanded && anniversaries.length > 0 ? anniversaryPageItems.map((item, index) => (
              <Reveal key={item.id} delay={180 + index * 60}>
                <View style={[styles.highlightStoryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                  <Text variant="titleSmall">{item.title}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {formatPersonDate(item.date.slice(0, 10))}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.subtitle}
                  </Text>
                </View>
              </Reveal>
            )) : (
              anniversaryExpanded ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  As birthdays and milestones are added, they will appear here.
                </Text>
              ) : null
            )}
            {anniversaryExpanded && anniversaries.length > pageSize ? (
              <View style={styles.dashboardActionRow}>
                <Button mode="text" disabled={anniversaryPage === 0} onPress={() => setAnniversaryPage((current) => Math.max(0, current - 1))}>
                  Previous
                </Button>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                  Page {anniversaryPage + 1} of {anniversaryPageCount}
                </Text>
                <Button mode="text" disabled={anniversaryPage >= anniversaryPageCount - 1} onPress={() => setAnniversaryPage((current) => Math.min(anniversaryPageCount - 1, current + 1))}>
                  Next
                </Button>
              </View>
            ) : null}
          </View>

          <View style={[styles.highlightColumn, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
            <View style={styles.highlightColumnHeader}>
              <View style={styles.sectionHeader}>
                <View style={styles.titleWrap}>
                  <Text variant="titleMedium">{t(K.home.branchGrowth)}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    A quick look at the family names and branches growing most recently.
                  </Text>
                </View>
                <IconButton
                  icon={growthExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  onPress={() => togglePanel('growth')}
                />
              </View>
            </View>
            {growthExpanded ? growthPageItems.map((branch, index) => (
              <Reveal key={branch.surname} delay={220 + index * 60}>
                <View style={[styles.highlightStoryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                  <Text variant="titleSmall">{branch.surname}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {t(K.treeSettings.familyMembersCount, { count: branch.total })}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {branch.fresh > 0 ? `${branch.fresh} new this season` : 'Steady and well-rooted'}
                  </Text>
                </View>
              </Reveal>
            )) : null}
            {growthExpanded && branchGrowth.length > pageSize ? (
              <View style={styles.dashboardActionRow}>
                <Button mode="text" disabled={growthPage === 0} onPress={() => setGrowthPage((current) => Math.max(0, current - 1))}>
                  Previous
                </Button>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                  Page {growthPage + 1} of {growthPageCount}
                </Text>
                <Button mode="text" disabled={growthPage >= growthPageCount - 1} onPress={() => setGrowthPage((current) => Math.min(growthPageCount - 1, current + 1))}>
                  Next
                </Button>
              </View>
            ) : null}
            {growthExpanded && currentAssignedPerson ? (
              <View style={[styles.highlightAside, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                <Text variant="labelLarge">{t(K.home.yourPlaceInTheStory)}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {formatPersonName(currentAssignedPerson)} is linked to your account, so you can jump back into your branch anytime.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Surface>
    </Reveal>
  );
}
