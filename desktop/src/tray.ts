import { Menu, Tray, app, nativeImage } from 'electron';
import path from 'node:path';
import type { TraySnapshot } from './contract';
import { labels } from './labels';
import { sanitizeAppPath } from './config';
import { showMainWindow } from './windows/mainWindow';
import { openPathInMain, toggleQuickAccess } from './windows/quickAccess';
import { showCapture } from './windows/auxWindows';
import { updateFocus } from './features/focus';

let tray: Tray | null = null;
let snapshot: TraySnapshot = { focus: null, pinned: [] };

const MAX_TITLE = 28;
const truncate = (value: string, max = MAX_TITLE) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

const trayIcon = () => {
    const assets = path.join(__dirname, '..', 'assets');
    if (process.platform === 'darwin') {
        // Template images adapt to light/dark menu bars automatically (…Template.png + @2x).
        const image = nativeImage.createFromPath(path.join(assets, 'trayTemplate.png'));
        image.setTemplateImage(true);
        return image;
    }
    return nativeImage.createFromPath(path.join(assets, 'tray.png'));
};

const focusLabel = () => {
    const focus = snapshot.focus;
    if (!focus) return labels().focusNone;
    const prefix = focus.status === 'blocked' ? '⛔ ' : focus.status === 'snoozed' ? '💤 ' : '◉ ';
    return `${prefix}${truncate(focus.title, 48)}`;
};

const rebuild = () => {
    if (!tray) return;
    const l = labels();
    const pinned = snapshot.pinned.slice(0, 5);
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: focusLabel(), enabled: false },
        ...(pinned.length ? [
            { type: 'separator' as const },
            { label: l.pinned, enabled: false },
            ...pinned.map((item) => ({
                label: truncate(item.title, 48),
                enabled: Boolean(item.path),
                click: () => { if (item.path) openPathInMain(item.path); }
            }))
        ] : []),
        { type: 'separator' },
        { label: l.quickCapture, click: () => showCapture() },
        { label: l.quickAccessPopOut, click: () => toggleQuickAccess() },
        { label: l.openApp, click: () => showMainWindow() },
        { type: 'separator' },
        { label: process.platform === 'darwin' ? l.quit : l.exit, click: () => app.quit() }
    ]));

    const focusTitle = snapshot.focus ? truncate(snapshot.focus.title) : '';
    // macOS shows the focus task right in the menu bar; Windows only has a tooltip.
    if (process.platform === 'darwin') tray.setTitle(focusTitle ? ` ${focusTitle}` : '', { fontType: 'monospacedDigit' });
    tray.setToolTip(snapshot.focus ? `ProjectFlow – ${snapshot.focus.title}` : 'ProjectFlow');
};

export const createTray = () => {
    if (tray) return tray;
    tray = new Tray(trayIcon());
    // Windows: left click opens the app; the menu stays on right click.
    if (process.platform === 'win32') tray.on('click', () => showMainWindow());
    rebuild();
    return tray;
};

const sanitizeSnapshot = (value: unknown): TraySnapshot | null => {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Partial<TraySnapshot>;
    const focus = raw.focus && typeof raw.focus.title === 'string' && typeof raw.focus.id === 'string'
        ? {
            id: raw.focus.id,
            title: raw.focus.title.slice(0, 200),
            status: (['active', 'snoozed', 'blocked'] as const).includes(raw.focus.status) ? raw.focus.status : 'active' as const
        }
        : null;
    const pinned = Array.isArray(raw.pinned)
        ? raw.pinned
            .filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string')
            .slice(0, 10)
            .map((item) => ({ id: item.id, title: item.title.slice(0, 200), path: sanitizeAppPath(item.path) }))
        : [];
    return { focus, pinned };
};

export const updateTray = (value: unknown) => {
    const next = sanitizeSnapshot(value);
    if (!next) return;
    snapshot = next;
    rebuild();
    updateFocus(next.focus);
};

/** Language switch / quick access state change. */
export const refreshTray = () => rebuild();

export const destroyTray = () => {
    tray?.destroy();
    tray = null;
};
