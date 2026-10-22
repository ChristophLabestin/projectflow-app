// Pure portfolio "where to look" ranking (Dashboard slide 2 "Pulse", iOS
// Projects tab) and the project-list grouping.
//
// Extracted from screens/Dashboard.tsx and components/projects/
// ProjectPortfolioList.tsx so web and iOS rank identically. No React /
// Firebase imports, no system clock, no i18n: output carries i18n keys +
// params. Project health is NOT recomputed here — callers pass the status and
// trend they already have (web: calculateProjectHealth, iOS: server
// snapshots). Behaviour is pinned by golden fixtures in
// shared/fixtures/attention/ — see shared/fixtures/README.md.

import {
    DAY_MS,
    addDays,
    dateSortKey,
    daysBetween,
    resolveTimeZone,
    toDay,
    toInstantOrZero,
    type DateLike
} from './zonedDate';

// --- Input ------------------------------------------------------------------

export interface AttentionProject {
    id: string;
    title: string;
    status?: string | null;
    dueDate?: DateLike;
    /** Health the caller already has: `status` critical|warning|…, `trend` declining|…. */
    health?: { status?: string | null; trend?: string | null } | null;
}

export interface AttentionTask {
    id: string;
    title?: string;
    projectId?: string | null;
    isCompleted?: boolean | null;
    status?: string | null;
    dueDate?: DateLike;
    createdAt?: DateLike;
    completedAt?: DateLike;
}

export interface AttentionInput {
    /** The current moment (instant). */
    now: DateLike;
    /** IANA time zone that defines "today". Defaults to the runtime's zone. */
    timeZone?: string | null;
    /** Active projects only (`isProjectActiveForGlobalSignals`). */
    projects: AttentionProject[];
    /** My project tasks (open and completed); tasks of other projects are ignored. */
    tasks: AttentionTask[];
    /** Most unlocking open task (`dayPlan.topUnlocker`), used for the accent line. */
    unlocker?: { title: string; count: number } | null;
}

// --- Output -----------------------------------------------------------------

export type AttentionTone = 'danger' | 'warning' | 'info' | 'neutral';

export interface AttentionChip {
    key: 'overdue' | 'blocked' | 'stalled' | 'declining' | 'critical' | 'warning' | 'deadline';
    tone: AttentionTone;
    /** i18n key of the chip label (`dashboard.pulse.chip.<key>`). */
    labelKey: string;
    params: Record<string, string | number>;
}

export interface AttentionEntry {
    projectId: string;
    title: string;
    openCount: number;
    overdueCount: number;
    blockedCount: number;
    /** Whole days since the newest task creation/completion, or null without tasks. */
    stalledDays: number | null;
    /** Calendar days until the project deadline (> 0), else null. */
    deadlineDays: number | null;
    /** Tasks completed in the last 7 × 24 h. */
    completedWeek: number;
    score: number;
    /** At most 3. */
    chips: AttentionChip[];
}

export interface AttentionMessage {
    key: string | null;
    params: Record<string, string | number>;
    text: string | null;
    /** For `dashboard.pulse.insight.worst`: the UI localizes these and joins them with ", " into `{reasons}`. */
    chips?: AttentionChip[];
}

export interface AttentionStatement {
    key: string;
    params: Record<string, string | number>;
    value: string | null;
    valueKey: string | null;
}

export interface AttentionHorizonItem {
    kind: 'task' | 'project';
    id: string;
    title: string;
    projectId: string | null;
    /** "YYYY-MM-DD". */
    day: string;
}

export interface AttentionResult {
    today: string;
    timeZone: string;
    /** One entry per active project, in input order. */
    entries: AttentionEntry[];
    /** Project ids needing attention (score >= 3), worst first, at most 3. */
    attention: string[];
    /** Active projects not in `attention`. */
    quietCount: number;
    /** Project ids with open work, most open tasks first, at most 4 (Today rail). */
    rail: string[];
    /** Project ids with open work, most open tasks first, at most 5 (workload bars). */
    workload: string[];
    /** Project with the most completions in the last week, if any. */
    bestRun: { projectId: string; completedWeek: number } | null;
    statement: AttentionStatement;
    insight: AttentionMessage;
    /** Stalled-project or unlocker line for the Today rail, or null. */
    accent: AttentionMessage | null;
    stats: { projects: number; open: number; overdue: number; doneWeek: number };
    momentum: {
        current: number;
        previous: number;
        caption: AttentionMessage;
        /** 14 buckets, oldest first, ending today. */
        trend: Array<{ date: string; value: number }>;
    };
    /** At most 3 "wins" lines. */
    wins: AttentionMessage[];
    /** Next 4 task/project deadlines within the next 14 days. */
    horizon: AttentionHorizonItem[];
}

