// Fixed-window rate limits for public (unauthenticated) endpoints. Keys are hashed, so no IPs or
// emails are stored in clear. Collection `public_rate_limits` is server-only (rules: allow false).
import * as crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './init';

export type RateLimitRule = { scope: string; key: string; max: number; windowMs: number };

export const clientIp = (req: { headers: Record<string, unknown>; ip?: string }): string =>
    String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();

/** Returns false if any rule is exhausted; counts only when all rules still allow the request. */
export const consumeRateLimits = async (rules: RateLimitRule[]): Promise<boolean> => {
    const refs = rules.map((rule) =>
        db.collection('public_rate_limits').doc(`${rule.scope}_${crypto.createHash('sha256').update(rule.key).digest('hex').slice(0, 40)}`));
    return db.runTransaction(async (tx) => {
        const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
        const now = Date.now();
        const next = snaps.map((snap, i) => {
            const windowStart = Number(snap.get('windowStart') || 0);
            const inWindow = now - windowStart < rules[i].windowMs;
            return { windowStart: inWindow ? windowStart : now, count: (inWindow ? Number(snap.get('count') || 0) : 0) + 1 };
        });
        if (next.some((n, i) => n.count > rules[i].max)) return false;
        next.forEach((n, i) => tx.set(refs[i], {
            ...n,
            // TTL field (Firestore TTL policy on public_rate_limits.expireAt, optional).
            expireAt: new Date(n.windowStart + rules[i].windowMs),
            updatedAt: FieldValue.serverTimestamp(),
        }));
        return true;
    });
};

/** Double-opt-in signups (waitlist, newsletter): per IP 10/h, per address 3/h (audit M10). */
export const signupRateLimitRules = (scope: string, ip: string, email: string): RateLimitRule[] => [
    { scope: `${scope}_ip`, key: ip, max: 10, windowMs: 3_600_000 },
    { scope: `${scope}_email`, key: email.trim().toLowerCase(), max: 3, windowMs: 3_600_000 },
];

export const generateConfirmCode = (): string => crypto.randomBytes(16).toString('hex').toUpperCase();
