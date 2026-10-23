import { BrowserWindow, WebContentsView, nativeTheme } from 'electron';
import path from 'node:path';
import { labels } from '../labels';
import { getSettings } from '../store';

/**
 * Animated launch scene (assets/splash.html, same motion as the iOS launch) as an overlay in the main window:
 * the window opens at once with the scene, and it fades into the app once the web app reports ready
 * (`markRendererReady`) or failed to load. Never longer than MAX_MS; at least MIN_MS so it never flickers.
 */
const MIN_MS = 1400;
const MAX_MS = 25_000;
const FADE_MS = 450;

let overlay: { view: WebContentsView; win: BrowserWindow; shownAt: number; closing: boolean } | null = null;

/** Light/dark like the app's last background (the web theme can differ from the system). */
const isDark = () => {
    const color = getSettings().lastBackground;
    if (color && /^#[0-9a-f]{6}$/i.test(color)) {
        const [r, g, b] = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
    }
    return nativeTheme.shouldUseDarkColors;
};

export const attachSplash = (win: BrowserWindow, onReady: () => void) => {
    const view = new WebContentsView({
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true }
    });
    const dark = isDark();
    view.setBackgroundColor(dark ? '#0b0d11' : '#f2f2f3');
    const fit = () => {
        const [width, height] = win.getContentSize();
        view.setBounds({ x: 0, y: 0, width, height });
    };
    fit();
    win.on('resize', fit);
    win.contentView.addChildView(view);
    overlay = { view, win, shownAt: Date.now(), closing: false };
    // The splash never navigates anywhere or opens windows.
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', (event) => event.preventDefault());
    view.webContents.once('did-finish-load', onReady);
    const l = labels();
    void view.webContents.loadFile(path.join(__dirname, '..', 'assets', 'splash.html'), {
        query: { theme: dark ? 'dark' : 'light', preparing: l.splashPreparing, slow: l.splashSlow }
    });
    setTimeout(finishSplash, MAX_MS);
};

/** Fade the scene out and remove it (idempotent). */
export const finishSplash = () => {
    const current = overlay;
    if (!current || current.closing) return;
    current.closing = true;
    const wait = Math.max(0, MIN_MS - (Date.now() - current.shownAt));
    setTimeout(() => {
        if (current.view.webContents.isDestroyed()) return;
        void current.view.webContents.executeJavaScript('window.pfSplashDone && window.pfSplashDone()').catch(() => undefined);
        setTimeout(() => {
            if (!current.win.isDestroyed()) current.win.contentView.removeChildView(current.view);
            if (!current.view.webContents.isDestroyed()) current.view.webContents.close();
            if (overlay === current) overlay = null;
        }, FADE_MS);
    }, wait);
};
