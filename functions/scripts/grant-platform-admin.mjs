#!/usr/bin/env node
// Grants (or revokes) platform admin access for the admin console (admin/): the `platformAdmin`
// custom claim plus the server-side allowlist entry `platform_admins/{uid}` (both are checked by adminApi).
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

const emulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
if (emulator !== Boolean(process.env.FIRESTORE_EMULATOR_HOST)) {
    console.error('Set both FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST (or neither for production).');
    process.exit(1);
}

admin.initializeApp(emulator
    ? { projectId: PROJECT_ID }
    : { projectId: PROJECT_ID, credential: admin.credential.applicationDefault() });

const user = await admin.auth().getUserByEmail(email);
const claims = { ...(user.customClaims || {}) };
if (revoke) delete claims.platformAdmin;
else claims.platformAdmin = true;
// Emulator only: the Auth emulator has no TOTP, so this claim stands in for the second factor (gate.ts).
if (emulator && !revoke && args.includes('--mfa-test')) claims.adminMfaTest = true;

await admin.auth().setCustomUserClaims(user.uid, claims);
const allowlist = admin.firestore().collection('platform_admins').doc(user.uid);
if (revoke) {
    await allowlist.delete();
    await admin.auth().revokeRefreshTokens(user.uid);
} else {
    await allowlist.set({ email: (user.email || email).toLowerCase(), active: true, grantedAt: admin.firestore.FieldValue.serverTimestamp() });
}
console.log(`Allowlist platform_admins/${user.uid}: ${revoke ? 'removed (sessions revoked)' : 'active'}.`);
if (!revoke && !(user.multiFactor?.enrolledFactors || []).length) {
    console.log('Note: no second factor enrolled yet — the admin console asks for TOTP setup on first sign-in.');
}
console.log(`${revoke ? 'Revoked' : 'Granted'} platformAdmin for ${email} (uid ${user.uid}) in ${PROJECT_ID}.`);
console.log(`Claims now: ${JSON.stringify(claims)}`);
console.log('The user must sign in again (or refresh the ID token) for this to take effect.');
