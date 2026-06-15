import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { auth } from '../services/firebase';
import { getAllWorkspaceProjects } from '../services/dataService';
import { ensureActiveTenantId } from '../services/domain/authService';
import { getWorkspaceInitiatives } from '../services/domain/initiativesService';
import { getSharedProjects, getUserProjects } from '../services/domain/projectsService';
import { getUserTasksForProjects, toggleTaskStatus, updateTaskFields } from '../services/domain/tasksService';
import { getUserProfile } from '../services/domain/usersService';
import { Project, Task, Initiative } from '../types';
import { toDate, toMillis } from '../utils/time';
import { calculateProjectHealth, isProjectActiveForGlobalSignals, ProjectHealth } from '../services/healthService';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { OnboardingWelcomeModal } from '../components/onboarding/OnboardingWelcomeModal';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { useUIState } from '../context/UIContext';
import type { PinnedItem } from '../context/PinnedTasksContext';
import { checkPasskeyExists } from '../services/passkeyService';
import { PasskeySetupModal } from '../components/modals/PasskeySetupModal';

type DashboardTone = 'danger' | 'warning' | 'info' | 'success' | 'neutral';

interface DashboardStatement {
    template: string;
    value: string;
}

interface DashboardRouteStop {
    id: string;
    href: string;
    title: string;
    meta: string;
    reason: string;
    tone: DashboardTone;
    focus?: PinnedItem;
    proposed?: boolean;
    taskId?: string;
    projectId?: string;
    tenantId?: string;
}

interface DashboardWeekDay {
    key: string;
    label: string;
    dayNum: string;
    count: number;
    isToday: boolean;
    isWeekend: boolean;
}

interface DashboardNightEntry {
    key: string;
    timeMs: number;
    time: string;
    symbol: string;
    tone: DashboardTone;
    text: string;
}

interface DashboardAttentionChip {
    key: string;
    label: string;
    tone: DashboardTone;
}

interface DashboardRailListItem {
    id: string;
    href: string;
    title: string;
    meta: string;
    tone: DashboardTone;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const cssVars = (vars: Record<string, string>) => vars as React.CSSProperties;

const startOfToday = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
};

const isToday = (value?: any) => {
    const date = toDate(value);
    if (!date) return false;

    const start = startOfToday();
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    const time = date.getTime();

    return time >= start.getTime() && time < end.getTime();
};

const isPastDue = (value?: any) => {
    const date = toDate(value);
    return date ? date.getTime() < startOfToday().getTime() : false;
};

const bucketByDay = (items: Task[], days: number, getValue: (task: Task) => any) => {
    const buckets = Array.from({ length: days }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - index - 1));
        date.setHours(0, 0, 0, 0);
        return { date, value: 0 };
    });
    const firstDay = buckets[0]?.date.getTime() ?? Date.now();

    items.forEach((item) => {
        const itemDate = toDate(getValue(item));
        if (!itemDate) return;
        const normalized = new Date(itemDate);
        normalized.setHours(0, 0, 0, 0);
        const index = Math.floor((normalized.getTime() - firstDay) / DAY_MS);
        if (index >= 0 && index < buckets.length) {
            buckets[index].value += 1;
        }
    });

    return buckets;
};

const renderDashboardStatement = (statement: DashboardStatement) => {
    if (!statement.template.includes('{value}')) {
        return statement.template;
    }

    const [before, after = ''] = statement.template.split('{value}');
    return (
        <>
            {before}
            <em>{statement.value}</em>
            {after}
        </>
    );
};

