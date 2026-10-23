import { Notification } from 'electron';
import { sanitizeAppPath } from '../config';
import type { DesktopNotificationPayload } from '../contract';
import { labels } from '../labels';
import { sendCommand, showMainWindow } from '../windows/mainWindow';

const isMac = process.platform === 'darwin';
const SNOOZE_MS = 60 * 60 * 1000;

/** Keep references: a garbage-collected Notification loses its click/action handlers. */
const live = new Map<string, Notification>();
const snoozeTimers = new Map<string, NodeJS.Timeout>();

interface NativeNotificationOptions {
    key: string;
    title: string;
    body?: string;
    /** Button labels (macOS only; Windows shows a plain toast). */
    actions?: string[];
    replyPlaceholder?: string;
    onClick?: () => void;
    onAction?: (index: number) => void;
    onReply?: (text: string) => void;
}

/** Shared helper for all shell notifications (app notifications, meetings, day close). */
export const showNativeNotification = (options: NativeNotificationOptions) => {
    if (!Notification.isSupported()) return null;
    live.get(options.key)?.close();
    const notification = new Notification({
        title: options.title.slice(0, 120),
        body: options.body?.slice(0, 300),
        silent: false,
        ...(isMac && options.actions?.length ? { actions: options.actions.map((text) => ({ type: 'button' as const, text })) } : {}),
        ...(isMac && options.onReply ? { hasReply: true, replyPlaceholder: options.replyPlaceholder } : {})
    });
    notification.on('click', () => options.onClick?.());
    notification.on('action', (_event, index) => options.onAction?.(index));
    notification.on('reply', (_event, reply) => options.onReply?.(reply));
    notification.on('close', () => { if (live.get(options.key) === notification) live.delete(options.key); });
    live.set(options.key, notification);
    notification.show();
    return notification;
};

/**
 * App notifications from the web app. With task context they get native actions:
 * Complete (task done), Snooze (shown again in 1 h) and Reply (comment on the task).
 */
export const showAppNotification = (payload: DesktopNotificationPayload) => {
    if (typeof payload?.id !== 'string' || typeof payload.title !== 'string') return;
    const path = sanitizeAppPath(payload.path);
    const hasTask = typeof payload.taskId === 'string' && typeof payload.projectId === 'string';
    const l = labels();
    const actionData = (action: string, text?: string) => ({
        action,
        text,
        notificationId: payload.id,
        taskId: payload.taskId,
        projectId: payload.projectId,
        tenantId: payload.tenantId
    });

    showNativeNotification({
        key: `app:${payload.id}`,
        title: payload.title,
        body: typeof payload.body === 'string' ? payload.body : undefined,
        actions: hasTask ? [l.notificationComplete, l.notificationSnooze] : [l.notificationSnooze],
        replyPlaceholder: l.notificationReplyPlaceholder,
        onReply: hasTask ? (text) => sendCommand({ command: 'notification-action', data: actionData('reply', text) }) : undefined,
        onClick: () => {
            showMainWindow();
            if (path) sendCommand({ command: 'navigate', path });
            sendCommand({ command: 'notification-action', data: actionData('read') });
        },
        onAction: (index) => {
            const isComplete = hasTask && index === 0;
            if (isComplete) {
                sendCommand({ command: 'notification-action', data: actionData('complete') });
                return;
            }
            clearTimeout(snoozeTimers.get(payload.id));
            snoozeTimers.set(payload.id, setTimeout(() => {
                snoozeTimers.delete(payload.id);
                showAppNotification(payload);
            }, SNOOZE_MS));
        }
    });
};
