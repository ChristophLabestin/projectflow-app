/**
 * Stripe Billing (test mode) and plan entitlements — brain/plans/billing-implementation.md.
 *
 * Authoritative entitlements: tenants/{tenantId}/entitlements/plan (server-only writes, member reads).
 * Stripe ids: billing_customers/{tenantId} (server-only). Own OpenAI keys: ai_user_keys/{uid} (server-only).
 */
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import Stripe = require('stripe');
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

import { db } from './init';
import { ALLOWED_ORIGINS } from './corsConfig';
import {
    AI_ADDON_LOOKUP_KEYS, PLAN_LIMITS, PRICE_LOOKUP_KEYS, aiEnabledFor, aiIncludedForStatus, initialEntitlement,
    isAiAddonLookupKey, isTestKey, limitsFor, mapStripeStatus,
    memberLimitAllows, periodExpired, projectsToLock, seatQuantity,
    type BillingInterval, type BillingStatus, type PlanId, type PlanLimits,
} from './billing-logic';

const REGION = 'europe-west3';
const STRIPE_SECRETS = ['STRIPE_SECRET_KEY'];

const entRef = (tenantId: string) => db.doc(`tenants/${tenantId}/entitlements/plan`);
const customerRef = (tenantId: string) => db.doc(`billing_customers/${tenantId}`);
const aiKeyRef = (uid: string) => db.doc(`ai_user_keys/${uid}`);

let stripeClient: Stripe | null = null;
const getStripe = () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new functions.https.HttpsError('failed-precondition', 'billing-not-configured');
    // Live billing is an explicit owner decision (VAT, terms) — refuse live keys until then.
    if (!isTestKey(key) && process.env.BILLING_ALLOW_LIVE !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'billing-live-key-refused');
    }
    stripeClient = stripeClient || new Stripe(key);
    return stripeClient;
};

const toMs = (value: unknown): number | null => {
    if (value instanceof Timestamp) return value.toMillis();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

// --- Entitlement reads (used by invitations and AI) ---

export const loadPlanLimits = async (tenantId: string): Promise<PlanLimits> =>
    limitsFor((await entRef(tenantId).get()).data());

const fullMemberRoles = async (tenantId: string) => {
    const snap = await db.collection(`tenants/${tenantId}/members`).select('role').get();
    return snap.docs.map((doc) => String(doc.data().role || 'Member'));
};

/** Throws when the plan does not allow one more full member (role != Guest). */
export const assertCanAddMember = async (tenantId: string, role: string) => {
    const limits = await loadPlanLimits(tenantId);
    if (!limits.invitesAllowed) throw new functions.https.HttpsError('failed-precondition', 'plan-invites-disabled');
    if (role === 'Guest') return;
    const roles = await fullMemberRoles(tenantId);
    if (!memberLimitAllows(limits, roles.filter((r) => r !== 'Guest').length)) {
        throw new functions.https.HttpsError('failed-precondition', 'plan-member-limit');
    }
};

/** Server AI for `uid` in this workspace: trial/grace for everyone, otherwise the AI add-on per user. */
export const memberHasAi = async (tenantId: string, uid: string) => aiEnabledFor((await entRef(tenantId).get()).data(), uid);

/** Plan check for writes that bypass the rules (REST API, MCP, AI tools). null = allowed, else contract error code. */
export const planWriteBlock = async (
    tenantId: string, action: 'create-project' | 'write-project', projectId?: string,
): Promise<'plan-project-limit' | 'plan-project-locked' | null> => {
    const ent = (await entRef(tenantId).get()).data();
    if (!ent) return null;
    if (action === 'create-project') {
        const limit = ent.projectLimit;
        return typeof limit === 'number' && Number(ent.projectCount || 0) >= limit ? 'plan-project-limit' : null;
    }
    const locked: unknown[] = Array.isArray(ent.lockedProjectIds) ? ent.lockedProjectIds : [];
    return projectId && locked.includes(projectId) ? 'plan-project-locked' : null;
};

/** null when `uid` may use server AI in this workspace, else the contract error code. */
export const aiGateFor = async (tenantId: string, uid: string): Promise<'ai-plan-required' | 'ai-addon-required' | null> => {
    const ent = (await entRef(tenantId).get()).data();
    if (aiEnabledFor(ent, uid)) return null;
    return limitsFor(ent).aiAddonAvailable ? 'ai-addon-required' : 'ai-plan-required';
};

// --- Own OpenAI keys (BYOK), AES-256-GCM with the AI_KEY_ENCRYPTION_KEY secret ---

const encryptionKey = () => {
    const raw = Buffer.from(String(process.env.AI_KEY_ENCRYPTION_KEY || ''), 'base64');
    if (raw.length !== 32) throw new functions.https.HttpsError('failed-precondition', 'ai-key-storage-unavailable');
    return raw;
};

const encryptSecret = (plain: string) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
};

