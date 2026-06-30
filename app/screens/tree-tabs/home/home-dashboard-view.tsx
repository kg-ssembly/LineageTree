import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Button, Card, Chip, Dialog, IconButton, Portal, ProgressBar, Snackbar, Surface, Text, useTheme } from 'react-native-paper';
import { HorizontalTabStrip, Reveal } from '../../../../components';
import { getDisplayPersonPhoto } from '../../../../components/dto/person';
import type { MainTabParamList } from '../../../../components/dto/navigation';
import type { AppTheme } from '../../../../constants/theme';
import { GlobalStyles } from '../../../../constants/styles';
import { useI18n } from '../../../../hooks/use-i18n';
import type { SharedTabProps } from '../shared';
import { FamilyHighlightsPanel } from '../tree-settings/family-highlights-panel';
import { NotificationsView } from '../notifications/notifications-view';

const styles = GlobalStyles.treeDetail;
const profileStyles = GlobalStyles.personProfile;
const dialogChrome = GlobalStyles.dialogChrome;
const DASHBOARD_PROMPTS_STORAGE_KEY = 'lineagetree-dashboard-hidden-prompts';
const DASHBOARD_LAST_VISIT_STORAGE_KEY = 'lineagetree-dashboard-last-visit';

type DashboardTask = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  category: 'story' | 'tree';
  priority: 'urgent' | 'easy-win' | 'recommended';
  score: number;
  done: boolean;
  action: () => void;
};

type SetupStep = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  action: () => void;
};

type DashboardSectionKey = 'since-last-visit' | 'keep-building' | 'family-highlights';
type DashboardLens = 'focus' | 'activity' | 'growth';
type DashboardTabKey = 'overview' | 'highlights' | 'activity' | 'build';

type ActivityAttentionItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  actionKey: 'activity-feed' | 'approvals' | 'merge-reviews';
};

type HeroAction = {
  label: string;
  description: string;
  action: () => void;
  buttonLabel?: string;
};

function getUrgencyTone(theme: AppTheme, level: 'urgent' | 'attention' | 'calm') {
  if (level === 'urgent') {
    return {
      backgroundColor: theme.colors.errorContainer,
      textColor: theme.colors.onErrorContainer,
      borderColor: theme.colors.error,
    };
  }

  if (level === 'attention') {
    return {
      backgroundColor: theme.colors.secondaryContainer,
      textColor: theme.colors.onSecondaryContainer,
      borderColor: theme.colors.secondary,
    };
  }

  return {
    backgroundColor: theme.colors.tertiaryContainer,
    textColor: theme.colors.onTertiaryContainer,
    borderColor: theme.colors.tertiary,
  };
}

function buildDashboardTasks(props: SharedTabProps) {
  const {
    people,
    currentAssignedPerson,
    currentSelfAssignmentSuggestions,
    relationships,
    canEdit,
    onOpenAddPerson,
    onOpenAddSelf,
    openPersonProfile,
    onOpenRelationshipDialog,
  } = props;

  if (!currentAssignedPerson) {
    const initialTasks: DashboardTask[] = [
      {
        id: 'link-self',
        title: 'Create your family profile',
        description: 'Link yourself into the tree so the app can guide your next steps more personally.',
        ctaLabel: 'Start my profile',
        category: 'story',
        priority: 'urgent',
        score: 1000,
        done: false,
        action: onOpenAddSelf,
      },
      {
        id: 'add-first-member',
        title: 'Add the first family member',
        description: 'Start your tree with the first relative or ancestor you want to build around.',
        ctaLabel: 'Add family member',
        category: 'tree',
        priority: 'urgent',
        score: 960,
        done: people.length > 0,
        action: onOpenAddPerson,
      },
    ];

    return {
      storyTasks: initialTasks.filter((task) => task.category === 'story'),
      treeTasks: initialTasks.filter((task) => task.category === 'tree'),
    };
  }

  const relationshipCount = relationships.filter((relationship) => (
    relationship.fromPersonId === currentAssignedPerson.id || relationship.toPersonId === currentAssignedPerson.id
  )).length;

  const hasPhoto = Boolean(getDisplayPersonPhoto(currentAssignedPerson));
  const hasBirthDetails = Boolean(currentAssignedPerson.birthDate?.trim());
  const hasStoryNote = Boolean(currentAssignedPerson.notes?.trim());
  const hasMemories = currentAssignedPerson.lifeEvents.length > 0;
  const hasRelationships = relationshipCount > 0;
  const hasBranchIdentity = Boolean(currentAssignedPerson.familyBranch?.trim() || currentAssignedPerson.clanName?.trim());
  const hasProfilePhoto = hasPhoto;

  const profileAction = () => openPersonProfile(currentAssignedPerson);

  const otherPeopleCount = people.filter((person) => person.id !== currentAssignedPerson.id).length;
  const taskList: DashboardTask[] = [
    {
      id: 'photo',
      title: 'Add a profile photo',
      description: 'A face makes the tree feel instantly more human and recognizable.',
      ctaLabel: 'Add portrait',
      category: 'story',
      priority: 'easy-win',
      score: hasBirthDetails ? 270 : 220,
      done: hasPhoto,
      action: profileAction,
    },
    {
      id: 'birth',
      title: 'Fill in birth details',
      description: 'Dates anchor the story and help place each generation correctly.',
      ctaLabel: 'Add birth details',
      category: 'story',
      priority: 'urgent',
      score: 420,
      done: hasBirthDetails,
      action: profileAction,
    },
    {
      id: 'story',
      title: 'Write a story note',
      description: 'A small memory or description brings the profile to life for family members.',
      ctaLabel: 'Write note',
      category: 'story',
      priority: 'recommended',
      score: hasProfilePhoto || hasMemories ? 260 : 180,
      done: hasStoryNote,
      action: profileAction,
    },
    {
      id: 'memory',
      title: 'Record a milestone',
      description: 'Add one life event so the timeline starts feeling like a living scrapbook.',
      ctaLabel: 'Add memory',
      category: 'story',
      priority: 'recommended',
      score: hasStoryNote || hasProfilePhoto ? 250 : 190,
      done: hasMemories,
      action: profileAction,
    },
    {
      id: 'relationships',
      title: 'Connect family relationships',
      description: 'Parents, partners, and children are what turn a profile into a branch.',
      ctaLabel: canEdit ? 'Connect family' : 'View profile',
      category: 'tree',
      priority: 'urgent',
      score: 390,
      done: hasRelationships,
      action: canEdit ? onOpenRelationshipDialog : profileAction,
    },
    {
      id: 'branch',
      title: 'Add branch or clan detail',
      description: 'Branch and clan details help relatives recognise where this profile belongs in the wider family.',
      ctaLabel: 'Add family detail',
      category: 'story',
      priority: 'easy-win',
      score: hasRelationships ? 230 : 170,
      done: hasBranchIdentity,
      action: profileAction,
    },
    {
      id: 'add-family-member',
      title: otherPeopleCount > 0 ? 'Add another family member' : 'Add the first family member',
      description: otherPeopleCount > 0
        ? 'Each new relative gives the tree more shape and makes family connections easier to discover.'
        : 'Start building outward from your own page by adding the next person in the family.',
      ctaLabel: 'Add family member',
      category: 'tree',
      priority: 'urgent',
      score: otherPeopleCount > 0 ? 240 : 410,
      done: otherPeopleCount > 0,
      action: onOpenAddPerson,
    },
    {
      id: 'review-matches',
      title: 'Review possible profile matches',
      description: 'Suggested matches can help you quickly link the right person to your account or spot likely overlaps.',
      ctaLabel: currentSelfAssignmentSuggestions.length > 0 ? 'Review matches' : 'Add more relatives',
      category: 'tree',
      priority: currentSelfAssignmentSuggestions.length > 0 ? 'recommended' : 'easy-win',
      score: currentSelfAssignmentSuggestions.length > 0 ? 280 : 150,
      done: currentSelfAssignmentSuggestions.length === 0,
      action: currentSelfAssignmentSuggestions.length > 0 ? onOpenAddSelf : onOpenAddPerson,
    },
  ];

  const sortedTasks = taskList.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));

  return {
    storyTasks: sortedTasks.filter((task) => task.category === 'story'),
    treeTasks: sortedTasks.filter((task) => task.category === 'tree'),
  };
}

