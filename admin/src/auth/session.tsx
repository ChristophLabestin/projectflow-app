import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { multiFactor, onIdTokenChanged, signOut, type User } from 'firebase/auth';
import { adminApi, AdminApiError, getSessionId, lastApiActivity, onSessionLost, setSessionId, type GateReason } from '../lib/api';
import { auth, useEmulators } from '../lib/firebase';

/** Client half of the auth chain (server half: functions/src/admin-console/gate.ts). */
export type Phase = 'loading' | 'signed-out' | 'no-access' | 'enroll-mfa' | 'starting' | 'ready';

export const CLIENT_IDLE_MS = 15 * 60_000;
const PING_EVERY_MS = 4 * 60_000;
const REASON_KEY = 'pf.admin.signoutReason';

export const REASON_TEXT: Record<string, string> = {
    idle: 'Du warst 15 Minuten inaktiv und wurdest abgemeldet.',
    'session-expired': 'Die Admin-Sitzung ist abgelaufen. Bitte melde dich erneut an.',
    'session-missing': 'Die Admin-Sitzung wurde beendet. Bitte melde dich erneut an.',
    'login-not-fresh': 'Für eine neue Admin-Sitzung ist eine frische Anmeldung nötig.',
    revoked: 'Deine Anmeldung wurde widerrufen.',
    'not-admin': 'Dieses Konto ist kein Plattform-Admin.',
    'not-allowlisted': 'Dieses Konto steht nicht auf der Admin-Allowlist.',
    'mfa-required': 'Die Konsole verlangt einen zweiten Faktor (TOTP).',
    'signed-out': 'Du hast dich abgemeldet.',
};

type SessionCtx = {
    phase: Phase;
    user: User | null;
    email: string;
    reason: string | null;
    idleDeadline: number;
    logout: (reason?: string) => Promise<void>;
    retry: () => void;
};

const Ctx = createContext<SessionCtx | null>(null);
export const useSession = () => {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('SessionProvider missing');
    return ctx;
};

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [phase, setPhase] = useState<Phase>('loading');
    const [user, setUser] = useState<User | null>(null);
    const [email, setEmail] = useState('');
    const [reason, setReason] = useState<string | null>(() => sessionStorage.getItem(REASON_KEY));
    const [attempt, setAttempt] = useState(0);
    const lastActivity = useRef(Date.now());
    const [idleDeadline, setIdleDeadline] = useState(Date.now() + CLIENT_IDLE_MS);
    const starting = useRef(false);

    const logout = useCallback(async (why = 'signed-out') => {
        sessionStorage.setItem(REASON_KEY, why);
        setReason(why);
        if (getSessionId()) await adminApi('session.end').catch(() => undefined);
        setSessionId(null);
        await signOut(auth);
    }, []);

    useEffect(() => onSessionLost((why: GateReason) => { void logout(why); }), [logout]);

    useEffect(() => onIdTokenChanged(auth, async (next) => {
        setUser(next);
        if (!next) {
            setPhase('signed-out');
            return;
        }
        if (starting.current) return;
        starting.current = true;
        try {
            const token = await next.getIdTokenResult();
            setEmail(next.email || '');
            if (token.claims.platformAdmin !== true) {
                setPhase('no-access');
                return;
            }
            if (!useEmulators && multiFactor(next).enrolledFactors.length === 0) {
                setPhase('enroll-mfa');
                return;
            }
            setPhase('starting');
            if (getSessionId()) {
                try {
                    await adminApi('session.ping');
                    setPhase('ready');
                    return;
                } catch {
                    setSessionId(null);
                }
            }
            const started = await adminApi<{ sessionId: string }>('session.start');
            setSessionId(started.sessionId);
            sessionStorage.removeItem(REASON_KEY);
            setReason(null);
            lastActivity.current = Date.now();
            setPhase('ready');
        } catch (error) {
            const why = error instanceof AdminApiError && error.reason ? error.reason : 'error';
            if (why === 'mfa-required') setPhase('enroll-mfa');
            else if (why === 'not-admin' || why === 'not-allowlisted') {
                setReason(why);
                setPhase('no-access');
            } else await logout(why === 'error' ? 'session-missing' : why);
        } finally {
            starting.current = false;
        }
    }), [logout, attempt]);

    // Inactivity: user input resets the timer; a ping keeps the server session alive while active.
    useEffect(() => {
        if (phase !== 'ready') return;
        const bump = () => { lastActivity.current = Date.now(); };
        const events = ['pointerdown', 'keydown', 'wheel', 'mousemove'] as const;
        events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
        const timer = window.setInterval(() => {
            const now = Date.now();
            const last = Math.max(lastActivity.current, lastApiActivity());
            setIdleDeadline(last + CLIENT_IDLE_MS);
            if (now - last > CLIENT_IDLE_MS) void logout('idle');
            else if (now - lastApiActivity() > PING_EVERY_MS && now - lastActivity.current < PING_EVERY_MS) void adminApi('session.ping').catch(() => undefined);
        }, 15_000);
        return () => {
            events.forEach((e) => window.removeEventListener(e, bump));
            window.clearInterval(timer);
        };
    }, [phase, logout]);

    const retry = useCallback(() => setAttempt((a) => a + 1), []);

    return <Ctx.Provider value={{ phase, user, email, reason, idleDeadline, logout, retry }}>{children}</Ctx.Provider>;
};
