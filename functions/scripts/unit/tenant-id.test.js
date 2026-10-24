// Unit tests: tenantId path-injection guard (brain/audits/2026-10-24-security-review.md, C1) and trial start clamp (H3).
const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidTenantId } = require('../../lib/tenant-id');
const { trialStartMs } = require('../../lib/billing-logic');

test('plain workspace ids are valid', () => {
    for (const id of ['ws-demo-studio', 'personal_abc123', 'Zx9AbC0dEfGhIjKlMnOp', 'tenant.with.dots']) {
        assert.equal(isValidTenantId(id), true, id);
    }
});

test('nested paths and reserved ids are rejected', () => {
    for (const id of ['OWN/users/uid', 'a/b', '/a', 'a/', '.', '..', '__x__', '', ' ws', 'ws ', 'x'.repeat(129), null, undefined, 42, {}]) {
        assert.equal(isValidTenantId(id), false, String(id));
    }
});

test('trial start never lies after the server create time', () => {
    const server = Date.UTC(2026, 9, 24);
    assert.equal(trialStartMs(Date.UTC(2099, 0, 1), server), server);
    assert.equal(trialStartMs(server - 1000, server), server - 1000);
    assert.equal(trialStartMs(null, server), server);
    assert.equal(trialStartMs(Number.NaN, server), server);
});
