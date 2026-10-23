/**
 * Plan entitlements for display/guards in the web app. Authoritative copy: functions/src/billing-logic.ts
 * (keep both in sync); enforcement lives in Firestore rules and Cloud Functions.
 */
export type PlanId = 'free' | 'team' | 'organization' | 'personal';
/** Contract §7: every user has one personal workspace (personal_{uid}); it never becomes Team. */
export type WorkspaceType = 'personal' | 'team';
export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'grace' | 'free' | 'canceled' | 'exempt';
export type BillingInterval = 'month' | 'year';

export const FREE_PROJECT_LIMIT = 3;
export const TEAM_MEMBER_LIMIT = 50;
/** Net prices per seat and month (EUR). */
export const TEAM_PRICE = { month: 12, year: 10 } as const;
/** Personal plan, net per month (EUR). */
export const PERSONAL_PRICE = { month: 5, year: 4 } as const;
export const PERSONAL_STORAGE_GB = 25;
/** AI add-on, net per user and month (EUR), Team/Organization only. */
export const AI_ADDON_PRICE = 10;

export type Entitlements = {
    plan: PlanId;
    workspaceType: WorkspaceType;
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
    /** AI for every full member (trial and beta grace only). */
    aiIncluded: boolean;
    aiAddonAvailable: boolean;
    aiAddonSeats: number;
    aiMemberIds: string[];
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
    const plan: PlanId = data?.plan === 'free' || data?.plan === 'organization' || data?.plan === 'personal' ? data.plan : 'team';
    const workspaceType: WorkspaceType = data?.workspaceType === 'personal' ? 'personal' : 'team';
    const status = (typeof data?.status === 'string' ? data.status : 'grace') as BillingStatus;
    return {
        plan,
        workspaceType,
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
        // Missing doc = legacy grace: AI for everyone (same as functions/src/billing-logic.ts).
        aiIncluded: data ? plan !== 'free' && (status === 'trialing' || status === 'grace' || status === 'exempt') : true,
        aiAddonAvailable: plan !== 'free',
        aiAddonSeats: Number(data?.aiAddonSeats || 0),
        aiMemberIds: Array.isArray(data?.aiMemberIds) ? (data.aiMemberIds as string[]) : [],
        projectCount: Number(data?.projectCount || 0),
        lockedProjectIds: Array.isArray(data?.lockedProjectIds) ? (data.lockedProjectIds as string[]) : [],
        hasSubscription: Boolean(data?.stripeSubscriptionId),
    };
};

export const daysLeft = (until: Date | null, now = Date.now()) =>
    until ? Math.max(0, Math.ceil((until.getTime() - now) / 86_400_000)) : null;

export const canCreateProject = (ent: Entitlements) =>
    ent.projectLimit === null || ent.projectCount < ent.projectLimit;

export type PlanFeature = 'createProject' | 'invite' | 'editProject' | 'aiAddon';

/** Server AI for this user (contract: brain/plans/billing-entitlements-contract.md). */
export const aiEnabledFor = (ent: Entitlements, uid: string | null | undefined) =>
    ent.aiIncluded || (ent.aiAddonAvailable && Boolean(uid) && ent.aiMemberIds.includes(uid as string));

export const canUse = (ent: Entitlements, feature: PlanFeature, projectId?: string) => {
    switch (feature) {
        case 'createProject':
            return canCreateProject(ent);
        case 'invite':
            return ent.invitesAllowed;
        case 'editProject':
            return !projectId || !ent.lockedProjectIds.includes(projectId);
        case 'aiAddon':
            return ent.aiAddonAvailable && ent.hasSubscription;
        default:
            return false;
    }
};

export type PlanState = Entitlements & {
    limits: { members: number | null; projects: number | null };
    usage: { projects: number; seats: number; aiAddonSeats: number };
    can: (feature: PlanFeature, projectId?: string) => boolean;
    aiEnabledFor: (uid: string | null | undefined) => boolean;
};

export const toPlanState = (ent: Entitlements): PlanState => ({
    ...ent,
    limits: { members: ent.memberLimit, projects: ent.projectLimit },
    usage: { projects: ent.projectCount, seats: ent.seats, aiAddonSeats: ent.aiAddonSeats },
    can: (feature, projectId) => canUse(ent, feature, projectId),
    aiEnabledFor: (uid) => aiEnabledFor(ent, uid),
});
