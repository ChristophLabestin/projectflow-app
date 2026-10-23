import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useHelpCenter } from '../../context/HelpCenterContext';
import { useLanguage } from '../../context/LanguageContext';
import { usePinnedTasks } from '../../context/PinnedTasksContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast, useUIState } from '../../context/UIContext';
import { SettingsModal } from '../SettingsModal';
import { addComment } from '../../services/dataService';
import { redeemDesktopAuthCode } from '../../services/desktopAuth';
import { buildSpotlightEntries } from '../../services/desktopSpotlight';
import { auth } from '../../services/firebase';
import { attachFilesToItem, canAttachToItem, completeItem, filesFromPayload } from '../../services/desktopActions';
import { useWorkspace } from '../../context/WorkspaceContext';
import { markNotificationAsRead, subscribeToNotificationPrefs, subscribeToNotifications } from '../../services/notificationService';
import { allowsPushNotification, resolveNotificationPrefs, type ResolvedNotificationPrefs } from '../../utils/notificationPrefs';
import { DESKTOP_OPEN_SEARCH_EVENT, getDesktopBridge, hasDesktopCapability, pinnedItemPath, type DesktopCommandEvent } from '../../services/desktop';
import type { Notification } from '../../types';

const NOTIFIED_STORAGE_KEY = 'pf_desktop_notified_ids';
const MAX_REMEMBERED_NOTIFICATIONS = 200;

const COMMAND_ROUTES: Partial<Record<DesktopCommandEvent['command'], string>> = {
    'go-dashboard': '/',
    'go-projects': '/projects',
    'go-tasks': '/tasks',
    'go-calendar': '/calendar',
    'go-notifications': '/notifications'
};

const notificationPath = (notification: Notification) => {
    if (notification.taskId && notification.projectId) return `/project/${notification.projectId}/tasks/${notification.taskId}`;
    if (notification.projectId) return `/project/${notification.projectId}`;
    if (notification.deepLink?.startsWith('/')) return notification.deepLink;
    return '/notifications';
};

type BridgeHandlers = {
    showSuccess: (message: string) => void;
    showError: (message: string, details?: string) => void;
    t: (key: string) => string;
};

