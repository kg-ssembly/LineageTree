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
import { I18N_KEYS as K } from '../../../../i18n/keys';
import { getActivityNotificationCount } from '../shared';
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

function buildDashboardTasks(
  props: SharedTabProps,
  t: (key: string, params?: Record<string, string | number | null | undefined>) => string,
) {
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
        title: t(K.home.createYourFamilyProfile),
        description: t(K.home.linkYourselfIntoTheTree),
        ctaLabel: t(K.home.startMyProfile),
        category: 'story',
        priority: 'urgent',
        score: 1000,
        done: false,
        action: onOpenAddSelf,
      },
      {
        id: 'add-first-member',
        title: t(K.home.addTheFirstFamilyMember),
        description: t(K.home.startYourTreeWithTheFirstRelative),
        ctaLabel: t(K.home.addFamilyMember),
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
      title: t(K.home.addAProfilePhoto),
      description: t(K.home.aFaceMakesTheTreeFeelInstantlyMoreHumanAndRecognizable),
      ctaLabel: t(K.home.addPortrait),
      category: 'story',
      priority: 'easy-win',
      score: hasBirthDetails ? 270 : 220,
      done: hasPhoto,
      action: profileAction,
    },
    {
      id: 'birth',
      title: t(K.home.fillInBirthDetails),
      description: t(K.home.datesAnchorTheStoryAndHelpPlaceEachGenerationCorrectly),
      ctaLabel: t(K.home.addBirthDetails),
      category: 'story',
      priority: 'urgent',
      score: 420,
      done: hasBirthDetails,
      action: profileAction,
    },
    {
      id: 'story',
      title: t(K.home.writeAStoryNote),
      description: t(K.home.aSmallMemoryOrDescriptionBringsTheProfileToLife),
      ctaLabel: t(K.home.writeNote),
      category: 'story',
      priority: 'recommended',
      score: hasProfilePhoto || hasMemories ? 260 : 180,
      done: hasStoryNote,
      action: profileAction,
    },
    {
      id: 'memory',
      title: t(K.home.recordAMilestone),
      description: t(K.home.addOneLifeEventSoTheTimelineStartsFeelingLikeALivingScrapbook),
      ctaLabel: t(K.home.addMemory),
      category: 'story',
      priority: 'recommended',
      score: hasStoryNote || hasProfilePhoto ? 250 : 190,
      done: hasMemories,
      action: profileAction,
    },
    {
      id: 'relationships',
      title: t(K.home.connectFamilyRelationships),
      description: t(K.home.parentsPartnersAndChildrenAreWhatTurnAProfileIntoABranch),
      ctaLabel: canEdit ? t(K.home.connectFamily) : t(K.home.viewProfile),
      category: 'tree',
      priority: 'urgent',
      score: 390,
      done: hasRelationships,
      action: canEdit ? onOpenRelationshipDialog : profileAction,
    },
    {
      id: 'branch',
      title: t(K.home.addBranchOrClanDetail),
      description: t(K.home.branchAndClanDetailsHelpRelativesRecogniseWhereThisProfileBelongs),
      ctaLabel: t(K.home.addFamilyDetail),
      category: 'story',
      priority: 'easy-win',
      score: hasRelationships ? 230 : 170,
      done: hasBranchIdentity,
      action: profileAction,
    },
    {
      id: 'add-family-member',
      title: otherPeopleCount > 0 ? t(K.home.addAnotherFamilyMember) : t(K.home.addTheFirstFamilyMember),
      description: otherPeopleCount > 0
        ? t(K.home.eachNewRelativeGivesTheTreeMoreShapeAndMakesFamilyConnectionsEasierToDiscover)
        : t(K.home.startBuildingOutwardFromYourOwnPageByAddingTheNextPersonInTheFamily),
      ctaLabel: t(K.home.addFamilyMember),
      category: 'tree',
      priority: 'urgent',
      score: otherPeopleCount > 0 ? 240 : 410,
      done: otherPeopleCount > 0,
      action: onOpenAddPerson,
    },
    {
      id: 'review-matches',
      title: t(K.home.reviewPossibleProfileMatches),
      description: t(K.home.suggestedMatchesCanHelpYouQuicklyLinkTheRightPersonOrSpotLikelyOverlaps),
      ctaLabel: currentSelfAssignmentSuggestions.length > 0 ? t(K.home.reviewMatches) : t(K.home.addMoreRelatives),
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
  const { t } = useI18n();
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

  const { storyTasks, treeTasks } = useMemo(() => buildDashboardTasks(props, t), [
    props.people,
    props.currentAssignedPerson,
    props.currentSelfAssignmentSuggestions,
    props.relationships,
    props.canEdit,
    props.onOpenAddPerson,
    props.onOpenAddSelf,
    props.openPersonProfile,
    props.onOpenRelationshipDialog,
    t,
  ]);
  const tasks = useMemo(() => [...storyTasks, ...treeTasks], [storyTasks, treeTasks]);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<string[]>([]);
  const [promptsHydrated, setPromptsHydrated] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);
  const [lastVisitAt, setLastVisitAt] = useState<string | null>(null);
  const taskMetrics = useMemo(() => {
    const dismissedTaskIdSet = new Set(dismissedTaskIds);
    const completedTasks = tasks.filter((task) => task.done);
    const completedTaskIds = completedTasks.map((task) => task.id).sort();
    const visibleStoryTasks = storyTasks.filter((task) => !task.done && !dismissedTaskIdSet.has(task.id));
    const visibleTreeTasks = treeTasks.filter((task) => !task.done && !dismissedTaskIdSet.has(task.id));
    const visibleRemainingTasks = [...visibleStoryTasks, ...visibleTreeTasks]
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
    const storyCompletedCount = storyTasks.filter((task) => task.done).length;
    const treeCompletedCount = treeTasks.filter((task) => task.done).length;

    return {
      completedTasks,
      completedTaskIds,
      visibleStoryTasks,
      visibleTreeTasks,
      visibleRemainingTasks,
      bestStoryStep: visibleStoryTasks[0] ?? null,
      bestTreeStep: visibleTreeTasks[0] ?? null,
      bestNextStep: visibleRemainingTasks[0] ?? null,
      storyCompletedCount,
      treeCompletedCount,
      storyProgress: storyTasks.length > 0 ? storyCompletedCount / storyTasks.length : 0,
      treeProgress: treeTasks.length > 0 ? treeCompletedCount / treeTasks.length : 0,
    };
  }, [dismissedTaskIds, storyTasks, tasks, treeTasks]);
  const {
    completedTasks,
    completedTaskIds,
    visibleStoryTasks,
    visibleTreeTasks,
    visibleRemainingTasks,
    bestStoryStep,
    bestTreeStep,
    bestNextStep,
    storyCompletedCount,
    treeCompletedCount,
    storyProgress,
    treeProgress,
  } = taskMetrics;
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
        title: t(K.home.createYourProfile),
        description: t(K.home.linkYourselfIntoTheTreePersonally),
        done: hasLinkedProfile,
        action: hasLinkedProfile && currentAssignedPerson ? () => openPersonProfile(currentAssignedPerson) : onOpenAddSelf,
      },
      {
        id: 'setup-member',
        title: t(K.home.addAFamilyMember),
        description: t(K.home.bringInAParentChildPartnerOrAncestorSoTheTreeStartsToBranch),
        done: hasOtherFamilyMember,
        action: onOpenAddPerson,
      },
      {
        id: 'setup-relationship',
        title: t(K.home.connectTheRelationship),
        description: t(K.home.linkPeopleTogetherSoTheTreeBecomesAConnectedFamilyInsteadOfSeparatePages),
        done: hasFirstConnection,
        action: onOpenRelationshipDialog,
      },
      {
        id: 'setup-story',
        title: t(K.home.addOneStoryDetail),
        description: t(K.home.aPhotoDateOrMemoryGivesTheTreeAMoreHumanStartingPoint),
        done: hasStoryStarter,
        action: currentAssignedPerson ? () => openPersonProfile(currentAssignedPerson) : onOpenAddSelf,
      },
    ];
  }, [currentAssignedPerson, onOpenAddPerson, onOpenAddSelf, onOpenRelationshipDialog, openPersonProfile, people, relationships]);
  const setupCompletedCount = setupSteps.filter((step) => step.done).length;
  const setupProgress = setupSteps.length > 0 ? setupCompletedCount / setupSteps.length : 0;
  const nextSetupStep = setupSteps.find((step) => !step.done) ?? null;
  const isSetupMode = !currentAssignedPerson || people.length <= 2 || relationships.length === 0 || setupCompletedCount < setupSteps.length;
  const activityMetrics = useMemo(() => {
    const activityAttentionItems: ActivityAttentionItem[] = [];
    let pendingApprovals = 0;
    let pendingInvites = 0;
    let activeMergeReviews = 0;
    let firstPendingApproval: typeof approvalRequests[number] | null = null;
    let firstPendingMergeReview: typeof mergeRequests[number] | null = null;

    for (const notification of notifications) {
      if (notification.status !== 'pending') {
        continue;
      }

      if (notification.type === 'merge-invite') {
        pendingInvites += 1;
      }

      activityAttentionItems.push({
        id: `notification-${notification.id}`,
        title: t(K.notifications.mergeInvitation),
        description: notification.message,
        createdAt: notification.createdAt,
        actionKey: 'activity-feed',
      });
    }

    for (const request of approvalRequests) {
      if (request.status !== 'pending') {
        continue;
      }

      pendingApprovals += 1;
      if (!firstPendingApproval) {
        firstPendingApproval = request;
      }
      activityAttentionItems.push({
        id: `approval-${request.id}`,
        title: t(K.notifications.approvalRequest),
        description: `${request.title} · ${request.description}`,
        createdAt: request.updatedAt,
        actionKey: 'approvals',
      });
    }

    for (const request of mergeRequests) {
      if (request.status !== 'pending' && request.status !== 'changes-requested') {
        continue;
      }

      activeMergeReviews += 1;
      if (!firstPendingMergeReview) {
        firstPendingMergeReview = request;
      }
      activityAttentionItems.push({
        id: `merge-${request.id}`,
        title: t(K.notifications.mergeActivity),
        description: `${request.preview.sourceTree.treeName} ↔ ${request.preview.targetTree.treeName}`,
        createdAt: request.updatedAt,
        actionKey: 'merge-reviews',
      });
    }

    activityAttentionItems.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      pendingApprovals,
      pendingInvites,
      activeMergeReviews,
      firstPendingApproval,
      firstPendingMergeReview,
      needsAttentionCount: pendingApprovals + pendingInvites + activeMergeReviews,
      activityAttentionItems,
      latestActivityAttentionItem: activityAttentionItems[0] ?? null,
    };
  }, [approvalRequests, mergeRequests, notifications]);
  const {
    pendingApprovals,
    pendingInvites,
    activeMergeReviews,
    firstPendingApproval,
    firstPendingMergeReview,
    needsAttentionCount,
    activityAttentionItems,
    latestActivityAttentionItem,
  } = activityMetrics;
  const approvalsTone = pendingApprovals > 0 ? getUrgencyTone(theme, pendingApprovals > 2 ? 'urgent' : 'attention') : getUrgencyTone(theme, 'calm');
  const invitesTone = pendingInvites > 0 ? getUrgencyTone(theme, 'attention') : getUrgencyTone(theme, 'calm');
  const mergeTone = activeMergeReviews > 0 ? getUrgencyTone(theme, activeMergeReviews > 1 ? 'urgent' : 'attention') : getUrgencyTone(theme, 'calm');
  const activityNotificationCount = useMemo(() => {
    return getActivityNotificationCount({
      approvalRequests,
      mergeRequests,
      mergeHistory,
      notifications,
      notificationActivityStates,
      trees,
      userId,
    });
  }, [approvalRequests, mergeHistory, mergeRequests, notificationActivityStates, notifications, trees, userId]);
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
        setCelebrationMessage(t(K.home.taskCompleted, { title: completedTask.title }));
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
      { key: 'overview', label: t(K.home.overview) },
      { key: 'highlights', label: t(K.home.highlights) },
      { key: 'activity', label: activityNotificationCount > 0 ? t(K.home.activityCount, { count: activityNotificationCount }) : t(K.home.activity) },
      { key: 'build', label: t(K.home.build) },
    ],
    [activityNotificationCount, t],
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
          buttonLabel: t(K.home.openActivities),
        };
      }
      return {
        label: t(K.home.viewFamilyActivity),
        description: t(K.home.everythingIsCalmRightNowButYouCanStillOpenTheActivityAreas),
        action: openFamilyActivity,
        buttonLabel: t(K.home.openActivities),
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
        label: canEdit ? t(K.home.addFamilyMember) : t(K.home.openStories),
        description: canEdit
          ? t(K.home.growTheTreeByAddingANewPersonMemoryOrBranchConnection)
          : t(K.home.exploreTheLatestStoriesAndPeopleInYourFamilySpace),
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
      label: currentAssignedPerson ? t(K.home.openMyProfile) : t(K.home.startMyProfile),
      description: t(K.home.yourEssentialsAreInPlaceOpenTheStoryPageAndKeepBuildingFromThere),
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
    ? t(K.home.startWithTheSetupStepsBelowOnceTheBasicsAreInPlaceThisHomeScreenOpensUpIntoTheFullFamilyDashboard)
    : dashboardLens === 'activity'
      ? t(K.home.reviewWhatChangedWhatIsWaitingAndWhereSharedWorkNeedsADecision)
      : dashboardLens === 'growth'
        ? t(K.home.focusOnAddingPeopleStrengtheningBranchesAndGrowingTheFamilyStory)
        : currentAssignedPerson
          ? t(K.home.hereIsTheBestNextStepToMakeYourProfileFeelFullerAndYourBranchMoreConnected)
          : t(K.home.startByLinkingYourselfIntoTheTreeThenTheAppCanGuideYouThroughTheStepsThatAlreadyExistHere);

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
      items.push({ id: 'people', label: t(K.home.newFamilyMembersCount, { count: newPeopleCount }), onPress: () => focusSection('family-highlights') });
    }
    if (updatedRelationshipCount > 0) {
      items.push({ id: 'relationships', label: t(K.home.newConnectionsCount, { count: updatedRelationshipCount }), onPress: () => navigation.navigate('members' satisfies keyof MainTabParamList) });
    }
    if (pendingApprovalCount > 0) {
      items.push({ id: 'approvals', label: t(K.home.approvalsWaitingCount, { count: pendingApprovalCount }), onPress: openApprovals });
    }
    if (newInviteCount > 0) {
      items.push({ id: 'invites', label: t(K.home.newMergeInvitesCount, { count: newInviteCount }), onPress: openMergeInvites });
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
                {currentAssignedPerson ? t(K.home.welcomeBackName, { name: currentAssignedPerson.firstName }) : t(K.home.welcomeToYourFamilyHome)}
              </Text>
            </View>
            <Chip icon="home-heart">{selectedTree.name}</Chip>
          </View>

          {isSetupMode ? (
            <View style={{ marginTop: 18 }}>
              <View style={[styles.dashboardMetricRow, { marginBottom: 10 }]}>
                <Text variant="titleMedium">{t(K.home.completeYourTree)}</Text>
                <Text variant="titleMedium">{Math.round(setupProgress * 100)}%</Text>
              </View>
              <ProgressBar progress={setupProgress} color={theme.colors.primary} style={{ height: 10, borderRadius: 999 }} />
                <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
                  {t(K.home.guidedSetupStepsFinishedCount, { completed: setupCompletedCount, total: setupSteps.length })}
                </Text>
            </View>
          ) : (
            <View style={[styles.dashboardMetricRow, { marginTop: 18 }]}>
              <View style={{ flex: 1, minWidth: 220 }}>
                <View style={[styles.dashboardMetricRow, { marginBottom: 10 }]}>
                  <Text variant="titleMedium">{t(K.home.completeYourStory)}</Text>
                  <Text variant="titleMedium">{Math.round(storyProgress * 100)}%</Text>
                </View>
                <ProgressBar progress={storyProgress} color={theme.colors.primary} style={{ height: 10, borderRadius: 999 }} />
                <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
                  {t(K.home.profileStepsFinishedCount, { completed: storyCompletedCount, total: storyTasks.length })}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: 220 }}>
                <View style={[styles.dashboardMetricRow, { marginBottom: 10 }]}>
                  <Text variant="titleMedium">{t(K.home.completeYourTree)}</Text>
                  <Text variant="titleMedium">{Math.round(treeProgress * 100)}%</Text>
                </View>
                <ProgressBar progress={treeProgress} color={theme.colors.secondary} style={{ height: 10, borderRadius: 999 }} />
                <Text variant="bodySmall" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
                  {t(K.home.treeBuildingStepsFinishedCount, { completed: treeCompletedCount, total: treeTasks.length })}
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
                          {step.done ? t(K.common.done) : t(K.common.next)}
                        </Chip>
                        <Text variant="titleMedium" style={{ marginTop: 8 }}>{step.title}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                          {step.description}
                        </Text>
                      </View>
                      <Button mode={step.done ? 'text' : 'contained-tonal'} onPress={step.action}>
                        {step.done ? t(K.common.open) : t(K.home.doThis)}
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
                  ? t(K.home.setupWizard)
                  : dashboardLens === 'activity'
                    ? t(K.home.whatNeedsReview)
                    : dashboardLens === 'growth'
                      ? t(K.home.growTheTree)
                      : t(K.home.bestNextStep)}
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
                  {isSetupMode ? t(K.home.continueSetup) : heroAction.buttonLabel ?? heroAction.label}
                </Button>
                {!isSetupMode && dashboardLens === 'focus' ? (
                  <Button mode="text" onPress={() => dismissTask((bestStoryStep ?? bestNextStep).id)} style={styles.dashboardInlineAction}>
                    {t(K.home.hideForNow)}
                  </Button>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={[styles.dashboardAccentCard, { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant }]}>
              <Chip compact icon="check-decagram">{dismissedTaskIds.length > 0 ? t(K.home.promptsClearedForNow) : t(K.home.profileLookingStrong)}</Chip>
              <Text variant="titleMedium" style={{ marginTop: 10 }}>{t(K.home.yourEssentialsAreInPlace)}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                {dismissedTaskIds.length > 0
                  ? t(K.home.youHaveClearedTheCurrentPromptsBringThemBackWheneverYouWantAnotherNudge)
                  : t(K.home.keepTheStoryGrowingByAddingMoreMemoriesPhotosAndRelativesAroundYourBranch)}
              </Text>
              <View style={styles.dashboardActionRow}>
                <Button mode="contained-tonal" onPress={currentAssignedPerson ? () => openPersonProfile(currentAssignedPerson) : onOpenAddSelf}>
                  {currentAssignedPerson ? t(K.home.openMyProfile) : t(K.home.startMyProfile)}
                </Button>
                {canEdit ? <Button mode="outlined" onPress={onOpenAddPerson}>{t(K.home.addFamilyMember)}</Button> : null}
                {dismissedTaskIds.length > 0 ? <Button mode="text" onPress={restoreHiddenPrompts}>{t(K.home.restorePrompts)}</Button> : null}
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
                  <Text variant="labelLarge">{t(K.home.familyMembersMetric)}</Text>
                  <Text variant="headlineSmall">{people.length}</Text>
                </Card.Content>
              </Card>
              <Card mode="elevated" style={[styles.dashboardMetricCard, { backgroundColor: theme.colors.surface }]}>
                <Card.Content>
                  <Text variant="labelLarge">{t(K.home.newMatchesMetric)}</Text>
                  <Text variant="headlineSmall">{currentSelfAssignmentSuggestions.length}</Text>
                </Card.Content>
              </Card>
              <Card mode="elevated" style={[styles.dashboardMetricCard, { backgroundColor: theme.colors.surface }]}>
                <Card.Content>
                  <Text variant="labelLarge">{t(K.home.openTasksMetric)}</Text>
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
                <Text variant="titleLarge">{t(K.home.sinceYourLastVisit)}</Text>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {t(K.home.aQuickDigestOfWhatChangedWhileYouWereAway)}
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
                <Text variant="titleLarge">{t(K.notifications.needsAttention)}</Text>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {t(K.home.sharedActivityThatCouldUseALookBeforeItSlipsOutOfView)}
                </Text>
                <View style={[styles.dashboardActionRow, { marginTop: 14 }]}>
                  {pendingApprovals > 0 ? (
                    <Chip
                      icon="clipboard-check-outline"
                      onPress={openApprovals}
                      style={{ backgroundColor: approvalsTone.backgroundColor, borderColor: approvalsTone.borderColor, borderWidth: 1 }}
                      textStyle={{ color: approvalsTone.textColor }}
                    >
                      {t(K.home.approvalsWaitingCount, { count: pendingApprovals })}
                    </Chip>
                  ) : null}
                  {pendingInvites > 0 ? (
                    <Chip
                      icon="source-merge"
                      onPress={openMergeInvites}
                      style={{ backgroundColor: invitesTone.backgroundColor, borderColor: invitesTone.borderColor, borderWidth: 1 }}
                      textStyle={{ color: invitesTone.textColor }}
                    >
                      {t(K.home.mergeInvitesWaitingCount, { count: pendingInvites })}
                    </Chip>
                  ) : null}
                  {activeMergeReviews > 0 ? (
                    <Chip
                      icon="timeline-clock-outline"
                      onPress={openMergeReviews}
                      style={{ backgroundColor: mergeTone.backgroundColor, borderColor: mergeTone.borderColor, borderWidth: 1 }}
                      textStyle={{ color: mergeTone.textColor }}
                    >
                      {t(K.home.mergeReviewsWaitingCount, { count: activeMergeReviews })}
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
                      <Text variant="titleLarge">{isSetupMode ? t(K.home.setupWizard) : t(K.home.buildYourFamily)}</Text>
                      <IconButton
                        icon="information-outline"
                        size={18}
                        style={{ margin: 0 }}
                        onPress={() => setBuildInfoVisible(true)}
                        accessibilityLabel={t(K.home.aboutBuildYourFamily)}
                      />
                    </View>
                  </View>
                  <IconButton
                    icon={deeperExpanded ? 'chevron-up' : 'chevron-down'}
                    onPress={() => setDeeperExpanded((current) => !current)}
                    accessibilityLabel={deeperExpanded ? t(K.home.collapseBuildYourFamily) : t(K.home.expandBuildYourFamily)}
                  />
                </View>

                {deeperExpanded ? (
                <View style={{ marginTop: 14, gap: 18 }}>
                  {visibleStoryTasks.length > 0 ? (
                    <View>
                      <Text variant="titleMedium">{t(K.home.completeYourStory)}</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                        {t(K.home.theseStepsShapeYourOwnPageIntoAFullerBiography)}
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
                                      {t(K.home.hide)}
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
                      <Text variant="titleMedium">{t(K.home.completeYourTree)}</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                        {t(K.home.theseStepsGrowTheFamilyBeyondOnePersonAndStrengthenTheBranchStructure)}
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
                                      {t(K.home.hide)}
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
              <Text variant="titleLarge">{t(K.home.yourBuildListIsClear)}</Text>
              <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                {t(K.home.yourStoryAndTreePromptsAreCoveredForNowAddANewFamilyMemberOrOpenYourProfileToKeepGrowing)}
              </Text>
              <View style={styles.dashboardActionRow}>
                {currentAssignedPerson ? (
                  <Button mode="contained-tonal" onPress={() => openPersonProfile(currentAssignedPerson)}>
                    {t(K.home.openMyProfile)}
                  </Button>
                ) : (
                  <Button mode="contained-tonal" onPress={onOpenAddSelf}>
                    {t(K.home.startMyProfile)}
                  </Button>
                )}
                {canEdit ? <Button mode="outlined" onPress={onOpenAddPerson}>{t(K.home.addFamilyMember)}</Button> : null}
                {dismissedTaskIds.length > 0 ? <Button mode="text" onPress={restoreHiddenPrompts}>{t(K.home.restorePrompts)}</Button> : null}
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
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(K.home.familyActivities)}</Dialog.Title>
          <IconButton
            icon="close"
            size={20}
            onPress={() => setActivityModalVisible(false)}
            style={dialogChrome.closeButton}
            accessibilityLabel={t(K.home.closeFamilyActivities)}
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
          <Dialog.Title>{isSetupMode ? t(K.home.aboutSetupWizard) : t(K.home.aboutBuildYourFamily)}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {isSetupMode
                ? t(K.home.theseStepsGuideABrandNewTreeFromFirstProfileToFirstRealFamilyStructure)
                : t(K.home.buildYourFamilySeparatesProfileWorkFromTreeBuildingSoItIsEasierToGrowYourOwnStoryAndTheWiderTreeWithoutMixingThemTogether)}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setBuildInfoVisible(false)}>{t(K.common.close)}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar
        visible={Boolean(celebrationMessage)}
        onDismiss={() => setCelebrationMessage(null)}
        duration={2600}
        action={{
          label: t(K.home.nice),
          onPress: () => setCelebrationMessage(null),
        }}
      >
        {celebrationMessage}
      </Snackbar>
    </ScrollView>
  );
}
