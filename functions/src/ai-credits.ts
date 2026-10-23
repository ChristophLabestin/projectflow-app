/**
 * Workspace AI credits for the in-app assistant (brain/plans/in-app-ai-concept.md §4.7).
 * `tenants/{t}/ai_credits/{yyyy-mm}` and `…/users/{uid}` count credits, requests, tokens and estimated
 * cost per month (Admin SDK only; Owner/Admin may read). The per-user daily request quota in
 * `ai-service.ts` stays as the abuse brake.
 */
import { FieldValue } from 'firebase-admin/firestore';

import { db } from './init';
import type { ModelUsage } from './ai-models';

export type CreditCapability = 'write' | 'assist' | 'snap' | 'report' | 'image';

export const CREDIT_WEIGHTS: Record<CreditCapability, number> = { write: 1, assist: 5, snap: 5, report: 20, image: 10 };

export const DEFAULT_MONTHLY_CREDITS = Number(process.env.AI_MONTHLY_CREDITS) || 2000;

/** USD per 1M tokens (input, cached input, output); used for the cost estimate only. */
const PRICES: Record<string, { input: number; cached: number; output: number }> = {
    'gpt-6-luna': { input: 0.10, cached: 0.01, output: 0.50 },
    'gpt-6-sol': { input: 2.00, cached: 0.20, output: 10.00 }
};

export const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);

/** Estimated cost in micro-dollars (1e-6 USD); Fast mode bills 2x. Unknown models count as 0. */
export const estimateCostMicros = (model: string, usage: ModelUsage, serviceTier = 'default') => {
    const price = PRICES[model];
    if (!price) return 0;
    const uncached = Math.max(0, usage.inputTokens - usage.cachedTokens);
    const factor = serviceTier === 'fast' ? 2 : serviceTier === 'flex' ? 0.5 : 1;
    return Math.round((uncached * price.input + usage.cachedTokens * price.cached + usage.outputTokens * price.output) * factor);
};

export const resolveMonthlyLimit = (policy: { monthlyCredits?: unknown } | null | undefined) => {
    const value = Number(policy?.monthlyCredits);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_MONTHLY_CREDITS;
};

export const canSpend = (used: number, weight: number, limit: number) => used + weight <= limit;

const usageRefs = (tenantId: string, uid: string, month: string) => {
    const workspace = db.doc(`tenants/${tenantId}/ai_credits/${month}`);
    // Per-user docs live in `users`, not `members`: a `members` subcollection would join the
    // collectionGroup('members') used for workspace memberships.
    return { workspace, member: workspace.collection('users').doc(uid) };
};

export interface CreditDecision { ok: boolean; used: number; limit: number }

/** Reserve the credits of one request before calling the model. */
export const reserveCredits = async (tenantId: string, uid: string, capability: CreditCapability, limit: number): Promise<CreditDecision> => {
    const month = monthKey();
    const weight = CREDIT_WEIGHTS[capability];
    const { workspace, member } = usageRefs(tenantId, uid, month);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(workspace);
        const used = Number(snap.data()?.credits || 0);
        if (!canSpend(used, weight, limit)) return { ok: false, used, limit };
        const increment = {
            month,
            credits: FieldValue.increment(weight),
            requests: FieldValue.increment(1),
            byCapability: { [capability]: { requests: FieldValue.increment(1), credits: FieldValue.increment(weight) } },
            updatedAt: FieldValue.serverTimestamp()
        };
        tx.set(workspace, { ...increment, limit }, { merge: true });
        tx.set(member, { ...increment, uid }, { merge: true });
        return { ok: true, used: used + weight, limit };
    });
};

/** Undo a reservation when the request failed before the user got an answer. */
export const refundCredits = async (tenantId: string, uid: string, capability: CreditCapability) => {
    const weight = CREDIT_WEIGHTS[capability];
    const { workspace, member } = usageRefs(tenantId, uid, monthKey());
    const update = {
        credits: FieldValue.increment(-weight),
        requests: FieldValue.increment(-1),
        failed: FieldValue.increment(1),
        byCapability: { [capability]: { requests: FieldValue.increment(-1), credits: FieldValue.increment(-weight) } }
    };
    await Promise.all([workspace.set(update, { merge: true }), member.set(update, { merge: true })]);
};

/** Add token usage and estimated cost after the model answered. */
export const recordModelUsage = async (tenantId: string, uid: string, model: string, usage: ModelUsage, serviceTier = 'default') => {
    const { workspace, member } = usageRefs(tenantId, uid, monthKey());
    const update = {
        tokensIn: FieldValue.increment(usage.inputTokens),
        tokensOut: FieldValue.increment(usage.outputTokens),
        costMicros: FieldValue.increment(estimateCostMicros(model, usage, serviceTier)),
        updatedAt: FieldValue.serverTimestamp()
    };
    await Promise.all([workspace.set(update, { merge: true }), member.set(update, { merge: true })]);
};
