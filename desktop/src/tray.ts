import { Menu, Tray, app, nativeImage } from 'electron';
import path from 'node:path';
import type { TraySnapshot } from './contract';
import { labels } from './labels';
import { sanitizeAppPath } from './config';
import { showMainWindow } from './windows/mainWindow';
import { openPathInMain, toggleQuickAccess } from './windows/quickAccess';
import { openDayWindow, showCapture } from './windows/auxWindows';
import { hideTrayPanel, toggleTrayPanel } from './windows/trayPanel';
import { updateFocus } from './features/focus';

/**
 * Menu bar / tray item. Left click opens the rich panel (focus timer, today, pinned, inbox); right click shows a
 * compact native menu. The menu bar title shows the focus task with its running time; the icon gets a dot
 * while a focus is active and switches to an unread variant on Windows.
 */

let tray: Tray | null = null;
let snapshot: TraySnapshot = { focus: null, pinned: [] };
let ticker: NodeJS.Timeout | null = null;

const MAX_TITLE = 24;
const truncate = (value: string, max = MAX_TITLE) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

const assets = () => path.join(__dirname, '..', 'assets');

const trayIcon = (active: boolean) => {
    if (process.platform === 'darwin') {
        // Template images adapt to light/dark menu bars automatically (…Template.png + @2x).
        const image = nativeImage.createFromPath(path.join(assets(), active ? 'trayActiveTemplate.png' : 'trayTemplate.png'));
        image.setTemplateImage(true);
        return image;
    }
    return nativeImage.createFromPath(path.join(assets(), active ? 'trayActive.png' : 'tray.png'));
};

/** "42 Min." / "1:05 Std." since the focus started (null when unknown or not active). */
export const formatElapsed = (startedAt: string | null | undefined, now = Date.now()) => {
    const start = startedAt ? Date.parse(startedAt) : NaN;
    if (!Number.isFinite(start) || start > now) return null;
    const minutes = Math.floor((now - start) / 60000);
    if (minutes < 60) return `${minutes} ${labels().minutesShort}`;
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} ${labels().hoursShort}`;
};

const focusLabel = () => {
    const focus = snapshot.focus;
    if (!focus) return labels().focusNone;
    const prefix = focus.status === 'blocked' ? '⛔ ' : focus.status === 'snoozed' ? '💤 ' : '◉ ';
    const elapsed = focus.status === 'active' ? formatElapsed(focus.startedAt) : null;
    return `${prefix}${truncate(focus.title, 44)}${elapsed ? ` · ${elapsed}` : ''}`;
};

const contextMenu = () => {
    const l = labels();
    const pinned = snapshot.pinned.slice(0, 5);
    return Menu.buildFromTemplate([
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
        { label: l.dayCloseAction, click: () => openDayWindow('close') },
        { label: l.openApp, click: () => showMainWindow() },
        { type: 'separator' },
        { label: process.platform === 'darwin' ? l.quit : l.exit, click: () => app.quit() }
    ]);
};

const render = () => {
    if (!tray) return;
    const focus = snapshot.focus;
    const active = focus?.status === 'active';
    tray.setImage(trayIcon(active));
    if (process.platform === 'darwin') {
        const elapsed = active ? formatElapsed(focus?.startedAt) : null;
        const title = focus ? `${truncate(focus.title)}${elapsed ? ` · ${elapsed}` : ''}` : '';
        tray.setTitle(title ? ` ${title}` : '', { fontType: 'monospacedDigit' });
    }
    const unread = snapshot.unread ?? 0;
    tray.setToolTip([
        'ProjectFlow',
        focus ? focusLabel() : null,
        unread ? labels().unreadCount.replace('{count}', String(unread)) : null
    ].filter(Boolean).join('\n'));
};

export const createTray = () => {
    if (tray) return tray;
    tray = new Tray(trayIcon(false));
    tray.setIgnoreDoubleClickEvents(true);
    tray.on('click', (_event, bounds) => toggleTrayPanel(bounds));
    tray.on('right-click', () => {
        hideTrayPanel();
        tray?.popUpContextMenu(contextMenu());
    });
    render();
    // Running focus time in the menu bar.
    ticker = setInterval(render, 30 * 1000);
    return tray;
};

const sanitizeSnapshot = (value: unknown): TraySnapshot | null => {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Partial<TraySnapshot>;
    const focus = raw.focus && typeof raw.focus.title === 'string' && typeof raw.focus.id === 'string'
        ? {
            id: raw.focus.id,
            title: raw.focus.title.slice(0, 200),
            status: (['active', 'snoozed', 'blocked'] as const).includes(raw.focus.status) ? raw.focus.status : 'active' as const,
            startedAt: typeof raw.focus.startedAt === 'string' ? raw.focus.startedAt : null
        }
        : null;
    const pinned = Array.isArray(raw.pinned)
        ? raw.pinned
            .filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string')
            .slice(0, 10)
            .map((item) => ({ id: item.id, title: item.title.slice(0, 200), path: sanitizeAppPath(item.path) }))
        : [];
    const unread = typeof raw.unread === 'number' && raw.unread >= 0 ? Math.floor(raw.unread) : 0;
    return { focus, pinned, unread };
};

export const updateTray = (value: unknown) => {
    const next = sanitizeSnapshot(value);
    if (!next) return;
    snapshot = next;
    render();
    updateFocus(next.focus);
};

/** Language switch / quick access state change. */
export const refreshTray = () => render();

export const destroyTray = () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
    tray?.destroy();
    tray = null;
};
