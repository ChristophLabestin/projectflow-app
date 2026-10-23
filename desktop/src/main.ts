import { app, globalShortcut, session } from 'electron';
import { startDayFlow, stopDayFlow } from './features/dayFlow';
import { filesFromArgv, queueFilesForFocus } from './features/files';
import { refreshTouchBar } from './features/focus';
import { initPreferences } from './features/preferences';
import { stopCalendar } from './features/calendar';
import { setAppWindowOpener } from './security';
import { createCaptureWindow, showCapture } from './windows/auxWindows';
import { createTrayPanel } from './windows/trayPanel';
import path from 'node:path';
import { APP_ID, IS_DEV, PROTOCOL, sanitizeAppPath } from './config';
import { registerIpc } from './ipc';
import { installMenus } from './menu';
import { applySessionSecurity, hardenChildWindows } from './security';
import { flushSettings, getSettings } from './store';
import { createTray, destroyTray, refreshTray } from './tray';
import { createMainWindow, createSecondaryWindow, restoreSecondaryWindows, sendCommand, setQuitting, showMainWindow } from './windows/mainWindow';
import { openQuickAccess, setQuickAccessStateListener } from './windows/quickAccess';

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

/** `/desktop/command/<name>` deep links come from the Windows jump list. */
const handleDeepLinkPath = (target: string | null) => {
    if (target === '/desktop/command/quick-capture') {
        showCapture();
        return;
    }
    showMainWindow();
    if (target === '/desktop/command/new-task') sendCommand({ command: 'new-task' });
    else if (target) sendCommand({ command: 'navigate', path: target });
};

const openDeepLink = (url: string) => handleDeepLinkPath(deepLinkPath(url));

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
        const files = filesFromArgv(argv);
        if (files.length) {
            queueFilesForFocus(files);
            return;
        }
        handleDeepLinkPath(deepLinkFromArgv(argv));
    });

    // macOS: files dropped onto the Dock icon (may arrive before ready).
    app.on('open-file', (event, filePath) => {
        event.preventDefault();
        queueFilesForFocus([filePath]);
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

        const coldStart = coldStartPath;
        coldStartPath = null;
        const mainWindow = createMainWindow(coldStart?.startsWith('/desktop/command/') ? '/' : coldStart ?? '/');
        // Preload the hidden helper windows (instant Quick Capture / menu bar panel) only after the main window
        // has loaded, so they do not compete with it for sign-in and workspace resolution at startup.
        mainWindow.webContents.once('did-finish-load', () => setTimeout(() => {
            createCaptureWindow();
            createTrayPanel();
        }, 3000));
        if (coldStart?.startsWith('/desktop/command/')) handleDeepLinkPath(coldStart);

        setQuickAccessStateListener(() => {
            installMenus();
            refreshTray();
        });
        installMenus();
        createTray();

        initPreferences();
        setAppWindowOpener((target) => createSecondaryWindow(target));
        restoreSecondaryWindows();
        refreshTouchBar();
        startDayFlow();
        const argvFiles = filesFromArgv(process.argv);
        if (argvFiles.length) queueFilesForFocus(argvFiles);

        if (getSettings().quickAccessOpen) openQuickAccess();
    });

    app.on('activate', () => showMainWindow());

    app.on('before-quit', () => {
        setQuitting();
        flushSettings();
        // localStorage (language, theme, …) is written lazily by Chromium; make sure it reaches disk.
        session.defaultSession.flushStorageData();
    });

    app.on('will-quit', () => {
        globalShortcut.unregisterAll();
        stopDayFlow();
        stopCalendar();
        destroyTray();
    });

    // Main hides on close, so this only fires while quitting.
    app.on('window-all-closed', () => app.quit());
}
