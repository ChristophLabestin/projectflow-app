// Date helpers for task/project date fields.
//
// Due/start dates are stored as date-only ISO strings ("2026-09-22").
// `new Date("2026-09-22")` parses that as UTC midnight, which renders as
// "02:00" in Germany and as the previous day west of UTC, and makes a task
// that is due today count as overdue after midnight UTC. Always parse through
// `parseDateValue` and compare whole days with the helpers below.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Like `new Date(value)`, but date-only strings become local midnight. */
export const parseDateValue = (value: unknown): Date => {
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === 'string' && DATE_ONLY.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
    }
    if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate();
    }
    return new Date(value as string | number);
};

/** True when the value carries a real time of day (not a date-only field). */
export const hasTimeComponent = (value: unknown) => typeof value === 'string' && !DATE_ONLY.test(value) && value.includes('T');

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Whole-day difference between the date and today (negative = past). */
export const daysFromToday = (value: unknown, now: Date = new Date()): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const date = parseDateValue(value);
    if (Number.isNaN(date.getTime())) return null;
    return Math.round((startOfLocalDay(date).getTime() - startOfLocalDay(now).getTime()) / 86400000);
};

/** Overdue = the due *day* is before today. A task due today is not overdue. */
export const isDateOverdue = (value: unknown, now: Date = new Date()) => {
    const diff = daysFromToday(value, now);
    return diff !== null && diff < 0;
};

export const isDateToday = (value: unknown, now: Date = new Date()) => daysFromToday(value, now) === 0;

export type DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none';

/** Groups a due date for "what should I do next" lists. */
export const getDueBucket = (value: unknown, now: Date = new Date()): DueBucket => {
    const diff = daysFromToday(value, now);
    if (diff === null) return 'none';
    if (diff < 0) return 'overdue';
    if (diff === 0) return 'today';
    if (diff <= 7) return 'week';
    return 'later';
};
