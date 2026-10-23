// Pure nudge logic (contract C3): local-time windows, the simplified server "day plan" and the copy.
// No Firebase imports. Unit tested in functions/scripts/unit/nudge-logic.test.js.
import { ResolvedNotificationPrefs } from './notification-prefs';
import { dueString, idPart, Json, toMillis } from './task-effects';
import { isDateOnly, localDateKey, localMinutes, parseClock } from './tz-utils';

export type NudgeType = 'morning_briefing' | 'task_due_today' | 'day_close';
export type NudgeLanguage = 'de' | 'en';

export const NUDGE_GRACE_MINUTES = 90;
export const DEFAULT_DUE_TODAY_TIME = '08:00';

export const resolveNudgeLanguage = (value: unknown): NudgeLanguage =>
    typeof value === 'string' && value.toLowerCase().startsWith('de') ? 'de' : 'en';

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/**
 * True when `now` (in `timeZone`) is inside [time, time + grace) of the same local day. The grace
 * window makes the job tolerant to skipped ticks, but stops a "morning" briefing from firing
 * hours late when someone switches the setting on in the afternoon.
 */
export const isNudgeWindowOpen = (
    nowMs: number,
    timeZone: string,
    time: string,
    graceMinutes: number = NUDGE_GRACE_MINUTES
): boolean => {
    const start = parseClock(time);
    if (start === null) return false;
    const minutes = localMinutes(nowMs, timeZone);
    return minutes >= start && minutes < Math.min(start + graceMinutes, 24 * 60);
};

export interface NudgeEligibility {
    prefs: ResolvedNotificationPrefs;
    /** The user has at least one FCM token (web or iOS). */
    hasPushToken: boolean;
}

/**
 * Nudge types whose local-time window is open now (before the nudgeLog check).
 * - morning_briefing / day_close are opt-in (`enabled`).
 * - task_due_today needs a delivery channel (push token with push.due, or email.due) so web-only users
 *   without push do not get a daily in-app doc; it fires at the briefing time (08:00 if no briefing).
 */
export const dueNudgeTypes = (nowMs: number, eligibility: NudgeEligibility): NudgeType[] => {
    const { prefs, hasPushToken } = eligibility;
    const tz = prefs.timezone;
    const out: NudgeType[] = [];

    if (prefs.morningBriefing.enabled && isNudgeWindowOpen(nowMs, tz, prefs.morningBriefing.time)) {
        out.push('morning_briefing');
    }

    const dueTime = prefs.morningBriefing.enabled ? prefs.morningBriefing.time : DEFAULT_DUE_TODAY_TIME;
    const dueChannel = (hasPushToken && prefs.push.due) || prefs.email.due;
    if (dueChannel && isNudgeWindowOpen(nowMs, tz, dueTime)) {
        out.push('task_due_today');
    }

    if (prefs.dayClose.enabled && isNudgeWindowOpen(nowMs, tz, prefs.dayClose.time)) {
        out.push('day_close');
    }
    return out;
};

/** Overdue check runs once the local clock reached the due-today time (08:00 default); independent of the nudge toggles. */
export const isOverdueCheckDue = (nowMs: number, prefs: ResolvedNotificationPrefs): boolean => {
    const time = prefs.morningBriefing.enabled ? prefs.morningBriefing.time : DEFAULT_DUE_TODAY_TIME;
    const start = parseClock(time);
    return start !== null && localMinutes(nowMs, prefs.timezone) >= start;
};

export const MAX_OVERDUE_PER_RUN = 25;

export interface OverdueCandidate {
    taskId: string;
    projectId: string;
    tenantId: string;
    title: string;
    /** Due date as stored on the task. */
    dueDate: string;
    /** Local due day (YYYY-MM-DD) in the assignee's time zone. */
    dueKey: string;
    docId: string;
}

export const overdueDocId = (taskId: string, dueKey: string, uid: string): string =>
    `overdue-${idPart(taskId)}-${idPart(dueKey)}-${idPart(uid)}`;