export const Dashboard = () => {
    const { isAuthReady, user } = useAuth();
    const { t, language, dateLocale, dashboardTranslationsReady, loadDashboardTranslations } = useLanguage();
    const { startFocusItem, toggleModal, focusItemId, focusItem, focusState, isModalOpen } = usePinnedTasks();
    const { openTaskCreateModal } = useUIState();
    const [authUserId, setAuthUserId] = useState<string | null>(() => auth.currentUser?.uid ?? null);
    const [userName, setUserName] = useState<string>('');
    const [greeting, setGreeting] = useState<string>(() => t('dashboard.greeting.default'));
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [initiatives, setInitiatives] = useState<Initiative[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPasskeyUpsell, setShowPasskeyUpsell] = useState(false);
    const [activeDashboardStep, setActiveDashboardStep] = useState(0);
    const dashboardStageRef = useRef<HTMLDivElement | null>(null);

    // Browsers scroll overflow-hidden containers to reveal focused/clicked
    // content; the slide transform owns the horizontal position, so pin the
    // stage scroll offset to zero.
    useEffect(() => {
        const stage = dashboardStageRef.current;
        if (!stage) return;
        stage.scrollLeft = 0;
        stage.scrollTop = 0;
    }, [activeDashboardStep]);

    useEffect(() => {
        void loadDashboardTranslations();
    }, [loadDashboardTranslations]);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setAuthUserId(user?.uid ?? null);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) {
            setGreeting(t('dashboard.greeting.morning'));
        } else if (hour < 18) {
            setGreeting(t('dashboard.greeting.afternoon'));
        } else {
            setGreeting(t('dashboard.greeting.evening'));
        }
    }, [t]);

    const onboardingSteps = useMemo<OnboardingStep[]>(() => ([
        {
            id: 'header',
            targetId: 'dashboard-header',
            title: t('onboarding.dashboard.steps.header.title'),
            description: t('onboarding.dashboard.steps.header.description')
        },
        {
            id: 'focus',
            targetId: 'dashboard-kpis',
            title: t('onboarding.dashboard.steps.kpis.title'),
            description: t('onboarding.dashboard.steps.kpis.description'),
            placement: 'top'
        }
    ]), [t]);

    const {
        showWelcome: showOnboardingWelcome,
        onboardingActive,
        stepIndex: onboardingStepIndex,
        setStepIndex: setOnboardingStepIndex,
        start: handleStartOnboarding,
        skip: handleSkipOnboarding,
        finish: handleFinishOnboarding
    } = useOnboardingTour('dashboard', {
        stepCount: onboardingSteps.length,
        enabled: !loading
    });

    useEffect(() => {
        if (!isAuthReady) {
            setLoading(true);
            return;
        }

        if (!authUserId) {
            setProjects([]);
            setTasks([]);
            setInitiatives([]);
            setUserName('');
            setLoading(false);
            return;
        }

        let cancelled = false;

        const loadDashboard = async () => {
            setLoading(true);
            try {
                const resolvedTenantId = await ensureActiveTenantId();
                const profilePromise = getUserProfile(authUserId).catch(() => null);
                const [ownedProjects, sharedProjects, profile] = await Promise.all([
                    getUserProjects(undefined, { hydrateAssets: false }).catch(() => []),
                    getSharedProjects({ hydrateAssets: false }).catch(() => []),
                    profilePromise
                ]);
                const dedupedProjects = new Map<string, Project>();
                [...ownedProjects, ...sharedProjects].forEach((project) => {
                    dedupedProjects.set(`${project.tenantId || 'none'}:${project.id}`, project);
                });

                let workspaceProjects = Array.from(dedupedProjects.values());
                if (workspaceProjects.length === 0) {
                    try {
                        workspaceProjects = await getAllWorkspaceProjects(resolvedTenantId, { hydrateAssets: false });
                    } catch (error) {
                        console.warn('Dashboard workspace project query failed', error);
                    }
                }

                if (cancelled) return;
                setProjects(workspaceProjects);
                setTasks([]);
                setInitiatives([]);

                const displayName = user?.displayName || auth.currentUser?.displayName || profile?.displayName;
                setUserName(displayName ? displayName.split(' ')[0] : '');
                setLoading(false);

                const [workspaceTasks, workspaceInitiatives] = await Promise.all([
                    getUserTasksForProjects(workspaceProjects).catch(() => []),
                    getWorkspaceInitiatives(resolvedTenantId).catch(() => [])
                ]);

                if (cancelled) return;
                setTasks(workspaceTasks);
                setInitiatives(workspaceInitiatives);
            } catch (err) {
                console.error(err);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void loadDashboard();

        return () => {
            cancelled = true;
        };
    }, [authUserId, isAuthReady, user?.displayName]);

    useEffect(() => {
        const checkPasskeyStatus = async () => {
            if (!auth.currentUser) return;

            const snoozeUntil = localStorage.getItem('projectflow_passkey_reminder_snooze');
            if (snoozeUntil && parseInt(snoozeUntil, 10) > Date.now()) return;

            const hasPasskeys = await checkPasskeyExists(auth.currentUser.uid);
            if (!hasPasskeys) {
                window.setTimeout(() => setShowPasskeyUpsell(true), 1000);
            }
        };

        void checkPasskeyStatus().catch((error) => {
            console.warn('Passkey reminder check failed', error);
        });
    }, []);

    const projectById = useMemo(() => {
        const map = new Map<string, string>();
        projects.forEach((project) => map.set(project.id, project.title));
        return map;
    }, [projects]);

    const activeProjects = useMemo(
        () => projects.filter(isProjectActiveForGlobalSignals),
        [projects]
    );

    const activeProjectIds = useMemo(
        () => new Set(activeProjects.map((project) => project.id)),
        [activeProjects]
    );

    const activeTasks = useMemo(
        () => tasks.filter((task) => activeProjectIds.has(task.projectId)),
        [activeProjectIds, tasks]
    );

    const activeInitiatives = useMemo(
        () => initiatives.filter((initiative) => activeProjectIds.has(initiative.projectId)),
        [activeProjectIds, initiatives]
    );

    const openTasks = useMemo(
        () => activeTasks.filter((task) => !task.isCompleted),
        [activeTasks]
    );

    const tasksByProject = useMemo(() => {
        const map: Record<string, Task[]> = {};
        activeTasks.forEach((task) => {
            if (!map[task.projectId]) map[task.projectId] = [];
            map[task.projectId].push(task);
        });
        return map;
    }, [activeTasks]);

    const initiativesByProject = useMemo(() => {
        const map: Record<string, Initiative[]> = {};
        activeInitiatives.forEach((initiative) => {
            if (!map[initiative.projectId]) map[initiative.projectId] = [];
            map[initiative.projectId].push(initiative);
        });
        return map;
    }, [activeInitiatives]);

    const projectHealthMap = useMemo(() => {
        const healthMap: Record<string, ProjectHealth> = {};
        activeProjects.forEach((project) => {
            healthMap[project.id] = calculateProjectHealth(
                project,
                tasksByProject[project.id] || [],
                [],
                [],
                [],
                [],
                [],
                initiativesByProject[project.id] || [],
                []
            );
        });
        return healthMap;
    }, [activeProjects, initiativesByProject, tasksByProject]);

    const overdueTasks = useMemo(
        () => openTasks.filter((task) => isPastDue(task.dueDate)),
        [openTasks]
    );

    const dueTodayTasks = useMemo(
        () => openTasks.filter((task) => isToday(task.dueDate)),
        [openTasks]
    );

    const scheduledTodayTasks = useMemo(
        () => openTasks.filter((task) => isToday(task.scheduledDate) && !isToday(task.dueDate) && !isPastDue(task.dueDate)),
        [openTasks]
    );

    const blockedTasks = useMemo(
        () => openTasks.filter((task) => task.status === 'Blocked'),
        [openTasks]
    );

    // Everything that should realistically happen today, deduplicated.
    const todayQueue = useMemo(() => {
        const seen = new Set<string>();
        return [...overdueTasks, ...dueTodayTasks, ...scheduledTodayTasks].filter((task) => {
            if (seen.has(task.id)) return false;
            seen.add(task.id);
            return true;
        });
    }, [dueTodayTasks, overdueTasks, scheduledTodayTasks]);

    // How many open tasks each open task is blocking (reverse dependency count).
    const unblocksCount = useMemo(() => {
        const map = new Map<string, number>();
        openTasks.forEach((task) => {
            (task.dependencies || []).forEach((dependencyId) => {
                map.set(dependencyId, (map.get(dependencyId) || 0) + 1);
            });
        });
        return map;
    }, [openTasks]);

    const taskById = useMemo(() => {
        const map = new Map<string, Task>();
        activeTasks.forEach((task) => map.set(task.id, task));
        return map;
    }, [activeTasks]);

    const completedLast7Days = useMemo(() => {
        const threshold = Date.now() - (7 * DAY_MS);
        return activeTasks.filter((task) => task.isCompleted && toMillis(task.completedAt) >= threshold);
    }, [activeTasks]);

    const completedPrevious7Days = useMemo(() => {
        const now = Date.now();
        return activeTasks.filter((task) => {
            if (!task.isCompleted) return false;
            const completed = toMillis(task.completedAt);
            return completed >= now - (14 * DAY_MS) && completed < now - (7 * DAY_MS);
        });
    }, [activeTasks]);

    const completionTrend = useMemo(
        () => bucketByDay(activeTasks.filter((task) => task.isCompleted), 14, (task) => task.completedAt),
        [activeTasks]
    );

    const maxCompletionValue = useMemo(
        () => Math.max(...completionTrend.map((item) => item.value), 1),
        [completionTrend]
    );

    const todayLongLabel = useMemo(
        () => format(new Date(), 'PPPP', { locale: dateLocale }),
        [dateLocale, language]
    );

    const overdueDaysOf = (task: Task) => {
        const due = toDate(task.dueDate);
        if (!due) return 0;
        return Math.max(1, Math.floor((startOfToday().getTime() - due.getTime()) / DAY_MS));
    };

    // --- Step 1: day band + route ------------------------------------------

    const isFocusSnoozed = useMemo(() => (
        focusState?.status === 'snoozed'
            && Boolean(focusState.snoozedUntil)
            && new Date(focusState.snoozedUntil || '').getTime() > Date.now()
    ), [focusState?.snoozedUntil, focusState?.status]);

    const routeStops = useMemo<DashboardRouteStop[]>(() => {
        const items: DashboardRouteStop[] = [];
        const seen = new Set<string>();
        const projectLabel = (projectId?: string) => (projectId && projectById.get(projectId)) || '';
        const taskFocus = (task: Task): PinnedItem | undefined => (
            task.projectId
                ? {
                    id: task.id,
                    type: 'task',
                    title: task.title,
                    projectId: task.projectId,
                    tenantId: task.tenantId,
                    priority: task.priority,
                    isCompleted: task.isCompleted
                }
                : undefined
        );
        const freesSuffix = (taskId: string) => {
            const count = unblocksCount.get(taskId) || 0;
            if (count === 0) return '';
            const text = count === 1
                ? t('dashboard.today.reason.unblocksOne')
                : t('dashboard.today.reason.unblocks').replace('{count}', String(count));
            return ` · ${text}`;
        };
        const pushTask = (task: Task, reason: string, tone: DashboardTone) => {
            if (items.length >= 4 || seen.has(task.id)) return;
            seen.add(task.id);
            items.push({
                id: task.id,
                href: task.projectId ? `/project/${task.projectId}/tasks/${task.id}` : '/tasks',
                title: task.title,
                meta: projectLabel(task.projectId),
                reason,
                tone,
                focus: taskFocus(task),
                taskId: task.id,
                projectId: task.projectId,
                tenantId: task.tenantId
            });
        };

        if (focusItem && focusItem.projectId && activeProjectIds.has(focusItem.projectId) && !isFocusSnoozed && !focusItem.isCompleted) {
            const focusTask = taskById.get(focusItem.id);
            if (!focusTask || !focusTask.isCompleted) {
                seen.add(focusItem.id);
                const focusPath = focusItem.type === 'initiative' ? 'initiatives' : 'tasks';
                items.push({
                    id: focusItem.id,
                    href: `/project/${focusItem.projectId}/${focusPath}/${focusItem.id}`,
                    title: focusItem.title,
                    meta: projectById.get(focusItem.projectId) || '',
                    reason: focusTask?.nextStep
                        ? t('dashboard.today.reason.focusNext').replace('{next}', focusTask.nextStep)
                        : t('dashboard.today.reason.focusResume'),
                    tone: 'info',
                    focus: focusItem,
                    taskId: focusItem.id,
                    projectId: focusItem.projectId,
                    tenantId: focusItem.tenantId
                });
            }
        }

        const byDueDate = (a: Task, b: Task) => (
            (toDate(a.dueDate || a.scheduledDate)?.getTime() ?? Number.POSITIVE_INFINITY)
                - (toDate(b.dueDate || b.scheduledDate)?.getTime() ?? Number.POSITIVE_INFINITY)
        );

        [...overdueTasks].sort(byDueDate).forEach((task) => {
            const days = overdueDaysOf(task);
            const reason = days <= 1
                ? t('dashboard.today.reason.overdueYesterday')
                : t('dashboard.today.reason.overdueDays').replace('{days}', String(days));
            pushTask(task, `${reason}${freesSuffix(task.id)}`, 'danger');
        });

        const priorityRank = { Urgent: 0, High: 1, Medium: 2, Low: 3 } as Record<string, number>;
        [...dueTodayTasks]
            .sort((a, b) => (priorityRank[a.priority || 'Medium'] ?? 2) - (priorityRank[b.priority || 'Medium'] ?? 2))
            .forEach((task) => {
                pushTask(task, `${t('dashboard.today.reason.dueToday')}${freesSuffix(task.id)}`, 'warning');
            });

        scheduledTodayTasks.forEach((task) => {
            pushTask(task, t('dashboard.today.reason.scheduled'), 'neutral');
        });

        // Fill remaining stops with quick follow-ups on blocked work.
        blockedTasks.forEach((task) => {
            if (items.length >= 4 || seen.has(task.id)) return;
            seen.add(task.id);
            let why = task.blockerNote || '';
            if (!why && task.dependencies && task.dependencies.length > 0) {
                const dependency = taskById.get(task.dependencies[0]);
                if (dependency && !dependency.isCompleted) {
                    why = t('dashboard.today.blockedRail.dependency').replace('{title}', dependency.title);
                }
            }
            items.push({
                id: `follow:${task.id}`,
                href: task.projectId ? `/project/${task.projectId}/tasks/${task.id}` : '/tasks',
                title: t('dashboard.route.followUp').replace('{title}', task.title),
                meta: projectLabel(task.projectId),
                reason: why || t('dashboard.today.blockedRail.fallback'),
                tone: 'neutral',
                taskId: task.id,
                projectId: task.projectId,
                tenantId: task.tenantId
            });
        });

        // Quiet day: nothing dated drove the route. Propose a plan from the
        // backlog so the route is never empty — ranked by priority, then age.
        const datedCount = items.length;
        if (datedCount < 3) {
            const ageDays = (task: Task) => {
                const created = toDate(task.createdAt);
                return created ? Math.max(0, Math.floor((Date.now() - created.getTime()) / DAY_MS)) : 0;
            };
            const backlog = openTasks
                .filter((task) => (
                    !seen.has(task.id)
                        && task.status !== 'Blocked'
                        && !task.dueDate
                        && !task.scheduledDate
                ))
                .sort((a, b) => {
                    const rank = (priorityRank[a.priority || 'Medium'] ?? 2) - (priorityRank[b.priority || 'Medium'] ?? 2);
                    if (rank !== 0) return rank;
                    return toMillis(a.createdAt) - toMillis(b.createdAt);
                });

            backlog.forEach((task) => {
                if (items.length >= 3 || seen.has(task.id)) return;
                seen.add(task.id);
                const age = ageDays(task);
                let reason: string;
                if (task.priority === 'Urgent' || task.priority === 'High') {
                    reason = t('dashboard.route.suggest.important');
                } else if (age >= 7) {
                    reason = t('dashboard.route.suggest.aged').replace('{days}', String(age));
                } else {
                    reason = t('dashboard.route.suggest.pick');
                }
                items.push({
                    id: `suggest:${task.id}`,
                    href: task.projectId ? `/project/${task.projectId}/tasks/${task.id}` : '/tasks',
                    title: task.title,
                    meta: projectLabel(task.projectId),
                    reason,
                    tone: 'neutral',
                    proposed: true,
                    focus: taskFocus(task),
                    taskId: task.id,
                    projectId: task.projectId,
                    tenantId: task.tenantId
                });
            });
        }

        return items;
    }, [
        activeProjectIds,
        blockedTasks,
        dueTodayTasks,
        focusItem,
        isFocusSnoozed,
        openTasks,
        overdueTasks,
        projectById,
        scheduledTodayTasks,
        t,
        taskById,
        unblocksCount
    ]);

    const routeRealCount = useMemo(() => routeStops.filter((stop) => !stop.proposed).length, [routeStops]);
    const routeIsSuggested = routeStops.length > 0 && routeRealCount === 0;

    const undatedOpenCount = useMemo(() => (
        openTasks.filter((task) => !task.dueDate && !task.scheduledDate && task.status !== 'Blocked').length
    ), [openTasks]);

    const routeStatement = useMemo<DashboardStatement>(() => {
        if (routeStops.length === 0) {
            return {
                template: t('dashboard.route.statement.clear'),
                value: t('dashboard.route.statement.clearValue')
            };
        }
        if (routeIsSuggested) {
            return {
                template: t(routeStops.length === 1 ? 'dashboard.route.statement.suggestOne' : 'dashboard.route.statement.suggest'),
                value: String(routeStops.length)
            };
        }
        if (todayQueue.length === 0 && blockedTasks.length > 0) {
            return {
                template: t(blockedTasks.length === 1 ? 'dashboard.route.statement.waitingOne' : 'dashboard.route.statement.waiting'),
                value: String(blockedTasks.length)
            };
        }
        if (routeStops.length === 1) {
            return { template: t('dashboard.route.statement.one'), value: routeStops[0].title };
        }
        if (overdueTasks.length > 0) {
            return {
                template: t(routeStops[0].tone === 'danger' ? 'dashboard.route.statement.behind' : 'dashboard.route.statement.behindLater'),
                value: String(routeStops.length)
            };
        }
        return { template: t('dashboard.route.statement.clean'), value: String(routeStops.length) };
    }, [blockedTasks.length, overdueTasks.length, routeIsSuggested, routeStops, t, todayQueue.length]);

    // "Diese Woche": always-on 7-day strip (Mon–Sun) with a count of dated work
    // per day. Structural even when quiet, so the rail never reads as empty.
    const weekStrip = useMemo<DashboardWeekDay[]>(() => {
        const today = startOfToday();
        const monday = new Date(today);
        const offset = (today.getDay() + 6) % 7; // Mon = 0
        monday.setDate(today.getDate() - offset);

        const dayCounts = new Map<number, number>();
        const bump = (value: any) => {
            const date = toDate(value);
            if (!date) return;
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            dayCounts.set(d.getTime(), (dayCounts.get(d.getTime()) || 0) + 1);
        };
        openTasks.forEach((task) => {
            bump(task.dueDate);
            if (task.scheduledDate) bump(task.scheduledDate);
        });
        activeProjects.forEach((project) => bump(project.dueDate));

        return Array.from({ length: 7 }, (_, index) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + index);
            const key = date.getTime();
            return {
                key: String(key),
                label: format(date, 'EEEEE', { locale: dateLocale }),
                dayNum: format(date, 'd', { locale: dateLocale }),
                count: dayCounts.get(key) || 0,
                isToday: key === today.getTime(),
                isWeekend: index >= 5
            };
        });
    }, [activeProjects, dateLocale, openTasks]);

    const weekStripTotal = useMemo(() => weekStrip.reduce((sum, day) => sum + day.count, 0), [weekStrip]);

    const dayShape = useMemo(() => {
        if (todayQueue.length === 0 && blockedTasks.length > 0) return 'waiting';
        if (todayQueue.length === 0) return 'clear';
        if (overdueTasks.length > 0) return 'behind';
        if (todayQueue.length >= 6) return 'heavy';
        return 'doable';
    }, [blockedTasks.length, overdueTasks.length, todayQueue.length]);

    const oldestOverdueTask = useMemo(() => {
        if (overdueTasks.length === 0) return null;
        return [...overdueTasks].sort((a, b) => (
            (toDate(a.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY) - (toDate(b.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY)
        ))[0];
    }, [overdueTasks]);

    const todayLoadLeader = useMemo(() => {
        const counts = new Map<string, number>();
        todayQueue.forEach((task) => {
            if (!task.projectId) return;
            counts.set(task.projectId, (counts.get(task.projectId) || 0) + 1);
        });
        let leader: { title: string; count: number } | null = null;
        counts.forEach((count, projectId) => {
            const title = projectById.get(projectId);
            if (!title) return;
            if (!leader || count > leader.count) {
                leader = { title, count };
            }
        });
        return { leader, projectCount: counts.size };
    }, [projectById, todayQueue]);

    const causeLine = useMemo(() => {
        if (dayShape === 'behind' && oldestOverdueTask) {
            const days = overdueDaysOf(oldestOverdueTask);
            if (days <= 1) {
                return t('dashboard.today.insight.oldestOverdueOne').replace('{title}', oldestOverdueTask.title);
            }
            return t('dashboard.today.insight.oldestOverdue')
                .replace('{days}', String(days))
                .replace('{title}', oldestOverdueTask.title);
        }
        if (dayShape === 'waiting' && blockedTasks.length > 0) {
            const first = blockedTasks[0];
            if (first.blockerNote) {
                return t('dashboard.today.insight.blockedNote')
                    .replace('{title}', first.title)
                    .replace('{note}', first.blockerNote);
            }
            return t('dashboard.today.insight.blockedPlain').replace('{title}', first.title);
        }
        if ((dayShape === 'heavy' || dayShape === 'doable') && todayLoadLeader.leader && todayLoadLeader.leader.count > 1) {
            return t('dashboard.today.insight.loadCenter')
                .replace('{project}', todayLoadLeader.leader.title)
                .replace('{count}', String(todayLoadLeader.leader.count));
        }
        if ((dayShape === 'heavy' || dayShape === 'doable') && todayLoadLeader.projectCount > 1) {
            return t('dashboard.today.insight.spread').replace('{count}', String(todayLoadLeader.projectCount));
        }
        if (dayShape === 'clear' && focusItem && activeProjectIds.has(focusItem.projectId || '')) {
            return t('dashboard.today.insight.focusOpen').replace('{title}', focusItem.title);
        }
        if (completedLast7Days.length > 0) {
            return t('dashboard.today.insight.momentum').replace('{count}', String(completedLast7Days.length));
        }
        return t('dashboard.today.insight.fresh');
    }, [
        activeProjectIds,
        blockedTasks,
        completedLast7Days.length,
        dayShape,
        focusItem,
        oldestOverdueTask,
        t,
        todayLoadLeader
    ]);

    // Day band: one segment per piece of today's work, plus the free rest.
    const bandSegments = useMemo(() => {
        const segments: Array<{ key: string; type: 'overdue' | 'due' | 'waiting' | 'rest'; flex: number }> = [];
        const cap = (count: number) => Math.min(count, 6);
        const dueCount = todayQueue.length - overdueTasks.length;

        for (let i = 0; i < cap(overdueTasks.length); i += 1) {
            segments.push({ key: `overdue-${i}`, type: 'overdue', flex: 1.3 });
        }
        for (let i = 0; i < cap(dueCount); i += 1) {
            segments.push({ key: `due-${i}`, type: 'due', flex: 1 });
        }
        for (let i = 0; i < cap(blockedTasks.length); i += 1) {
            segments.push({ key: `waiting-${i}`, type: 'waiting', flex: 0.8 });
        }
        const used = segments.reduce((sum, segment) => sum + segment.flex, 0);
        segments.push({ key: 'rest', type: 'rest', flex: Math.max(used > 0 ? 2 : 8, 8 - used) });
        return segments;
    }, [blockedTasks.length, overdueTasks.length, todayQueue.length]);

    const bandCaptionParts = useMemo(() => {
        const parts: Array<{ key: string; tone: DashboardTone; label: string }> = [];
        if (overdueTasks.length > 0) {
            parts.push({
                key: 'overdue',
                tone: 'danger',
                label: t('dashboard.band.overdue').replace('{count}', String(overdueTasks.length))
            });
        }
        const dueCount = todayQueue.length - overdueTasks.length;
        if (dueCount > 0) {
            parts.push({
                key: 'due',
                tone: 'warning',
                label: t('dashboard.band.due').replace('{count}', String(dueCount))
            });
        }
        if (blockedTasks.length > 0) {
            parts.push({
                key: 'waiting',
                tone: 'neutral',
                label: t('dashboard.band.waiting').replace('{count}', String(blockedTasks.length))
            });
        }
        return parts;
    }, [blockedTasks.length, overdueTasks.length, t, todayQueue.length]);

    const weekBadge = useMemo(() => {
        const current = completedLast7Days.length;
        const previous = completedPrevious7Days.length;
        if (current === 0) {
            return t('dashboard.week.none');
        }
        if (current > previous) {
            return t('dashboard.week.more')
                .replace('{count}', String(current))
                .replace('{diff}', String(current - previous));
        }
        if (current < previous) {
            return t('dashboard.week.fewer')
                .replace('{count}', String(current))
                .replace('{diff}', String(previous - current));
        }
        return t('dashboard.week.same').replace('{count}', String(current));
    }, [completedLast7Days.length, completedPrevious7Days.length, t]);

    // "Overnight": real movement from the last 24 hours.
    const nightEntries = useMemo<DashboardNightEntry[]>(() => {
        const dayAgo = Date.now() - DAY_MS;
        const todayStart = startOfToday().getTime();
        const entries: DashboardNightEntry[] = [];

        activeTasks.forEach((task) => {
            const completedMs = toMillis(task.completedAt);
            if (task.isCompleted && completedMs >= dayAgo) {
                const date = toDate(task.completedAt);
                entries.push({
                    key: `done:${task.id}`,
                    timeMs: completedMs,
                    time: date ? format(date, 'HH:mm') : '',
                    symbol: '✓',
                    tone: 'success',
                    text: task.title
                });
                return;
            }
            const createdMs = toMillis(task.createdAt);
            if (!task.isCompleted && createdMs >= dayAgo) {
                const date = toDate(task.createdAt);
                entries.push({
                    key: `new:${task.id}`,
                    timeMs: createdMs,
                    time: date ? format(date, 'HH:mm') : '',
                    symbol: '+',
                    tone: 'info',
                    text: task.title
                });
            }
        });

        overdueTasks.forEach((task) => {
            const due = toDate(task.dueDate)?.getTime() ?? 0;
            if (due >= todayStart - DAY_MS && due < todayStart) {
                entries.push({
                    key: `overdue:${task.id}`,
                    timeMs: todayStart,
                    time: '00:00',
                    symbol: '!',
                    tone: 'warning',
                    text: t('dashboard.night.becameOverdue').replace('{title}', task.title)
                });
            }
        });

        return entries.sort((a, b) => a.timeMs - b.timeMs).slice(-4);
    }, [activeTasks, overdueTasks, t]);

    // --- Portfolio pulse (step 2) and shared project diagnostics ------------

    const projectPulse = useMemo(() => {
        const now = Date.now();
        return activeProjects.map((project) => {
            const projectTasks = tasksByProject[project.id] || [];
            const open = projectTasks.filter((task) => !task.isCompleted);
            const overdue = open.filter((task) => isPastDue(task.dueDate));
            const blocked = open.filter((task) => task.status === 'Blocked');
            const health = projectHealthMap[project.id];
            const completedWeek = projectTasks.filter((task) => (
                task.isCompleted && toMillis(task.completedAt) >= now - (7 * DAY_MS)
            )).length;

            let lastActivity = 0;
            projectTasks.forEach((task) => {
                lastActivity = Math.max(lastActivity, toMillis(task.createdAt), toMillis(task.completedAt));
            });
            const stalledDays = lastActivity > 0 ? Math.floor((now - lastActivity) / DAY_MS) : null;

            const projectDue = toDate(project.dueDate)?.getTime();
            const deadlineDays = projectDue !== undefined && projectDue > now
                ? Math.ceil((projectDue - now) / DAY_MS)
                : null;

            const declining = health?.trend === 'declining';
            const critical = health?.status === 'critical';
            const warning = health?.status === 'warning';

            let score = (overdue.length * 3) + (blocked.length * 2);
            if (critical) score += 6;
            else if (warning) score += 3;
            if (declining) score += 3;
            if (stalledDays !== null && stalledDays >= 7 && open.length > 0) score += 3;
            if (deadlineDays !== null && deadlineDays <= 7 && open.length > 3) score += 2;

            const chips: DashboardAttentionChip[] = [];
            if (overdue.length > 0) {
                chips.push({ key: 'overdue', tone: 'danger', label: t('dashboard.pulse.chip.overdue').replace('{count}', String(overdue.length)) });
            }
            if (blocked.length > 0) {
                chips.push({ key: 'blocked', tone: 'danger', label: t('dashboard.pulse.chip.blocked').replace('{count}', String(blocked.length)) });
            }
            if (stalledDays !== null && stalledDays >= 7 && open.length > 0) {
                chips.push({ key: 'stalled', tone: 'warning', label: t('dashboard.pulse.chip.stalled').replace('{days}', String(stalledDays)) });
            }
            if (declining) {
                chips.push({ key: 'declining', tone: 'warning', label: t('dashboard.pulse.chip.declining') });
            } else if (critical) {
                chips.push({ key: 'critical', tone: 'danger', label: t('dashboard.pulse.chip.critical') });
            } else if (warning) {
                chips.push({ key: 'warning', tone: 'warning', label: t('dashboard.pulse.chip.warning') });
            }
            if (deadlineDays !== null && deadlineDays <= 14) {
                chips.push({ key: 'deadline', tone: 'info', label: t('dashboard.pulse.chip.deadline').replace('{days}', String(deadlineDays)) });
            }

            return {
                project,
                openCount: open.length,
                overdueCount: overdue.length,
                stalledDays,
                deadlineDays,
                completedWeek,
                score,
                chips: chips.slice(0, 3)
            };
        });
    }, [activeProjects, projectHealthMap, t, tasksByProject]);

    const projectsRail = useMemo(() => (
        projectPulse
            .filter((entry) => entry.openCount > 0)
            .sort((a, b) => b.openCount - a.openCount)
            .slice(0, 4)
    ), [projectPulse]);

    const projectRailSignal = (entry: typeof projectPulse[number]): { label: string; tone: DashboardTone } => {
        if (entry.overdueCount > 0) {
            return { label: t('dashboard.projectsRail.overdue').replace('{count}', String(entry.overdueCount)), tone: 'danger' };
        }
        if (entry.stalledDays !== null && entry.stalledDays >= 7) {
            return { label: t('dashboard.projectsRail.stalled').replace('{days}', String(entry.stalledDays)), tone: 'warning' };
        }
        return { label: t('dashboard.projectsRail.steady'), tone: 'neutral' };
    };

    const accentInsight = useMemo(() => {
        const stalled = projectPulse
            .filter((entry) => entry.stalledDays !== null && entry.stalledDays >= 7 && entry.openCount > 0)
            .sort((a, b) => (b.stalledDays || 0) - (a.stalledDays || 0))[0];
        if (stalled) {
            if (stalled.deadlineDays !== null) {
                return t('dashboard.accent.stalledDeadline')
                    .replace('{project}', stalled.project.title)
                    .replace('{deadline}', String(stalled.deadlineDays))
                    .replace('{days}', String(stalled.stalledDays));
            }
            return t('dashboard.accent.stalled')
                .replace('{project}', stalled.project.title)
                .replace('{days}', String(stalled.stalledDays));
        }
        const unlocker = [...openTasks]
            .filter((task) => (unblocksCount.get(task.id) || 0) > 0)
            .sort((a, b) => (unblocksCount.get(b.id) || 0) - (unblocksCount.get(a.id) || 0))[0];
        if (unlocker) {
            return t('dashboard.accent.unlock')
                .replace('{title}', unlocker.title)
                .replace('{count}', String(unblocksCount.get(unlocker.id) || 0));
        }
        return '';
    }, [openTasks, projectPulse, t, unblocksCount]);

    const attentionProjects = useMemo(
        () => projectPulse.filter((entry) => entry.score >= 3).sort((a, b) => b.score - a.score).slice(0, 3),
        [projectPulse]
    );

    const quietProjectCount = Math.max(activeProjects.length - attentionProjects.length, 0);

    const bestRunProject = useMemo(() => {
        const sorted = [...projectPulse].sort((a, b) => b.completedWeek - a.completedWeek);
        const best = sorted[0];
        return best && best.completedWeek > 0 ? best : null;
    }, [projectPulse]);

    const pulseStatement = useMemo<DashboardStatement>(() => {
        if (activeProjects.length === 0) {
            return {
                template: t('dashboard.pulse.statement.none'),
                value: t('dashboard.pulse.statement.noneValue')
            };
        }
        if (attentionProjects.length > 0) {
            const template = t(attentionProjects.length === 1 ? 'dashboard.pulse.statement.driftingOne' : 'dashboard.pulse.statement.drifting')
                .replace('{total}', String(activeProjects.length));
            return { template, value: String(attentionProjects.length) };
        }
        return {
            template: t(activeProjects.length === 1 ? 'dashboard.pulse.statement.steadyOne' : 'dashboard.pulse.statement.steady'),
            value: String(activeProjects.length)
        };
    }, [activeProjects.length, attentionProjects.length, t]);

    const pulseInsight = useMemo(() => {
        const worst = attentionProjects[0];
        if (worst && worst.chips.length > 0) {
            return t('dashboard.pulse.insight.worst')
                .replace('{project}', worst.project.title)
                .replace('{reasons}', worst.chips.map((chip) => chip.label).join(', '));
        }
        if (bestRunProject) {
            return t('dashboard.pulse.insight.bestRun')
                .replace('{project}', bestRunProject.project.title)
                .replace('{count}', String(bestRunProject.completedWeek));
        }
        return t('dashboard.pulse.insight.quietAll');
    }, [attentionProjects, bestRunProject, t]);

    const momentumCaption = useMemo(() => {
        const current = completedLast7Days.length;
        const previous = completedPrevious7Days.length;
        if (previous === 0 && current > 0) {
            return t('dashboard.pulse.momentum.firstWeek');
        }
        if (current > previous) {
            return t('dashboard.pulse.momentum.up').replace('{diff}', String(current - previous));
        }
        if (current < previous) {
            return t('dashboard.pulse.momentum.down').replace('{diff}', String(previous - current));
        }
        return t('dashboard.pulse.momentum.flat');
    }, [completedLast7Days.length, completedPrevious7Days.length, t]);

    const horizonItems = useMemo<DashboardRailListItem[]>(() => {
        const todayEnd = startOfToday().getTime() + DAY_MS;
        const horizon = todayEnd + (14 * DAY_MS);
        const dateLabel = (date: Date) => format(date, 'EEE d. MMM', { locale: dateLocale });

        const taskEntries = openTasks
            .map((task) => ({ task, due: toDate(task.dueDate) }))
            .filter((entry): entry is { task: Task; due: Date } => (
                entry.due !== null && entry.due.getTime() >= todayEnd && entry.due.getTime() < horizon
            ))
            .map(({ task, due }) => ({
                id: `task:${task.id}`,
                href: task.projectId ? `/project/${task.projectId}/tasks/${task.id}` : '/tasks',
                title: task.title,
                meta: `${dateLabel(due)} · ${projectById.get(task.projectId) || ''}`,
                tone: 'neutral' as DashboardTone,
                dateMs: due.getTime()
            }));

        const projectEntries = activeProjects
            .map((project) => ({ project, due: toDate(project.dueDate) }))
            .filter((entry): entry is { project: Project; due: Date } => (
                entry.due !== null && entry.due.getTime() >= todayEnd && entry.due.getTime() < horizon
            ))
            .map(({ project, due }) => ({
                id: `project:${project.id}`,
                href: `/project/${project.id}`,
                title: t('dashboard.pulse.horizon.projectDeadline').replace('{project}', project.title),
                meta: dateLabel(due),
                tone: 'info' as DashboardTone,
                dateMs: due.getTime()
            }));

        return [...taskEntries, ...projectEntries]
            .sort((a, b) => a.dateMs - b.dateMs)
            .slice(0, 4)
            .map(({ dateMs: _dateMs, ...item }) => item);
    }, [activeProjects, dateLocale, openTasks, projectById, t]);

    const winItems = useMemo(() => {
        const items: string[] = [];
        if (completedLast7Days.length > 0) {
            items.push(t('dashboard.pulse.wins.completedWeek').replace('{count}', String(completedLast7Days.length)));
        }
        if (bestRunProject) {
            items.push(
                t('dashboard.pulse.wins.bestProject')
                    .replace('{project}', bestRunProject.project.title)
                    .replace('{count}', String(bestRunProject.completedWeek))
            );
        }
        if (quietProjectCount > 0 && activeProjects.length > 0) {
            items.push(
                t(quietProjectCount === 1 ? 'dashboard.pulse.wins.quietProjectsOne' : 'dashboard.pulse.wins.quietProjects')
                    .replace('{count}', String(quietProjectCount))
            );
        }
        return items.slice(0, 3);
    }, [activeProjects.length, bestRunProject, completedLast7Days.length, quietProjectCount, t]);

    // Portfolio at a glance: the workspace in four numbers.
    const portfolioStats = useMemo(() => ([
        {
            key: 'projects',
            value: activeProjects.length,
            label: t('dashboard.pulse.stat.projects'),
            tone: 'neutral' as DashboardTone
        },
        {
            key: 'open',
            value: openTasks.length,
            label: t('dashboard.pulse.stat.open'),
            tone: 'neutral' as DashboardTone
        },
        {
            key: 'overdue',
            value: overdueTasks.length,
            label: t('dashboard.pulse.stat.overdue'),
            tone: 'danger' as DashboardTone
        },
        {
            key: 'doneWeek',
            value: completedLast7Days.length,
            label: t('dashboard.pulse.stat.doneWeek'),
            tone: 'success' as DashboardTone
        }
    ]), [activeProjects.length, completedLast7Days.length, openTasks.length, overdueTasks.length, t]);

    // Where the open work actually sits — volume per project, with bars.
    const workloadProjects = useMemo(
        () => projectPulse.filter((entry) => entry.openCount > 0).sort((a, b) => b.openCount - a.openCount).slice(0, 5),
        [projectPulse]
    );

    const maxWorkload = useMemo(
        () => Math.max(...workloadProjects.map((entry) => entry.openCount), 1),
        [workloadProjects]
    );

    const getStepTabIndex = (step: number) => activeDashboardStep === step ? undefined : -1;

    const handleStartDashboardFocus = (stop: DashboardRouteStop) => {
        if (!stop.focus) return;

        startFocusItem(stop.focus);

        if (!isModalOpen) {
            toggleModal();
        }
    };

    const todayIso = () => format(new Date(), 'yyyy-MM-dd');

    const handleToggleComplete = async (stop: DashboardRouteStop) => {
        if (!stop.taskId) return;
        const { taskId, projectId, tenantId } = stop;
        setTasks((prev) => prev.map((task) => (
            task.id === taskId ? { ...task, isCompleted: true, completedAt: new Date(), completedBy: authUserId || undefined } : task
        )));
        try {
            await toggleTaskStatus(taskId, false, projectId, tenantId);
        } catch (error) {
            console.error('Dashboard complete failed', error);
            setTasks((prev) => prev.map((task) => (
                task.id === taskId ? { ...task, isCompleted: false, completedAt: undefined, completedBy: undefined } : task
            )));
        }
    };

    const handleScheduleToday = async (stop: DashboardRouteStop) => {
        if (!stop.taskId) return;
        const { taskId, projectId, tenantId } = stop;
        const iso = todayIso();
        setTasks((prev) => prev.map((task) => (
            task.id === taskId ? { ...task, scheduledDate: iso } : task
        )));
        try {
            await updateTaskFields(taskId, { scheduledDate: iso }, projectId, tenantId);
        } catch (error) {
            console.error('Dashboard schedule failed', error);
            setTasks((prev) => prev.map((task) => (
                task.id === taskId ? { ...task, scheduledDate: undefined } : task
            )));
        }
    };

    if (loading || !dashboardTranslationsReady) {
        return (
            <div className="flex items-center justify-center p-12">
                <span className="material-symbols-outlined text-3xl dashboard-spinner">rotate_right</span>
            </div>
        );
    }

    return (
        <>
            <PasskeySetupModal
                isOpen={showPasskeyUpsell}
                onClose={() => setShowPasskeyUpsell(false)}
                onSetupComplete={() => setShowPasskeyUpsell(false)}
            />
            <div className="dashboard-page">
                <div
                    className="dashboard-stage"
                    ref={dashboardStageRef}
                    onScroll={(event) => {
                        event.currentTarget.scrollLeft = 0;
                        event.currentTarget.scrollTop = 0;
                    }}
                >
                    <div className={`dashboard-track ${activeDashboardStep === 1 ? 'dashboard-track--pulse' : ''}`}>
                        {/* Slide 1 — Today: day band + route to end of day. */}
                        <section
                            className="dashboard-slide"
                            aria-hidden={activeDashboardStep !== 0}
                        >
                            <div className="dashboard-today" data-onboarding-id="dashboard-header">
                                <div className="dashboard-today__top">
                                    <p>{todayLongLabel} · {greeting}, {userName || t('dashboard.userFallback')}</p>
                                    <p className="dashboard-today__week">{weekBadge}</p>
                                </div>

                                <h1 className="dashboard-today__headline">
                                    {renderDashboardStatement(routeStatement)}
                                </h1>
                                <p className="dashboard-today__cause">{causeLine}</p>

                                <div className="dashboard-band-wrap" data-onboarding-id="dashboard-kpis">
                                    <div className="dashboard-band" aria-hidden="true">
                                        {bandSegments.map((segment) => (
                                            <span
                                                key={segment.key}
                                                className={`dashboard-band__seg dashboard-band__seg--${segment.type}`}
                                                style={cssVars({ '--dashboard-seg-flex': String(segment.flex) })}
                                            />
                                        ))}
                                    </div>
                                    <div className="dashboard-band__caption">
                                        <p>
                                            {bandCaptionParts.length === 0
                                                ? t('dashboard.band.allFree')
                                                : bandCaptionParts.map((part, index) => (
                                                    <React.Fragment key={part.key}>
                                                        {index > 0 && <span className="dashboard-band__sep"> · </span>}
                                                        <span className={`dashboard-band__part dashboard-band__part--${part.tone}`}>{part.label}</span>
                                                    </React.Fragment>
                                                ))}
                                        </p>
                                        {bandCaptionParts.length > 0 && <p>{t('dashboard.band.free')}</p>}
                                    </div>
                                </div>

                                <div className={`dashboard-today__grid ${routeIsSuggested || dayShape === 'clear' || dayShape === 'waiting' ? 'dashboard-today__grid--calm' : ''}`}>
                                    <div className="dashboard-plan" aria-label={t('dashboard.route.title')}>
                                        <div className="dashboard-plan__head">
                                            <h2 className="dashboard-side-title">
                                                {routeIsSuggested ? t('dashboard.route.suggestTitle') : t('dashboard.route.title')}
                                            </h2>
                                            <button
                                                type="button"
                                                className="dashboard-plan__add"
                                                onClick={() => openTaskCreateModal(undefined, { allowProjectSelect: true })}
                                                tabIndex={getStepTabIndex(0)}
                                            >
                                                <span className="material-symbols-outlined">add</span>
                                                {t('dashboard.route.addTask')}
                                            </button>
                                        </div>
                                        {routeIsSuggested && (
                                            <p className="dashboard-plan__intro">{t('dashboard.route.suggestIntro')}</p>
                                        )}

                                        <div className="dashboard-plan__list">
                                            {routeStops.map((stop, index) => (
                                                <div
                                                    key={stop.id}
                                                    className={`dashboard-plan__item dashboard-plan__item--${stop.tone} ${index === 0 && !stop.proposed ? 'dashboard-plan__item--lead' : ''} ${stop.proposed ? 'dashboard-plan__item--proposed' : ''}`}
                                                >
                                                    <button
                                                        type="button"
                                                        className="dashboard-plan__check"
                                                        onClick={() => handleToggleComplete(stop)}
                                                        tabIndex={getStepTabIndex(0)}
                                                        aria-label={t('dashboard.route.complete')}
                                                        title={t('dashboard.route.complete')}
                                                    >
                                                        <span className="material-symbols-outlined">check</span>
                                                    </button>
                                                    <Link to={stop.href} className="dashboard-plan__copy" tabIndex={getStepTabIndex(0)}>
                                                        <span className="dashboard-plan__title">{stop.title}</span>
                                                        <span className="dashboard-plan__reason">
                                                            {stop.reason}{stop.meta ? ` · ${stop.meta}` : ''}
                                                        </span>
                                                    </Link>
                                                    <div className="dashboard-plan__actions">
                                                        {stop.proposed && stop.taskId && (
                                                            <button
                                                                type="button"
                                                                className="dashboard-plan__act"
                                                                onClick={() => handleScheduleToday(stop)}
                                                                tabIndex={getStepTabIndex(0)}
                                                                aria-label={t('dashboard.route.scheduleToday')}
                                                                title={t('dashboard.route.scheduleToday')}
                                                            >
                                                                <span className="material-symbols-outlined">event_available</span>
                                                            </button>
                                                        )}
                                                        {index === 0 && stop.focus && (
                                                            <button
                                                                type="button"
                                                                className={`dashboard-plan__act dashboard-plan__act--focus ${focusItemId === stop.focus.id ? 'is-active' : ''}`}
                                                                onClick={() => handleStartDashboardFocus(stop)}
                                                                tabIndex={getStepTabIndex(0)}
                                                                aria-label={focusItemId === stop.focus.id ? t('dashboard.resume.alreadyFocus') : t('dashboard.resume.focusAction')}
                                                                title={focusItemId === stop.focus.id ? t('dashboard.resume.alreadyFocus') : t('dashboard.resume.focusAction')}
                                                            >
                                                                <span className="material-symbols-outlined">
                                                                    {focusItemId === stop.focus.id ? 'center_focus_strong' : 'target'}
                                                                </span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {undatedOpenCount > 0 && (
                                            <Link to="/tasks" className="dashboard-plan__footer" tabIndex={getStepTabIndex(0)}>
                                                {t('dashboard.route.end.backlog').replace('{count}', String(undatedOpenCount))}
                                            </Link>
                                        )}
                                    </div>

                                    <aside className="dashboard-today__rail">
                                        <section aria-label={t('dashboard.thisWeek.title')}>
                                            <h2 className="dashboard-side-title">{t('dashboard.thisWeek.title')}</h2>
                                            <div className="dashboard-week" aria-hidden="true">
                                                {weekStrip.map((day) => (
                                                    <div
                                                        key={day.key}
                                                        className={`dashboard-week__day ${day.isToday ? 'is-today' : ''} ${day.isWeekend ? 'is-weekend' : ''} ${day.count > 0 ? 'has-work' : ''}`}
                                                    >
                                                        <span className="dashboard-week__label">{day.label}</span>
                                                        <span className="dashboard-week__num">{day.dayNum}</span>
                                                        <span className="dashboard-week__dot">{day.count > 0 ? day.count : ''}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="dashboard-week__caption">
                                                {weekStripTotal === 0
                                                    ? t('dashboard.thisWeek.empty')
                                                    : t('dashboard.thisWeek.count').replace('{count}', String(weekStripTotal))}
                                            </p>
                                        </section>

                                        <section aria-label={t('dashboard.night.title')}>
                                            <h2 className="dashboard-side-title">{t('dashboard.night.title')}</h2>
                                            {nightEntries.length === 0 ? (
                                                <p className="dashboard-editorial__empty">{t('dashboard.night.quiet')}</p>
                                            ) : (
                                                <div className="dashboard-night">
                                                    {nightEntries.map((entry) => (
                                                        <p key={entry.key} className="dashboard-night__entry">
                                                            <span className="dashboard-night__time">{entry.time}</span>
                                                            <span className={`dashboard-night__symbol dashboard-night__symbol--${entry.tone}`}>{entry.symbol}</span>
                                                            <span className="dashboard-night__text">{entry.text}</span>
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                        </section>

                                        <section aria-label={t('dashboard.projectsRail.title')}>
                                            <h2 className="dashboard-side-title">{t('dashboard.projectsRail.title')}</h2>
                                            {projectsRail.length === 0 ? (
                                                <p className="dashboard-editorial__empty">{t('dashboard.projectsRail.empty')}</p>
                                            ) : (
                                                <div className="dashboard-proj">
                                                    {projectsRail.map((entry) => {
                                                        const signal = projectRailSignal(entry);
                                                        return (
                                                            <Link
                                                                key={entry.project.id}
                                                                to={`/project/${entry.project.id}`}
                                                                className="dashboard-proj__row"
                                                                tabIndex={getStepTabIndex(0)}
                                                            >
                                                                <span className="dashboard-proj__name">{entry.project.title}</span>
                                                                <span className="dashboard-proj__meta">
                                                                    {t('dashboard.projectsRail.open').replace('{count}', String(entry.openCount))}
                                                                    {' · '}
                                                                    <i className={`dashboard-proj__signal dashboard-proj__signal--${signal.tone}`}>{signal.label}</i>
                                                                </span>
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </section>

                                        {accentInsight && (
                                            <p className="dashboard-accent">{accentInsight}</p>
                                        )}
                                    </aside>
                                </div>
                            </div>
                        </section>

                        {/* Slide 2 — Pulse: catch drift across the portfolio. */}
                        <section
                            className="dashboard-slide"
                            aria-label={t('dashboard.pulse.eyebrow')}
                            aria-hidden={activeDashboardStep !== 1}
                        >
                            <div className="dashboard-editorial">
                                <div className="dashboard-editorial__main">
                                    <p className="dashboard-editorial__eyebrow">{t('dashboard.pulse.eyebrow')}</p>
                                    <h1 className="dashboard-editorial__headline">
                                        {renderDashboardStatement(pulseStatement)}
                                    </h1>
                                    <p className="dashboard-editorial__insight">
                                        <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
                                        {pulseInsight}
                                    </p>

                                    <section className="dashboard-editorial__section" aria-label={t('dashboard.pulse.numbers.title')}>
                                        <div className="dashboard-pulse-stats">
                                            {portfolioStats.map((stat) => (
                                                <div key={stat.key} className={`dashboard-pulse-stat dashboard-pulse-stat--${stat.tone}`}>
                                                    <strong>{stat.value}</strong>
                                                    <span><i aria-hidden="true" />{stat.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="dashboard-editorial__section" aria-label={t('dashboard.pulse.attention.title')}>
                                        <h2 className="dashboard-editorial__section-title">{t('dashboard.pulse.attention.title')}</h2>
                                        {attentionProjects.length === 0 ? (
                                            <p className="dashboard-editorial__empty">{t('dashboard.pulse.attention.empty')}</p>
                                        ) : (
                                            <div className="dashboard-attention">
                                                {attentionProjects.map((entry) => (
                                                    <Link
                                                        key={entry.project.id}
                                                        to={`/project/${entry.project.id}`}
                                                        className="dashboard-attention__item"
                                                        tabIndex={getStepTabIndex(1)}
                                                    >
                                                        <strong>{entry.project.title}</strong>
                                                        <span className="dashboard-attention__chips">
                                                            {entry.chips.map((chip, index) => (
                                                                <span key={chip.key} className={`dashboard-attention__chip dashboard-attention__chip--${chip.tone}`}>
                                                                    {index > 0 && <i aria-hidden="true">·</i>}
                                                                    {chip.label}
                                                                </span>
                                                            ))}
                                                        </span>
                                                        <span className="material-symbols-outlined dashboard-attention__arrow" aria-hidden="true">arrow_forward</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                        {quietProjectCount > 0 && attentionProjects.length > 0 && (
                                            <p className="dashboard-attention__quiet">
                                                {t(quietProjectCount === 1 ? 'dashboard.pulse.attention.quietOne' : 'dashboard.pulse.attention.quiet')
                                                    .replace('{count}', String(quietProjectCount))}
                                            </p>
                                        )}
                                    </section>

                                    <section className="dashboard-editorial__section" aria-label={t('dashboard.pulse.momentum.title')}>
                                        <h2 className="dashboard-editorial__section-title">{t('dashboard.pulse.momentum.title')}</h2>
                                        <div className="dashboard-momentum">
                                            <div className="dashboard-momentum__figure">
                                                <strong>{completedLast7Days.length}</strong>
                                                <span>{t('dashboard.pulse.momentum.completed')}</span>
                                                <small>{momentumCaption}</small>
                                            </div>
                                            <div className="dashboard-momentum__chart" aria-hidden="true">
                                                {completionTrend.map((day) => (
                                                    <span
                                                        key={day.date.toISOString()}
                                                        className="dashboard-momentum__bar"
                                                        style={cssVars({ '--dashboard-bar-height': `${Math.max(5, (day.value / maxCompletionValue) * 100)}%` })}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                <aside className="dashboard-rail">
                                    <section className="dashboard-rail-block" aria-label={t('dashboard.pulse.workload.title')}>
                                        <h3>
                                            <span className="material-symbols-outlined" aria-hidden="true">stacked_bar_chart</span>
                                            {t('dashboard.pulse.workload.title')}
                                        </h3>
                                        {workloadProjects.length === 0 ? (
                                            <p className="dashboard-editorial__empty">{t('dashboard.pulse.workload.empty')}</p>
                                        ) : (
                                            <div className="dashboard-workload">
                                                {workloadProjects.map((entry) => (
                                                    <Link
                                                        key={entry.project.id}
                                                        to={`/project/${entry.project.id}`}
                                                        className="dashboard-workload__row"
                                                        tabIndex={getStepTabIndex(1)}
                                                    >
                                                        <span className="dashboard-workload__name">{entry.project.title}</span>
                                                        <span className="dashboard-workload__count">{entry.openCount}</span>
                                                        <span className="dashboard-workload__bar" aria-hidden="true">
                                                            <i style={cssVars({ '--dashboard-bar-width': `${(entry.openCount / maxWorkload) * 100}%` })} />
                                                        </span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    <section className="dashboard-rail-block" aria-label={t('dashboard.pulse.horizon.title')}>
                                        <h3>
                                            <span className="material-symbols-outlined" aria-hidden="true">event_upcoming</span>
                                            {t('dashboard.pulse.horizon.title')}
                                        </h3>
                                        {horizonItems.length === 0 ? (
                                            <p className="dashboard-editorial__empty">{t('dashboard.pulse.horizon.empty')}</p>
                                        ) : (
                                            <div className="dashboard-rail-list">
                                                {horizonItems.map((item) => (
                                                    <Link key={item.id} to={item.href} className="dashboard-rail-list__item" tabIndex={getStepTabIndex(1)}>
                                                        <strong>{item.title}</strong>
                                                        <small>{item.meta}</small>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    <section className="dashboard-rail-block" aria-label={t('dashboard.pulse.wins.title')}>
                                        <h3>
                                            <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
                                            {t('dashboard.pulse.wins.title')}
                                        </h3>
                                        {winItems.length === 0 ? (
                                            <p className="dashboard-editorial__empty">{t('dashboard.pulse.wins.empty')}</p>
                                        ) : (
                                            <div className="dashboard-insights">
                                                {winItems.map((win, index) => (
                                                    <p key={index} className="dashboard-insights__item">
                                                        <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                                                        {win}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                </aside>
                            </div>
                        </section>
                    </div>
                    <button
                        type="button"
                        className="dashboard-stage__nav"
                        onClick={() => setActiveDashboardStep((step) => (step === 0 ? 1 : 0))}
                        aria-label={activeDashboardStep === 0 ? t('dashboard.nav.toPulse') : t('dashboard.nav.toToday')}
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">
                            {activeDashboardStep === 0 ? 'arrow_forward' : 'arrow_back'}
                        </span>
                    </button>
                </div>
            </div>
            <OnboardingWelcomeModal
                isOpen={showOnboardingWelcome}
                title={t('onboarding.dashboard.welcome.title')}
                description={t('onboarding.dashboard.welcome.description')}
                onStart={handleStartOnboarding}
                onSkip={handleSkipOnboarding}
            />
            <OnboardingOverlay
                isOpen={onboardingActive}
                steps={onboardingSteps}
                stepIndex={onboardingStepIndex}
                onStepChange={setOnboardingStepIndex}
                onFinish={handleFinishOnboarding}
                onSkip={handleSkipOnboarding}
            />
        </>
    );
};
