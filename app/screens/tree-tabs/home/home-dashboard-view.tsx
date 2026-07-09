import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ActivityIndicator, Button, Chip, Dialog, IconButton, Portal, Text, useTheme } from 'react-native-paper';
import { BUTTON_CHROME, BUTTON_CONTENT_CHROME, FloatingSnackbar, GlobalStyles, HorizontalTabStrip, InfoDialog, Reveal, ScreenBackground, SectionCard, SuggestionList, TabStripCard, type SuggestionActionTarget } from '../../../../components';
import type { MainTabParamList } from '../../../../components/dto/navigation';
import { getThemeChrome } from '../../../../constants/styles';
import type { AppTheme } from '../../../../constants/theme';
import { useI18n } from '../../../../hooks/use-i18n';
import { I18N_KEYS as K } from '../../../../i18n/keys';
import { formatPersonName } from '../../../../components/person-formatting';
import { getActivityNotificationCount } from '../shared';
import type { SharedTabProps } from '../shared';
import { FamilyHighlightsPanel } from '../tree-settings/family-highlights-panel';
import { NotificationsView } from '../notifications/notifications-view';
import { buildMissingDetailSuggestionForPerson, buildTreeSuggestions } from '../../profile-shared/suggestions';

const styles = GlobalStyles.treeDetail;
const profileStyles = GlobalStyles.personProfile;
const dialogChrome = GlobalStyles.dialogChrome;
const DASHBOARD_PROMPTS_STORAGE_KEY = 'lineagetree-dashboard-hidden-prompts';
const DASHBOARD_LAST_VISIT_STORAGE_KEY = 'lineagetree-dashboard-last-visit';

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
  taskId?: string;
};

type HeroAttentionCallout = {
  title: string;
  description: string;
  action: () => void;
  buttonLabel: string;
};

type DashboardBundle = {
  id: 'story' | 'tree';
  title: string;
  description: string;
  actionLabel: string;
  remainingCount: number;
  action: () => void;
};

type MissingMemberDetail = {
  personId: string;
  name: string;
  summary: string;
  score: number;
  action: () => void;
};

type OverviewPriorityItem = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  action: () => void;
  tone: 'default' | 'attention';
};

type TreeProgressChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

