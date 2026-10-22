import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { auth } from '../services/firebase';
import { getAllWorkspaceProjects } from '../services/dataService';
import { ensureActiveTenantId } from '../services/domain/authService';
import { getWorkspaceInitiatives } from '../services/domain/initiativesService';
import { getSharedProjects, getUserProjects } from '../services/domain/projectsService';
import { toggleTaskStatus, updateTaskFields } from '../services/domain/tasksService';
import { getWorkspaceTasks } from '../services/domain/workspaceTasksService';
import { getPersonalTasks, updatePersonalTask } from '../services/domain/personalTasksService';
import { getUserProfile } from '../services/domain/usersService';
import { Project, Task, Initiative, PersonalTask } from '../types';
import { calculateProjectHealth, isProjectActiveForGlobalSignals, ProjectHealth } from '../services/healthService';
import { GettingStartedCard } from '../components/onboarding/GettingStartedCard';
import { useOnboarding } from '../hooks/useOnboarding';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { useUIState } from '../context/UIContext';
import type { PinnedItem } from '../context/PinnedTasksContext';
import { checkPasskeyExists } from '../services/passkeyService';
import { PasskeySetupModal } from '../components/modals/PasskeySetupModal';
import { InlineMenu } from '../components/work/InlineMenu';
import { useWorkMembers } from '../components/work/useWorkMembers';
import { buildAttention, type AttentionChip } from '../utils/attention';
import { buildDayPlan } from '../utils/dayPlan';
import { addDaysFromToday, nextMonday, toIsoDate } from '../utils/taskDates';
import { browserTimeZone } from '../utils/zonedDate';

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
    isPersonal?: boolean;
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

