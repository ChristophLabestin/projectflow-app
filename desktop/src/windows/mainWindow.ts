import { BrowserWindow, Menu, clipboard, nativeTheme, type WebContents } from 'electron';
import path from 'node:path';
import { APP_ORIGIN, APP_URL, IS_DEV, appUrlFor, isAppUrl } from '../config';
import { IPC, type DesktopCommandEvent, type DesktopWindowState, type TitleBarTheme, type WindowKind } from '../contract';
import { hardenAppContents, openExternalSafe } from '../security';
import { getSettings, updateSettings, visibleBounds } from '../store';
import { labels } from '../labels';

export const TITLEBAR_HEIGHT = 40;
const TRAFFIC_LIGHT_X = 14;
const TRAFFIC_LIGHT_SIZE = 12;

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let rendererReady = false;
let pendingCommands: DesktopCommandEvent[] = [];
let titleBarTheme: TitleBarTheme = { mode: 'system', color: '#00000000', symbolColor: '#6b7280' };

export const getMainWindow = () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null);
export const setQuitting = () => { isQuitting = true; };
export const isAppQuitting = () => isQuitting;

const preloadPath = () => path.join(__dirname, 'preload.js');

export const windowWebPreferences = (kind: WindowKind) => ({
    preload: preloadPath(),
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
    spellcheck: true,
    backgroundThrottling: kind !== 'main',
    additionalArguments: [`--pf-origin=${APP_ORIGIN}`, `--pf-window=${kind}`, `--pf-dev=${IS_DEV ? 1 : 0}`]
});

const windowState = (win: BrowserWindow): DesktopWindowState => ({
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
    isFocused: win.isFocused(),
    isAlwaysOnTop: win.isAlwaysOnTop(),
    canGoBack: win.webContents.navigationHistory.canGoBack(),
    canGoForward: win.webContents.navigationHistory.canGoForward(),
    zoomFactor: win.webContents.getZoomFactor()
});

export const getWindowState = (win: BrowserWindow) => windowState(win);

export const emitWindowState = (win: BrowserWindow) => {
    if (win.isDestroyed()) return;
    win.webContents.send(IPC.windowStateChanged, windowState(win));
};

/** Native controls do not follow page zoom, so the overlay / traffic lights are scaled to the zoomed bar. */
export const syncNativeTitleBar = (win: BrowserWindow) => {
    const factor = win.webContents.getZoomFactor();
    const height = Math.round(TITLEBAR_HEIGHT * factor);
    if (process.platform === 'darwin') {
        win.setWindowButtonPosition({ x: TRAFFIC_LIGHT_X, y: Math.round((height - TRAFFIC_LIGHT_SIZE) / 2) - 2 });
    } else if (process.platform === 'win32') {
        win.setTitleBarOverlay({ color: titleBarTheme.color, symbolColor: titleBarTheme.symbolColor, height });
    }
};

export const applyTitleBarTheme = (theme: TitleBarTheme) => {
    titleBarTheme = theme;
    nativeTheme.themeSource = theme.mode;
    updateSettings({ lastBackground: theme.color });
    [getMainWindow(), ...secondaryWindows].forEach((win) => { if (win && !win.isDestroyed()) syncNativeTitleBar(win); });
};

export const setZoomLevel = (win: BrowserWindow, level: number) => {
    const clamped = Math.max(-3, Math.min(4, level));
    win.webContents.setZoomLevel(clamped);
    updateSettings({ zoomLevel: clamped });
    syncNativeTitleBar(win);
    emitWindowState(win);
};

/** Commands are queued until the web app announced `ready` (cold-start deep links, early menu clicks). */
export const sendCommand = (event: DesktopCommandEvent) => {
    const win = getMainWindow();
    if (!win || !rendererReady) {
        pendingCommands.push(event);
        return;
    }
    win.webContents.send(IPC.command, event);
};

export const markRendererReady = () => {
    rendererReady = true;
    const win = getMainWindow();
    if (!win) return;
    const queued = pendingCommands;
    pendingCommands = [];
    queued.forEach((event) => win.webContents.send(IPC.command, event));
};

/** Windows app menu: renderer coordinates are zoomed CSS px, Menu.popup wants window DIPs. */
export const popupAppMenu = (win: BrowserWindow, x = 8, y = TITLEBAR_HEIGHT) => {
    const factor = win.webContents.getZoomFactor();
    Menu.getApplicationMenu()?.popup({ window: win, x: Math.round(x * factor), y: Math.round(y * factor) });
};

export const showMainWindow = () => {
    const win = getMainWindow() ?? createMainWindow();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return win;
};

