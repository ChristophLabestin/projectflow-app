/**
 * ProjectFlow's own crash reporting for web + desktop (backend: `crashIngest`, admin console admin/ → Crashes).
 *
 * Opt-in only (`pf.consent.crashReports`, per device, default off; toggle in Settings → Account → Data). While off,
 * nothing is collected or sent. Sent per report: a random install id, the build (`__PF_BUILD__`), browser + OS, locale,
 * the route path (no query) and the error with its stack (bundle path, line, column — resolved later with the
 * stashed source maps, see `functions/scripts/crash-symbolicate.mjs`). No user id, name, email or project content.
 */

const CONSENT_KEY = 'pf.consent.crashReports';
const INSTALL_KEY = 'pf.crash.installId';
const MAX_EVENTS_PER_SESSION = 20;
const MAX_FRAMES = 60;

type Frame = { function?: string; file?: string; line?: number; column?: number; inApp?: boolean };
type CrashEvent = {
    id: string;
    timestamp: number;
    mechanism: 'onerror' | 'unhandledrejection' | 'react' | 'handled';
    handled: boolean;
    type: string;
    message: string;
    frames: Frame[];
    route: string;
};

const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
const endpoint = useEmulators
    ? `http://127.0.0.1:${import.meta.env.VITE_EMULATOR_FUNCTIONS_PORT || 5001}/demo-projectflow/europe-west3/crashIngest`
    : '/api/crash';
const environment = import.meta.env.DEV || useEmulators ? 'development' : 'production';

let queue: CrashEvent[] = [];
let sentThisSession = 0;
const seen = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const storage = (): Storage | null => {
    try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
};

export const isCrashReportingEnabled = (): boolean => storage()?.getItem(CONSENT_KEY) === 'true';

/** Switching off drops queued reports and the install id, so a later opt-in starts fresh. */
export const setCrashReportingEnabled = (enabled: boolean): void => {
    const store = storage();
    if (!store) return;
    if (enabled) {
        store.setItem(CONSENT_KEY, 'true');
        return;
    }
    store.removeItem(CONSENT_KEY);
    store.removeItem(INSTALL_KEY);
    queue = [];
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
};

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`);

const installId = (): string => {
    const store = storage();
    let id = store?.getItem(INSTALL_KEY);
    if (!id) { id = newId(); store?.setItem(INSTALL_KEY, id); }
    return id;
};

const scrub = (text: string) => text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<email>');

const filePath = (url: string): string => {
    if (!/^(https?:\/\/|\/)/.test(url)) return url;   // <anonymous>, native code, extensions
    try { return new URL(url, window.location.origin).pathname; } catch { return url.replace(/[?#].*$/, ''); }
};

// Chrome/Edge/Electron: "    at fn (url:line:col)" or "    at url:line:col"; Firefox/Safari: "fn@url:line:col".
const CHROME = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/;
const GECKO = /^(.*?)@(.+?):(\d+):(\d+)$/;

export const parseStack = (stack: string | undefined): Frame[] => {
    if (!stack) return [];
    const frames: Frame[] = [];
    for (const line of stack.split('\n')) {
        const match = CHROME.exec(line) ?? GECKO.exec(line.trim());
        if (!match) continue;
        const [, fn, url, lineNo, column] = match;
        const file = filePath(url);
        frames.push({
            ...(fn ? { function: fn.replace(/^async /, '').slice(0, 200) } : {}),
            file,
            line: Number(lineNo),
            column: Number(column),
            inApp: file.startsWith('/assets/') || file.startsWith('/src/') || (!file.includes('node_modules') && !file.startsWith('chrome-extension')),
        });
        if (frames.length >= MAX_FRAMES) break;
    }
    return frames;
};

const describe = (error: unknown): { type: string; message: string; stack?: string } => {
    if (error instanceof Error) return { type: error.name || 'Error', message: error.message, stack: error.stack };
    if (typeof error === 'string') return { type: 'Error', message: error };
    try { return { type: 'NonError', message: JSON.stringify(error)?.slice(0, 500) ?? String(error) }; } catch { return { type: 'NonError', message: String(error) }; }
};

const device = () => {
    const ua = navigator.userAgent;
    const browser = /Electron\/(\d+)/.exec(ua)?.[0].replace('/', ' ')
        ?? /Edg\/(\d+)/.exec(ua)?.[0].replace('Edg/', 'Edge ')
        ?? /Chrome\/(\d+)/.exec(ua)?.[0].replace('/', ' ')
        ?? /Firefox\/(\d+)/.exec(ua)?.[0].replace('/', ' ')
        ?? (/Version\/(\d+).*Safari/.exec(ua) ? `Safari ${/Version\/(\d+)/.exec(ua)?.[1]}` : 'unknown');
    const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'unknown';
    return { os, osVersion: '', browser, locale: navigator.language.slice(0, 20) };
};

const payload = (events: CrashEvent[]) => JSON.stringify({
    platform: 'web', environment, release: __PF_BUILD__, installId: installId(), device: device(), events,
});

const flush = (useBeacon = false) => {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!queue.length || !isCrashReportingEnabled()) { queue = []; return; }
    const events = queue.splice(0, 10);
    const body = payload(events);
    // text/plain keeps it a simple request (no CORS preflight); the function parses the JSON itself.
    if (useBeacon && navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'text/plain' }))) return;
    fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => { /* offline: dropped */ });
    if (queue.length) flushTimer = setTimeout(() => flush(), 1000);
};

const capture = (error: unknown, mechanism: CrashEvent['mechanism']) => {
    if (!isCrashReportingEnabled() || sentThisSession >= MAX_EVENTS_PER_SESSION) return;
    const { type, message, stack } = describe(error);
    const frames = parseStack(stack);
    const key = `${type}|${message}|${frames[0]?.file}:${frames[0]?.line}`;
    if (seen.has(key)) return;
    seen.add(key);
    sentThisSession += 1;
    queue.push({
        id: newId(), timestamp: Date.now(), mechanism, handled: mechanism === 'handled',
        type: type.slice(0, 200), message: scrub(message).slice(0, 2000), frames, route: window.location.pathname,
    });
    if (!flushTimer) flushTimer = setTimeout(() => flush(), 1000);
};

let initialized = false;

export const initErrorReporting = (): void => {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    window.addEventListener('pagehide', () => flush(true));
};

/**
 * Report an error. `context.componentStack` marks a render crash caught by the ErrorBoundary; anything else is a
 * handled error. Context values are not sent (they may contain content).
 */
export const reportError = (error: unknown, context?: Record<string, unknown>): void => {
    console.error('[reportError]', error, context ?? '');
    const source = context?.source;
    capture(error, context?.componentStack !== undefined ? 'react'
        : source === 'unhandledrejection' ? 'unhandledrejection'
            : source === 'window.onerror' ? 'onerror' : 'handled');
};

let globalHandlersInstalled = false;

/** Forward uncaught errors and unhandled promise rejections. */
export const installGlobalErrorHandlers = (): void => {
    if (globalHandlersInstalled || typeof window === 'undefined') return;
    globalHandlersInstalled = true;

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        reportError(event.reason, { source: 'unhandledrejection' });
    });
    window.addEventListener('error', (event: ErrorEvent) => {
        // Ignore resource load errors (no ErrorEvent.error) and benign ResizeObserver noise.
        if (!event.error) return;
        reportError(event.error, { source: 'window.onerror' });
    });
};
