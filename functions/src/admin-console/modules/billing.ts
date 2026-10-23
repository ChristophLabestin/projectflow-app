import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { HandlerMap } from '../types';
import { AdminInputError, toMs } from '../types';

/** Billing view per brain/plans/billing-entitlements-contract.md §6 (entitlements/plan written only by Functions). */
export type BillingSummary = {
    plan: string; status: string; seats: number; aiAddonSeats: number; billingInterval: string | null;
    trialEndsAt: number | null; graceEndsAt: number | null; currentPeriodEnd: number | null; cancelAtPeriodEnd: boolean;
    paid: boolean; mrr: number; missing: boolean;
};

/** Net MRR in EUR: seats × 12 (monthly) or 10 (yearly) + AI add-on seats × 10, only for active/past_due. */
export const mrrOf = (d: { status?: string; seats?: number; aiAddonSeats?: number; billingInterval?: string | null }) => {
    if (d.status !== 'active' && d.status !== 'past_due') return 0;
    const perSeat = d.billingInterval === 'year' ? 10 : 12;
    return (Number(d.seats) || 0) * perSeat + (Number(d.aiAddonSeats) || 0) * 10;
};

export const billingOf = (data: FirebaseFirestore.DocumentData | undefined): BillingSummary => {
    // No document = existing workspace in beta grace (contract §1).
    if (!data) return { plan: 'team', status: 'grace', seats: 0, aiAddonSeats: 0, billingInterval: null, trialEndsAt: null, graceEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, paid: false, mrr: 0, missing: true };
    return {
        plan: data.plan || 'free', status: data.status || 'free', seats: Number(data.seats) || 0, aiAddonSeats: Number(data.aiAddonSeats) || 0,
        billingInterval: data.billingInterval ?? null, trialEndsAt: toMs(data.trialEndsAt), graceEndsAt: toMs(data.graceEndsAt),
        currentPeriodEnd: toMs(data.currentPeriodEnd), cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
        paid: Boolean(data.stripeSubscriptionId), mrr: mrrOf(data), missing: false,
    };
};

export const loadBilling = async (db: FirebaseFirestore.Firestore, tenantIds: string[]) => {
    if (!tenantIds.length) return new Map<string, BillingSummary>();
    const snaps = await db.getAll(...tenantIds.map((t) => db.collection('tenants').doc(t).collection('entitlements').doc('plan')));
    return new Map(snaps.map((s, i) => [tenantIds[i], billingOf(s.data())]));
};

export const billingHandlers: HandlerMap = {
    'billing.config': {
        audit: 'none',
        run: async ({ db }) => {
            const snap = await db.collection('admin_config').doc('billing').get();
            return { cutoverAt: toMs(snap.get('cutoverAt')), updatedAt: toMs(snap.get('updatedAt')) };
        },
    },
    /** Grace cutover date (admin_config/billing.cutoverAt), read by the billing Functions. */
    'billing.setCutover': {
        audit: 'mutation',
        target: () => 'admin_config/billing.cutoverAt',
        summary: (p) => (p?.cutoverAt ? new Date(p.cutoverAt).toISOString() : 'entfernt'),
        run: async ({ db, uid }, params) => {
            const ms = params?.cutoverAt == null ? null : toMs(params.cutoverAt);
            if (params?.cutoverAt != null && !ms) throw new AdminInputError('Datum ungültig');
            if (ms && ms < Date.now() - 86_400_000) throw new AdminInputError('Stichtag liegt in der Vergangenheit');
            await db.collection('admin_config').doc('billing').set({ cutoverAt: ms ? Timestamp.fromMillis(ms) : FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(), updatedBy: uid }, { merge: true });
            return { ok: true };
        },
    },
};
