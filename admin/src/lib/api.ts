import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/** Refusal reasons of the server gate (functions/src/admin-console/gate.ts). */
export type GateReason =
    | 'unauthenticated' | 'not-admin' | 'not-allowlisted' | 'mfa-required'
    | 'revoked' | 'login-not-fresh' | 'session-missing' | 'session-expired';

export class AdminApiError extends Error {
    constructor(message: string, readonly code: string, readonly reason?: GateReason) {
        super(message);
    }
}

const SESSION_KEY = 'pf.admin.session';
const call = httpsCallable<{ action: string; params?: unknown; sessionId?: string | null }, unknown>(functions, 'adminApi', { timeout: 120_000 });

type Listener = (reason: GateReason) => void;
const sessionListeners = new Set<Listener>();
/** Fired when the server ends the session (idle/expired/revoked) so the shell can sign out. */
export const onSessionLost = (listener: Listener) => {
    sessionListeners.add(listener);
    return () => { sessionListeners.delete(listener); };
};

export const getSessionId = () => sessionStorage.getItem(SESSION_KEY);
export const setSessionId = (id: string | null) => (id ? sessionStorage.setItem(SESSION_KEY, id) : sessionStorage.removeItem(SESSION_KEY));

let lastCallAt = Date.now();
export const lastApiActivity = () => lastCallAt;

export async function adminApi<T = any>(action: string, params?: unknown): Promise<T> {
    try {
        lastCallAt = Date.now();
        const result = await call({ action, params: params ?? {}, sessionId: getSessionId() });
        return result.data as T;
    } catch (error: any) {
        const code = String(error?.code || 'unknown').replace('functions/', '');
        const reason = (error?.details?.reason || (code === 'unauthenticated' ? 'unauthenticated' : undefined)) as GateReason | undefined;
        if (reason && action !== 'session.start' && ['unauthenticated', 'session-expired', 'session-missing', 'revoked', 'not-admin', 'not-allowlisted', 'mfa-required'].includes(reason)) {
            setSessionId(null);
            sessionListeners.forEach((listener) => listener(reason));
        }
        throw new AdminApiError(error?.message || 'Request failed', code, reason);
    }
}
