// One-time Stripe TEST-mode setup for ProjectFlow billing (brain/plans/billing-implementation.md).
// Usage (repo root): node functions/scripts/stripe-setup.mjs
// The secret key is read from Secret Manager (STRIPE_SECRET_KEY, set by the owner via
// `firebase functions:secrets:set`), never from the command line; the webhook signing secret is written to
// Secret Manager (STRIPE_WEBHOOK_SECRET) without being printed. Idempotent: products/prices by lookup key,
// portal configurations by metadata.plan, the webhook endpoint by URL.
import { execFileSync } from 'node:child_process';
import Stripe from 'stripe';

const PROJECT = process.env.GCLOUD_PROJECT || 'projectflow-labestin';
const readSecret = (name) => {
    try {
        return execFileSync('gcloud', ['secrets', 'versions', 'access', 'latest', `--secret=${name}`, `--project=${PROJECT}`],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
        return '';
    }
};
const writeFirebaseSecret = (name, value) => {
    execFileSync('firebase', ['functions:secrets:set', name, '--data-file=-', `--project=${PROJECT}`, '--force'],
        { input: value, stdio: ['pipe', 'ignore', 'inherit'] });
};

const key = readSecret('STRIPE_SECRET_KEY');
if (!/^(sk|rk)_test_/.test(key)) {
    console.error('Refusing to run: Secret Manager STRIPE_SECRET_KEY is missing or not a test key (sk_test_…).');
    process.exit(1);
}
const stripe = new Stripe(key);
const WEBHOOK_URL = process.env.STRIPE_WEBHOOK_URL
    || 'https://europe-west3-projectflow-labestin.cloudfunctions.net/stripeWebhook';
const APP_URL = process.env.APP_URL || 'https://app.getprojectflow.com';

const PRODUCTS = {
    team: {
        name: 'ProjectFlow Team',
        description: 'Per seat. Unlimited projects, up to 50 members.',
        prices: [
            { lookup_key: 'team_monthly', unit_amount: 1200, interval: 'month', nickname: 'Team monthly (12 €/seat)' },
            { lookup_key: 'team_yearly', unit_amount: 12000, interval: 'year', nickname: 'Team yearly (10 €/seat/month)' },
        ],
    },
    personal: {
        name: 'ProjectFlow Personal',
        description: 'Personal workspace: unlimited projects, Flows, 10 GB storage.',
        prices: [
            { lookup_key: 'personal_monthly', unit_amount: 500, interval: 'month', nickname: 'Personal monthly (5 €)' },
            { lookup_key: 'personal_yearly', unit_amount: 4800, interval: 'year', nickname: 'Personal yearly (4 €/month)' },
        ],
    },
    ai_addon: {
        name: 'ProjectFlow AI add-on',
        description: 'Per user with AI. 1M tokens + 50 images per month.',
        prices: [
            { lookup_key: 'ai_addon_monthly', unit_amount: 1000, interval: 'month', nickname: 'AI add-on monthly (10 €/user)' },
            { lookup_key: 'ai_addon_yearly', unit_amount: 12000, interval: 'year', nickname: 'AI add-on yearly (10 €/user/month)' },
        ],
    },
};
const EVENTS = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_failed',
];

const prices = {};
const productIds = {};
for (const [plan, def] of Object.entries(PRODUCTS)) {
    const existing = await stripe.prices.list({ lookup_keys: def.prices.map((p) => p.lookup_key), active: true, expand: ['data.product'] });
    let product = existing.data[0]?.product;
    if (!product) {
        product = await stripe.products.create({ name: def.name, description: def.description, metadata: { plan } });
        console.log('Created product', plan, product.id);
    }
    productIds[plan] = product.id;
    for (const priceDef of def.prices) {
        let price = existing.data.find((p) => p.lookup_key === priceDef.lookup_key);
        if (!price) {
            price = await stripe.prices.create({
                product: product.id,
                currency: 'eur',
                unit_amount: priceDef.unit_amount,
                recurring: { interval: priceDef.interval },
                lookup_key: priceDef.lookup_key,
                nickname: priceDef.nickname,
                tax_behavior: 'exclusive',
            });
            console.log('Created price', priceDef.lookup_key, price.id);
        }
        prices[priceDef.lookup_key] = price.id;
    }
}

