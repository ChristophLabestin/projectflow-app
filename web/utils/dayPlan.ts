// Pure "plan for today" logic (Dashboard slide 1, iOS "Heute").
//
// Extracted from screens/Dashboard.tsx so the web app and the iOS app compute
// the same plan. No React / Firebase imports, no system clock, no i18n: the
// output carries i18n keys + params and the UI localizes them. The behaviour
// is pinned by golden fixtures in shared/fixtures/dayPlan/ — read
// shared/fixtures/README.md before changing anything here.

import {
    DAY_MS,
    addDays,
    clockLabel,
    dateSortKey,
    daysBetween,
    hasDateValue,
    resolveTimeZone,
    startOfDay,
    toDay,
    toInstant,
    toInstantOrZero,
    weekdayIndex,
    type DateLike
} from './zonedDate';

// --- Input ------------------------------------------------------------------

export interface DayPlanTask {
    id: string;
    title: string;
    /** Absent on personal tasks. */
    projectId?: string | null;
    tenantId?: string | null;
    /** `Todo` (legacy) reads as `Open`. Only `Blocked` matters for the plan. */
    status?: string | null;
    /** The single source of truth for open/closed. */
    isCompleted?: boolean | null;
    priority?: string | null;
    dueDate?: DateLike;
    scheduledDate?: DateLike;
    createdAt?: DateLike;
    completedAt?: DateLike;
    /** Ids of tasks that block this one. */
    dependencies?: string[] | null;
    blockerNote?: string | null;
    nextStep?: string | null;
    assigneeIds?: string[] | null;
}

export interface DayPlanProject {
    id: string;
    title: string;
    /** Project deadline; counts in the week strip. */
    dueDate?: DateLike;
}

export interface DayPlanFocus {
    id: string;
    /** `task` | `initiative` (| `personal`). */
    type: string;
    title: string;
    projectId?: string | null;
    tenantId?: string | null;
    isCompleted?: boolean | null;
    /** `active` | `snoozed` | `blocked`. */
    status?: string | null;
    snoozedUntil?: DateLike;
}

export interface DayPlanInput {
    /** The current moment (instant). */
    now: DateLike;
    /** IANA time zone that defines "today". Defaults to the runtime's zone. */
    timeZone?: string | null;
    /** Active projects only (`isProjectActiveForGlobalSignals`). Tasks of other projects are ignored. */
    projects: DayPlanProject[];
    /** My open and completed project tasks. */
    tasks: DayPlanTask[];
    /** My personal tasks (no project). */
    personalTasks?: DayPlanTask[];
    /** Tasks of other people in the same projects; used for "unblocks" and "waiting on me". */
    otherTasks?: DayPlanTask[];
    focus?: DayPlanFocus | null;
}

// --- Output -----------------------------------------------------------------

export type DayPlanTone = 'info' | 'danger' | 'warning' | 'neutral' | 'success';

/** An i18n message: `t(key)` with `{param}` placeholders replaced; or the literal `text` when `key` is null. */
export interface DayPlanMessage {
    key: string | null;
    params: Record<string, string | number>;
    text: string | null;
}

export type DayPlanStopKind = 'focus' | 'overdue' | 'dueToday' | 'scheduled' | 'followUp' | 'suggestion';

export interface DayPlanStop {
    /** Unique within the plan: `<taskId>` | `personal:<id>` | `follow:<key>` | `suggest:<key>`. */
    id: string;
    kind: DayPlanStopKind;
    tone: DayPlanTone;
    /** True for quiet-day suggestions (dashed in the UI). */
    proposed: boolean;
    taskId: string;
    /** `task` | `initiative` | `personal`. */
    itemType: string;
    /** Raw title; the UI wraps follow-ups in `dashboard.route.followUp`. */
    title: string;
    projectId: string | null;
    /** '' when the project is unknown or the task is personal. */
    projectName: string;
    tenantId: string | null;
    isPersonal: boolean;
    priority: string | null;
    reason: DayPlanMessage;
    /** Open tasks this one frees up; only set for `overdue` / `dueToday` stops (0 otherwise). */
    unblocksCount: number;
    /** Whether "start focus" may be offered (the task belongs to a project). */
    canFocus: boolean;
}