/** Buttons and inline reply of native notifications (macOS), handled without opening the window. */
const handleNotificationAction = async (data: Record<string, unknown> | undefined, handlers: BridgeHandlers) => {
    const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
    const action = str(data?.action);
    const notificationId = str(data?.notificationId);
    const taskId = str(data?.taskId);
    const projectId = str(data?.projectId);
    const tenantId = str(data?.tenantId);
    try {
        if (action === 'complete' && taskId && projectId) {
            await completeItem({ id: taskId, type: 'task', projectId, tenantId });
            handlers.showSuccess(handlers.t('desktop.toast.taskCompleted'));
        } else if (action === 'reply' && taskId && projectId && str(data?.text)) {
            await addComment(projectId, taskId, 'task', str(data?.text)!, tenantId);
            handlers.showSuccess(handlers.t('desktop.toast.replied'));
        }
        if (notificationId && action !== 'snooze') await markNotificationAsRead(notificationId, tenantId);
    } catch {
        handlers.showError(handlers.t('desktop.toast.actionFailed'));
    }
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
    const { language, t } = useLanguage();
    const { theme } = useTheme();
    const { activeWorkspaceId } = useWorkspace();
    const { openTaskCreateModal, openProjectCreateModal } = useUIState();
    const { openHelpCenter } = useHelpCenter();
    const { isModalOpen, toggleModal, pinnedItems, focusItem, focusState, snoozeFocusItem, startFocusItem, completeFocusItem, isLoading: pinsLoading } = usePinnedTasks();
    const { isAuthReady } = useAuth();
    const [snoozeTick, setSnoozeTick] = useState(0);
    const { showSuccess, showError, showInfo } = useToast();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const handlers = {
        navigate, openTaskCreateModal, openProjectCreateModal, openHelpCenter, isModalOpen, toggleModal,
        focusItem, snoozeFocusItem, startFocusItem, completeFocusItem, showSuccess, showError, showInfo, t
    };
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    // Commands from menus, tray, dock, deep links and notification clicks.
    useEffect(() => {
        if (!bridge) return;
        const unsubscribe = bridge.onCommand(({ command, path, data }) => {
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
                case 'open-settings':
                    setSettingsOpen(true);
                    break;
                case 'focus-pause': {
                    const minutes = typeof data?.minutes === 'number' ? data.minutes : 60;
                    if (handlers.focusItem) handlers.snoozeFocusItem(minutes);
                    break;
                }
                case 'focus-resume':
                    if (handlers.focusItem) handlers.startFocusItem(handlers.focusItem);
                    break;
                case 'focus-complete': {
                    const item = handlers.focusItem;
                    if (!item) break;
                    void completeItem(item)
                        .then(() => {
                            handlers.completeFocusItem(item.id);
                            handlers.showSuccess(handlers.t('desktop.toast.focusCompleted').replace('{title}', item.title));
                        })
                        .catch(() => handlers.showError(handlers.t('desktop.toast.actionFailed')));
                    break;
                }
                case 'notification-action':
                    void handleNotificationAction(data, handlers);
                    break;
                case 'auth-code': {
                    const code = typeof data?.code === 'string' ? data.code : '';
                    const verifier = typeof data?.verifier === 'string' ? data.verifier : '';
                    if (!code || !verifier) break;
                    redeemDesktopAuthCode(code, verifier)
                        .then(() => { if (window.location.pathname === '/login' || window.location.pathname === '/register') handlers.navigate('/'); })
                        .catch((error) => {
                            console.error('Desktop sign-in handoff failed', error);
                            handlers.showError(handlers.t(error?.code === 'auth/user-mismatch' ? 'login.desktop.accountMismatch' : 'login.desktop.browserFailed'));
                        });
                    break;
                }
                case 'attach-files': {
                    const files = filesFromPayload(data?.files);
                    const item = handlers.focusItem;
                    if (!files.length) {
                        handlers.showError(handlers.t('desktop.toast.filesTooLarge'));
                        break;
                    }
                    if (!canAttachToItem(item)) {
                        handlers.showInfo(handlers.t('desktop.toast.attachNeedsFocus'));
                        break;
                    }
                    handlers.showInfo(handlers.t('desktop.toast.attaching').replace('{count}', String(files.length)));
                    void attachFilesToItem(files, item)
                        .then((count) => handlers.showSuccess(handlers.t('desktop.toast.attached').replace('{count}', String(count)).replace('{title}', item.title)))
                        .catch(() => handlers.showError(handlers.t('desktop.toast.actionFailed')));
                    break;
                }
            }
        });
        return unsubscribe;
    }, [bridge]);

    // Queued commands (cold-start deep links, file drops) need the signed-in state and pins; flush only then.
    useEffect(() => {
        if (bridge && isAuthReady && (!user || !pinsLoading)) bridge.ready();
    }, [bridge, isAuthReady, user, pinsLoading]);

    // A snooze ends silently: re-push the tray state at that moment.
    useEffect(() => {
        const until = focusState?.status === 'snoozed' ? Date.parse(focusState.snoozedUntil || '') : NaN;
        if (!Number.isFinite(until) || until <= Date.now()) return;
        const timer = setTimeout(() => setSnoozeTick((tick) => tick + 1), until - Date.now() + 1000);
        return () => clearTimeout(timer);
    }, [focusState?.status, focusState?.snoozedUntil]);

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
                status: isSnoozed ? 'snoozed' : focusState?.status === 'blocked' ? 'blocked' : 'active',
                startedAt: focusState?.startedAt ?? null
            } : null,
            pinned: pinnedItems.map((item) => ({ id: item.id, title: item.title, path: pinnedItemPath(item) })),
            unread: unreadCount
        });
    }, [bridge, focusItem, focusState, pinnedItems, unreadCount, snoozeTick]);

    // Spotlight (macOS): projects and my open tasks of the active workspace; cleared on sign-out.
    useEffect(() => {
        if (!bridge?.indexSpotlight || !hasDesktopCapability('spotlight')) return undefined;
        if (!user || !activeWorkspaceId) {
            if (isAuthReady && !user) bridge.indexSpotlight([]);
            return undefined;
        }
        let cancelled = false;
        const refresh = () => {
            const { t: translate } = handlersRef.current;
            buildSpotlightEntries(activeWorkspaceId, { project: translate('desktop.spotlight.project'), personalTask: translate('desktop.spotlight.personalTask') })
                .then((entries) => { if (!cancelled) bridge.indexSpotlight?.(entries); })
                .catch((error) => console.warn('Spotlight index failed', error));
        };
        // Not at startup: sign-in and workspace resolution come first.
        const first = window.setTimeout(refresh, 20_000);
        const interval = window.setInterval(refresh, 30 * 60 * 1000);
        return () => {
            cancelled = true;
            window.clearTimeout(first);
            window.clearInterval(interval);
        };
    }, [bridge, user, activeWorkspaceId, isAuthReady, language]);

    // Push channel toggles (Settings → Notifications) also gate native desktop notifications.
    const pushPrefsRef = useRef<ResolvedNotificationPrefs>(resolveNotificationPrefs(undefined));
    useEffect(() => {
        if (!bridge || !user) return undefined;
        return subscribeToNotificationPrefs(user.uid, (prefs) => { pushPrefsRef.current = prefs; });
    }, [bridge, user]);

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
            setUnreadCount(unread.length);
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
            fresh.filter((notification) => allowsPushNotification(notification.type, pushPrefsRef.current)).slice(0, 3).forEach((notification) => {
                bridge.notify({
                    id: notification.id,
                    title: notification.title,
                    body: notification.message,
                    path: notificationPath(notification),
                    taskId: notification.taskId,
                    projectId: notification.projectId,
                    tenantId: notification.tenantId || activeWorkspaceId || undefined
                });
            });
        }, activeWorkspaceId || undefined);
        return () => unsubscribe();
    }, [bridge, user, activeWorkspaceId]);

    return settingsOpen ? (
        <SettingsModal isOpen initialTab="desktop" onClose={() => setSettingsOpen(false)} />
    ) : null;
};
