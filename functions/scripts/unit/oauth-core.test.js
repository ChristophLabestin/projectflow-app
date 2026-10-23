// Unit test: OAuth helpers — PKCE, redirect rules, scopes, client metadata, SSRF guard, audience.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const core = require('../../lib/oauth-core');

test('PKCE S256', () => {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    assert.equal(core.verifyPkceS256(verifier, challenge), true);
    assert.equal(core.verifyPkceS256(`${verifier}x`, challenge), false);
    assert.equal(core.verifyPkceS256('short', challenge), false);
});

test('redirect URIs: https, loopback http, native schemes; no script/data/fragment', () => {
    assert.ok(core.isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback'));
    assert.ok(core.isAllowedRedirectUri('http://127.0.0.1:33418/callback'));
    assert.ok(core.isAllowedRedirectUri('http://localhost/callback'));
    assert.ok(core.isAllowedRedirectUri('cursor://anysphere.cursor-retrieval/oauth/callback'));
    assert.ok(!core.isAllowedRedirectUri('http://evil.example/cb'));
    assert.ok(!core.isAllowedRedirectUri('javascript:alert(1)'));
    assert.ok(!core.isAllowedRedirectUri('data:text/html,x'));
    assert.ok(!core.isAllowedRedirectUri('https://a.example/cb#frag'));
});

test('redirect matching: exact, loopback any port, nothing else', () => {
    const registered = ['http://127.0.0.1:33418/callback', 'https://app.example/cb'];
    assert.ok(core.redirectUriMatches(registered, 'https://app.example/cb'));
    assert.ok(core.redirectUriMatches(registered, 'http://127.0.0.1:50000/callback'));
    assert.ok(!core.redirectUriMatches(registered, 'http://127.0.0.1:50000/other'));
    assert.ok(!core.redirectUriMatches(registered, 'http://localhost:50000/callback'));
    assert.ok(!core.redirectUriMatches(registered, 'https://app.example/cb2'));
});

test('scopes: known only, default when empty, offline_access ignored', () => {
    assert.deepEqual(core.parseScopes('tasks:read bogus offline_access'), ['tasks:read']);
    assert.deepEqual(core.parseScopes(''), core.DEFAULT_OAUTH_SCOPES);
});

test('client metadata: DCR and CIMD', () => {
    const ok = core.parseClientMetadata({ client_name: 'X', redirect_uris: ['https://x.example/cb'] });
    assert.equal(ok.name, 'X');
    assert.equal(ok.tokenEndpointAuthMethod, 'none');
    assert.equal(typeof core.parseClientMetadata({ redirect_uris: [] }), 'string');
    const url = 'https://client.example/oauth/metadata.json';
    assert.equal(typeof core.parseClientMetadata({ client_id: 'https://other.example/m.json', redirect_uris: ['https://client.example/cb'] }, { cimdUrl: url }), 'string');
    assert.equal(typeof core.parseClientMetadata({ client_id: url, redirect_uris: ['https://client.example/cb'] }, { cimdUrl: url }), 'object');
    assert.ok(core.isCimdClientId(url));
    assert.ok(!core.isCimdClientId('https://client.example/'));
    assert.ok(!core.isCimdClientId('pfc_abc'));
});

test('known clients by redirect host', () => {
    assert.equal(core.knownClientName(['https://claude.ai/api/mcp/auth_callback']), 'Claude');
    assert.equal(core.knownClientName(['http://127.0.0.1:1/cb']), null);
});

test('SSRF guard: only public addresses', () => {
    for (const address of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '0.0.0.0']) {
        assert.equal(core.isPublicAddress(address), false, address);
    }
    assert.equal(core.isPublicAddress('8.8.8.8'), true);
    assert.equal(core.isPublicAddress('2606:4700::1111'), true);
});

test('audience binding', () => {
    assert.ok(core.audienceMatches('https://app.getprojectflow.com/mcp', 'https://app.getprojectflow.com/mcp/'));
    assert.ok(!core.audienceMatches('https://mcp.getprojectflow.com/mcp', 'https://app.getprojectflow.com/mcp'));
    assert.ok(core.audienceMatches(null, 'https://app.getprojectflow.com/mcp'));
});
