#!/usr/bin/env node
// E2E for the admin MCP (functions/src/admin-console/mcp) against `ADMIN_DEV_SERVER=0 bash scripts/dev-admin.sh`.
// Happy path (DCR → authorize → consent → token → tools, two-step write) and every refusal the brief lists.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const AUTH = process.env.AUTH_HOST || '127.0.0.1:9841';
const FN = process.env.FUNCTIONS_URL || 'http://127.0.0.1:5841/demo-projectflow/europe-west3';
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_HOST || '127.0.0.1:8841';
admin.initializeApp({ projectId: 'demo-projectflow' });
const db = admin.firestore();

const results = [];
const check = async (label, fn) => { try { await fn(); results.push({ label, ok: true }); } catch (e) { results.push({ label, ok: false, error: e.message }); } };

const signIn = async (email, password) => {
    const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    const b = await r.json();
    if (!b.idToken) throw new Error(`sign-in ${email}: ${JSON.stringify(b)}`);
    return b.idToken;
};
const api = async (idToken, action, params = {}, sessionId = null) => {
    const r = await fetch(`${FN}/adminApi`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` }, body: JSON.stringify({ data: { action, params, sessionId } }) });
    const b = await r.json();
    return b.error ? { error: b.error.details?.reason || b.error.message || b.error.status } : { result: b.result };
};
const oauth = (path, init) => fetch(`${FN}/adminOAuth${path}`, { redirect: 'manual', ...init });
const form = (body) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
const mcp = async (token, method, params = {}) => {
    const r = await fetch(`${FN}/adminMcp`, { method: 'POST', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const text = await r.text();
    const data = text.startsWith('event:') || text.startsWith('data:') ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('') : text;
    let body = null; try { body = JSON.parse(data); } catch { body = null; }
    return { status: r.status, body };
};
const toolText = (out) => out.body?.result?.content?.[0]?.text || '';

const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const REDIRECT = 'http://localhost:53682/callback';

const adminToken = await signIn('demo@projectflow.test', 'projectflow-demo');
const outsider = await signIn('outsider@projectflow.test', 'pf-outsider-e2e');
const session = await api(adminToken, 'session.start');
const sid = session.result.sessionId;
await db.doc('admin_config/mcp').set({ enabled: false });

let clientId = null;
await check('kill switch off: registration refused', async () => {
    const r = await oauth('/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Claude Code', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' }) });
    assert.equal(r.status, 403);
});
await check('admin switches the admin MCP on (audited)', async () => assert.equal((await api(adminToken, 'mcp.setEnabled', { enabled: true }, sid)).result?.ok, true));
await check('normal user cannot switch the admin MCP', async () => assert.equal((await api(outsider, 'mcp.setEnabled', { enabled: true }, 'x')).error, 'not-admin'));
await check('foreign redirect URI cannot register', async () => {
    const r = await oauth('/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Evil', redirect_uris: ['https://evil.example/api/mcp/auth_callback'], token_endpoint_auth_method: 'none' }) });
    assert.equal(r.status, 400);
});
await check('confidential clients are refused', async () => {
    const r = await oauth('/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'X', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'client_secret_post' }) });
    assert.equal(r.status, 400);
});
await check('Claude Code registers as pending client', async () => {
    const r = await oauth('/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Claude Code', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' }) });
    assert.equal(r.status, 201);
    clientId = (await r.json()).client_id;
    assert.equal((await db.doc(`admin_mcp_clients/${clientId}`).get()).get('status'), 'pending');
});
await check('DCR flood guard: pending cap, then stale pending clients expire', async () => {
    const reg = () => oauth('/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify({ client_name: 'Flood', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' }) });
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await reg()).status);
    assert.ok(statuses.includes(429), `spoofed IPs must not bypass the cap: ${statuses}`);
    const pending = (await db.collection('admin_mcp_clients').where('status', '==', 'pending').count().get()).data().count;
    assert.ok(pending <= 5, `pending=${pending}`);
    const old = await db.collection('admin_mcp_clients').where('status', '==', 'pending').get();
    for (const d of old.docs) if (d.id !== clientId) await d.ref.update({ expireAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1000) });
    assert.equal((await reg()).status, 201, 'stale pending clients are cleaned up');
    const left = (await db.collection('admin_mcp_clients').where('status', '==', 'pending').count().get()).data().count;
    assert.ok(left <= 2, `left=${left}`);
});
const authorize = (redirect = REDIRECT, extra = {}) => oauth(`/oauth/authorize?${new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state: 's1', scope: 'admin:read admin:write', ...extra })}`);
await check('authorize with unregistered redirect is refused', async () => assert.equal((await authorize('http://evil.example/cb')).status, 400));
await check('authorize without PKCE is refused', async () => {
    const r = await authorize(REDIRECT, { code_challenge_method: 'plain' });
    assert.equal(r.status, 302);
    assert.match(r.headers.get('location'), /error=invalid_request/);
});
let requestId = null;
await check('authorize parks the request and sends to the console consent', async () => {
    const r = await authorize();
    assert.equal(r.status, 302);
    const loc = new URL(r.headers.get('location'));
    assert.equal(loc.pathname, '/oauth/consent');
    requestId = loc.searchParams.get('request');
    assert.ok(requestId);
});
await check('normal user cannot approve the consent', async () => assert.equal((await api(outsider, 'mcp.consent.approve', { requestId, approveClient: true }, 'x')).error, 'not-admin'));
await check('admin without second factor cannot approve', async () => {
    const uid = (await admin.auth().getUserByEmail('nomfa@projectflow.test').catch(() => null))?.uid;
    if (!uid) await admin.auth().createUser({ email: 'nomfa@projectflow.test', password: 'pf-nomfa-e2e', emailVerified: true });
    const u = await admin.auth().getUserByEmail('nomfa@projectflow.test');
    await admin.auth().setCustomUserClaims(u.uid, { platformAdmin: true });
    await db.doc(`platform_admins/${u.uid}`).set({ email: 'nomfa@projectflow.test', active: true });
    const t = await signIn('nomfa@projectflow.test', 'pf-nomfa-e2e');
    assert.equal((await api(t, 'mcp.consent.approve', { requestId, approveClient: true }, 'x')).error, 'mfa-required');
    await db.doc(`platform_admins/${u.uid}`).delete();
});
await check('pending client needs explicit approval', async () => assert.match((await api(adminToken, 'mcp.consent.approve', { requestId, scopes: ['admin:read'] }, sid)).error || '', /freigegeben/));
let code = null;
await check('admin approves (client + read/write) and gets the redirect with code', async () => {
    const out = await api(adminToken, 'mcp.consent.approve', { requestId, scopes: ['admin:read', 'admin:write'], approveClient: true }, sid);
    const url = new URL(out.result.redirectUrl);
    code = url.searchParams.get('code');
    assert.equal(url.searchParams.get('state'), 's1');
    assert.ok(code);
});
let tokens = null;
await check('token exchange refuses a wrong PKCE verifier', async () => {
    const r = await oauth('/oauth/token', form({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: 'x'.repeat(43) }));
    assert.equal(r.status, 400);
});
await check('used code cannot be replayed (grant revoked) — fresh flow afterwards', async () => {
    const r = await oauth('/oauth/token', form({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: verifier }));
    assert.equal(r.status, 400); // first attempt above consumed the code
    const a = await authorize();
    const rid = new URL(a.headers.get('location')).searchParams.get('request');
    const out = await api(adminToken, 'mcp.consent.approve', { requestId: rid, scopes: ['admin:read', 'admin:write'] }, sid);
    code = new URL(out.result.redirectUrl).searchParams.get('code');
    const t = await oauth('/oauth/token', form({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: verifier }));
    assert.equal(t.status, 200);
    tokens = await t.json();
    assert.match(tokens.access_token, /^pfa_/);
    assert.ok(tokens.expires_in <= 900);
});
await check('no token / user MCP token / garbage are refused', async () => {
    assert.equal((await mcp(null, 'tools/list')).status, 401);
    assert.equal((await mcp('pfo_' + 'a'.repeat(43), 'tools/list')).status, 401);
    assert.equal((await mcp('pfat_whatever', 'tools/list')).status, 401);
});
await check('admin token is useless on the user MCP', async () => {
    const r = await fetch(`${FN}/mcpServer`, { method: 'POST', headers: { authorization: `Bearer ${tokens.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) });
    assert.equal(r.status, 401);
});
await check('admin token lists and calls read tools', async () => {
    const list = await mcp(tokens.access_token, 'tools/list');
    assert.equal(list.status, 200, JSON.stringify(list.body).slice(0, 200));
    const names = list.body.result.tools.map((t) => t.name);
    assert.ok(names.includes('overview') && names.includes('set_workspace_suspended'));
    assert.equal(list.body.result.tools.find((t) => t.name === 'set_workspace_suspended').annotations.destructiveHint, true);
    const ov = await mcp(tokens.access_token, 'tools/call', { name: 'overview', arguments: {} });
    assert.match(toolText(ov), /"users"/);
});
await check('write tool needs the console code (wrong code, then right code)', async () => {
    const issues = await mcp(tokens.access_token, 'tools/call', { name: 'list_crashes', arguments: {} });
    const id = JSON.parse(toolText(issues)).issues[0].id;
    const first = await mcp(tokens.access_token, 'tools/call', { name: 'set_crash_status', arguments: { id, status: 'resolved' } });
    const pendingId = JSON.parse(toolText(first)).pendingId;
    assert.ok(pendingId);
    assert.equal((await db.doc(`crashIssues/${id}`).get()).get('status') === 'resolved', false, 'no effect before confirmation');
    const wrong = await mcp(tokens.access_token, 'tools/call', { name: 'set_crash_status', arguments: { id, status: 'resolved', pendingId, confirmationCode: '000000' } });
    assert.equal(wrong.body.result.isError, true);
    const status = await api(adminToken, 'mcp.status', {}, sid);
    const codeShown = status.result.pending.find((p) => p.id === pendingId).code;
    const ok = await mcp(tokens.access_token, 'tools/call', { name: 'set_crash_status', arguments: { id, status: 'resolved', pendingId, confirmationCode: codeShown } });
    assert.match(toolText(ok), /"done"/);
    assert.equal((await db.doc(`crashIssues/${id}`).get()).get('status'), 'resolved');
});
await check('refresh rotates; reuse of the old refresh token revokes the connection', async () => {
    const r1 = await oauth('/oauth/token', form({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId }));
    assert.equal(r1.status, 200);
    const t2 = await r1.json();
    const reuse = await oauth('/oauth/token', form({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId }));
    assert.equal(reuse.status, 400);
    assert.equal((await mcp(t2.access_token, 'tools/list')).status, 401);
});
const freshTokens = async () => {
    const a = await authorize();
    const rid = new URL(a.headers.get('location')).searchParams.get('request');
    const out = await api(adminToken, 'mcp.consent.approve', { requestId: rid, scopes: ['admin:read'] }, sid);
    const c = new URL(out.result.redirectUrl).searchParams.get('code');
    return (await oauth('/oauth/token', form({ grant_type: 'authorization_code', code: c, redirect_uri: REDIRECT, client_id: clientId, code_verifier: verifier }))).json();
};
await check('read-only connection cannot use write tools', async () => {
    const t = await freshTokens();
    const out = await mcp(t.access_token, 'tools/call', { name: 'set_crash_status', arguments: { id: 'x', status: 'open' } });
    assert.match(toolText(out), /read-only/);
});
await check('removed allowlist entry stops an existing token immediately', async () => {
    const t = await freshTokens();
    const uid = (await admin.auth().getUserByEmail('demo@projectflow.test')).uid;
    const entry = (await db.doc(`platform_admins/${uid}`).get()).data();
    await db.doc(`platform_admins/${uid}`).delete();
    assert.equal((await mcp(t.access_token, 'tools/list')).status, 403);
    await db.doc(`platform_admins/${uid}`).set(entry);
    assert.equal((await mcp(t.access_token, 'tools/list')).status, 200);
});
await check('kill switch stops an existing token', async () => {
    const t = await freshTokens();
    await db.doc('admin_config/mcp').set({ enabled: false });
    assert.equal((await mcp(t.access_token, 'tools/list')).status, 503);
    await db.doc('admin_config/mcp').set({ enabled: true });
});
await check('revoked client stops its tokens and cannot authorize again', async () => {
    const t = await freshTokens();
    assert.equal((await api(adminToken, 'mcp.setClientStatus', { clientId, status: 'revoked' }, sid)).result?.ok, true);
    assert.equal((await mcp(t.access_token, 'tools/list')).status, 401);
    assert.equal((await authorize()).status, 400);
});

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : `  -> ${r.error}`}`));
console.log(`\n${results.length - failed.length}/${results.length} admin MCP E2E checks passed.`);
process.exit(failed.length ? 1 : 0);
