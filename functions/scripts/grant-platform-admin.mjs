#!/usr/bin/env node
// Grants (or revokes) the `platformAdmin` custom claim that unlocks the onboarding
// insights (callable getOnboardingStats, web route /insights/onboarding).
//
// Usage: node scripts/grant-platform-admin.mjs <email> [--revoke]
// Uses application default credentials (gcloud auth application-default login).
// The user must sign out/in (or refresh the ID token) for the claim to apply.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'projectflow-labestin';
const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const email = args.find((arg) => !arg.startsWith('--'));

if (!email) {
    console.error('Usage: node scripts/grant-platform-admin.mjs <email> [--revoke]');
    process.exit(1);
}

admin.initializeApp(process.env.FIREBASE_AUTH_EMULATOR_HOST
    ? { projectId: PROJECT_ID }
    : { projectId: PROJECT_ID, credential: admin.credential.applicationDefault() });

const user = await admin.auth().getUserByEmail(email);
const claims = { ...(user.customClaims || {}) };
if (revoke) delete claims.platformAdmin;
else claims.platformAdmin = true;

await admin.auth().setCustomUserClaims(user.uid, claims);
console.log(`${revoke ? 'Revoked' : 'Granted'} platformAdmin for ${email} (uid ${user.uid}) in ${PROJECT_ID}.`);
console.log(`Claims now: ${JSON.stringify(claims)}`);
console.log('The user must sign in again (or refresh the ID token) for this to take effect.');
