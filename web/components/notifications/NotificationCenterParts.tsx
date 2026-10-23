import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { OtherWorkspaceUnread } from '../../hooks/useNotifications';
import type { NotificationFilter } from '../../utils/notificationPresentation';
import './notification-list.scss';
import './notification-center-parts.scss';

interface NotificationFilterTabsProps {
    value: NotificationFilter;
    unreadCount: number;
    onChange: (value: NotificationFilter) => void;
}

/** All / Unread segmented filter. */
export const NotificationFilterTabs = ({ value, unreadCount, onChange }: NotificationFilterTabsProps) => {
    const { t } = useLanguage();
    const options: Array<{ id: NotificationFilter; label: string; count?: number }> = [
        { id: 'all', label: t('notifications.filter.all') },
        { id: 'unread', label: t('notifications.filter.unread'), count: unreadCount }
    ];
    return (
        <div className="notification-filter" role="tablist" aria-label={t('notifications.filter.label')}>
            {options.map((option) => (
                <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={value === option.id}
                    className={`notification-filter__tab${value === option.id ? ' is-active' : ''}`}
                    onClick={() => onChange(option.id)}
                >
                    {option.label}
                    {!!option.count && <span className="notification-filter__count">{option.count > 99 ? '99+' : option.count}</span>}
                </button>
            ))}
        </div>
    );
};

interface NotificationOtherWorkspacesProps {
    items: OtherWorkspaceUnread[];
    onSwitch: (tenantId: string) => void;
}

/** Unread notifications waiting in the user's other workspaces, with a jump into each. */
export const NotificationOtherWorkspaces = ({ items, onSwitch }: NotificationOtherWorkspacesProps) => {
    const { t } = useLanguage();
    if (items.length === 0) return null;
    return (
        <div className="notification-others">
            <p className="notification-others__label">{t('notifications.otherWorkspaces.title')}</p>
            <ul className="notification-others__list">
                {items.map(({ workspace, count }) => (
                    <li key={workspace.id}>
                        <button type="button" className="notification-others__item" onClick={() => onSwitch(workspace.id)}>
                            <span className="material-symbols-outlined" aria-hidden="true">swap_horiz</span>
                            <span className="notification-others__name">{workspace.name}</span>
                            <span className="notification-others__count">
                                {t('notifications.otherWorkspaces.count').replace('{count}', String(count))}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

interface NotificationStateProps {
    kind: 'loading' | 'error' | 'empty' | 'emptyUnread';
    compact?: boolean;
}

/** Loading / error / empty placeholder for the notification list. */
export const NotificationState = ({ kind, compact = false }: NotificationStateProps) => {
    const { t } = useLanguage();
    if (kind === 'loading') {
        return (
            <div className={`notification-state${compact ? ' notification-state--compact' : ''}`} role="status">
                <span className="notification-state__spinner" aria-hidden="true" />
                <span className="notification-state__text">{t('notifications.loading')}</span>
            </div>
        );
    }
    const icon = kind === 'error' ? 'error' : 'notifications_off';
    const title = kind === 'error'
        ? t('notifications.error.loadTitle')
        : kind === 'emptyUnread' ? t('notifications.empty.unreadTitle') : t('notifications.empty.title');
    const text = kind === 'error'
        ? t('notifications.error.loadText')
        : kind === 'emptyUnread' ? t('notifications.empty.unreadDescription') : t('notifications.empty.description');
    return (
        <div className={`notification-state${compact ? ' notification-state--compact' : ''}${kind === 'error' ? ' notification-state--error' : ''}`}
            role={kind === 'error' ? 'alert' : undefined}>
            <span className="notification-state__icon material-symbols-outlined" aria-hidden="true">{icon}</span>
            <p className="notification-state__title">{title}</p>
            <p className="notification-state__text">{text}</p>
        </div>
    );
};