export type PortfolioGroup = 'attention' | 'active' | 'planning' | 'paused' | 'closed';

// --- Helpers ----------------------------------------------------------------

export const ATTENTION_THRESHOLD = 3;
export const MAX_ATTENTION = 3;
export const MAX_RAIL = 4;
export const MAX_WORKLOAD = 5;
export const STALLED_DAYS = 7;

const message = (key: string, params: Record<string, string | number> = {}): AttentionMessage => ({ key, params, text: null });

const chip = (
    key: AttentionChip['key'],
    tone: AttentionTone,
    params: Record<string, string | number> = {}
): AttentionChip => ({ key, tone, labelKey: `dashboard.pulse.chip.${key}`, params });

/** Stable sort that ports can reproduce: ties keep input order. */
const stableSort = <T,>(items: T[], compare: (a: T, b: T) => number): T[] => (
    items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
        .map(({ item }) => item)
);

// --- Ranking ----------------------------------------------------------------

export const buildAttention = (input: AttentionInput): AttentionResult => {
    const timeZone = resolveTimeZone(input.timeZone);
    const nowMs = toInstantOrZero(input.now, timeZone);
    const today = toDay(nowMs, timeZone) as string;

    const projectIds = new Set(input.projects.map((project) => project.id));
    const tasks = input.tasks.filter((task) => task.projectId && projectIds.has(task.projectId));
    const tasksByProject = new Map<string, AttentionTask[]>();
    tasks.forEach((task) => {
        const key = task.projectId as string;
        tasksByProject.set(key, [...(tasksByProject.get(key) || []), task]);
    });

    const isPastDue = (value: DateLike) => {
        const day = toDay(value, timeZone);
        return day !== null && daysBetween(today, day) < 0;
    };

    const entries: AttentionEntry[] = input.projects.map((project) => {
        const projectTasks = tasksByProject.get(project.id) || [];
        const open = projectTasks.filter((task) => !task.isCompleted);
        const overdue = open.filter((task) => isPastDue(task.dueDate));
        const blocked = open.filter((task) => task.status === 'Blocked');
        const completedWeek = projectTasks.filter((task) => (
            task.isCompleted && toInstantOrZero(task.completedAt, timeZone) >= nowMs - 7 * DAY_MS
        )).length;

        let lastActivity = 0;
        projectTasks.forEach((task) => {
            lastActivity = Math.max(
                lastActivity,
                toInstantOrZero(task.createdAt, timeZone),
                toInstantOrZero(task.completedAt, timeZone)
            );
        });
        const stalledDays = lastActivity > 0 ? Math.floor((nowMs - lastActivity) / DAY_MS) : null;

        const dueDay = toDay(project.dueDate, timeZone);
        const dueDiff = dueDay === null ? null : daysBetween(today, dueDay);
        const deadlineDays = dueDiff !== null && dueDiff > 0 ? dueDiff : null;

        const declining = project.health?.trend === 'declining';
        const critical = project.health?.status === 'critical';
        const warning = project.health?.status === 'warning';
        const stalled = stalledDays !== null && stalledDays >= STALLED_DAYS && open.length > 0;

        let score = (overdue.length * 3) + (blocked.length * 2);
        if (critical) score += 6;
        else if (warning) score += 3;
        if (declining) score += 3;
        if (stalled) score += 3;
        if (deadlineDays !== null && deadlineDays <= 7 && open.length > 3) score += 2;

        const chips: AttentionChip[] = [];
        if (overdue.length > 0) chips.push(chip('overdue', 'danger', { count: overdue.length }));
        if (blocked.length > 0) chips.push(chip('blocked', 'danger', { count: blocked.length }));
        if (stalled) chips.push(chip('stalled', 'warning', { days: stalledDays as number }));
        if (declining) chips.push(chip('declining', 'warning'));
        else if (critical) chips.push(chip('critical', 'danger'));
        else if (warning) chips.push(chip('warning', 'warning'));
        if (deadlineDays !== null && deadlineDays <= 14) chips.push(chip('deadline', 'info', { days: deadlineDays }));

        return {
            projectId: project.id,
            title: project.title,
            openCount: open.length,
            overdueCount: overdue.length,
            blockedCount: blocked.length,
            stalledDays,
            deadlineDays,
            completedWeek,
            score,
            chips: chips.slice(0, 3)
        };
    });

    const entryById = new Map(entries.map((entry) => [entry.projectId, entry]));
    const attentionEntries = stableSort(entries.filter((entry) => entry.score >= ATTENTION_THRESHOLD), (a, b) => b.score - a.score)
        .slice(0, MAX_ATTENTION);
    const withWork = stableSort(entries.filter((entry) => entry.openCount > 0), (a, b) => b.openCount - a.openCount);
    const quietCount = Math.max(input.projects.length - attentionEntries.length, 0);

    const bestRunEntry = stableSort(entries, (a, b) => b.completedWeek - a.completedWeek)[0];
    const bestRun = bestRunEntry && bestRunEntry.completedWeek > 0
        ? { projectId: bestRunEntry.projectId, completedWeek: bestRunEntry.completedWeek }
        : null;

    // Statement + insight -------------------------------------------------------------------
    const statement = ((): AttentionStatement => {
        if (input.projects.length === 0) {
            return { key: 'dashboard.pulse.statement.none', params: {}, value: null, valueKey: 'dashboard.pulse.statement.noneValue' };
        }
        if (attentionEntries.length > 0) {
            return {
                key: attentionEntries.length === 1 ? 'dashboard.pulse.statement.driftingOne' : 'dashboard.pulse.statement.drifting',
                params: { total: input.projects.length },
                value: String(attentionEntries.length),
                valueKey: null
            };
        }
        return {
            key: input.projects.length === 1 ? 'dashboard.pulse.statement.steadyOne' : 'dashboard.pulse.statement.steady',
            params: {},
            value: String(input.projects.length),
            valueKey: null
        };
    })();

    const insight = ((): AttentionMessage => {
        const worst = attentionEntries[0];
        if (worst && worst.chips.length > 0) {
            return { ...message('dashboard.pulse.insight.worst', { project: worst.title }), chips: worst.chips };
        }
        if (bestRun) {
            return message('dashboard.pulse.insight.bestRun', {
                project: (entryById.get(bestRun.projectId) as AttentionEntry).title,
                count: bestRun.completedWeek
            });
        }
        return message('dashboard.pulse.insight.quietAll');
    })();

    const accent = ((): AttentionMessage | null => {
        const stalled = stableSort(
            entries.filter((entry) => entry.stalledDays !== null && entry.stalledDays >= STALLED_DAYS && entry.openCount > 0),
            (a, b) => (b.stalledDays || 0) - (a.stalledDays || 0)
        )[0];
        if (stalled) {
            if (stalled.deadlineDays !== null) {
                return message('dashboard.accent.stalledDeadline', {
                    project: stalled.title,
                    deadline: stalled.deadlineDays,
                    days: stalled.stalledDays as number
                });
            }
            return message('dashboard.accent.stalled', { project: stalled.title, days: stalled.stalledDays as number });
        }
        if (input.unlocker && input.unlocker.count > 0) {
            return message('dashboard.accent.unlock', { title: input.unlocker.title, count: input.unlocker.count });
        }
        return null;
    })();

    // Stats + momentum -------------------------------------------------------------------------
    const completed = tasks.filter((task) => task.isCompleted);
    const current = completed.filter((task) => toInstantOrZero(task.completedAt, timeZone) >= nowMs - 7 * DAY_MS).length;
    const previous = completed.filter((task) => {
        const at = toInstantOrZero(task.completedAt, timeZone);
        return at >= nowMs - 14 * DAY_MS && at < nowMs - 7 * DAY_MS;
    }).length;

    const stats = {
        projects: input.projects.length,
        open: entries.reduce((sum, entry) => sum + entry.openCount, 0),
        overdue: entries.reduce((sum, entry) => sum + entry.overdueCount, 0),
        doneWeek: current
    };

    const caption = ((): AttentionMessage => {
        if (previous === 0 && current > 0) return message('dashboard.pulse.momentum.firstWeek');
        if (current > previous) return message('dashboard.pulse.momentum.up', { diff: current - previous });
        if (current < previous) return message('dashboard.pulse.momentum.down', { diff: previous - current });
        return message('dashboard.pulse.momentum.flat');
    })();

    const trend = Array.from({ length: 14 }, (_, index) => ({ date: addDays(today, index - 13), value: 0 }));
    completed.forEach((task) => {
        const day = toDay(task.completedAt, timeZone);
        if (!day) return;
        const bucket = trend.find((entry) => entry.date === day);
        if (bucket) bucket.value += 1;
    });

    // Wins ----------------------------------------------------------------------------------------
    const wins: AttentionMessage[] = [];
    if (current > 0) wins.push(message('dashboard.pulse.wins.completedWeek', { count: current }));
    if (bestRun) {
        wins.push(message('dashboard.pulse.wins.bestProject', {
            project: (entryById.get(bestRun.projectId) as AttentionEntry).title,
            count: bestRun.completedWeek
        }));
    }
    if (quietCount > 0 && input.projects.length > 0) {
        wins.push(message(
            quietCount === 1 ? 'dashboard.pulse.wins.quietProjectsOne' : 'dashboard.pulse.wins.quietProjects',
            { count: quietCount }
        ));
    }

    // Horizon: deadlines from tomorrow through the next 14 days ----------------------------------------
    const horizonAll: Array<AttentionHorizonItem & { sortKey: number }> = [];
    tasks.filter((task) => !task.isCompleted).forEach((task) => {
        const day = toDay(task.dueDate, timeZone);
        if (day === null) return;
        const diff = daysBetween(today, day);
        if (diff >= 1 && diff <= 14) {
            horizonAll.push({
                kind: 'task',
                id: task.id,
                title: task.title || '',
                projectId: task.projectId || null,
                day,
                sortKey: dateSortKey(task.dueDate, timeZone)
            });
        }
    });
    input.projects.forEach((project) => {
        const day = toDay(project.dueDate, timeZone);
        if (day === null) return;
        const diff = daysBetween(today, day);
        if (diff >= 1 && diff <= 14) {
            horizonAll.push({
                kind: 'project',
                id: project.id,
                title: project.title,
                projectId: project.id,
                day,
                sortKey: dateSortKey(project.dueDate, timeZone)
            });
        }
    });
    const horizon = stableSort(horizonAll, (a, b) => a.sortKey - b.sortKey)
        .slice(0, 4)
        .map(({ sortKey: _sortKey, ...item }) => item);

    return {
        today,
        timeZone,
        entries,
        attention: attentionEntries.map((entry) => entry.projectId),
        quietCount,
        rail: withWork.slice(0, MAX_RAIL).map((entry) => entry.projectId),
        workload: withWork.slice(0, MAX_WORKLOAD).map((entry) => entry.projectId),
        bestRun,
        statement,
        insight,
        accent,
        stats,
        momentum: { current, previous, caption, trend },
        wins: wins.slice(0, 3),
        horizon
    };
};

