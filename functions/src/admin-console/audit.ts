import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { HandlerMap } from './types';
import { int, str, toMs } from './types';

export type AuditEntry = {
    uid: string | null;
    email: string | null;
    action: string;
    target?: string | null;
    summary?: string | null;
    ok: boolean;
    error?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    sessionId?: string | null;
};

const AUDIT_RETENTION_DAYS = 730;

/** Append-only admin audit log (`admin_audit`, rules: no client access). */
export const writeAudit = async (db: Firestore, entry: AuditEntry) => {
    await db.collection('admin_audit').add({
        ...entry,
        target: entry.target ?? null,
        summary: entry.summary ? entry.summary.slice(0, 500) : null,
        error: entry.error ? entry.error.slice(0, 300) : null,
        at: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + AUDIT_RETENTION_DAYS * 86_400_000),
    });
};

export const auditHandlers: HandlerMap = {
    'audit.list': {
        audit: 'none',
        run: async ({ db }, params) => {
            let query = db.collection('admin_audit').orderBy('at', 'desc') as FirebaseFirestore.Query;
            const action = str(params?.action, 80);
            if (action) query = query.where('action', '==', action);
            const before = toMs(params?.before);
            if (before) query = query.where('at', '<', Timestamp.fromMillis(before));
            const snap = await query.limit(int(params?.limit, 100, 1, 500)).get();
            return {
                entries: snap.docs.map((doc) => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        at: toMs(d.at),
                        uid: d.uid ?? null,
                        email: d.email ?? null,
                        action: d.action,
                        target: d.target ?? null,
                        summary: d.summary ?? null,
                        ok: d.ok !== false,
                        error: d.error ?? null,
                        ip: d.ip ?? null,
                        userAgent: d.userAgent ?? null,
                    };
                }),
            };
        },
    },
};
