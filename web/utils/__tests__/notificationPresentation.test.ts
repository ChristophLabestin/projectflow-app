import { describe, expect, it } from 'vitest';
import type { Notification } from '../../types';
import { getNotificationPath, getNotificationText, groupNotifications } from '../notificationPresentation';

const t = (key: string, fallback?: string) => ({
    'notifications.type.task_status_changed.title': 'Status geändert',
    'notifications.type.task_status_changed.message': '{actor} hat „{task}“ von {previousStatus} auf {status} gesetzt',
    'notifications.type.task_due_changed.messageRemoved': '{actor} hat das Fälligkeitsdatum von „{task}“ entfernt',
    'notifications.type.task_due_changed.title': 'Fälligkeit geändert',
    'tasks.status.inProgress': 'In Arbeit',
    'tasks.status.review': 'Prüfung'
} as Record<string, string>)[key] ?? fallback ?? key;

const base = (extra: Partial<Notification>): Notification => ({
    id: 'n1', type: 'task_assigned', userId: 'u1', title: 'Stored title', message: 'Stored message', read: false, createdAt: null, ...extra
});

describe('notificationPresentation', () => {
    it('renders localized copy from params', () => {
        const text = getNotificationText(base({
            type: 'task_status_changed', actorName: 'Anna',
            params: { taskTitle: 'Hero', status: 'Review', previousStatus: 'In Progress' }
        }), t, (value) => value);
        expect(text).toEqual({ title: 'Status geändert', message: 'Anna hat „Hero“ von In Arbeit auf Prüfung gesetzt' });
    });

    it('uses the removed variant when the due date was cleared', () => {
        const text = getNotificationText(base({
            type: 'task_due_changed', actorName: 'Anna', params: { taskTitle: 'Hero', dueDate: '', previousDueDate: '2026-10-30' }
        }), t, (value) => value);
        expect(text.message).toBe('Anna hat das Fälligkeitsdatum von „Hero“ entfernt');
    });

    it('falls back to the stored text without params', () => {
        expect(getNotificationText(base({ type: 'reminder' }), t, (value) => value))
            .toEqual({ title: 'Stored title', message: 'Stored message' });
    });

    it('routes task > project > deep link', () => {
        expect(getNotificationPath(base({ projectId: 'p', taskId: 't' }))).toBe('/project/p/tasks/t');
        expect(getNotificationPath(base({ projectId: 'p' }))).toBe('/project/p');
        expect(getNotificationPath(base({ deepLink: '/tasks' }))).toBe('/tasks');
        expect(getNotificationPath(base({ deepLink: 'https://evil.example' }))).toBe('');
    });

    it('groups into today / yesterday / earlier', () => {
        const now = new Date(2026, 9, 23, 12);
        const at = (date: Date) => ({ seconds: date.getTime() / 1000 });
        const groups = groupNotifications([
            base({ id: 'a', createdAt: at(new Date(2026, 9, 23, 9)) }),
            base({ id: 'b', createdAt: null }),
            base({ id: 'c', createdAt: at(new Date(2026, 9, 22, 23)) }),
            base({ id: 'd', createdAt: at(new Date(2026, 9, 1)) })
        ], now);
        expect(groups.map((group) => [group.key, group.items.map((item) => item.id)])).toEqual([
            ['today', ['a', 'b']], ['yesterday', ['c']], ['earlier', ['d']]
        ]);
    });
});
