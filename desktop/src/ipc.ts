import { BrowserWindow, Notification, app, ipcMain, nativeImage } from 'electron';
import { sanitizeAppPath } from './config';
import { IPC, type DesktopNotificationPayload, type QuickAccessAction, type TitleBarTheme, type WindowAction } from './contract';
import { setLanguage } from './labels';
import { installMenus } from './menu';
import { isTrustedSender } from './security';
import { refreshTray, updateTray } from './tray';
import {
    applyTitleBarTheme,
    getMainWindow,
    getWindowState,
    markRendererReady,
    popupAppMenu,
    sendCommand,
    showMainWindow
} from './windows/mainWindow';
import {
    closeQuickAccess,
    dockQuickAccess,
    getQuickAccessState,
    openPathInMain,
    openQuickAccess,
    setQuickAccessAlwaysOnTop,
    toggleQuickAccess
} from './windows/quickAccess';

const COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const shownNotifications = new Map<string, Notification>();

const showNotification = (payload: DesktopNotificationPayload) => {
    if (!Notification.isSupported()) return;
    if (typeof payload?.id !== 'string' || typeof payload.title !== 'string') return;
    if (shownNotifications.has(payload.id)) return;
    const path = sanitizeAppPath(payload.path);
    const notification = new Notification({
        title: payload.title.slice(0, 120),
        body: typeof payload.body === 'string' ? payload.body.slice(0, 300) : undefined,
        silent: false
    });
    notification.on('click', () => {
        showMainWindow();
        if (path) sendCommand({ command: 'navigate', path });
    });
    // Keep a reference, otherwise the click handler can be garbage collected before it fires.
    notification.on('close', () => shownNotifications.delete(payload.id));
    shownNotifications.set(payload.id, notification);
    notification.show();
};

const setBadge = (count: unknown, overlayDataUrl: unknown) => {
    const value = typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    if (process.platform === 'win32') {
        // Windows has no badge count: the renderer draws the overlay icon.
        const win = getMainWindow();
        if (!win) return;
        const image = value > 0 && typeof overlayDataUrl === 'string' && overlayDataUrl.startsWith('data:image/png;base64,')
            ? nativeImage.createFromDataURL(overlayDataUrl)
            : null;
        win.setOverlayIcon(image, value > 0 ? String(value) : '');
        return;
    }
    app.setBadgeCount(value);
};

export const registerIpc = () => {
    const on = (channel: string, handler: (event: Electron.IpcMainEvent, ...args: any[]) => void) => {
        ipcMain.on(channel, (event, ...args) => {
            if (isTrustedSender(event)) handler(event, ...args);
        });
    };
    const handle = (channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown) => {
        ipcMain.handle(channel, (event, ...args) => {
            if (!isTrustedSender(event)) throw new Error('untrusted sender');
            return handler(event, ...args);
        });
    };
    const senderWindow = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender);

    handle(IPC.windowState, (event) => {
        const win = senderWindow(event);
        return win ? getWindowState(win) : null;
    });

    on(IPC.windowAction, (event, action: WindowAction) => {
        const win = senderWindow(event);
        if (!win) return;
        switch (action) {
            case 'minimize': win.minimize(); break;
            case 'toggle-maximize': if (win.isMaximized()) win.unmaximize(); else win.maximize(); break;
            case 'close': win.close(); break;
            case 'back': win.webContents.navigationHistory.goBack(); break;
            case 'forward': win.webContents.navigationHistory.goForward(); break;
        }
    });

    on(IPC.showAppMenu, (event, position: { x?: unknown; y?: unknown }) => {
        const win = senderWindow(event);
        if (!win) return;
        const x = typeof position?.x === 'number' ? position.x : 8;
        const y = typeof position?.y === 'number' ? position.y : 40;
        popupAppMenu(win, x, y);
    });

    on(IPC.setTitleBarTheme, (event, theme: TitleBarTheme) => {
        if (senderWindow(event) !== getMainWindow()) return;
        if (!theme || !COLOR.test(theme.color) || !COLOR.test(theme.symbolColor)) return;
        if (!['light', 'dark', 'system'].includes(theme.mode)) return;
        applyTitleBarTheme(theme);
    });

    handle(IPC.quickAccess, (_event, action: QuickAccessAction, value?: unknown) => {
        switch (action) {
            case 'open': openQuickAccess(); break;
            case 'close': closeQuickAccess(); break;
            case 'toggle': toggleQuickAccess(); break;
            case 'dock': dockQuickAccess(); break;
            case 'set-always-on-top': setQuickAccessAlwaysOnTop(Boolean(value)); break;
            case 'state': break;
        }
        return getQuickAccessState();
    });

    on(IPC.openInMain, (_event, path: unknown) => {
        const safe = sanitizeAppPath(path);
        if (safe) openPathInMain(safe);
    });

    on(IPC.rendererReady, (event) => {
        if (senderWindow(event) === getMainWindow()) markRendererReady();
    });

    // Badge, notifications and tray belong to the main window only (the pop-out would duplicate them).
    on(IPC.setBadge, (event, payload: { count?: unknown; overlayDataUrl?: unknown }) => {
        if (senderWindow(event) === getMainWindow()) setBadge(payload?.count, payload?.overlayDataUrl);
    });
    on(IPC.notify, (event, payload: DesktopNotificationPayload) => {
        if (senderWindow(event) === getMainWindow()) showNotification(payload);
    });
    on(IPC.updateTray, (event, snapshot: unknown) => {
        if (senderWindow(event) === getMainWindow()) updateTray(snapshot);
    });
    on(IPC.setLanguage, (_event, language: unknown) => {
        if (setLanguage(language)) {
            installMenus();
            refreshTray();
        }
    });
};
