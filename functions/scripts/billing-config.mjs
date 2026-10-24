// Sets billing_public/config (client signal, brain/plans/billing-entitlements-contract.md §2).
// Run once the Stripe functions are deployed with a test key:
//   node functions/scripts/billing-config.mjs --checkout on    (or off)
//   node functions/scripts/billing-config.mjs --publishable-key pk_test_…   (purchase page)
// Uses Application Default Credentials (gcloud auth application-default login).
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const idx = process.argv.indexOf('--checkout');
const value = idx === -1 ? undefined : process.argv[idx + 1];
const pkIdx = process.argv.indexOf('--publishable-key');
const publishableKey = pkIdx === -1 ? undefined : process.argv[pkIdx + 1];
if ((value && !['on', 'off'].includes(value)) || (!value && !publishableKey)
    || (publishableKey && !/^pk_(test|live)_/.test(publishableKey))) {
    console.error('Usage: node functions/scripts/billing-config.mjs [--checkout on|off] [--publishable-key pk_test_…]');
    process.exit(1);
}
initializeApp({ credential: applicationDefault(), projectId: process.env.GCLOUD_PROJECT || 'projectflow-labestin' });
// The publishable key is public by design (used by the Payment Element on the purchase page).
await getFirestore().doc('billing_public/config').set({
    ...(value ? { checkoutAvailable: value === 'on' } : {}),
    ...(publishableKey ? { publishableKey, mode: publishableKey.startsWith('pk_live_') ? 'live' : 'test' } : {}),
    updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
console.log('billing_public/config updated', { checkout: value ?? 'unchanged', publishableKey: publishableKey ? 'set' : 'unchanged' });
