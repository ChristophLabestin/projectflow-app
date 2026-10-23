// Pure helpers for users/{uid}.notificationPrefs (contract C3). No React /
// Firebase imports. The server applies the same defaults when a field is absent.

import type { NotificationPrefs } from '../types';

export const NOTIFICATION_CATEGORIES = ['assignments', 'mentions', 'comments', 'due', 'reminders'] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];

export type ResolvedChannelPrefs = Record<NotificationCategory, boolean>;

export interface ResolvedNotificationPrefs {
    timezone: string;
    push: ResolvedChannelPrefs;
    email: ResolvedChannelPrefs;
    morningBriefing: { enabled: boolean; time: string };
    dayClose: { enabled: boolean; time: string };
}

export const DEFAULT_PUSH_PREFS: ResolvedChannelPrefs = {
    assignments: true,
    mentions: true,
    comments: true,
    due: true,
    reminders: true
};

export const DEFAULT_EMAIL_PREFS: ResolvedChannelPrefs = {
    assignments: true,
    mentions: true,
    comments: false,
    due: false,
    reminders: false
};

export const DEFAULT_MORNING_TIME = '08:00';
export const DEFAULT_DAY_CLOSE_TIME = '17:30';
/** Server-side default when a user never saved a time zone. */
export const DEFAULT_TIME_ZONE = 'Europe/Berlin';

export const isValidTime = (value: unknown): value is string => (
    typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
);

export const isValidTimeZone = (value: unknown): value is string => {
    if (typeof value !== 'string' || !value) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
    } catch {
        return false;
    }
};

const resolveChannel = (raw: Partial<Record<NotificationCategory, boolean>> | undefined, defaults: ResolvedChannelPrefs): ResolvedChannelPrefs => (
    NOTIFICATION_CATEGORIES.reduce((result, category) => {
        result[category] = typeof raw?.[category] === 'boolean' ? (raw[category] as boolean) : defaults[category];
        return result;
    }, {} as ResolvedChannelPrefs)
);

/** Fills every missing field with its default; `fallbackTimeZone` is used when none is saved (the browser zone on web). */
export const resolveNotificationPrefs = (raw?: NotificationPrefs | null, fallbackTimeZone: string = DEFAULT_TIME_ZONE): ResolvedNotificationPrefs => ({
    timezone: isValidTimeZone(raw?.timezone) ? (raw?.timezone as string) : fallbackTimeZone,
    push: resolveChannel(raw?.push, DEFAULT_PUSH_PREFS),
    email: resolveChannel(raw?.email, DEFAULT_EMAIL_PREFS),
    morningBriefing: {
        enabled: raw?.morningBriefing?.enabled === true,
        time: isValidTime(raw?.morningBriefing?.time) ? (raw?.morningBriefing?.time as string) : DEFAULT_MORNING_TIME
    },
    dayClose: {
        enabled: raw?.dayClose?.enabled === true,
        time: isValidTime(raw?.dayClose?.time) ? (raw?.dayClose?.time as string) : DEFAULT_DAY_CLOSE_TIME
    }
});

/** The complete object written to users/{uid}.notificationPrefs (no undefined values). */
export const toStoredNotificationPrefs = (prefs: ResolvedNotificationPrefs): NotificationPrefs => ({
    timezone: prefs.timezone,
    push: { ...prefs.push },
    email: { ...prefs.email },
    morningBriefing: { ...prefs.morningBriefing },
    dayClose: { ...prefs.dayClose }
});

/** Mirror of functions/src/notification-prefs.ts CATEGORY_BY_TYPE (types without a category are transactional). */
const CATEGORY_BY_TYPE: Record<string, NotificationCategory> = {
    task_assigned: 'assignments',
    subtask_assigned: 'assignments',
    issue_assigned: 'assignments',
    comment_mention: 'mentions',
    comment_added: 'comments',
    task_completed: 'comments',
    task_updated: 'comments',
    task_status_changed: 'comments',
    task_due_changed: 'due',
    task_overdue: 'due',
    project_member_added: 'assignments',
    project_member_joined: 'comments',
    issue_updated: 'comments',
    task_due_today: 'due',
    reminder: 'reminders'
};

/** Whether a notification type may be delivered as a push / native desktop notification (same rule as the server). */
export const allowsPushNotification = (type: string, prefs: ResolvedNotificationPrefs): boolean => {
    const category = CATEGORY_BY_TYPE[type];
    return category ? prefs.push[category] : true;
};