/**
 * Open project tasks whose local due day is before the assignee's local today, most recent due day first.
 * The id contains the due day, so a notification is never duplicated and re-fires only after the due date changes.
 */
export const planOverdueNotifications = (tasks: DayTask[], nowMs: number, timeZone: string, uid: string): OverdueCandidate[] => {
    const today = localDateKey(nowMs, timeZone);
    const out: OverdueCandidate[] = [];
    for (const task of tasks) {
        if (!task.taskId || !task.projectId || !task.tenantId || !isOpenTask(task)) continue;
        const dueKey = localDayOf(task.dueDate, timeZone);
        if (!dueKey || dueKey >= today) continue;
        out.push({
            taskId: task.taskId,
            projectId: task.projectId,
            tenantId: task.tenantId,
            title: task.title,
            dueDate: dueString(task.dueDate),
            dueKey,
            docId: overdueDocId(task.taskId, dueKey, uid)
        });
    }
    return out.sort((a, b) => (a.dueKey < b.dueKey ? 1 : a.dueKey > b.dueKey ? -1 : 0));
};

export const nudgeDateKey = (nowMs: number, timeZone: string): string => localDateKey(nowMs, timeZone);

// ---------------------------------------------------------------------------
// Simplified day plan (server version of web/utils/dayPlan.ts)
// ---------------------------------------------------------------------------
//
// SIMPLIFICATION: the web "route" also ranks a focus item first, weights stops by how many tasks they
// unblock and proposes backlog suggestions on quiet days. The server only counts
//   stops   = open tasks that are overdue, due today or scheduled today (each task once)
//   waiting = open tasks with status Blocked that are not already a stop
// and picks the headline from the same keys as `dashboard.route.statement.*`:
//   nothing -> clear, only waiting -> waiting(One), one stop -> one, overdue -> behind, else clean.
// (`behindLater` and the `suggest*` variants need the focus / backlog context and are not used.)

export interface DayTask {
    id: string;
    title: string;
    dueDate?: unknown;
    scheduledDate?: unknown;
    status?: string;
    priority?: string;
    isCompleted?: boolean;
    /** Set for project tasks (not personal tasks): needed to address `task_overdue`. */
    taskId?: string;
    projectId?: string;
    tenantId?: string;
}

export interface DayStats {
    overdue: number;
    dueToday: number;
    scheduledToday: number;
    stops: number;
    waiting: number;
    stopTitles: string[]; // overdue first, then due today by priority, then scheduled
    dueTodayTitles: string[];
}

/** Local calendar day of a date-ish value; date-only strings are taken literally (no zone shift). */
export const localDayOf = (value: unknown, timeZone: string): string | null => {
    if (typeof value === 'string' && isDateOnly(value)) return value.trim();
    const millis = toMillis(value);
    return millis === null ? null : localDateKey(millis, timeZone);
};

const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const rank = (task: DayTask) => PRIORITY_RANK[task.priority || 'Medium'] ?? 2;

export const isOpenTask = (task: Json): boolean => task.isCompleted !== true && task.status !== 'Done';

export const computeDayStats = (tasks: DayTask[], nowMs: number, timeZone: string): DayStats => {
    const today = localDateKey(nowMs, timeZone);
    const overdue: Array<{ task: DayTask; day: string }> = [];
    const dueToday: DayTask[] = [];
    const scheduled: DayTask[] = [];
    const seen = new Set<string>();

    for (const task of tasks) {
        if (!isOpenTask(task)) continue;
        const due = localDayOf(task.dueDate, timeZone);
        if (due && due < today) {
            overdue.push({ task, day: due });
            seen.add(task.id);
        } else if (due && due === today) {
            dueToday.push(task);
            seen.add(task.id);
        }
    }
    for (const task of tasks) {
        if (!isOpenTask(task) || seen.has(task.id)) continue;
        if (localDayOf(task.scheduledDate, timeZone) === today) {
            scheduled.push(task);
            seen.add(task.id);
        }
    }

    overdue.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : rank(a.task) - rank(b.task)));
    dueToday.sort((a, b) => rank(a) - rank(b));

    const waiting = tasks.filter((task) => isOpenTask(task) && task.status === 'Blocked' && !seen.has(task.id)).length;

    return {
        overdue: overdue.length,
        dueToday: dueToday.length,
        scheduledToday: scheduled.length,
        stops: seen.size,
        waiting,
        stopTitles: [...overdue.map((item) => item.task.title), ...dueToday.map((task) => task.title), ...scheduled.map((task) => task.title)],
        dueTodayTitles: dueToday.map((task) => task.title)
    };
};

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