export function HomeDashboardView(props: SharedTabProps) {
  const theme = useTheme();
  useI18n();
  const navigation = useNavigation<any>();
  const {
    selectedTree,
    people,
    relationships,
    approvalRequests,
    notifications,
    mergeRequests,
    mergeHistory,
    notificationActivityStates,
    trees,
    userId,
    loadingTreeData,
    currentAssignedPerson,
    currentSelfAssignmentSuggestions,
    onOpenAddPerson,
    onOpenAddSelf,
    onOpenRelationshipDialog,
    openPersonProfile,
    canEdit,
    onOpenTreeSettingsTarget,
  } = props;

  const { storyTasks, treeTasks } = useMemo(() => buildDashboardTasks(props), [
    props.people,
    props.currentAssignedPerson,
    props.currentSelfAssignmentSuggestions,
    props.relationships,
    props.canEdit,
    props.onOpenAddPerson,
    props.onOpenAddSelf,
    props.openPersonProfile,
    props.onOpenRelationshipDialog,
  ]);
  const tasks = useMemo(() => [...storyTasks, ...treeTasks], [storyTasks, treeTasks]);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<string[]>([]);
  const [promptsHydrated, setPromptsHydrated] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);
  const [lastVisitAt, setLastVisitAt] = useState<string | null>(null);
  const completedTasks = useMemo(() => tasks.filter((task) => task.done), [tasks]);
  const completedTaskIds = useMemo(
    () => completedTasks.map((task) => task.id).sort(),
    [completedTasks],
  );
  const visibleStoryTasks = storyTasks.filter((task) => !task.done && !dismissedTaskIds.includes(task.id));
  const visibleTreeTasks = treeTasks.filter((task) => !task.done && !dismissedTaskIds.includes(task.id));
  const visibleRemainingTasks = [...visibleStoryTasks, ...visibleTreeTasks]
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
  const bestStoryStep = visibleStoryTasks[0] ?? null;
  const bestTreeStep = visibleTreeTasks[0] ?? null;
  const bestNextStep = visibleRemainingTasks[0] ?? null;
  const storyCompletedCount = storyTasks.filter((task) => task.done).length;
  const treeCompletedCount = treeTasks.filter((task) => task.done).length;
  const storyProgress = storyTasks.length > 0 ? storyCompletedCount / storyTasks.length : 0;
  const treeProgress = treeTasks.length > 0 ? treeCompletedCount / treeTasks.length : 0;
  const setupSteps = useMemo<SetupStep[]>(() => {
    const hasLinkedProfile = Boolean(currentAssignedPerson);
    const hasOtherFamilyMember = currentAssignedPerson
      ? people.some((person) => person.id !== currentAssignedPerson.id)
      : people.length > 0;
    const hasFirstConnection = relationships.length > 0;
    const hasStoryStarter = Boolean(
      currentAssignedPerson && (
        getDisplayPersonPhoto(currentAssignedPerson)
        || currentAssignedPerson.lifeEvents.length > 0
        || currentAssignedPerson.notes?.trim()
        || currentAssignedPerson.birthDate?.trim()
      )
    );

    return [
      {
        id: 'setup-profile',
        title: 'Create your profile',
        description: 'Link yourself into the tree so the app can guide your next steps personally.',
        done: hasLinkedProfile,
        action: hasLinkedProfile && currentAssignedPerson ? () => openPersonProfile(currentAssignedPerson) : onOpenAddSelf,
      },
      {
        id: 'setup-member',
        title: 'Add a family member',
        description: 'Bring in a parent, child, partner, or ancestor so the tree starts to branch.',
        done: hasOtherFamilyMember,
        action: onOpenAddPerson,
      },
      {
        id: 'setup-relationship',
        title: 'Connect the relationship',
        description: 'Link people together so the tree becomes a connected family instead of separate pages.',
        done: hasFirstConnection,
        action: onOpenRelationshipDialog,
      },
      {
        id: 'setup-story',
        title: 'Add one story detail',
        description: 'A photo, date, or memory gives the tree a more human starting point.',
        done: hasStoryStarter,
        action: currentAssignedPerson ? () => openPersonProfile(currentAssignedPerson) : onOpenAddSelf,
      },
    ];
  }, [currentAssignedPerson, onOpenAddPerson, onOpenAddSelf, onOpenRelationshipDialog, openPersonProfile, people, relationships]);
  const setupCompletedCount = setupSteps.filter((step) => step.done).length;
  const setupProgress = setupSteps.length > 0 ? setupCompletedCount / setupSteps.length : 0;
  const nextSetupStep = setupSteps.find((step) => !step.done) ?? null;
  const isSetupMode = !currentAssignedPerson || people.length <= 2 || relationships.length === 0 || setupCompletedCount < setupSteps.length;
  const pendingApprovals = approvalRequests.filter((request) => request.status === 'pending').length;
  const pendingInvites = notifications.filter((notification) => notification.type === 'merge-invite' && notification.status === 'pending').length;
  const activeMergeReviews = mergeRequests.filter((request) => request.status === 'pending' || request.status === 'changes-requested').length;
  const firstPendingApproval = approvalRequests.find((request) => request.status === 'pending') ?? null;
  const firstPendingMergeReview = mergeRequests.find((request) => request.status === 'pending' || request.status === 'changes-requested') ?? null;
  const needsAttentionCount = pendingApprovals + pendingInvites + activeMergeReviews;
  const approvalsTone = pendingApprovals > 0 ? getUrgencyTone(theme, pendingApprovals > 2 ? 'urgent' : 'attention') : getUrgencyTone(theme, 'calm');
  const invitesTone = pendingInvites > 0 ? getUrgencyTone(theme, 'attention') : getUrgencyTone(theme, 'calm');
  const mergeTone = activeMergeReviews > 0 ? getUrgencyTone(theme, activeMergeReviews > 1 ? 'urgent' : 'attention') : getUrgencyTone(theme, 'calm');
  const activityAttentionItems = useMemo<ActivityAttentionItem[]>(() => {
    const items: ActivityAttentionItem[] = [];

    notifications
      .filter((notification) => notification.status === 'pending')
      .forEach((notification) => {
        items.push({
          id: `notification-${notification.id}`,
          title: 'Merge invitation',
          description: notification.message,
          createdAt: notification.createdAt,
          actionKey: 'activity-feed',
        });
      });

    approvalRequests
      .filter((request) => request.status === 'pending')
      .forEach((request) => {
        items.push({
          id: `approval-${request.id}`,
          title: 'Approval request',
          description: `${request.title} · ${request.description}`,
          createdAt: request.updatedAt,
          actionKey: 'approvals',
        });
      });

    mergeRequests
      .filter((request) => request.status === 'pending' || request.status === 'changes-requested')
      .forEach((request) => {
        items.push({
          id: `merge-${request.id}`,
          title: 'Merge review',
          description: `${request.preview.sourceTree.treeName} ↔ ${request.preview.targetTree.treeName}`,
          createdAt: request.updatedAt,
          actionKey: 'merge-reviews',
        });
      });

    return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [approvalRequests, mergeRequests, notifications]);
  const activityNotificationCount = useMemo(() => {
    const unseenDirectCount = notifications.filter((notification) => !notification.seenAt).length;
    const actionedStateKeys = new Set(
      notificationActivityStates
        .filter((state) => Boolean(state.actionedAt))
        .map((state) => `${state.sourceKind}:${state.sourceId}`),
    );

    const unactionedApprovalCount = approvalRequests.filter((request) => !actionedStateKeys.has(`approval:${request.id}`)).length;
    const unactionedMergeRequestCount = mergeRequests.filter((request) => !actionedStateKeys.has(`merge-request:${request.id}`)).length;
    const unactionedMergeHistoryCount = mergeHistory.filter((entry) => !actionedStateKeys.has(`merge-history:${entry.id}`)).length;
    const unactionedMembershipCount = (trees ?? [])
      .flatMap((tree) => tree.membershipHistory.map((entry) => ({ tree, entry })))
      .filter(({ entry }) => !userId || entry.userId === userId || entry.action === 'invited' || entry.action === 'role-changed')
      .filter(({ tree, entry }) => !actionedStateKeys.has(`membership:${tree.id}-${entry.id}`))
      .length;

    return unseenDirectCount
      + unactionedApprovalCount
      + unactionedMergeRequestCount
      + unactionedMergeHistoryCount
      + unactionedMembershipCount;
  }, [approvalRequests, mergeHistory, mergeRequests, notificationActivityStates, notifications, trees, userId]);
  const latestActivityAttentionItem = activityAttentionItems[0] ?? null;
  const [deeperExpanded, setDeeperExpanded] = useState(false);
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [buildInfoVisible, setBuildInfoVisible] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<DashboardTabKey>(needsAttentionCount > 0 ? 'activity' : 'overview');
  const promptStorageId = `${selectedTree.id}:${currentAssignedPerson?.id ?? 'unlinked'}`;
  const dashboardVisitStorageId = `${selectedTree.id}:${currentAssignedPerson?.id ?? 'unlinked'}`;
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionOffsetsRef = useRef<Record<DashboardSectionKey, number>>({
    'since-last-visit': 0,
    'keep-building': 0,
    'family-highlights': 0,
  });
  const previousCompletedTaskIdsRef = useRef<string[] | null>(null);

  useEffect(() => {
    setDismissedTaskIds((current) => {
      const next = current.filter((taskId) => tasks.some((task) => task.id === taskId && !task.done));
      return next.length === current.length && next.every((taskId, index) => taskId === current[index]) ? current : next;
    });
  }, [tasks]);

  useEffect(() => {
    let cancelled = false;

    const hydrateHiddenPrompts = async () => {
      try {
        const stored = await AsyncStorage.getItem(DASHBOARD_PROMPTS_STORAGE_KEY);
        if (!stored) {
          if (!cancelled) {
            setDismissedTaskIds([]);
          }
          return;
        }

        const parsed = JSON.parse(stored) as Record<string, string[]>;
        const next = Array.isArray(parsed[promptStorageId]) ? parsed[promptStorageId] : [];
        if (!cancelled) {
          setDismissedTaskIds((current) => (
            current.length === next.length && current.every((taskId, index) => taskId === next[index])
              ? current
              : next
          ));
        }
      } catch {
        if (!cancelled) {
          setDismissedTaskIds([]);
        }
      } finally {
        if (!cancelled) {
          setPromptsHydrated(true);
        }
      }
    };

    setPromptsHydrated(false);
    void hydrateHiddenPrompts();

    return () => {
      cancelled = true;
    };
  }, [promptStorageId]);

  useEffect(() => {
    let cancelled = false;

    const hydrateLastVisit = async () => {
      try {
        const stored = await AsyncStorage.getItem(DASHBOARD_LAST_VISIT_STORAGE_KEY);
        if (!stored) {
          if (!cancelled) {
            setLastVisitAt(null);
          }
          return;
        }

        const parsed = JSON.parse(stored) as Record<string, string>;
        if (!cancelled) {
          setLastVisitAt(parsed[dashboardVisitStorageId] ?? null);
        }
      } catch {
        if (!cancelled) {
          setLastVisitAt(null);
        }
      }
    };

    void hydrateLastVisit();

    return () => {
      cancelled = true;
    };
  }, [dashboardVisitStorageId]);

  useEffect(() => () => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(DASHBOARD_LAST_VISIT_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) as Record<string, string> : {};
        const next = { ...parsed, [dashboardVisitStorageId]: new Date().toISOString() };
        await AsyncStorage.setItem(DASHBOARD_LAST_VISIT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures so the dashboard still works in-memory.
      }
    })();
  }, [dashboardVisitStorageId]);

  useEffect(() => {
    if (!promptsHydrated) {
      return;
    }

    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(DASHBOARD_PROMPTS_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) as Record<string, string[]> : {};
        const nextValue = dismissedTaskIds.length > 0
          ? { ...parsed, [promptStorageId]: dismissedTaskIds }
          : Object.fromEntries(Object.entries(parsed).filter(([key]) => key !== promptStorageId));
        await AsyncStorage.setItem(DASHBOARD_PROMPTS_STORAGE_KEY, JSON.stringify(nextValue));
      } catch {
        // Ignore storage failures so the dashboard still works in-memory.
      }
    })();
  }, [dismissedTaskIds, promptStorageId, promptsHydrated]);

  useEffect(() => {
    previousCompletedTaskIdsRef.current = null;
    setCelebrationMessage(null);
  }, [promptStorageId]);

  useEffect(() => {
    if (!promptsHydrated) {
      return;
    }

    if (!previousCompletedTaskIdsRef.current) {
      previousCompletedTaskIdsRef.current = completedTaskIds;
      return;
    }

    const previousCompletedTaskIds = previousCompletedTaskIdsRef.current;
    const newlyCompletedId = completedTaskIds.find((taskId) => !previousCompletedTaskIds.includes(taskId));
    if (newlyCompletedId) {
      const completedTask = completedTasks.find((task) => task.id === newlyCompletedId);
      if (completedTask) {
        setCelebrationMessage(`${completedTask.title} complete`);
      }
    }

    const snapshotChanged = completedTaskIds.length !== previousCompletedTaskIds.length
      || completedTaskIds.some((taskId, index) => taskId !== previousCompletedTaskIds[index]);
    if (snapshotChanged) {
      previousCompletedTaskIdsRef.current = completedTaskIds;
    }
  }, [completedTaskIds, completedTasks, promptsHydrated]);

  const dismissTask = (taskId: string) => {
    setDismissedTaskIds((current) => (current.includes(taskId) ? current : [...current, taskId]));
  };

  const restoreHiddenPrompts = () => {
    setDismissedTaskIds([]);
  };

  const registerSectionOffset = (key: DashboardSectionKey) => (event: LayoutChangeEvent) => {
    sectionOffsetsRef.current[key] = event.nativeEvent.layout.y;
  };

  const scrollToSection = (key: DashboardSectionKey) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, sectionOffsetsRef.current[key] - 12),
        animated: true,
      });
    });
  };

  const focusSection = (key: DashboardSectionKey) => {
    if (key === 'since-last-visit') {
      setDashboardTab('activity');
    }
    if (key === 'family-highlights') {
      setDashboardTab('highlights');
    }
    if (key === 'keep-building') {
      setDashboardTab('build');
      setDeeperExpanded(true);
    }

    setTimeout(() => {
      scrollToSection(key);
    }, 120);
  };

  const dashboardLens: DashboardLens = dashboardTab === 'activity'
    ? 'activity'
    : dashboardTab === 'build'
      ? 'growth'
      : 'focus';

  const dashboardTabs = useMemo<Array<{ key: DashboardTabKey; label: string }>>(
    () => [
      { key: 'overview', label: 'Overview' },
      { key: 'highlights', label: 'Highlights' },
      { key: 'activity', label: activityNotificationCount > 0 ? `Activity (${activityNotificationCount})` : 'Activity' },
      { key: 'build', label: 'Build' },
    ],
    [activityNotificationCount],
  );

  const openFamilyActivity = () => {
    setDashboardTab('activity');
    setActivityModalVisible(true);
  };

  const openApprovals = () => {
    if (firstPendingApproval && onOpenTreeSettingsTarget) {
      onOpenTreeSettingsTarget({ tab: 'approvals', itemId: firstPendingApproval.id, mode: 'approval' });
      navigation.navigate('treeSettings' satisfies keyof MainTabParamList);
      return;
    }

    navigation.navigate('treeSettings' satisfies keyof MainTabParamList);
  };

  const openMergeReviews = () => {
    if (firstPendingMergeReview && onOpenTreeSettingsTarget) {
      onOpenTreeSettingsTarget({ tab: 'merges', itemId: firstPendingMergeReview.id, mode: 'merge' });
      navigation.navigate('treeSettings' satisfies keyof MainTabParamList);
      return;
    }

    navigation.navigate('treeSettings' satisfies keyof MainTabParamList);
  };

  const openMergeInvites = () => {
    openFamilyActivity();
  };

  const heroAction = useMemo<HeroAction>(() => {
    if (dashboardLens === 'activity') {
      if (latestActivityAttentionItem) {
        const action = latestActivityAttentionItem.actionKey === 'approvals'
          ? openApprovals
          : latestActivityAttentionItem.actionKey === 'merge-reviews'
            ? openMergeReviews
            : openFamilyActivity;
        return {
          label: latestActivityAttentionItem.title,
          description: latestActivityAttentionItem.description,
          action,
          buttonLabel: 'Open activities',
        };
      }
      return {
        label: 'View family activity',
        description: 'Everything is calm right now, but you can still open the activity areas.',
        action: openFamilyActivity,
        buttonLabel: 'Open activities',
      };
    }

    if (dashboardLens === 'growth') {
      if (bestTreeStep) {
        return {
          label: bestTreeStep.ctaLabel,
          description: bestTreeStep.description,
          action: bestTreeStep.action,
        };
      }

      return {
        label: canEdit ? 'Add family member' : 'Open stories',
        description: canEdit
          ? 'Grow the tree by adding a new person, memory, or branch connection.'
          : 'Explore the latest stories and people in your family space.',
        action: canEdit ? onOpenAddPerson : () => focusSection('family-highlights'),
      };
    }

    if (isSetupMode && nextSetupStep) {
      return {
        label: nextSetupStep.title,
        description: nextSetupStep.description,
        action: nextSetupStep.action,
      };
    }

    if (bestStoryStep) {
      return {
        label: bestStoryStep.ctaLabel,
        description: bestStoryStep.description,
        action: bestStoryStep.action,
      };
    }

    if (bestNextStep) {
      return {
        label: bestNextStep.ctaLabel,
        description: bestNextStep.description,
        action: bestNextStep.action,
      };
    }

    return {
      label: currentAssignedPerson ? 'Open my profile' : 'Start my profile',
      description: 'Your essentials are in place. Open the story page and keep building from there.',
      action: currentAssignedPerson ? () => openPersonProfile(currentAssignedPerson) : onOpenAddSelf,
    };
  }, [
    activeMergeReviews,
    bestNextStep,
    bestStoryStep,
    bestTreeStep,
    canEdit,
    currentAssignedPerson,
    dashboardLens,
    isSetupMode,
    navigation,
    nextSetupStep,
    onOpenAddPerson,
    onOpenAddSelf,
    openPersonProfile,
    pendingApprovals,
    pendingInvites,
    latestActivityAttentionItem,
  ]);

  const lensSubtitle = isSetupMode
    ? 'Start with the setup steps below. Once the basics are in place, this home screen opens up into the full family dashboard.'
    : dashboardLens === 'activity'
      ? 'Review what changed, what is waiting, and where shared work needs a decision.'
      : dashboardLens === 'growth'
        ? 'Focus on adding people, strengthening branches, and growing the family story.'
        : currentAssignedPerson
          ? 'Here is the best next step to make your profile feel fuller and your branch more connected.'
          : 'Start by linking yourself into the tree, then the app can guide you through the steps that already exist here.';

  const sinceLastVisit = useMemo(() => {
    if (!lastVisitAt) {
      return [];
    }

    const items: Array<{ id: string; label: string; onPress: () => void }> = [];
    const newPeopleCount = people.filter((person) => person.createdAt > lastVisitAt).length;
    const updatedRelationshipCount = relationships.filter((relationship) => relationship.createdAt > lastVisitAt).length;
    const pendingApprovalCount = approvalRequests.filter((request) => request.updatedAt > lastVisitAt && request.status === 'pending').length;
    const newInviteCount = notifications.filter((notification) => notification.createdAt > lastVisitAt && notification.type === 'merge-invite').length;

    if (newPeopleCount > 0) {
      items.push({ id: 'people', label: `${newPeopleCount} new family member${newPeopleCount === 1 ? '' : 's'}`, onPress: () => focusSection('family-highlights') });
    }
    if (updatedRelationshipCount > 0) {
      items.push({ id: 'relationships', label: `${updatedRelationshipCount} new connection${updatedRelationshipCount === 1 ? '' : 's'}`, onPress: () => navigation.navigate('members' satisfies keyof MainTabParamList) });
    }
    if (pendingApprovalCount > 0) {
      items.push({ id: 'approvals', label: `${pendingApprovalCount} approval${pendingApprovalCount === 1 ? '' : 's'} waiting`, onPress: openApprovals });
    }
    if (newInviteCount > 0) {
      items.push({ id: 'invites', label: `${newInviteCount} new merge invite${newInviteCount === 1 ? '' : 's'}`, onPress: openMergeInvites });
    }

    return items;
  }, [approvalRequests, lastVisitAt, navigation, notifications, openApprovals, openMergeInvites, people, relationships]);

  if (loadingTreeData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.content, { paddingBottom: 72 }]}
      showsVerticalScrollIndicator={false}
    >
      <Reveal delay={50}>
        <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWrap}>
              <Text variant="headlineSmall">
                {currentAssignedPerson ? `Welcome back, ${currentAssignedPerson.firstName}` : 'Welcome to your family home'}
              </Text>
            </View>
            <Chip icon="home-heart">{selectedTree.name}</Chip>
          </View>

          {isSetupMode ? (
            <View style={{ marginTop: 18 }}>
              <View style={[styles.dashboardMetricRow, { marginBottom: 10 }]}>
                <Text variant="titleMedium">Complete your tree</Text>
                <Text variant="titleMedium">{Math.round(setupProgress * 100)}%</Text>
              </View>
              <ProgressBar progress={setupProgress} color={theme.colors.primary} style={{ height: 10, borderRadius: 999 }} />
              <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
                {setupCompletedCount} of {setupSteps.length} guided setup steps finished
              </Text>
            </View>
          ) : (
            <View style={[styles.dashboardMetricRow, { marginTop: 18 }]}>
              <View style={{ flex: 1, minWidth: 220 }}>
                <View style={[styles.dashboardMetricRow, { marginBottom: 10 }]}>
                  <Text variant="titleMedium">Complete your story</Text>
                  <Text variant="titleMedium">{Math.round(storyProgress * 100)}%</Text>
                </View>
                <ProgressBar progress={storyProgress} color={theme.colors.primary} style={{ height: 10, borderRadius: 999 }} />
                <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
                  {storyCompletedCount} of {storyTasks.length} profile steps finished
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: 220 }}>
                <View style={[styles.dashboardMetricRow, { marginBottom: 10 }]}>
                  <Text variant="titleMedium">Complete your tree</Text>
                  <Text variant="titleMedium">{Math.round(treeProgress * 100)}%</Text>
                </View>
                <ProgressBar progress={treeProgress} color={theme.colors.secondary} style={{ height: 10, borderRadius: 999 }} />
                <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
                  {treeCompletedCount} of {treeTasks.length} tree-building steps finished
                </Text>
              </View>
            </View>
          )}
        </Surface>
      </Reveal>

      <Reveal delay={60}>
        <Surface style={[profileStyles.tabStripCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <HorizontalTabStrip
            items={dashboardTabs}
            activeKey={dashboardTab}
            onChange={(key) => {
              setDashboardTab(key);
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
            containerStyle={{ backgroundColor: theme.colors.surface }}
            contentContainerStyle={profileStyles.tabStripContent}
            itemStyle={profileStyles.tabStripItem}
          />
        </Surface>
      </Reveal>

      {dashboardTab !== 'highlights' ? (
        <Reveal delay={70}>
          <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
          {isSetupMode ? (
            <View>
              <View style={{ gap: 10 }}>
                {setupSteps.map((step) => (
                  <Surface
                    key={step.id}
                    style={[styles.dashboardTaskCard, {
                      backgroundColor: step.done ? theme.colors.elevation.level1 : theme.colors.surface,
                      borderColor: step.done ? theme.colors.primary : theme.colors.outlineVariant,
                    }]}
                    elevation={0}
                  >
                    <View style={styles.sectionHeader}>
                      <View style={styles.titleWrap}>
                        <Chip compact icon={step.done ? 'check-circle-outline' : 'numeric'}>
                          {step.done ? 'Done' : 'Next step'}
                        </Chip>
                        <Text variant="titleMedium" style={{ marginTop: 8 }}>{step.title}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                          {step.description}
                        </Text>
                      </View>
                      <Button mode={step.done ? 'text' : 'contained-tonal'} onPress={step.action}>
                        {step.done ? 'Open' : 'Do this'}
                      </Button>
                    </View>
                  </Surface>
                ))}
              </View>
            </View>
          ) : null}

          {bestNextStep ? (
            <View style={[styles.dashboardAccentCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
              <Chip compact icon={dashboardLens === 'activity' ? 'bell-badge-outline' : dashboardLens === 'growth' ? 'sprout-outline' : 'star-four-points-outline'}>
                {isSetupMode
                  ? 'Setup wizard'
                  : dashboardLens === 'activity'
                    ? 'What needs review'
                    : dashboardLens === 'growth'
                      ? 'Grow the tree'
                      : 'Best next step'}
              </Chip>
              <Text variant="titleMedium" style={{ marginTop: 10 }}>
                {isSetupMode
                  ? nextSetupStep?.title ?? heroAction.label
                  : dashboardLens === 'focus'
                    ? bestStoryStep?.title ?? bestNextStep.title
                    : heroAction.label}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                {lensSubtitle}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                {heroAction.description}
              </Text>
              <View style={styles.dashboardActionRow}>
                <Button mode="contained" onPress={heroAction.action} style={styles.dashboardInlineAction}>
                  {isSetupMode ? 'Continue setup' : heroAction.buttonLabel ?? heroAction.label}
                </Button>
                {!isSetupMode && dashboardLens === 'focus' ? (
                  <Button mode="text" onPress={() => dismissTask((bestStoryStep ?? bestNextStep).id)} style={styles.dashboardInlineAction}>
                    Hide for now
                  </Button>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={[styles.dashboardAccentCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
              <Chip compact icon="check-decagram">{dismissedTaskIds.length > 0 ? 'Prompts cleared for now' : 'Profile looking strong'}</Chip>
              <Text variant="titleMedium" style={{ marginTop: 10 }}>Your essentials are in place</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                {dismissedTaskIds.length > 0
                  ? 'You have cleared the current prompts. Bring them back whenever you want another nudge.'
                  : 'Keep the story growing by adding more memories, photos, and relatives around your branch.'}
              </Text>
              <View style={styles.dashboardActionRow}>
                <Button mode="contained-tonal" onPress={currentAssignedPerson ? () => openPersonProfile(currentAssignedPerson) : onOpenAddSelf}>
                  {currentAssignedPerson ? 'Open my profile' : 'Start my profile'}
                </Button>
                {canEdit ? <Button mode="outlined" onPress={onOpenAddPerson}>Add family member</Button> : null}
                {dismissedTaskIds.length > 0 ? <Button mode="text" onPress={restoreHiddenPrompts}>Restore prompts</Button> : null}
              </View>
            </View>
          )}
          </Surface>
        </Reveal>
      ) : null}

      {dashboardTab === 'overview' ? (
        <>
          <Reveal delay={100}>
            <View style={styles.dashboardMetricRow}>
              <Card mode="elevated" style={[styles.dashboardMetricCard, { backgroundColor: theme.colors.surface }]}>
                <Card.Content>
                  <Text variant="labelLarge">Family members</Text>
                  <Text variant="headlineSmall">{people.length}</Text>
                </Card.Content>
              </Card>
              <Card mode="elevated" style={[styles.dashboardMetricCard, { backgroundColor: theme.colors.surface }]}>
                <Card.Content>
                  <Text variant="labelLarge">New matches</Text>
                  <Text variant="headlineSmall">{currentSelfAssignmentSuggestions.length}</Text>
                </Card.Content>
              </Card>
              <Card mode="elevated" style={[styles.dashboardMetricCard, { backgroundColor: theme.colors.surface }]}>
                <Card.Content>
                  <Text variant="labelLarge">Open tasks</Text>
                  <Text variant="headlineSmall">{visibleRemainingTasks.length}</Text>
                </Card.Content>
              </Card>
            </View>
          </Reveal>
        </>
      ) : null}

      {dashboardTab === 'highlights' ? (
        <Reveal delay={110}>
          <View onLayout={registerSectionOffset('family-highlights')}>
            <FamilyHighlightsPanel
              people={people}
              currentAssignedPerson={currentAssignedPerson}
              openPersonProfile={openPersonProfile}
            />
          </View>
        </Reveal>
      ) : null}

      {dashboardTab === 'activity' ? (
        <>
          {sinceLastVisit.length > 0 ? (
            <Reveal delay={105}>
              <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1} onLayout={registerSectionOffset('since-last-visit')}>
                <Text variant="titleLarge">Since your last visit</Text>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  A quick digest of what changed while you were away.
                </Text>
                <View style={[styles.dashboardActionRow, { marginTop: 14 }]}>
                  {sinceLastVisit.map((item) => (
                    <Chip key={item.id} icon="clock-outline" onPress={item.onPress}>
                      {item.label}
                    </Chip>
                  ))}
                </View>
              </Surface>
            </Reveal>
          ) : null}

          {needsAttentionCount > 0 ? (
            <Reveal delay={120}>
              <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <Text variant="titleLarge">Needs attention</Text>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  Shared activity that could use a look before it slips out of view.
                </Text>
                <View style={[styles.dashboardActionRow, { marginTop: 14 }]}>
                  {pendingApprovals > 0 ? (
                    <Chip
                      icon="clipboard-check-outline"
                      onPress={openApprovals}
                      style={{ backgroundColor: approvalsTone.backgroundColor, borderColor: approvalsTone.borderColor, borderWidth: 1 }}
                      textStyle={{ color: approvalsTone.textColor }}
                    >
                      {pendingApprovals} approval{pendingApprovals === 1 ? '' : 's'} waiting
                    </Chip>
                  ) : null}
                  {pendingInvites > 0 ? (
                    <Chip
                      icon="source-merge"
                      onPress={openMergeInvites}
                      style={{ backgroundColor: invitesTone.backgroundColor, borderColor: invitesTone.borderColor, borderWidth: 1 }}
                      textStyle={{ color: invitesTone.textColor }}
                    >
                      {pendingInvites} merge invite{pendingInvites === 1 ? '' : 's'}
                    </Chip>
                  ) : null}
                  {activeMergeReviews > 0 ? (
                    <Chip
                      icon="timeline-clock-outline"
                      onPress={openMergeReviews}
                      style={{ backgroundColor: mergeTone.backgroundColor, borderColor: mergeTone.borderColor, borderWidth: 1 }}
                      textStyle={{ color: mergeTone.textColor }}
                    >
                      {activeMergeReviews} merge review{activeMergeReviews === 1 ? '' : 's'}
                    </Chip>
                  ) : null}
                </View>
              </Surface>
            </Reveal>
          ) : null}

        </>
      ) : null}

      {dashboardTab === 'build' ? (
        visibleStoryTasks.length + visibleTreeTasks.length > 0 ? (
          <Reveal delay={140}>
            <View onLayout={registerSectionOffset('keep-building')}>
              <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <View style={styles.sectionHeader}>
                  <View style={styles.titleWrap}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text variant="titleLarge">{isSetupMode ? 'Setup wizard' : 'Build your family'}</Text>
                      <IconButton
                        icon="information-outline"
                        size={18}
                        style={{ margin: 0 }}
                        onPress={() => setBuildInfoVisible(true)}
                        accessibilityLabel="About build your family"
                      />
                    </View>
                  </View>
                  <IconButton
                    icon={deeperExpanded ? 'chevron-up' : 'chevron-down'}
                    onPress={() => setDeeperExpanded((current) => !current)}
                    accessibilityLabel={deeperExpanded ? 'Collapse build your family' : 'Expand build your family'}
                  />
                </View>

                {deeperExpanded ? (
                <View style={{ marginTop: 14, gap: 18 }}>
                  {visibleStoryTasks.length > 0 ? (
                    <View>
                      <Text variant="titleMedium">Complete your story</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                        These steps shape your own page into a fuller biography.
                      </Text>
                      <View style={{ marginTop: 12 }}>
                        {visibleStoryTasks.map((task, index) => (
                          <Reveal key={task.id} delay={170 + index * 35}>
                            <Card mode="outlined" style={[styles.dashboardTaskCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                              <Card.Content>
                                <View style={styles.sectionHeader}>
                                  <View style={styles.titleWrap}>
                                    <Text variant="titleMedium">{task.title}</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                                      {task.description}
                                    </Text>
                                  </View>
                                  <View style={{ alignItems: 'flex-end' }}>
                                    <Button mode="outlined" onPress={task.action}>
                                      {task.ctaLabel}
                                    </Button>
                                    <Button mode="text" compact onPress={() => dismissTask(task.id)}>
                                      Hide
                                    </Button>
                                  </View>
                                </View>
                              </Card.Content>
                            </Card>
                          </Reveal>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {visibleTreeTasks.length > 0 ? (
                    <View>
                      <Text variant="titleMedium">Complete your tree</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                        These steps grow the family beyond one person and strengthen the branch structure.
                      </Text>
                      <View style={{ marginTop: 12 }}>
                        {visibleTreeTasks.map((task, index) => (
                          <Reveal key={task.id} delay={220 + index * 35}>
                            <Card mode="outlined" style={[styles.dashboardTaskCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                              <Card.Content>
                                <View style={styles.sectionHeader}>
                                  <View style={styles.titleWrap}>
                                    <Text variant="titleMedium">{task.title}</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                                      {task.description}
                                    </Text>
                                  </View>
                                  <View style={{ alignItems: 'flex-end' }}>
                                    <Button mode="contained-tonal" onPress={task.action}>
                                      {task.ctaLabel}
                                    </Button>
                                    <Button mode="text" compact onPress={() => dismissTask(task.id)}>
                                      Hide
                                    </Button>
                                  </View>
                                </View>
                              </Card.Content>
                            </Card>
                          </Reveal>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
                ) : null}
              </Surface>
            </View>
          </Reveal>
        ) : (
          <Reveal delay={140}>
            <Surface style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
              <Text variant="titleLarge">Your build list is clear</Text>
              <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Your story and tree prompts are covered for now. Add a new family member or open your profile to keep growing.
              </Text>
              <View style={styles.dashboardActionRow}>
                {currentAssignedPerson ? (
                  <Button mode="contained-tonal" onPress={() => openPersonProfile(currentAssignedPerson)}>
                    Open my profile
                  </Button>
                ) : (
                  <Button mode="contained-tonal" onPress={onOpenAddSelf}>
                    Start my profile
                  </Button>
                )}
                {canEdit ? <Button mode="outlined" onPress={onOpenAddPerson}>Add family member</Button> : null}
                {dismissedTaskIds.length > 0 ? <Button mode="text" onPress={restoreHiddenPrompts}>Restore prompts</Button> : null}
              </View>
            </Surface>
          </Reveal>
        )
      ) : null}

      <Portal>
        <Dialog
          visible={activityModalVisible}
          onDismiss={() => setActivityModalVisible(false)}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface, maxHeight: '88%' }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>Family activities</Dialog.Title>
          <IconButton
            icon="close"
            size={20}
            onPress={() => setActivityModalVisible(false)}
            style={dialogChrome.closeButton}
            accessibilityLabel="Close family activities"
          />
          <Dialog.ScrollArea style={dialogChrome.scrollArea}>
            {activityModalVisible ? (
              <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
                <NotificationsView
                  {...props}
                  embedded
                  navigation={{
                    navigate: (name) => navigation.navigate(name),
                  }}
                />
              </ScrollView>
            ) : null}
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog visible={buildInfoVisible} onDismiss={() => setBuildInfoVisible(false)}>
          <Dialog.Title>{isSetupMode ? 'About setup wizard' : 'About build your family'}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {isSetupMode
                ? 'These steps guide a brand-new tree from first profile to first real family structure.'
                : 'Build your family separates profile work from tree-building so it is easier to grow your own story and the wider tree without mixing them together.'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setBuildInfoVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar
        visible={Boolean(celebrationMessage)}
        onDismiss={() => setCelebrationMessage(null)}
        duration={2600}
        action={{
          label: 'Nice',
          onPress: () => setCelebrationMessage(null),
        }}
      >
        {celebrationMessage}
      </Snackbar>
    </ScrollView>
  );
}
