// Sets the current invoice footer (INVOICE_FOOTER from billing.ts: provider details + § 19 UStG note) on every
// existing Stripe customer in billing_customers. New customers get it on creation already.
//
//   cd functions && npm run build
//   STRIPE_SECRET_KEY=… GCLOUD_PROJECT=projectflow-labestin node scripts/stripe-update-invoice-footer.mjs          # dry run
//   STRIPE_SECRET_KEY=… GCLOUD_PROJECT=projectflow-labestin node scripts/stripe-update-invoice-footer.mjs --apply
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const apply = process.argv.includes('--apply');
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
    console.error('STRIPE_SECRET_KEY is required (never commit it).');
    process.exit(1);
}

const { db } = require('../lib/init.js');
const { INVOICE_FOOTER } = require('../lib/billing.js');
const Stripe = require('stripe');
const stripe = new Stripe(key);

const customers = await db.collection('billing_customers').get();
let updated = 0;
for (const doc of customers.docs) {
    const customerId = doc.data().customerId;
    if (!customerId) continue;
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
        console.log(`${doc.id}: ${customerId} deleted in Stripe — skipped`);
        continue;
    }
    if (customer.invoice_settings?.footer === INVOICE_FOOTER) {
        console.log(`${doc.id}: ${customerId} already current`);
        continue;
    }
    if (apply) {
        await stripe.customers.update(customerId, { invoice_settings: { footer: INVOICE_FOOTER } });
        updated += 1;
    }
    console.log(`${doc.id}: ${customerId} ${apply ? 'updated' : 'would update'}`);
}
console.log(`${apply ? 'Updated' : 'Dry run —'} ${updated} of ${customers.size} customers.`);
process.exit(0);
