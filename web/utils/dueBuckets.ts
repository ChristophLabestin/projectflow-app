// Pure "My tasks" grouping by due date (web work list, iOS "Arbeit").
//
// Overdue → Today → Next 7 days → Later → No date → Completed. Extracted from
// components/work/workList.ts so web and iOS group identically. No React /
// Firebase imports, no system clock. Behaviour is pinned by golden fixtures in
// shared/fixtures/dueBuckets/ — see shared/fixtures/README.md.

import {
    daysBetween,
    dateSortKey,
    resolveTimeZone,
    toDay,
    toInstantOrZero,
    type DateLike
} from './zonedDate';

export type DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none';
export type DueGroupKey = DueBucket | 'done';

export interface DueBucketTask {
    id: string;
    title: string;
    dueDate?: DateLike;
    priority?: string | null;
    status?: string | null;
    isCompleted?: boolean | null;
}

export interface DueContext {
    /** The current moment (instant). */
    now: DateLike;
    /** IANA time zone that defines "today". Defaults to the runtime's zone. */
    timeZone?: string | null;
}

export interface DueGroup<T extends DueBucketTask = DueBucketTask> {
    key: DueGroupKey;
    tasks: T[];
}

export interface DueSummary {
    overdue: number;
    today: number;
    /** Due within the next 7 days (tomorrow … today + 7). */
    week: number;
    /** Open tasks in total. */
    open: number;
}

export const DUE_GROUP_ORDER: DueGroupKey[] = ['overdue', 'today', 'week', 'later', 'none', 'done'];

const PRIORITY_RANK: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

/** `Todo` is a legacy alias of `Open`; completed tasks always read as `Done`. */
export const normalizeStatus = (task: { isCompleted?: boolean | null; status?: string | null }): string => {
    if (task.isCompleted) return 'Done';
    if (!task.status || task.status === 'Todo') return 'Open';
    return task.status;
};

const todayOf = (context: DueContext) => {
    const timeZone = resolveTimeZone(context.timeZone);
    const nowMs = toInstantOrZero(context.now, timeZone);
    return { timeZone, today: toDay(nowMs, timeZone) as string };
};

/** Whole days between today and the due day (negative = past), or `null` without a valid date. */
export const daysUntilDue = (value: DateLike, context: DueContext): number | null => {
    const { timeZone, today } = todayOf(context);
    const day = toDay(value, timeZone);
    return day === null ? null : daysBetween(today, day);
};

const bucketForDiff = (diff: number | null): DueBucket => {
    if (diff === null) return 'none';
    if (diff < 0) return 'overdue';
    if (diff === 0) return 'today';
    if (diff <= 7) return 'week';
    return 'later';
};

/** Groups a due date for "what should I do next" lists. */
export const getDueBucket = (value: DateLike, context: DueContext): DueBucket => (
    bucketForDiff(daysUntilDue(value, context))
);

/** Earliest due first (undated last), then higher priority, then title. */
export const compareWork = (a: DueBucketTask, b: DueBucketTask, timeZone?: string | null) => {
    const zone = resolveTimeZone(timeZone);
    return (
        dateSortKey(a.dueDate, zone) - dateSortKey(b.dueDate, zone)
        || (PRIORITY_RANK[b.priority || 'Medium'] || 0) - (PRIORITY_RANK[a.priority || 'Medium'] || 0)
        || a.title.localeCompare(b.title)
    );
};

/**
 * Splits tasks into the ordered due groups (empty groups are omitted).
 * Open tasks are sorted with `compareWork`; completed tasks form a trailing
 * `done` group sorted by due date, latest first (undated first).
 */
export const groupByDueBucket = <T extends DueBucketTask>(tasks: T[], context: DueContext): Array<DueGroup<T>> => {
    const { timeZone, today } = todayOf(context);
    const open = tasks.filter((task) => !task.isCompleted).sort((a, b) => compareWork(a, b, timeZone));
    const done = tasks.filter((task) => task.isCompleted);
    const bucketOf = (task: T): DueBucket => {
        const day = toDay(task.dueDate, timeZone);
        return bucketForDiff(day === null ? null : daysBetween(today, day));
    };

    const groups: Array<DueGroup<T>> = (['overdue', 'today', 'week', 'later', 'none'] as DueBucket[]).map((key) => ({
        key,
        tasks: open.filter((task) => bucketOf(task) === key)
    }));
    groups.push({
        key: 'done',
        tasks: [...done].sort((a, b) => dateSortKey(b.dueDate, timeZone) - dateSortKey(a.dueDate, timeZone))
    });
    return groups.filter((group) => group.tasks.length > 0);
};

/** Summary counts for the page header ("2 overdue · 1 today · 4 this week"). */
export const summarizeDue = (tasks: DueBucketTask[], context: DueContext): DueSummary => {
    const summary: DueSummary = { overdue: 0, today: 0, week: 0, open: 0 };
    const { timeZone, today } = todayOf(context);
    tasks.forEach((task) => {
        if (task.isCompleted) return;
        summary.open += 1;
        const day = toDay(task.dueDate, timeZone);
        const diff = day === null ? null : daysBetween(today, day);
        if (diff === null) return;
        if (diff < 0) summary.overdue += 1;
        else if (diff === 0) summary.today += 1;
        else if (diff <= 7) summary.week += 1;
    });
    return summary;
};
