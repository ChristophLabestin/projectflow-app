import { app, screen, type Rectangle } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

/** Persisted shell settings (userData/settings.json). Web data lives in the web app, never here. */
export interface DesktopSettings {
    mainBounds?: Rectangle;
    mainMaximized?: boolean;
    zoomLevel?: number;
    quickAccessBounds?: Rectangle;
    quickAccessAlwaysOnTop: boolean;
    quickAccessOpen?: boolean;
    /** Last title bar color from the web theme; used as window background to avoid a white flash. */
    lastBackground?: string;
    /** Global pop-out shortcut; null disables it. */
    quickAccessShortcut?: string | null;
    /** Global Quick Capture shortcut; null disables it. */
    quickCaptureShortcut?: string | null;
    launchAtLogin: boolean;
    dayStartEnabled: boolean;
    dayCloseEnabled: boolean;
    /** HH:MM local time for the day-close prompt. */
    dayCloseTime: string;
    lastDayStart?: string;
    lastDayClose?: string;
    calendarEnabled: boolean;
    meetingLeadMinutes: number;
    /** macOS Shortcuts run when a focus task starts / stops (e.g. to toggle a Focus mode); empty = off. */
    focusShortcutOn: string;
    focusShortcutOff: string;
    mediaKeysEnabled: boolean;
    /** Index projects/tasks of the active workspace in Spotlight (macOS). */
    spotlightEnabled: boolean;
    /** Recently opened projects (Dock menu / Windows jump list). */
    recents: { path: string; title: string }[];
    /** Extra windows restored on launch. */
    secondaryWindows: { path: string; bounds?: Rectangle }[];
    /** UI language chosen in the web app; drives native strings and the web app's initial language. */
    language?: 'de' | 'en';
}

const DEFAULTS: DesktopSettings = {
    quickAccessAlwaysOnTop: true,
    launchAtLogin: false,
    dayStartEnabled: true,
    dayCloseEnabled: true,
    dayCloseTime: '17:30',
    calendarEnabled: false,
    meetingLeadMinutes: 5,
    focusShortcutOn: '',
    focusShortcutOff: '',
    mediaKeysEnabled: false,
    spotlightEnabled: true,
    recents: [],
    secondaryWindows: []
};

let cache: DesktopSettings | null = null;
let writeTimer: NodeJS.Timeout | null = null;

/**
 * Shell settings live in userData; the dev script points PF_DESKTOP_SETTINGS_DIR at a stable folder so they survive
 * its throw-away browser profiles (language, window layout, preferences).
 */
const filePath = () => path.join((!app.isPackaged && process.env.PF_DESKTOP_SETTINGS_DIR) || app.getPath('userData'), 'settings.json');

export const getSettings = (): DesktopSettings => {
    if (cache) return cache;
    try {
        cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(filePath(), 'utf8')) };
    } catch {
        cache = { ...DEFAULTS };
    }
    return cache!;
};

const flush = () => {
    if (!cache) return;
    try {
        fs.mkdirSync(path.dirname(filePath()), { recursive: true });
        fs.writeFileSync(filePath(), JSON.stringify(cache, null, 2));
    } catch (error) {
        console.warn('[desktop] could not write settings', error);
    }
};

/** Debounced write; window move/resize fires many events. */
export const updateSettings = (patch: Partial<DesktopSettings>) => {
    cache = { ...getSettings(), ...patch };
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(flush, 300);
};

export const flushSettings = () => {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = null;
    flush();
};

/** Saved bounds are only reused when they still overlap a connected display. */
export const visibleBounds = (bounds?: Rectangle): Rectangle | undefined => {
    if (!bounds) return undefined;
    const visible = screen.getAllDisplays().some(({ workArea }) => (
        bounds.x < workArea.x + workArea.width
        && bounds.x + bounds.width > workArea.x
        && bounds.y < workArea.y + workArea.height
        && bounds.y + bounds.height > workArea.y
    ));
    return visible ? bounds : undefined;
};

/** Local calendar day, e.g. 2026-10-23 (day start/close run once per day). */
export const todayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
