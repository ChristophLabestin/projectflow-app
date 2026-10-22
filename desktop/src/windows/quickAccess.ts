import { BrowserWindow, app } from 'electron';
import { QUICK_ACCESS_PATH, appUrlFor } from '../config';
import { IPC, type QuickAccessState } from '../contract';
import { getSettings, updateSettings, visibleBounds } from '../store';
import { attachCommonContentsHandlers, isAppQuitting, sendCommand, showMainWindow, windowWebPreferences } from './mainWindow';

let quickAccessWindow: BrowserWindow | null = null;
let onStateChange: (() => void) | null = null;

const isMac = process.platform === 'darwin';

export const getQuickAccessWindow = () => (
    quickAccessWindow && !quickAccessWindow.isDestroyed() ? quickAccessWindow : null
);

export const getQuickAccessState = (): QuickAccessState => ({
    isOpen: Boolean(getQuickAccessWindow()),
    alwaysOnTop: getSettings().quickAccessAlwaysOnTop
});

/** Menus/tray rebuild their checkboxes through this hook. */
export const setQuickAccessStateListener = (listener: () => void) => {
    onStateChange = listener;
};

const broadcast = () => {
    const state = getQuickAccessState();
    BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send(IPC.quickAccessChanged, state);
    });
    onStateChange?.();
};

/**
 * Always-on-top differs per platform:
 * - macOS: `floating` level keeps it above normal windows; `visibleOnAllWorkspaces` + `visibleOnFullScreen`
 *   lets it follow the user across Spaces and over full-screen apps. `skipTransformProcessType` avoids the
 *   dock icon flicker that the process-type transform would cause.
 * - Windows: levels do not exist (HWND_TOPMOST); floats over normal and borderless full-screen windows.
 */
const applyAlwaysOnTop = (win: BrowserWindow, enabled: boolean) => {
    if (isMac) {
        win.setAlwaysOnTop(enabled, 'floating');
        win.setVisibleOnAllWorkspaces(enabled, { visibleOnFullScreen: enabled, skipTransformProcessType: true });
    } else {
        win.setAlwaysOnTop(enabled);
    }
};

export const setQuickAccessAlwaysOnTop = (enabled: boolean) => {
    updateSettings({ quickAccessAlwaysOnTop: enabled });
    const win = getQuickAccessWindow();
    if (win) applyAlwaysOnTop(win, enabled);
    broadcast();
};

export const openQuickAccess = () => {
    const existing = getQuickAccessWindow();
    if (existing) {
        existing.show();
        existing.focus();
        return existing;
    }

    const settings = getSettings();
    const bounds = visibleBounds(settings.quickAccessBounds);
    const win = new BrowserWindow({
        width: bounds?.width ?? 380,
        height: bounds?.height ?? 580,
        x: bounds?.x,
        y: bounds?.y,
        minWidth: 300,
        minHeight: 360,
        show: false,
        title: 'ProjectFlow – Quick Access',
        fullscreenable: false,
        maximizable: false,
        minimizable: !isMac,
        skipTaskbar: process.platform === 'win32',
        backgroundColor: settings.lastBackground && settings.lastBackground.length === 7 ? settings.lastBackground : '#f5f5f2',
        // macOS keeps native rounded corners/shadow/resizing with a hidden title bar; Windows is frameless.
        ...(isMac ? { titleBarStyle: 'hidden' as const } : { frame: false }),
        webPreferences: windowWebPreferences('quick-access')
    });
    quickAccessWindow = win;
    if (isMac) win.setWindowButtonVisibility(false);
    applyAlwaysOnTop(win, settings.quickAccessAlwaysOnTop);

    win.once('ready-to-show', () => {
        win.show();
        // Showing an all-workspaces window must not hide the dock icon of the main app.
        if (isMac) void app.dock?.show();
    });

    attachCommonContentsHandlers(win, () => {
        // No offline page for the small window; retry quietly.
        setTimeout(() => { if (!win.isDestroyed()) void win.loadURL(appUrlFor(QUICK_ACCESS_PATH)); }, 5000);
    });

    const persist = () => {
        if (!win.isDestroyed()) updateSettings({ quickAccessBounds: win.getBounds() });
    };
    win.on('resize', persist);
    win.on('move', persist);
    win.on('closed', () => {
        if (quickAccessWindow === win) quickAccessWindow = null;
        // Quitting keeps the flag so the pop-out comes back on next launch.
        if (!isAppQuitting()) updateSettings({ quickAccessOpen: false });
        broadcast();
    });

    updateSettings({ quickAccessOpen: true });
    void win.loadURL(appUrlFor(QUICK_ACCESS_PATH));
    broadcast();
    return win;
};

export const closeQuickAccess = () => {
    getQuickAccessWindow()?.close();
};

export const toggleQuickAccess = () => {
    if (getQuickAccessWindow()) closeQuickAccess();
    else openQuickAccess();
};

/** Closes the pop-out and reopens Quick Access as modal in the main window. */
export const dockQuickAccess = () => {
    closeQuickAccess();
    showMainWindow();
    sendCommand({ command: 'open-quick-access-modal' });
};

/** The pop-out never navigates itself; item links open in the main window. */
export const openPathInMain = (path: string) => {
    showMainWindow();
    sendCommand({ command: 'navigate', path });
};
