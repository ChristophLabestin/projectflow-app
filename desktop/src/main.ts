import { app, globalShortcut } from 'electron';
import path from 'node:path';
import { APP_ID, IS_DEV, PROTOCOL, sanitizeAppPath } from './config';
import { registerIpc } from './ipc';
import { installMenus } from './menu';
import { applySessionSecurity, hardenChildWindows } from './security';
import { flushSettings, getSettings } from './store';
import { createTray, destroyTray, refreshTray } from './tray';
import { createMainWindow, sendCommand, setQuitting, showMainWindow } from './windows/mainWindow';
import { openQuickAccess, setQuickAccessStateListener, toggleQuickAccess } from './windows/quickAccess';

const DEFAULT_SHORTCUT = process.platform === 'darwin' ? 'Alt+Command+P' : 'Control+Shift+Alt+P';

app.setName('ProjectFlow');
if (IS_DEV) {
    // Separate profile for dev; the dev script passes a fresh temp dir per run.
    app.setPath('userData', process.env.PF_DESKTOP_USER_DATA || path.join(app.getPath('appData'), 'ProjectFlow Dev'));
}
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

/** `projectflow://project/<id>/tasks/<taskId>` → `/project/<id>/tasks/<taskId>` (same paths as the web/iOS app). */
const deepLinkPath = (value: string | undefined) => {
    if (!value?.startsWith(`${PROTOCOL}://`)) return null;
    try {
        const url = new URL(value);
        return sanitizeAppPath(`/${url.host}${url.pathname === '/' ? '' : url.pathname}${url.search}`);
    } catch {
        return null;
    }
};
const deepLinkFromArgv = (argv: string[]) => argv.map(deepLinkPath).find((value): value is string => Boolean(value)) ?? null;

const openDeepLink = (url: string) => {
    const target = deepLinkPath(url);
    showMainWindow();
    if (target) sendCommand({ command: 'navigate', path: target });
};

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    // macOS registers the scheme from Info.plist in packaged builds; dev registration is best effort.
    if (process.defaultApp && process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    } else {
        app.setAsDefaultProtocolClient(PROTOCOL);
    }

    let coldStartPath: string | null = deepLinkFromArgv(process.argv);

    app.on('open-url', (event, url) => {
        event.preventDefault();
        if (app.isReady()) openDeepLink(url);
        else coldStartPath = deepLinkPath(url);
    });

    app.on('second-instance', (_event, argv) => {
        const target = deepLinkFromArgv(argv);
        showMainWindow();
        if (target) sendCommand({ command: 'navigate', path: target });
    });

    hardenChildWindows();

    app.whenReady().then(() => {
        applySessionSecurity();
        registerIpc();
        app.setAboutPanelOptions({
            applicationName: 'ProjectFlow',
            applicationVersion: app.getVersion(),
            copyright: '© Labestin Digital'
        });
        if (process.platform === 'darwin' && IS_DEV) app.dock?.setIcon(path.join(__dirname, '..', 'assets', 'icon.png'));

        createMainWindow(coldStartPath ?? '/');
        coldStartPath = null;

        setQuickAccessStateListener(() => {
            installMenus();
            refreshTray();
        });
        installMenus();
        createTray();

        const shortcut = getSettings().quickAccessShortcut === undefined ? DEFAULT_SHORTCUT : getSettings().quickAccessShortcut;
        if (shortcut) {
            try {
                if (!globalShortcut.register(shortcut, toggleQuickAccess)) {
                    console.warn(`[desktop] global shortcut ${shortcut} is taken by another app`);
                }
            } catch (error) {
                console.warn('[desktop] invalid global shortcut', error);
            }
        }

        if (getSettings().quickAccessOpen) openQuickAccess();
    });

    app.on('activate', () => showMainWindow());

    app.on('before-quit', () => {
        setQuitting();
        flushSettings();
    });

    app.on('will-quit', () => {
        globalShortcut.unregisterAll();
        destroyTray();
    });

    // Main hides on close, so this only fires while quitting.
    app.on('window-all-closed', () => app.quit());
}
