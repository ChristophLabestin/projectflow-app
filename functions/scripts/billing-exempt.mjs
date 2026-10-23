// Lists workspaces with billing data, or sets/removes billingExempt (internal/comp) outside the admin console.
// Prefer the admin console (audited). Build first (npm run build); uses Application Default Credentials.
//   GCLOUD_PROJECT=projectflow-labestin node functions/scripts/billing-exempt.mjs --list
//   GCLOUD_PROJECT=projectflow-labestin node functions/scripts/billing-exempt.mjs --set <tenantId> on|off
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { db } = require('../lib/init.js');
const { setBillingExempt } = require('../lib/billing.js');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
if (args[0] === '--set' && args[1] && ['on', 'off'].includes(args[2])) {
    await setBillingExempt(args[1], args[2] === 'on', 'script:billing-exempt');
    await db.collection('admin_audit').add({
        action: 'billing.exempt', target: `tenants/${args[1]}`, summary: args[2], actor: 'script:billing-exempt',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`billingExempt ${args[2]} for ${args[1]}`);
} else if (args[0] === '--list') {
    const tenants = await db.collection('tenants').get();
    for (const tenant of tenants.docs) {
        const [ent, members, projects] = await Promise.all([
            db.doc(`tenants/${tenant.id}/entitlements/plan`).get(),
            db.collection(`tenants/${tenant.id}/members`).select('role').get(),
            db.collection(`tenants/${tenant.id}/projects`).count().get(),
        ]);
        const ownerId = tenant.data().ownerId;
        const owner = ownerId ? await admin.auth().getUser(ownerId).catch(() => null) : null;
        console.log(JSON.stringify({
            id: tenant.id, name: tenant.data().name, owner: owner?.email || ownerId, members: members.size,
            projects: projects.data().count, plan: ent.data()?.plan, status: ent.data()?.status,
        }));
    }
} else {
    console.error('Usage: --list | --set <tenantId> on|off');
    process.exit(1);
}
