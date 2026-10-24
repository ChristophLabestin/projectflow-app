/**
 * Plan entitlements (brain/plans/billing-implementation.md). Pure helpers, no Firestore/Stripe, so
 * they are unit-testable. Mirrored for display in web/utils/billingPlans.ts — keep both in sync.
 */

export type PlanId = 'free' | 'team' | 'organization' | 'personal';
/** `personal` = each user's own workspace (id personal_{uid}), 1 member, never Team (contract §7). */
export type WorkspaceType = 'personal' | 'team';
export const personalWorkspaceId = (uid: string) => `personal_${uid}`;
const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
/** Storage per plan (orchestrator/owner 2026-10-23): Free 1 GB, Personal 25 GB, Team 10 GB per seat pooled (min 25 GB),
 *  Organization 50 GB per seat; exempt = like its paid plan. Max file: 50 MB, Team/Organization 250 MB. */
export const PERSONAL_STORAGE_BYTES = 25 * GB;
export const storageFor = (plan: PlanId, fullMembers: number) => {
    const seats = Math.max(1, fullMembers);
    switch (plan) {
        case 'team':
            return { storageQuotaBytes: Math.max(25 * GB, 10 * GB * seats), maxFileBytes: 250 * MB };
        case 'organization':
            return { storageQuotaBytes: 50 * GB * seats, maxFileBytes: 250 * MB };
        case 'personal':
            return { storageQuotaBytes: PERSONAL_STORAGE_BYTES, maxFileBytes: 50 * MB };
        default:
            return { storageQuotaBytes: 1 * GB, maxFileBytes: 50 * MB };
    }
};
/** `exempt` = internal/comp workspace (admin console flag `billingExempt`): Team scope incl. AI, no payment. */
export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'grace' | 'free' | 'canceled' | 'exempt';
export type BillingInterval = 'month' | 'year';

export const TRIAL_DAYS = 14;
export const FREE_PROJECT_LIMIT = 3;
export const TEAM_MEMBER_LIMIT = 50;

export const PRICE_LOOKUP_KEYS: Record<BillingInterval, string> = {
    month: 'team_monthly',
    year: 'team_yearly',
};
/** Personal plan: 5 €/month, 4 €/month billed yearly; separate subscription per personal workspace. */
export const PERSONAL_LOOKUP_KEYS: Record<BillingInterval, string> = {
    month: 'personal_monthly',
    year: 'personal_yearly',
};
export const isPersonalLookupKey = (key: string | null | undefined) =>
    key === PERSONAL_LOOKUP_KEYS.month || key === PERSONAL_LOOKUP_KEYS.year;
/** The paid plan a workspace type can book (personal ↔ personal, team ↔ team; never crossed). */
export const paidPlanFor = (type: WorkspaceType): PlanId => (type === 'personal' ? 'personal' : 'team');
/** Coerces a requested plan to one the workspace type may hold (free stays free). */
export const planForType = (requested: PlanId, type: WorkspaceType): PlanId => {
    if (requested === 'free') return 'free';
    if (type === 'personal') return 'personal';
    return requested === 'personal' ? 'team' : requested;
};

/** AI add-on (owner decision 2026-10-23): 10 €/user/month, Team/Organization only, quantity = users with AI. */
export const AI_ADDON_LOOKUP_KEYS: Record<BillingInterval, string> = {
    month: 'ai_addon_monthly',
    year: 'ai_addon_yearly',
};
export const isAiAddonLookupKey = (key: string | null | undefined) =>
    key === AI_ADDON_LOOKUP_KEYS.month || key === AI_ADDON_LOOKUP_KEYS.year;

export type PlanLimits = {
    memberLimit: number | null;
    projectLimit: number | null;
    invitesAllowed: boolean;
    /** Every full member has AI (trial and beta grace only); otherwise AI is per user via the add-on. */
    aiIncluded: boolean;
    aiAddonAvailable: boolean;
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
    free: { memberLimit: 1, projectLimit: FREE_PROJECT_LIMIT, invitesAllowed: false, aiIncluded: false, aiAddonAvailable: false },
    team: { memberLimit: TEAM_MEMBER_LIMIT, projectLimit: null, invitesAllowed: true, aiIncluded: false, aiAddonAvailable: true },
    organization: { memberLimit: null, projectLimit: null, invitesAllowed: true, aiIncluded: false, aiAddonAvailable: true },
    personal: { memberLimit: 1, projectLimit: null, invitesAllowed: false, aiIncluded: false, aiAddonAvailable: true },
};

/** Limits of a plan on a workspace type: personal workspaces never invite and have exactly one member. */
export const limitsForType = (plan: PlanId, type: WorkspaceType): PlanLimits =>
    type === 'personal' ? { ...PLAN_LIMITS[plan], memberLimit: 1, invitesAllowed: false } : PLAN_LIMITS[plan];

