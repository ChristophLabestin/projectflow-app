/**
 * Seat management for paid workspaces (owner decision 2026-10-24, contract §9):
 * - billing anchor = purchase date (Stripe default),
 * - more seats / AI seats: charged now, prorated (always_invoice), active only once paid (pending_if_incomplete),
 * - fewer seats / AI seats: at the end of the period, no refund (subscription schedule), never below members/assignments,
 * - nothing changes without the owner's confirmation (members joining never buy seats).
 * Core functions take a Stripe client so they can be exercised with test clocks (scripts/seat-test-clock.mjs).
 */
import * as functions from 'firebase-functions/v1';
import { FAST_START } from './runtime-options';
import { FieldValue } from 'firebase-admin/firestore';
import Stripe = require('stripe');

import { db } from './init';
import { AI_ADDON_LOOKUP_KEYS, TEAM_MEMBER_LIMIT, isAiAddonLookupKey, type BillingInterval } from './billing-logic';
import {
    LIVE_STATUSES, REGION, STRIPE_SECRETS, clearAiAccessCache, entRef, fullMemberRoles, getStripe, requireOwner,
    syncSubscription,
} from './billing';

export type SeatTarget = { seats?: number; aiAddonSeats?: number };
export type SeatLimits = { minSeats: number; maxSeats: number; minAiSeats: number; maxAiSeats: number };

const fail = (code: string, details?: Record<string, unknown>): never => {
    throw new functions.https.HttpsError('failed-precondition', code, details);
};

const itemsOf = (subscription: Stripe.Subscription) => {
    const addonItem = subscription.items.data.find((entry) => isAiAddonLookupKey(entry.price?.lookup_key));
    const planItem = subscription.items.data.find((entry) => entry !== addonItem)!;
    return {
        planItem,
        addonItem,
        seats: Number(planItem?.quantity || 0),
        aiSeats: Number(addonItem?.quantity || 0),
        interval: (planItem?.price?.recurring?.interval === 'month' ? 'month' : 'year') as BillingInterval,
    };
};

const recurringAmount = (planItem: Stripe.SubscriptionItem, addonUnit: number, seats: number, aiSeats: number) =>
    Number(planItem.price.unit_amount || 0) * seats + addonUnit * aiSeats;

const addonPriceFor = async (stripe: Stripe, interval: BillingInterval) => {
    const prices = await stripe.prices.list({ lookup_keys: [AI_ADDON_LOOKUP_KEYS[interval]], active: true, limit: 1 });
    if (!prices.data[0]) fail('billing-price-missing');
    return prices.data[0];
};

/** Classifies a requested change and validates it against the limits. */
const classify = (current: { seats: number; aiSeats: number }, target: SeatTarget, limits: SeatLimits) => {
    const seats = target.seats === undefined ? current.seats : Math.floor(Number(target.seats));
    const aiSeats = target.aiAddonSeats === undefined ? current.aiSeats : Math.floor(Number(target.aiAddonSeats));
    if (!Number.isFinite(seats) || !Number.isFinite(aiSeats)) fail('billing-invalid-seats');
    if (seats < limits.minSeats) fail('plan-seats-below-members', { members: limits.minSeats });
    if (seats > limits.maxSeats) fail('plan-member-limit', { limit: limits.maxSeats });
    if (aiSeats < limits.minAiSeats) fail('ai-addon-seats-below-assigned', { assigned: limits.minAiSeats });
    if (aiSeats > Math.min(limits.maxAiSeats, seats)) fail('ai-addon-seats-above-seats', { seats });
    const up = seats > current.seats || aiSeats > current.aiSeats;
    const down = seats < current.seats || aiSeats < current.aiSeats;
    if (up && down) fail('billing-mixed-seat-change');
    return { seats, aiSeats, kind: (up ? 'increase' : down ? 'decrease' : 'none') as 'increase' | 'decrease' | 'none' };
};

const nextPeriodEnd = (subscription: Stripe.Subscription) => Number(itemsOf(subscription).planItem?.current_period_end || 0);

