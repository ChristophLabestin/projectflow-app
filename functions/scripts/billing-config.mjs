// Sets billing_public/config (client signal, brain/plans/billing-entitlements-contract.md §2).
// Run once the Stripe functions are deployed with a test key:
//   node functions/scripts/billing-config.mjs --checkout on    (or off)
// Uses Application Default Credentials (gcloud auth application-default login).
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const idx = process.argv.indexOf('--checkout');
const value = process.argv[idx + 1];
if (idx === -1 || !['on', 'off'].includes(value)) {
    console.error('Usage: node functions/scripts/billing-config.mjs --checkout on|off');
    process.exit(1);
}
initializeApp({ credential: applicationDefault(), projectId: process.env.GCLOUD_PROJECT || 'projectflow-labestin' });
await getFirestore().doc('billing_public/config').set({
    checkoutAvailable: value === 'on',
    mode: 'test',
    updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
console.log(`billing_public/config.checkoutAvailable = ${value === 'on'}`);
