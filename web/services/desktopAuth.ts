import { signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';

/** Browser side of the desktop OAuth handoff: a one-time code bound to the app's PKCE challenge. */
export const createDesktopAuthCode = async (challenge: string) => {
    const call = httpsCallable<{ challenge: string }, { code: string }>(functions, 'createDesktopAuthCode');
    return (await call({ challenge })).data.code;
};

/** Desktop side: redeem code + verifier (from the shell) and sign in. */
export const redeemDesktopAuthCode = async (code: string, verifier: string) => {
    const call = httpsCallable<{ code: string; verifier: string }, { token: string }>(functions, 'exchangeDesktopAuthCode');
    const { token } = (await call({ code, verifier })).data;
    await signInWithCustomToken(auth, token);
};

export const desktopAuthCallbackUrl = (code: string) => `projectflow://auth?code=${encodeURIComponent(code)}`;

export const isValidDesktopChallenge = (value: string | null): value is string => Boolean(value && /^[A-Za-z0-9_-]{43,128}$/.test(value));
