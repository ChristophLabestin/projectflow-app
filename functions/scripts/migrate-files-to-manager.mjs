// One-off migration (2026-10-23): give media library assets and desktop task/initiative attachments
// the file-manager fields (listed, parent, name, version …) so /files can manage them.
// Covers, icons, avatars and other system assets stay untouched. Idempotent: rows with `listed`
// are skipped. Rules: brain/plans/files-concept.md, logic: functions/src/files-logic.ts.
//
//   npm --prefix functions run build
//   node functions/scripts/migrate-files-to-manager.mjs            # dry run (default)
//   node functions/scripts/migrate-files-to-manager.mjs --apply    # write
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8811 node … --apply          # against an emulator
//
// Uses application default credentials (gcloud auth application-default login).
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const { legacyFileFields, LEGACY_ATTACHMENT_TYPES } = require('../lib/files-logic.js');

const PROJECT_ID = process.env.GCLOUD_PROJECT || (process.env.FIRESTORE_EMULATOR_HOST ? 'demo-projectflow' : 'projectflow-labestin');
const APPLY = process.argv.includes('--apply');

admin.initializeApp(process.env.FIRESTORE_EMULATOR_HOST
    ? { projectId: PROJECT_ID }
    : { projectId: PROJECT_ID, credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const nameCache = new Map();
const uploaderName = async (tenantId, uid) => {
    if (!uid) return '';
    const key = `${tenantId}/${uid}`;
    if (!nameCache.has(key)) {
        const member = await db.doc(`tenants/${tenantId}/members/${uid}`).get();
        let name = member.data()?.displayName || '';
        if (!name) name = (await db.doc(`users/${uid}`).get()).data()?.displayName || '';
        nameCache.set(key, name || member.data()?.email || '');
    }
    return nameCache.get(key);
};

const parentTitle = async (tenantId, row) => {
    if (!LEGACY_ATTACHMENT_TYPES.includes(row.entityType) || !row.projectId || !row.entityId) return '';
    const collection = row.entityType === 'task-attachment' ? 'tasks' : 'initiatives';
    const snap = await db.doc(`tenants/${tenantId}/projects/${row.projectId}/${collection}/${row.entityId}`).get();
    return snap.data()?.title || '';
};

const main = async () => {
    console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${PROJECT_ID}`);
    const totals = { tenants: 0, scanned: 0, media: 0, attachments: 0, skipped: 0 };
    const tenants = await db.collection('tenants').listDocuments();
    for (const tenantRef of tenants) {
        const snap = await tenantRef.collection('files').get();
        if (snap.empty) continue;
        totals.tenants += 1;
        let batch = db.batch();
        let pending = 0;
        for (const docSnap of snap.docs) {
            totals.scanned += 1;
            const row = docSnap.data();
            if (row.status !== 'ready') { totals.skipped += 1; continue; }
            const fields = legacyFileFields(row, {
                uploaderName: await uploaderName(tenantRef.id, row.createdBy),
                parentTitle: await parentTitle(tenantRef.id, row),
            });
            if (!fields) { totals.skipped += 1; continue; }
            if (row.module === 'media') totals.media += 1; else totals.attachments += 1;
            if (!APPLY) continue;
            batch.update(docSnap.ref, { ...fields, migratedToFilesAt: admin.firestore.FieldValue.serverTimestamp() });
            pending += 1;
            if (pending === 400) { await batch.commit(); batch = db.batch(); pending = 0; }
        }
        if (APPLY && pending) await batch.commit();
    }
    console.log(JSON.stringify(totals));
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
