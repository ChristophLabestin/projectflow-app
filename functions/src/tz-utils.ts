// Pure time-zone helpers (no Firebase imports) shared by reminders and nudges.
// Everything is built on Intl so DST changes are handled by the runtime's tz database.

export const DEFAULT_TIMEZONE = 'Europe/Berlin';

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone: string): Intl.DateTimeFormat => {
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

export const isValidTimeZone = (value: unknown): value is string => {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
        getFormatter(value);
        return true;
    } catch {
        return false;
    }
};

export const resolveTimeZone = (value: unknown, fallback: string = DEFAULT_TIMEZONE): string =>
    isValidTimeZone(value) ? value : fallback;

export interface ZonedParts {
    year: number;
    month: number; // 1-12
    day: number;
    hour: number;
    minute: number;
    second: number;
}

export const zonedParts = (utcMs: number, timeZone: string): ZonedParts => {
    const parts = getFormatter(timeZone).formatToParts(new Date(utcMs));
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return {
        year: read('year'),
        month: read('month'),
        day: read('day'),
        hour: read('hour') % 24,
        minute: read('minute'),
        second: read('second')
    };
};

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

/** Local calendar day (`YYYY-MM-DD`) of an instant in the given zone. */
export const localDateKey = (utcMs: number, timeZone: string): string => {
    const p = zonedParts(utcMs, timeZone);
    return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
};

/** Minutes since local midnight of an instant in the given zone. */
export const localMinutes = (utcMs: number, timeZone: string): number => {
    const p = zonedParts(utcMs, timeZone);
    return p.hour * 60 + p.minute;
};

/** Offset (ms) of `timeZone` from UTC at the given instant: local = utc + offset. */
export const zoneOffsetMs = (utcMs: number, timeZone: string): number => {
    const p = zonedParts(utcMs, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - Math.floor(utcMs / 1000) * 1000;
};

/** UTC instant of a wall-clock time in a zone (DST-safe; gaps resolve forward). */
export const zonedTimeToUtcMs = (
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    timeZone: string
): number => {
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    const first = guess - zoneOffsetMs(guess, timeZone);
    const second = guess - zoneOffsetMs(first, timeZone);
    return second;
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isDateOnly = (value: unknown): value is string => typeof value === 'string' && DATE_ONLY.test(value.trim());

export const parseDateOnly = (value: string): { year: number; month: number; day: number } | null => {
    const match = DATE_ONLY.exec(value.trim());
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

/** `HH:mm` -> minutes since midnight, or null when malformed. */
export const parseClock = (value: unknown): number | null => {
    if (typeof value !== 'string') return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
};