const decryptSecret = (box: { iv?: string; tag?: string; data?: string } | undefined): string | null => {
    if (!box?.iv || !box.tag || !box.data || !process.env.AI_KEY_ENCRYPTION_KEY) return null;
    try {
        const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(box.iv, 'base64'));
        decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(box.data, 'base64')), decipher.final()]).toString('utf8');
    } catch {
        return null;
    }
};

/** Functions that may use a caller's own OpenAI key must list this secret in runWith. */
export const AI_KEY_SECRETS = ['AI_KEY_ENCRYPTION_KEY'];

const aiAccessCache = new Map<string, { at: number; value: AiAccess }>();
export type AiAccess = { mode: 'plan' } | { mode: 'own-key'; apiKey: string } | { mode: 'none' };

/**
 * AI access of a user: server AI when any workspace where they are a full member enables it for them
 * (trial/grace, or the AI add-on assigned to them); otherwise their own OpenAI key. Cached for a minute.
 */
export const resolveAiAccess = async (uid: string): Promise<AiAccess> => {
    const cached = aiAccessCache.get(uid);
    if (cached && Date.now() - cached.at < 60_000) return cached.value;
    const memberships = await db.collectionGroup('members').where('uid', '==', uid).limit(50).get();
    const tenantIds = memberships.docs
        .filter((doc) => String(doc.data().role || 'Member') !== 'Guest')
        .map((doc) => doc.ref.parent.parent?.id)
        .filter((id): id is string => Boolean(id));
    let value: AiAccess = { mode: 'none' };
    if (tenantIds.length > 0) {
        const ents = await db.getAll(...tenantIds.map(entRef));
        if (ents.some((snap) => aiEnabledFor(snap.data(), uid))) value = { mode: 'plan' };
    }
    if (value.mode === 'none') {
        const key = decryptSecret((await aiKeyRef(uid).get()).data()?.secret);
        if (key) value = { mode: 'own-key', apiKey: key };
    }
    aiAccessCache.set(uid, { at: Date.now(), value });
    return value;
};

// --- Entitlement writes ---

const recountProjects = async (tenantId: string) => {
    const snap = await db.collection(`tenants/${tenantId}/projects`).select('updatedAt', 'createdAt').get();
    return snap.docs.map((doc) => ({
        id: doc.id,
        updatedAtMs: toMs(doc.data().updatedAt) ?? toMs(doc.data().createdAt) ?? 0,
    }));
};

