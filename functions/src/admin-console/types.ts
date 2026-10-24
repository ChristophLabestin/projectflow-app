import type { Firestore } from 'firebase-admin/firestore';

export type AdminContext = {
    uid: string;
    email: string;
    sessionId: string;
    db: Firestore;
    ip: string;
    userAgent: string;
    /** Firebase auth_time (s) of the caller's ID token; consent needs a fresh re-authentication. */
    authTimeS?: number;
    /** 'console' (adminApi) or 'mcp' (admin MCP server). */
    channel?: 'console' | 'mcp';
};

/**
 * audit: 'mutation' always writes an audit entry, 'read' only writes one for sensitive reads,
 * 'none' never (cheap list reads). `target` names the affected object for the log.
 */
export type AdminHandler = {
    audit: 'mutation' | 'read' | 'none';
    target?: (params: any) => string;
    summary?: (params: any, result: any) => string;
    run: (ctx: AdminContext, params: any) => Promise<unknown>;
};

export type HandlerMap = Record<string, AdminHandler>;

export class AdminInputError extends Error {}

export const str = (value: unknown, max = 500): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
export const int = (value: unknown, fallback: number, min: number, max: number): number => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
export const toMs = (value: any): number | null => {
    if (value == null) return null;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const ms = Date.parse(value);
        return Number.isFinite(ms) ? ms : null;
    }
    if (typeof value?._seconds === 'number') return value._seconds * 1000;
    return null;
};
