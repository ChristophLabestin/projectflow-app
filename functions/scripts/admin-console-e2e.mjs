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
await check('normal user cannot read user details', () => refused(call(outsider, 'users.get', { uid: 'x' }, sessionId), 'not-admin'));
await check('admin overview aggregates', async () => {
    const out = await call(adminToken, 'overview.get', { days: 30 }, sessionId);
    assert.ok(out.result?.users?.total >= 2, JSON.stringify(out).slice(0, 300));
    assert.equal(out.result.days.length, 30);
    assert.ok(out.result.ai.monthTokens > 0 && out.result.mcp.active >= 2, 'seeded AI/MCP expected');
});
await check('admin lists users and workspaces', async () => {
    const users = await call(adminToken, 'users.list', {}, sessionId);
    assert.ok(users.result?.users?.some((u) => u.email === 'outsider@projectflow.test'), JSON.stringify(users).slice(0, 200));
    const ws = await call(adminToken, 'workspaces.list', {}, sessionId);
    assert.ok(ws.result?.workspaces?.length >= 1);
    const detail = await call(adminToken, 'workspaces.get', { id: ws.result.workspaces[0].id }, sessionId);
    assert.ok(Array.isArray(detail.result?.members), JSON.stringify(detail).slice(0, 200));
});
await check('admin opens a user (audited read) and revokes their sessions', async () => {
    const uid = (await admin.auth().getUserByEmail('outsider@projectflow.test')).uid;
    const detail = await call(adminToken, 'users.get', { uid }, sessionId);
    assert.equal(detail.result?.auth?.email, 'outsider@projectflow.test', JSON.stringify(detail).slice(0, 300));
    const out = await call(adminToken, 'users.revokeSessions', { uid }, sessionId);
    assert.equal(out.result?.ok, true);
    const audit = await call(adminToken, 'audit.list', { limit: 10 }, sessionId);
    assert.ok(audit.result.entries.some((e) => e.action === 'users.get' && e.target === `users/${uid}`), 'read audited');
});
await check('admin cannot lock or revoke their own account', async () => {
    const uid = (await admin.auth().getUserByEmail('demo@projectflow.test')).uid;
    assert.equal((await call(adminToken, 'users.setDisabled', { uid, disabled: true }, sessionId)).error, 'INVALID_ARGUMENT');
    assert.equal((await call(adminToken, 'users.revokeSessions', { uid }, sessionId)).error, 'INVALID_ARGUMENT');
});
await check('admin disconnects an MCP grant (tokens deleted)', async () => {
    const out = await call(adminToken, 'users.revokeGrant', { grantId: 'seed-grant-claude' }, sessionId);
    assert.equal(out.result?.ok, true, JSON.stringify(out));
    assert.equal((await admin.firestore().doc('ai_tokens/seed-token-claude').get()).exists, false);
    assert.ok((await admin.firestore().doc('ai_grants/seed-grant-claude').get()).get('revokedAt'));
});
await check('admin exports user data', async () => {
    const uid = (await admin.auth().getUserByEmail('demo@projectflow.test')).uid;
    const out = await call(adminToken, 'users.export', { uid }, sessionId);
    assert.ok(out.result?.json?.length > 100, JSON.stringify(out).slice(0, 200));
});
await check('admin reads AI usage, grants, clients, API log and system status', async () => {
    for (const action of ['ai.overview', 'ai.grants', 'ai.clients', 'ai.audit', 'system.status']) {
        const out = await call(adminToken, action, {}, sessionId);
        assert.ok(out.result && !out.error, `${action}: ${JSON.stringify(out).slice(0, 200)}`);
    }
    const usage = await call(adminToken, 'ai.overview', { days: 30 }, sessionId);
    assert.ok(usage.result.users.length >= 1 && usage.result.month.tokens > 0);
});
await check('pricing input is validated and audited', async () => {
    assert.equal((await call(adminToken, 'system.setPricing', { usdPerMTokens: -1, usdPerImage: 0 }, sessionId)).error, 'INVALID_ARGUMENT');
    assert.equal((await call(adminToken, 'system.setPricing', { usdPerMTokens: 1.2, usdPerImage: 0.02 }, sessionId)).result?.ok, true);
});
await check('suspension needs a reason, is logged and released', async () => {
    const ws = await call(adminToken, 'workspaces.list', {}, sessionId);
    const id = ws.result.workspaces[0].id;
    assert.equal((await call(adminToken, 'workspaces.setSuspended', { id, suspended: true, reason: 'kurz' }, sessionId)).error, 'INVALID_ARGUMENT');
    assert.equal((await call(adminToken, 'workspaces.setSuspended', { id, suspended: true, reason: 'E2E: Missbrauchsmeldung' }, sessionId)).result?.ok, true);
    const detail = await call(adminToken, 'workspaces.get', { id }, sessionId);
    assert.ok(detail.result.suspendedAt && detail.result.suspensionLog.length >= 1, JSON.stringify(detail).slice(0, 200));
    assert.equal((await admin.firestore().doc(`tenants/${id}`).get()).get('suspendedReason'), 'E2E: Missbrauchsmeldung');
    assert.equal((await call(adminToken, 'workspaces.setSuspended', { id, suspended: false, reason: 'E2E: geklärt, Freigabe' }, sessionId)).result?.ok, true);
    assert.equal((await admin.firestore().doc(`tenants/${id}`).get()).get('suspendedAt'), undefined);
});
await check('announcement validates and publishes a new version', async () => {
    assert.equal((await call(adminToken, 'system.setAnnouncement', { active: true, type: 'info', text: { de: 'x', en: '' } }, sessionId)).error, 'INVALID_ARGUMENT');
    assert.equal((await call(adminToken, 'system.setAnnouncement', { active: true, type: 'info', text: { de: 'x', en: 'y' }, link: { url: 'javascript:alert(1)' } }, sessionId)).error, 'INVALID_ARGUMENT');
    const out = await call(adminToken, 'system.setAnnouncement', { active: true, type: 'maintenance', text: { de: 'Wartung heute', en: 'Maintenance today' }, endsAt: Date.now() + 3_600_000 }, sessionId);
    assert.ok(out.result?.id, JSON.stringify(out));
    const got = await call(adminToken, 'system.announcement', {}, sessionId);
    assert.equal(got.result.id, out.result.id);
});
await check('in-app AI rollout and credit limit are controlled per workspace', async () => {
    const credits = await call(adminToken, 'ai.credits', {}, sessionId);
    assert.ok(Array.isArray(credits.result?.workspaces), JSON.stringify(credits).slice(0, 200));
    const id = credits.result.workspaces[0].tenantId;
    assert.equal((await call(adminToken, 'ai.setRollout', { tenantIds: [id], inAppAi: true }, sessionId)).result?.ok, true);
    assert.equal((await call(adminToken, 'workspaces.setAiPolicy', { id, policy: { monthlyCredits: 5000 } }, sessionId)).result?.ok, true);
    assert.equal((await call(adminToken, 'workspaces.setAiPolicy', { id, policy: { monthlyCredits: -1 } }, sessionId)).error, 'INVALID_ARGUMENT');
    const after = await call(adminToken, 'ai.credits', {}, sessionId);
    const row = after.result.workspaces.find((w) => w.tenantId === id);
    assert.ok(row.inAppAi && row.limit === 5000, JSON.stringify(row));
});
await check('workspace detail shows flows and member-flow policy is switchable', async () => {
    const ws = await call(adminToken, 'workspaces.list', {}, sessionId);
    const id = ws.result.workspaces[0].id;
    const detail = await call(adminToken, 'workspaces.get', { id }, sessionId);
    assert.ok(detail.result?.flows && Array.isArray(detail.result.flows.flows), JSON.stringify(detail).slice(0, 200));
    assert.equal((await call(adminToken, 'workspaces.setFlowPolicy', { id, allowMemberFlows: false }, sessionId)).result?.ok, true);
    assert.equal((await admin.firestore().doc(`tenants/${id}`).get()).get('automationPolicy').allowMemberFlows, false);
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