/** Writes the effective plan; moving to Free locks projects over the limit, other plans unlock all. */
const applyPlan = async (tenantId: string, requestedPlan: PlanId, requestedFields: Record<string, unknown>) => {
    // billingExempt (internal/comp, admin console) overrides trial expiry and Stripe state until it is removed.
    const exempt = requestedFields.billingExempt === undefined
        ? (await entRef(tenantId).get()).data()?.billingExempt === true
        : requestedFields.billingExempt === true;
    const plan: PlanId = exempt ? 'team' : requestedPlan;
    const fields = exempt ? { ...requestedFields, status: 'exempt' } : requestedFields;
    const limits = { ...PLAN_LIMITS[plan], aiIncluded: aiIncludedForStatus(plan, String(fields.status || '')) };
    const projects = await recountProjects(tenantId);
    await entRef(tenantId).set({
        ...(limits.aiAddonAvailable ? {} : { aiMemberIds: [], aiAddonSeats: 0 }),
        ...fields,
        plan,
        ...limits,
        projectCount: projects.length,
        lockedProjectIds: projectsToLock(projects, limits.projectLimit),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
};

const ensureEntitlement = async (tenantId: string, createdAtMs: number | null) => {
    const snap = await entRef(tenantId).get();
    if (snap.exists && snap.data()?.plan) return false;
    const initial = initialEntitlement(createdAtMs, Date.now());
    await applyPlan(tenantId, initial.plan, {
        status: initial.status,
        trialEndsAt: initial.trialEndsAtMs ? Timestamp.fromMillis(initial.trialEndsAtMs) : null,
        graceEndsAt: null,
        seats: 0,
        billingInterval: null,
    });
    return true;
};

export const onTenantCreatedBilling = functions.region(REGION).firestore
    .document('tenants/{tenantId}')
    .onCreate(async (snap, context) => {
        await ensureEntitlement(context.params.tenantId, toMs(snap.data()?.createdAt) ?? Date.now());
    });

/** Keeps `projectCount` (used by the rules' project limit) and the lock list current. */
export const onProjectCountBilling = functions.region(REGION).firestore
    .document('tenants/{tenantId}/projects/{projectId}')
    .onWrite(async (change, context) => {
        if (change.before.exists === change.after.exists) return;
        const ref = entRef(context.params.tenantId);
        if (!(await ref.get()).exists) return;
        await ref.set(change.after.exists
            ? { projectCount: FieldValue.increment(1) }
            : { projectCount: FieldValue.increment(-1), lockedProjectIds: FieldValue.arrayRemove(context.params.projectId) },
        { merge: true });
    });

const syncSubscription = async (subscription: Stripe.Subscription, tenantHint?: string) => {
    let tenantId = tenantHint || String(subscription.metadata?.tenantId || '');
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    if (!tenantId) {
        const match = await db.collection('billing_customers').where('customerId', '==', customerId).limit(1).get();
        tenantId = match.docs[0]?.id || '';
    }
    if (!tenantId) {
        console.warn('[billing] subscription without tenant', subscription.id);
        return;
    }
    const items = subscription.items.data;
    const addonItem = items.find((entry) => isAiAddonLookupKey(entry.price?.lookup_key));
    const item = items.find((entry) => entry !== addonItem) || items[0];
    const mapped = mapStripeStatus(subscription.status);
    const current = (await entRef(tenantId).get()).data() || {};
    // A canceled subscription only downgrades the workspace it currently drives.
    if (mapped.plan === 'free' && current.stripeSubscriptionId && current.stripeSubscriptionId !== subscription.id) return;

    await customerRef(tenantId).set({
        customerId,
        subscriptionId: subscription.id,
        priceId: item?.price?.id || null,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await applyPlan(tenantId, mapped.plan, {
        status: mapped.status,
        stripeSubscriptionId: mapped.plan === 'free' ? null : subscription.id,
        seats: mapped.plan === 'free' ? 0 : Number(item?.quantity || 1),
        billingInterval: mapped.plan === 'free' ? null : (item?.price?.recurring?.interval as BillingInterval) || null,
        trialEndsAt: subscription.trial_end ? Timestamp.fromMillis(subscription.trial_end * 1000) : null,
        graceEndsAt: null,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        currentPeriodEnd: item?.current_period_end ? Timestamp.fromMillis(item.current_period_end * 1000) : null,
        // Add-on quantity can also shrink in the portal: keep the first N assignments.
        ...(mapped.plan === 'free' ? {} : (() => {
            const aiAddonSeats = Number(addonItem?.quantity || 0);
            const assigned: string[] = Array.isArray(current.aiMemberIds) ? current.aiMemberIds : [];
            return { aiAddonSeats, aiMemberIds: assigned.slice(0, aiAddonSeats) };
        })()),
    });
};

/** Sets the AI add-on quantity on the subscription (adds/removes the item as needed). */
const setAddonQuantity = async (stripe: Stripe, subscriptionId: string, quantity: number) => {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const addonItem = subscription.items.data.find((entry) => isAiAddonLookupKey(entry.price?.lookup_key));
    if (addonItem && quantity === addonItem.quantity) return;
    if (addonItem && quantity === 0) {
        await stripe.subscriptionItems.del(addonItem.id, { proration_behavior: 'create_prorations' });
        return;
    }
    if (addonItem) {
        await stripe.subscriptionItems.update(addonItem.id, { quantity, proration_behavior: 'create_prorations' });
        return;
    }
    if (quantity === 0) return;
    const teamItem = subscription.items.data[0];
    const interval: BillingInterval = teamItem?.price?.recurring?.interval === 'month' ? 'month' : 'year';
    const prices = await stripe.prices.list({ lookup_keys: [AI_ADDON_LOOKUP_KEYS[interval]], active: true, limit: 1 });
    if (!prices.data[0]) throw new functions.https.HttpsError('failed-precondition', 'billing-price-missing');
    await stripe.subscriptionItems.create({
        subscription: subscriptionId, price: prices.data[0].id, quantity, proration_behavior: 'create_prorations',
    });
};

/**
 * Internal/comp workspaces (owner decision 2026-10-23): Team scope incl. AI for all members, no payment.
 * Only the admin console calls this (it writes the audit entry). Removing the flag returns to the Stripe
 * state when a subscription exists, else to Free (projects over the limit become read-only).
 */
export const setBillingExempt = async (tenantId: string, exempt: boolean, by: string) => {
    if (exempt) {
        await applyPlan(tenantId, 'team', { billingExempt: true, status: 'exempt', exemptBy: by, exemptAt: FieldValue.serverTimestamp() });
    } else {
        const ent = (await entRef(tenantId).get()).data() || {};
        const subId = typeof ent.stripeSubscriptionId === 'string' ? ent.stripeSubscriptionId : null;
        await entRef(tenantId).set({ billingExempt: false, exemptBy: by, exemptAt: FieldValue.serverTimestamp() }, { merge: true });
        if (subId && process.env.STRIPE_SECRET_KEY) {
            await syncSubscription(await getStripe().subscriptions.retrieve(subId), tenantId);
        } else {
            await applyPlan(tenantId, 'free', { billingExempt: false, status: 'free', seats: 0, billingInterval: null });
        }
    }
    aiAccessCache.clear();
};

// --- Callables ---

const requireOwner = async (tenantId: unknown, context: functions.https.CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    if (typeof tenantId !== 'string' || !tenantId.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
    }
    const member = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
    if (String(member.data()?.role || '') !== 'Owner') {
        throw new functions.https.HttpsError('permission-denied', 'Only the workspace owner manages billing.');
    }
    return { uid, tenantId };
};

const resolveOrigin = (requested: unknown) =>
    typeof requested === 'string' && ALLOWED_ORIGINS.includes(requested)
        ? requested
        : process.env.APP_URL || 'https://app.getprojectflow.com';

const ensureCustomer = async (stripe: Stripe, tenantId: string, uid: string) => {
    const existing = (await customerRef(tenantId).get()).data();
    if (existing?.customerId) return String(existing.customerId);
    const [user, tenant] = await Promise.all([admin.auth().getUser(uid), db.doc(`tenants/${tenantId}`).get()]);
    const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: String(tenant.data()?.name || 'ProjectFlow workspace'),
        metadata: { tenantId, ownerUid: uid },
    }, { idempotencyKey: `customer-${tenantId}` });
    await customerRef(tenantId).set({ customerId: customer.id, createdAt: FieldValue.serverTimestamp() }, { merge: true });
    return customer.id;
};

export const createBillingCheckout = functions.region(REGION).runWith({ secrets: STRIPE_SECRETS })
    .https.onCall(async (data, context) => {
        const { uid, tenantId } = await requireOwner(data?.tenantId, context);
        const interval: BillingInterval = data?.interval === 'month' ? 'month' : 'year';
        const stripe = getStripe();
        const ent = (await entRef(tenantId).get()).data() || {};
        if (ent.stripeSubscriptionId && ['active', 'trialing', 'past_due'].includes(String(ent.status))) {
            throw new functions.https.HttpsError('failed-precondition', 'billing-already-subscribed');
        }
        const prices = await stripe.prices.list({ lookup_keys: [PRICE_LOOKUP_KEYS[interval]], active: true, limit: 1 });
        const price = prices.data[0];
        if (!price) throw new functions.https.HttpsError('failed-precondition', 'billing-price-missing');

        const customer = await ensureCustomer(stripe, tenantId, uid);
        const quantity = seatQuantity(await fullMemberRoles(tenantId));
        const origin = resolveOrigin(data?.origin);
        // Running in-app trial: charging starts when it ends (Stripe needs trial_end ≥ 48 h ahead).
        const trialEndsAtMs = ent.status === 'trialing' ? toMs(ent.trialEndsAt) : null;
        const trialEnd = trialEndsAtMs && trialEndsAtMs > Date.now() + 49 * 60 * 60 * 1000
            ? Math.floor(trialEndsAtMs / 1000) : undefined;

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer,
            client_reference_id: tenantId,
            line_items: [{ price: price.id, quantity }],
            subscription_data: { metadata: { tenantId }, ...(trialEnd ? { trial_end: trialEnd } : {}) },
            metadata: { tenantId },
            billing_address_collection: 'required',
            customer_update: { address: 'auto', name: 'auto' },
            tax_id_collection: { enabled: true },
            allow_promotion_codes: true,
            locale: data?.language === 'de' ? 'de' : 'auto',
            success_url: `${origin}/?openSettings=billing&checkout=success`,
            cancel_url: `${origin}/?openSettings=billing&checkout=cancel`,
        });
        return { url: session.url };
    });

