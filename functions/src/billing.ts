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
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

import { db } from './init';
import { ALLOWED_ORIGINS } from './corsConfig';
import {
    AI_ADDON_LOOKUP_KEYS, PERSONAL_LOOKUP_KEYS, PRICE_LOOKUP_KEYS, storageFor, aiEnabledFor,
    aiIncludedForStatus, initialEntitlement, isAiAddonLookupKey, isPersonalLookupKey, isTestKey, limitsFor, limitsForType,
    mapStripeStatus, paidPlanFor, personalWorkspaceId, planForType,
    memberLimitAllows, periodExpired, projectsToLock, seatQuantity,
    type BillingInterval, type BillingStatus, type PlanId, type PlanLimits, type WorkspaceType,
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

/** Decrypted own OpenAI key of a user, or null (needs AI_KEY_SECRETS in runWith). */
export const ownAiKeyFor = async (uid: string): Promise<string | null> => decryptSecret((await aiKeyRef(uid).get()).data()?.secret);

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
        // Only tenants/{t}/members/{uid} (other `members` subcollections, e.g. old ai_credits docs, share the name).
        .filter((doc) => doc.ref.parent.parent?.parent.id === 'tenants')
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
    const current = (await entRef(tenantId).get()).data() || {};
    const type: WorkspaceType = (requestedFields.workspaceType ?? current.workspaceType) === 'personal' ? 'personal' : 'team';
    // billingExempt (internal/comp, admin console) overrides trial expiry and Stripe state until it is removed.
    const exempt = requestedFields.billingExempt === undefined ? current.billingExempt === true : requestedFields.billingExempt === true;
    // A workspace type never holds the other type's paid plan (contract §7).
    const plan: PlanId = exempt ? paidPlanFor(type) : planForType(requestedPlan, type);
    const fields = exempt ? { ...requestedFields, status: 'exempt' } : requestedFields;
    const limits = { ...limitsForType(plan, type), aiIncluded: aiIncludedForStatus(plan, String(fields.status || '')) };
    // Storage follows plan and full members (Team pools 10 GB per seat); nothing is deleted when it shrinks,
    // new uploads are refused instead (plan-storage-limit). storageQuotaOverrideBytes (platform admin) wins.
    const [projects, roles] = await Promise.all([recountProjects(tenantId), fullMemberRoles(tenantId)]);
    const storage = storageFor(plan, roles.filter((role) => role !== 'Guest').length);
    await entRef(tenantId).set({
        ...(limits.aiAddonAvailable ? {} : { aiMemberIds: [], aiAddonSeats: 0 }),
        ...storage,
        workspaceType: type,
        flowsQuota: plan === 'free' ? 'free' : 'seat',
        ...fields,
        plan,
        ...limits,
        projectCount: projects.length,
        lockedProjectIds: projectsToLock(projects, limits.projectLimit),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
};

const ensureEntitlement = async (tenantId: string, createdAtMs: number | null, type: WorkspaceType = 'team') => {
    const snap = await entRef(tenantId).get();
    if (snap.exists && snap.data()?.plan) return false;
    const initial = initialEntitlement(createdAtMs, Date.now(), type);
    await applyPlan(tenantId, initial.plan, {
        workspaceType: type,
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
        const type: WorkspaceType = snap.data()?.workspaceType === 'personal' ? 'personal' : 'team';
        await ensureEntitlement(context.params.tenantId, toMs(snap.data()?.createdAt) ?? Date.now(), type);
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

/**
 * Add-on seats bought on the purchase page: keep existing assignments (first N), and give a free slot to the
 * owner first (personal workspaces: always the owner). The owner assigns the rest in the billing tab.
 */
const aiAssignmentAfterPurchase = (current: Record<string, unknown>, seats: number, ownerId: string) => {
    const assigned: string[] = Array.isArray(current.aiMemberIds) ? (current.aiMemberIds as string[]).slice(0, seats) : [];
    if (ownerId && assigned.length < seats && !assigned.includes(ownerId)) assigned.unshift(ownerId);
    return assigned.slice(0, seats);
};

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
    const mapped = mapStripeStatus(subscription.status, isPersonalLookupKey(item?.price?.lookup_key) ? 'personal' : 'team');
    const current = (await entRef(tenantId).get()).data() || {};
    const drivesWorkspace = current.stripeSubscriptionId === subscription.id;
    // Own purchase page (default_incomplete): an unpaid subscription changes nothing until it is paid; when Stripe
    // expires it after 23 h only the pending marker is cleared.
    if (!drivesWorkspace && (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired')) {
        await customerRef(tenantId).set({
            pendingSubscriptionId: subscription.status === 'incomplete' ? subscription.id : FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return;
    }
    // A canceled subscription only downgrades the workspace it currently drives.
    if (mapped.plan === 'free' && !drivesWorkspace) return;

    const ownerId = String((await db.doc(`tenants/${tenantId}`).get()).data()?.ownerId || '');
    await customerRef(tenantId).set({
        customerId,
        subscriptionId: subscription.id,
        pendingSubscriptionId: FieldValue.delete(),
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
        ...(mapped.plan === 'free' ? {} : {
            aiAddonSeats: Number(addonItem?.quantity || 0),
            aiMemberIds: aiAssignmentAfterPurchase(current, Number(addonItem?.quantity || 0), ownerId),
        }),
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
        // applyPlan maps 'team' to the paid plan of the workspace type (personal workspaces stay personal).
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

// --- Personal workspaces (contract §7) ---

const PERSONAL_NAMES: Record<string, string> = { de: 'Mein Workspace', en: 'My workspace' };

/**
 * Creates the user's personal workspace `personal_{uid}` (tenant, Owner membership, Free entitlement) in one
 * transaction. Idempotent: returns created=false when it exists. Used by the callable and the backfill script.
 */
export const createPersonalWorkspace = async (uid: string, language?: string) => {
    const tenantId = personalWorkspaceId(uid);
    const tenantRef = db.doc(`tenants/${tenantId}`);
    const user = await admin.auth().getUser(uid);
    const email = String(user.email || '').toLowerCase();
    const limits = limitsForType('free', 'personal');
    const created = await db.runTransaction(async (tx) => {
        if ((await tx.get(tenantRef)).exists) return false;
        const now = FieldValue.serverTimestamp();
        tx.set(tenantRef, {
            tenantId,
            name: PERSONAL_NAMES[language === 'de' ? 'de' : 'en'],
            ownerId: uid,
            createdBy: uid,
            workspaceType: 'personal',
            createdAt: now,
            updatedAt: now,
        });
        tx.set(db.doc(`tenants/${tenantId}/members/${uid}`), {
            uid,
            role: 'Owner',
            roleIds: [],
            joinedAt: now,
            displayName: user.displayName || email.split('@')[0] || 'User',
            email,
            photoURL: user.photoURL || '',
        });
        // Written with the tenant so onTenantCreatedBilling never starts a Team trial here.
        tx.set(entRef(tenantId), {
            plan: 'free', status: 'free', workspaceType: 'personal', ...limits, ...storageFor('free', 1), flowsQuota: 'free',
            seats: 0, billingInterval: null, trialEndsAt: null, graceEndsAt: null,
            projectCount: 0, lockedProjectIds: [], aiMemberIds: [], aiAddonSeats: 0, updatedAt: now,
        });
        return true;
    });
    return { tenantId, created };
};

/** Called by the client after every sign-in; replaces client-side creation of a first workspace. */
export const ensurePersonalWorkspace = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    return createPersonalWorkspace(uid, typeof data?.language === 'string' ? data.language : undefined);
});

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

const INVOICE_FOOTER = 'ProjectFlow · Christoph Labestin · Frühlingsstraße 8 · 84082 Laberweinting · hello@getprojectflow.com';
/** "PF" + 6 chars derived from the tenant id (Stripe: 3–12 uppercase letters/digits, unique per customer). */
const invoicePrefixFor = (tenantId: string) =>
    `PF${createHash('sha256').update(tenantId).digest('hex').slice(0, 6).toUpperCase()}`;

const ensureCustomer = async (stripe: Stripe, tenantId: string, uid: string) => {
    const existing = (await customerRef(tenantId).get()).data();
    if (existing?.customerId) return String(existing.customerId);
    const [user, tenant] = await Promise.all([admin.auth().getUser(uid), db.doc(`tenants/${tenantId}`).get()]);
    const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: String(tenant.data()?.name || 'ProjectFlow workspace'),
        metadata: { tenantId, ownerUid: uid },
        // Invoice prefix/footer via API: the dashboard does not save them before account activation.
        invoice_prefix: invoicePrefixFor(tenantId),
        invoice_settings: { footer: INVOICE_FOOTER },
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
        const type: WorkspaceType = ent.workspaceType === 'personal' ? 'personal' : 'team';
        if (data?.plan && data.plan !== paidPlanFor(type)) {
            throw new functions.https.HttpsError('failed-precondition', 'plan-workspace-type-mismatch');
        }
        const lookupKey = (type === 'personal' ? PERSONAL_LOOKUP_KEYS : PRICE_LOOKUP_KEYS)[interval];
        const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
        const price = prices.data[0];
        if (!price) throw new functions.https.HttpsError('failed-precondition', 'billing-price-missing');

        const customer = await ensureCustomer(stripe, tenantId, uid);
        const quantity = type === 'personal' ? 1 : seatQuantity(await fullMemberRoles(tenantId));
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
        const stripe = getStripe();
        const plan = (await entRef(tenantId).get()).data()?.workspaceType === 'personal' ? 'personal' : 'team';
        const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
        const configuration = configs.data.find((entry) => entry.metadata?.plan === plan)?.id;
        const session = await stripe.billingPortal.sessions.create({
            ...(configuration ? { configuration } : {}),
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

// --- Own purchase page (Stripe Payment Element, contract §8) ---

type PurchaseInput = { tenantId: string; uid: string; type: WorkspaceType; interval: BillingInterval; aiAddonSeats: number };

/** Validates the request: owner only, plan follows the workspace type, AI add-on 0..members (personal: 0..1). */
const resolvePurchase = async (data: any, context: functions.https.CallableContext): Promise<PurchaseInput> => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    const requestedTenant = data?.personal === true ? personalWorkspaceId(uid) : data?.tenantId;
    const { tenantId } = await requireOwner(requestedTenant, context);
    const ent = (await entRef(tenantId).get()).data() || {};
    const type: WorkspaceType = ent.workspaceType === 'personal' ? 'personal' : 'team';
    if (data?.plan && data.plan !== paidPlanFor(type)) {
        throw new functions.https.HttpsError('failed-precondition', 'plan-workspace-type-mismatch');
    }
    if (ent.billingExempt === true) throw new functions.https.HttpsError('failed-precondition', 'billing-exempt');
    const interval: BillingInterval = data?.interval === 'month' ? 'month' : 'year';
    const maxAi = type === 'personal' ? 1 : seatQuantity(await fullMemberRoles(tenantId));
    // `aiAddon: true` = one AI add-on for the owner (landing page); `aiAddonSeats` = explicit count.
    const requestedAi = typeof data?.aiAddon === 'boolean' && data?.aiAddonSeats === undefined ? (data.aiAddon ? 1 : 0) : Number(data?.aiAddonSeats) || 0;
    const aiAddonSeats = Math.min(maxAi, Math.max(0, Math.floor(requestedAi)));
    return { tenantId, uid, type, interval, aiAddonSeats };
};

const purchaseItems = async (stripe: Stripe, input: PurchaseInput) => {
    const planKey = (input.type === 'personal' ? PERSONAL_LOOKUP_KEYS : PRICE_LOOKUP_KEYS)[input.interval];
    const addonKey = AI_ADDON_LOOKUP_KEYS[input.interval];
    const prices = await stripe.prices.list({ lookup_keys: [planKey, addonKey], active: true, limit: 2 });
    const planPrice = prices.data.find((price) => price.lookup_key === planKey);
    const addonPrice = prices.data.find((price) => price.lookup_key === addonKey);
    if (!planPrice || !addonPrice) throw new functions.https.HttpsError('failed-precondition', 'billing-price-missing');
    // Seats are not chosen by the buyer: they follow the full members (guests are free).
    const seats = input.type === 'personal' ? 1 : seatQuantity(await fullMemberRoles(input.tenantId));
    return [
        { price: planPrice.id, quantity: seats },
        ...(input.aiAddonSeats > 0 ? [{ price: addonPrice.id, quantity: input.aiAddonSeats }] : []),
    ];
};

const resolvePromotion = async (stripe: Stripe, code: unknown) => {
    if (typeof code !== 'string' || !code.trim()) return undefined;
    const found = await stripe.promotionCodes.list({ code: code.trim(), active: true, limit: 1 });
    if (!found.data[0]) throw new functions.https.HttpsError('invalid-argument', 'billing-promotion-invalid');
    return found.data[0].id;
};

/** Trial still running: billing starts at its end (Stripe needs ≥ 48 h); the page then collects a SetupIntent. */
const trialEndFor = (ent: Record<string, unknown>) => {
    const ms = ent.status === 'trialing' ? toMs(ent.trialEndsAt) : null;
    return ms && ms > Date.now() + 49 * 60 * 60 * 1000 ? Math.floor(ms / 1000) : undefined;
};

/** Net amounts in cents; `tax` stays 0 until VAT/OSS is decided (no automatic_tax yet). */
const invoiceSummary = (invoice: Stripe.Invoice | null | undefined, trialEnd?: number | null) => invoice ? {
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    discount: (invoice.total_discount_amounts || []).reduce((sum, entry) => sum + entry.amount, 0),
    tax: (invoice.total_taxes || []).reduce((sum, entry) => sum + entry.amount, 0),
    total: invoice.total,
    amountDue: invoice.amount_due,
    trialEnd: trialEnd ?? null,
    lines: invoice.lines.data.map((line) => ({
        label: line.description,
        description: line.description,
        quantity: line.quantity,
        unitAmount: line.quantity ? Math.round(line.amount / line.quantity) : line.amount,
        amount: line.amount,
    })),
} : null;

const LIVE_STATUSES = ['active', 'trialing', 'past_due'];

/** Item changes from an existing subscription to the requested plan items (interval switch, AI seats). */
const changeItemsFor = (subscription: Stripe.Subscription, target: { price: string; quantity: number }[]) => {
    const planItem = subscription.items.data.find((entry) => !isAiAddonLookupKey(entry.price?.lookup_key));
    const addonItem = subscription.items.data.find((entry) => isAiAddonLookupKey(entry.price?.lookup_key));
    const [planTarget, addonTarget] = target;
    const items: Stripe.SubscriptionUpdateParams.Item[] = [
        planItem ? { id: planItem.id, price: planTarget.price, quantity: planTarget.quantity } : planTarget,
    ];
    if (addonTarget) items.push(addonItem ? { id: addonItem.id, price: addonTarget.price, quantity: addonTarget.quantity } : addonTarget);
    else if (addonItem) items.push({ id: addonItem.id, deleted: true });
    const unchanged = Boolean(planItem) && planItem!.price.id === planTarget.price && planItem!.quantity === planTarget.quantity
        && (addonTarget
            ? Boolean(addonItem) && addonItem!.price.id === addonTarget.price && addonItem!.quantity === addonTarget.quantity
            : !addonItem);
    return { items, unchanged, removesAddon: Boolean(addonItem && !addonTarget) };
};

/** Price preview for the purchase page (no side effects). */
export const previewSubscription = functions.region(REGION).runWith({ secrets: STRIPE_SECRETS })
    .https.onCall(async (data, context) => {
        const input = await resolvePurchase(data, context);
        const stripe = getStripe();
        const customer = await ensureCustomer(stripe, input.tenantId, input.uid);
        const promotion = await resolvePromotion(stripe, data?.promotionCode);
        const ent = (await entRef(input.tenantId).get()).data() || {};
        const target = await purchaseItems(stripe, input);
        if (ent.stripeSubscriptionId && LIVE_STATUSES.includes(String(ent.status))) {
            // Change of an existing subscription: prorated preview of what is charged now.
            const subscription = await stripe.subscriptions.retrieve(String(ent.stripeSubscriptionId));
            const change = changeItemsFor(subscription, target);
            const preview = change.unchanged ? null : await stripe.invoices.createPreview({
                customer,
                subscription: subscription.id,
                subscription_details: { items: change.items, proration_behavior: 'always_invoice' },
            });
            const summary = invoiceSummary(preview);
            return {
                plan: paidPlanFor(input.type), interval: input.interval, aiAddonSeats: input.aiAddonSeats,
                change: true, unchanged: change.unchanged, trialEnd: null, invoice: summary, summary,
            };
        }
        const trialEnd = trialEndFor(ent);
        const preview = await stripe.invoices.createPreview({
            customer,
            subscription_details: {
                items: target,
                ...(trialEnd ? { trial_end: trialEnd } : {}),
            },
            ...(promotion ? { discounts: [{ promotion_code: promotion }] } : {}),
        });
        const summary = invoiceSummary(preview, trialEnd);
        return {
            plan: paidPlanFor(input.type), interval: input.interval, aiAddonSeats: input.aiAddonSeats,
            change: false, trialEnd: trialEnd ?? null, invoice: summary, summary,
        };
    });

/**
 * Starts a subscription for the own purchase page: `default_incomplete`, the page confirms the returned
 * client secret with the Payment Element; the webhook activates the plan. Reuses an identical pending
 * subscription (idempotent), cancels a different pending one.
 */
export const createSubscriptionIntent = functions.region(REGION).runWith({ secrets: STRIPE_SECRETS })
    .https.onCall(async (data, context) => {
        const input = await resolvePurchase(data, context);
        const stripe = getStripe();
        const ent = (await entRef(input.tenantId).get()).data() || {};
        const customer = await ensureCustomer(stripe, input.tenantId, input.uid);
        const items = await purchaseItems(stripe, input);
        if (ent.stripeSubscriptionId && LIVE_STATUSES.includes(String(ent.status))) {
            // Upgrade/downgrade on the same page: interval switch and AI seats, prorated and invoiced now.
            // Seats follow members automatically. Upgrades only apply once paid (pending_if_incomplete).
            const current = await stripe.subscriptions.retrieve(String(ent.stripeSubscriptionId));
            const change = changeItemsFor(current, items);
            if (change.unchanged) {
                return { subscriptionId: current.id, intentType: 'none', clientSecret: null, change: true, trialEnd: current.trial_end ?? null, invoice: null, summary: null };
            }
            const updated = await stripe.subscriptions.update(current.id, {
                items: change.items,
                proration_behavior: 'always_invoice',
                payment_behavior: change.removesAddon ? 'allow_incomplete' : 'pending_if_incomplete',
                expand: ['latest_invoice.confirmation_secret'],
            });
            const invoice = updated.latest_invoice as Stripe.Invoice | null;
            const needsPayment = Boolean(invoice && invoice.status === 'open' && invoice.amount_due > 0);
            const summary = invoiceSummary(invoice);
            return {
                subscriptionId: updated.id,
                intentType: needsPayment ? 'payment' : 'none',
                clientSecret: needsPayment ? invoice?.confirmation_secret?.client_secret || null : null,
                change: true,
                trialEnd: updated.trial_end ?? null,
                invoice: summary,
                summary,
            };
        }
        const promotion = await resolvePromotion(stripe, data?.promotionCode);
        const trialEnd = trialEndFor(ent);
        const expand = ['latest_invoice.confirmation_secret', 'pending_setup_intent'];

        const toResult = (subscription: Stripe.Subscription) => {
            const invoice = subscription.latest_invoice as Stripe.Invoice | null;
            const setup = subscription.pending_setup_intent as Stripe.SetupIntent | null;
            const clientSecret = setup?.client_secret || invoice?.confirmation_secret?.client_secret || null;
            const summary = invoiceSummary(invoice, subscription.trial_end ?? null);
            return {
                subscriptionId: subscription.id,
                intentType: setup ? 'setup' : 'payment',
                clientSecret,
                change: false,
                trialEnd: subscription.trial_end ?? null,
                invoice: summary,
                summary,
            };
        };

        const pendingId = (await customerRef(input.tenantId).get()).data()?.pendingSubscriptionId;
        if (typeof pendingId === 'string') {
            const pending = await stripe.subscriptions.retrieve(pendingId, { expand }).catch(() => null);
            const same = pending && pending.status === 'incomplete' && !promotion
                && pending.items.data.length === items.length
                && items.every((wanted) => pending.items.data.some((have) => have.price.id === wanted.price && have.quantity === wanted.quantity));
            if (pending && same) return toResult(pending);
            if (pending && pending.status === 'incomplete') await stripe.subscriptions.cancel(pending.id).catch(() => undefined);
        }

        const subscription = await stripe.subscriptions.create({
            customer,
            items,
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            metadata: { tenantId: input.tenantId, source: 'purchase-page' },
            ...(trialEnd ? { trial_end: trialEnd } : {}),
            ...(promotion ? { discounts: [{ promotion_code: promotion }] } : {}),
            expand,
        });
        // A trial subscription is already `trialing` (not incomplete) and drives the workspace via the webhook.
        await customerRef(input.tenantId).set({
            pendingSubscriptionId: subscription.status === 'incomplete' ? subscription.id : FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return toResult(subscription);
    });

// --- Purchase page helpers (landing /checkout, contract §8) ---

/** Public: publishable key + availability for the purchase page (billing_public/config, set by script). */
export const getBillingConfig = functions.region(REGION).https.onCall(async () => {
    const config = (await db.doc('billing_public/config').get()).data() || {};
    return {
        publishableKey: typeof config.publishableKey === 'string' ? config.publishableKey : null,
        checkoutAvailable: config.checkoutAvailable === true,
        mode: config.mode || 'test',
    };
});

/** Workspaces the caller owns (personal one created if missing), with their billing state. */
export const listBillingWorkspaces = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    await createPersonalWorkspace(uid, typeof data?.language === 'string' ? data.language : undefined);
    const owned = await db.collectionGroup('members').where('uid', '==', uid).limit(50).get();
    const tenantIds = owned.docs
        .filter((doc) => doc.ref.parent.parent?.parent.id === 'tenants' && String(doc.data().role) === 'Owner')
        .map((doc) => doc.ref.parent.parent!.id);
    return Promise.all(tenantIds.map(async (tenantId) => {
        const [tenant, ent, roles] = await Promise.all([
            db.doc(`tenants/${tenantId}`).get(), entRef(tenantId).get(), fullMemberRoles(tenantId),
        ]);
        const e = ent.data() || {};
        return {
            tenantId,
            name: String(tenant.data()?.name || 'Workspace'),
            workspaceType: e.workspaceType === 'personal' ? 'personal' : 'team',
            plan: e.plan || 'team',
            status: e.status || 'grace',
            billingInterval: e.billingInterval || null,
            memberCount: roles.filter((role) => role !== 'Guest').length,
            aiAddonSeats: Number(e.aiAddonSeats || 0),
            trialEndsAt: toMs(e.trialEndsAt),
            billingExempt: e.billingExempt === true,
            hasSubscription: Boolean(e.stripeSubscriptionId),
        };
    }));
});

/** Creates a team workspace for the caller (Owner); the onCreate trigger starts the 14-day Team trial. */
export const createTeamWorkspace = functions.region(REGION).https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    const name = typeof data?.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 80) : 'Workspace';
    const user = await admin.auth().getUser(uid);
    const email = String(user.email || '').toLowerCase();
    const tenantRef = db.collection('tenants').doc();
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(tenantRef, { tenantId: tenantRef.id, name, ownerId: uid, createdBy: uid, createdAt: now, updatedAt: now });
    batch.set(tenantRef.collection('members').doc(uid), {
        uid, role: 'Owner', roleIds: [], joinedAt: now,
        displayName: user.displayName || email.split('@')[0] || 'User', email, photoURL: user.photoURL || '',
    });
    await batch.commit();
    return { tenantId: tenantRef.id };
});

/** Polled by the success page until the webhook has applied the purchase. */
export const getSubscriptionStatus = functions.region(REGION).https.onCall(async (data, context) => {
    const { tenantId } = await requireOwner(data?.personal === true && context.auth?.uid ? personalWorkspaceId(context.auth.uid) : data?.tenantId, context);
    const e = (await entRef(tenantId).get()).data() || {};
    return {
        status: e.status || 'grace',
        plan: e.plan || 'team',
        interval: e.billingInterval || null,
        aiAddonSeats: Number(e.aiAddonSeats || 0),
        active: Boolean(e.stripeSubscriptionId) && LIVE_STATUSES.includes(String(e.status)),
    };
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
        if (ent?.plan === 'team' || ent?.plan === 'organization') {
            const fullMembers = (await fullMemberRoles(tenantId)).filter((role) => role !== 'Guest').length;
            await entRef(tenantId).set(storageFor(ent.plan, fullMembers), { merge: true });
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
        const tenants = await db.collection('tenants').select('createdAt', 'workspaceType').get();
        let backfilled = 0;
        let downgraded = 0;
        for (const tenant of tenants.docs) {
            const tenantId = tenant.id;
            const type: WorkspaceType = tenant.data().workspaceType === 'personal' ? 'personal' : 'team';
            if (await ensureEntitlement(tenantId, toMs(tenant.data().createdAt), type)) {
                backfilled += 1;
                continue;
            }
            let ent = (await entRef(tenantId).get()).data() || {};
            // Docs from before plan-based storage: recompute limits once (keeps plan and status).
            if (ent.plan && ent.maxFileBytes === undefined) {
                await applyPlan(tenantId, ent.plan as PlanId, { status: ent.status });
                ent = (await entRef(tenantId).get()).data() || {};
            }
            // Pooled Team storage follows full members (also covered by onMemberWrittenBilling once Stripe is set up).
            if (ent.plan === 'team' || ent.plan === 'organization') {
                const fullMembers = (await fullMemberRoles(tenantId)).filter((role) => role !== 'Guest').length;
                const storage = storageFor(ent.plan, fullMembers);
                if (storage.storageQuotaBytes !== ent.storageQuotaBytes) await entRef(tenantId).set(storage, { merge: true });
            }
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
