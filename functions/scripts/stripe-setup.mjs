// One-time Stripe TEST-mode setup for ProjectFlow billing (brain/plans/billing-implementation.md).
// Usage: STRIPE_SECRET_KEY=sk_test_… node functions/scripts/stripe-setup.mjs
// Idempotent: product/prices are found by lookup key, the webhook endpoint by URL.
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY || '';
if (!/^(sk|rk)_test_/.test(key)) {
    console.error('Refusing to run: STRIPE_SECRET_KEY must be a test key (sk_test_…).');
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

// Customer portal: payment method, invoices, seat interval switch, cancel at period end.
const configs = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
const portalFeatures = {
    customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name', 'tax_id'] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        // Interval switch for single-item subscriptions; the AI add-on quantity is managed in the app.
        products: [{ product: productIds.team, prices: [prices.team_monthly, prices.team_yearly] }],
    },
};
const portalParams = {
    business_profile: { headline: 'ProjectFlow – Abrechnung / Billing' },
    default_return_url: `${APP_URL}/?openSettings=billing`,
    features: portalFeatures,
};
if (configs.data[0]) {
    await stripe.billingPortal.configurations.update(configs.data[0].id, portalParams);
    console.log('Updated portal configuration', configs.data[0].id);
} else {
    const config = await stripe.billingPortal.configurations.create(portalParams);
    console.log('Created portal configuration', config.id);
}

const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
const endpoint = endpoints.data.find((e) => e.url === WEBHOOK_URL);
if (endpoint) {
    await stripe.webhookEndpoints.update(endpoint.id, { enabled_events: EVENTS });
    console.log('Webhook endpoint exists', endpoint.id, '(secret unchanged; roll it in the dashboard if lost)');
} else {
    const created = await stripe.webhookEndpoints.create({ url: WEBHOOK_URL, enabled_events: EVENTS, description: 'ProjectFlow billing' });
    console.log('Created webhook endpoint', created.id);
    console.log('\nSet the signing secret (not printed to logs elsewhere):');
    console.log(`  printf %s '${created.secret}' | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --data-file=-`);
}
console.log('\nPrices:', prices);
