/**
 * Admin console gate (brain/plans/admin-console-concept.md, "Auth-Kette"). Every `adminApi` call passes
 * through `checkAdminGate` before any handler runs. Pure function over injected deps, so the unit tests
 * (functions/scripts/unit/admin-gate.test.js) cover every refusal without Firebase.
 */

export const SESSION_IDLE_MS = 30 * 60_000;
export const SESSION_MAX_MS = 12 * 60 * 60_000;
export const FRESH_LOGIN_MS = 10 * 60_000;

export type GateToken = {
    uid: string;
    email?: string;
    platformAdmin?: unknown;
    auth_time?: number;
    adminMfaTest?: unknown;
    firebase?: { sign_in_second_factor?: string };
};

export type AdminRecord = { email?: string; active?: boolean };
export type SessionRecord = { sessionId: string; startedAtMs: number; lastSeenAtMs: number; endedAtMs?: number | null };

export type GateDeps = {
    verifyRevocation: (rawToken: string) => Promise<boolean>;
    getAdminRecord: (uid: string) => Promise<AdminRecord | null>;
    getSession: (uid: string) => Promise<SessionRecord | null>;
    isEmulator: boolean;
    now: () => number;
};

export type GateRefusal =
    | 'unauthenticated'
    | 'not-admin'
    | 'not-allowlisted'
    | 'mfa-required'
    | 'revoked'
    | 'login-not-fresh'
    | 'session-missing'
    | 'session-expired';

export type GateResult = { ok: true; uid: string; email: string } | { ok: false; reason: GateRefusal };

export const hasSecondFactor = (token: GateToken, isEmulator: boolean): boolean => {
    if (typeof token.firebase?.sign_in_second_factor === 'string' && token.firebase.sign_in_second_factor.length > 0) return true;
    // The Auth emulator has no TOTP; only there a custom-token claim stands in for the second factor.
    return isEmulator && token.adminMfaTest === true;
};

/**
 * mode 'start': opens a session (needs a fresh login, no session yet required).
 * mode 'call': every other action (needs a live session with the given id).
 */
export const checkAdminGate = async (
    token: GateToken | undefined,
    rawToken: string,
    mode: 'start' | 'call',
    sessionId: unknown,
    deps: GateDeps
): Promise<GateResult> => {
    if (!token?.uid || !rawToken) return { ok: false, reason: 'unauthenticated' };
    if (token.platformAdmin !== true) return { ok: false, reason: 'not-admin' };

    const record = await deps.getAdminRecord(token.uid);
    const email = (token.email || '').toLowerCase();
    if (!record || record.active === false || !email || (record.email || '').toLowerCase() !== email) {
        return { ok: false, reason: 'not-allowlisted' };
    }
    if (!hasSecondFactor(token, deps.isEmulator)) return { ok: false, reason: 'mfa-required' };
    if (!(await deps.verifyRevocation(rawToken))) return { ok: false, reason: 'revoked' };

    const now = deps.now();
    if (mode === 'start') {
        const authTimeMs = (token.auth_time || 0) * 1000;
        if (now - authTimeMs > FRESH_LOGIN_MS) return { ok: false, reason: 'login-not-fresh' };
        return { ok: true, uid: token.uid, email };
    }

    const session = await deps.getSession(token.uid);
    if (!session || typeof sessionId !== 'string' || session.sessionId !== sessionId || session.endedAtMs) {
        return { ok: false, reason: 'session-missing' };
    }
    if (now - session.lastSeenAtMs > SESSION_IDLE_MS || now - session.startedAtMs > SESSION_MAX_MS) {
        return { ok: false, reason: 'session-expired' };
    }
    return { ok: true, uid: token.uid, email };
};
