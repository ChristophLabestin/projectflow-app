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

const LANDING_ORIGIN = 'https://getprojectflow.com';

/** Own purchase page on the landing (contract §8): /checkout (DE) or /en/checkout. */
export const checkoutPageUrl = (input: { tenantId: string; plan: 'team' | 'personal'; interval: BillingInterval; language: string; aiAddon?: boolean }) => {
    const params = new URLSearchParams({ tenant: input.tenantId, plan: input.plan, interval: input.interval });
    if (input.aiAddon) params.set('ai', '1');
    return `${LANDING_ORIGIN}${input.language === 'en' ? '/en' : ''}/checkout?${params.toString()}`;
};

/** Opens the Stripe Customer Portal (owner only). */
/** `flow: 'cancel'` opens the portal directly in its cancellation flow (§ 312k BGB button). */
export const createBillingPortal = async (tenantId: string, language: string, flow?: 'cancel') => {
    const call = httpsCallable<{ tenantId: string; origin: string; language: string; flow?: 'cancel' }, { url: string }>(functions, 'createBillingPortal');
    return (await call({ tenantId, origin: window.location.origin, language, ...(flow ? { flow } : {}) })).data.url;
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
    'plan-storage-limit', 'plan-file-too-large', 'plan-seat-limit', 'plan-seats-below-members', 'ai-addon-seats-below-assigned',
    'ai-addon-seats-above-seats', 'ai-addon-no-free-seat', 'billing-mixed-seat-change', 'billing-no-subscription', 'billing-invalid-seats',
    'ai-not-enabled', 'ai-addon-required', 'ai-plan-required',
    'ai-addon-unavailable', 'ai-addon-needs-subscription', 'ai-addon-invalid-member',
    'billing-not-configured', 'billing-already-subscribed', 'billing-price-missing', 'billing-no-customer',
    'invalid-openai-key', 'ai-key-storage-unavailable',
    'plan-flow-limit', 'plan-flow-runs-limit', 'plan-flow-ai-limit',
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

// --- Seat management (contract §9) ---

export type SeatPreview = {
    kind: 'increase' | 'decrease' | 'none';
    seats: { from: number; to: number };
    aiAddonSeats: { from: number; to: number };
    currency: string;
    interval: BillingInterval;
    amountToday: number;
    nextAmount: number;
    currentAmount: number;
    nextBillingDate: number | null;
    effectiveAt: number | null;
    hasScheduledChange: boolean;
};
export type SeatChangeResult =
    | { status: 'applied'; amountPaid: number }
    | { status: 'scheduled'; effectiveAt: number }
    | { status: 'payment-required'; hostedInvoiceUrl: string | null; amountDue: number | null }
    | { status: 'scheduled-change-cancelled' | 'unchanged' };
export type BillingOverview = {
    seats: number; memberCount: number; aiAddonSeats: number; aiAssigned: number;
    scheduledChange: { seats: number; aiAddonSeats: number; effectiveAt: number | null } | null;
    currency: string; nextBillingDate: number | null; nextAmount: number | null;
    invoices: { id: string; number: string | null; created: number; total: number; currency: string; status: string | null; hostedInvoiceUrl: string | null; pdf: string | null }[];
};
type SeatInput = { tenantId: string; seats?: number; aiAddonSeats?: number };

export const previewSeatChange = async (input: SeatInput) =>
    (await httpsCallable<SeatInput, SeatPreview>(functions, 'previewSeatChange')(input)).data;
/** Applies a confirmed change: more seats are charged now (prorated), fewer seats apply at the period end. */
export const changeSeats = async (input: SeatInput) =>
    (await httpsCallable<SeatInput, SeatChangeResult>(functions, 'changeSeats')(input)).data;
export const getBillingOverview = async (tenantId: string) =>
    (await httpsCallable<{ tenantId: string }, BillingOverview>(functions, 'getBillingOverview')({ tenantId })).data;

export const formatMoney = (cents: number, currency: string, language: string) =>
    new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
