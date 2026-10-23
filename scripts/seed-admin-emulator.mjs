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

// AI usage, MCP grants and an iOS device for the overview / user detail.
const demo = await admin.auth().getUserByEmail('demo@projectflow.test');
const tenantId = (await db.collectionGroup('members').where('uid', '==', demo.uid).limit(1).get()).docs[0]?.ref.parent.parent?.id || 'unknown';
const month = new Date().toISOString().slice(0, 7);
for (let d = 0; d < 20; d++) {
    const day = new Date(now - d * DAY).toISOString().slice(0, 10);
    await db.doc(`ai_usage_quotas/${demo.uid}_${day}`).set({ uid: demo.uid, day, text: (d * 7) % 23 + 2, image: d % 4, updatedAt: admin.firestore.Timestamp.now() });
}
await db.doc(`ai_usage_quotas/${demo.uid}_${month}`).set({ uid: demo.uid, month, tokens: 412_000, images: 18, updatedAt: admin.firestore.Timestamp.now() });
await db.collection('ai_grants').doc('seed-grant-claude').set({ uid: demo.uid, tenantId, kind: 'oauth', clientName: 'Claude', clientDocId: 'cimd_seed', scopes: ['tasks:read', 'tasks:write'], resource: 'https://app.getprojectflow.com/mcp', revokedAt: null, createdAt: admin.firestore.Timestamp.fromMillis(now - 5 * DAY), updatedAt: admin.firestore.Timestamp.now(), lastUsedAt: admin.firestore.Timestamp.fromMillis(now - 3_600_000) });
await db.collection('ai_grants').doc('seed-grant-pat').set({ uid: demo.uid, tenantId, kind: 'personal-token', clientName: 'CLI', tokenPrefix: 'pfp_ab12', scopes: ['projects:read'], revokedAt: null, createdAt: admin.firestore.Timestamp.fromMillis(now - 9 * DAY), updatedAt: admin.firestore.Timestamp.now(), lastUsedAt: null });
await db.collection('ai_tokens').doc('seed-token-claude').set({ type: 'access', grantId: 'seed-grant-claude', uid: demo.uid, tenantId, scopes: ['tasks:read'], expireAt: admin.firestore.Timestamp.fromMillis(now + DAY) });
await db.doc(`users/${demo.uid}/devices/seed-iphone`).set({ platform: 'ios', fcmToken: 'seed', appVersion: '1.0', locale: 'de_DE', timezone: 'Europe/Berlin', updatedAt: admin.firestore.Timestamp.now() });
await db.doc('newsletter_subscribers/lead@example.com').set({ email: 'lead@example.com', status: 'active', source: 'landing_page', subscribedAt: admin.firestore.Timestamp.fromMillis(now - 2 * DAY) });
console.log('Seeded AI usage, 2 MCP grants, 1 device, 1 subscriber.');
