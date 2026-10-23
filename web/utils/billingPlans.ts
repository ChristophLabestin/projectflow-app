/**
 * Plan entitlements for display/guards in the web app. Authoritative copy: functions/src/billing-logic.ts
 * (keep both in sync); enforcement lives in Firestore rules and Cloud Functions.
 */
export type PlanId = 'free' | 'team' | 'organization';
export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'grace' | 'free' | 'canceled';
export type BillingInterval = 'month' | 'year';

export const FREE_PROJECT_LIMIT = 3;
export const TEAM_MEMBER_LIMIT = 50;
/** Net prices per seat and month (EUR). */
export const TEAM_PRICE = { month: 12, year: 10 } as const;

export type Entitlements = {
    plan: PlanId;
    status: BillingStatus;
    seats: number;
    billingInterval: BillingInterval | null;
    trialEndsAt: Date | null;
    graceEndsAt: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    memberLimit: number | null;
    projectLimit: number | null;
    invitesAllowed: boolean;
    aiIncluded: boolean;
    projectCount: number;
    lockedProjectIds: string[];
    hasSubscription: boolean;
};

const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (typeof (value as { toDate?: () => Date }).toDate === 'function') return (value as { toDate: () => Date }).toDate();
    const parsed = new Date(value as string);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** A missing entitlement doc is a legacy workspace in grace (= Team), exactly like the rules. */
export const parseEntitlements = (data: Record<string, unknown> | undefined): Entitlements => {
    const plan: PlanId = data?.plan === 'free' || data?.plan === 'organization' ? data.plan : 'team';
    const status = (typeof data?.status === 'string' ? data.status : 'grace') as BillingStatus;
    return {
        plan,
        status,
        seats: Number(data?.seats || 0),
        billingInterval: data?.billingInterval === 'month' || data?.billingInterval === 'year' ? data.billingInterval : null,
        trialEndsAt: toDate(data?.trialEndsAt),
        graceEndsAt: toDate(data?.graceEndsAt),
        currentPeriodEnd: toDate(data?.currentPeriodEnd),
        cancelAtPeriodEnd: Boolean(data?.cancelAtPeriodEnd),
        memberLimit: data && 'memberLimit' in data ? (data.memberLimit as number | null) : TEAM_MEMBER_LIMIT,
        projectLimit: plan === 'free' ? Number(data?.projectLimit ?? FREE_PROJECT_LIMIT) : null,
        invitesAllowed: data?.invitesAllowed !== false,
        aiIncluded: data?.aiIncluded !== false && plan !== 'free',
        projectCount: Number(data?.projectCount || 0),
        lockedProjectIds: Array.isArray(data?.lockedProjectIds) ? (data.lockedProjectIds as string[]) : [],
        hasSubscription: Boolean(data?.stripeSubscriptionId),
    };
};

export const daysLeft = (until: Date | null, now = Date.now()) =>
    until ? Math.max(0, Math.ceil((until.getTime() - now) / 86_400_000)) : null;

export const canCreateProject = (ent: Entitlements) =>
    ent.projectLimit === null || ent.projectCount < ent.projectLimit;