export interface DayPlanStatement {
    key: string;
    params: Record<string, string | number>;
    /** Emphasised value substituted for `{value}` (count or title). */
    value: string | null;
    /** i18n key of the value when it is itself a localized phrase. */
    valueKey: string | null;
}

export type DayShape = 'waiting' | 'clear' | 'behind' | 'heavy' | 'doable';

export interface DayPlanCounts {
    overdue: number;
    dueToday: number;
    scheduledToday: number;
    /** overdue + dueToday + scheduledToday, deduplicated. */
    queue: number;
    /** Open project tasks with status Blocked. */
    blocked: number;
    /** Open project + personal tasks. */
    open: number;
    /** Open, undated (no due and no scheduled date), not blocked. */
    undated: number;
    completedLast7Days: number;
    completedPrevious7Days: number;
}

export interface DayPlanBandSegment {
    key: string;
    type: 'overdue' | 'due' | 'waiting' | 'rest';
    flex: number;
}

export interface DayPlanBandPart {
    key: 'overdue' | 'due' | 'waiting';
    tone: DayPlanTone;
    count: number;
}

export interface DayPlanWeekDay {
    /** "YYYY-MM-DD". */
    date: string;
    /** Monday = 0 … Sunday = 6. */
    weekday: number;
    count: number;
    isToday: boolean;
    isWeekend: boolean;
}

export interface DayPlanNightEntry {
    key: string;
    kind: 'done' | 'new' | 'overdue';
    taskId: string;
    title: string;
    timeMs: number;
    /** "HH:mm" in the plan's time zone. */
    time: string;
    tone: DayPlanTone;
}

export interface DayPlanWaitingEntry {
    /** `dependent`: someone else's task depends on my open task. `blocked`: my own task is blocked. */
    kind: 'dependent' | 'blocked';
    taskId: string;
    title: string;
    projectId: string | null;
    projectName: string;
    /** Who is waiting (`dependent`); empty for `blocked`. */
    assigneeIds: string[];
    /** `dependent`: my open task it hangs on. `blocked`: first open dependency, if any. */
    blockerTaskId: string | null;
    blockerTitle: string | null;
    /** `blocked`: the blocker note. */
    note: string | null;
}

export interface DayPlanUnlocker {
    taskId: string;
    title: string;
    count: number;
}

export interface DayPlan {
    /** "YYYY-MM-DD" of `now` in the plan's time zone. */
    today: string;
    timeZone: string;
    stops: DayPlanStop[];
    /** Open tasks (project + personal) that are not part of `stops`. */
    moreCount: number;
    /** True when every stop is a quiet-day suggestion. */
    isSuggested: boolean;
    statement: DayPlanStatement;
    dayShape: DayShape;
    cause: DayPlanMessage;
    counts: DayPlanCounts;
    band: { segments: DayPlanBandSegment[]; caption: DayPlanBandPart[] };
    week: { badge: DayPlanMessage; days: DayPlanWeekDay[]; total: number };
    overnight: DayPlanNightEntry[];
    waitingOnMe: DayPlanWaitingEntry[];
    /** My open task that frees up the most other tasks (ties: first), or null. */
    topUnlocker: DayPlanUnlocker | null;
}

// --- Helpers ----------------------------------------------------------------

export const MAX_STOPS = 4;
export const MAX_SUGGESTED_STOPS = 3;
export const MAX_OVERNIGHT = 4;
const BAND_CAP = 6;

const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const priorityRank = (priority?: string | null) => PRIORITY_RANK[priority || 'Medium'] ?? 2;

const message = (key: string, params: Record<string, string | number> = {}): DayPlanMessage => ({ key, params, text: null });
const literal = (text: string): DayPlanMessage => ({ key: null, params: {}, text });

/** `isCompleted` is the only authority for open/closed; `status` is never used to infer it. */
export const isTaskOpen = (task: { isCompleted?: boolean | null }) => !task.isCompleted;

/** Effective status: completed reads as `Done`, a missing or legacy `Todo` status as `Open`. */
export const effectiveStatus = (task: { isCompleted?: boolean | null; status?: string | null }): string => {
    if (task.isCompleted) return 'Done';
    if (!task.status || task.status === 'Todo') return 'Open';
    return task.status;
};

