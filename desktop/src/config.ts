import { app } from 'electron';

/** Hosted web app the shell renders (Teams model). `PF_DESKTOP_URL` points it at a dev server. */
const PRODUCTION_URL = 'https://app.getprojectflow.com';

/** Packaged builds ignore PF_DESKTOP_URL, so an env var can never point the privileged shell elsewhere. */
const resolveAppUrl = () => {
    const raw = (!app.isPackaged && process.env.PF_DESKTOP_URL?.trim()) || PRODUCTION_URL;
    const url = new URL(raw);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
        throw new Error(`PF_DESKTOP_URL must be https or http://localhost (got ${raw})`);
    }
    return url;
};

export const APP_URL = resolveAppUrl();
export const APP_ORIGIN = APP_URL.origin;
export const IS_DEV = !app.isPackaged;
export const APP_ID = 'de.christophlabestin.projectflow.desktop';
export const PROTOCOL = 'projectflow';

export const QUICK_ACCESS_PATH = '/desktop/quick-access';

/** Builds an in-app URL for a relative path; anything that is not a plain app path falls back to "/". */
export const appUrlFor = (pathname = '/') => {
    const safe = sanitizeAppPath(pathname) ?? '/';
    return new URL(safe, APP_ORIGIN).toString();
};

/** Accepts only "/..." paths of the app (no scheme, no protocol-relative "//host"). */
export const sanitizeAppPath = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\') || trimmed.includes('..')) return null;
    try {
        const parsed = new URL(trimmed, APP_ORIGIN);
        if (parsed.origin !== APP_ORIGIN) return null;
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return null;
    }
};

export const isAppUrl = (value: string) => {
    try {
        return new URL(value).origin === APP_ORIGIN;
    } catch {
        return false;
    }
};