// --- Portfolio list grouping --------------------------------------------------

const PLANNING_STATUSES = ['Planning', 'Brainstorming', 'Backlog'];
const CLOSED_STATUSES = ['Completed', 'Canceled'];

export interface PortfolioSignals {
    overdue: number;
    blocked: number;
}

/**
 * Group of a project in the portfolio list. `signals` are the open-task
 * overdue/blocked counts (null while the project's tasks are not loaded).
 */
export const portfolioGroup = (
    project: { status?: string | null; dueDate?: DateLike },
    signals: PortfolioSignals | null,
    healthStatus: string | null | undefined,
    context: { now: DateLike; timeZone?: string | null }
): PortfolioGroup => {
    const status = project.status || '';
    if (CLOSED_STATUSES.includes(status)) return 'closed';
    if (status === 'On Hold') return 'paused';
    if (PLANNING_STATUSES.includes(status)) return 'planning';
    const timeZone = resolveTimeZone(context.timeZone);
    const nowMs = toInstantOrZero(context.now, timeZone);
    const dueDay = toDay(project.dueDate, timeZone);
    const dueOverdue = dueDay !== null && daysBetween(toDay(nowMs, timeZone) as string, dueDay) < 0;
    const needsAttention = (!!signals && (signals.overdue > 0 || signals.blocked > 0))
        || healthStatus === 'critical'
        || (!!project.dueDate && dueOverdue);
    return needsAttention ? 'attention' : 'active';
};