interface PlanTask extends DayPlanTask {
    key: string;
    isPersonal: boolean;
}

const asPlanTask = (task: DayPlanTask, isPersonal: boolean): PlanTask => ({
    ...task,
    key: isPersonal ? `personal:${task.id}` : task.id,
    isPersonal
});

/** How many open tasks each task id blocks (reverse dependency count). */
export const countUnblocks = (openTasks: Array<{ dependencies?: string[] | null }>): Record<string, number> => {
    const counts: Record<string, number> = {};
    openTasks.forEach((task) => {
        (task.dependencies || []).forEach((dependencyId) => {
            counts[dependencyId] = (counts[dependencyId] || 0) + 1;
        });
    });
    return counts;
};

// --- The plan ----------------------------------------------------------------

export const buildDayPlan = (input: DayPlanInput): DayPlan => {
    const timeZone = resolveTimeZone(input.timeZone);
    const nowMs = toInstantOrZero(input.now, timeZone);
    const today = toDay(nowMs, timeZone) as string;
    const todayStart = startOfDay(today, timeZone);

    const dayOf = (value: DateLike) => toDay(value, timeZone);
    const isToday = (value: DateLike) => dayOf(value) === today;
    const isPastDue = (value: DateLike) => {
        const day = dayOf(value);
        return day !== null && daysBetween(today, day) < 0;
    };
    const overdueDaysOf = (task: PlanTask) => {
        const day = dayOf(task.dueDate);
        if (day === null) return 0;
        return Math.max(1, daysBetween(day, today));
    };

    const projectTitle = new Map<string, string>();
    input.projects.forEach((project) => projectTitle.set(project.id, project.title));
    const isActiveProject = (projectId?: string | null) => Boolean(projectId && projectTitle.has(projectId));
    const projectLabel = (projectId?: string | null) => (projectId && projectTitle.get(projectId)) || '';

    // Task universe -----------------------------------------------------------
    const mine = input.tasks.filter((task) => isActiveProject(task.projectId)).map((task) => asPlanTask(task, false));
    const mineIds = new Set(mine.map((task) => task.id));
    const others = (input.otherTasks || [])
        .filter((task) => isActiveProject(task.projectId) && !mineIds.has(task.id))
        .map((task) => asPlanTask(task, false));
    const personal = (input.personalTasks || []).map((task) => asPlanTask(task, true));

    const taskById = new Map<string, PlanTask>();
    [...others, ...mine].forEach((task) => taskById.set(task.id, task));

    const openMine = mine.filter(isTaskOpen);
    const openOthers = others.filter(isTaskOpen);
    const openPersonal = personal.filter(isTaskOpen);
    // Combined order: my project tasks first, then personal tasks.
    const open = [...openMine, ...openPersonal];

    const unblocks = countUnblocks([...openMine, ...openOthers]);

    // Buckets -------------------------------------------------------------------
    const overdue = open.filter((task) => isPastDue(task.dueDate));
    const dueToday = open.filter((task) => isToday(task.dueDate));
    const scheduledToday = open.filter((task) => (
        isToday(task.scheduledDate) && !isToday(task.dueDate) && !isPastDue(task.dueDate)
    ));
    // Personal tasks cannot be blocked by or wait on anyone.
    const blocked = openMine.filter((task) => task.status === 'Blocked');

    const queue: PlanTask[] = [];
    const queued = new Set<string>();
    [...overdue, ...dueToday, ...scheduledToday].forEach((task) => {
        if (queued.has(task.key)) return;
        queued.add(task.key);
        queue.push(task);
    });

    const completedMine = mine.filter((task) => task.isCompleted);
    const completedLast7Days = completedMine.filter((task) => toInstantOrZero(task.completedAt, timeZone) >= nowMs - 7 * DAY_MS);
    const completedPrevious7Days = completedMine.filter((task) => {
        const completed = toInstantOrZero(task.completedAt, timeZone);
        return completed >= nowMs - 14 * DAY_MS && completed < nowMs - 7 * DAY_MS;
    });

    // Focus ---------------------------------------------------------------------
    const focus = input.focus || null;
    const focusSnoozed = Boolean(
        focus
        && focus.status === 'snoozed'
        && focus.snoozedUntil
        && (toInstant(focus.snoozedUntil, timeZone) ?? 0) > nowMs
    );

    // Stops ---------------------------------------------------------------------
    const stops: DayPlanStop[] = [];
    const seen = new Set<string>();

    const stopFor = (
        task: PlanTask,
        kind: DayPlanStopKind,
        tone: DayPlanTone,
        reason: DayPlanMessage,
        extra: Partial<DayPlanStop> = {}
    ): DayPlanStop => ({
        id: task.key,
        kind,
        tone,
        proposed: false,
        taskId: task.id,
        itemType: task.isPersonal ? 'personal' : 'task',
        title: task.title,
        projectId: task.projectId || null,
        projectName: task.isPersonal ? '' : projectLabel(task.projectId),
        tenantId: task.tenantId || null,
        isPersonal: task.isPersonal,
        priority: task.priority || null,
        reason,
        unblocksCount: 0,
        canFocus: Boolean(task.projectId) && !task.isPersonal,
        ...extra
    });

    const pushTask = (task: PlanTask, kind: DayPlanStopKind, tone: DayPlanTone, reason: DayPlanMessage, withUnblocks: boolean) => {
        if (stops.length >= MAX_STOPS || seen.has(task.key)) return;
        seen.add(task.key);
        stops.push(stopFor(task, kind, tone, reason, { unblocksCount: withUnblocks ? (unblocks[task.id] || 0) : 0 }));
    };

    if (focus && focus.projectId && isActiveProject(focus.projectId) && !focusSnoozed && !focus.isCompleted) {
        const focusTask = taskById.get(focus.id);
        if (!focusTask || !focusTask.isCompleted) {
            seen.add(focus.id);
            stops.push({
                id: focus.id,
                kind: 'focus',
                tone: 'info',
                proposed: false,
                taskId: focus.id,
                itemType: focus.type === 'initiative' ? 'initiative' : 'task',
                title: focus.title,
                projectId: focus.projectId,
                projectName: projectLabel(focus.projectId),
                tenantId: focus.tenantId || null,
                isPersonal: false,
                priority: focusTask?.priority || null,
                reason: focusTask?.nextStep
                    ? message('dashboard.today.reason.focusNext', { next: focusTask.nextStep })
                    : message('dashboard.today.reason.focusResume'),
                unblocksCount: 0,
                canFocus: true
            });
        }
    }

    const byDue = (a: PlanTask, b: PlanTask) => (
        dateSortKey(a.dueDate || a.scheduledDate, timeZone) - dateSortKey(b.dueDate || b.scheduledDate, timeZone)
    );
    // Array.prototype.sort is stable; ports must break ties by input order.
    [...overdue].sort(byDue).forEach((task) => {
        const days = overdueDaysOf(task);
        const reason = days <= 1
            ? message('dashboard.today.reason.overdueYesterday')
            : message('dashboard.today.reason.overdueDays', { days });
        pushTask(task, 'overdue', 'danger', reason, true);
    });

    [...dueToday]
        .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
        .forEach((task) => pushTask(task, 'dueToday', 'warning', message('dashboard.today.reason.dueToday'), true));

    scheduledToday.forEach((task) => pushTask(task, 'scheduled', 'neutral', message('dashboard.today.reason.scheduled'), false));

    // Fill remaining stops with quick follow-ups on blocked work.
    const firstOpenDependency = (task: PlanTask) => {
        const dependency = task.dependencies && task.dependencies.length > 0 ? taskById.get(task.dependencies[0]) : undefined;
        return dependency && !dependency.isCompleted ? dependency : null;
    };
    blocked.forEach((task) => {
        if (stops.length >= MAX_STOPS || seen.has(task.key)) return;
        seen.add(task.key);
        let reason: DayPlanMessage | null = task.blockerNote ? literal(task.blockerNote) : null;
        if (!reason) {
            const dependency = firstOpenDependency(task);
            if (dependency) reason = message('dashboard.today.blockedRail.dependency', { title: dependency.title });
        }
        stops.push(stopFor(
            task,
            'followUp',
            'neutral',
            reason || message('dashboard.today.blockedRail.fallback'),
            { id: `follow:${task.key}`, canFocus: false }
        ));
    });

    // Quiet day: nothing dated drove the plan. Propose a plan from the backlog
    // so it is never empty — ranked by priority, then age. Undated personal
    // tasks are only ever suggestions.
    if (stops.length < 3) {
        const ageDays = (task: PlanTask) => {
            const created = toInstant(task.createdAt, timeZone);
            return created !== null ? Math.max(0, Math.floor((nowMs - created) / DAY_MS)) : 0;
        };
        const backlog = open
            .filter((task) => (
                !seen.has(task.key)
                && task.status !== 'Blocked'
                && !hasDateValue(task.dueDate)
                && !hasDateValue(task.scheduledDate)
            ))
            .sort((a, b) => (
                (priorityRank(a.priority) - priorityRank(b.priority))
                || (toInstantOrZero(a.createdAt, timeZone) - toInstantOrZero(b.createdAt, timeZone))
            ));

        backlog.forEach((task) => {
            if (stops.length >= MAX_SUGGESTED_STOPS || seen.has(task.key)) return;
            seen.add(task.key);
            const age = ageDays(task);
            let reason: DayPlanMessage;
            if (task.priority === 'Urgent' || task.priority === 'High') {
                reason = message('dashboard.route.suggest.important');
            } else if (age >= 7) {
                reason = message('dashboard.route.suggest.aged', { days: age });
            } else {
                reason = message('dashboard.route.suggest.pick');
            }
            stops.push(stopFor(task, 'suggestion', 'neutral', reason, { id: `suggest:${task.key}`, proposed: true }));
        });
    }

    const realCount = stops.filter((stop) => !stop.proposed).length;
    const isSuggested = stops.length > 0 && realCount === 0;

    const shownKeys = new Set(stops.map((stop) => (stop.isPersonal ? `personal:${stop.taskId}` : stop.taskId)));
    const moreCount = open.filter((task) => !shownKeys.has(task.key)).length;

    const undated = open.filter((task) => (
        !hasDateValue(task.dueDate) && !hasDateValue(task.scheduledDate) && task.status !== 'Blocked'
    )).length;

    // Statement -------------------------------------------------------------------
    const statement = ((): DayPlanStatement => {
        const make = (key: string, value: string | null, valueKey: string | null = null): DayPlanStatement => ({
            key,
            params: {},
            value,
            valueKey
        });
        if (stops.length === 0) {
            return make('dashboard.route.statement.clear', null, 'dashboard.route.statement.clearValue');
        }
        if (isSuggested) {
            return make(stops.length === 1 ? 'dashboard.route.statement.suggestOne' : 'dashboard.route.statement.suggest', String(stops.length));
        }
        if (queue.length === 0 && blocked.length > 0) {
            return make(blocked.length === 1 ? 'dashboard.route.statement.waitingOne' : 'dashboard.route.statement.waiting', String(blocked.length));
        }
        if (stops.length === 1) {
            return make('dashboard.route.statement.one', stops[0].title);
        }
        if (overdue.length > 0) {
            return make(
                stops[0].tone === 'danger' ? 'dashboard.route.statement.behind' : 'dashboard.route.statement.behindLater',
                String(stops.length)
            );
        }
        return make('dashboard.route.statement.clean', String(stops.length));
    })();

    // Day shape + cause line ------------------------------------------------------
    const dayShape: DayShape = (() => {
        if (queue.length === 0 && blocked.length > 0) return 'waiting';
        if (queue.length === 0) return 'clear';
        if (overdue.length > 0) return 'behind';
        if (queue.length >= 6) return 'heavy';
        return 'doable';
    })();

    const cause = ((): DayPlanMessage => {
        const oldestOverdue = overdue.length === 0 ? null : [...overdue].sort((a, b) => (
            dateSortKey(a.dueDate, timeZone) - dateSortKey(b.dueDate, timeZone)
        ))[0];

        // Project with the most queued tasks (ties: the one that appeared first).
        const loadCounts = new Map<string, number>();
        queue.forEach((task) => {
            if (!task.projectId) return;
            loadCounts.set(task.projectId, (loadCounts.get(task.projectId) || 0) + 1);
        });
        let leader: { title: string; count: number } | null = null;
        loadCounts.forEach((count, projectId) => {
            const title = projectTitle.get(projectId);
            if (!title) return;
            if (!leader || count > leader.count) leader = { title, count };
        });
        const leaderEntry = leader as { title: string; count: number } | null;

        if (dayShape === 'behind' && oldestOverdue) {
            const days = overdueDaysOf(oldestOverdue);
            if (days <= 1) return message('dashboard.today.insight.oldestOverdueOne', { title: oldestOverdue.title });
            return message('dashboard.today.insight.oldestOverdue', { days, title: oldestOverdue.title });
        }
        if (dayShape === 'waiting' && blocked.length > 0) {
            const first = blocked[0];
            if (first.blockerNote) {
                return message('dashboard.today.insight.blockedNote', { title: first.title, note: first.blockerNote });
            }
            return message('dashboard.today.insight.blockedPlain', { title: first.title });
        }
        if ((dayShape === 'heavy' || dayShape === 'doable') && leaderEntry && leaderEntry.count > 1) {
            return message('dashboard.today.insight.loadCenter', { project: leaderEntry.title, count: leaderEntry.count });
        }
        if ((dayShape === 'heavy' || dayShape === 'doable') && loadCounts.size > 1) {
            return message('dashboard.today.insight.spread', { count: loadCounts.size });
        }
        if (dayShape === 'clear' && focus && isActiveProject(focus.projectId)) {
            return message('dashboard.today.insight.focusOpen', { title: focus.title });
        }
        if (completedLast7Days.length > 0) {
            return message('dashboard.today.insight.momentum', { count: completedLast7Days.length });
        }
        return message('dashboard.today.insight.fresh');
    })();

    // Day band ----------------------------------------------------------------------
    const dueCount = queue.length - overdue.length;
    const cap = (count: number) => Math.min(count, BAND_CAP);
    const segments: DayPlanBandSegment[] = [];
    for (let i = 0; i < cap(overdue.length); i += 1) segments.push({ key: `overdue-${i}`, type: 'overdue', flex: 1.3 });
    for (let i = 0; i < cap(dueCount); i += 1) segments.push({ key: `due-${i}`, type: 'due', flex: 1 });
    for (let i = 0; i < cap(blocked.length); i += 1) segments.push({ key: `waiting-${i}`, type: 'waiting', flex: 0.8 });
    const used = segments.reduce((sum, segment) => sum + segment.flex, 0);
    segments.push({ key: 'rest', type: 'rest', flex: Math.round(Math.max(used > 0 ? 2 : 8, 8 - used) * 1000) / 1000 });

    const caption: DayPlanBandPart[] = [];
    if (overdue.length > 0) caption.push({ key: 'overdue', tone: 'danger', count: overdue.length });
    if (dueCount > 0) caption.push({ key: 'due', tone: 'warning', count: dueCount });
    if (blocked.length > 0) caption.push({ key: 'waiting', tone: 'neutral', count: blocked.length });

    // Week strip + badge ---------------------------------------------------------------
    const monday = addDays(today, -weekdayIndex(today));
    const dayCounts = new Map<string, number>();
    const bump = (value: DateLike) => {
        const day = dayOf(value);
        if (day) dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    };
    open.forEach((task) => {
        bump(task.dueDate);
        if (task.scheduledDate) bump(task.scheduledDate);
    });
    input.projects.forEach((project) => bump(project.dueDate));
    const days: DayPlanWeekDay[] = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(monday, index);
        return {
            date,
            weekday: index,
            count: dayCounts.get(date) || 0,
            isToday: date === today,
            isWeekend: index >= 5
        };
    });
    const weekTotal = days.reduce((sum, day) => sum + day.count, 0);

    const badge = ((): DayPlanMessage => {
        const current = completedLast7Days.length;
        const previous = completedPrevious7Days.length;
        if (current === 0) return message('dashboard.week.none');
        if (current > previous) return message('dashboard.week.more', { count: current, diff: current - previous });
        if (current < previous) return message('dashboard.week.fewer', { count: current, diff: previous - current });
        return message('dashboard.week.same', { count: current });
    })();

    // Overnight (last 24 hours). Personal tasks only appear as "became overdue". -----------
    const dayAgo = nowMs - DAY_MS;
    const overnightAll: DayPlanNightEntry[] = [];
    mine.forEach((task) => {
        const completedMs = toInstantOrZero(task.completedAt, timeZone);
        if (task.isCompleted && completedMs >= dayAgo) {
            overnightAll.push({
                key: `done:${task.id}`,
                kind: 'done',
                taskId: task.id,
                title: task.title,
                timeMs: completedMs,
                time: clockLabel(completedMs, timeZone),
                tone: 'success'
            });
            return;
        }
        const createdMs = toInstantOrZero(task.createdAt, timeZone);
        if (!task.isCompleted && createdMs >= dayAgo) {
            overnightAll.push({
                key: `new:${task.id}`,
                kind: 'new',
                taskId: task.id,
                title: task.title,
                timeMs: createdMs,
                time: clockLabel(createdMs, timeZone),
                tone: 'info'
            });
        }
    });
    overdue.forEach((task) => {
        const day = dayOf(task.dueDate);
        if (day !== null && daysBetween(day, today) === 1) {
            overnightAll.push({
                key: `overdue:${task.key}`,
                kind: 'overdue',
                taskId: task.id,
                title: task.title,
                timeMs: todayStart,
                time: '00:00',
                tone: 'warning'
            });
        }
    });
    const overnight = overnightAll
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => (a.entry.timeMs - b.entry.timeMs) || (a.index - b.index))
        .map(({ entry }) => entry)
        .slice(-MAX_OVERNIGHT);

    // Waiting on me -------------------------------------------------------------------------
    const myOpenById = new Map(openMine.map((task) => [task.id, task]));
    const dependents: Array<{ entry: DayPlanWaitingEntry; sortKey: number }> = [];
    openOthers.forEach((task) => {
        const blockerId = (task.dependencies || []).find((dependencyId) => myOpenById.has(dependencyId));
        if (!blockerId) return;
        const blocker = myOpenById.get(blockerId) as PlanTask;
        dependents.push({
            sortKey: dateSortKey(blocker.dueDate || blocker.scheduledDate, timeZone),
            entry: {
                kind: 'dependent',
                taskId: task.id,
                title: task.title,
                projectId: task.projectId || null,
                projectName: projectLabel(task.projectId),
                assigneeIds: [...(task.assigneeIds || [])],
                blockerTaskId: blocker.id,
                blockerTitle: blocker.title,
                note: null
            }
        });
    });
    const waitingOnMe: DayPlanWaitingEntry[] = [
        ...dependents
            .map((item, index) => ({ ...item, index }))
            .sort((a, b) => (a.sortKey - b.sortKey) || (a.index - b.index))
            .map((item) => item.entry),
        ...blocked.map((task): DayPlanWaitingEntry => {
            const dependency = firstOpenDependency(task);
            return {
                kind: 'blocked',
                taskId: task.id,
                title: task.title,
                projectId: task.projectId || null,
                projectName: projectLabel(task.projectId),
                assigneeIds: [],
                blockerTaskId: dependency ? dependency.id : null,
                blockerTitle: dependency ? dependency.title : null,
                note: task.blockerNote || null
            };
        })
    ];

    // Top unlocker (feeds the "accent" insight on the portfolio slide). ------------------------
    let topUnlocker: DayPlanUnlocker | null = null;
    openMine.forEach((task) => {
        const count = unblocks[task.id] || 0;
        if (count > 0 && (!topUnlocker || count > topUnlocker.count)) {
            topUnlocker = { taskId: task.id, title: task.title, count };
        }
    });

    return {
        today,
        timeZone,
        stops,
        moreCount,
        isSuggested,
        statement,
        dayShape,
        cause,
        counts: {
            overdue: overdue.length,
            dueToday: dueToday.length,
            scheduledToday: scheduledToday.length,
            queue: queue.length,
            blocked: blocked.length,
            open: open.length,
            undated,
            completedLast7Days: completedLast7Days.length,
            completedPrevious7Days: completedPrevious7Days.length
        },
        band: { segments, caption },
        week: { badge, days, total: weekTotal },
        overnight,
        waitingOnMe,
        topUnlocker
    };
};
