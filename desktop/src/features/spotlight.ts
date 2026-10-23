import { app } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeAppPath } from '../config';
import { getSettings } from '../store';

/**
 * Spotlight search for projects and tasks (macOS). The web app sends the items of the active workspace;
 * the bundled helper `pf-spotlight` (native/spotlight-index.swift) replaces the app's CoreSpotlight domain.
 * It must run from Contents/MacOS so CoreSpotlight attributes the items to the app bundle.
 */
export interface SpotlightItem {
    id: string;
    title: string;
    subtitle?: string;
    keywords?: string[];
}

const SPOTLIGHT_ACTIVITY = 'com.apple.corespotlightitem';
const ACTIVITY_ID_KEY = 'kCSSearchableItemActivityIdentifier';
const MAX_ITEMS = 2000;

const helperPath = () => path.join(path.dirname(process.execPath), 'pf-spotlight');

/** Dev: `electron .` runs node_modules' bundle, so copy the freshly built helper next to its executable. */
const ensureDevHelper = () => {
    if (app.isPackaged) return;
    const built = path.join(app.getAppPath(), 'dist', 'native', 'pf-spotlight');
    const target = helperPath();
    try {
        if (fs.existsSync(built) && (!fs.existsSync(target) || fs.statSync(target).mtimeMs < fs.statSync(built).mtimeMs)) {
            fs.copyFileSync(built, target);
            fs.chmodSync(target, 0o755);
        }
    } catch (error) {
        console.warn('[spotlight] dev helper copy failed', error);
    }
};

export const spotlightSupported = () => {
    if (process.platform !== 'darwin') return false;
    ensureDevHelper();
    return fs.existsSync(helperPath());
};

let lastPayload = '';
let lastRaw: unknown = [];
let running = false;
let queued: string | null = null;

const run = (payload: string) => {
    if (running) {
        queued = payload;
        return;
    }
    running = true;
    const child = execFile(helperPath(), [], { timeout: 60_000 }, (error, _stdout, stderr) => {
        running = false;
        if (error) console.warn('[spotlight] index failed', stderr || error.message);
        const next = queued;
        queued = null;
        if (next !== null) run(next);
    });
    child.stdin?.end(payload);
};

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** Replaces the index; `[]` (or the setting being off) clears it. Unchanged payloads are skipped. */
export const indexSpotlight = (raw: unknown) => {
    lastRaw = raw;
    if (!spotlightSupported()) return;
    const items: SpotlightItem[] = getSettings().spotlightEnabled && Array.isArray(raw)
        ? raw.slice(0, MAX_ITEMS).flatMap((entry) => {
            const id = sanitizeAppPath(entry?.id);
            const title = clean(entry?.title, 200);
            if (!id || !title) return [];
            const keywords = Array.isArray(entry?.keywords) ? entry.keywords.map((word: unknown) => clean(word, 60)).filter(Boolean).slice(0, 10) : undefined;
            return [{ id, title, subtitle: clean(entry?.subtitle, 300) || undefined, keywords }];
        })
        : [];
    const payload = JSON.stringify(items);
    if (payload === lastPayload) return;
    lastPayload = payload;
    run(payload);
};

/** Setting toggled: apply it to the last items the web app sent. */
export const reindexSpotlight = () => indexSpotlight(lastRaw);

/** Spotlight result clicked → app path (the item id), or null for other activities. */
export const spotlightActivityPath = (type: string, userInfo: unknown) => {
    if (type !== SPOTLIGHT_ACTIVITY) return null;
    return sanitizeAppPath((userInfo as Record<string, unknown> | undefined)?.[ACTIVITY_ID_KEY]);
};
