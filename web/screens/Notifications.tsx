import React, { useEffect, useState } from 'react';
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
import { Card } from '../components/ui/Card';
import { ConfirmModal } from '../components/common/Modal/ConfirmModal';
import { Notification } from '../types';
import { useToast } from '../context/UIContext';
import { useLanguage } from '../context/LanguageContext';
import { format } from 'date-fns';
import './notifications.scss';

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
        <div className="notifications-page">
            {/* Header */}
            <div className="notifications-header">
                <div>
                    <h1 className="notifications-title">{t('notifications.title')}</h1>
                    <p className="notifications-subtitle">
                        {t('notifications.page.subtitle')}
                    </p>
                </div>
                <div className="notifications-actions">
                    {notifications.length > 0 && (
                        <Button
                            variant="ghost"
                            onClick={() => setShowClearConfirm(true)}
                            className="notifications-action notifications-action--danger"
                        >
                            <span className="material-symbols-outlined notifications-action__icon">delete_sweep</span>
                            {t('notifications.actions.clearAll')}
                        </Button>
                    )}
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            onClick={handleMarkAllAsRead}
                            className="notifications-action"
                        >
                            <span className="material-symbols-outlined notifications-action__icon">done_all</span>
                            {t('notifications.actions.markAllRead')}
                        </Button>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={handleClearAll}
                title={t('notifications.clearConfirm.title')}
                message={t('notifications.clearConfirm.message')}
                confirmLabel={t('notifications.clearConfirm.confirm')}
                cancelLabel={t('notifications.clearConfirm.cancel')}
                variant="danger"
            />

            {/* Notifications List */}
            <Card padding="none" className="notifications-card">
                {loading ? (
                    <div className="notifications-loading">
                        <div className="notifications-spinner" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="notifications-empty">
                        <div className="notifications-empty__icon">
                            <span className="material-symbols-outlined notifications-empty__symbol">
                                notifications_off
                            </span>
                        </div>
                        <h3 className="notifications-empty__title">{t('notifications.empty.title')}</h3>
                        <p className="notifications-empty__text">
                            {t('notifications.empty.description')}
                        </p>
                    </div>
                ) : (
                    <div className="notifications-list">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleNotificationClick(notification)}
                                onMouseEnter={() => !notification.read && markNotificationAsRead(notification.id, notification.tenantId)}
                                className={`notification-item ${!notification.read ? 'notification-item--unread' : ''}`}
                            >
                                <div className="notification-item__main">
                                    {/* Icon */}
                                    <div className={`notification-icon ${!notification.read ? 'notification-icon--unread' : 'notification-icon--read'}`}>
                                        <span className="material-symbols-outlined notification-icon__symbol">
                                            {getNotificationIcon(notification.type)}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <div className="notification-content">
                                        <div className="notification-content__header">
                                            <p className={`notification-title ${!notification.read ? 'notification-title--unread' : ''}`}>
                                                {notification.title}
                                            </p>
                                            <span className="notification-time">
                                                {formatTime(notification.createdAt)}
                                            </span>
                                        </div>
                                        <p className="notification-message">
                                            {notification.message}
                                        </p>

                                        {/* Action Buttons for specific types */}
                                        {notification.type === 'project_join_request' && !notification.read && (
                                            <div className="notification-actions">
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={(e) => handleJoinResponse(e, notification, true)}
                                                    className="notification-action"
                                                >
                                                    {t('notifications.actions.accept')}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={(e) => handleJoinResponse(e, notification, false)}
                                                    className="notification-action notification-action--decline"
                                                >
                                                    {t('notifications.actions.decline')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Unread indicator & Actions */}
                                    <div className="notification-meta">
                                        {!notification.read && (
                                            <span className="notification-unread-dot" />
                                        )}
                                        <button
                                            onClick={(e) => handleDelete(e, notification.id, notification.tenantId)}
                                            className="notification-delete"
                                            title={t('notifications.actions.delete')}
                                        >
                                            <span className="material-symbols-outlined notification-delete__icon">close</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};
