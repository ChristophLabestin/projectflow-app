// Pure reminder logic (contract C2). No Firebase imports.
import { effectiveAssignees, Json } from './task-effects';
import { DEFAULT_TIMEZONE, isDateOnly, parseDateOnly, zonedTimeToUtcMs } from './tz-utils';

/** Local time a date-only `remindAt` (what the web date picker writes) fires at. */
export const DATE_ONLY_REMINDER_TIME = { hour: 8, minute: 0 };

/** Legacy reminders (no `createdBy`) older than this at the first scan are closed without sending. */
export const LEGACY_STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Instant a reminder is due. Full timestamps are used as is. A date-only value (`YYYY-MM-DD`) means
 * 08:00 in `timeZone` (default Europe/Berlin, the notification-prefs default): the server has one
 * `nextReminderAt` per doc, so it cannot use every recipient's own zone.
 */
export const reminderInstantMs = (remindAt: unknown, timeZone: string = DEFAULT_TIMEZONE): number | null => {
    if (typeof remindAt !== 'string' || !remindAt.trim()) return null;
    const value = remindAt.trim();
    if (isDateOnly(value)) {
        const parts = parseDateOnly(value);
        if (!parts) return null;
        return zonedTimeToUtcMs(parts.year, parts.month, parts.day, DATE_ONLY_REMINDER_TIME.hour, DATE_ONLY_REMINDER_TIME.minute, timeZone);
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
};

export interface ReminderLike {
    id?: string;
    title?: string;
    remindAt?: string;
    isCompleted?: boolean;
    sentAt?: string;
    createdBy?: string;
    recipientIds?: string[];
    notifyAssignees?: boolean;
    [key: string]: unknown;
}

export const isPendingReminder = (reminder: ReminderLike | null | undefined): boolean =>
    !!reminder && !reminder.isCompleted && !reminder.sentAt;

/**
 * Earliest due instant (ISO string) among `!isCompleted && !sentAt` reminders; undefined when none.
 * Unreadable `remindAt` values are ignored. Done tasks never fire (`suppress`).
 */
export const computeNextReminderAt = (
    reminders: unknown,
    options: { suppress?: boolean } = {}
): string | undefined => {
    if (options.suppress || !Array.isArray(reminders)) return undefined;
    let best: number | null = null;
    for (const reminder of reminders as ReminderLike[]) {
        if (!isPendingReminder(reminder)) continue;
        const instant = reminderInstantMs(reminder.remindAt);
        if (instant === null) continue;
        if (best === null || instant < best) best = instant;
    }
    return best === null ? undefined : new Date(best).toISOString();
};

export type ReminderOwnerKind = 'task' | 'project';

const uniq = (ids: string[]): string[] => Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())));

/**
 * Recipients of one reminder at send time.
 * - with `createdBy`: `recipientIds` (default `[createdBy]`), plus task assignees when `notifyAssignees`
 * - legacy (no `createdBy`): task assignees (fallback: task creator/owner) / project owner
 */
export const planReminderRecipients = (reminder: ReminderLike, kind: ReminderOwnerKind, doc: Json): string[] => {
    const assignees = kind === 'task' ? effectiveAssignees(doc) : [];
    if (!reminder.createdBy) {
        if (kind === 'task') {
            if (assignees.length > 0) return uniq(assignees);
            return uniq([doc.createdBy, doc.ownerId].filter(Boolean) as string[]);
        }
        return uniq([doc.ownerId].filter(Boolean) as string[]);
    }
    const explicit = Array.isArray(reminder.recipientIds) && reminder.recipientIds.length > 0
        ? (reminder.recipientIds as string[])
        : [reminder.createdBy];
    return uniq([...explicit, ...(reminder.notifyAssignees ? assignees : [])]);
};

export type ReminderDisposition = 'send' | 'skip-stale' | 'wait' | 'ignore';

/** What the delivery job does with one reminder at `nowMs`. */
export const classifyReminder = (reminder: ReminderLike, nowMs: number): ReminderDisposition => {
    if (!isPendingReminder(reminder)) return 'ignore';
    const instant = reminderInstantMs(reminder.remindAt);
    if (instant === null) return 'ignore';
    if (instant > nowMs) return 'wait';
    if (!reminder.createdBy && nowMs - instant > LEGACY_STALE_MS) return 'skip-stale';
    return 'send';
};
