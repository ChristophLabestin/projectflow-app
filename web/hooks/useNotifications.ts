import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import type { WorkspaceSummary } from '../services/domain/workspacesService';
import {
    deleteAllNotifications,
    deleteNotification,
    markAllNotificationsAsRead,
    setNotificationRead,
    subscribeToNotifications,
    subscribeToUnreadNotificationCount
} from '../services/notificationService';
import type { Notification } from '../types';

export interface OtherWorkspaceUnread {
    workspace: WorkspaceSummary;
    count: number;
}

/**
 * Live notification inbox of the signed-in user in the active workspace, plus unread counts
 * of their other workspaces. Re-subscribes on sign-in/out and workspace changes.
 */
export const useNotifications = () => {
    const { user } = useAuth();
    const { activeWorkspaceId, workspaces } = useWorkspace();
    const uid = user?.uid || null;

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [otherCounts, setOtherCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        setNotifications([]);
        setError(null);
        if (!uid || !activeWorkspaceId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        return subscribeToNotifications(uid, (items) => {
            setNotifications(items);
            setError(null);
            setLoading(false);
        }, activeWorkspaceId, (nextError) => {
            setError(nextError);
            setLoading(false);
        });
    }, [uid, activeWorkspaceId]);

    const otherWorkspaceKey = workspaces
        .map((workspace) => workspace.id)
        .filter((id) => id !== activeWorkspaceId)
        .sort()
        .join(',');

    useEffect(() => {
        setOtherCounts({});
        if (!uid || !otherWorkspaceKey) return;
        const unsubscribes = otherWorkspaceKey.split(',').map((tenantId) =>
            subscribeToUnreadNotificationCount(uid, tenantId, (count) => {
                setOtherCounts((current) => (current[tenantId] === count ? current : { ...current, [tenantId]: count }));
            })
        );
        return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    }, [uid, otherWorkspaceKey]);

    const otherUnread = useMemo<OtherWorkspaceUnread[]>(() => workspaces
        .filter((workspace) => workspace.id !== activeWorkspaceId && (otherCounts[workspace.id] || 0) > 0)
        .map((workspace) => ({ workspace, count: otherCounts[workspace.id] })), [workspaces, activeWorkspaceId, otherCounts]);

    const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications]);

    const setRead = useCallback((notification: Notification, read: boolean) =>
        setNotificationRead(notification.id, read, notification.tenantId || activeWorkspaceId || undefined), [activeWorkspaceId]);

    const markAllRead = useCallback(async () => {
        if (!uid || !activeWorkspaceId) return;
        await markAllNotificationsAsRead(uid, activeWorkspaceId);
    }, [uid, activeWorkspaceId]);

    const remove = useCallback((notification: Notification) =>
        deleteNotification(notification.id, notification.tenantId || activeWorkspaceId || undefined), [activeWorkspaceId]);

    const removeAll = useCallback(async () => {
        if (!uid || !activeWorkspaceId) return;
        await deleteAllNotifications(uid, activeWorkspaceId);
    }, [uid, activeWorkspaceId]);

    return { notifications, unreadCount, loading, error, otherUnread, setRead, markAllRead, remove, removeAll };
};