export const createBillingPortal = functions.region(REGION).runWith({ secrets: STRIPE_SECRETS })
    .https.onCall(async (data, context) => {
        const { tenantId } = await requireOwner(data?.tenantId, context);
        const customerId = (await customerRef(tenantId).get()).data()?.customerId;
        if (!customerId) throw new functions.https.HttpsError('failed-precondition', 'billing-no-customer');
        const session = await getStripe().billingPortal.sessions.create({
            customer: String(customerId),
            return_url: `${resolveOrigin(data?.origin)}/?openSettings=billing`,
            locale: data?.language === 'de' ? 'de' : 'auto',
        });
        return { url: session.url };
    });

/** Own OpenAI key for AI on Free (never returned to the client, only its last four characters). */
export const personalAiKey = functions.region(REGION).runWith({ secrets: AI_KEY_SECRETS }).https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    const action = data?.action;
    if (action === 'set') {
        const key = typeof data?.key === 'string' ? data.key.trim() : '';
        if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(key)) throw new functions.https.HttpsError('invalid-argument', 'invalid-openai-key');
        await aiKeyRef(uid).set({ secret: encryptSecret(key), last4: key.slice(-4), updatedAt: FieldValue.serverTimestamp() });
    } else if (action === 'clear') {
        await aiKeyRef(uid).delete();
    }
    aiAccessCache.delete(uid);
    const snap = await aiKeyRef(uid).get();
    return { hasKey: snap.exists, last4: snap.exists ? String(snap.data()?.last4 || '') : null };
});

