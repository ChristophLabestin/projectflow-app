// E2E helper (TEST mode only): creates a Stripe Checkout URL for one workspace exactly like createBillingCheckout,
// so the webhook → entitlements path can be tested before the in-app button is enabled (billing_public/config).
// Usage (repo root): node functions/scripts/billing-test-checkout.mjs <tenantId> [month|year]
// The key comes from Secret Manager; the URL is opened by a person, who pays with Stripe's test card.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import Stripe from 'stripe';

const require = createRequire(import.meta.url);
const PROJECT = process.env.GCLOUD_PROJECT || 'projectflow-labestin';
process.env.GCLOUD_PROJECT = PROJECT;
const { db } = require('../lib/init.js');

const [tenantId, intervalArg] = process.argv.slice(2);
if (!tenantId) {
    console.error('Usage: node functions/scripts/billing-test-checkout.mjs <tenantId> [month|year]');
    process.exit(1);
}
const key = execFileSync('gcloud', ['secrets', 'versions', 'access', 'latest', '--secret=STRIPE_SECRET_KEY', `--project=${PROJECT}`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
if (!/^(sk|rk)_test_/.test(key)) throw new Error('STRIPE_SECRET_KEY is not a test key');
const stripe = new Stripe(key);
const interval = intervalArg === 'month' ? 'month' : 'year';

const ent = (await db.doc(`tenants/${tenantId}/entitlements/plan`).get()).data() || {};
const personal = ent.workspaceType === 'personal';
const lookupKey = `${personal ? 'personal' : 'team'}_${interval === 'month' ? 'monthly' : 'yearly'}`;
const price = (await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })).data[0];
if (!price) throw new Error(`price ${lookupKey} missing - run stripe-setup.mjs first`);

const customerDoc = db.doc(`billing_customers/${tenantId}`);
let customerId = (await customerDoc.get()).data()?.customerId;
if (!customerId) {
    const tenant = (await db.doc(`tenants/${tenantId}`).get()).data() || {};
    customerId = (await stripe.customers.create({ name: String(tenant.name || tenantId), metadata: { tenantId } })).id;
    await customerDoc.set({ customerId }, { merge: true });
}
const members = await db.collection(`tenants/${tenantId}/members`).select('role').get();
const seats = Math.max(1, members.docs.filter((d) => d.data().role !== 'Guest').length);
const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: tenantId,
    line_items: [{ price: price.id, quantity: personal ? 1 : seats }],
    subscription_data: { metadata: { tenantId } },
    metadata: { tenantId },
    billing_address_collection: 'required',
    success_url: 'https://app.getprojectflow.com/?openSettings=billing&checkout=success',
    cancel_url: 'https://app.getprojectflow.com/?openSettings=billing&checkout=cancel',
});
console.log(JSON.stringify({ tenantId, plan: personal ? 'personal' : 'team', interval, seats: personal ? 1 : seats, url: session.url }));
