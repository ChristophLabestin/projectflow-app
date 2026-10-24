import { BrowserWindow, desktopCapturer, screen } from 'electron';
import { appUrlFor } from '../config';
import { IPC } from '../contract';
import { attachCommonContentsHandlers, isAppQuitting, windowWebPreferences } from './mainWindow';

/**
 * AI pop-out (global ⌃⌘J / Ctrl+Shift+Alt+J): the ⌘J command bar as a floating panel above any app, like the
 * command palette. Snap images arrive as payload (`{ image: data URL }`, from Quick Capture or "attach screen").
 * The screen is only captured on an explicit click (concept brain/plans/in-app-ai-concept.md §6).
 * Page: web/screens/DesktopAssistWindow.tsx.
 */
const isMac = process.platform === 'darwin';
const ASSIST_PATH = '/desktop/assist';
const ASSIST_SIZE = { width: 640, height: 560 };

let assistWindow: BrowserWindow | null = null;
let capturing = false;

const alive = (win: BrowserWindow | null) => (win && !win.isDestroyed() ? win : null);

const createAssistWindow = () => {
    const win = new BrowserWindow({
        ...ASSIST_SIZE,
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
        webPreferences: windowWebPreferences('assist')
    });
    assistWindow = win;
    win.setAlwaysOnTop(true, isMac ? 'floating' : undefined);
    if (isMac) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    attachCommonContentsHandlers(win, () => {
        setTimeout(() => { if (!win.isDestroyed()) void win.loadURL(appUrlFor(ASSIST_PATH)); }, 10000);
    });
    // Like Spotlight: clicking elsewhere hides it (not while the screen is being captured).
    win.on('blur', () => { if (!capturing && !win.isDestroyed() && win.isVisible()) win.hide(); });
    win.on('close', (event) => {
        if (isAppQuitting()) return;
        event.preventDefault();
        win.hide();
    });
    win.on('closed', () => { if (assistWindow === win) assistWindow = null; });
    void win.loadURL(appUrlFor(ASSIST_PATH));
    return win;
};

export const isAssistWindow = (win: BrowserWindow | null | undefined) => Boolean(win && win === alive(assistWindow));

/** Show the pop-out on the display under the cursor; `image` (data URL) starts a Snap. */
export const showAssist = (payload: { image?: string; prompt?: string } = {}) => {
    const win = alive(assistWindow) ?? createAssistWindow();
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { x, y, width, height } = display.workArea;
    win.setBounds({ x: Math.round(x + (width - ASSIST_SIZE.width) / 2), y: Math.round(y + height * 0.16), ...ASSIST_SIZE });
    const open = () => {
        win.show();
        win.focus();
        win.webContents.send(IPC.windowPayload, { openedAt: Date.now(), ...payload });
    };
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', () => setTimeout(open, 300));
    else open();
};

export const toggleAssist = () => {
    const win = alive(assistWindow);
    if (win?.isVisible()) win.hide();
    else showAssist();
};

export const hideAssist = () => alive(assistWindow)?.hide();

/**
 * "Attach screen": hide the pop-out, grab the display it is on (PNG data URL), show it again. Needs the
 * Screen Recording permission on macOS (the screenshot shortcut asks for it too); null when denied/failed.
 */
export const captureScreenForAssist = async (): Promise<string | null> => {
    const win = alive(assistWindow);
    if (!win || capturing) return null;
    capturing = true;
    try {
        const display = screen.getDisplayMatching(win.getBounds());
        win.hide();
        // Let the window manager remove the panel before the frame is taken.
        await new Promise((resolve) => setTimeout(resolve, 180));
        const size = { width: Math.round(display.size.width * display.scaleFactor), height: Math.round(display.size.height * display.scaleFactor) };
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size });
        const source = sources.find((entry) => entry.display_id === String(display.id)) || sources[0];
        const image = source && !source.thumbnail.isEmpty() ? source.thumbnail : null;
        return image ? `data:image/png;base64,${image.toPNG().toString('base64')}` : null;
    } catch (error) {
        console.warn('[desktop] assist screen capture failed', error);
        return null;
    } finally {
        if (!win.isDestroyed()) {
            win.show();
            win.focus();
        }
        capturing = false;
    }
};
