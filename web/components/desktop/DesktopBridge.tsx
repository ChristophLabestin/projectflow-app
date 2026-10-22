import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useHelpCenter } from '../../context/HelpCenterContext';
import { useLanguage } from '../../context/LanguageContext';
import { usePinnedTasks } from '../../context/PinnedTasksContext';
import { useTheme } from '../../context/ThemeContext';
import { useUIState } from '../../context/UIContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { subscribeToNotifications } from '../../services/notificationService';
import { DESKTOP_OPEN_SEARCH_EVENT, getDesktopBridge, hasDesktopCapability, pinnedItemPath, type DesktopCommandEvent } from '../../services/desktop';
import type { Notification } from '../../types';

const NOTIFIED_STORAGE_KEY = 'pf_desktop_notified_ids';
const MAX_REMEMBERED_NOTIFICATIONS = 200;

const COMMAND_ROUTES: Partial<Record<DesktopCommandEvent['command'], string>> = {
    'go-dashboard': '/',
    'go-projects': '/projects',
    'go-tasks': '/tasks',
    'go-calendar': '/calendar',
    'go-notifications': '/notifications',
    'open-settings': '/profile'
};

const notificationPath = (notification: Notification) => {
    if (notification.taskId && notification.projectId) return `/project/${notification.projectId}/tasks/${notification.taskId}`;
    if (notification.projectId) return `/project/${notification.projectId}`;
    if (notification.deepLink?.startsWith('/')) return notification.deepLink;
    return '/notifications';
};

const readNotifiedIds = () => {
    try {
        return new Set<string>(JSON.parse(localStorage.getItem(NOTIFIED_STORAGE_KEY) || '[]'));
    } catch {
        return new Set<string>();
    }
};

const writeNotifiedIds = (ids: Set<string>) => {
    try {
        localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify([...ids].slice(-MAX_REMEMBERED_NOTIFICATIONS)));
    } catch {
        // storage full / unavailable: worst case a notification is shown again after reload
    }
};