/**
 * Assigns the AI add-on (10 €/user/month) to full members; the Stripe add-on quantity follows the list.
 * Team/Organization with a subscription only.
 */
export const setAiAddonMembers = functions.region(REGION).runWith({ secrets: STRIPE_SECRETS })
    .https.onCall(async (data, context) => {
        const { tenantId } = await requireOwner(data?.tenantId, context);
        const requested: string[] = Array.isArray(data?.memberIds)
            ? Array.from(new Set((data.memberIds as unknown[]).filter((id): id is string => typeof id === 'string')))
            : [];
        const ent = (await entRef(tenantId).get()).data() || {};
        if (!limitsFor(ent).aiAddonAvailable) throw new functions.https.HttpsError('failed-precondition', 'ai-addon-unavailable');
        if (!ent.stripeSubscriptionId || !['active', 'trialing', 'past_due'].includes(String(ent.status))) {
            throw new functions.https.HttpsError('failed-precondition', 'ai-addon-needs-subscription');
        }
        const members = await db.collection(`tenants/${tenantId}/members`).select('role').get();
        const fullMembers = new Set(members.docs.filter((doc) => String(doc.data().role || 'Member') !== 'Guest').map((doc) => doc.id));
        if (requested.some((uid) => !fullMembers.has(uid))) {
            throw new functions.https.HttpsError('invalid-argument', 'ai-addon-invalid-member');
        }
        await setAddonQuantity(getStripe(), String(ent.stripeSubscriptionId), requested.length);
        await entRef(tenantId).set({
            aiMemberIds: requested, aiAddonSeats: requested.length, updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        aiAccessCache.clear();
        return { aiMemberIds: requested };
    });

// --- Webhook ---

export const stripeWebhook = functions.region(REGION)
    .runWith({ secrets: [...STRIPE_SECRETS, 'STRIPE_WEBHOOK_SECRET'] })
    .https.onRequest(async (req, res) => {
        if (req.method !== 'POST') {
            res.status(405).send('Method not allowed');
            return;
        }
        let event: Stripe.Event;
        try {
            event = getStripe().webhooks.constructEvent(
                req.rawBody, String(req.headers['stripe-signature'] || ''), String(process.env.STRIPE_WEBHOOK_SECRET || ''),
            );
        } catch (error) {
            console.warn('[billing] webhook signature rejected', (error as Error).message);
            res.status(400).send('Invalid signature');
            return;
        }
        // Idempotency: Stripe retries; every event is applied once.
        const seenRef = db.doc(`billing_events/${event.id}`);
        try {
            await seenRef.create({ type: event.type, receivedAt: FieldValue.serverTimestamp() });
        } catch {
            res.json({ received: true, duplicate: true });
            return;
        }
        try {
            const stripe = getStripe();
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object as Stripe.Checkout.Session;
                    if (session.mode === 'subscription' && session.subscription) {
                        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
                        await syncSubscription(await stripe.subscriptions.retrieve(subId), session.client_reference_id || undefined);
                    }
                    break;
                }
                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                case 'customer.subscription.deleted':
                    // Re-read: events may arrive out of order, the current object is authoritative.
                    await syncSubscription(await stripe.subscriptions.retrieve((event.data.object as Stripe.Subscription).id));
                    break;
                case 'invoice.payment_failed': {
                    const invoice = event.data.object as Stripe.Invoice;
                    const subRef = invoice.parent?.subscription_details?.subscription;
                    if (subRef) await syncSubscription(await stripe.subscriptions.retrieve(typeof subRef === 'string' ? subRef : subRef.id));
                    break;
                }
                default:
                    break;
            }
            res.json({ received: true });
        } catch (error) {
            await seenRef.delete().catch(() => undefined);
            console.error('[billing] webhook handling failed', event.type, error);
            res.status(500).send('Webhook handling failed');
        }
    });