const localStyles = StyleSheet.create({
  strengthCard: {
    marginTop: 4,
    borderRadius: 24,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  strengthTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
  },
  strengthCopy: {
    flex: 1,
    minWidth: 220,
  },
  strengthMetricWrap: {
    minWidth: 74,
    alignItems: 'flex-end',
  },
  strengthProgressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 14,
  },
  strengthProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  strengthChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  strengthStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  strengthStatCard: {
    minWidth: 110,
    flexGrow: 1,
    flexBasis: 110,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  strengthSummaryCard: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  checklistWrap: {
    marginTop: 14,
    gap: 8,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checklistCopy: {
    flex: 1,
  },
  actionPanel: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  actionPanelBody: {
    marginTop: 10,
    gap: 10,
  },
  actionItem: {
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  actionItemCopy: {
    flex: 1,
  },
});

type DashboardSuggestionActionContext = Pick<
  SharedTabProps,
  'people' | 'onEditPerson' | 'openPersonProfile' | 'onOpenAddPersonForRelationship' | 'onOpenAddPerson' | 'onOpenAddSelf' | 'onOpenRelationshipDialog'
>;

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

type DashboardCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor: string;
  borderColor: string;
};

function DashboardTaskCard({ children, style, backgroundColor, borderColor }: DashboardCardProps) {
  return (
    <SectionCard
      nested
      elevation={0}
      backgroundColor={backgroundColor}
      style={[styles.dashboardTaskCard, { borderColor }, style]}
    >
      {children}
    </SectionCard>
  );
}

function DashboardMetricCard({ children, style, backgroundColor, borderColor }: DashboardCardProps) {
  return (
    <SectionCard
      nested
      elevation={0}
      backgroundColor={backgroundColor}
      style={[styles.dashboardMetricCard, { borderColor }, style]}
    >
      {children}
    </SectionCard>
  );
}

function resolveDashboardSuggestionAction(
  target: SuggestionActionTarget,
  context: DashboardSuggestionActionContext,
) {
  switch (target.kind) {
    case 'edit-profile': {
      const person = context.people.find((entry) => entry.id === target.personId);
      return person ? () => context.onEditPerson(person) : () => undefined;
    }
    case 'open-profile': {
      const person = context.people.find((entry) => entry.id === target.personId);
      return person
        ? () => context.openPersonProfile(person, {
          initialTab: target.initialTab,
          initialMemorySectionTab: target.initialMemorySectionTab,
        })
        : () => undefined;
    }
    case 'add-relationship': {
      const person = context.people.find((entry) => entry.id === target.personId);
      return person ? () => context.openPersonProfile(person, { initialTab: 'relationships' }) : () => undefined;
    }
    case 'add-relative': {
      const person = context.people.find((entry) => entry.id === target.personId);
      return person ? () => context.onOpenAddPersonForRelationship(target.mode, person) : () => undefined;
    }
    case 'add-person':
      return context.onOpenAddPerson;
    case 'add-self':
      return context.onOpenAddSelf;
    default:
      return context.onOpenRelationshipDialog;
  }
}

function buildDashboardTasks(
  taskInputs: Pick<SharedTabProps, 'people' | 'currentAssignedPerson' | 'currentSelfAssignmentSuggestions' | 'relationships' | 'canEdit'>,
  suggestionActionContext: DashboardSuggestionActionContext,
  showFollowUpTreePrompts: boolean,
  t: (key: string, params?: Record<string, string | number | null | undefined>) => string,
) {
  const { storySuggestions, treeSuggestions } = buildTreeSuggestions({
    people: taskInputs.people,
    currentAssignedPerson: taskInputs.currentAssignedPerson,
    currentSelfAssignmentSuggestionsCount: taskInputs.currentSelfAssignmentSuggestions.length,
    relationships: taskInputs.relationships,
    canEdit: taskInputs.canEdit,
    showFollowUpTreePrompts,
  }, t);

  return {
    storyTasks: storySuggestions.map((suggestion) => ({
      ...suggestion,
      dashboardSection: 'story',
      done: suggestion.done ?? false,
      score: suggestion.score ?? 0,
      action: resolveDashboardSuggestionAction(suggestion.actionTarget, suggestionActionContext),
    })),
    treeTasks: treeSuggestions.map((suggestion) => ({
      ...suggestion,
      dashboardSection: 'tree',
      done: suggestion.done ?? false,
      score: suggestion.score ?? 0,
      action: resolveDashboardSuggestionAction(suggestion.actionTarget, suggestionActionContext),
    })),
  };
}

export function HomeDashboardView(props: SharedTabProps) {
  const isFocused = useIsFocused();
  const theme = useTheme();
  const chrome = getThemeChrome(theme);
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
    followUpTreePromptsPending,
    onOpenAddPerson,
    onOpenAddPersonForRelationship,
    onOpenAddSelf,
    onOpenRelationshipDialog,
    onEditPerson,
    openPersonProfile,
    canEdit,
    onOpenTreeSettingsTarget,
    onConsumeFollowUpTreePrompts,
  } = props;
  const spotlightTextColor = theme.colors.onPrimaryContainer;
  const spotlightSubtextColor = theme.dark ? theme.colors.onPrimaryContainer : '#345447';
  const [showFollowUpTreePrompts, setShowFollowUpTreePrompts] = useState(false);
  const suggestionActionContext = useMemo<DashboardSuggestionActionContext>(() => ({
    people,
    onEditPerson,
    openPersonProfile,
    onOpenAddPersonForRelationship,
    onOpenAddPerson,
    onOpenAddSelf,
    onOpenRelationshipDialog,
  }), [onEditPerson, onOpenAddPerson, onOpenAddPersonForRelationship, onOpenAddSelf, onOpenRelationshipDialog, openPersonProfile, people]);
  const dashboardTaskInputs = useMemo(() => ({
    people,
    currentAssignedPerson,
    currentSelfAssignmentSuggestions: props.currentSelfAssignmentSuggestions,
    relationships,
    canEdit,
  }), [canEdit, currentAssignedPerson, people, props.currentSelfAssignmentSuggestions, relationships]);

  useEffect(() => {
    if (!isFocused) {
      setShowFollowUpTreePrompts(false);
      return;
    }

    if (!followUpTreePromptsPending) {
      return;
    }

    setShowFollowUpTreePrompts(true);
    onConsumeFollowUpTreePrompts();
  }, [followUpTreePromptsPending, isFocused, onConsumeFollowUpTreePrompts]);

  const { storyTasks, treeTasks } = useMemo(
    () => buildDashboardTasks(dashboardTaskInputs, suggestionActionContext, showFollowUpTreePrompts, t),
    [dashboardTaskInputs, showFollowUpTreePrompts, suggestionActionContext, t],
  );
  const tasks = useMemo(() => [...storyTasks, ...treeTasks], [storyTasks, treeTasks]);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<string[]>([]);
  const [promptsHydrated, setPromptsHydrated] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);
  const [lastVisitAt, setLastVisitAt] = useState<string | null>(null);
  const taskMetrics = useMemo(() => {
    const dismissedTaskIdSet = new Set(dismissedTaskIds);
    const visibleStoryTasks = storyTasks.filter((task) => !task.done && !dismissedTaskIdSet.has(task.id));
    const visibleTreeTasks = treeTasks.filter((task) => !task.done && !dismissedTaskIdSet.has(task.id));

    return {
      visibleStoryTasks,
      visibleTreeTasks,
      bestStoryStep: visibleStoryTasks[0] ?? null,
      bestTreeStep: visibleTreeTasks[0] ?? null,
      bestNextStep: [...visibleStoryTasks, ...visibleTreeTasks]
        .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.title.localeCompare(right.title))[0] ?? null,
    };
  }, [dismissedTaskIds, storyTasks, treeTasks]);
  const {
    visibleStoryTasks,
    visibleTreeTasks,
    bestStoryStep,
    bestTreeStep,
    bestNextStep,
  } = taskMetrics;
  const pendingBuildTaskCount = visibleStoryTasks.length + visibleTreeTasks.length;
  const setupSteps = useMemo<SetupStep[]>(() => {
    const hasLinkedProfile = Boolean(currentAssignedPerson);
    const hasMinimumMembers = people.length >= 2;
    const hasFirstConnection = relationships.length > 0;
    const firstMissingBirthdatePerson = people.find((person) => !person.birthDate?.trim()) ?? null;

    const steps: SetupStep[] = [];

    if (showFollowUpTreePrompts) {
      if (!hasLinkedProfile || hasMinimumMembers) {
        steps.push({
          id: 'setup-profile',
          title: t(K.home.createYourProfile),
          description: t(K.home.linkYourselfIntoTheTreePersonally),
          done: hasLinkedProfile,
          action: hasLinkedProfile && currentAssignedPerson ? () => openPersonProfile(currentAssignedPerson) : onOpenAddSelf,
        });
      }

      if (hasMinimumMembers) {
        steps.push({
          id: 'setup-relationship',
          title: t(K.home.connectTheRelationship),
          description: t(K.home.linkPeopleTogetherSoTheTreeBecomesAConnectedFamilyInsteadOfSeparatePages),
          done: hasFirstConnection,
          action: onOpenRelationshipDialog,
        });
      }

      if (firstMissingBirthdatePerson) {
        steps.push({
          id: 'setup-birthdate',
          title: t(K.home.fillInBirthDetails),
          description: t(K.home.datesAnchorTheStoryAndHelpPlaceEachGenerationCorrectly),
          done: false,
          action: () => onEditPerson(firstMissingBirthdatePerson),
        });
      }
    }

    return steps;
  }, [currentAssignedPerson, onEditPerson, onOpenAddSelf, onOpenRelationshipDialog, openPersonProfile, people, relationships, showFollowUpTreePrompts, t]);
  const setupCompletedCount = setupSteps.filter((step) => step.done).length;
  const nextSetupStep = setupSteps.find((step) => !step.done) ?? null;
  const nextSetupStepIndex = setupSteps.findIndex((step) => !step.done);
  const isSetupMode = !currentAssignedPerson || (showFollowUpTreePrompts && (people.length <= 2 || relationships.length === 0 || setupCompletedCount < setupSteps.length));
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
      latestActivityAttentionItem: activityAttentionItems[0] ?? null,
    };
  }, [approvalRequests, mergeRequests, notifications, t]);
  const {
    pendingApprovals,
    pendingInvites,
    activeMergeReviews,
    firstPendingApproval,
    firstPendingMergeReview,
    needsAttentionCount,
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
  const [overviewActionsExpanded, setOverviewActionsExpanded] = useState(false);
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [buildInfoVisible, setBuildInfoVisible] = useState(false);
  const [heroInfoVisible, setHeroInfoVisible] = useState(false);
  const [progressIncludesExpanded, setProgressIncludesExpanded] = useState(false);
  const [progressIncludesDialogExpanded, setProgressIncludesDialogExpanded] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<DashboardTabKey>(needsAttentionCount > 0 ? 'activity' : 'overview');
  const hasUserSelectedDashboardTabRef = useRef(false);
  const previousFocusRef = useRef(isFocused);
  const previousNeedsAttentionCountRef = useRef(needsAttentionCount);
  const promptStorageId = `${selectedTree.id}:${currentAssignedPerson?.id ?? 'unlinked'}`;
  const dashboardVisitStorageId = `${selectedTree.id}:${currentAssignedPerson?.id ?? 'unlinked'}`;
  const isEmptyTree = people.length === 0;
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionOffsetsRef = useRef<Record<DashboardSectionKey, number>>({
    'since-last-visit': 0,
    'keep-building': 0,
    'family-highlights': 0,
  });
  const previousTaskDoneByIdRef = useRef<Map<string, boolean> | null>(null);

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

  const persistDashboardVisit = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(DASHBOARD_LAST_VISIT_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) as Record<string, string> : {};
      const nextVisitAt = new Date().toISOString();
      await AsyncStorage.setItem(DASHBOARD_LAST_VISIT_STORAGE_KEY, JSON.stringify({
        ...parsed,
        [dashboardVisitStorageId]: nextVisitAt,
      }));
      setLastVisitAt(nextVisitAt);
    } catch {
      // Ignore storage failures so the dashboard still works in-memory.
    }
  }, [dashboardVisitStorageId]);

  useEffect(() => {
    if (previousFocusRef.current && !isFocused) {
      void persistDashboardVisit();
    }

    previousFocusRef.current = isFocused;
  }, [isFocused, persistDashboardVisit]);

  useEffect(() => () => {
    if (previousFocusRef.current) {
      void persistDashboardVisit();
    }
  }, [persistDashboardVisit]);

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
    setCelebrationMessage(null);
    previousTaskDoneByIdRef.current = null;
  }, [promptStorageId, showFollowUpTreePrompts]);

  useEffect(() => {
    if (dashboardTab === 'build' && (isSetupMode || pendingBuildTaskCount > 0)) {
      setDeeperExpanded(true);
    }
  }, [dashboardTab, isSetupMode, pendingBuildTaskCount]);

  useEffect(() => {
    const previousNeedsAttentionCount = previousNeedsAttentionCountRef.current;
    previousNeedsAttentionCountRef.current = needsAttentionCount;

    if (loadingTreeData) {
      return;
    }

    if (previousNeedsAttentionCount === 0 && needsAttentionCount > 0 && dashboardTab !== 'activity') {
      setDashboardTab('activity');
      return;
    }

    if (hasUserSelectedDashboardTabRef.current) {
      return;
    }

    setDashboardTab(needsAttentionCount > 0 ? 'activity' : 'overview');
  }, [dashboardTab, loadingTreeData, needsAttentionCount]);

  useEffect(() => {
    if (!showFollowUpTreePrompts) {
      previousTaskDoneByIdRef.current = null;
      return;
    }

    if (!promptsHydrated) {
      return;
    }

    if (!previousTaskDoneByIdRef.current) {
      previousTaskDoneByIdRef.current = new Map(tasks.map((task) => [task.id, task.done]));
      return;
    }

    const previousTaskDoneById = previousTaskDoneByIdRef.current;
    const newlyCompletedTask = tasks.find((task) => previousTaskDoneById.get(task.id) === false && task.done);
    previousTaskDoneByIdRef.current = new Map(tasks.map((task) => [task.id, task.done]));

    if (!newlyCompletedTask) {
      return;
    }

    setCelebrationMessage(t(K.home.taskCompleted, { title: newlyCompletedTask.title }));
  }, [promptsHydrated, showFollowUpTreePrompts, tasks, t]);

  const dismissTask = useCallback((taskId: string) => {
    setDismissedTaskIds((current) => (current.includes(taskId) ? current : [...current, taskId]));
  }, []);

  const restoreHiddenPrompts = useCallback(() => {
    setDismissedTaskIds([]);
  }, []);

  const registerSectionOffset = useCallback((key: DashboardSectionKey) => (event: LayoutChangeEvent) => {
    sectionOffsetsRef.current[key] = event.nativeEvent.layout.y;
  }, []);

  const scrollToSection = useCallback((key: DashboardSectionKey) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, sectionOffsetsRef.current[key] - 12),
        animated: true,
      });
    });
  }, []);

  const focusSection = useCallback((key: DashboardSectionKey) => {
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
  }, [scrollToSection]);

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

  const openFamilyActivity = useCallback(() => {
    setDashboardTab('activity');
    setActivityModalVisible(true);
  }, []);

  const openApprovals = useCallback(() => {
    if (firstPendingApproval && onOpenTreeSettingsTarget) {
      onOpenTreeSettingsTarget({ tab: 'approvals', itemId: firstPendingApproval.id, mode: 'approval' });
      navigation.navigate('treeSettings' satisfies keyof MainTabParamList);
      return;
    }

    navigation.navigate('treeSettings' satisfies keyof MainTabParamList);
  }, [firstPendingApproval, navigation, onOpenTreeSettingsTarget]);

  const openMergeReviews = useCallback(() => {
    if (firstPendingMergeReview && onOpenTreeSettingsTarget) {
      onOpenTreeSettingsTarget({ tab: 'merges', itemId: firstPendingMergeReview.id, mode: 'merge' });
      navigation.navigate('treeSettings' satisfies keyof MainTabParamList);
      return;
    }

    navigation.navigate('treeSettings' satisfies keyof MainTabParamList);
  }, [firstPendingMergeReview, navigation, onOpenTreeSettingsTarget]);

  const openMergeInvites = useCallback(() => {
    openFamilyActivity();
  }, [openFamilyActivity]);

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
          buttonLabel: t(K.home.activity),
        };
      }
      return {
        label: t(K.home.viewFamilyActivity),
        description: t(K.home.everythingIsCalmRightNowButYouCanStillOpenTheActivityAreas),
        action: openFamilyActivity,
        buttonLabel: t(K.home.activity),
      };
    }

    if (dashboardLens === 'growth') {
      if (bestTreeStep) {
        return {
          label: bestTreeStep.ctaLabel,
          description: bestTreeStep.description,
          action: bestTreeStep.action,
          taskId: bestTreeStep.id,
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
        taskId: nextSetupStep.id,
      };
    }

    if (bestNextStep) {
      return {
        label: bestNextStep.ctaLabel,
        description: bestNextStep.description,
        action: bestNextStep.action,
        taskId: bestNextStep.id,
      };
    }

    if (bestStoryStep) {
      return {
        label: bestStoryStep.ctaLabel,
        description: bestStoryStep.description,
        action: bestStoryStep.action,
        taskId: bestStoryStep.id,
      };
    }

    return {
      label: currentAssignedPerson ? t(K.home.openMyProfile) : t(K.home.startMyProfile),
      description: t(K.home.yourEssentialsAreInPlaceOpenTheStoryPageAndKeepBuildingFromThere),
      action: currentAssignedPerson ? () => openPersonProfile(currentAssignedPerson) : onOpenAddSelf,
    };
  }, [
    bestNextStep,
    bestStoryStep,
    bestTreeStep,
    canEdit,
    currentAssignedPerson,
    dashboardLens,
    focusSection,
    isSetupMode,
    latestActivityAttentionItem,
    nextSetupStep,
    onOpenAddPerson,
    onOpenAddSelf,
    openFamilyActivity,
    openApprovals,
    openMergeReviews,
    openPersonProfile,
    t,
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

  const heroAttentionCallout = useMemo<HeroAttentionCallout | null>(() => {
    if (pendingApprovals > 0) {
      return {
        title: t(K.home.approvalsWaitingCount, { count: pendingApprovals }),
        description: firstPendingApproval
          ? `${firstPendingApproval.title} · ${firstPendingApproval.description}`
          : t(K.home.sharedActivityThatCouldUseALookBeforeItSlipsOutOfView),
        action: openApprovals,
        buttonLabel: t(K.home.whatNeedsReview),
      };
    }

    if (pendingInvites > 0) {
      return {
        title: t(K.home.mergeInvitesWaitingCount, { count: pendingInvites }),
        description: latestActivityAttentionItem?.description ?? t(K.home.sharedActivityThatCouldUseALookBeforeItSlipsOutOfView),
        action: openMergeInvites,
        buttonLabel: t(K.home.activity),
      };
    }

    if (activeMergeReviews > 0) {
      return {
        title: t(K.home.mergeReviewsWaitingCount, { count: activeMergeReviews }),
        description: firstPendingMergeReview
          ? `${firstPendingMergeReview.preview.sourceTree.treeName} ↔ ${firstPendingMergeReview.preview.targetTree.treeName}`
          : t(K.home.sharedActivityThatCouldUseALookBeforeItSlipsOutOfView),
        action: openMergeReviews,
        buttonLabel: t(K.home.whatNeedsReview),
      };
    }

    return null;
  }, [
    activeMergeReviews,
    firstPendingApproval,
    firstPendingMergeReview,
    latestActivityAttentionItem,
    openApprovals,
    openMergeInvites,
    openMergeReviews,
    pendingApprovals,
    pendingInvites,
    t,
  ]);

  const heroTitle = isSetupMode
    ? nextSetupStep?.title ?? heroAction.label
    : dashboardLens === 'focus'
      ? bestNextStep?.title ?? bestStoryStep?.title ?? heroAction.label
      : heroAction.label;

  const dashboardBundles = useMemo<DashboardBundle[]>(() => {
    const bundles: DashboardBundle[] = [];

    if (visibleStoryTasks.length > 0 && bestStoryStep) {
      bundles.push({
        id: 'story',
        title: t(K.home.completeYourStory),
        description: t(K.home.theseStepsShapeYourOwnPageIntoAFullerBiography),
        actionLabel: t(K.home.continueProfile),
        remainingCount: visibleStoryTasks.length,
        action: bestStoryStep.action,
      });
    }

    if (visibleTreeTasks.length > 0 && bestTreeStep) {
      bundles.push({
        id: 'tree',
        title: t(K.home.completeYourTree),
        description: t(K.home.theseStepsGrowTheFamilyBeyondOnePersonAndStrengthenTheBranchStructure),
        actionLabel: t(K.home.continueTree),
        remainingCount: visibleTreeTasks.length,
        action: bestTreeStep.action,
      });
    }

    return bundles;
  }, [bestStoryStep, bestTreeStep, t, visibleStoryTasks.length, visibleTreeTasks.length]);

  const missingMemberDetails = useMemo<MissingMemberDetail[]>(() => {
    return people
      .map((person) => {
        const suggestion = buildMissingDetailSuggestionForPerson(person, relationships, t);
        if (!suggestion) {
          return null;
        }

        return {
          personId: person.id,
          name: formatPersonName(person),
          summary: suggestion.description,
          score: suggestion.score ?? 0,
          action: resolveDashboardSuggestionAction(suggestion.actionTarget, suggestionActionContext),
        };
      })
      .filter((item): item is MissingMemberDetail => Boolean(item))
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
      .slice(0, 3);
  }, [people, relationships, suggestionActionContext, t]);

  const treeStrengthChecks = useMemo(() => {
    const remainingObjectiveTreeTasks = treeTasks.filter((task) => !task.done).length;
    const checks = [
      Boolean(currentAssignedPerson),
      people.length >= 2,
      relationships.length > 0,
      missingMemberDetails.length === 0,
      remainingObjectiveTreeTasks === 0,
    ];
    const completed = checks.filter(Boolean).length;
    return {
      completed,
      total: checks.length,
      percent: Math.round((completed / checks.length) * 100),
    };
  }, [currentAssignedPerson, missingMemberDetails.length, people.length, relationships.length, treeTasks]);
  const treeProgressChecklist = useMemo<TreeProgressChecklistItem[]>(() => {
    const remainingObjectiveTreeTasks = treeTasks.filter((task) => !task.done).length;

    return [
      {
        id: 'linked-profile',
        label: t(K.home.treePriorityLinkedProfile),
        done: Boolean(currentAssignedPerson),
      },
      {
        id: 'two-people',
        label: t(K.home.treePriorityTwoMembers),
        done: people.length >= 2,
      },
      {
        id: 'relationships',
        label: t(K.home.treePriorityRelationships),
        done: relationships.length > 0,
      },
      {
        id: 'details',
        label: t(K.home.treePriorityMissingDetails),
        done: missingMemberDetails.length === 0,
      },
      {
        id: 'steps',
        label: t(K.home.treePriorityBuildSteps),
        done: remainingObjectiveTreeTasks === 0,
      },
    ];
  }, [currentAssignedPerson, missingMemberDetails.length, people.length, relationships.length, t, treeTasks]);

  const overviewStats = useMemo(() => ([
    { id: 'people', label: t(K.home.familyMembersMetric), value: String(people.length) },
    { id: 'connections', label: t(K.home.connectFamily), value: String(relationships.length) },
    { id: 'tasks', label: t(K.home.openTasksMetric), value: String(isSetupMode ? Math.max(0, setupSteps.length - setupCompletedCount) : pendingBuildTaskCount) },
    { id: 'review', label: t(K.home.whatNeedsReview), value: String(needsAttentionCount) },
  ]), [
    isSetupMode,
    needsAttentionCount,
    pendingBuildTaskCount,
    people.length,
    relationships.length,
    setupCompletedCount,
    setupSteps.length,
    t,
  ]);

  const overviewPriorityItems = useMemo<OverviewPriorityItem[]>(() => {
    const items: OverviewPriorityItem[] = [];

    if (heroAttentionCallout) {
      items.push({
        id: 'attention-callout',
        title: heroAttentionCallout.title,
        description: heroAttentionCallout.description,
        actionLabel: heroAttentionCallout.buttonLabel,
        action: heroAttentionCallout.action,
        tone: 'attention',
      });
    }

    if (isSetupMode) {
      for (const step of setupSteps.filter((item) => !item.done).slice(0, 3)) {
        items.push({
          id: step.id,
          title: step.title,
          description: step.description,
          actionLabel: t(K.home.doThis),
          action: step.action,
          tone: 'default',
        });
      }
    } else {
      for (const task of visibleTreeTasks.slice(0, 2)) {
        items.push({
          id: task.id,
          title: task.title,
          description: task.description,
          actionLabel: task.ctaLabel,
          action: task.action,
          tone: 'default',
        });
      }
    }

    for (const item of missingMemberDetails.slice(0, 2)) {
      items.push({
        id: `missing-${item.personId}`,
        title: item.name,
        description: item.summary,
        actionLabel: t(K.home.reviewMemberDetails),
        action: item.action,
        tone: 'default',
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'hero-fallback',
        title: heroTitle,
        description: heroAction.description,
        actionLabel: heroAction.buttonLabel ?? heroAction.label,
        action: heroAction.action,
        tone: 'default',
      });
    }

    return items.slice(0, 4);
  }, [
    heroAction.action,
    heroAction.buttonLabel,
    heroAction.description,
    heroAction.label,
    heroAttentionCallout,
    heroTitle,
    isSetupMode,
    missingMemberDetails,
    setupSteps,
    t,
    visibleTreeTasks,
  ]);

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
  }, [approvalRequests, focusSection, lastVisitAt, navigation, notifications, openApprovals, openMergeInvites, people, relationships, t]);

  if (loadingTreeData) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }]}>
        <ScreenBackground />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenBackground />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: 72 }]}
        showsVerticalScrollIndicator={false}
      >
        <Reveal delay={50}>
          <SectionCard elevation={2}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWrap}>
              <Text variant="headlineSmall">
                {currentAssignedPerson ? t(K.home.welcomeBackName, { name: currentAssignedPerson.firstName }) : t(K.home.welcomeToYourFamilyHome)}
              </Text>
            </View>
            <Chip icon="home-heart">{selectedTree.name}</Chip>
          </View>

          </SectionCard>
        </Reveal>

        <Reveal delay={60}>
          <TabStripCard>
            <HorizontalTabStrip
              items={dashboardTabs}
              activeKey={dashboardTab}
              onChange={(key) => {
                hasUserSelectedDashboardTabRef.current = true;
                setDashboardTab(key);
                scrollRef.current?.scrollTo({ y: 0, animated: true });
              }}
              contentContainerStyle={profileStyles.tabStripContent}
              itemStyle={profileStyles.tabStripItem}
            />
          </TabStripCard>
        </Reveal>

      {dashboardTab !== 'highlights' && !isEmptyTree ? (
        <Reveal delay={70}>
          <SectionCard>
            <View
              style={[
                localStyles.strengthCard,
                {
                  backgroundColor: theme.colors.primaryContainer,
                  borderColor: theme.colors.primary,
                },
              ]}
            >
              <View style={localStyles.strengthTopRow}>
                <View style={localStyles.strengthCopy}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="titleLarge">{t(K.home.completeYourTree)}</Text>
                    <IconButton
                      icon="information-outline"
                      size={18}
                      style={{ margin: 0 }}
                      onPress={() => setHeroInfoVisible(true)}
                      accessibilityLabel={t(K.home.whyThisMatters)}
                    />
                  </View>
                  <Text variant="bodyMedium" style={{ color: spotlightSubtextColor, marginTop: 6 }}>
                    {dashboardTab === 'activity'
                      ? t(K.home.reviewWhatChangedWhatIsWaitingAndWhereSharedWorkNeedsADecision)
                      : dashboardTab === 'build'
                        ? t(K.home.focusOnAddingPeopleStrengtheningBranchesAndGrowingTheFamilyStory)
                        : t(K.home.hereIsTheBestNextStepToMakeYourProfileFeelFullerAndYourBranchMoreConnected)}
                  </Text>
                </View>

                <View style={localStyles.strengthMetricWrap}>
                  <Text variant="headlineMedium" style={{ color: spotlightTextColor }}>
                    {treeStrengthChecks.percent}%
                  </Text>
                  <Text variant="labelMedium" style={{ color: spotlightSubtextColor }}>
                    {t(K.home.progressLabel)}
                  </Text>
                </View>
              </View>

              <View style={[localStyles.strengthProgressTrack, { backgroundColor: theme.dark ? theme.colors.elevation.level2 : '#D5E6DC' }]}>
                <View
                  style={[
                    localStyles.strengthProgressFill,
                    {
                      width: `${Math.max(8, treeStrengthChecks.percent)}%`,
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                />
              </View>

              <View style={localStyles.strengthChipRow}>
                <Chip compact icon={isSetupMode ? 'rocket-launch-outline' : 'check-decagram'}>
                  {isSetupMode ? t(K.home.continueSetup) : t(K.home.profileLookingStrong)}
                </Chip>
                <Chip compact icon="check-circle-outline">
                  {t(K.home.treeBuildingStepsFinishedCount, {
                    completed: treeStrengthChecks.completed,
                    total: treeStrengthChecks.total,
                  })}
                </Chip>
                {needsAttentionCount > 0 ? (
                  <Chip
                    compact
                    icon="alert-circle-outline"
                    style={{ backgroundColor: theme.colors.errorContainer }}
                    textStyle={{ color: theme.colors.onErrorContainer }}
                  >
                    {t(K.home.activityCount, { count: needsAttentionCount })}
                  </Chip>
                ) : null}
              </View>

              <View style={localStyles.strengthStatsRow}>
                {overviewStats.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      localStyles.strengthStatCard,
                      {
                        backgroundColor: chrome.primaryCardBackground,
                        borderColor: theme.colors.primary,
                      },
                    ]}
                  >
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      {item.label}
                    </Text>
                    <Text variant="headlineSmall">{item.value}</Text>
                  </View>
                ))}
              </View>

              <View
                style={[
                  localStyles.strengthSummaryCard,
                  {
                    backgroundColor: chrome.primaryCardBackground,
                    borderColor: theme.colors.primary,
                  },
                ]}
              >
                <Text variant="titleMedium">
                  {missingMemberDetails.length > 0 ? t(K.home.membersMissingDetails) : t(K.home.connectFamilyRelationships)}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                  {missingMemberDetails.length > 0
                    ? t(K.home.missingImportantDetailsSummary, { count: missingMemberDetails.length })
                    : relationships.length === 0
                      ? t(K.home.linkPeopleTogetherSoTheTreeBecomesAConnectedFamilyInsteadOfSeparatePages)
                      : t(K.home.theseStepsGrowTheFamilyBeyondOnePersonAndStrengthenTheBranchStructure)}
                </Text>
                <View style={localStyles.strengthChipRow}>
                  {missingMemberDetails.slice(0, 3).map((item) => (
                    <Chip key={item.personId} compact icon="account-alert-outline" onPress={item.action}>
                      {item.name}
                    </Chip>
                  ))}
                  {missingMemberDetails.length === 0 && relationships.length > 0 ? (
                    <Chip compact icon="source-branch-check">{t(K.home.yourEssentialsAreInPlace)}</Chip>
                  ) : null}
                </View>
                <View style={localStyles.checklistWrap}>
                  <View style={localStyles.actionPanelHeader}>
                    <Text variant="labelLarge">{t(K.home.progressIncludes)}</Text>
                    <Button
                      mode="text"
                      icon={progressIncludesExpanded ? 'chevron-up' : 'chevron-down'}
                      onPress={() => setProgressIncludesExpanded((current) => !current)}
                      style={BUTTON_CHROME}
                      contentStyle={BUTTON_CONTENT_CHROME}
                    >
                      {progressIncludesExpanded ? t(K.common.close) : t(K.common.open)}
                    </Button>
                  </View>
                  {progressIncludesExpanded ? treeProgressChecklist.map((item) => (
                    <View key={item.id} style={localStyles.checklistRow}>
                      <Chip compact icon={item.done ? 'check-circle-outline' : 'circle-outline'}>
                        {item.done ? t(K.common.done) : t(K.home.doThis)}
                      </Chip>
                      <Text variant="bodyMedium" style={localStyles.checklistCopy}>
                        {item.label}
                      </Text>
                    </View>
                  )) : null}
                </View>
              </View>

              <View
                style={[
                  localStyles.actionPanel,
                  {
                    backgroundColor: chrome.primaryCardBackground,
                    borderColor: theme.colors.primary,
                  },
                ]}
              >
                <View style={localStyles.actionPanelHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium">{t(K.home.nextRecommendedAction)}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                      {overviewPriorityItems.length > 1
                        ? t(K.home.stepsLeftCount, { count: overviewPriorityItems.length })
                        : heroAction.description}
                    </Text>
                  </View>
                  <Button
                    mode="text"
                    icon={overviewActionsExpanded ? 'chevron-up' : 'chevron-down'}
                    onPress={() => setOverviewActionsExpanded((current) => !current)}
                    style={BUTTON_CHROME}
                    contentStyle={BUTTON_CONTENT_CHROME}
                  >
                    {overviewActionsExpanded ? t(K.common.close) : t(K.common.open)}
                  </Button>
                </View>

                {overviewActionsExpanded ? (
                  <View style={localStyles.actionPanelBody}>
                    {overviewPriorityItems.map((item) => (
                      <View
                          key={item.id}
                          style={[
                            localStyles.actionItem,
                            {
                              backgroundColor: item.tone === 'attention' ? theme.colors.errorContainer : chrome.secondaryCardBackground,
                              borderColor: item.tone === 'attention' ? theme.colors.error : chrome.sectionBorder,
                            },
                          ]}
                      >
                        <View style={localStyles.actionItemRow}>
                          <View style={localStyles.actionItemCopy}>
                            <Text variant="titleSmall" style={item.tone === 'attention' ? { color: theme.colors.onErrorContainer } : undefined}>
                              {item.title}
                            </Text>
                            <Text
                              variant="bodySmall"
                              style={{
                                marginTop: 4,
                                color: item.tone === 'attention' ? theme.colors.onErrorContainer : theme.colors.onSurfaceVariant,
                              }}
                            >
                              {item.description}
                            </Text>
                          </View>
                          <Button
                            mode={item.tone === 'attention' ? 'contained' : 'outlined'}
                            onPress={item.action}
                            style={BUTTON_CHROME}
                            buttonColor={item.tone === 'attention' ? theme.colors.error : undefined}
                            textColor={item.tone === 'attention' ? theme.colors.onError : undefined}
                            contentStyle={BUTTON_CONTENT_CHROME}
                          >
                            {item.actionLabel}
                          </Button>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </SectionCard>
        </Reveal>
      ) : null}

      {dashboardTab === 'overview' ? (
        <>
          {isEmptyTree ? (
            <Reveal delay={90}>
              <SectionCard>
                <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {t(K.home.startTheTreeWithYourselfOrFirstRelative)}
                </Text>
                <View style={[styles.dashboardActionRow, { marginTop: 16 }]}>
                  <Button mode="contained" onPress={onOpenAddSelf} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                    {t(K.home.startMyProfile)}
                  </Button>
                  {canEdit ? (
                    <Button mode="outlined" onPress={onOpenAddPerson} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                      {t(K.home.addFamilyMember)}
                    </Button>
                  ) : null}
                </View>
              </SectionCard>
            </Reveal>
          ) : null}

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
              <SectionCard onLayout={registerSectionOffset('since-last-visit')}>
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
              </SectionCard>
            </Reveal>
          ) : null}

          {needsAttentionCount > 0 ? (
            <Reveal delay={120}>
              <SectionCard>
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
              </SectionCard>
            </Reveal>
          ) : null}

        </>
      ) : null}

      {dashboardTab === 'build' ? (
        visibleStoryTasks.length + visibleTreeTasks.length > 0 ? (
          <Reveal delay={140}>
            <View onLayout={registerSectionOffset('keep-building')}>
              <SectionCard>
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
                  {dashboardBundles.length > 0 ? (
                    <View style={styles.dashboardMetricRow}>
                      {dashboardBundles.map((bundle) => (
                        <DashboardMetricCard
                          key={bundle.id}
                          backgroundColor={theme.colors.elevation.level1}
                          borderColor={theme.colors.outlineVariant}
                        >
                            <Text variant="titleMedium">{bundle.title}</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                              {bundle.description}
                            </Text>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 10 }}>
                              {t(K.home.stepsLeftCount, { count: bundle.remainingCount })}
                            </Text>
                            <Button mode={bundle.id === 'tree' ? 'contained' : 'outlined'} onPress={bundle.action} style={[BUTTON_CHROME, { alignSelf: 'flex-start', marginTop: 12 }]} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                              {bundle.actionLabel}
                            </Button>
                        </DashboardMetricCard>
                      ))}
                    </View>
                  ) : null}

                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {t(K.home.buildOverviewHelper)}
                  </Text>

                  {visibleStoryTasks.length > 0 ? (
                    <View>
                      <Text variant="titleMedium">{t(K.home.completeYourStory)}</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                        {t(K.home.theseStepsShapeYourOwnPageIntoAFullerBiography)}
                      </Text>
                      <SuggestionList
                        suggestions={visibleStoryTasks}
                        onPressSuggestion={(suggestion) => suggestion.action()}
                        onDismissSuggestion={(suggestion) => dismissTask(suggestion.id)}
                        dismissLabel={t(K.home.hide)}
                        variant="dashboard"
                        getCardColors={() => ({
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.outlineVariant,
                        })}
                        getActionMode={() => 'outlined'}
                      />
                    </View>
                  ) : null}

                  {visibleTreeTasks.length > 0 ? (
                    <View>
                      <Text variant="titleMedium">{t(K.home.completeYourTree)}</Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                        {t(K.home.theseStepsGrowTheFamilyBeyondOnePersonAndStrengthenTheBranchStructure)}
                      </Text>
                      <SuggestionList
                        suggestions={visibleTreeTasks}
                        onPressSuggestion={(suggestion) => suggestion.action()}
                        onDismissSuggestion={(suggestion) => dismissTask(suggestion.id)}
                        dismissLabel={t(K.home.hide)}
                        variant="dashboard"
                        getCardColors={() => ({
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.outlineVariant,
                        })}
                        getActionMode={() => 'contained'}
                      />
                    </View>
                  ) : null}
                </View>
                ) : null}
              </SectionCard>
            </View>
          </Reveal>
        ) : (
          <Reveal delay={140}>
            <SectionCard>
              <Text variant="titleLarge">{t(K.home.yourBuildListIsClear)}</Text>
              <Text variant="bodyMedium" style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                {t(K.home.yourStoryAndTreePromptsAreCoveredForNowAddANewFamilyMemberOrOpenYourProfileToKeepGrowing)}
              </Text>
              <View style={styles.dashboardActionRow}>
                {currentAssignedPerson ? (
                  <Button mode="contained" onPress={() => openPersonProfile(currentAssignedPerson)} style={BUTTON_CHROME} buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} contentStyle={BUTTON_CONTENT_CHROME}>
                    {t(K.home.openMyProfile)}
                  </Button>
                ) : (
                  <Button mode="contained" onPress={onOpenAddSelf} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>
                    {t(K.home.startMyProfile)}
                  </Button>
                )}
                {canEdit ? <Button mode="outlined" onPress={onOpenAddPerson} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>{t(K.home.addFamilyMember)}</Button> : null}
                {dismissedTaskIds.length > 0 ? <Button mode="text" onPress={restoreHiddenPrompts} style={BUTTON_CHROME} contentStyle={BUTTON_CONTENT_CHROME}>{t(K.home.restorePrompts)}</Button> : null}
              </View>
            </SectionCard>
          </Reveal>
        )
      ) : null}

      <InfoDialog
        visible={heroInfoVisible}
        title={heroTitle}
        message={(
          <>
            <Text variant="labelLarge">{t(K.home.whyThisMatters)}</Text>
            <Text variant="bodyMedium" style={{ marginTop: 8 }}>
              {heroAction.description}
            </Text>
            <Text variant="bodyMedium" style={{ marginTop: 12 }}>
              {lensSubtitle}
            </Text>
            <View style={localStyles.checklistWrap}>
              <View style={localStyles.actionPanelHeader}>
                <Text variant="labelLarge">{t(K.home.progressIncludes)}</Text>
                <Button
                  mode="text"
                  icon={progressIncludesDialogExpanded ? 'chevron-up' : 'chevron-down'}
                  onPress={() => setProgressIncludesDialogExpanded((current) => !current)}
                  style={BUTTON_CHROME}
                  contentStyle={BUTTON_CONTENT_CHROME}
                >
                  {progressIncludesDialogExpanded ? t(K.common.close) : t(K.common.open)}
                </Button>
              </View>
              {progressIncludesDialogExpanded ? treeProgressChecklist.map((item) => (
                <View key={item.id} style={localStyles.checklistRow}>
                  <Chip compact icon={item.done ? 'check-circle-outline' : 'circle-outline'}>
                    {item.done ? t(K.common.done) : t(K.home.doThis)}
                  </Chip>
                  <Text variant="bodyMedium" style={localStyles.checklistCopy}>
                    {item.label}
                  </Text>
                </View>
              )) : null}
            </View>
          </>
        )}
        onDismiss={() => setHeroInfoVisible(false)}
      />
      <Portal>
        <Dialog
          visible={activityModalVisible}
          onDismiss={() => setActivityModalVisible(false)}
          style={[dialogChrome.dialog, { backgroundColor: theme.colors.surface, maxHeight: '88%' }]}
        >
          <Dialog.Title style={[dialogChrome.dialogTitle, dialogChrome.dialogTitleWithClose]}>{t(K.home.activity)}</Dialog.Title>
          <IconButton
            icon="close"
            size={20}
            onPress={() => setActivityModalVisible(false)}
            style={dialogChrome.closeButton}
            accessibilityLabel={t(K.common.close)}
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
      <InfoDialog
        visible={buildInfoVisible}
        title={isSetupMode ? t(K.home.aboutSetupWizard) : t(K.home.aboutBuildYourFamily)}
        message={
          isSetupMode
            ? t(K.home.theseStepsGuideABrandNewTreeFromFirstProfileToFirstRealFamilyStructure)
            : t(K.home.buildYourFamilySeparatesProfileWorkFromTreeBuildingSoItIsEasierToGrowYourOwnStoryAndTheWiderTreeWithoutMixingThemTogether)
        }
        onDismiss={() => setBuildInfoVisible(false)}
      />
      <FloatingSnackbar
        visible={Boolean(celebrationMessage)}
        onDismiss={() => setCelebrationMessage(null)}
        duration={2600}
        action={{
          label: t(K.home.nice),
          onPress: () => setCelebrationMessage(null),
        }}
      >
        {celebrationMessage}
      </FloatingSnackbar>
      </ScrollView>
    </View>
  );
}