const showOfflinePage = (win: BrowserWindow) => {
    void win.loadFile(path.join(__dirname, '..', 'assets', 'offline.html'), {
        query: {
            url: APP_URL.toString(),
            title: labels().offlineTitle,
            body: labels().offlineBody,
            retry: labels().offlineRetry
        }
    });
};

const attachContextMenu = (contents: WebContents) => {
    contents.on('context-menu', (_event, params) => {
        const items: Electron.MenuItemConstructorOptions[] = [];
        const l = labels();
        if (params.misspelledWord) {
            params.dictionarySuggestions.slice(0, 5).forEach((suggestion) => {
                items.push({ label: suggestion, click: () => contents.replaceMisspelling(suggestion) });
            });
            items.push({
                label: l.addToDictionary,
                click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
            });
            items.push({ type: 'separator' });
        }
        if (params.linkURL && isAppUrl(params.linkURL)) {
            const url = new URL(params.linkURL);
            items.push({ label: l.openInNewWindow, click: () => createSecondaryWindow(`${url.pathname}${url.search}`) });
        }
        if (params.linkURL) {
            items.push({ label: l.openLinkInBrowser, click: () => openExternalSafe(params.linkURL) });
            items.push({ label: l.copyLink, click: () => clipboard.writeText(params.linkURL) });
            items.push({ type: 'separator' });
        }
        if (params.isEditable) {
            items.push({ role: 'cut', label: l.cut, enabled: params.editFlags.canCut });
            items.push({ role: 'copy', label: l.copy, enabled: params.editFlags.canCopy });
            items.push({ role: 'paste', label: l.paste, enabled: params.editFlags.canPaste });
            items.push({ role: 'selectAll', label: l.selectAll });
        } else if (params.selectionText) {
            items.push({ role: 'copy', label: l.copy });
        }
        if (IS_DEV) {
            items.push({ type: 'separator' });
            items.push({ label: l.inspect, click: () => contents.inspectElement(params.x, params.y) });
        }
        while (items.length && items[items.length - 1].type === 'separator') items.pop();
        if (items.length) Menu.buildFromTemplate(items).popup();
    });
};

/** Shared by main and pop-out: offline fallback, crash recovery, context menu, navigation policy. */
export const attachCommonContentsHandlers = (win: BrowserWindow, onLoadFailed: () => void) => {
    const contents = win.webContents;
    hardenAppContents(contents);
    attachContextMenu(contents);
    contents.on('did-fail-load', (_event, errorCode, _description, _url, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) return; // -3 = ERR_ABORTED (navigation replaced)
        onLoadFailed();
    });
    contents.on('render-process-gone', (_event, details) => {
        if (details.reason !== 'clean-exit') onLoadFailed();
    });
};

/** Title bar per platform: traffic lights inside our bar (mac), caption-button overlay (Windows). */
const titleBarOptions = () => {
    if (process.platform === 'darwin') {
        return {
            titleBarStyle: 'hidden' as const,
            trafficLightPosition: { x: TRAFFIC_LIGHT_X, y: (TITLEBAR_HEIGHT - TRAFFIC_LIGHT_SIZE) / 2 - 2 }
        };
    }
    if (process.platform === 'win32') {
        return {
            titleBarStyle: 'hidden' as const,
            titleBarOverlay: { color: titleBarTheme.color, symbolColor: titleBarTheme.symbolColor, height: TITLEBAR_HEIGHT }
        };
    }
    return {};
};

// ---------------------------------------------------------------------------
// Secondary windows ("open in new window"): same chrome, no bridge duties; restored on launch.
// ---------------------------------------------------------------------------

const secondaryWindows = new Set<BrowserWindow>();

const persistSecondaryWindows = () => {
    if (isQuitting) return;
    updateSettings({
        secondaryWindows: [...secondaryWindows]
            .filter((win) => !win.isDestroyed())
            .map((win) => {
                const url = new URL(win.webContents.getURL() || APP_ORIGIN);
                return { path: `${url.pathname}${url.search}`, bounds: win.getBounds() };
            })
    });
};

