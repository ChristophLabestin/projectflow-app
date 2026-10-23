// Backfill: a personal workspace (personal_{uid}, Free) for every account (billing contract §7). Idempotent.
// Build first (npm run build). Dry run is the default; --apply writes.
//   Emulator: firebase emulators:exec --only auth,firestore --project demo-projectflow \
//               --config scripts/firebase.personal-test.json "node scripts/personal-workspaces.mjs --seed-test --apply"
//   Prod (only after the orchestrator/owner approves):
//     GCLOUD_PROJECT=projectflow-labestin node functions/scripts/personal-workspaces.mjs            (dry run)
//     GCLOUD_PROJECT=projectflow-labestin node functions/scripts/personal-workspaces.mjs --apply
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const { db } = require('../lib/init.js');
const { createPersonalWorkspace } = require('../lib/billing.js');

const apply = process.argv.includes('--apply');

if (process.argv.includes('--seed-test')) {
    if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('--seed-test only against the emulator');
    for (const [uid, email] of [['u1', 'one@projectflow.test'], ['u2', 'two@projectflow.test']]) {
        await admin.auth().createUser({ uid, email, displayName: uid }).catch(() => undefined);
    }
    // u2 already has its personal workspace (idempotency check).
    await createPersonalWorkspace('u2', 'de');
}

const users = [];
let pageToken;
do {
    const page = await admin.auth().listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
} while (pageToken);

const missing = [];
for (const user of users) {
    const exists = (await db.doc(`tenants/personal_${user.uid}`).get()).exists;
    if (!exists) missing.push(user);
}
console.log(JSON.stringify({ accounts: users.length, missing: missing.length, apply }));
for (const user of missing) {
    const profile = (await db.doc(`users/${user.uid}`).get()).data() || {};
    const language = profile.language === 'en' ? 'en' : 'de';
    if (apply) {
        const result = await createPersonalWorkspace(user.uid, language);
        console.log(JSON.stringify({ uid: user.uid, email: user.email || null, ...result }));
    } else {
        console.log(JSON.stringify({ uid: user.uid, email: user.email || null, wouldCreate: `personal_${user.uid}` }));
    }
}
if (apply && process.env.FIRESTORE_EMULATOR_HOST) {
    const again = [];
    for (const user of users) again.push(await createPersonalWorkspace(user.uid, 'de'));
    const ent = (await db.doc('tenants/personal_u1/entitlements/plan').get()).data();
    console.log(JSON.stringify({
        secondRunCreated: again.filter((r) => r.created).length,
        u1Plan: ent?.plan, u1Type: ent?.workspaceType, u1Invites: ent?.invitesAllowed,
    }));
}
