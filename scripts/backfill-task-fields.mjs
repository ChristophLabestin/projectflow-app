#!/usr/bin/env node
// Backfills the task fields the iOS app and the "my tasks" collection-group query rely on (contract C7):
//   tenantId     <- path   (tenants/{tenantId}/projects/{projectId}/tasks/{taskId})
//   projectId    <- path
//   assigneeIds  <- legacy assigneeId; when the task has no assignee at all, [ownerId]
//                   (the web "my tasks" filter already treats an unassigned task as its owner's)
//
// Dry run by default: prints what would change and writes nothing.
//
//   node scripts/backfill-task-fields.mjs                          # dry run against production credentials (ADC)
//   node scripts/backfill-task-fields.mjs --apply                  # write
//   node scripts/backfill-task-fields.mjs --emulator               # dry run against the Firestore emulator
//   node scripts/backfill-task-fields.mjs --emulator --apply
//
// Options:
//   --apply                 actually write (default: dry run)
//   --emulator              use the Firestore emulator (FIRESTORE_EMULATOR_HOST, default 127.0.0.1:8085)
//                           and the demo project id `demo-projectflow`
//   --project <id>          Firebase/GCP project id (default: projectflow-labestin; ignored with --emulator)
//   --tenant <tenantId>     only this workspace
//   --limit <n>             stop after n tasks have been scanned
//   --skip-owner-fallback   do not assign ownerId to tasks without any assignee (only fix legacy assigneeId)
//   --help
//
// Safety: every written doc gets `backfilledAt` and `systemWriteAt`. The onTaskWritten trigger treats a
// changed `systemWriteAt` as a system write and creates no activity entries, notifications or progress
// sync for it; assignee changes are also compared on the union of assigneeIds + assigneeId, so the
// backfill never reads as "new assignee". Run it from the repo root: firebase-admin is resolved from
// functions/node_modules.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require(require.resolve('firebase-admin', { paths: [process.cwd() + '/functions/node_modules'] }));

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const getArg = (name, fallback = '') => {
    const index = args.indexOf(name);
    return index === -1 ? fallback : (args[index + 1] || fallback);
};

if (hasFlag('--help')) {
    console.log(`Usage: node scripts/backfill-task-fields.mjs [--apply] [--emulator] [--project ID] [--tenant ID] [--limit N] [--skip-owner-fallback]
Dry run unless --apply is given. See the header of this file for details.`);
    process.exit(0);
}

const APPLY = hasFlag('--apply');
const EMULATOR = hasFlag('--emulator');
const TENANT = getArg('--tenant');
const LIMIT = Number(getArg('--limit', '0')) || 0;
const OWNER_FALLBACK = !hasFlag('--skip-owner-fallback');
const PAGE_SIZE = 400;
const BATCH_SIZE = 400;

if (EMULATOR) {
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
}
const projectId = EMULATOR ? 'demo-projectflow' : getArg('--project', 'projectflow-labestin');
admin.initializeApp({ projectId });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const str = (value) => (typeof value === 'string' ? value.trim() : '');

/** Fields to add to one task doc; empty object when nothing is missing. */
const planBackfill = (path, data, ownerFallback = true) => {
    const parts = path.split('/');
    const updates = {};
    const reasons = [];

    if (!str(data.tenantId)) {
        updates.tenantId = parts[1];
        reasons.push('tenantId');
    }
    if (!str(data.projectId)) {
        updates.projectId = parts[3];
        reasons.push('projectId');
    }

    const assigneeIds = Array.isArray(data.assigneeIds) ? data.assigneeIds.filter((id) => str(id)) : [];
    const legacy = str(data.assigneeId);
    if (assigneeIds.length === 0) {
        if (legacy) {
            updates.assigneeIds = [legacy];
            reasons.push('assigneeIds<-assigneeId');
        } else if (ownerFallback && str(data.ownerId)) {
            updates.assigneeIds = [str(data.ownerId)];
            reasons.push('assigneeIds<-ownerId');
        }
    }
    return { updates, reasons };
};

const isProjectTask = (ref) => {
    const parts = ref.path.split('/');
    return parts.length === 6 && parts[0] === 'tenants' && parts[2] === 'projects' && parts[4] === 'tasks';
};

const main = async () => {
    console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} on ${EMULATOR ? `emulator ${process.env.FIRESTORE_EMULATOR_HOST}` : `project ${projectId}`}` +
        `${TENANT ? `, tenant ${TENANT}` : ''}${OWNER_FALLBACK ? '' : ', owner fallback off'}`);

    const counts = { scanned: 0, skippedOutOfScope: 0, needsUpdate: 0, tenantId: 0, projectId: 0, fromAssigneeId: 0, fromOwnerId: 0, written: 0 };
    const samples = [];
    let batch = db.batch();
    let batchSize = 0;
    let cursor = null;

    const flush = async () => {
        if (batchSize === 0) return;
        if (APPLY) await batch.commit();
        counts.written += APPLY ? batchSize : 0;
        batch = db.batch();
        batchSize = 0;
    };

    for (;;) {
        let query = db.collectionGroup('tasks').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
        if (cursor) query = query.startAfter(cursor);
        const page = await query.get();
        if (page.empty) break;

        for (const doc of page.docs) {
            cursor = doc.ref;
            if (!isProjectTask(doc.ref) || (TENANT && doc.ref.path.split('/')[1] !== TENANT)) {
                counts.skippedOutOfScope += 1;
                continue;
            }
            counts.scanned += 1;
            const { updates, reasons } = planBackfill(doc.ref.path, doc.data(), OWNER_FALLBACK);
            if (reasons.length > 0) {
                counts.needsUpdate += 1;
                if (updates.tenantId) counts.tenantId += 1;
                if (updates.projectId) counts.projectId += 1;
                if (reasons.includes('assigneeIds<-assigneeId')) counts.fromAssigneeId += 1;
                if (reasons.includes('assigneeIds<-ownerId')) counts.fromOwnerId += 1;
                if (samples.length < 10) samples.push({ path: doc.ref.path, reasons, updates });
                if (APPLY) {
                    batch.update(doc.ref, { ...updates, backfilledAt: FieldValue.serverTimestamp(), systemWriteAt: FieldValue.serverTimestamp() });
                    batchSize += 1;
                    if (batchSize >= BATCH_SIZE) await flush();
                }
            }
            if (LIMIT && counts.scanned >= LIMIT) break;
        }
        if (LIMIT && counts.scanned >= LIMIT) break;
        if (page.size < PAGE_SIZE) break;
    }
    await flush();

    if (samples.length > 0) {
        console.log('\nSample changes:');
        samples.forEach((sample) => console.log(`  ${sample.path}\n    ${sample.reasons.join(', ')} -> ${JSON.stringify(sample.updates)}`));
    }
    console.log('\nSummary:', JSON.stringify(counts));
    if (!APPLY && counts.needsUpdate > 0) console.log('Dry run only. Re-run with --apply to write these changes.');
};

main().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
});
