import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import {
    subscribeToNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    deleteAllNotifications
} from '../services/notificationService';
import { respondToJoinRequest } from '../services/dataService';
import { Button } from '../components/ui/Button';
import { Notification } from '../types';
import { useToast } from '../context/UIContext';
import { useLanguage } from '../context/LanguageContext';
import { format } from 'date-fns';

export const Notifications = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { t, dateFormat, dateLocale } = useLanguage();

    const user = auth.currentUser;
    const unreadCount = notifications.filter(n => !n.read).length;

    // Subscribe to notifications
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeToNotifications(user.uid, (notifs) => {
            setNotifications(notifs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        if (!notification.read) {
            await markNotificationAsRead(notification.id, notification.tenantId);
        }

        // Navigate to the relevant item
        let path = '';
        if (notification.taskId && notification.projectId) {
            path = `/project/${notification.projectId}/tasks/${notification.taskId}`;
        } else if (notification.issueId && notification.projectId) {
            path = `/project/${notification.projectId}/issues/${notification.issueId}`;
        } else if (notification.projectId) {
            path = `/project/${notification.projectId}`;
        }

        if (path) {
            navigate(path);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!user) return;
        await markAllNotificationsAsRead(user.uid);
        showToast(t('notifications.toast.markAllRead'), 'success');
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return t('notifications.time.justNow');
        if (minutes < 60) return t('notifications.time.minutesAgo').replace('{count}', String(minutes));
        if (hours < 24) return t('notifications.time.hoursAgo').replace('{count}', String(hours));
        if (days < 7) return t('notifications.time.daysAgo').replace('{count}', String(days));
        return format(date, dateFormat, { locale: dateLocale });
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'task_assigned':
            case 'subtask_assigned':
                return 'task_alt';
            case 'issue_assigned':
                return 'bug_report';
            case 'comment_added':
            case 'comment_mention':
                return 'comment';
            case 'project_invite':
            case 'project_shared':
            case 'project_join_request':
            case 'project_join_request_accepted':
                return 'folder_shared';
            case 'project_join_request_denied':
                return 'block';
            default:
                return 'notifications';
        }
    };

    const handleJoinResponse = async (e: React.MouseEvent, notification: Notification, accept: boolean) => {
        e.stopPropagation();
        if (!notification.projectId || !notification.actorId) return;

        try {
            await respondToJoinRequest(
                notification.id,
                notification.projectId,
                notification.actorId,
                accept,
                notification.tenantId
            );
            showToast(accept ? t('notifications.toast.requestAccepted') : t('notifications.toast.requestDenied'), 'success');
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : t('notifications.error.unknown');
            showToast(t('notifications.error.respond').replace('{error}', errorMessage), 'error');
        }
    };

    const handleDelete = async (e: React.MouseEvent, notificationId: string, tenantId?: string) => {
        e.stopPropagation();
        try {
            await deleteNotification(notificationId, tenantId);
            showToast(t('notifications.toast.delete'), 'success');
        } catch (error) {
            console.error(error);
            showToast(t('notifications.toast.deleteError'), 'error');
        }
    };

    const handleClearAll = async () => {
        if (!user) return;
        try {
            await deleteAllNotifications(user.uid);
            showToast(t('notifications.toast.clearAll'), 'success');
            setShowClearConfirm(false);
        } catch (error) {
            console.error(error);
            showToast(t('notifications.toast.clearError'), 'error');
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-main">{t('notifications.title')}</h1>
                    <p className="text-muted">
                        {t('notifications.page.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {notifications.length > 0 && (
                        <Button
                            variant="utility"
                            onClick={() => setShowClearConfirm(true)}
                            className="flex items-center gap-2 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 border-transparent"
                        >
                            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                            {t('notifications.actions.clearAll')}
                        </Button>
                    )}
                    {unreadCount > 0 && (
                        <Button
                            variant="utility"
                            onClick={handleMarkAllAsRead}
                            className="flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">done_all</span>
                            {t('notifications.actions.markAllRead')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Clear All Confirmation Modal */}
            {showClearConfirm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-card rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-surface">
                        <div className="space-y-4 text-center">
                            <h3 className="text-lg font-bold text-main">{t('notifications.clearConfirm.title')}</h3>
                            <p className="text-sm text-muted">
                                {t('notifications.clearConfirm.message')}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="ghost"
                                    onClick={() => setShowClearConfirm(false)}
                                >
                                    {t('notifications.clearConfirm.cancel')}
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={handleClearAll}
                                >
                                    {t('notifications.clearConfirm.confirm')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Notifications List */}
            <div className="bg-card rounded-xl border border-surface shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-3xl text-muted">
                                notifications_off
                            </span>
                        </div>
                        <h3 className="text-lg font-medium text-main">{t('notifications.empty.title')}</h3>
                        <p className="text-muted mt-1">
                            {t('notifications.empty.description')}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--color-surface-border)]">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleNotificationClick(notification)}
                                onMouseEnter={() => !notification.read && markNotificationAsRead(notification.id, notification.tenantId)}
                                className={`w-full text-left px-6 py-4 hover:bg-surface-hover transition-colors cursor-pointer group ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${!notification.read
                                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                                        : 'bg-surface text-muted border border-surface'
                                        }`}>
                                        <span className="material-symbols-outlined text-[20px]">
                                            {getNotificationIcon(notification.type)}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <p className={`text-base ${!notification.read
                                                ? 'font-semibold text-main'
                                                : 'text-main'
                                                }`}>
                                                {notification.title}
                                            </p>
                                            <span className="text-xs text-muted whitespace-nowrap">
                                                {formatTime(notification.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted mt-1">
                                            {notification.message}
                                        </p>

                                        {/* Action Buttons for specific types */}
                                        {notification.type === 'project_join_request' && !notification.read && (
                                            <div className="flex items-center gap-3 mt-4">
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={(e) => handleJoinResponse(e, notification, true)}
                                                    className="bg-emerald-500 hover:bg-emerald-600 border-emerald-500 text-white min-w-[80px]"
                                                >
                                                    {t('notifications.actions.accept')}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="utility"
                                                    onClick={(e) => handleJoinResponse(e, notification, false)}
                                                    className="hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 border-transparent min-w-[80px]"
                                                >
                                                    {t('notifications.actions.decline')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Unread indicator & Actions */}
                                    <div className="flex items-center gap-2 self-center flex-shrink-0">
                                        {!notification.read && (
                                            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-sm shadow-blue-500/50"></div>
                                        )}
                                        <button
                                            onClick={(e) => handleDelete(e, notification.id, notification.tenantId)}
                                            className="p-1.5 rounded-full text-muted hover:bg-surface-hover hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                            title={t('notifications.actions.delete')}
                                        >
                                            <span className="material-symbols-outlined text-[20px]">close</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
