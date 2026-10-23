#!/usr/bin/env node
// E2E for the admin console gateway `adminApi` against the emulators of scripts/dev-admin.sh
// (ADMIN_DEV_SERVER=0 bash scripts/dev-admin.sh). Covers the negative paths: normal users, claim without
// allowlist, admin without second factor, foreign/ended sessions — all via the callable directly.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const AUTH = process.env.AUTH_HOST || '127.0.0.1:9841';
const FIRESTORE = process.env.FIRESTORE_HOST || '127.0.0.1:8841';
const FUNCTIONS = process.env.FUNCTIONS_URL || 'http://127.0.0.1:5841/demo-projectflow/europe-west3';
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE;
admin.initializeApp({ projectId: 'demo-projectflow' });

const results = [];
const check = async (label, fn) => {
    try { await fn(); results.push({ label, ok: true }); } catch (error) { results.push({ label, ok: false, error: error.message }); }
};

const ensureUser = async (email, password, claims, allowlisted) => {
    let user;
    try { user = await admin.auth().getUserByEmail(email); } catch { user = await admin.auth().createUser({ email, password, emailVerified: true }); }
    await admin.auth().setCustomUserClaims(user.uid, claims);
    const ref = admin.firestore().collection('platform_admins').doc(user.uid);
    if (allowlisted) await ref.set({ email, active: true }); else await ref.delete();
    return user.uid;
};

const signIn = async (email, password) => {
    const res = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const body = await res.json();
    if (!body.idToken) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(body)}`);
    return body.idToken;
};

const call = async (idToken, action, params = {}, sessionId = null) => {
    const res = await fetch(`${FUNCTIONS}/adminApi`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(idToken ? { authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ data: { action, params, sessionId } }),
    });
    const body = await res.json();
    return body.error ? { error: body.error.details?.reason || body.error.status } : { result: body.result };
};

const refused = async (promise, reason) => {
    const out = await promise;
    assert.ok(out.error, `expected refusal ${reason}, got result`);
    assert.equal(out.error, reason);
};

await ensureUser('claimonly@projectflow.test', 'pf-claimonly-e2e', { platformAdmin: true, adminMfaTest: true }, false);
await ensureUser('nomfa@projectflow.test', 'pf-nomfa-e2e', { platformAdmin: true }, true);
await ensureUser('wrongmail@projectflow.test', 'pf-wrongmail-e2e', { platformAdmin: true, adminMfaTest: true }, false)
    .then((uid) => admin.firestore().collection('platform_admins').doc(uid).set({ email: 'someone-else@projectflow.test', active: true }));

const outsider = await signIn('outsider@projectflow.test', 'pf-outsider-e2e');
const claimOnly = await signIn('claimonly@projectflow.test', 'pf-claimonly-e2e');
const noMfa = await signIn('nomfa@projectflow.test', 'pf-nomfa-e2e');
const wrongMail = await signIn('wrongmail@projectflow.test', 'pf-wrongmail-e2e');
const adminToken = await signIn('demo@projectflow.test', 'projectflow-demo');

await check('anonymous call is refused', () => refused(call(null, 'session.start'), 'unauthenticated'));
await check('normal user cannot start a session', () => refused(call(outsider, 'session.start'), 'not-admin'));
await check('normal user cannot read crashes directly', () => refused(call(outsider, 'crashes.list', {}, 'guess'), 'not-admin'));
await check('normal user cannot read the audit log', () => refused(call(outsider, 'audit.list'), 'not-admin'));
await check('claim without allowlist entry is refused', () => refused(call(claimOnly, 'session.start'), 'not-allowlisted'));
await check('allowlist entry with other email is refused', () => refused(call(wrongMail, 'session.start'), 'not-allowlisted'));
await check('admin without second factor is refused', () => refused(call(noMfa, 'session.start'), 'mfa-required'));

let sessionId = null;
await check('admin starts a session', async () => {
    const out = await call(adminToken, 'session.start');
    assert.ok(out.result?.sessionId, JSON.stringify(out));
    sessionId = out.result.sessionId;
});
await check('admin call without session is refused', () => refused(call(adminToken, 'crashes.list'), 'session-missing'));
await check('admin call with foreign session id is refused', () => refused(call(adminToken, 'crashes.list', {}, 'not-the-session'), 'session-missing'));
await check('admin lists crashes', async () => {
    const out = await call(adminToken, 'crashes.list', { days: 14 }, sessionId);
    assert.ok(Array.isArray(out.result?.issues), JSON.stringify(out));
    assert.ok(out.result.issues.length >= 1, 'seeded crash issues expected');
});
await check('admin triages a crash (audited)', async () => {
    const list = await call(adminToken, 'crashes.list', {}, sessionId);
    const id = list.result.issues[0].id;
    const out = await call(adminToken, 'crashes.setStatus', { id, status: 'ignored' }, sessionId);
    assert.equal(out.result?.ok, true, JSON.stringify(out));
    const audit = await call(adminToken, 'audit.list', { limit: 20 }, sessionId);
    assert.ok(audit.result.entries.some((e) => e.action === 'crashes.setStatus' && e.target === `crashIssues/${id}`), 'audit entry expected');
    assert.ok(audit.result.entries.some((e) => e.action === 'session.start'), 'session.start audited');
    assert.ok(audit.result.entries.some((e) => e.action === 'refused:session.start' && e.error === 'mfa-required'), 'refusal of an admin audited');
});
await check('admin reads legal overview', async () => {
    const out = await call(adminToken, 'legal.overview', {}, sessionId);
    assert.ok(Array.isArray(out.result?.documents), JSON.stringify(out));
});
await check('invalid input is rejected', async () => {
    const out = await call(adminToken, 'crashes.setStatus', { id: 'x', status: 'deleted' }, sessionId);
    assert.equal(out.error, 'INVALID_ARGUMENT');
});
await check('unknown action is rejected', async () => {
    const out = await call(adminToken, 'users.impersonate', {}, sessionId);
    assert.equal(out.error, 'NOT_FOUND');
});
await check('idle session expires server-side', async () => {
    const ref = admin.firestore().collection('admin_sessions').doc((await admin.auth().getUserByEmail('demo@projectflow.test')).uid);
    const lastSeen = (await ref.get()).get('lastSeenAt');
    await ref.update({ lastSeenAt: admin.firestore.Timestamp.fromMillis(Date.now() - 31 * 60_000) });
    await refused(call(adminToken, 'crashes.list', {}, sessionId), 'session-expired');
    await ref.update({ lastSeenAt: lastSeen });
});
await check('ended session is refused', async () => {
    const out = await call(adminToken, 'session.end', {}, sessionId);
    assert.equal(out.result?.ok, true);
    await refused(call(adminToken, 'crashes.list', {}, sessionId), 'session-missing');
});
await check('revoked tokens are refused', async () => {
    const uid = (await admin.auth().getUserByEmail('nomfa@projectflow.test')).uid;
    await admin.auth().setCustomUserClaims(uid, { platformAdmin: true, adminMfaTest: true });
    const fresh = await signIn('nomfa@projectflow.test', 'pf-nomfa-e2e');
    await new Promise((r) => setTimeout(r, 1100));
    await admin.auth().revokeRefreshTokens(uid);
    await refused(call(fresh, 'session.start'), 'revoked');
});

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : `  -> ${r.error}`}`));
console.log(`\n${results.length - failed.length}/${results.length} admin console E2E checks passed.`);
process.exit(failed.length ? 1 : 0);