/** Trial and beta grace unlock AI for every full member; paid plans need the add-on per user. */
export const aiIncludedForStatus = (plan: PlanId, status: string) =>
    plan !== 'free' && (status === 'trialing' || status === 'grace' || status === 'exempt');

/**
 * Effective limits. A missing entitlement doc is treated as Free without AI (safe default, security review M4/C1,
 * 2026-10-24): every workspace gets its doc at creation (trigger, callables) — none exists without one.
 */
export const limitsFor = (doc: Record<string, unknown> | undefined | null): PlanLimits => {
    const plan = doc?.plan;
    if (plan === 'free' || plan === 'team' || plan === 'organization' || plan === 'personal') {
        const type: WorkspaceType = doc?.workspaceType === 'personal' ? 'personal' : 'team';
        return { ...limitsForType(plan, type), aiIncluded: aiIncludedForStatus(plan, String(doc?.status || '')) };
    }
    return { ...PLAN_LIMITS.free, aiIncluded: false };
};

/** Server AI for this user in this workspace (caller must already know uid is a full member). */
export const aiEnabledFor = (doc: Record<string, unknown> | undefined | null, uid: string) => {
    const limits = limitsFor(doc);
    if (limits.aiIncluded) return true;
    if (!limits.aiAddonAvailable) return false;
    return Array.isArray(doc?.aiMemberIds) && (doc?.aiMemberIds as unknown[]).includes(uid);
};

/** Stripe subscription status → our status + effective plan. */
export const mapStripeStatus = (stripeStatus: string, paidPlan: PlanId = 'team'): { status: BillingStatus; plan: PlanId } => {
    switch (stripeStatus) {
        case 'active':
            return { status: 'active', plan: paidPlan };
        case 'trialing':
            return { status: 'trialing', plan: paidPlan };
        // Stripe dunning: keep access while payment is retried.
        case 'past_due':
            return { status: 'past_due', plan: paidPlan };
        // incomplete = first payment pending (e.g. 3DS); the workspace keeps its previous state.
        case 'incomplete':
            return { status: 'past_due', plan: paidPlan };
        default:
            // canceled, unpaid, incomplete_expired, paused
            return { status: 'canceled', plan: 'free' };
    }
};

/** Full members are seats; guests (externals) are free. */
export const countSeats = (roles: string[]) => roles.filter((role) => role !== 'Guest').length;

export const seatQuantity = (roles: string[]) => Math.max(1, countSeats(roles));

/** Can one more full member join? null limit = unlimited. */
export const memberLimitAllows = (limits: PlanLimits, currentFullMembers: number) =>
    limits.memberLimit === null || currentFullMembers < limits.memberLimit;

/**
 * Projects that become read-only on Free: everything beyond the `limit` most recently
 * updated ones. Nothing is deleted.
 */
export const projectsToLock = (
    projects: { id: string; updatedAtMs: number }[],
    limit: number | null,
): string[] => {
    if (limit === null) return [];
    return [...projects]
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs || a.id.localeCompare(b.id))
        .slice(limit)
        .map((project) => project.id);
};

/** Has a trial or grace period run out at `now`? */
export const periodExpired = (endsAtMs: number | null | undefined, now: number) =>
    typeof endsAtMs === 'number' && Number.isFinite(endsAtMs) && endsAtMs <= now;

/** Initial entitlement fields for a workspace that has none yet. */
// No grace for new workspaces (owner 2026-10-23: no customers yet, internal workspaces use `billingExempt`).
// `grace` remains only on the pre-launch docs written by the first backfill until they are decided.
export const initialEntitlement = (createdAtMs: number | null, now: number, type: WorkspaceType = 'team') => {
    if (type === 'personal') return { plan: 'free' as PlanId, status: 'free' as BillingStatus, trialEndsAtMs: null };
    const start = createdAtMs ?? now;
    return {
        plan: 'team' as PlanId,
        status: 'trialing' as BillingStatus,
        trialEndsAtMs: start + TRIAL_DAYS * 24 * 60 * 60 * 1000,
    };
};

/** Trial start from the client-written `createdAt`, never later than the trusted server time (audit 2026-10-24, H3). */
export const trialStartMs = (clientCreatedMs: number | null, serverMs: number) =>
    clientCreatedMs == null || !Number.isFinite(clientCreatedMs) ? serverMs : Math.min(clientCreatedMs, serverMs);

/** Only test keys are accepted until the owner switches to live billing. */
export const isTestKey = (key: string | undefined) => typeof key === 'string' && /^(sk|rk)_test_/.test(key);