type CopyKey =
    | 'dashboard.route.statement.behind'
    | 'dashboard.route.statement.clean'
    | 'dashboard.route.statement.one'
    | 'dashboard.route.statement.waiting'
    | 'dashboard.route.statement.waitingOne'
    | 'dashboard.route.statement.clear'
    | 'dashboard.route.statement.clearValue'
    | 'dashboard.band.overdue'
    | 'dashboard.band.due'
    | 'dashboard.band.waiting'
    | 'dashboard.band.allFree'
    | 'nudge.dueToday.title'
    | 'nudge.dueToday.titleOne'
    | 'nudge.dayClose.title'
    | 'nudge.dayClose.open'
    | 'nudge.dayClose.openOne'
    | 'nudge.dayClose.clear'
    | 'reminder.task'
    | 'reminder.project'
    | 'reminder.fallbackTitle';

// The `dashboard.*` strings are copied from web/locales/dashboard-{de,en}.ts - keep them in sync.
export const NUDGE_COPY: Record<NudgeLanguage, Record<CopyKey, string>> = {
    en: {
        'dashboard.route.statement.behind': 'Today is {value} moves — the first one is on fire.',
        'dashboard.route.statement.clean': 'Today is {value} moves — none of them is burning.',
        'dashboard.route.statement.one': 'One single move today: {value}.',
        'dashboard.route.statement.waiting': '{value} tasks are waiting on others — today is for following up.',
        'dashboard.route.statement.waitingOne': '{value} task is waiting on others — today is for following up.',
        'dashboard.route.statement.clear': '{value} — the day is yours.',
        'dashboard.route.statement.clearValue': 'Nothing is due',
        'dashboard.band.overdue': '{count} overdue',
        'dashboard.band.due': '{count} today',
        'dashboard.band.waiting': '{count} waiting on others',
        'dashboard.band.allFree': 'the whole day is yours',
        'nudge.dueToday.title': '{count} tasks due today',
        'nudge.dueToday.titleOne': '1 task due today',
        'nudge.dayClose.title': 'Wrap up the day',
        'nudge.dayClose.open': '{count} tasks are still open. Sort them out or move them to tomorrow.',
        'nudge.dayClose.openOne': '1 task is still open. Finish it or move it to tomorrow.',
        'nudge.dayClose.clear': 'Everything planned is done. Time to close the day.',
        'reminder.task': 'Task: "{title}"',
        'reminder.project': 'Project: "{title}"',
        'reminder.fallbackTitle': 'Reminder'
    },
    de: {
        'dashboard.route.statement.behind': 'Heute ist in {value} Zügen erledigt — der erste brennt.',
        'dashboard.route.statement.clean': 'Heute ist in {value} Zügen erledigt — nichts davon brennt.',
        'dashboard.route.statement.one': 'Heute ist ein einziger Zug: {value}.',
        'dashboard.route.statement.waiting': '{value} Aufgaben warten auf andere — heute wird nachgehakt.',
        'dashboard.route.statement.waitingOne': '{value} Aufgabe wartet auf andere — heute wird nachgehakt.',
        'dashboard.route.statement.clear': '{value} — der Tag gehört dir.',
        'dashboard.route.statement.clearValue': 'Nichts ist fällig',
        'dashboard.band.overdue': '{count} überfällig',
        'dashboard.band.due': '{count} heute',
        'dashboard.band.waiting': '{count} warten auf andere',
        'dashboard.band.allFree': 'der ganze Tag ist frei',
        'nudge.dueToday.title': '{count} Aufgaben heute fällig',
        'nudge.dueToday.titleOne': '1 Aufgabe heute fällig',
        'nudge.dayClose.title': 'Tagesabschluss',
        'nudge.dayClose.open': '{count} Aufgaben sind noch offen. Kurz sortieren oder auf morgen schieben.',
        'nudge.dayClose.openOne': '1 Aufgabe ist noch offen. Abschließen oder auf morgen schieben.',
        'nudge.dayClose.clear': 'Alles Geplante ist erledigt. Zeit für den Tagesabschluss.',
        'reminder.task': 'Aufgabe: „{title}"',
        'reminder.project': 'Projekt: „{title}"',
        'reminder.fallbackTitle': 'Erinnerung'
    }
};