// --- Seats ---

/** Subscription quantity follows the number of full members (guests are free). */
export const onMemberWrittenBilling = functions.region(REGION).runWith({ secrets: STRIPE_SECRETS }).firestore
    .document('tenants/{tenantId}/members/{memberId}')
    .onWrite(async (change, context) => {
        const before = change.before.exists ? String(change.before.data()?.role || 'Member') : null;
        const after = change.after.exists ? String(change.after.data()?.role || 'Member') : null;
        const wasSeat = before !== null && before !== 'Guest';
        const isSeat = after !== null && after !== 'Guest';
        if (wasSeat === isSeat) return;
        const tenantId = context.params.tenantId;
        const memberId = context.params.memberId;
        const ent = (await entRef(tenantId).get()).data();
        // A member who leaves (or becomes a guest) loses the AI add-on assignment.
        const assigned: string[] = Array.isArray(ent?.aiMemberIds) ? ent.aiMemberIds : [];
        const dropAi = !isSeat && assigned.includes(memberId);
        if (dropAi) {
            await entRef(tenantId).set({ aiMemberIds: FieldValue.arrayRemove(memberId) }, { merge: true });
            aiAccessCache.delete(memberId);
        }
        if (!ent?.stripeSubscriptionId || !['active', 'trialing', 'past_due'].includes(String(ent.status))) return;
        if (!process.env.STRIPE_SECRET_KEY) return;
        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(String(ent.stripeSubscriptionId));
        const item = subscription.items.data.find((entry) => !isAiAddonLookupKey(entry.price?.lookup_key));
        const quantity = seatQuantity(await fullMemberRoles(tenantId));
        if (item && item.quantity !== quantity) {
            await stripe.subscriptionItems.update(item.id, { quantity, proration_behavior: 'create_prorations' });
        }
        if (dropAi) await setAddonQuantity(stripe, subscription.id, assigned.length - 1);
        await entRef(tenantId).set({
            seats: quantity,
            ...(dropAi ? { aiAddonSeats: assigned.length - 1 } : {}),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
    });

// --- Sweep: trials/grace that ran out, backfill of existing workspaces ---

export const billingSweep = functions.region(REGION).runWith({ timeoutSeconds: 540, memory: '512MB' })
    .pubsub.schedule('every 60 minutes').timeZone('Europe/Berlin')
    .onRun(async () => {
        const now = Date.now();
        const cutoverAtMs = toMs((await db.doc('admin_config/billing').get()).data()?.cutoverAt);
        const tenants = await db.collection('tenants').select('createdAt').get();
        let backfilled = 0;
        let downgraded = 0;
        for (const tenant of tenants.docs) {
            const tenantId = tenant.id;
            if (await ensureEntitlement(tenantId, toMs(tenant.data().createdAt))) {
                backfilled += 1;
                continue;
            }
            const ent = (await entRef(tenantId).get()).data() || {};
            const status = String(ent.status) as BillingStatus;
            const trialOver = status === 'trialing' && !ent.stripeSubscriptionId && periodExpired(toMs(ent.trialEndsAt), now);
            const graceOver = status === 'grace' && !ent.stripeSubscriptionId && periodExpired(cutoverAtMs, now);
            if (trialOver || graceOver) {
                await applyPlan(tenantId, 'free', { status: 'free', seats: 0, billingInterval: null, graceEndsAt: null });
                downgraded += 1;
            } else if (status === 'grace' && (toMs(ent.graceEndsAt) ?? null) !== cutoverAtMs) {
                await entRef(tenantId).set({ graceEndsAt: cutoverAtMs ? Timestamp.fromMillis(cutoverAtMs) : null }, { merge: true });
            }
        }
        console.log('[billing] sweep', { tenants: tenants.size, backfilled, downgraded });
    });
