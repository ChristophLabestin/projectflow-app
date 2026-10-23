import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { type BillingInterval, canCreateProject, parseEntitlements } from '../utils/billingPlans';

/** Starts a Stripe Checkout session (owner only) and returns its URL. */
export const createBillingCheckout = async (tenantId: string, interval: BillingInterval, language: string) => {
    const call = httpsCallable<{ tenantId: string; interval: BillingInterval; origin: string; language: string }, { url: string }>(
        functions, 'createBillingCheckout');
    return (await call({ tenantId, interval, origin: window.location.origin, language })).data.url;
};

/** Opens the Stripe Customer Portal (owner only). */
export const createBillingPortal = async (tenantId: string, language: string) => {
    const call = httpsCallable<{ tenantId: string; origin: string; language: string }, { url: string }>(functions, 'createBillingPortal');
    return (await call({ tenantId, origin: window.location.origin, language })).data.url;
};

/** Creates (idempotently) the caller's personal workspace personal_{uid}; call after every sign-in (contract §7). */
export const ensurePersonalWorkspace = async (language: string) => {
    const call = httpsCallable<{ language: string }, { tenantId: string; created: boolean }>(functions, 'ensurePersonalWorkspace');
    return (await call({ language })).data;
};

export type PersonalAiKeyStatus = { hasKey: boolean; last4: string | null };

/** Own OpenAI key for AI on the Free plan; the key itself never comes back. */
export const personalAiKey = async (action: 'get' | 'set' | 'clear', key?: string) => {
    const call = httpsCallable<{ action: string; key?: string }, PersonalAiKeyStatus>(functions, 'personalAiKey');
    return (await call({ action, key })).data;
};

/** Contract error codes (brain/plans/billing-entitlements-contract.md §3); each has `billing.errors.<code>`. */
export const BILLING_ERROR_CODES = [
    'plan-project-limit', 'plan-project-locked', 'plan-invites-disabled', 'plan-member-limit', 'plan-workspace-type-mismatch',
    'plan-storage-limit', 'plan-file-too-large',
    'ai-not-enabled', 'ai-addon-required', 'ai-plan-required',
    'ai-addon-unavailable', 'ai-addon-needs-subscription', 'ai-addon-invalid-member',
    'billing-not-configured', 'billing-already-subscribed', 'billing-price-missing', 'billing-no-customer',
    'invalid-openai-key', 'ai-key-storage-unavailable',
] as const;

/** Assigns the AI add-on to full members (owner only); Stripe quantity follows. */
export const setAiAddonMembers = async (tenantId: string, memberIds: string[]) => {
    const call = httpsCallable<{ tenantId: string; memberIds: string[] }, { aiMemberIds: string[] }>(functions, 'setAiAddonMembers');
    return (await call({ tenantId, memberIds })).data.aiMemberIds;
};

/** Maps billing/plan error codes from callables to locale keys. */
export const billingErrorKey = (error: unknown): string | null => {
    const message = String((error as { message?: string })?.message || '');
    const code = BILLING_ERROR_CODES.find((entry) => message.includes(entry))
        || BILLING_ERROR_CODES.find((entry) => (error as { code?: string })?.code === entry)
        || BILLING_ERROR_CODES.find((entry) => (error as { details?: { code?: string } })?.details?.code === entry);
    return code ? `billing.errors.${code}` : null;
};

/** Thrown by service-level plan pre-checks; `key` is a locale key. Rules enforce the same limits. */
export class PlanLimitError extends Error {
    constructor(readonly key: string) {
        super(key);
        this.name = 'PlanLimitError';
    }
}

/** Pre-check before writes the rules would reject on the current plan (project limit, invitations). */
export const assertPlanAllows = async (tenantId: string, action: 'project' | 'invite') => {
    const snap = await getDoc(doc(db, 'tenants', tenantId, 'entitlements', 'plan'));
    const ent = parseEntitlements(snap.exists() ? snap.data() : undefined);
    if (action === 'project' && !canCreateProject(ent)) throw new PlanLimitError('billing.errors.plan-project-limit');
    if (action === 'invite' && !ent.invitesAllowed) throw new PlanLimitError('billing.errors.plan-invites-disabled');
};

/** Localized message for plan/billing errors (service pre-checks and callables), else null. */
export const planErrorMessage = (error: unknown, t: (key: string) => string): string | null => {
    if (error instanceof PlanLimitError) return t(error.key);
    const key = billingErrorKey(error);
    return key ? t(key) : null;
};
