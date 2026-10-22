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
}

const DEFAULTS: DesktopSettings = {
    quickAccessAlwaysOnTop: true
};

let cache: DesktopSettings | null = null;
let writeTimer: NodeJS.Timeout | null = null;

const filePath = () => path.join(app.getPath('userData'), 'settings.json');

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
