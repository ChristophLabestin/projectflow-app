/**
 * Plan entitlements (brain/plans/billing-implementation.md). Pure helpers, no Firestore/Stripe, so
 * they are unit-testable. Mirrored for display in web/utils/billingPlans.ts — keep both in sync.
 */

export type PlanId = 'free' | 'team' | 'organization';
export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'grace' | 'free' | 'canceled';
export type BillingInterval = 'month' | 'year';

export const TRIAL_DAYS = 14;
export const FREE_PROJECT_LIMIT = 3;
export const TEAM_MEMBER_LIMIT = 50;
/** Workspaces created before this moment are existing (beta) workspaces and start in grace. */
export const BILLING_LAUNCH_AT = Date.parse('2026-10-24T00:00:00Z');

export const PRICE_LOOKUP_KEYS: Record<BillingInterval, string> = {
    month: 'team_monthly',
    year: 'team_yearly',
};

export type PlanLimits = {
    memberLimit: number | null;
    projectLimit: number | null;
    invitesAllowed: boolean;
    aiIncluded: boolean;
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
    free: { memberLimit: 1, projectLimit: FREE_PROJECT_LIMIT, invitesAllowed: false, aiIncluded: false },
    team: { memberLimit: TEAM_MEMBER_LIMIT, projectLimit: null, invitesAllowed: true, aiIncluded: true },
    organization: { memberLimit: null, projectLimit: null, invitesAllowed: true, aiIncluded: true },
};

/** Effective limits; a missing entitlement doc means a legacy workspace in grace (= Team). */
export const limitsFor = (doc: Record<string, unknown> | undefined | null): PlanLimits => {
    const plan = doc?.plan;
    if (plan === 'free' || plan === 'team' || plan === 'organization') return PLAN_LIMITS[plan];
    return PLAN_LIMITS.team;
};

/** Stripe subscription status → our status + effective plan. */
export const mapStripeStatus = (stripeStatus: string): { status: BillingStatus; plan: PlanId } => {
    switch (stripeStatus) {
        case 'active':
            return { status: 'active', plan: 'team' };
        case 'trialing':
            return { status: 'trialing', plan: 'team' };
        // Stripe dunning: keep access while payment is retried.
        case 'past_due':
            return { status: 'past_due', plan: 'team' };
        // incomplete = first payment pending (e.g. 3DS); the workspace keeps its previous state.
        case 'incomplete':
            return { status: 'past_due', plan: 'team' };
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
export const initialEntitlement = (createdAtMs: number | null, now: number) => {
    if (createdAtMs !== null && createdAtMs < BILLING_LAUNCH_AT) {
        return { plan: 'team' as PlanId, status: 'grace' as BillingStatus, trialEndsAtMs: null };
    }
    const start = createdAtMs ?? now;
    return {
        plan: 'team' as PlanId,
        status: 'trialing' as BillingStatus,
        trialEndsAtMs: start + TRIAL_DAYS * 24 * 60 * 60 * 1000,
    };
};

/** Only test keys are accepted until the owner switches to live billing. */
export const isTestKey = (key: string | undefined) => typeof key === 'string' && /^(sk|rk)_test_/.test(key);
