import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { auth } from '../services/firebase';
import { getAllWorkspaceProjects } from '../services/dataService';
import { ensureActiveTenantId } from '../services/domain/authService';
import { getWorkspaceInitiatives } from '../services/domain/initiativesService';
import { getSharedProjects, getUserProjects } from '../services/domain/projectsService';
import { getUserTasksForProjects } from '../services/domain/tasksService';
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
import type { PinnedItem } from '../context/PinnedTasksContext';
import { checkPasskeyExists } from '../services/passkeyService';
import { PasskeySetupModal } from '../components/modals/PasskeySetupModal';

type DashboardCommandTone = 'danger' | 'warning' | 'info' | 'neutral';

interface DashboardCommandItem {
    id: string;
    href: string;
    icon: string;
    label: string;
    meta: string;
    focus?: PinnedItem;
    priority: number;
    title: string;
    tone: DashboardCommandTone;
}

type DashboardStepTone = 'danger' | 'warning' | 'info' | 'success' | 'neutral';

const cssVars = (vars: Record<string, string>) => vars as React.CSSProperties;

const clampDashboardProgress = (value: number) => Math.max(0, Math.min(1, value));

const smoothDashboardProgress = (value: number, start: number, end: number) => {
    const x = clampDashboardProgress((value - start) / (end - start));
    return x * x * (3 - (2 * x));
};

const getScrollContainer = (node: HTMLElement): HTMLElement | Window => {
    let parent = node.parentElement;

    while (parent) {
        const style = window.getComputedStyle(parent);
        const overflow = `${style.overflow} ${style.overflowY} ${style.overflowX}`;
        if (/(auto|scroll|overlay)/.test(overflow) && parent.scrollHeight > parent.clientHeight) {
            return parent;
        }
        parent = parent.parentElement;
    }

    return window;
};

const getScrollTop = (container: HTMLElement | Window) => {
    if (container instanceof Window) {
        return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }

    return container.scrollTop;
};

const getScrollViewportHeight = (container: HTMLElement | Window) => (
    container instanceof Window ? window.innerHeight : container.clientHeight
);

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

const bucketByDay = (items: { createdAt?: any }[], days = 7) => {
    const buckets = Array.from({ length: days }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - index - 1));
        date.setHours(0, 0, 0, 0);
        return { date, value: 0 };
    });
    const firstDay = buckets[0]?.date.getTime() ?? Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    items.forEach((item) => {
        const createdAt = toDate(item.createdAt);
        if (!createdAt) return;
        const normalized = new Date(createdAt);
        normalized.setHours(0, 0, 0, 0);
        const index = Math.floor((normalized.getTime() - firstDay) / dayMs);
        if (index >= 0 && index < buckets.length) {
            buckets[index].value += 1;
        }
    });

    return buckets;
};

