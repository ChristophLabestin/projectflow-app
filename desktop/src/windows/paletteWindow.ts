import { BrowserWindow, screen } from 'electron';
import { appUrlFor } from '../config';
import { IPC } from '../contract';
import { attachCommonContentsHandlers, isAppQuitting, windowWebPreferences } from './mainWindow';

/**
 * Command palette (Raycast-like): a floating search panel opened by a global shortcut from anywhere. Search
 * projects and tasks, open them in the main window, complete them or start a focus without switching apps.
 * Created on first use (not at startup, so it does not compete with the main window's sign-in) and then kept
 * hidden for instant re-open. Page: web/screens/DesktopCommandPalette.tsx.
 */
const isMac = process.platform === 'darwin';
const PALETTE_PATH = '/desktop/palette';
const PALETTE_SIZE = { width: 680, height: 480 };

let paletteWindow: BrowserWindow | null = null;

const alive = (win: BrowserWindow | null) => (win && !win.isDestroyed() ? win : null);

const createPaletteWindow = () => {
    const win = new BrowserWindow({
        ...PALETTE_SIZE,
        show: false,
        frame: false,
        transparent: true,
        resizable: false,
        movable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        hasShadow: false,
        ...(isMac ? { type: 'panel' as const } : {}),
        webPreferences: windowWebPreferences('palette')
    });
    paletteWindow = win;
    win.setAlwaysOnTop(true, isMac ? 'floating' : undefined);
    if (isMac) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    attachCommonContentsHandlers(win, () => {
        setTimeout(() => { if (!win.isDestroyed()) void win.loadURL(appUrlFor(PALETTE_PATH)); }, 10000);
    });
    win.on('blur', () => { if (!win.isDestroyed() && win.isVisible()) win.hide(); });
    win.on('close', (event) => {
        if (isAppQuitting()) return;
        event.preventDefault();
        win.hide();
    });
    win.on('closed', () => { if (paletteWindow === win) paletteWindow = null; });
    void win.loadURL(appUrlFor(PALETTE_PATH));
    return win;
};

export const showPalette = () => {
    const win = alive(paletteWindow) ?? createPaletteWindow();
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { x, y, width, height } = display.workArea;
    win.setBounds({ x: Math.round(x + (width - PALETTE_SIZE.width) / 2), y: Math.round(y + height * 0.18), ...PALETTE_SIZE });
    // The page resets its query and refreshes its data on this signal (a hidden panel gets no reliable focus event).
    const open = () => {
        win.show();
        win.focus();
        win.webContents.send(IPC.windowPayload, { openedAt: Date.now() });
    };
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', () => setTimeout(open, 300));
    else open();
};

export const togglePalette = () => {
    const win = alive(paletteWindow);
    if (win?.isVisible()) win.hide();
    else showPalette();
};

export const hidePalette = () => alive(paletteWindow)?.hide();