const cssVars = (vars: Record<string, string>) => vars as React.CSSProperties;

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
    const [otherTasks, setOtherTasks] = useState<Task[]>([]);
    const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);
    const [initiatives, setInitiatives] = useState<Initiative[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPasskeyUpsell, setShowPasskeyUpsell] = useState(false);
    const [activeDashboardStep, setActiveDashboardStep] = useState(0);
    const dashboardStageRef = useRef<HTMLDivElement | null>(null);
    const members = useWorkMembers();
    const timeZone = useMemo(() => browserTimeZone(), []);

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

    // New accounts get the passkey nudge as a checklist step instead of a popup.
    const { onboarding: firstRunState } = useOnboarding();

    useEffect(() => {
        if (!isAuthReady) {
            setLoading(true);
            return;
        }

        if (!authUserId) {
            setProjects([]);
            setTasks([]);
            setOtherTasks([]);
            setPersonalTasks([]);
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
                setOtherTasks([]);
                setPersonalTasks([]);
                setInitiatives([]);

                const displayName = user?.displayName || auth.currentUser?.displayName || profile?.displayName;
                setUserName(displayName ? displayName.split(' ')[0] : '');
                setLoading(false);

                const [workspaceTasks, workspaceInitiatives, workspacePersonalTasks] = await Promise.all([
                    getWorkspaceTasks(workspaceProjects).catch(() => ({ mine: [] as Task[], others: [] as Task[] })),
                    getWorkspaceInitiatives(resolvedTenantId).catch(() => []),
                    getPersonalTasks(resolvedTenantId).catch(() => [] as PersonalTask[])
                ]);

                if (cancelled) return;
                setTasks(workspaceTasks.mine);
                setOtherTasks(workspaceTasks.others);
                setPersonalTasks(workspacePersonalTasks);
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

    const todayLongLabel = useMemo(
        () => format(new Date(), 'PPPP', { locale: dateLocale }),
        [dateLocale, language]
    );

    // --- Shared logic (utils/dayPlan.ts, utils/attention.ts) -------------------
    // The plan, headline, band, week strip, overnight feed and the portfolio
    // ranking are computed by pure modules that the iOS app ports; this screen
    // only localizes the keys they return and renders them.

    const dayPlan = useMemo(() => buildDayPlan({
        now: Date.now(),
        timeZone,
        projects: activeProjects.map((project) => ({ id: project.id, title: project.title, dueDate: project.dueDate })),
        tasks,
        personalTasks,
        otherTasks,
        focus: focusItem
            ? {
                id: focusItem.id,
                type: focusItem.type,
                title: focusItem.title,
                projectId: focusItem.projectId,
                tenantId: focusItem.tenantId,
                isCompleted: focusItem.isCompleted,
                status: focusState?.status,
                snoozedUntil: focusState?.snoozedUntil
            }
            : null
    }), [activeProjects, focusItem, focusState?.snoozedUntil, focusState?.status, otherTasks, personalTasks, tasks, timeZone]);

    const attention = useMemo(() => buildAttention({
        now: Date.now(),
        timeZone,
        projects: activeProjects.map((project) => {
            const health = projectHealthMap[project.id];
            return {
                id: project.id,
                title: project.title,
                status: project.status,
                dueDate: project.dueDate,
                health: health ? { status: health.status, trend: health.trend } : null
            };
        }),
        tasks: activeTasks,
        unlocker: dayPlan.topUnlocker ? { title: dayPlan.topUnlocker.title, count: dayPlan.topUnlocker.count } : null
    }), [activeProjects, activeTasks, dayPlan.topUnlocker, projectHealthMap, timeZone]);

    const fillMessage = (template: string, params: Record<string, string | number>) => (
        Object.entries(params).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template)
    );

    const formatMessage = (message: { key: string | null; params: Record<string, string | number>; text: string | null }) => (
        message.key ? fillMessage(t(message.key), message.params) : (message.text || '')
    );

    const unblocksSuffix = (count: number) => {
        if (count === 0) return '';
        const text = count === 1
            ? t('dashboard.today.reason.unblocksOne')
            : t('dashboard.today.reason.unblocks').replace('{count}', String(count));
        return ` · ${text}`;
    };

    /* eslint-disable react-hooks/exhaustive-deps */
    const routeStops = useMemo<DashboardRouteStop[]>(() => dayPlan.stops.map((stop) => {
        const isFocusStop = stop.kind === 'focus';
        const itemPath = stop.itemType === 'initiative' ? 'initiatives' : 'tasks';
        let href = '/tasks';
        if (stop.isPersonal) href = `/personal-tasks/${stop.taskId}`;
        else if (stop.projectId) href = `/project/${stop.projectId}/${itemPath}/${stop.taskId}`;

        let focus: PinnedItem | undefined;
        if (isFocusStop && focusItem) {
            focus = focusItem;
        } else if (stop.canFocus && stop.projectId) {
            focus = {
                id: stop.taskId,
                type: 'task',
                title: stop.title,
                projectId: stop.projectId,
                tenantId: stop.tenantId || undefined,
                priority: (stop.priority || undefined) as Task['priority'],
                isCompleted: false
            };
        }

        return {
            id: stop.id,
            href,
            title: stop.kind === 'followUp' ? t('dashboard.route.followUp').replace('{title}', stop.title) : stop.title,
            meta: stop.projectName,
            reason: `${formatMessage(stop.reason)}${unblocksSuffix(stop.unblocksCount)}`,
            tone: stop.tone as DashboardTone,
            focus,
            proposed: stop.proposed,
            isPersonal: stop.isPersonal,
            taskId: stop.taskId,
            projectId: stop.projectId || undefined,
            tenantId: stop.tenantId || undefined
        };
    }), [dayPlan.stops, focusItem, t]);

    const routeStatement = useMemo<DashboardStatement>(() => ({
        template: fillMessage(t(dayPlan.statement.key), dayPlan.statement.params),
        value: dayPlan.statement.valueKey ? t(dayPlan.statement.valueKey) : (dayPlan.statement.value || '')
    }), [dayPlan.statement, t]);

    const causeLine = useMemo(() => formatMessage(dayPlan.cause), [dayPlan.cause, t]);
    const weekBadge = useMemo(() => formatMessage(dayPlan.week.badge), [dayPlan.week.badge, t]);
    /* eslint-enable react-hooks/exhaustive-deps */

    const routeIsSuggested = dayPlan.isSuggested;
    const dayShape = dayPlan.dayShape;
    const undatedOpenCount = dayPlan.counts.undated;
    const moreCount = dayPlan.moreCount;

    // "Diese Woche": always-on 7-day strip (Mon–Sun) with a count of dated work per day.
    const weekStrip = useMemo<DashboardWeekDay[]>(() => dayPlan.week.days.map((day) => {
        const [year, month, dayOfMonth] = day.date.split('-').map(Number);
        const date = new Date(year, month - 1, dayOfMonth, 12);
        return {
            key: day.date,
            label: format(date, 'EEEEE', { locale: dateLocale }),
            dayNum: format(date, 'd', { locale: dateLocale }),
            count: day.count,
            isToday: day.isToday,
            isWeekend: day.isWeekend
        };
    }), [dateLocale, dayPlan.week.days]);

    const weekStripTotal = dayPlan.week.total;

    // Day band: one segment per piece of today's work, plus the free rest.
    const bandSegments = dayPlan.band.segments;
    const bandCaptionParts = useMemo(() => dayPlan.band.caption.map((part) => ({
        key: part.key,
        tone: part.tone as DashboardTone,
        label: t(`dashboard.band.${part.key}`).replace('{count}', String(part.count))
    })), [dayPlan.band.caption, t]);

    // "Overnight": real movement from the last 24 hours.
    const nightEntries = useMemo<DashboardNightEntry[]>(() => dayPlan.overnight.map((entry) => ({
        key: entry.key,
        timeMs: entry.timeMs,
        time: entry.time,
        symbol: entry.kind === 'done' ? '✓' : entry.kind === 'new' ? '+' : '!',
        tone: entry.tone as DashboardTone,
        text: entry.kind === 'overdue' ? t('dashboard.night.becameOverdue').replace('{title}', entry.title) : entry.title
    })), [dayPlan.overnight, t]);

    // "Waiting on you": other people's tasks that hang on mine, plus my blocked tasks.
    const waitingItems = useMemo(() => dayPlan.waitingOnMe.slice(0, 3).map((entry) => {
        const names = entry.assigneeIds
            .map((uid) => members.find((member) => member.uid === uid)?.displayName)
            .filter((name): name is string => Boolean(name));
        const who = names.length > 1 ? `${names[0]} +${names.length - 1}` : (names[0] || '');
        let detail: string;
        if (entry.kind === 'dependent') {
            detail = t('dashboard.waiting.dependent').replace('{blocker}', entry.blockerTitle || '');
            if (who) detail = `${who} · ${detail}`;
        } else if (entry.note) {
            detail = entry.note;
        } else if (entry.blockerTitle) {
            detail = t('dashboard.today.blockedRail.dependency').replace('{title}', entry.blockerTitle);
        } else {
            detail = t('dashboard.today.blockedRail.fallback');
        }
        return {
            key: `${entry.kind}:${entry.taskId}`,
            href: entry.projectId ? `/project/${entry.projectId}/tasks/${entry.taskId}` : '/tasks',
            title: entry.title,
            detail
        };
    }), [dayPlan.waitingOnMe, members, t]);

    // --- Portfolio pulse (step 2) ------------------------------------------------

    const pulseEntry = (projectId: string) => {
        const entry = attention.entries.find((candidate) => candidate.projectId === projectId);
        return entry ? { ...entry, project: { id: entry.projectId, title: entry.title } } : null;
    };

    const chipLabel = (chip: { labelKey: string; params: Record<string, string | number> }) => fillMessage(t(chip.labelKey), chip.params);

    const withChipLabels = <T extends { chips: AttentionChip[] }>(entry: T): Omit<T, 'chips'> & { chips: DashboardAttentionChip[] } => ({
        ...entry,
        chips: entry.chips.map((chip) => ({ key: chip.key, tone: chip.tone as DashboardTone, label: chipLabel(chip) }))
    });

    /* eslint-disable react-hooks/exhaustive-deps */
    const projectsRail = useMemo(
        () => attention.rail.map(pulseEntry).filter((entry): entry is NonNullable<ReturnType<typeof pulseEntry>> => entry !== null),
        [attention]
    );

    const attentionProjects = useMemo(
        () => attention.attention
            .map(pulseEntry)
            .filter((entry): entry is NonNullable<ReturnType<typeof pulseEntry>> => entry !== null)
            .map(withChipLabels),
        [attention, t]
    );

    const pulseStatement = useMemo<DashboardStatement>(() => ({
        template: fillMessage(t(attention.statement.key), attention.statement.params),
        value: attention.statement.valueKey ? t(attention.statement.valueKey) : (attention.statement.value || '')
    }), [attention.statement, t]);

    const pulseInsight = useMemo(() => {
        const insight = attention.insight;
        if (insight.chips) {
            return fillMessage(t(insight.key as string), {
                ...insight.params,
                reasons: insight.chips.map(chipLabel).join(', ')
            });
        }
        return formatMessage(insight);
    }, [attention.insight, t]);

    const winItems = useMemo(
        () => attention.wins.map(formatMessage),
        [attention.wins, t]
    );

    const workloadProjects = useMemo(
        () => attention.workload.map(pulseEntry).filter((entry): entry is NonNullable<ReturnType<typeof pulseEntry>> => entry !== null),
        [attention]
    );
    /* eslint-enable react-hooks/exhaustive-deps */

    const projectRailSignal = (entry: { overdueCount: number; stalledDays: number | null }): { label: string; tone: DashboardTone } => {
        if (entry.overdueCount > 0) {
            return { label: t('dashboard.projectsRail.overdue').replace('{count}', String(entry.overdueCount)), tone: 'danger' };
        }
        if (entry.stalledDays !== null && entry.stalledDays >= 7) {
            return { label: t('dashboard.projectsRail.stalled').replace('{days}', String(entry.stalledDays)), tone: 'warning' };
        }
        return { label: t('dashboard.projectsRail.steady'), tone: 'neutral' };
    };

    const accentInsight = attention.accent ? formatMessage(attention.accent) : '';
    const quietProjectCount = attention.quietCount;
    const momentumCaption = formatMessage(attention.momentum.caption);
    const completedLast7Days = attention.momentum.current;
    const completionTrend = attention.momentum.trend;
    const maxCompletionValue = Math.max(...completionTrend.map((item) => item.value), 1);
    const maxWorkload = Math.max(...workloadProjects.map((entry) => entry.openCount), 1);

    const horizonItems = useMemo<DashboardRailListItem[]>(() => attention.horizon.map((item) => {
        const [year, month, dayOfMonth] = item.day.split('-').map(Number);
        const dateLabel = format(new Date(year, month - 1, dayOfMonth, 12), 'EEE d. MMM', { locale: dateLocale });
        if (item.kind === 'project') {
            return {
                id: `project:${item.id}`,
                href: `/project/${item.id}`,
                title: t('dashboard.pulse.horizon.projectDeadline').replace('{project}', item.title),
                meta: dateLabel,
                tone: 'info' as DashboardTone
            };
        }
        return {
            id: `task:${item.id}`,
            href: item.projectId ? `/project/${item.projectId}/tasks/${item.id}` : '/tasks',
            title: item.title,
            meta: `${dateLabel} · ${projectById.get(item.projectId || '') || ''}`,
            tone: 'neutral' as DashboardTone
        };
    }), [attention.horizon, dateLocale, projectById, t]);

    // Portfolio at a glance: the workspace in four numbers.
    const portfolioStats = useMemo(() => ([
        {
            key: 'projects',
            value: attention.stats.projects,
            label: t('dashboard.pulse.stat.projects'),
            tone: 'neutral' as DashboardTone
        },
        {
            key: 'open',
            value: attention.stats.open,
            label: t('dashboard.pulse.stat.open'),
            tone: 'neutral' as DashboardTone
        },
        {
            key: 'overdue',
            value: attention.stats.overdue,
            label: t('dashboard.pulse.stat.overdue'),
            tone: 'danger' as DashboardTone
        },
        {
            key: 'doneWeek',
            value: attention.stats.doneWeek,
            label: t('dashboard.pulse.stat.doneWeek'),
            tone: 'success' as DashboardTone
        }
    ]), [attention.stats, t]);

    const getStepTabIndex = (step: number) => activeDashboardStep === step ? undefined : -1;

    const handleStartDashboardFocus = (stop: DashboardRouteStop) => {
        if (!stop.focus) return;

        startFocusItem(stop.focus);

        if (!isModalOpen) {
            toggleModal();
        }
    };

    const todayIso = () => format(new Date(), 'yyyy-MM-dd');

    const patchStopTask = (stop: DashboardRouteStop, patch: Partial<Task> & Partial<PersonalTask>) => {
        const apply = <T extends { id: string }>(list: T[]) => list.map((task) => (task.id === stop.taskId ? { ...task, ...patch } : task));
        if (stop.isPersonal) setPersonalTasks((prev) => apply(prev) as PersonalTask[]);
        else setTasks((prev) => apply(prev) as Task[]);
    };

    const handleToggleComplete = async (stop: DashboardRouteStop) => {
        if (!stop.taskId) return;
        const { taskId, projectId, tenantId } = stop;
        patchStopTask(stop, { isCompleted: true, completedAt: new Date(), completedBy: authUserId || undefined });
        try {
            if (stop.isPersonal) await updatePersonalTask(taskId, { isCompleted: true }, tenantId);
            else await toggleTaskStatus(taskId, false, projectId, tenantId);
        } catch (error) {
            console.error('Dashboard complete failed', error);
            patchStopTask(stop, { isCompleted: false, completedAt: undefined, completedBy: undefined });
        }
    };

    const handleScheduleToday = async (stop: DashboardRouteStop) => {
        if (!stop.taskId) return;
        const { taskId, projectId, tenantId } = stop;
        const iso = todayIso();
        patchStopTask(stop, { scheduledDate: iso });
        try {
            if (stop.isPersonal) await updatePersonalTask(taskId, { scheduledDate: iso }, tenantId);
            else await updateTaskFields(taskId, { scheduledDate: iso }, projectId, tenantId);
        } catch (error) {
            console.error('Dashboard schedule failed', error);
            patchStopTask(stop, { scheduledDate: undefined });
        }
    };

    const handleReschedule = async (stop: DashboardRouteStop, dueDate: string) => {
        if (!stop.taskId) return;
        const { taskId, projectId, tenantId } = stop;
        const previous = (stop.isPersonal ? personalTasks : tasks).find((task) => task.id === taskId)?.dueDate;
        patchStopTask(stop, { dueDate });
        try {
            if (stop.isPersonal) await updatePersonalTask(taskId, { dueDate }, tenantId);
            else await updateTaskFields(taskId, { dueDate }, projectId, tenantId);
        } catch (error) {
            console.error('Dashboard reschedule failed', error);
            patchStopTask(stop, { dueDate: previous });
        }
    };

    const rescheduleOptions = [
        { value: toIsoDate(new Date()), label: t('work.due.today') },
        { value: toIsoDate(addDaysFromToday(1)), label: t('work.due.tomorrow') },
        { value: toIsoDate(nextMonday()), label: t('work.due.nextWeek') }
    ];

    // Nothing to plan yet: talk about getting started instead of "a free day".
    const isFirstRun = projects.length === 0 && tasks.length === 0 && personalTasks.length === 0;

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
                isOpen={showPasskeyUpsell && !firstRunState}
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
                            <div className="dashboard-today">
                                <div className="dashboard-today__top">
                                    <p>{todayLongLabel} · {greeting}, {userName || t('dashboard.userFallback')}</p>
                                    <p className="dashboard-today__week">{weekBadge}</p>
                                </div>

                                <h1 className="dashboard-today__headline">
                                    {isFirstRun ? t('dashboard.firstRun.headline') : renderDashboardStatement(routeStatement)}
                                </h1>
                                <p className="dashboard-today__cause">{isFirstRun ? t('dashboard.firstRun.cause') : causeLine}</p>

                                <GettingStartedCard projects={projects} taskCount={tasks.length} />

                                {!isFirstRun && (
                                <div className="dashboard-band-wrap">
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
                                )}

                                {!isFirstRun && (
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
                                                            {stop.reason}
                                                            {stop.isPersonal ? (
                                                                <>
                                                                    {' · '}
                                                                    <span
                                                                        className="material-symbols-outlined dashboard-plan__lock"
                                                                        role="img"
                                                                        aria-label={t('dashboard.route.personal')}
                                                                        title={t('dashboard.route.personal')}
                                                                    >
                                                                        lock
                                                                    </span>
                                                                </>
                                                            ) : (stop.meta ? ` · ${stop.meta}` : '')}
                                                        </span>
                                                    </Link>
                                                    <div className="dashboard-plan__actions">
                                                        {!stop.proposed && stop.taskId && (
                                                            <InlineMenu
                                                                label={`${t('work.row.changeDue')}: ${stop.title}`}
                                                                triggerClassName="dashboard-plan__act"
                                                                trigger={<span className="material-symbols-outlined">event_repeat</span>}
                                                                options={rescheduleOptions}
                                                                onSelect={(dueDate) => void handleReschedule(stop, dueDate)}
                                                                width={200}
                                                            />
                                                        )}
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

                                        {moreCount > 0 && (
                                            <Link to="/tasks" className="dashboard-plan__footer" tabIndex={getStepTabIndex(0)}>
                                                {t(moreCount === 1 ? 'dashboard.route.moreOne' : 'dashboard.route.more').replace('{count}', String(moreCount))}
                                            </Link>
                                        )}

                                        {undatedOpenCount > 0 && (
                                            <Link to="/tasks" className="dashboard-plan__footer" tabIndex={getStepTabIndex(0)}>
                                                {t('dashboard.route.end.backlog').replace('{count}', String(undatedOpenCount))}
                                            </Link>
                                        )}
                                    </div>

                                    <aside className="dashboard-today__rail">
                                        {waitingItems.length > 0 && (
                                            <section aria-label={t('dashboard.waiting.title')}>
                                                <h2 className="dashboard-side-title">{t('dashboard.waiting.title')}</h2>
                                                <div className="dashboard-waiting">
                                                    {waitingItems.map((item) => (
                                                        <Link key={item.key} to={item.href} className="dashboard-waiting__row" tabIndex={getStepTabIndex(0)}>
                                                            <span className="dashboard-waiting__title">{item.title}</span>
                                                            <span className="dashboard-waiting__detail">{item.detail}</span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            </section>
                                        )}

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
                                )}
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
                                                <strong>{completedLast7Days}</strong>
                                                <span>{t('dashboard.pulse.momentum.completed')}</span>
                                                <small>{momentumCaption}</small>
                                            </div>
                                            <div className="dashboard-momentum__chart" aria-hidden="true">
                                                {completionTrend.map((day) => (
                                                    <span
                                                        key={day.date}
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
        </>
    );
};
