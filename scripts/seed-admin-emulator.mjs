#!/usr/bin/env node
// Extra emulator data for the admin console (scripts/dev-admin.sh): crash reports spread over 14 days.
// Emulator only — refuses to run without FIRESTORE_EMULATOR_HOST.
import { createRequire } from 'node:module';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('seed-admin-emulator: FIRESTORE_EMULATOR_HOST is required (emulator only).');
    process.exit(1);
}
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = require('firebase-admin');
const { storeCrashReport } = require('../functions/lib/crash-reports');

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-projectflow' });
const db = admin.firestore();
const DAY = 86_400_000;
const now = Date.now();

const webEvent = (type, message, fn, file) => ({
    type, message, mechanism: 'onerror', handled: false,
    frames: [{ function: fn, file: `https://app.getprojectflow.com/assets/${file}-Ab12Cd34.js`, line: 1, column: 4211, inApp: true },
             { function: 'renderWithHooks', file: 'https://app.getprojectflow.com/assets/vendor-Zz99Yy88.js', line: 1, column: 99, inApp: false }],
    route: '/project/abc/tasks',
});
const iosEvent = (type, message) => ({
    type, message, mechanism: 'signal', handled: false,
    frames: [{ image: 'ProjectFlow', offset: 123456, uuid: '0123456789ABCDEF0123456789ABCDEF', inApp: true }, { image: 'UIKitCore', offset: 99, inApp: false }],
});

const issues = [
    { platform: 'web', release: '2026.10.22', event: webEvent('TypeError', "Cannot read properties of undefined (reading 'title')", 'TaskRow', 'ProjectTasks'), perDay: [0, 1, 0, 2, 3, 1, 4, 2, 5, 3, 6, 4, 8, 7] },
    { platform: 'web', release: '2026.10.23', event: webEvent('ChunkLoadError', 'Loading chunk 812 failed.', 'loadChunk', 'index'), perDay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 2, 1] },
    { platform: 'ios', release: '1.0 (4)', event: iosEvent('EXC_BAD_ACCESS', 'KERN_INVALID_ADDRESS at 0x0000000000000010'), perDay: [0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 0, 1, 0, 1] },
    { platform: 'web', release: '2026.10.20', event: webEvent('Error', 'ResizeObserver loop completed with undelivered notifications.', 'observe', 'Board'), perDay: [2, 3, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0] },
];

let count = 0;
for (const issue of issues) {
    for (let d = 0; d < issue.perDay.length; d++) {
        for (let n = 0; n < issue.perDay[d]; n++) {
            const at = now - (issue.perDay.length - 1 - d) * DAY - n * 3_600_000;
            await storeCrashReport(db, {
                platform: issue.platform, environment: 'production', release: issue.release,
                installId: `install-${(count % 9) + 1}-seed`,
                device: issue.platform === 'ios' ? { os: 'iOS', osVersion: '26.1', model: 'iPhone17,1', locale: 'de_DE' } : { os: 'macOS', osVersion: '15.6', browser: 'Chrome 141', locale: 'de-DE' },
                events: [{ ...issue.event, id: `seed-${count}`, timestamp: at }],
            }, at);
            count++;
        }
    }
}
await db.doc('crashIssues/' + (await db.collection('crashIssues').where('type', '==', 'Error').limit(1).get()).docs[0].id).update({ status: 'resolved', resolvedRelease: '2026.10.20' });
console.log(`Seeded ${count} crash events.`);