export const createSecondaryWindow = (pathname: string, savedBounds?: Electron.Rectangle) => {
    const bounds = visibleBounds(savedBounds);
    const main = getMainWindow();
    const offset = main ? main.getBounds() : null;
    const win = new BrowserWindow({
        width: bounds?.width ?? 1200,
        height: bounds?.height ?? 800,
        x: bounds?.x ?? (offset ? offset.x + 32 : undefined),
        y: bounds?.y ?? (offset ? offset.y + 32 : undefined),
        minWidth: 720,
        minHeight: 480,
        show: false,
        title: 'ProjectFlow',
        backgroundColor: getSettings().lastBackground?.length === 7 ? getSettings().lastBackground : '#f5f5f2',
        ...titleBarOptions(),
        webPreferences: windowWebPreferences('secondary')
    });
    secondaryWindows.add(win);
    win.once('ready-to-show', () => win.show());
    attachCommonContentsHandlers(win, () => undefined);
    const emit = () => emitWindowState(win);
    ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'focus', 'blur']
        .forEach((name) => win.on(name as 'focus', emit));
    win.webContents.on('did-navigate', emit);
    win.webContents.on('did-navigate-in-page', () => { emit(); persistSecondaryWindows(); });
    win.webContents.on('did-finish-load', () => syncNativeTitleBar(win));
    win.on('moved', persistSecondaryWindows);
    win.on('resized', persistSecondaryWindows);
    win.on('closed', () => {
        secondaryWindows.delete(win);
        persistSecondaryWindows();
    });
    void win.loadURL(appUrlFor(pathname));
    persistSecondaryWindows();
    return win;
};

export const restoreSecondaryWindows = () => {
    getSettings().secondaryWindows.forEach(({ path: saved, bounds }) => createSecondaryWindow(saved, bounds));
};

export const createMainWindow = (initialPath = '/') => {
    const settings = getSettings();
    const isWin = process.platform === 'win32';
    const bounds = visibleBounds(settings.mainBounds);

    const win = new BrowserWindow({
        width: bounds?.width ?? 1440,
        height: bounds?.height ?? 900,
        x: bounds?.x,
        y: bounds?.y,
        minWidth: 900,
        minHeight: 600,
        show: false,
        title: 'ProjectFlow',
        backgroundColor: settings.lastBackground && settings.lastBackground.length === 7 ? settings.lastBackground : '#f5f5f2',
        ...titleBarOptions(),
        webPreferences: windowWebPreferences('main')
    });
    mainWindow = win;
    rendererReady = false;

    if (settings.mainMaximized) win.maximize();
    win.once('ready-to-show', () => win.show());
    // Never wait forever for ready-to-show (e.g. a slow remote load).
    setTimeout(() => { if (!win.isDestroyed() && !win.isVisible()) win.show(); }, 4000);

    const contents = win.webContents;
    attachCommonContentsHandlers(win, () => {
        rendererReady = false;
        showOfflinePage(win);
    });

    contents.on('did-finish-load', () => {
        if (typeof settings.zoomLevel === 'number') contents.setZoomLevel(settings.zoomLevel);
        syncNativeTitleBar(win);
    });
    // Page reloads / navigations drop the renderer's bridge listeners until it says ready again.
    contents.on('did-start-navigation', (details) => {
        if (details.isMainFrame && !details.isSameDocument) rendererReady = false;
    });
    contents.on('zoom-changed', (_event, direction) => {
        setZoomLevel(win, contents.getZoomLevel() + (direction === 'in' ? 0.5 : -0.5));
    });

    // Windows: the menu bar is hidden by titleBarStyle, so Alt (alone) and F10 open the app menu.
    let altPressedAlone = false;
    contents.on('before-input-event', (event, input) => {
        if (!isWin) return;
        if (input.type === 'keyDown') {
            altPressedAlone = input.key === 'Alt' && !input.isAutoRepeat;
            if (input.key === 'F10' && !input.shift && !input.control && !input.alt) {
                event.preventDefault();
                popupAppMenu(win);
            }
        } else if (input.type === 'keyUp' && input.key === 'Alt' && altPressedAlone) {
            altPressedAlone = false;
            popupAppMenu(win);
        }
    });

    const emit = () => emitWindowState(win);
    ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'focus', 'blur', 'always-on-top-changed']
        .forEach((name) => win.on(name as 'focus', emit));
    contents.on('did-navigate', emit);
    contents.on('did-navigate-in-page', emit);

    const persistBounds = () => {
        if (win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return;
        updateSettings({ mainMaximized: win.isMaximized(), ...(win.isMaximized() ? {} : { mainBounds: win.getBounds() }) });
    };
    win.on('resize', persistBounds);
    win.on('move', persistBounds);

    // Closing hides the window so notifications, badge and tray keep working; Quit really quits.
    win.on('close', (event) => {
        if (isQuitting) return;
        event.preventDefault();
        if (win.isFullScreen()) {
            win.once('leave-full-screen', () => win.hide());
            win.setFullScreen(false);
        } else {
            win.hide();
        }
    });
    win.on('closed', () => {
        if (mainWindow === win) mainWindow = null;
    });

    void win.loadURL(appUrlFor(initialPath));
    return win;
};
