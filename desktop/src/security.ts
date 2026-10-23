import { app, session, shell, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { APP_ORIGIN, isAppUrl } from './config';

/** Notifications are shown by main, so the page needs none of the notification permissions. */
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'fullscreen']);

/** Firebase `signInWithPopup` on the hosted app opens `<app origin>/__/auth/handler` (same-origin authDomain). */
const isAuthPopupUrl = (value: string) => {
    try {
        const url = new URL(value);
        return url.origin === APP_ORIGIN && url.pathname === '/__/auth/handler';
    } catch {
        return false;
    }
};

/** Opens http(s)/mailto in the default browser; every other scheme is dropped. */
export const openExternalSafe = (value: string) => {
    try {
        const url = new URL(value);
        if (['https:', 'http:', 'mailto:'].includes(url.protocol)) {
            void shell.openExternal(url.toString());
        }
    } catch {
        // ignore malformed URLs
    }
};

/** IPC is accepted only from the top frame of an app-origin page (never iframes or other origins). */
export const isTrustedSender = (event: IpcMainEvent | IpcMainInvokeEvent) => {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame) return false;
    try {
        return new URL(frame.url).origin === APP_ORIGIN;
    } catch {
        return false;
    }
};

export const applySessionSecurity = () => {
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(isAppUrl(webContents.getURL()) && ALLOWED_PERMISSIONS.has(permission));
    });
    ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => (
        requestingOrigin === APP_ORIGIN && ALLOWED_PERMISSIONS.has(permission)
    ));
};

const isOfflinePage = (url: string) => url.startsWith('file://') && url.includes('offline.html');

let openAppWindow: ((path: string) => void) | null = null;

/** window.open / ⌘-click on an app URL opens a ProjectFlow window instead of the browser. */
export const setAppWindowOpener = (opener: (path: string) => void) => {
    openAppWindow = opener;
};

/** Navigation + window.open policy for an app window (main or quick access). */
export const hardenAppContents = (contents: WebContents) => {
    contents.setWindowOpenHandler(({ url }) => {
        // Auth popups are app-origin URLs too, so they must be matched first.
        if (isAuthPopupUrl(url)) {
            return {
                action: 'allow',
                // Child windows inherit the parent's webPreferences (incl. preload) unless overridden.
                overrideBrowserWindowOptions: {
                    width: 520,
                    height: 680,
                    autoHideMenuBar: true,
                    webPreferences: { preload: undefined, sandbox: true, contextIsolation: true, nodeIntegration: false }
                }
            };
        }
        if (isAppUrl(url) && openAppWindow) {
            const parsed = new URL(url);
            openAppWindow(`${parsed.pathname}${parsed.search}${parsed.hash}`);
            return { action: 'deny' };
        }
        openExternalSafe(url);
        return { action: 'deny' };
    });

    const guard = (event: Electron.Event, url: string) => {
        if (isAppUrl(url) || isOfflinePage(url)) return;
        event.preventDefault();
        openExternalSafe(url);
    };
    contents.on('will-navigate', guard);
    contents.on('will-redirect', guard);
    contents.on('will-attach-webview', (event) => event.preventDefault());
};

/** OAuth popups may follow the provider's redirects but never open further windows. */
export const hardenChildWindows = () => {
    app.on('web-contents-created', (_event, contents) => {
        contents.on('did-create-window', (child) => {
            child.webContents.setWindowOpenHandler(({ url }) => {
                openExternalSafe(url);
                return { action: 'deny' };
            });
        });
    });
};
