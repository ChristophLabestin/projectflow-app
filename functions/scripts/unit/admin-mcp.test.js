// Unit test: admin MCP access rules (functions/src/admin-console/mcp/core.ts) — every barrier refuses on its own.
const test = require('node:test');
const assert = require('node:assert/strict');
const { decideAccess, isAllowedAdminRedirect, parseAdminScopes, consentFresh, baseUrlFor } = require('../../lib/admin-console/mcp/core');

const NOW = Date.parse('2026-10-24T10:00:00Z');
const RES = 'https://admin.getprojectflow.com/mcp';
const ok = () => ({
    killSwitchOn: true,
    token: { type: 'access', expireAtMs: NOW + 60_000, resource: RES, grantId: 'g1', uid: 'admin' },
    requestResource: RES,
    grant: { uid: 'admin', clientId: 'c1', revokedAtMs: null, createdAtMs: NOW - 3_600_000, expiresAtMs: NOW + 86_400_000 },
    client: { status: 'approved' },
    user: { exists: true, platformAdmin: true, email: 'christoph@labestindigital.de', disabled: false, tokensValidAfterMs: NOW - 86_400_000 },
    allowlist: { active: true, email: 'christoph@labestindigital.de' },
    nowMs: NOW,
});
const refuse = (patch, reason) => assert.equal(decideAccess({ ...ok(), ...patch }).reason, reason);

test('allowed when every barrier passes', () => assert.deepEqual(decideAccess(ok()), { ok: true }));
test('kill switch', () => refuse({ killSwitchOn: false }, 'admin-mcp-disabled'));
test('missing / refresh / expired token', () => {
    refuse({ token: null }, 'invalid-token');
    refuse({ token: { ...ok().token, type: 'refresh' } }, 'invalid-token');
    refuse({ token: { ...ok().token, expireAtMs: NOW } }, 'token-expired');
});
test('token for another audience (user MCP resource)', () => refuse({ token: { ...ok().token, resource: 'https://app.getprojectflow.com/mcp' } }, 'wrong-audience'));
test('revoked, foreign or expired grant', () => {
    refuse({ grant: { ...ok().grant, revokedAtMs: NOW } }, 'grant-revoked');
    refuse({ grant: { ...ok().grant, uid: 'someone' } }, 'grant-revoked');
    refuse({ grant: { ...ok().grant, expiresAtMs: NOW } }, 'grant-expired');
});
test('client pending or revoked', () => {
    refuse({ client: { status: 'pending' } }, 'client-not-approved');
    refuse({ client: { status: 'revoked' } }, 'client-not-approved');
});
test('claim removed, user disabled or deleted', () => {
    refuse({ user: { ...ok().user, platformAdmin: false } }, 'not-admin');
    refuse({ user: { ...ok().user, disabled: true } }, 'not-admin');
    refuse({ user: null }, 'not-admin');
});
test('allowlist removed, inactive or other email', () => {
    refuse({ allowlist: null }, 'not-allowlisted');
    refuse({ allowlist: { active: false, email: 'christoph@labestindigital.de' } }, 'not-allowlisted');
    refuse({ allowlist: { active: true, email: 'other@example.com' } }, 'not-allowlisted');
});
test('sessions revoked after the grant', () => refuse({ user: { ...ok().user, tokensValidAfterMs: NOW - 60_000 } }, 'sessions-revoked'));
test('redirect allowlist', () => {
    assert.equal(isAllowedAdminRedirect('http://localhost:53682/callback'), true);
    assert.equal(isAllowedAdminRedirect('http://127.0.0.1:8080/cb'), true);
    assert.equal(isAllowedAdminRedirect('https://claude.ai/api/mcp/auth_callback'), true);
    assert.equal(isAllowedAdminRedirect('https://claude.com/api/mcp/auth_callback'), true);
    assert.equal(isAllowedAdminRedirect('https://evil.example/api/mcp/auth_callback'), false);
    assert.equal(isAllowedAdminRedirect('https://claude.ai/other'), false);
    assert.equal(isAllowedAdminRedirect('https://claude.ai.evil.com/api/mcp/auth_callback'), false);
    assert.equal(isAllowedAdminRedirect('cursor://callback'), false);
    assert.equal(isAllowedAdminRedirect('http://evil.example/cb'), false);
});
test('scopes, consent freshness, base url', () => {
    assert.deepEqual(parseAdminScopes('admin:read admin:write tasks:write'), ['admin:read', 'admin:write']);
    assert.deepEqual(parseAdminScopes(''), ['admin:read']);
    assert.equal(consentFresh((NOW - 60_000) / 1000, NOW), true);
    assert.equal(consentFresh((NOW - 6 * 60_000) / 1000, NOW), false);
    assert.equal(consentFresh(undefined, NOW), false);
    assert.equal(baseUrlFor('projectflow-admin.web.app'), 'https://projectflow-admin.web.app');
    assert.equal(baseUrlFor('evil.example'), 'https://admin.getprojectflow.com');
});
