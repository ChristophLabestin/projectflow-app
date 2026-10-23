import React, { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/UIContext';
import { useLanguage } from '../context/LanguageContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useNotifications } from '../hooks/useNotifications';
import type { Notification } from '../types';
import { getNotificationPath, type NotificationFilter } from '../utils/notificationPresentation';
import { NotificationList } from './notifications/NotificationList';
import { NotificationFilterTabs, NotificationOtherWorkspaces, NotificationState } from './notifications/NotificationCenterParts';
import './notifications/notification-dropdown.scss';

const SettingsModal = React.lazy(() => import('./SettingsModal').then((module) => ({ default: module.SettingsModal })));

interface NotificationDropdownProps {
    position?: 'topbar' | 'sidebar';
}

const PANEL_WIDTH = 380;
const GAP = 12;
const EDGE = 8;

/**
 * Bell with unread badge and the Notification Center popover. The panel is portaled to
 * <body> with fixed positioning: the sidebar card clips overflow, so an inline panel was invisible.
 */
export const NotificationDropdown = ({ position = 'topbar' }: NotificationDropdownProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filter, setFilter] = useState<NotificationFilter>('all');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const { switchWorkspace } = useWorkspace();
    const { notifications, unreadCount, loading, error, otherUnread, setRead, markAllRead, remove } = useNotifications();

    const otherUnreadTotal = otherUnread.reduce((sum, item) => sum + item.count, 0);
    const badgeCount = unreadCount + otherUnreadTotal;
    const visible = filter === 'unread' ? notifications.filter((notification) => !notification.read) : notifications;

    const updatePosition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const width = Math.min(PANEL_WIDTH, window.innerWidth - EDGE * 2);
        const maxHeight = Math.min(560, window.innerHeight - EDGE * 2);
        if (position === 'sidebar' && rect.right + GAP + width <= window.innerWidth - EDGE) {
            // Beside the sidebar, flush with the bottom edge of the sidebar card.
            const anchorBottom = (trigger.closest('.snav-card') ?? trigger).getBoundingClientRect().bottom;
            const bottom = Math.max(EDGE, window.innerHeight - anchorBottom);
            setPanelStyle({ left: rect.right + GAP, bottom, width, maxHeight: Math.min(maxHeight, window.innerHeight - bottom - EDGE) });
            return;
        }
        const left = Math.min(Math.max(EDGE, rect.right - width), window.innerWidth - width - EDGE);
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow >= Math.min(maxHeight, 360) || spaceBelow >= rect.top) {
            setPanelStyle({ left, top: rect.bottom + EDGE, width, maxHeight: Math.min(maxHeight, spaceBelow - EDGE * 2) });
        } else {
            setPanelStyle({ left, bottom: window.innerHeight - rect.top + EDGE, width, maxHeight: Math.min(maxHeight, rect.top - EDGE * 2) });
        }
    }, [position]);

    useLayoutEffect(() => {
        if (!isOpen) return;
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, updatePosition]);

    useEffect(() => {
        if (!isOpen) return;
        const handlePointer = (event: MouseEvent) => {
            const target = event.target as Node;
            if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
            setIsOpen(false);
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsOpen(false);
            triggerRef.current?.focus();
        };
        document.addEventListener('mousedown', handlePointer);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handlePointer);
            document.removeEventListener('keydown', handleKey);
        };
    }, [isOpen]);

    const run = async (action: () => Promise<unknown>, errorKey: string) => {
        try {
            await action();
        } catch (actionError) {
            console.error(actionError);
            showToast(t(errorKey), 'error');
        }
    };

    const handleOpen = async (notification: Notification) => {
        if (!notification.read) void run(() => setRead(notification, true), 'notifications.toast.updateError');
        const path = getNotificationPath(notification);
        if (path) {
            setIsOpen(false);
            navigate(path);
        }
    };

    const handleSwitchWorkspace = (tenantId: string) => {
        setIsOpen(false);
        void run(() => switchWorkspace(tenantId, '/notifications'), 'notifications.toast.switchError');
    };

    const badgeLabel = badgeCount > 9 ? '9+' : String(badgeCount);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={`notification-bell${isOpen ? ' is-open' : ''}`}
                onClick={() => setIsOpen((open) => !open)}
                aria-label={badgeCount > 0
                    ? t('notifications.bell.labelUnread').replace('{count}', String(badgeCount))
                    : t('notifications.title')}
                title={t('notifications.title')}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
            >
                <span className="material-symbols-outlined" aria-hidden="true">
                    {badgeCount > 0 ? 'notifications_active' : 'notifications'}
                </span>
                {badgeCount > 0 && <span className="notification-bell__badge" aria-hidden="true">{badgeLabel}</span>}
            </button>

            {isOpen && createPortal(
                <div
                    ref={panelRef}
                    className="notification-panel"
                    style={panelStyle}
                    role="dialog"
                    aria-label={t('notifications.title')}
                >
                    <div className="notification-panel__header">
                        <NotificationFilterTabs value={filter} unreadCount={unreadCount} onChange={setFilter} />
                        <button
                            type="button"
                            className="notification-panel__icon-button"
                            onClick={() => void run(markAllRead, 'notifications.toast.updateError')}
                            disabled={unreadCount === 0}
                            aria-label={t('notifications.actions.markAllRead')}
                            title={t('notifications.actions.markAllRead')}
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">done_all</span>
                        </button>
                        <button
                            type="button"
                            className="notification-panel__icon-button"
                            onClick={() => { setIsOpen(false); setSettingsOpen(true); }}
                            aria-label={t('notifications.actions.settings')}
                            title={t('notifications.actions.settings')}
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">tune</span>
                        </button>
                    </div>
                    <NotificationOtherWorkspaces items={otherUnread} onSwitch={handleSwitchWorkspace} />
                    <div className="notification-panel__body">
                        {loading ? (
                            <NotificationState kind="loading" compact />
                        ) : error ? (
                            <NotificationState kind="error" compact />
                        ) : visible.length === 0 ? (
                            <NotificationState kind={filter === 'unread' && notifications.length > 0 ? 'emptyUnread' : 'empty'} compact />
                        ) : (
                            <NotificationList
                                compact
                                notifications={visible}
                                onOpen={handleOpen}
                                onToggleRead={(notification) => void run(() => setRead(notification, !notification.read), 'notifications.toast.updateError')}
                                onDelete={(notification) => void run(() => remove(notification), 'notifications.toast.deleteError')}
                            />
                        )}
                    </div>
                    <div className="notification-panel__footer">
                        <button
                            type="button"
                            className="notification-panel__footer-link"
                            onClick={() => { setIsOpen(false); navigate('/notifications'); }}
                        >
                            {t('notifications.actions.viewAll')}
                            <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                        </button>
                    </div>
                </div>,
                document.body
            )}
            {settingsOpen && (
                <Suspense fallback={null}>
                    <SettingsModal isOpen initialTab="notifications" onClose={() => setSettingsOpen(false)} />
                </Suspense>
            )}
        </>
    );
};
