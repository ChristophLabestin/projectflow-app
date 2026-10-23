import { BrowserWindow, screen, type Rectangle } from 'electron';
import { appUrlFor } from '../config';
import { IPC } from '../contract';
import { attachCommonContentsHandlers, isAppQuitting, windowWebPreferences } from './mainWindow';

/**
 * Menu bar panel: a popover under the tray icon (macOS) / above the tray (Windows) with focus, today's plan,
 * pinned items, inbox and quick actions. Created hidden at startup so a click opens it instantly; hides on blur.
 */

const isMac = process.platform === 'darwin';
const PANEL_PATH = '/desktop/tray';
const SIZE = { width: 380, height: 600 };
const GAP = 6;

let panel: BrowserWindow | null = null;
let ready = false;
let hiddenAt = 0;

const alive = () => (panel && !panel.isDestroyed() ? panel : null);

export const createTrayPanel = () => {
    if (alive()) return panel!;
    ready = false;
    const win = new BrowserWindow({
        ...SIZE,
        show: false,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        hasShadow: false,
        ...(isMac ? { type: 'panel' as const } : {}),
        webPreferences: windowWebPreferences('tray')
    });
    panel = win;
    win.setAlwaysOnTop(true, isMac ? 'pop-up-menu' : undefined);
    if (isMac) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });

    attachCommonContentsHandlers(win, () => {
        setTimeout(() => { if (!win.isDestroyed()) void win.loadURL(appUrlFor(PANEL_PATH)); }, 10000);
    });
    win.webContents.on('did-finish-load', () => { ready = true; });
    win.on('blur', () => {
        if (win.isDestroyed() || !win.isVisible()) return;
        hiddenAt = Date.now();
        win.hide();
    });
    win.on('close', (event) => {
        if (isAppQuitting()) return;
        event.preventDefault();
        win.hide();
    });
    win.on('closed', () => { if (panel === win) panel = null; });
    void win.loadURL(appUrlFor(PANEL_PATH));
    return win;
};

/** Below the icon on macOS (menu bar on top); above it on Windows (taskbar usually at the bottom). */
const positionFor = (trayBounds: Rectangle) => {
    const display = screen.getDisplayMatching(trayBounds);
    const { x: areaX, y: areaY, width: areaW, height: areaH } = display.workArea;
    const centerX = Math.round(trayBounds.x + trayBounds.width / 2 - SIZE.width / 2);
    const x = Math.min(Math.max(centerX, areaX + GAP), areaX + areaW - SIZE.width - GAP);
    const taskbarAtTop = trayBounds.y < areaY + areaH / 2;
    const y = taskbarAtTop
        ? Math.max(areaY, trayBounds.y + trayBounds.height) + GAP
        : Math.min(areaY + areaH, trayBounds.y) - SIZE.height - GAP;
    return { x, y };
};

export const toggleTrayPanel = (trayBounds: Rectangle) => {
    const win = createTrayPanel();
    // A click on the icon first blurs the open panel; do not reopen it right away.
    if (win.isVisible() || Date.now() - hiddenAt < 250) {
        win.hide();
        return;
    }
    const { x, y } = positionFor(trayBounds);
    win.setBounds({ x, y, ...SIZE });
    if (ready) win.webContents.send(IPC.windowPayload, { shownAt: Date.now() });
    win.show();
    win.focus();
};

export const hideTrayPanel = () => alive()?.hide();