export const Dashboard = () => {
    const { isAuthReady, user } = useAuth();
    const { t, language, dateFormat, dateLocale, dashboardTranslationsReady, loadDashboardTranslations } = useLanguage();
    const { startFocusItem, toggleModal, focusItemId, focusItem, focusState, isModalOpen } = usePinnedTasks();
    const [authUserId, setAuthUserId] = useState<string | null>(() => auth.currentUser?.uid ?? null);
    const [userName, setUserName] = useState<string>('');
    const [greeting, setGreeting] = useState<string>(() => t('dashboard.greeting.default'));
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [initiatives, setInitiatives] = useState<Initiative[]>([]);
    const [showWorkspaceInsights, setShowWorkspaceInsights] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showPasskeyUpsell, setShowPasskeyUpsell] = useState(false);
    const [dashboardScrollProgress, setDashboardScrollProgress] = useState(0);
    const dashboardStageRef = useRef<HTMLDivElement | null>(null);
    const dashboardTouchYRef = useRef<number | null>(null);

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
                setIdeas([]);
                setIssues([]);

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

    useEffect(() => {
        if (loading || !dashboardTranslationsReady) return;

        const stage = dashboardStageRef.current;
        if (!stage) return;

        let frame = 0;
        const scrollContainer = getScrollContainer(stage);
        const scrollStart = getScrollTop(scrollContainer);

        const updateProgress = () => {
            const range = Math.max(getScrollViewportHeight(scrollContainer) * 1.75, 1120);
            const nextProgress = clampDashboardProgress((getScrollTop(scrollContainer) - scrollStart) / range);

            setDashboardScrollProgress((current) => (
                Math.abs(current - nextProgress) < 0.01 ? current : nextProgress
            ));
        };

        const scheduleUpdate = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(updateProgress);
        };

        updateProgress();
        scrollContainer.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', scheduleUpdate);

        return () => {
            window.cancelAnimationFrame(frame);
            scrollContainer?.removeEventListener('scroll', scheduleUpdate);
            window.removeEventListener('resize', scheduleUpdate);
        };
    }, [dashboardTranslationsReady, loading]);

    const handleDashboardWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        const delta = event.deltaY / 1500;
        if (!Number.isFinite(delta) || Math.abs(delta) < 0.002) return;

        setDashboardScrollProgress((current) => clampDashboardProgress(current + delta));
    };

    const handleDashboardTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
        dashboardTouchYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleDashboardTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
        const nextY = event.touches[0]?.clientY;
        const previousY = dashboardTouchYRef.current;
        if (nextY === undefined || previousY === null) return;

        dashboardTouchYRef.current = nextY;
        setDashboardScrollProgress((current) => clampDashboardProgress(current + (previousY - nextY) / 1120));
    };

    const handleDashboardTouchEnd = () => {
        dashboardTouchYRef.current = null;
    };

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

    const allProjectsAtRisk = useMemo(() => {
        return activeProjects
            .map((project) => ({ project, health: projectHealthMap[project.id] }))
            .filter((entry) => entry.health?.status === 'warning' || entry.health?.status === 'critical')
            .sort((a, b) => a.health.score - b.health.score);
    }, [activeProjects, projectHealthMap]);

    const projectsAtRisk = useMemo(() => allProjectsAtRisk.slice(0, 2), [allProjectsAtRisk]);

    const overdueTasks = useMemo(
        () => activeTasks.filter((task) => !task.isCompleted && isPastDue(task.dueDate)),
        [activeTasks]
    );

    const dueTodayTasks = useMemo(
        () => activeTasks.filter((task) => !task.isCompleted && isToday(task.dueDate)),
        [activeTasks]
    );

    const scheduledTodayTasks = useMemo(
        () => activeTasks.filter((task) => !task.isCompleted && isToday(task.scheduledDate)),
        [activeTasks]
    );

    const blockedTasks = useMemo(
        () => activeTasks.filter((task) => !task.isCompleted && task.status === 'Blocked'),
        [activeTasks]
    );

    const openTasksCount = useMemo(
        () => activeTasks.filter((task) => !task.isCompleted).length,
        [activeTasks]
    );

    const activeProjectsCount = useMemo(
        () => activeProjects.length,
        [activeProjects.length]
    );

    const taskTrend = useMemo(() => bucketByDay(activeTasks), [activeTasks]);

    const maxVelocityValue = useMemo(
        () => Math.max(...taskTrend.map((item) => item.value), 1),
        [taskTrend]
    );

    const dashboardMetrics = useMemo(() => ([
        {
            key: 'openTasks',
            href: '/tasks',
            icon: 'checklist',
            label: t('dashboard.expanded.metric.openTasks'),
            value: openTasksCount
        },
        {
            key: 'activeProjects',
            href: '/projects',
            icon: 'folder_open',
            label: t('dashboard.expanded.metric.activeProjects'),
            value: activeProjectsCount
        },
        {
            key: 'risk',
            href: '/projects',
            icon: 'warning',
            label: t('dashboard.expanded.metric.risk'),
            value: allProjectsAtRisk.length
        }
    ]), [activeProjectsCount, allProjectsAtRisk.length, openTasksCount, t]);

    const projectHealthSummary = useMemo(() => {
        return activeProjects.reduce((summary, project) => {
            const health = projectHealthMap[project.id];
            if (health?.status === 'critical') {
                summary.risk += 1;
            } else if (health?.status === 'warning') {
                summary.watch += 1;
            } else {
                summary.healthy += 1;
            }
            return summary;
        }, { healthy: 0, watch: 0, risk: 0 });
    }, [activeProjects, projectHealthMap]);

    const totalVelocity = useMemo(
        () => taskTrend.reduce((sum, item) => sum + item.value, 0),
        [taskTrend]
    );

    const focusTasks = useMemo(() => {
        return [...activeTasks]
            .filter((task) => !task.isCompleted)
            .sort((a, b) => {
                const aDue = toDate(a.dueDate || a.scheduledDate)?.getTime() ?? Number.POSITIVE_INFINITY;
                const bDue = toDate(b.dueDate || b.scheduledDate)?.getTime() ?? Number.POSITIVE_INFINITY;
                if (aDue !== bDue) return aDue - bDue;
                return toMillis(b.createdAt) - toMillis(a.createdAt);
            })
            .slice(0, 3);
    }, [activeTasks]);

    const todayLongLabel = useMemo(
        () => format(new Date(), 'PPPP', { locale: dateLocale }),
        [dateLocale, language]
    );

    const taskPriorityLabels = useMemo(() => ({
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low')
    }), [t]);

    const formatShortDate = (value?: any) => {
        const date = toDate(value);
        return date ? format(date, dateFormat, { locale: dateLocale }) : '';
    };

    const formatCommandDueLabel = (value?: any) => {
        const date = toDate(value);
        if (!date) return t('dashboard.command.noDate');

        const todayStart = startOfToday();
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(todayStart.getDate() + 1);
        const nextDayStart = new Date(tomorrowStart);
        nextDayStart.setDate(tomorrowStart.getDate() + 1);

        if (date.getTime() < todayStart.getTime()) {
            return t('dashboard.command.dueDate').replace('{date}', formatShortDate(date));
        }
        if (date.getTime() < tomorrowStart.getTime()) {
            return t('dashboard.command.dueToday');
        }
        if (date.getTime() < nextDayStart.getTime()) {
            return t('dashboard.command.dueTomorrow');
        }
        return t('dashboard.command.dueDate').replace('{date}', formatShortDate(date));
    };

    const commandItems = useMemo<DashboardCommandItem[]>(() => {
        const items: DashboardCommandItem[] = [];
        const seen = new Set<string>();
        const projectLabel = (projectId?: string) => (
            projectId ? (projectById.get(projectId) || t('dashboard.issues.unknownProject')) : t('dashboard.issues.unknownProject')
        );
        const taskHref = (task: Task) => task.projectId ? `/project/${task.projectId}/tasks/${task.id}` : '/tasks';
        const taskMeta = (task: Task) => `${projectLabel(task.projectId)} - ${formatCommandDueLabel(task.dueDate || task.scheduledDate)}`;
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
        const sortedByDue = (items: Task[]) => [...items].sort((a, b) => {
            const aDue = toDate(a.dueDate || a.scheduledDate)?.getTime() ?? Number.POSITIVE_INFINITY;
            const bDue = toDate(b.dueDate || b.scheduledDate)?.getTime() ?? Number.POSITIVE_INFINITY;
            if (aDue !== bDue) return aDue - bDue;
            return toMillis(b.createdAt) - toMillis(a.createdAt);
        });

        const addTask = (task: Task, label: string, tone: DashboardCommandTone, icon: string, priority: number, meta?: string) => {
            const key = `task:${task.id}`;
            if (seen.has(key)) return;
            seen.add(key);
            items.push({
                id: key,
                href: taskHref(task),
                icon,
                label,
                meta: meta || taskMeta(task),
                focus: taskFocus(task),
                priority,
                title: task.title,
                tone
            });
        };

        sortedByDue(overdueTasks).slice(0, 2).forEach((task) => {
            addTask(task, t('dashboard.command.tag.overdue'), 'danger', 'event_busy', 10);
        });

        sortedByDue(dueTodayTasks).slice(0, 3).forEach((task) => {
            addTask(task, t('dashboard.command.tag.dueToday'), 'warning', 'today', 20);
        });

        sortedByDue(scheduledTodayTasks).slice(0, 2).forEach((task) => {
            addTask(
                task,
                t('dashboard.command.tag.scheduledToday'),
                'info',
                'event_available',
                24,
                `${projectLabel(task.projectId)} - ${t('dashboard.command.scheduledToday')}`
            );
        });

        sortedByDue(blockedTasks).slice(0, 2).forEach((task) => {
            addTask(task, t('dashboard.command.tag.blocked'), 'danger', 'block', 30);
        });

        projectsAtRisk.forEach(({ project, health }) => {
            const key = `project:${project.id}`;
            if (seen.has(key)) return;
            seen.add(key);
            const openTasks = (tasksByProject[project.id] || []).filter((task) => !task.isCompleted).length;
            items.push({
                id: key,
                href: `/project/${project.id}`,
                icon: health.status === 'critical' ? 'release_alert' : 'warning',
                label: t('dashboard.command.tag.projectRisk'),
                meta: t('dashboard.command.projectRiskMeta')
                    .replace('{score}', String(health.score))
                    .replace('{count}', String(openTasks)),
                priority: 45,
                title: project.title,
                tone: health.status === 'critical' ? 'danger' : 'warning'
            });
        });

        focusTasks.forEach((task) => {
            addTask(task, t('dashboard.command.tag.upcoming'), 'neutral', 'radio_button_unchecked', 80);
        });

        return items.sort((a, b) => a.priority - b.priority).slice(0, 4);
    }, [
        blockedTasks,
        dueTodayTasks,
        focusTasks,
        overdueTasks,
        projectById,
        projectsAtRisk,
        scheduledTodayTasks,
        t,
        tasksByProject
    ]);

    const isFocusSnoozed = useMemo(() => (
        focusState?.status === 'snoozed'
            && Boolean(focusState.snoozedUntil)
            && new Date(focusState.snoozedUntil || '').getTime() > Date.now()
    ), [focusState?.snoozedUntil, focusState?.status]);

    const focusResumeItem = useMemo<DashboardCommandItem | null>(() => {
        if (!focusItem || !focusItem.projectId) return null;
        if (!activeProjectIds.has(focusItem.projectId)) return null;

        const status = isFocusSnoozed ? 'snoozed' : focusState?.status || 'active';
        const focusPath = focusItem.type === 'initiative' ? 'initiatives' : 'tasks';
        return {
            id: `focus:${focusItem.id}`,
            href: `/project/${focusItem.projectId}/${focusPath}/${focusItem.id}`,
            icon: status === 'blocked' ? 'block' : status === 'snoozed' ? 'snooze' : 'center_focus_strong',
            label: status === 'blocked'
                ? t('dashboard.command.tag.blockedFocus')
                : status === 'snoozed'
                    ? t('dashboard.command.tag.snoozedFocus')
                    : t('dashboard.command.tag.currentFocus'),
            meta: projectById.get(focusItem.projectId) || t('dashboard.issues.unknownProject'),
            focus: focusItem,
            priority: status === 'blocked' ? 5 : 0,
            title: focusItem.title,
            tone: status === 'blocked' ? 'danger' : status === 'snoozed' ? 'neutral' : 'info'
        };
    }, [activeProjectIds, focusItem, focusState?.status, isFocusSnoozed, projectById, t]);

    const primaryCommandItems = useMemo(() => {
        const merged = focusResumeItem
            ? [focusResumeItem, ...commandItems.filter((item) => item.focus?.id !== focusResumeItem.focus?.id)]
            : commandItems;
        return merged.slice(0, 3);
    }, [commandItems, focusResumeItem]);
    const primaryResumeItem = primaryCommandItems[0];

    const dueNowCount = overdueTasks.length + dueTodayTasks.length + scheduledTodayTasks.length;
    const blockersCount = blockedTasks.length;

    const commandSummaryItems = useMemo(() => ([
        {
            key: 'dueNow',
            icon: dueNowCount > 0 ? 'event_busy' : 'event_available',
            label: t('dashboard.step.now.summary.dueNow'),
            tone: overdueTasks.length > 0 ? 'danger' : 'warning',
            value: dueNowCount
        },
        {
            key: 'blockers',
            icon: blockersCount > 0 ? 'block' : 'check_circle',
            label: t('dashboard.step.now.summary.blockers'),
            tone: blockersCount > 0 ? 'danger' : 'success',
            value: blockersCount
        },
        {
            key: 'risk',
            icon: allProjectsAtRisk.length > 0 ? 'warning' : 'shield',
            label: t('dashboard.step.now.summary.risk'),
            tone: allProjectsAtRisk.length > 0 ? 'warning' : 'success',
            value: allProjectsAtRisk.length
        }
    ] as Array<{
        key: string;
        icon: string;
        label: string;
        tone: DashboardStepTone;
        value: number;
    }>), [
        allProjectsAtRisk.length,
        blockersCount,
        dueNowCount,
        overdueTasks.length,
        t
    ]);

    const todayWorkloadItems = useMemo(() => ([
        {
            key: 'dueNow',
            label: t('dashboard.step.today.workload.dueNow'),
            tone: overdueTasks.length > 0 ? 'danger' : 'warning',
            value: dueNowCount
        },
        {
            key: 'open',
            label: t('dashboard.step.today.workload.open'),
            tone: 'neutral',
            value: openTasksCount
        },
        {
            key: 'blockers',
            label: t('dashboard.step.today.workload.blockers'),
            tone: blockersCount > 0 ? 'danger' : 'success',
            value: blockersCount
        },
    ] as Array<{
        key: string;
        label: string;
        tone: DashboardStepTone;
        value: number;
    }>), [
        blockersCount,
        dueNowCount,
        openTasksCount,
        overdueTasks.length,
        t
    ]);

    const todayPlanLabels = useMemo(() => [
        t('dashboard.step.today.route.start'),
        t('dashboard.step.today.route.next'),
        t('dashboard.step.today.route.after')
    ], [t]);

    const todayPlanItems = useMemo(() => (
        primaryCommandItems.map((item, index) => ({
            ...item,
            stepLabel: todayPlanLabels[index] || t('dashboard.command.tag.upcoming')
        }))
    ), [primaryCommandItems, t, todayPlanLabels]);

    const maxTodayWorkloadValue = useMemo(
        () => Math.max(...todayWorkloadItems.map((item) => item.value), 1),
        [todayWorkloadItems]
    );

    const workloadProjectItems = useMemo(() => {
        return activeProjects
            .map((project) => ({
                health: projectHealthMap[project.id],
                openTasks: (tasksByProject[project.id] || []).filter((task) => !task.isCompleted).length,
                project
            }))
            .filter((item) => item.openTasks > 0)
            .sort((a, b) => {
                const scoreA = a.health?.score ?? 100;
                const scoreB = b.health?.score ?? 100;
                if (scoreA !== scoreB) return scoreA - scoreB;
                return b.openTasks - a.openTasks;
            })
            .slice(0, 3);
    }, [activeProjects, projectHealthMap, tasksByProject]);

    const todayWatchProject = workloadProjectItems[0];

    const healthTotal = Math.max(projectHealthSummary.healthy + projectHealthSummary.watch + projectHealthSummary.risk, 1);
    const portfolioHealthSegments = useMemo(() => ([
        {
            key: 'healthy',
            label: t('dashboard.expanded.health.healthy'),
            tone: 'success',
            value: projectHealthSummary.healthy
        },
        {
            key: 'watch',
            label: t('dashboard.expanded.health.watch'),
            tone: 'warning',
            value: projectHealthSummary.watch
        },
        {
            key: 'risk',
            label: t('dashboard.expanded.health.risk'),
            tone: 'danger',
            value: projectHealthSummary.risk
        }
    ] as Array<{
        key: string;
        label: string;
        tone: DashboardStepTone;
        value: number;
    }>), [projectHealthSummary.healthy, projectHealthSummary.risk, projectHealthSummary.watch, t]);

    const dashboardScrollStyle = useMemo(() => {
        const greetingExit = smoothDashboardProgress(dashboardScrollProgress, 0.12, 0.30);
        const todayEnter = smoothDashboardProgress(dashboardScrollProgress, 0.24, 0.42);
        const todayExit = smoothDashboardProgress(dashboardScrollProgress, 0.58, 0.74);
        const portfolioEnter = smoothDashboardProgress(dashboardScrollProgress, 0.66, 0.84);

        const greetingOpacity = 1 - greetingExit;
        const todayOpacity = todayEnter * (1 - todayExit);
        const portfolioOpacity = portfolioEnter;

        return cssVars({
            '--dashboard-greeting-opacity': greetingOpacity.toFixed(3),
            '--dashboard-greeting-transform': `translate3d(0, ${(-70 * greetingExit).toFixed(1)}px, 0) scale(${(1 - (greetingExit * 0.035)).toFixed(3)})`,
            '--dashboard-today-opacity': todayOpacity.toFixed(3),
            '--dashboard-today-transform': `translate3d(0, ${(54 * (1 - todayEnter) - (42 * todayExit)).toFixed(1)}px, 0) scale(${(0.985 + (0.015 * todayEnter) - (0.012 * todayExit)).toFixed(3)})`,
            '--dashboard-portfolio-opacity': portfolioOpacity.toFixed(3),
            '--dashboard-portfolio-transform': `translate3d(0, ${(54 * (1 - portfolioEnter)).toFixed(1)}px, 0) scale(${(0.985 + (0.015 * portfolioEnter)).toFixed(3)})`
        });
    }, [dashboardScrollProgress]);

    const activeDashboardStep = dashboardScrollProgress < 0.34
        ? 0
        : dashboardScrollProgress < 0.68
            ? 1
            : 2;

    const getStepTabIndex = (step: number) => activeDashboardStep === step ? undefined : -1;

    const handleStartDashboardFocus = (item: DashboardCommandItem) => {
        if (!item.focus) return;

        startFocusItem(item.focus);

        if (!isModalOpen) {
            toggleModal();
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
                    ref={dashboardStageRef}
                    className="dashboard-scroll-stage"
                    onTouchCancel={handleDashboardTouchEnd}
                    onTouchEnd={handleDashboardTouchEnd}
                    onTouchMove={handleDashboardTouchMove}
                    onTouchStart={handleDashboardTouchStart}
                    onWheel={handleDashboardWheel}
                    style={dashboardScrollStyle}
                >
                    <div className="dashboard-scroll-viewport">
                        <div className="dashboard-step-rail" aria-hidden="true">
                            {[0, 1, 2].map((step) => (
                                <span key={step} className={activeDashboardStep === step ? 'is-active' : ''} />
                            ))}
                        </div>

                        <section
                            className={`dashboard-step-layer dashboard-greeting-layer ${activeDashboardStep === 0 ? 'is-active' : ''}`}
                            aria-hidden={activeDashboardStep !== 0}
                        >
                            <div data-onboarding-id="dashboard-header" className="dashboard-command-hero">
                                <p className="dashboard-command-hero__date">{todayLongLabel}</p>
                                <h1 className="dashboard-command-hero__title">
                                    {greeting}, {userName || t('dashboard.userFallback')}.
                                </h1>

                                <div className={`dashboard-resume-card ${primaryResumeItem ? `dashboard-resume-card--${primaryResumeItem.tone}` : 'dashboard-resume-card--empty'}`}>
                                    <span className="material-symbols-outlined dashboard-resume-card__icon">
                                        {primaryResumeItem?.icon || 'check_circle'}
                                    </span>
                                    <div className="dashboard-resume-card__content">
                                        <p>{t('dashboard.resume.eyebrow')}</p>
                                        <h2>{primaryResumeItem?.title || t('dashboard.resume.emptyTitle')}</h2>
                                        <span>
                                            {primaryResumeItem
                                                ? t('dashboard.resume.meta')
                                                    .replace('{label}', primaryResumeItem.label)
                                                    .replace('{meta}', primaryResumeItem.meta)
                                                : t('dashboard.resume.emptyBody')}
                                        </span>
                                    </div>
                                    <div className="dashboard-resume-card__actions">
                                        {primaryResumeItem?.focus && (
                                            <button
                                                type="button"
                                                className="dashboard-resume-action dashboard-resume-action--primary"
                                                onClick={() => handleStartDashboardFocus(primaryResumeItem)}
                                                tabIndex={getStepTabIndex(0)}
                                            >
                                                <span className="material-symbols-outlined">target</span>
                                                {focusItemId === primaryResumeItem.focus.id
                                                    ? t('dashboard.resume.alreadyFocus')
                                                    : t('dashboard.resume.focusAction')}
                                            </button>
                                        )}
                                        {primaryResumeItem && (
                                            <Link
                                                to={primaryResumeItem.href}
                                                className="dashboard-resume-action"
                                                tabIndex={getStepTabIndex(0)}
                                            >
                                                {t('dashboard.resume.openAction')}
                                                <span className="material-symbols-outlined">arrow_forward</span>
                                            </Link>
                                        )}
                                    </div>
                                </div>

                                <div data-onboarding-id="dashboard-kpis" className="dashboard-hero-priority" aria-label={t('dashboard.step.now.title')}>
                                    <div className="dashboard-hero-priority__header">
                                        <h2>{t('dashboard.step.now.title')}</h2>
                                        <Link to="/tasks" className="dashboard-step-link" tabIndex={getStepTabIndex(0)}>
                                            {t('dashboard.command.openTasks')}
                                            <span className="material-symbols-outlined">arrow_forward</span>
                                        </Link>
                                    </div>

                                    <div className="dashboard-hero-priority__body">
                                        <div className="dashboard-hero-command-list">
                                            {primaryCommandItems.length === 0 ? (
                                                <div className="dashboard-command-empty">
                                                    <span className="material-symbols-outlined">check_circle</span>
                                                    <div>
                                                        <h3>{t('dashboard.command.empty.title')}</h3>
                                                        <p>{t('dashboard.command.empty.body')}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                primaryCommandItems.map((item) => (
                                                    <Link
                                                        key={item.id}
                                                        to={item.href}
                                                        className={`dashboard-command-item dashboard-command-item--hero dashboard-command-item--${item.tone}`}
                                                        tabIndex={getStepTabIndex(0)}
                                                    >
                                                        <span className="material-symbols-outlined dashboard-command-item__icon">{item.icon}</span>
                                                        <div className="dashboard-command-item__content">
                                                            <div className="dashboard-command-item__header">
                                                                <span className="dashboard-command-item__label">{item.label}</span>
                                                                <span className="dashboard-command-item__meta">{item.meta}</span>
                                                            </div>
                                                            <p>{item.title}</p>
                                                        </div>
                                                        <span className="material-symbols-outlined dashboard-command-item__arrow">chevron_right</span>
                                                    </Link>
                                                ))
                                            )}
                                        </div>

                                        <div className="dashboard-hero-signals">
                                            {commandSummaryItems.map((item) => (
                                                <div key={item.key} className={`dashboard-signal dashboard-signal--compact dashboard-signal--${item.tone}`}>
                                                    <span className="material-symbols-outlined">{item.icon}</span>
                                                    <strong>{item.value}</strong>
                                                    <p>{item.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section
                            className={`dashboard-step-layer dashboard-today-layer ${activeDashboardStep === 1 ? 'is-active' : ''}`}
                            aria-label={t('dashboard.step.today.title')}
                            aria-hidden={activeDashboardStep !== 1}
                        >
                            <div className="dashboard-step-panel dashboard-step-panel--today">
                                <div className="dashboard-step-header dashboard-step-header--split">
                                    <div>
                                        <p>{t('dashboard.step.today.subtitle')}</p>
                                        <h2>{t('dashboard.step.today.title')}</h2>
                                    </div>
                                    <Link to="/tasks" className="dashboard-step-link" tabIndex={getStepTabIndex(1)}>
                                        {t('dashboard.step.today.viewTasks')}
                                        <span className="material-symbols-outlined">arrow_forward</span>
                                    </Link>
                                </div>

                                <div className="dashboard-today-plan">
                                    <section className="dashboard-today-route" aria-label={t('dashboard.step.today.route.title')}>
                                        <div className="dashboard-today-route__header">
                                            <p>{t('dashboard.step.today.route.subtitle')}</p>
                                            <h3>{t('dashboard.step.today.route.title')}</h3>
                                        </div>

                                        {todayPlanItems.length === 0 ? (
                                            <div className="dashboard-today-route__empty">
                                                <span className="material-symbols-outlined">check_circle</span>
                                                <p>{t('dashboard.step.today.route.empty')}</p>
                                            </div>
                                        ) : (
                                            <div className="dashboard-today-route__items">
                                                {todayPlanItems.map((item, index) => (
                                                    <Link
                                                        key={item.id}
                                                        to={item.href}
                                                        className={`dashboard-today-route-item dashboard-today-route-item--${item.tone}`}
                                                        tabIndex={getStepTabIndex(1)}
                                                    >
                                                        <span className="dashboard-today-route-item__index">
                                                            {String(index + 1).padStart(2, '0')}
                                                        </span>
                                                        <div className="dashboard-today-route-item__content">
                                                            <span>{item.stepLabel} · {item.label}</span>
                                                            <strong>{item.title}</strong>
                                                            <small>{item.meta}</small>
                                                        </div>
                                                        <span className="material-symbols-outlined dashboard-today-route-item__arrow">arrow_forward</span>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    <aside className="dashboard-today-context">
                                        <section className="dashboard-today-watch" aria-label={t('dashboard.step.today.watch.title')}>
                                            <div className="dashboard-today-watch__header">
                                                <span className="material-symbols-outlined">visibility</span>
                                                <h3>{t('dashboard.step.today.watch.title')}</h3>
                                            </div>

                                            {todayWatchProject ? (
                                                <Link to={`/project/${todayWatchProject.project.id}`} className="dashboard-today-watch__project" tabIndex={getStepTabIndex(1)}>
                                                    <strong>{todayWatchProject.project.title}</strong>
                                                    <span>
                                                        {t('dashboard.step.today.watch.score').replace('{score}', String(todayWatchProject.health?.score ?? 100))}
                                                        {' · '}
                                                        {t('dashboard.step.today.watch.openTasks').replace('{count}', String(todayWatchProject.openTasks))}
                                                    </span>
                                                    <i style={cssVars({ '--dashboard-watch-width': `${todayWatchProject.health?.score ?? 100}%` })} />
                                                </Link>
                                            ) : (
                                                <p className="dashboard-today-watch__empty">{t('dashboard.step.today.watch.empty')}</p>
                                            )}
                                        </section>

                                        <section className="dashboard-today-load" aria-label={t('dashboard.step.today.load.title')}>
                                            <h3>{t('dashboard.step.today.load.title')}</h3>
                                            <div className="dashboard-today-load__items">
                                                {todayWorkloadItems.map((item) => (
                                                    <div key={item.key} className={`dashboard-today-load-item dashboard-today-load-item--${item.tone}`}>
                                                        <span>{item.label}</span>
                                                        <strong>{item.value}</strong>
                                                        <i style={cssVars({ '--dashboard-load-width': `${(item.value / maxTodayWorkloadValue) * 100}%` })} />
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    </aside>
                                </div>
                            </div>
                        </section>

                        <section
                            className={`dashboard-step-layer dashboard-portfolio-layer ${activeDashboardStep === 2 ? 'is-active' : ''}`}
                            aria-label={t('dashboard.step.portfolio.title')}
                            aria-hidden={activeDashboardStep !== 2}
                        >
                            <div className="dashboard-step-panel dashboard-step-panel--portfolio">
                                <div className="dashboard-step-header dashboard-step-header--split">
                                    <div>
                                        <p>{t('dashboard.step.portfolio.subtitle')}</p>
                                        <h2>{t('dashboard.step.portfolio.title')}</h2>
                                    </div>
                                    <Link to="/projects" className="dashboard-step-link" tabIndex={getStepTabIndex(2)}>
                                        {t('dashboard.projects.viewAll')}
                                        <span className="material-symbols-outlined">arrow_forward</span>
                                    </Link>
                                </div>

                                <div className="dashboard-portfolio-grid">
                                    <section className="dashboard-metric-strip">
                                        {dashboardMetrics.map((metric) => (
                                            <Link key={metric.key} to={metric.href} className="dashboard-metric-link" tabIndex={getStepTabIndex(2)}>
                                                <span className="material-symbols-outlined">{metric.icon}</span>
                                                <strong>{metric.value}</strong>
                                                <p>{metric.label}</p>
                                            </Link>
                                        ))}
                                    </section>

                                    <section className="dashboard-velocity-panel">
                                        <div className="dashboard-velocity-panel__header">
                                            <div>
                                                <h3>{t('dashboard.expanded.velocity.title')}</h3>
                                                <p>{t('dashboard.expanded.velocity.subtitle')}</p>
                                            </div>
                                            <strong>{totalVelocity}</strong>
                                        </div>

                                        <div className="dashboard-velocity-chart" aria-hidden="true">
                                            {taskTrend.map((day, index) => (
                                                <div key={day.date.toISOString()} className="dashboard-velocity-day">
                                                    <div className="dashboard-velocity-bars">
                                                        <span
                                                            className="dashboard-velocity-bar dashboard-velocity-bar--tasks"
                                                            style={cssVars({ '--dashboard-bar-height': `${Math.max(8, (day.value / maxVelocityValue) * 100)}%` })}
                                                        />
                                                    </div>
                                                    <span>{format(day.date, 'EEE', { locale: dateLocale })}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="dashboard-chart-legend">
                                            <span><i className="dashboard-chart-dot dashboard-chart-dot--tasks" />{t('nav.tasks')}</span>
                                        </div>
                                    </section>

                                    <section className="dashboard-health-panel">
                                        <div className="dashboard-health-panel__header">
                                            <h3>{t('dashboard.expanded.health.title')}</h3>
                                            <span>{activeProjects.length}</span>
                                        </div>
                                        <div className="dashboard-health-meter" aria-hidden="true">
                                            {portfolioHealthSegments.map((item) => (
                                                <span
                                                    key={item.key}
                                                    className={`dashboard-health-meter__segment dashboard-health-meter__segment--${item.tone}`}
                                                    style={cssVars({ '--dashboard-health-width': `${(item.value / healthTotal) * 100}%` })}
                                                />
                                            ))}
                                        </div>
                                        <div className="dashboard-health-list">
                                            {portfolioHealthSegments.map((item) => (
                                                <div key={item.key} className={`dashboard-health-chip dashboard-health-chip--${item.tone}`}>
                                                    <span>{item.label}</span>
                                                    <strong>{item.value}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </section>
                    </div>
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