// Customer portal: one configuration per workspace type (metadata.plan), so a Team subscription can never be
// switched to the Personal price or vice versa. createBillingPortal picks the configuration by metadata.plan.
const allConfigs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
for (const plan of ['team', 'personal']) {
    const params = {
        business_profile: { headline: 'ProjectFlow – Abrechnung / Billing' },
        default_return_url: `${APP_URL}/?openSettings=billing`,
        metadata: { plan },
        features: {
            customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name', 'tax_id'] },
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            subscription_cancel: { enabled: true, mode: 'at_period_end' },
            subscription_update: {
                enabled: true,
                default_allowed_updates: ['price'],
                proration_behavior: 'create_prorations',
                // Interval switch only; the AI add-on quantity is managed in the app.
                products: [{ product: productIds[plan], prices: [prices[`${plan}_monthly`], prices[`${plan}_yearly`]] }],
            },
        },
    };
    const existingConfig = allConfigs.data.find((c) => c.metadata?.plan === plan);
    if (existingConfig) {
        await stripe.billingPortal.configurations.update(existingConfig.id, params);
        console.log('Updated portal configuration', plan, existingConfig.id);
    } else {
        const config = await stripe.billingPortal.configurations.create(params);
        console.log('Created portal configuration', plan, config.id);
    }
}

const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
let endpoint = endpoints.data.find((e) => e.url === WEBHOOK_URL);
// The signing secret is only returned on creation: without a stored secret, recreate the endpoint.
if (endpoint && !readSecret('STRIPE_WEBHOOK_SECRET')) {
    await stripe.webhookEndpoints.del(endpoint.id);
    console.log('Deleted webhook endpoint without stored secret', endpoint.id);
    endpoint = undefined;
}
if (endpoint) {
    await stripe.webhookEndpoints.update(endpoint.id, { enabled_events: EVENTS });
    console.log('Webhook endpoint exists', endpoint.id, '(secret already in Secret Manager)');
} else {
    const created = await stripe.webhookEndpoints.create({ url: WEBHOOK_URL, enabled_events: EVENTS, description: 'ProjectFlow billing' });
    writeFirebaseSecret('STRIPE_WEBHOOK_SECRET', created.secret);
    console.log('Created webhook endpoint', created.id, '- signing secret stored as STRIPE_WEBHOOK_SECRET');
}

// Payment method domains (Apple Pay / Google Pay via the Express Checkout Element on the landing /checkout).
// Stripe hosts the Apple Pay domain verification for registered domains. Override with PAYMENT_DOMAINS=a,b.
const PAYMENT_DOMAINS = (process.env.PAYMENT_DOMAINS
    || 'getprojectflow.com,www.getprojectflow.com,getprojectflow.web.app,getprojectflow--preview-bi8zmvui.web.app').split(',');
const knownDomains = await stripe.paymentMethodDomains.list({ limit: 100 });
for (const domain of PAYMENT_DOMAINS.map((d) => d.trim()).filter(Boolean)) {
    const existing = knownDomains.data.find((entry) => entry.domain_name === domain);
    const record = existing || await stripe.paymentMethodDomains.create({ domain_name: domain, enabled: true });
    const checked = await stripe.paymentMethodDomains.validate(record.id).catch(() => record);
    console.log('Payment method domain', domain, existing ? '(exists)' : '(created)',
        'apple_pay:', checked.apple_pay?.status, 'google_pay:', checked.google_pay?.status);
}

// Organization: product only (draft, inactive) until the owner decides the price.
const orgExisting = await stripe.products.search({ query: "metadata['plan']:'organization'" }).catch(() => ({ data: [] }));
if (!orgExisting.data.length) {
    const org = await stripe.products.create({
        name: 'ProjectFlow Organization', active: false, metadata: { plan: 'organization' },
        description: 'Draft — price not decided (proposal from 18 €/seat/month billed yearly).',
    });
    console.log('Created draft product organization', org.id);
}
console.log('\nPrices:', prices);
