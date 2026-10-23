import React from 'react';
import { format } from 'date-fns';
import { useLanguage } from '../../context/LanguageContext';
import type { Notification } from '../../types';
import {
    getNotificationDate,
    getNotificationIcon,
    getNotificationText,
    getNotificationTone,
    groupNotifications
} from '../../utils/notificationPresentation';
import './notification-list.scss';

interface NotificationListProps {
    notifications: Notification[];
    /** Dense rows for the bell popover. */
    compact?: boolean;
    onOpen: (notification: Notification) => void;
    onToggleRead: (notification: Notification) => void;
    onDelete: (notification: Notification) => void;
}

/** Notifications grouped by Today / Yesterday / Earlier with per-row read toggle and delete. */
export const NotificationList = ({ notifications, compact = false, onOpen, onToggleRead, onDelete }: NotificationListProps) => {
    const { t, dateFormat, dateLocale } = useLanguage();

    const formatDate = (value: string) => {
        const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
        return Number.isNaN(date.getTime()) ? value : format(date, dateFormat, { locale: dateLocale });
    };

    const formatTime = (notification: Notification) => {
        const date = getNotificationDate(notification);
        if (!date) return t('notifications.time.justNow');
        const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
        if (minutes < 1) return t('notifications.time.justNow');
        if (minutes < 60) return t('notifications.time.minutesAgo').replace('{count}', String(minutes));
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return t('notifications.time.hoursAgo').replace('{count}', String(hours));
        const days = Math.floor(hours / 24);
        if (days < 7) return t('notifications.time.daysAgo').replace('{count}', String(days));
        return format(date, dateFormat, { locale: dateLocale });
    };

    const handleKeyDown = (event: React.KeyboardEvent, notification: Notification) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen(notification);
        }
    };

    return (
        <div className={`notification-list${compact ? ' notification-list--compact' : ''}`}>
            {groupNotifications(notifications).map((group) => (
                <section key={group.key} className="notification-list__group" aria-label={t(`notifications.group.${group.key}`)}>
                    <h3 className="notification-list__group-title">{t(`notifications.group.${group.key}`)}</h3>
                    <ul className="notification-list__items">
                        {group.items.map((notification) => {
                            const text = getNotificationText(notification, t, formatDate);
                            return (
                                <li key={notification.id}>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        className={`notification-row${notification.read ? '' : ' notification-row--unread'}`}
                                        data-tone={getNotificationTone(notification.type)}
                                        onClick={() => onOpen(notification)}
                                        onKeyDown={(event) => handleKeyDown(event, notification)}
                                    >
                                        <span className="notification-row__icon material-symbols-outlined" aria-hidden="true">
                                            {getNotificationIcon(notification.type)}
                                        </span>
                                        <span className="notification-row__body">
                                            <span className="notification-row__head">
                                                <span className="notification-row__title">{text.title}</span>
                                                <span className="notification-row__meta">
                                                    <span className="notification-row__time">{formatTime(notification)}</span>
                                                    {!notification.read && <span className="notification-row__dot" role="img" aria-label={t('notifications.unread')} />}
                                                </span>
                                            </span>
                                            <span className="notification-row__message">{text.message}</span>
                                            {notification.params?.projectTitle && (
                                                <span className="notification-row__context">{notification.params.projectTitle}</span>
                                            )}
                                        </span>
                                        <span className="notification-row__actions">
                                            <button
                                                type="button"
                                                className="notification-row__action"
                                                onClick={(event) => { event.stopPropagation(); onToggleRead(notification); }}
                                                aria-label={t(notification.read ? 'notifications.actions.markUnread' : 'notifications.actions.markRead')}
                                                title={t(notification.read ? 'notifications.actions.markUnread' : 'notifications.actions.markRead')}
                                            >
                                                <span className="material-symbols-outlined" aria-hidden="true">
                                                    {notification.read ? 'mark_email_unread' : 'done'}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="notification-row__action"
                                                onClick={(event) => { event.stopPropagation(); onDelete(notification); }}
                                                aria-label={t('notifications.actions.delete')}
                                                title={t('notifications.actions.delete')}
                                            >
                                                <span className="material-symbols-outlined" aria-hidden="true">close</span>
                                            </button>
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
};