/** Preview: "today, prorated, X" + "from <next billing date> Y per interval" (net cents). */
export const previewSeatChangeFor = async (stripe: Stripe, subscriptionId: string, target: SeatTarget, limits: SeatLimits) => {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const current = itemsOf(subscription);
    const change = classify(current, target, limits);
    const addonPrice = await addonPriceFor(stripe, current.interval);
    let amountToday = 0;
    if (change.kind === 'increase') {
        const preview = await stripe.invoices.createPreview({
            customer: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
            subscription: subscription.id,
            subscription_details: { items: seatItems(current, change, addonPrice.id), proration_behavior: 'always_invoice' },
        });
        amountToday = preview.amount_due;
    }
    const periodEnd = nextPeriodEnd(subscription);
    return {
        kind: change.kind,
        seats: { from: current.seats, to: change.seats },
        aiAddonSeats: { from: current.aiSeats, to: change.aiSeats },
        currency: current.planItem.price.currency,
        interval: current.interval,
        amountToday,
        nextAmount: recurringAmount(current.planItem, Number(addonPrice.unit_amount || 0), change.seats, change.aiSeats),
        currentAmount: recurringAmount(current.planItem, Number(addonPrice.unit_amount || 0), current.seats, current.aiSeats),
        nextBillingDate: periodEnd ? periodEnd * 1000 : null,
        // Reductions take effect at the period end; increases immediately.
        effectiveAt: change.kind === 'decrease' && periodEnd ? periodEnd * 1000 : Date.now(),
        hasScheduledChange: Boolean(subscription.schedule),
    };
};

const seatItems = (current: ReturnType<typeof itemsOf>, change: { seats: number; aiSeats: number }, addonPriceId: string) => {
    const items: Stripe.SubscriptionUpdateParams.Item[] = [{ id: current.planItem.id, quantity: change.seats }];
    if (current.addonItem) {
        items.push(change.aiSeats > 0 ? { id: current.addonItem.id, quantity: change.aiSeats } : { id: current.addonItem.id, deleted: true });
    } else if (change.aiSeats > 0) {
        items.push({ price: addonPriceId, quantity: change.aiSeats });
    }
    return items;
};

const releaseSchedule = async (stripe: Stripe, subscription: Stripe.Subscription) => {
    const scheduleId = typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule?.id;
    if (scheduleId) await stripe.subscriptionSchedules.release(scheduleId);
};

/** Applies a confirmed change. Increases are charged now; decreases are scheduled for the period end. */
export const applySeatChangeFor = async (stripe: Stripe, subscriptionId: string, target: SeatTarget, limits: SeatLimits) => {
    let subscription = await stripe.subscriptions.retrieve(subscriptionId);
    let current = itemsOf(subscription);
    const change = classify(current, target, limits);

    if (change.kind === 'none') {
        // Same quantities as today while a reduction is pending = cancel the pending reduction.
        if (subscription.schedule) {
            await releaseSchedule(stripe, subscription);
            return { status: 'scheduled-change-cancelled' as const };
        }
        return { status: 'unchanged' as const };
    }

    if (change.kind === 'increase') {
        // An explicit increase replaces a pending reduction.
        if (subscription.schedule) {
            await releaseSchedule(stripe, subscription);
            subscription = await stripe.subscriptions.retrieve(subscriptionId);
            current = itemsOf(subscription);
        }
        const addonPrice = await addonPriceFor(stripe, current.interval);
        const updated = await stripe.subscriptions.update(subscription.id, {
            items: seatItems(current, change, addonPrice.id),
            proration_behavior: 'always_invoice',
            payment_behavior: 'pending_if_incomplete',
            expand: ['latest_invoice'],
        });
        const invoice = updated.latest_invoice as Stripe.Invoice | null;
        if (updated.pending_update) {
            // Payment failed or needs confirmation (3-D Secure): the seats stay as they were until it is paid;
            // Stripe drops the pending update after 23 h.
            return {
                status: 'payment-required' as const,
                hostedInvoiceUrl: invoice?.hosted_invoice_url || null,
                amountDue: invoice?.amount_due ?? null,
            };
        }
        return { status: 'applied' as const, amountPaid: invoice?.amount_paid ?? 0 };
    }

    // Decrease: schedule the new quantities from the end of the current period, no proration/refund.
    const scheduleId = typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule?.id;
    const schedule = scheduleId
        ? await stripe.subscriptionSchedules.retrieve(scheduleId)
        : await stripe.subscriptionSchedules.create({ from_subscription: subscription.id });
    const periodEnd = nextPeriodEnd(subscription);
    const nowItems = subscription.items.data.map((entry) => ({ price: entry.price.id, quantity: entry.quantity || 0 }));
    const nextItems = [
        { price: current.planItem.price.id, quantity: change.seats },
        ...(change.aiSeats > 0 && current.addonItem ? [{ price: current.addonItem.price.id, quantity: change.aiSeats }] : []),
    ];
    await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: 'release',
        proration_behavior: 'none',
        phases: [
            { items: nowItems, start_date: schedule.current_phase?.start_date || subscription.start_date, end_date: periodEnd },
            { items: nextItems, duration: { interval: current.interval, interval_count: 1 }, proration_behavior: 'none' },
        ],
    });
    return { status: 'scheduled' as const, effectiveAt: periodEnd * 1000 };
};

