/**
 * Firestore side of the AI access model: workspace AI policy (`tenants/{t}/ai_config/policy`) and the
 * AI audit log (`tenants/{t}/ai_audit`, TTL on `expireAt`). Both are Admin-SDK only (firestore.rules).
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { AI_AUDIT_RETENTION_DAYS, type AiPolicy, normalizeAiPolicy, type PrincipalKind, RateLimiter } from './ai-access';
import { db } from './init';

const POLICY_CACHE_MS = 60 * 1000;
const policyCache = new Map<string, { policy: AiPolicy; at: number }>();

export const aiPolicyRef = (tenantId: string) => db.doc(`tenants/${tenantId}/ai_config/policy`);

export const loadAiPolicy = async (tenantId: string): Promise<AiPolicy> => {
    const cached = policyCache.get(tenantId);
    if (cached && Date.now() - cached.at < POLICY_CACHE_MS) return cached.policy;
    const snapshot = await aiPolicyRef(tenantId).get();
    const policy = normalizeAiPolicy(snapshot.exists ? snapshot.data() : null);
    policyCache.set(tenantId, { policy, at: Date.now() });
    return policy;
};

export const forgetAiPolicy = (tenantId: string) => policyCache.delete(tenantId);

/** One limiter per function instance, shared by `/api` and `/mcp` code paths. */
export const aiRateLimiter = new RateLimiter();

export type AiAuditEntry = {
    tenantId: string;
    kind: PrincipalKind;
    actorId: string;
    credentialId: string | null;
    credentialLabel: string | null;
    clientName: string | null;
    permission: string;
    method: string;
    path: string;
    projectId: string | null;
    status: number;
};

export const writeAiAudit = async (entry: AiAuditEntry) => {
    const { tenantId, ...data } = entry;
    await db.collection(`tenants/${tenantId}/ai_audit`).add({
        ...data,
        createdAt: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(Date.now() + AI_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    });
};

/** Writes per workspace and UTC day across all machine clients (abuse brake, not a billing meter). */
export const DAILY_WRITE_QUOTA = 5000;
const usageCache = new Map<string, { day: string; count: number; at: number }>();

const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

/**
 * Counts one machine-client write and tells whether the workspace is over its daily quota. The count is
 * re-read at most once a minute per instance, so the quota is approximate (a few writes may slip over).
 */
export const takeDailyWrite = async (tenantId: string): Promise<boolean> => {
    const day = utcDay();
    const ref = db.doc(`tenants/${tenantId}/ai_usage/${day}`);
    let cached = usageCache.get(tenantId);
    if (!cached || cached.day !== day || Date.now() - cached.at > 60 * 1000) {
        const snapshot = await ref.get();
        cached = { day, count: Number(snapshot.data()?.writes || 0), at: Date.now() };
    }
    if (cached.count >= DAILY_WRITE_QUOTA) {
        usageCache.set(tenantId, cached);
        return false;
    }
    cached.count += 1;
    usageCache.set(tenantId, cached);
    await ref.set({
        writes: FieldValue.increment(1),
        expireAt: Timestamp.fromMillis(Date.now() + 40 * 24 * 60 * 60 * 1000)
    }, { merge: true }).catch((error) => console.error('AI usage counter failed', { tenantId, message: error?.message }));
    return true;
};
