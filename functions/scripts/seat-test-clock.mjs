// Stripe TEST-mode test-clock run for seat management (contract §9). Uses the real core functions from
// lib/billing-seats.js against throwaway customers; cleans up afterwards. Build first (npm run build).
//   node functions/scripts/seat-test-clock.mjs
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'projectflow-labestin';
const key = execFileSync('gcloud', ['secrets', 'versions', 'access', 'latest', '--secret=STRIPE_SECRET_KEY', `--project=${process.env.GCLOUD_PROJECT}`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
if (!/^(sk|rk)_test_/.test(key)) throw new Error('not a test key');
process.env.STRIPE_SECRET_KEY = key;
const Stripe = require('stripe');
const stripe = new Stripe(key);
const { previewSeatChangeFor, applySeatChangeFor } = require('../lib/billing-seats.js');

const DAY = 86400;
const limits = (members, assigned = 0) => ({ minSeats: members, maxSeats: 50, minAiSeats: assigned, maxAiSeats: 50 });
const eur = (cents) => `${(cents / 100).toFixed(2)} €`;
const results = [];
const check = (label, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${info ? `  (${info})` : ''}`); };

const advance = async (clock, to) => {
    await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: to });
    for (let i = 0; i < 60; i += 1) {
        const state = await stripe.testHelpers.testClocks.retrieve(clock.id);
        if (state.status === 'ready') return;
        await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('test clock did not become ready');
};

const prices = Object.fromEntries((await stripe.prices.list({ lookup_keys: ['team_monthly', 'ai_addon_monthly'], active: true })).data
    .map((p) => [p.lookup_key, p.id]));
const start = Math.floor(Date.UTC(2026, 9, 5, 12) / 1000); // purchase on the 5th
const clocks = [];

try {
    // --- Case A: 2 seats bought on the 5th, +1 seat at half period, then reduce to 2 at period end ---
    const clockA = await stripe.testHelpers.testClocks.create({ frozen_time: start, name: 'seats-A' });
    clocks.push(clockA);
    const custA = await stripe.customers.create({ test_clock: clockA.id, payment_method: 'pm_card_visa', invoice_settings: { default_payment_method: 'pm_card_visa' } });
    const subA = await stripe.subscriptions.create({ customer: custA.id, items: [{ price: prices.team_monthly, quantity: 2 }] });
    check('A: subscription active with 2 seats', subA.status === 'active');
    const anchor = new Date(subA.items.data[0].current_period_end * 1000).toISOString().slice(0, 10);
    check('A: billing anchor = purchase date (next renewal on the 5th)', anchor.endsWith('-05'), anchor);

    const mid = start + 15 * DAY + DAY / 2; // half of a 31-day October period
    await advance(clockA, mid);
    const preview = await previewSeatChangeFor(stripe, subA.id, { seats: 3 }, limits(2));
    check('A: preview +1 seat ≈ half a month (≈ 6 €)', preview.amountToday > 500 && preview.amountToday < 700,
        `today ${eur(preview.amountToday)}, then ${eur(preview.nextAmount)}/month`);
    const inc = await applySeatChangeFor(stripe, subA.id, { seats: 3 }, limits(2));
    const afterInc = await stripe.subscriptions.retrieve(subA.id);
    check('A: +1 seat charged now and active', inc.status === 'applied' && afterInc.items.data[0].quantity === 3, `paid ${eur(inc.amountPaid)}`);

    let blocked = false;
    try { await applySeatChangeFor(stripe, subA.id, { seats: 1 }, limits(2)); } catch (e) { blocked = String(e.message).includes('plan-seats-below-members'); }
    check('A: cannot reduce below active members', blocked);

    const dec = await applySeatChangeFor(stripe, subA.id, { seats: 2 }, limits(2));
    const stillThree = (await stripe.subscriptions.retrieve(subA.id)).items.data[0].quantity === 3;
    check('A: reduction scheduled for period end, seats stay usable until then', dec.status === 'scheduled' && stillThree,
        new Date(dec.effectiveAt).toISOString().slice(0, 10));

    await advance(clockA, afterInc.items.data[0].current_period_end + DAY);
    const renewed = await stripe.subscriptions.retrieve(subA.id);
    const lastInvoice = (await stripe.invoices.list({ customer: custA.id, limit: 1 })).data[0];
    check('A: after renewal 2 seats, invoiced 2 × 12 € without refund', renewed.items.data[0].quantity === 2 && lastInvoice.total === 2400,
        `invoice ${eur(lastInvoice.total)}`);

    // --- Case B: AI add-on seat added mid-period, then removed at period end ---
    const incAi = await applySeatChangeFor(stripe, subA.id, { aiAddonSeats: 1 }, limits(2));
    const withAi = await stripe.subscriptions.retrieve(subA.id);
    check('B: AI seat added and charged prorated', incAi.status === 'applied' && withAi.items.data.length === 2, `paid ${eur(incAi.amountPaid)}`);
    const decAi = await applySeatChangeFor(stripe, subA.id, { aiAddonSeats: 0 }, limits(2));
    check('B: AI seat removal scheduled for period end', decAi.status === 'scheduled');
    const cancel = await applySeatChangeFor(stripe, subA.id, { aiAddonSeats: 1 }, limits(2));
    check('B: same quantity again cancels the pending removal', cancel.status === 'scheduled-change-cancelled');

    // --- Case C: card that fails on charge (4000 0000 0000 0341) ---
    const clockC = await stripe.testHelpers.testClocks.create({ frozen_time: start, name: 'seats-C' });
    clocks.push(clockC);
    const custC = await stripe.customers.create({ test_clock: clockC.id, payment_method: 'pm_card_visa', invoice_settings: { default_payment_method: 'pm_card_visa' } });
    const subC = await stripe.subscriptions.create({ customer: custC.id, items: [{ price: prices.team_monthly, quantity: 2 }] });
    const failing = await stripe.paymentMethods.attach('pm_card_chargeCustomerFail', { customer: custC.id });
    await stripe.customers.update(custC.id, { invoice_settings: { default_payment_method: failing.id } });
    await stripe.subscriptions.update(subC.id, { default_payment_method: failing.id });
    await advance(clockC, start + 10 * DAY);
    const incFail = await applySeatChangeFor(stripe, subC.id, { seats: 3 }, limits(2));
    const afterFail = await stripe.subscriptions.retrieve(subC.id);
    check('C: failed payment → seats unchanged, clear status with invoice link',
        incFail.status === 'payment-required' && afterFail.items.data[0].quantity === 2 && Boolean(incFail.hostedInvoiceUrl));
} finally {
    for (const clock of clocks) await stripe.testHelpers.testClocks.del(clock.id).catch(() => undefined);
}
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} seat checks passed.`);
process.exitCode = failed ? 1 : 0;
process.exit();