/** Fixture-friendly wrapper: groups every project from its tasks. */
export const classifyPortfolio = (input: {
    now: DateLike;
    timeZone?: string | null;
    projects: AttentionProject[];
    /** Project ids whose tasks are loaded; omitted = all projects. */
    tasks: AttentionTask[];
    loadedProjectIds?: string[];
}): Array<{ projectId: string; group: PortfolioGroup }> => {
    const timeZone = resolveTimeZone(input.timeZone);
    const nowMs = toInstantOrZero(input.now, timeZone);
    const today = toDay(nowMs, timeZone) as string;
    return input.projects.map((project) => {
        const loaded = !input.loadedProjectIds || input.loadedProjectIds.includes(project.id);
        let signals: PortfolioSignals | null = null;
        if (loaded) {
            signals = { overdue: 0, blocked: 0 };
            input.tasks.filter((task) => task.projectId === project.id && !task.isCompleted).forEach((task) => {
                if (task.status === 'Blocked') (signals as PortfolioSignals).blocked += 1;
                const day = toDay(task.dueDate, timeZone);
                if (day !== null && daysBetween(today, day) < 0) (signals as PortfolioSignals).overdue += 1;
            });
        }
        return {
            projectId: project.id,
            group: portfolioGroup(project, signals, project.health?.status, { now: nowMs, timeZone })
        };
    });
};
