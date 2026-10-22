// Pure, time-zone aware date helpers shared by `dayPlan`, `dueBuckets` and
// `attention` (golden-fixture modules, see shared/fixtures/README.md).
//
// No React / Firebase imports. "Today" is never read from the system clock:
// callers pass an explicit `now` and an IANA `timeZone`, so the same input
// gives the same output on every machine and in every runtime.
//
// Vocabulary
//   instant  – a point in time, milliseconds since the Unix epoch.
//   day      – a calendar day as "YYYY-MM-DD" (no time zone attached).
//
// Date-only strings ("2026-09-22") are *days*, not instants: they never shift
// with the time zone. Everything else (ISO date-times, Timestamps, epoch ms)
// is an instant and becomes a day by looking at the wall clock in `timeZone`.

export type DateLike =
    | string
    | number
    | Date
    | { seconds: number; nanoseconds?: number }
    | { _seconds: number; _nanoseconds?: number }
    | { toDate: () => Date }
    | null
    | undefined;

export const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

export const browserTimeZone = (): string => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
};

export const resolveTimeZone = (timeZone?: string | null): string => timeZone || browserTimeZone();

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string) => {
    let formatter = formatterCache.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        formatterCache.set(timeZone, formatter);
    }
    return formatter;
};

interface WallClock {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

const wallClockAt = (instant: number, timeZone: string): WallClock => {
    const parts: Record<string, number> = {};
    formatterFor(timeZone).formatToParts(new Date(instant)).forEach((part) => {
        if (part.type !== 'literal') parts[part.type] = Number(part.value);
    });
    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: parts.hour === 24 ? 0 : parts.hour,
        minute: parts.minute,
        second: parts.second
    };
};

/** Offset of `timeZone` from UTC at `instant`, in milliseconds (east positive). */
const offsetAt = (instant: number, timeZone: string): number => {
    const wall = wallClockAt(instant, timeZone);
    const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
    return asUtc - Math.floor(instant / 1000) * 1000;
};

/** The instant at which the wall clock in `timeZone` reads the given fields. */
export const wallTimeToInstant = (
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    timeZone: string
): number => {
    const guess = Date.UTC(year, month - 1, day, hour, minute, second);
    const firstOffset = offsetAt(guess, timeZone);
    const first = guess - firstOffset;
    const secondOffset = offsetAt(first, timeZone);
    return secondOffset === firstOffset ? first : guess - secondOffset;
};

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

export const formatDay = (year: number, month: number, day: number) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

/** Calendar day ("YYYY-MM-DD") that `instant` falls on in `timeZone`. */
export const dayOfInstant = (instant: number, timeZone: string): string => {
    const wall = wallClockAt(instant, timeZone);
    return formatDay(wall.year, wall.month, wall.day);
};

/** Days since 1970-01-01 for a "YYYY-MM-DD" day (pure calendar arithmetic). */
export const dayNumber = (day: string): number => {
    const match = DATE_ONLY.exec(day);
    if (!match) return Number.NaN;
    return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS);
};

export const addDays = (day: string, amount: number): string => {
    const date = new Date((dayNumber(day) + amount) * DAY_MS);
    return formatDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

/** Whole days from `from` to `to` (positive when `to` is later). */
export const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from);

/** Monday = 0 … Sunday = 6. */
export const weekdayIndex = (day: string): number => {
    const date = new Date(dayNumber(day) * DAY_MS);
    return (date.getUTCDay() + 6) % 7;
};

/** The instant at which `day` starts in `timeZone`. */
export const startOfDay = (day: string, timeZone: string): number => {
    const match = DATE_ONLY.exec(day);
    if (!match) return Number.NaN;
    return wallTimeToInstant(Number(match[1]), Number(match[2]), Number(match[3]), 0, 0, 0, timeZone);
};

/** "HH:mm" (24 h) wall-clock time of `instant` in `timeZone`. */
export const clockLabel = (instant: number, timeZone: string): string => {
    const wall = wallClockAt(instant, timeZone);
    return `${pad(wall.hour)}:${pad(wall.minute)}`;
};

const parseOffset = (raw: string): number => {
    if (raw.toUpperCase() === 'Z') return 0;
    const sign = raw.startsWith('-') ? -1 : 1;
    const digits = raw.slice(1).replace(':', '');
    const hours = Number(digits.slice(0, 2));
    const minutes = digits.length > 2 ? Number(digits.slice(2, 4)) : 0;
    return sign * (hours * 60 + minutes) * 60 * 1000;
};

/** True when the value is a date-only string ("2026-09-22"). */
export const isDateOnly = (value: unknown): value is string => typeof value === 'string' && DATE_ONLY.test(value.trim());

/**
 * Instant for any supported date value, or `null` when there is none.
 *
 * - number: epoch milliseconds
 * - Date / object with `toDate()`
 * - `{ seconds, nanoseconds }` (also `_seconds`): Firestore Timestamp; the
 *   nanoseconds are ignored (whole seconds only)
 * - ISO date-time with offset ("…Z", "+02:00"): exact instant
 * - ISO date-time without offset: wall-clock time in `timeZone`
 * - date-only string: the start of that day in `timeZone`
 * - anything else: the platform date parser (not covered by fixtures)
 */
export const toInstant = (value: DateLike | unknown, timeZone: string): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
    if (typeof value === 'string') {
        const text = value.trim();
        const dateOnly = DATE_ONLY.exec(text);
        if (dateOnly) return startOfDay(text, timeZone);
        const dateTime = DATE_TIME.exec(text);
        if (dateTime) {
            const [, year, month, day, hour, minute, second, offset] = dateTime;
            const fields = [year, month, day, hour, minute, second || '0'].map(Number) as [number, number, number, number, number, number];
            if (offset) {
                return Date.UTC(fields[0], fields[1] - 1, fields[2], fields[3], fields[4], fields[5]) - parseOffset(offset);
            }
            return wallTimeToInstant(fields[0], fields[1], fields[2], fields[3], fields[4], fields[5], timeZone);
        }
        const parsed = new Date(text).getTime();
        return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        if (typeof record.toDate === 'function') {
            const date = (record.toDate as () => unknown)();
            return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
        }
        if (typeof record.seconds === 'number') return record.seconds * 1000;
        if (typeof record._seconds === 'number') return record._seconds * 1000;
    }
    return null;
};

/** Like `toInstant`, but missing/invalid values read as 0 (the legacy `toMillis`). */
export const toInstantOrZero = (value: DateLike | unknown, timeZone: string): number => toInstant(value, timeZone) ?? 0;

/** Calendar day ("YYYY-MM-DD") of any supported date value, or `null`. */
export const toDay = (value: DateLike | unknown, timeZone: string): string | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string' && DATE_ONLY.test(value.trim())) return value.trim();
    const instant = toInstant(value, timeZone);
    return instant === null ? null : dayOfInstant(instant, timeZone);
};

/**
 * Sort key of a due/scheduled date: the instant, with date-only values at the
 * start of their day. Missing values sort last (`Number.MAX_SAFE_INTEGER`).
 */
export const dateSortKey = (value: DateLike | unknown, timeZone: string): number => {
    const instant = value ? toInstant(value, timeZone) : null;
    return instant === null ? Number.MAX_SAFE_INTEGER : instant;
};

/** Truthy check used for "has a due date": mirrors `Boolean(task.dueDate)`. */
export const hasDateValue = (value: DateLike | unknown): boolean => Boolean(value);
