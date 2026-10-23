import { BrowserWindow, clipboard, screen } from 'electron';
import { appUrlFor } from '../config';
import { IPC } from '../contract';
import { getSettings } from '../store';
import { attachCommonContentsHandlers, isAppQuitting, windowWebPreferences } from './mainWindow';

const isMac = process.platform === 'darwin';
const CAPTURE_PATH = '/desktop/capture';
const DAY_PATH = '/desktop/day';
const CAPTURE_SIZE = { width: 640, height: 420 };

let captureWindow: BrowserWindow | null = null;
/** True once the capture page has subscribed (it calls `ready()`); payloads are queued until then. */
let captureReady = false;
let pendingCapturePayloads: Record<string, unknown>[] = [];
let dayWindow: BrowserWindow | null = null;

const alive = (win: BrowserWindow | null) => (win && !win.isDestroyed() ? win : null);

const backgroundColor = () => {
    const color = getSettings().lastBackground;
    return color && color.length === 7 ? color : '#f5f5f2';
};

// ---------------------------------------------------------------------------
// Quick Capture: a Spotlight-like panel, created hidden at startup so the global shortcut opens it instantly.
// macOS uses a non-activating panel: it takes keyboard focus without pulling the main window to the front,
// and it floats over full-screen apps.
// ---------------------------------------------------------------------------

export const createCaptureWindow = () => {
    if (alive(captureWindow)) return captureWindow!;
    captureReady = false;
    const win = new BrowserWindow({
        ...CAPTURE_SIZE,
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
        webPreferences: windowWebPreferences('capture')
    });
    captureWindow = win;
    win.setAlwaysOnTop(true, isMac ? 'floating' : undefined);
    if (isMac) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });

    attachCommonContentsHandlers(win, () => {
        setTimeout(() => { if (!win.isDestroyed()) void win.loadURL(appUrlFor(CAPTURE_PATH)); }, 10000);
    });
    win.webContents.on('did-start-navigation', (details) => {
        if (details.isMainFrame && !details.isSameDocument) captureReady = false;
    });
    win.on('blur', () => { if (!win.isDestroyed() && win.isVisible()) win.hide(); });
    win.on('close', (event) => {
        // Kept alive for instant re-open; only quitting destroys it.
        if (isAppQuitting()) return;
        event.preventDefault();
        win.hide();
    });
    win.on('closed', () => { if (captureWindow === win) captureWindow = null; });

    void win.loadURL(appUrlFor(CAPTURE_PATH));
    return win;
};

export const showCapture = (text?: string) => {
    const win = createCaptureWindow();
    // Upper third of the display under the cursor, like Spotlight.
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { x, y, width, height } = display.workArea;
    win.setBounds({
        x: Math.round(x + (width - CAPTURE_SIZE.width) / 2),
        y: Math.round(y + height * 0.2),
        ...CAPTURE_SIZE
    });
    const send = (payload: Record<string, unknown>) => {
        if (captureReady) win.webContents.send(IPC.windowPayload, payload);
        else pendingCapturePayloads = [...pendingCapturePayloads, payload].slice(-5);
    };
    send({ text: text ?? '', clipboard: '', openedAt: Date.now() });
    // Offered as a one-click chip in the capture field (short plain text only).
    void Promise.resolve(clipboard.readText()).then((value) => {
        const clip = String(value ?? '').trim();
        if (clip.length > 0 && clip.length <= 300) send({ clipboardOnly: true, clipboard: clip });
    }).catch(() => undefined);
    win.show();
    win.focus();
};

/** The capture page subscribed to payloads: deliver what arrived before. */
export const markCaptureReady = () => {
    const win = alive(captureWindow);
    if (!win) return;
    captureReady = true;
    const queued = pendingCapturePayloads;
    pendingCapturePayloads = [];
    queued.forEach((payload) => win.webContents.send(IPC.windowPayload, payload));
};

export const isCaptureWindow = (win: BrowserWindow | null) => Boolean(win && win === alive(captureWindow));

export const toggleCapture = () => {
    const win = alive(captureWindow);
    if (win?.isVisible()) win.hide();
    else showCapture();
};

export const hideCapture = () => alive(captureWindow)?.hide();

// ---------------------------------------------------------------------------
// Day start / day close window
// ---------------------------------------------------------------------------

export const openDayWindow = (mode: 'start' | 'close') => {
    const url = appUrlFor(`${DAY_PATH}?mode=${mode}`);
    const existing = alive(dayWindow);
    if (existing) {
        void existing.loadURL(url);
        existing.show();
        existing.focus();
        return existing;
    }
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { x, y, width, height } = display.workArea;
    const size = { width: 460, height: 640 };
    const win = new BrowserWindow({
        ...size,
        x: Math.round(x + (width - size.width) / 2),
        y: Math.round(y + (height - size.height) / 2),
        minWidth: 380,
        minHeight: 420,
        show: false,
        title: 'ProjectFlow',
        fullscreenable: false,
        maximizable: false,
        backgroundColor: backgroundColor(),
        ...(isMac ? { titleBarStyle: 'hidden' as const } : { frame: false }),
        webPreferences: windowWebPreferences('day')
    });
    dayWindow = win;
    if (isMac) win.setWindowButtonVisibility(false);
    attachCommonContentsHandlers(win, () => undefined);
    win.once('ready-to-show', () => {
        win.show();
        win.focus();
    });
    win.on('closed', () => { if (dayWindow === win) dayWindow = null; });
    void win.loadURL(url);
    return win;
};
