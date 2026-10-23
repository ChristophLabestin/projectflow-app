import { shell } from 'electron';
import { createHash, randomBytes } from 'crypto';
import { APP_ORIGIN } from '../config';
import { sendCommand, showMainWindow } from '../windows/mainWindow';

/**
 * OAuth sign-in in the system browser (Google & co. reject embedded browsers).
 * PKCE-style: the browser only learns sha256(verifier); the one-time code it hands back via
 * `projectflow://auth?code=…` is redeemed together with the verifier, which never leaves this process
 * and the app's own renderer. Exchange: callable `exchangeDesktopAuthCode` (functions/src/desktopAuth.ts).
 */
const PENDING_TTL_MS = 15 * 60 * 1000;
let pending: { verifier: string; startedAt: number } | null = null;

export const startExternalSignIn = async (provider?: unknown) => {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    pending = { verifier, startedAt: Date.now() };
    const url = new URL('/desktop/auth', APP_ORIGIN);
    url.searchParams.set('challenge', challenge);
    if (typeof provider === 'string' && /^(google|github|apple)$/.test(provider)) url.searchParams.set('provider', provider);
    await shell.openExternal(url.toString());
    return true;
};

/** Handles the `/auth?code=…` deep link; returns false when it was no auth callback. */
export const handleAuthCallback = (target: string | null) => {
    if (!target?.startsWith('/auth?')) return false;
    const code = new URLSearchParams(target.slice('/auth'.length)).get('code');
    const current = pending;
    showMainWindow();
    // Unrequested or stale callbacks are ignored: a link cannot sign the app in without our verifier.
    if (!code || !current || Date.now() - current.startedAt > PENDING_TTL_MS) return true;
    pending = null;
    sendCommand({ command: 'auth-code', data: { code, verifier: current.verifier } });
    return true;
};