/** Windows has no badge count; the shell shows this 16×16 overlay icon on the taskbar button. */
const drawBadgeOverlay = (count: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const styles = getComputedStyle(document.documentElement);
    context.fillStyle = styles.getPropertyValue('--color-error').trim() || styles.getPropertyValue('--color-primary').trim();
    context.beginPath();
    context.arc(16, 16, 16, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = styles.getPropertyValue('--color-text-ondark').trim();
    context.font = `600 ${count > 9 ? 16 : 20}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(count > 9 ? '9+' : String(count), 16, 17);
    return canvas.toDataURL('image/png');
};

const toHex = (value: string) => {
    const color = value.trim();
    if (/^#[0-9a-f]{6}$/i.test(color)) return color;
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return null;
    return `#${match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
};

/**
 * Glue between the desktop shell and the app: menu/tray/deep-link commands, language, theme colors
 * for the native title bar, dock/taskbar badge, native notifications and the tray focus snapshot.
 * Mounted once, in the main window only (the pop-out would duplicate notifications).
 */
export const DesktopBridge = () => {
    const bridge = getDesktopBridge();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { language } = useLanguage();
    const { theme } = useTheme();
    const { activeWorkspaceId } = useWorkspace();
    const { openTaskCreateModal, openProjectCreateModal } = useUIState();
    const { openHelpCenter } = useHelpCenter();
    const { isModalOpen, toggleModal, pinnedItems, focusItem, focusState } = usePinnedTasks();

    const handlersRef = useRef({ navigate, openTaskCreateModal, openProjectCreateModal, openHelpCenter, isModalOpen, toggleModal });
    handlersRef.current = { navigate, openTaskCreateModal, openProjectCreateModal, openHelpCenter, isModalOpen, toggleModal };

    // Commands from menus, tray, dock, deep links and notification clicks.
    useEffect(() => {
        if (!bridge) return;
        const unsubscribe = bridge.onCommand(({ command, path }) => {
            const handlers = handlersRef.current;
            const route = COMMAND_ROUTES[command];
            if (route) {
                handlers.navigate(route);
                return;
            }
            switch (command) {
                case 'navigate':
                    if (path?.startsWith('/') && !path.startsWith('//')) handlers.navigate(path);
                    break;
                case 'new-task':
                    handlers.openTaskCreateModal(undefined, { allowProjectSelect: true });
                    break;
                case 'new-project':
                    handlers.openProjectCreateModal();
                    break;
                case 'open-search':
                    window.dispatchEvent(new Event(DESKTOP_OPEN_SEARCH_EVENT));
                    break;
                case 'open-help':
                    handlers.openHelpCenter();
                    break;
                case 'open-quick-access-modal':
                    if (!handlers.isModalOpen) handlers.toggleModal();
                    break;
            }
        });
        // Only now may the shell flush queued commands (cold-start deep links).
        bridge.ready();
        return unsubscribe;
    }, [bridge]);

    useEffect(() => {
        if (bridge && hasDesktopCapability('language')) bridge.setLanguage(language);
    }, [bridge, language]);

    // Native title bar colors (Windows caption buttons) + nativeTheme follow the app theme.
    useEffect(() => {
        if (!bridge) return;
        const push = () => {
            const styles = getComputedStyle(document.documentElement);
            const color = toHex(styles.getPropertyValue('--color-surface-bg'));
            const symbolColor = toHex(styles.getPropertyValue('--color-text-main'));
            if (color && symbolColor) bridge.setTitleBarTheme({ mode: theme, color, symbolColor });
        };
        push();
        const observer = new MutationObserver(push);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, [bridge, theme]);

    // Tray / menu bar: focus task + pinned items.
    useEffect(() => {
        if (!bridge || !hasDesktopCapability('tray')) return;
        const isSnoozed = focusState?.status === 'snoozed'
            && Boolean(focusState.snoozedUntil)
            && new Date(focusState.snoozedUntil || '').getTime() > Date.now();
        bridge.updateTray({
            focus: focusItem ? {
                id: focusItem.id,
                title: focusItem.title,
                status: isSnoozed ? 'snoozed' : focusState?.status === 'blocked' ? 'blocked' : 'active'
            } : null,
            pinned: pinnedItems.map((item) => ({ id: item.id, title: item.title, path: pinnedItemPath(item) }))
        });
    }, [bridge, focusItem, focusState, pinnedItems]);

    // Badge + native notifications for the active workspace.
    useEffect(() => {
        if (!bridge || !user) {
            bridge?.setBadge(0, null);
            return;
        }
        let isBaseline = true;
        const notified = readNotifiedIds();
        const unsubscribe = subscribeToNotifications(user.uid, (notifications) => {
            const unread = notifications.filter((notification) => !notification.read);
            if (hasDesktopCapability('badge')) {
                bridge.setBadge(unread.length, bridge.platform === 'win32' && unread.length > 0 ? drawBadgeOverlay(unread.length) : null);
            }
            if (!hasDesktopCapability('notifications')) return;
            const fresh = unread.filter((notification) => !notified.has(notification.id));
            fresh.forEach((notification) => notified.add(notification.id));
            if (fresh.length) writeNotifiedIds(notified);
            // The first snapshot is the baseline; toasts only for what arrives afterwards and not while the app is in front.
            if (isBaseline) {
                isBaseline = false;
                return;
            }
            if (document.hasFocus()) return;
            fresh.slice(0, 3).forEach((notification) => {
                bridge.notify({
                    id: notification.id,
                    title: notification.title,
                    body: notification.message,
                    path: notificationPath(notification)
                });
            });
        }, activeWorkspaceId || undefined);
        return () => unsubscribe();
    }, [bridge, user, activeWorkspaceId]);

    return null;
};
