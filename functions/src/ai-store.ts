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