// --- Callables (owner only) ---

const loadContext = async (data: any, context: functions.https.CallableContext) => {
    const { tenantId } = await requireOwner(data?.tenantId, context);
    const ent = (await entRef(tenantId).get()).data() || {};
    if (!ent.stripeSubscriptionId || !LIVE_STATUSES.includes(String(ent.status))) fail('billing-no-subscription');
    if (ent.billingExempt === true) fail('billing-exempt');
    const fullMembers = (await fullMemberRoles(tenantId)).filter((role) => role !== 'Guest').length;
    const personal = ent.workspaceType === 'personal';
    const assigned = Array.isArray(ent.aiMemberIds) ? ent.aiMemberIds.length : 0;
    const limits: SeatLimits = personal
        ? { minSeats: 1, maxSeats: 1, minAiSeats: assigned, maxAiSeats: 1 }
        : { minSeats: Math.max(1, fullMembers), maxSeats: TEAM_MEMBER_LIMIT, minAiSeats: assigned, maxAiSeats: TEAM_MEMBER_LIMIT };
    return { tenantId, ent, limits, subscriptionId: String(ent.stripeSubscriptionId) };
};

const targetOf = (data: any): SeatTarget => ({
    ...(data?.seats !== undefined ? { seats: Number(data.seats) } : {}),
    ...(data?.aiAddonSeats !== undefined ? { aiAddonSeats: Number(data.aiAddonSeats) } : {}),
});

export const previewSeatChange = functions.region(REGION).runWith(FAST_START).runWith({ secrets: STRIPE_SECRETS })
    .https.onCall(async (data, context) => {
        const { limits, subscriptionId } = await loadContext(data, context);
        return previewSeatChangeFor(getStripe(), subscriptionId, targetOf(data), limits);
    });

export const changeSeats = functions.region(REGION).runWith(FAST_START).runWith({ secrets: STRIPE_SECRETS })
    .https.onCall(async (data, context) => {
        const { tenantId, limits, subscriptionId } = await loadContext(data, context);
        const stripe = getStripe();
        const result = await applySeatChangeFor(stripe, subscriptionId, targetOf(data), limits);
        // Reflect the new state right away (the webhook does the same a moment later).
        await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId), tenantId);
        clearAiAccessCache();
        await db.collection(`tenants/${tenantId}/billing_log`).add({
            action: 'seats', target: targetOf(data), result: result.status, by: context.auth?.uid || null,
            at: FieldValue.serverTimestamp(),
        });
        return result;
    });

/** Billing tab: seats, usage, scheduled change, next invoice and invoice list. */
export const getBillingOverview = functions.region(REGION).runWith(FAST_START).runWith({ secrets: STRIPE_SECRETS })
    .https.onCall(async (data, context) => {
        const { tenantId } = await requireOwner(data?.tenantId, context);
        const ent = (await entRef(tenantId).get()).data() || {};
        const fullMembers = (await fullMemberRoles(tenantId)).filter((role) => role !== 'Guest').length;
        const base = {
            seats: Number(ent.seats || 0),
            memberCount: fullMembers,
            aiAddonSeats: Number(ent.aiAddonSeats || 0),
            aiAssigned: Array.isArray(ent.aiMemberIds) ? ent.aiMemberIds.length : 0,
            scheduledChange: ent.scheduledChange
                ? { ...ent.scheduledChange, effectiveAt: ent.scheduledChange.effectiveAt?.toMillis?.() ?? null }
                : null,
        };
        if (!ent.stripeSubscriptionId) return { ...base, nextBillingDate: null, nextAmount: null, currency: 'eur', invoices: [] };
        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(String(ent.stripeSubscriptionId));
        const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
        const [upcoming, invoices] = await Promise.all([
            stripe.invoices.createPreview({ customer, subscription: subscription.id }).catch(() => null),
            stripe.invoices.list({ customer, limit: 12 }),
        ]);
        return {
            ...base,
            currency: subscription.items.data[0]?.price.currency || 'eur',
            nextBillingDate: upcoming?.period_end ? upcoming.period_end * 1000 : nextPeriodEnd(subscription) * 1000 || null,
            nextAmount: upcoming?.amount_due ?? null,
            invoices: invoices.data.map((invoice) => ({
                id: invoice.id,
                number: invoice.number,
                created: invoice.created * 1000,
                total: invoice.total,
                currency: invoice.currency,
                status: invoice.status,
                hostedInvoiceUrl: invoice.hosted_invoice_url,
                pdf: invoice.invoice_pdf,
            })),
        };
    });
