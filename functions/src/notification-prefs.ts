// Notification preferences (contract C3) and the push payload builder (contract C4).
// Pure module: no Firebase imports, safe to unit test.
import { DEFAULT_TIMEZONE, parseClock, resolveTimeZone } from './tz-utils';

export type PrefCategory = 'assignments' | 'mentions' | 'comments' | 'due' | 'reminders';

export interface ChannelPrefs {
    assignments: boolean;
    mentions: boolean;
    comments: boolean;
    due: boolean;
    reminders: boolean;
}

export interface NudgePref {
    enabled: boolean;
    time: string; // HH:mm local
}

export interface ResolvedNotificationPrefs {
    timezone: string;
    push: ChannelPrefs;
    email: ChannelPrefs;
    morningBriefing: NudgePref;
    dayClose: NudgePref;
}

export const DEFAULT_BRIEFING_TIME = '08:00';
export const DEFAULT_DAY_CLOSE_TIME = '17:30';

const PUSH_DEFAULTS: ChannelPrefs = { assignments: true, mentions: true, comments: true, due: true, reminders: true };
const EMAIL_DEFAULTS: ChannelPrefs = { assignments: true, mentions: true, comments: false, due: false, reminders: false };

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const resolveChannel = (raw: unknown, defaults: ChannelPrefs): ChannelPrefs => {
    const source = asRecord(raw);
    const out = { ...defaults };
    (Object.keys(defaults) as PrefCategory[]).forEach((key) => {
        if (typeof source[key] === 'boolean') out[key] = source[key] as boolean;
    });
    return out;
};

const resolveNudge = (raw: unknown, defaultTime: string): NudgePref => {
    const source = asRecord(raw);
    return {
        enabled: source.enabled === true,
        time: parseClock(source.time) !== null ? String(source.time).trim() : defaultTime
    };
};

/** Merge `users/{uid}.notificationPrefs` with the contract defaults. */
export const resolveNotificationPrefs = (raw: unknown): ResolvedNotificationPrefs => {
    const source = asRecord(raw);
    return {
        timezone: resolveTimeZone(source.timezone, DEFAULT_TIMEZONE),
        push: resolveChannel(source.push, PUSH_DEFAULTS),
        email: resolveChannel(source.email, EMAIL_DEFAULTS),
        morningBriefing: resolveNudge(source.morningBriefing, DEFAULT_BRIEFING_TIME),
        dayClose: resolveNudge(source.dayClose, DEFAULT_DAY_CLOSE_TIME)
    };
};

const CATEGORY_BY_TYPE: Record<string, PrefCategory> = {
    task_assigned: 'assignments',
    subtask_assigned: 'assignments',
    issue_assigned: 'assignments',
    comment_mention: 'mentions',
    comment_added: 'comments',
    // Activity on "my" work: grouped with comments, there is no separate toggle.
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

/** Types that have their own on/off switch (morningBriefing / dayClose) and never send email. */
const NUDGE_ONLY_TYPES = new Set(['morning_briefing', 'day_close']);

export const categoryForType = (type: string): PrefCategory | null => CATEGORY_BY_TYPE[type] || null;

export interface ChannelDecision {
    push: boolean;
    email: boolean;
    category: PrefCategory | 'nudge' | 'transactional';
}

/**
 * Which channels may deliver a notification doc. The in-app doc itself is always kept.
 * - categorised types follow `notificationPrefs.push/email[category]`
 * - morning_briefing / day_close: push always (the doc only exists when the user enabled it), no email
 * - everything else (invites, join requests, diagnostics...) is transactional: push + email as before
 */
export const decideChannels = (type: string, prefs: ResolvedNotificationPrefs): ChannelDecision => {
    if (NUDGE_ONLY_TYPES.has(type)) {
        return { push: true, email: false, category: 'nudge' };
    }
    const category = categoryForType(type);
    if (!category) {
        return { push: true, email: true, category: 'transactional' };
    }
    return { push: prefs.push[category], email: prefs.email[category], category };
};

// ---------------------------------------------------------------------------
// C4 push payload
// ---------------------------------------------------------------------------

export const APNS_CATEGORY_BY_TYPE: Record<string, string> = {
    task_assigned: 'PF_ASSIGNMENT',
    subtask_assigned: 'PF_ASSIGNMENT',
    comment_mention: 'PF_MENTION',
    comment_added: 'PF_COMMENT',
    task_due_today: 'PF_DUE',
    task_due_changed: 'PF_DUE',
    task_overdue: 'PF_DUE',
    project_member_added: 'PF_ASSIGNMENT',
    task_status_changed: 'PF_COMMENT',
    project_member_joined: 'PF_COMMENT',
    reminder: 'PF_REMINDER',
    morning_briefing: 'PF_BRIEFING',
    day_close: 'PF_DAYCLOSE'
};

export const apnsCategoryForType = (type: string): string => APNS_CATEGORY_BY_TYPE[type] || 'PF_GENERIC';

const str = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
};

export const buildDeepLink = (notification: Record<string, unknown>): string => {
    const explicit = str(notification.deepLink);
    if (explicit.startsWith('/')) return explicit;

    const projectId = str(notification.projectId);
    if (!projectId) return '/notifications';

    const taskId = str(notification.taskId);
    if (taskId) return `/project/${projectId}/tasks/${taskId}`;

    const initiativeId = str(notification.initiativeId);
    if (initiativeId) return `/project/${projectId}/initiatives/${initiativeId}`;

    return `/project/${projectId}`;
};

const compactData = (payload: Record<string, unknown>): Record<string, string> =>
    Object.entries(payload).reduce((acc, [key, value]) => {
        if (typeof value === 'string' && value.trim().length > 0) acc[key] = value;
        return acc;
    }, {} as Record<string, string>);

export interface PushPayload {
    notification: { title: string; body: string };
    data: Record<string, string>;
    apns: { payload: { aps: Record<string, unknown> } };
    webpush: { fcmOptions: { link: string } };
}

/**
 * FCM message body (without tokens) for a notification doc.
 * `data` keys: notificationId, tenantId, type, projectId, taskId, initiativeId, deepLink, threadId
 * (title/message stay for the web service worker). `badge` is the unread count, omitted when unknown.
 */
export const buildPushPayload = (
    tenantId: string,
    notificationId: string,
    notification: Record<string, unknown>,
    badge?: number
): PushPayload => {
    const title = str(notification.title, 'ProjectFlow');
    const body = str(notification.message, 'You have a new ProjectFlow update.');
    const type = str(notification.type);
    const projectId = str(notification.projectId);
    const deepLink = buildDeepLink(notification);
    const threadId = projectId || tenantId;

    const aps: Record<string, unknown> = {
        sound: 'default',
        'mutable-content': 1,
        'thread-id': threadId,
        category: apnsCategoryForType(type)
    };
    if (typeof badge === 'number' && Number.isFinite(badge) && badge >= 0) {
        aps.badge = Math.floor(badge);
    }

    return {
        notification: { title, body },
        data: compactData({
            notificationId,
            tenantId,
            title,
            message: body,
            type,
            projectId,
            taskId: str(notification.taskId),
            initiativeId: str(notification.initiativeId),
            deepLink,
            threadId
        }),
        apns: { payload: { aps } },
        webpush: { fcmOptions: { link: deepLink } }
    };
};