export const copyText = (lang: NudgeLanguage, key: CopyKey, vars: Record<string, string | number> = {}): string =>
    Object.entries(vars).reduce(
        (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
        NUDGE_COPY[lang][key]
    );

const upperFirst = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

export interface NudgeCopy {
    title: string;
    message: string;
}

export const buildBriefingCopy = (lang: NudgeLanguage, stats: DayStats): NudgeCopy => {
    let title: string;
    if (stats.stops === 0 && stats.waiting === 0) {
        title = copyText(lang, 'dashboard.route.statement.clear', { value: copyText(lang, 'dashboard.route.statement.clearValue') });
    } else if (stats.stops === 0) {
        title = copyText(lang, stats.waiting === 1 ? 'dashboard.route.statement.waitingOne' : 'dashboard.route.statement.waiting', { value: stats.waiting });
    } else if (stats.stops === 1) {
        title = copyText(lang, 'dashboard.route.statement.one', { value: stats.stopTitles[0] });
    } else if (stats.overdue > 0) {
        title = copyText(lang, 'dashboard.route.statement.behind', { value: stats.stops });
    } else {
        title = copyText(lang, 'dashboard.route.statement.clean', { value: stats.stops });
    }

    const parts: string[] = [];
    if (stats.overdue > 0) parts.push(copyText(lang, 'dashboard.band.overdue', { count: stats.overdue }));
    const todayCount = stats.dueToday + stats.scheduledToday;
    if (todayCount > 0) parts.push(copyText(lang, 'dashboard.band.due', { count: todayCount }));
    if (stats.waiting > 0) parts.push(copyText(lang, 'dashboard.band.waiting', { count: stats.waiting }));
    const message = parts.length > 0 ? parts.join(' · ') : upperFirst(copyText(lang, 'dashboard.band.allFree'));
    return { title, message };
};

export const buildDueTodayCopy = (lang: NudgeLanguage, stats: DayStats): NudgeCopy | null => {
    if (stats.dueToday === 0) return null;
    return {
        title: copyText(lang, stats.dueToday === 1 ? 'nudge.dueToday.titleOne' : 'nudge.dueToday.title', { count: stats.dueToday }),
        message: stats.dueTodayTitles.slice(0, 3).join(' · ') + (stats.dueTodayTitles.length > 3 ? ' …' : '')
    };
};

export const buildDayCloseCopy = (lang: NudgeLanguage, stats: DayStats): NudgeCopy => ({
    title: copyText(lang, 'nudge.dayClose.title'),
    message: stats.stops === 0
        ? copyText(lang, 'nudge.dayClose.clear')
        : copyText(lang, stats.stops === 1 ? 'nudge.dayClose.openOne' : 'nudge.dayClose.open', { count: stats.stops })
});

export const DEEP_LINKS: Record<NudgeType, string> = {
    morning_briefing: '/',
    task_due_today: '/tasks',
    day_close: '/?mode=close'
};
