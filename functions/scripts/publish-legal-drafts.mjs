// Publishes the current legal drafts (created by import-legal-docs.mjs) as new versions — same core as the admin
// console (`publishLegalDraftCore`) plus an `admin_audit` entry. For corrections that need no new consent:
// every draft is published as `notifyOnly` without e-mail (users see an in-app notice only).
//
//   cd functions && npm run build
//   node scripts/import-legal-docs.mjs ../legal                         # files → drafts
//   GCLOUD_PROJECT=projectflow-labestin node scripts/publish-legal-drafts.mjs --production imprint privacy terms
//   (emulator: set FIRESTORE_EMULATOR_HOST, no --production)
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const types = args.filter((arg) => ['imprint', 'privacy', 'terms'].includes(arg));
if (!process.env.FIRESTORE_EMULATOR_HOST && !args.includes('--production')) {
    console.error('No FIRESTORE_EMULATOR_HOST set. To publish in production, pass --production explicitly.');
    process.exit(1);
}
if (!types.length) {
    console.error('Usage: publish-legal-drafts.mjs [--production] <imprint|privacy|terms>...');
    process.exit(1);
}

const { db } = require('../lib/init.js');
const { publishLegalDraftCore } = require('../lib/legal.js');
const { writeAudit } = require('../lib/admin-console/audit.js');

const ACTOR = 'script:publish-legal-drafts';

for (const type of types) {
    const index = db.doc(`legal_documents/${type}`);
    const draftRef = index.collection('drafts').doc('current');
    const [indexSnap, draftSnap] = await Promise.all([index.get(), draftRef.get()]);
    if (!draftSnap.exists) {
        console.log(`${type}: no draft — skipped`);
        continue;
    }
    const baseVersion = indexSnap.data()?.currentVersion ?? null;
    // A correction never asks for new consent and never mails everyone.
    await draftRef.set({ changeType: 'notifyOnly', notifyByEmail: false }, { merge: true });
    const result = await publishLegalDraftCore(db, type, ACTOR, baseVersion);
    await writeAudit(db, {
        uid: null, email: ACTOR, action: 'legal.publish', target: `legal_documents/${type}`,
        summary: `v${result.version} veröffentlicht (Basis v${baseVersion ?? '–'}, notifyOnly, ohne Mail)`, ok: true,
    });
    console.log(`${type}: v${result.version} published (notifyOnly, no mail)${result.alreadyPublished ? ' — already published' : ''}`);
}
process.exit(0);
