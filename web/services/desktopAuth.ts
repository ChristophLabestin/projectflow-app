import { signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';

/** Browser side of the desktop OAuth handoff: a one-time code bound to the app's PKCE challenge. */
export const createDesktopAuthCode = async (challenge: string) => {
    const call = httpsCallable<{ challenge: string }, { code: string }>(functions, 'createDesktopAuthCode');
    return (await call({ challenge })).data.code;
};

/** Result of a browser re-authentication (detail.error set on failure); see services/reauth.ts. */
export const DESKTOP_REAUTH_EVENT = 'projectflow:desktop-reauth';

/** uid claim of a Firebase custom token (a JWT), read without verifying — only to compare accounts. */
const customTokenUid = (token: string) => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload.uid === 'string' ? payload.uid : null;
    } catch {
        return null;
    }
};

/**
 * Desktop side: redeem code + verifier (from the shell) and sign in. While signed in it only refreshes the
 * session of the same account (re-authentication); a different account is rejected.
 */
export const redeemDesktopAuthCode = async (code: string, verifier: string) => {
    const signedIn = auth.currentUser;
    try {
        const call = httpsCallable<{ code: string; verifier: string }, { token: string }>(functions, 'exchangeDesktopAuthCode');
        const { token } = (await call({ code, verifier })).data;
        if (signedIn && customTokenUid(token) !== signedIn.uid) throw Object.assign(new Error('auth/user-mismatch'), { code: 'auth/user-mismatch' });
        await signInWithCustomToken(auth, token);
        if (signedIn) window.dispatchEvent(new CustomEvent(DESKTOP_REAUTH_EVENT, { detail: {} }));
    } catch (error) {
        if (signedIn) window.dispatchEvent(new CustomEvent(DESKTOP_REAUTH_EVENT, { detail: { error: (error as { code?: string }).code || 'auth/internal-error' } }));
        throw error;
    }
};

export const desktopAuthCallbackUrl = (code: string) => `projectflow://auth?code=${encodeURIComponent(code)}`;

export const isValidDesktopChallenge = (value: string | null): value is string => Boolean(value && /^[A-Za-z0-9_-]{43,128}$/.test(value));
