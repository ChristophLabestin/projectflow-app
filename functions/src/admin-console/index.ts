import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { db } from '../init';
import { writeAudit } from './audit';
import { featureHandlers } from './registry';
import { checkAdminGate, GateDeps, GateToken, SESSION_IDLE_MS } from './gate';
import { AdminContext, AdminInputError, HandlerMap, toMs } from './types';

/**
 * `adminApi` — the only entry point of the admin console (admin/). Every call runs the gate
 * (claim + allowlist + second factor + revocation + session), then the handler, then the audit log.
 * Request: `{ action, params, sessionId }`. Concept: brain/plans/admin-console-concept.md.
 */

const REGION = 'europe-west3';
// No Stripe secret binding: STRIPE_SECRET_KEY does not exist yet (billing not live). Once it exists, add
// `secrets: ['STRIPE_SECRET_KEY']` so billing.setExempt removal can re-sync a real subscription instead of falling back to Free.
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

const sessionRef = (uid: string) => db.collection('admin_sessions').doc(uid);

const gateDeps: GateDeps = {
    verifyRevocation: async (raw) => {
        try {
            await admin.auth().verifyIdToken(raw, true);
            return true;
        } catch {
            return false;
        }
    },
    getAdminRecord: async (uid) => {
        const snap = await db.collection('platform_admins').doc(uid).get();
        return snap.exists ? (snap.data() as any) : null;
    },
    getSession: async (uid) => {
        const snap = await sessionRef(uid).get();
        const d = snap.data();
        if (!d) return null;
        return { sessionId: d.sessionId, startedAtMs: toMs(d.startedAt) ?? 0, lastSeenAtMs: toMs(d.lastSeenAt) ?? 0, endedAtMs: toMs(d.endedAt) };
    },
    isEmulator,
    now: () => Date.now(),
};

const sessionHandlers: HandlerMap = {
    'session.ping': { audit: 'none', run: async () => ({ ok: true, idleMs: SESSION_IDLE_MS }) },
    'session.end': {
        audit: 'mutation',
        run: async ({ uid }) => {
            await sessionRef(uid).set({ endedAt: FieldValue.serverTimestamp() }, { merge: true });
            return { ok: true };
        },
    },
};

let handlerCache: HandlerMap | null = null;
const handlers = () => (handlerCache ??= { ...sessionHandlers, ...featureHandlers() });

const rawTokenOf = (context: functions.https.CallableContext) => {
    const header = String(context.rawRequest?.headers?.authorization || '');
    return header.startsWith('Bearer ') ? header.slice(7) : '';
};

const requestMeta = (context: functions.https.CallableContext) => ({
    ip: String(context.rawRequest?.ip || context.rawRequest?.headers?.['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 64),
    userAgent: String(context.rawRequest?.headers?.['user-agent'] || '').slice(0, 200),
});

export const adminApi = functions.region(REGION).runWith({ memory: '512MB', timeoutSeconds: 120 }).https.onCall(async (data, context) => {
    const action = typeof data?.action === 'string' ? data.action.slice(0, 80) : '';
    const params = data?.params ?? {};
    const token = context.auth?.token as GateToken | undefined;
    const meta = requestMeta(context);
    const isStart = action === 'session.start';

    const gate = await checkAdminGate(token, rawTokenOf(context), isStart ? 'start' : 'call', data?.sessionId, gateDeps);
    if (!gate.ok) {
        // Refusals of real admins are worth a trace; anonymous/normal-user probes would only flood the log.
        if (token?.platformAdmin === true) {
            await writeAudit(db, { uid: token.uid, email: token.email ?? null, action: `refused:${action || 'unknown'}`, ok: false, error: gate.reason, ...meta }).catch(() => undefined);
        }
        const code = gate.reason === 'unauthenticated' ? 'unauthenticated' : gate.reason === 'session-expired' || gate.reason === 'session-missing' || gate.reason === 'login-not-fresh' ? 'failed-precondition' : 'permission-denied';
        throw new functions.https.HttpsError(code, gate.reason, { reason: gate.reason });
    }

    if (isStart) {
        const sessionId = randomUUID();
        await sessionRef(gate.uid).set({
            sessionId,
            email: gate.email,
            startedAt: FieldValue.serverTimestamp(),
            lastSeenAt: FieldValue.serverTimestamp(),
            endedAt: null,
            ip: meta.ip,
            userAgent: meta.userAgent,
        });
        await writeAudit(db, { uid: gate.uid, email: gate.email, action: 'session.start', ok: true, sessionId, ...meta });
        return { sessionId, idleMs: SESSION_IDLE_MS, email: gate.email };
    }

    const handler = handlers()[action];
    if (!handler) throw new functions.https.HttpsError('not-found', `Unknown action ${action}`);

    const sessionId = String(data.sessionId);
    const ctx: AdminContext = { uid: gate.uid, email: gate.email, sessionId, db, ...meta, authTimeS: token?.auth_time, channel: 'console' };
    await sessionRef(gate.uid).update({ lastSeenAt: Timestamp.now() });

    const target = handler.target ? safe(() => handler.target!(params)) : null;
    try {
        const result = await handler.run(ctx, params);
        if (handler.audit !== 'none') {
            await writeAudit(db, { uid: gate.uid, email: gate.email, action, target, summary: handler.summary ? safe(() => handler.summary!(params, result)) : null, ok: true, sessionId, ...meta });
        }
        return result;
    } catch (error) {
        const message = (error as Error)?.message || 'error';
        if (handler.audit === 'mutation') {
            await writeAudit(db, { uid: gate.uid, email: gate.email, action, target, ok: false, error: message, sessionId, ...meta }).catch(() => undefined);
        }
        if (error instanceof functions.https.HttpsError) throw error;
        if (error instanceof AdminInputError) throw new functions.https.HttpsError('invalid-argument', message);
        console.error(`adminApi ${action} failed`, error);
        throw new functions.https.HttpsError('internal', message);
    }
});

const safe = <T>(fn: () => T): T | null => {
    try {
        return fn();
    } catch {
        return null;
    }
};
