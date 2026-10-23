import type { Notification, NotificationType } from '../types';

type Translate = (key: string, fallback?: string) => string;

export type NotificationTone = 'assign' | 'comment' | 'status' | 'due' | 'project' | 'reminder' | 'system';
export type NotificationFilter = 'all' | 'unread';
export type NotificationGroupKey = 'today' | 'yesterday' | 'earlier';

const TONE_BY_TYPE: Partial<Record<NotificationType, NotificationTone>> = {
    task_assigned: 'assign',
    subtask_assigned: 'assign',
    issue_assigned: 'assign',
    comment_added: 'comment',
    comment_mention: 'comment',
    task_completed: 'status',
    task_status_changed: 'status',
    task_updated: 'status',
    issue_updated: 'status',
    task_due_changed: 'due',
    task_overdue: 'due',
    task_due_today: 'due',
    project_member_added: 'project',
    project_member_joined: 'project',
    project_invite: 'project',
    project_shared: 'project',
    workspace_invite: 'project',
    reminder: 'reminder',
    morning_briefing: 'reminder',
    day_close: 'reminder'
};

const ICON_BY_TYPE: Partial<Record<NotificationType, string>> = {
    task_assigned: 'assignment_ind',
    subtask_assigned: 'assignment_ind',
    issue_assigned: 'bug_report',
    comment_added: 'chat_bubble',
    comment_mention: 'alternate_email',
    task_completed: 'task_alt',
    task_status_changed: 'swap_horiz',
    task_updated: 'edit_note',
    issue_updated: 'edit_note',
    task_due_changed: 'event',
    task_overdue: 'running_with_errors',
    task_due_today: 'today',
    project_member_added: 'group_add',
    project_member_joined: 'person_add',
    project_invite: 'folder_shared',
    project_shared: 'folder_shared',
    workspace_invite: 'mail',
    reminder: 'alarm',
    morning_briefing: 'wb_sunny',
    day_close: 'bedtime',
    diagnostic_test: 'science'
};

export const getNotificationTone = (type: NotificationType): NotificationTone => TONE_BY_TYPE[type] || 'system';

export const getNotificationIcon = (type: NotificationType): string => ICON_BY_TYPE[type] || 'notifications';

/** In-app route for a notification (task > initiative > project > server deep link). */
export const getNotificationPath = (notification: Notification): string => {
    if (notification.taskId && notification.projectId) {
        return `/project/${notification.projectId}/tasks/${notification.taskId}`;
    }
    if (notification.initiativeId && notification.projectId) {
        return `/project/${notification.projectId}/initiatives/${notification.initiativeId}`;
    }
    if (notification.projectId) {
        return `/project/${notification.projectId}`;
    }
    if (notification.deepLink?.startsWith('/')) {
        // Server nudges (briefing, due today, day close) carry their own route.
        return notification.deepLink;
    }
    return '';
};

const STATUS_KEYS: Record<string, string> = {
    'Open': 'tasks.status.open',
    'Todo': 'tasks.status.todo',
    'Backlog': 'tasks.status.backlog',
    'In Progress': 'tasks.status.inProgress',
    'Review': 'tasks.status.review',
    'On Hold': 'tasks.status.onHold',
    'Blocked': 'tasks.status.blocked',
    'Done': 'tasks.status.done'
};

const statusLabel = (status: string | undefined, t: Translate) =>
    status ? (STATUS_KEYS[status] ? t(STATUS_KEYS[status], status) : status) : '';

/** Types rendered from `params` with localized copy; others keep the stored title/message. */
const LOCALIZED_TYPES = new Set<NotificationType>([
    'task_assigned',
    'subtask_assigned',
    'task_completed',
    'task_status_changed',
    'task_due_changed',
    'task_overdue',
    'comment_added',
    'comment_mention',
    'project_member_added',
    'project_member_joined'
]);

const fill = (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));

/**
 * Localized title + message. Server triggers store `params` (task title, status, dates...);
 * older docs, reminders and nudges fall back to the stored text.
 */
// Older notifications were stored with English copy and no params; recover the quoted task title
// so their title and message still render in the user's language.
const LEGACY_TASK_TYPES = new Set<NotificationType>(['task_assigned', 'task_completed', 'comment_added', 'comment_mention']);

const legacyParams = (notification: Notification): Notification['params'] | undefined => {
    if (!LEGACY_TASK_TYPES.has(notification.type)) return undefined;
    const match = /["„“]([^"„“”]+)["“”]/.exec(notification.message || '');
    return match ? { taskTitle: match[1] } : undefined;
};

export const getNotificationText = (
    notification: Notification,
    t: Translate,
    formatDate: (value: string) => string
): { title: string; message: string } => {
    const params = notification.params || legacyParams(notification);
    if (!params || !LOCALIZED_TYPES.has(notification.type)) {
        return { title: notification.title, message: notification.message };
    }
    const values: Record<string, string> = {
        actor: notification.actorName || t('notifications.actor.someone'),
        task: params.taskTitle || '',
        subtask: params.subtaskTitle || '',
        project: params.projectTitle || '',
        status: statusLabel(params.status, t),
        previousStatus: statusLabel(params.previousStatus, t),
        due: params.dueDate ? formatDate(params.dueDate) : '',
        previousDue: params.previousDueDate ? formatDate(params.previousDueDate) : '',
        snippet: params.commentSnippet || ''
    };
    let messageKey = `notifications.type.${notification.type}.message`;
    if (notification.type === 'task_due_changed' && !params.dueDate) messageKey = 'notifications.type.task_due_changed.messageRemoved';
    if ((notification.type === 'comment_added' || notification.type === 'comment_mention') && params.commentSnippet) {
        messageKey = `notifications.type.${notification.type}.messageSnippet`;
    }
    return {
        title: fill(t(`notifications.type.${notification.type}.title`, notification.title), values),
        message: fill(t(messageKey, notification.message), values)
    };
};

const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const getNotificationDate = (notification: Notification): Date | null => toDate(notification.createdAt);

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Group (already newest-first) notifications into Today / Yesterday / Earlier. */
export const groupNotifications = (
    notifications: Notification[],
    now: Date = new Date()
): Array<{ key: NotificationGroupKey; items: Notification[] }> => {
    const today = startOfDay(now);
    const yesterday = today - 86400000;
    const groups: Record<NotificationGroupKey, Notification[]> = { today: [], yesterday: [], earlier: [] };
    notifications.forEach((notification) => {
        // Pending server timestamps (just written) count as today.
        const date = getNotificationDate(notification);
        const day = date ? startOfDay(date) : today;
        if (day >= today) groups.today.push(notification);
        else if (day >= yesterday) groups.yesterday.push(notification);
        else groups.earlier.push(notification);
    });
    return (['today', 'yesterday', 'earlier'] as NotificationGroupKey[])
        .filter((key) => groups[key].length > 0)
        .map((key) => ({ key, items: groups[key] }));
};
