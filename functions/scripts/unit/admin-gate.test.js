// Unit test: admin console gate (brain/plans/admin-console-concept.md). Every refusal path, plus the happy paths.
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkAdminGate, SESSION_IDLE_MS, SESSION_MAX_MS, FRESH_LOGIN_MS } = require('../../lib/admin-console/gate');

const NOW = Date.parse('2026-10-23T12:00:00Z');
const ADMIN = { uid: 'admin', email: 'Christoph@Labestindigital.de', platformAdmin: true, auth_time: (NOW - 60_000) / 1000, firebase: { sign_in_second_factor: 'totp' } };

const deps = (over = {}) => ({
    verifyRevocation: async () => true,
    getAdminRecord: async (uid) => (uid === 'admin' ? { email: 'christoph@labestindigital.de', active: true } : null),
    getSession: async () => ({ sessionId: 's1', startedAtMs: NOW - 60_000, lastSeenAtMs: NOW - 60_000, endedAtMs: null }),
    isEmulator: false,
    now: () => NOW,
    ...over,
});

const gate = (token, mode = 'call', sessionId = 's1', d = deps()) => checkAdminGate(token, 'raw', mode, sessionId, d);

test('allowed: admin with totp starts and uses a session', async () => {
    assert.deepEqual(await gate(ADMIN, 'start', undefined), { ok: true, uid: 'admin', email: 'christoph@labestindigital.de' });
    assert.equal((await gate(ADMIN)).ok, true);
});

test('refused: no auth / no raw token', async () => {
    assert.deepEqual(await gate(undefined), { ok: false, reason: 'unauthenticated' });
    assert.deepEqual(await checkAdminGate(ADMIN, '', 'call', 's1', deps()), { ok: false, reason: 'unauthenticated' });
});

test('refused: normal user (no claim), even with totp and a session', async () => {
    const user = { ...ADMIN, uid: 'user', platformAdmin: undefined };
    assert.deepEqual(await gate(user), { ok: false, reason: 'not-admin' });
    assert.deepEqual(await gate({ ...ADMIN, platformAdmin: 'true' }), { ok: false, reason: 'not-admin' });
});

test('refused: claim without allowlist entry, inactive entry or other email', async () => {
    assert.deepEqual(await gate({ ...ADMIN, uid: 'other' }), { ok: false, reason: 'not-allowlisted' });
    assert.deepEqual(await gate(ADMIN, 'call', 's1', deps({ getAdminRecord: async () => ({ email: 'christoph@labestindigital.de', active: false }) })), { ok: false, reason: 'not-allowlisted' });
    assert.deepEqual(await gate({ ...ADMIN, email: 'evil@example.com' }), { ok: false, reason: 'not-allowlisted' });
    assert.deepEqual(await gate({ ...ADMIN, email: undefined }), { ok: false, reason: 'not-allowlisted' });
});

test('refused: no second factor; emulator stand-in only in the emulator', async () => {
    const noMfa = { ...ADMIN, firebase: {} };
    assert.deepEqual(await gate(noMfa), { ok: false, reason: 'mfa-required' });
    assert.deepEqual(await gate({ ...noMfa, adminMfaTest: true }), { ok: false, reason: 'mfa-required' });
    assert.equal((await gate({ ...noMfa, adminMfaTest: true }, 'call', 's1', deps({ isEmulator: true }))).ok, true);
});

test('refused: revoked token', async () => {
    assert.deepEqual(await gate(ADMIN, 'call', 's1', deps({ verifyRevocation: async () => false })), { ok: false, reason: 'revoked' });
});

test('refused: session start needs a fresh login', async () => {
    const stale = { ...ADMIN, auth_time: (NOW - FRESH_LOGIN_MS - 1000) / 1000 };
    assert.deepEqual(await gate(stale, 'start'), { ok: false, reason: 'login-not-fresh' });
});

test('refused: missing, foreign, ended or expired session', async () => {
    assert.deepEqual(await gate(ADMIN, 'call', 'other'), { ok: false, reason: 'session-missing' });
    assert.deepEqual(await gate(ADMIN, 'call', null), { ok: false, reason: 'session-missing' });
    assert.deepEqual(await gate(ADMIN, 'call', 's1', deps({ getSession: async () => null })), { ok: false, reason: 'session-missing' });
    assert.deepEqual(await gate(ADMIN, 'call', 's1', deps({ getSession: async () => ({ sessionId: 's1', startedAtMs: NOW, lastSeenAtMs: NOW, endedAtMs: NOW }) })), { ok: false, reason: 'session-missing' });
    assert.deepEqual(await gate(ADMIN, 'call', 's1', deps({ getSession: async () => ({ sessionId: 's1', startedAtMs: NOW - 1000, lastSeenAtMs: NOW - SESSION_IDLE_MS - 1 }) })), { ok: false, reason: 'session-expired' });
    assert.deepEqual(await gate(ADMIN, 'call', 's1', deps({ getSession: async () => ({ sessionId: 's1', startedAtMs: NOW - SESSION_MAX_MS - 1, lastSeenAtMs: NOW }) })), { ok: false, reason: 'session-expired' });
});

test('billing MRR per contract §6', () => {
    const { mrrOf, billingOf } = require('../../lib/admin-console/modules/billing');
    assert.equal(mrrOf({ status: 'active', seats: 5, aiAddonSeats: 2, billingInterval: 'month' }), 80);
    assert.equal(mrrOf({ status: 'past_due', seats: 3, aiAddonSeats: 0, billingInterval: 'year' }), 30);
    assert.equal(mrrOf({ status: 'trialing', seats: 9, billingInterval: 'month' }), 0);
    assert.equal(mrrOf({ plan: 'personal', status: 'active', seats: 1, aiAddonSeats: 1, billingInterval: 'month' }), 15);
    assert.equal(mrrOf({ plan: 'personal', status: 'active', seats: 1, billingInterval: 'year' }), 4);
    assert.equal(billingOf({ plan: 'personal', status: 'free', workspaceType: 'personal' }).workspaceType, 'personal');
    assert.equal(billingOf(undefined).status, 'grace');
});
