// Date helpers for task/project date fields.
//
// Due/start dates are stored as date-only ISO strings ("2026-09-22").
// `new Date("2026-09-22")` parses that as UTC midnight, which renders as
// "02:00" in Germany and as the previous day west of UTC, and makes a task
// that is due today count as overdue after midnight UTC. Always parse through
// `parseDateValue` and compare whole days with the helpers below.

import { getDueBucket as getPureDueBucket, type DueBucket } from './dueBuckets';
import { daysBetween, resolveTimeZone, toDay } from './zonedDate';

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

/**
 * Whole-day difference between the date and today (negative = past).
 * Calendar math lives in `zonedDate` (shared with the golden-fixture modules);
 * here "today" is the browser's local day.
 */
export const daysFromToday = (value: unknown, now: Date = new Date()): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const timeZone = resolveTimeZone();
    const day = toDay(value, timeZone);
    const today = toDay(now.getTime(), timeZone);
    if (day === null || today === null) return null;
    return daysBetween(today, day);
};

/** Overdue = the due *day* is before today. A task due today is not overdue. */
export const isDateOverdue = (value: unknown, now: Date = new Date()) => {
    const diff = daysFromToday(value, now);
    return diff !== null && diff < 0;
};

export const isDateToday = (value: unknown, now: Date = new Date()) => daysFromToday(value, now) === 0;

export type { DueBucket };

/** Groups a due date for "what should I do next" lists. */
export const getDueBucket = (value: unknown, now: Date = new Date()): DueBucket => (
    getPureDueBucket(value as string | number | Date | null | undefined, { now: now.getTime() })
);

/** Local calendar date as a date-only ISO string ("2026-09-26"). */
export const toIsoDate = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
};

export const addDaysFromToday = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
};

/** The coming Monday (never today). */
export const nextMonday = () => {
    const date = new Date();
    const offset = ((8 - date.getDay()) % 7) || 7;
    date.setDate(date.getDate() + offset);
    return date;
};
