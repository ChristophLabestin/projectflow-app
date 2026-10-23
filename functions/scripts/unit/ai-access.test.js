// Unit test: AI access model — scopes ∩ role ceiling ∩ workspace policy, guest reach, rate limits.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    DEFAULT_AI_POLICY, normalizeAiPolicy, effectiveScopes, checkWorkspaceAccess, canReachProject, RateLimiter, shouldTouchLastUsed
} = require('../../lib/ai-access');

const ALL = ['projects:read', 'projects:write', 'projects:delete', 'tasks:read', 'tasks:write', 'tasks:delete', 'blog:write'];

test('policy defaults: AI on, guests off, delete scopes off, personal tokens on', () => {
    assert.deepEqual(normalizeAiPolicy(undefined), DEFAULT_AI_POLICY);
    assert.deepEqual(normalizeAiPolicy({ enabled: false, allowGuests: 'yes' }), { ...DEFAULT_AI_POLICY, enabled: false });
});

test('owner workspace token keeps everything it was given (no migration break)', () => {
    assert.deepEqual(effectiveScopes({ tokenScopes: ALL, role: 'Owner', policy: DEFAULT_AI_POLICY, kind: 'workspace-token' }), ALL);
});

test('member ceiling drops projects:delete', () => {
    const scopes = effectiveScopes({ tokenScopes: ALL, role: 'Member', policy: DEFAULT_AI_POLICY, kind: 'workspace-token' });
    assert.ok(!scopes.includes('projects:delete'));
    assert.ok(scopes.includes('tasks:delete'));
});

test('oauth / personal tokens lose delete scopes unless the policy allows them', () => {
    const off = effectiveScopes({ tokenScopes: ALL, role: 'Owner', policy: DEFAULT_AI_POLICY, kind: 'oauth' });
    assert.ok(!off.some((s) => s.endsWith(':delete')));
    const on = effectiveScopes({ tokenScopes: ALL, role: 'Owner', policy: { ...DEFAULT_AI_POLICY, allowDeleteScopes: true }, kind: 'personal-token' });
    assert.ok(on.includes('tasks:delete') && on.includes('projects:delete'));
});

test('guest ceiling: read + tasks:write only', () => {
    const scopes = effectiveScopes({ tokenScopes: ALL, role: 'Guest', policy: DEFAULT_AI_POLICY, kind: 'oauth' });
    assert.deepEqual(scopes.filter((s) => s !== 'blog:write'), ['projects:read', 'tasks:read', 'tasks:write']);
});

test('workspace gate: disabled policy, guests, personal tokens; app sessions untouched', () => {
    assert.equal(checkWorkspaceAccess({ role: 'Owner', policy: { ...DEFAULT_AI_POLICY, enabled: false }, kind: 'workspace-token' }).ok, false);
    assert.equal(checkWorkspaceAccess({ role: 'Guest', policy: DEFAULT_AI_POLICY, kind: 'oauth' }).ok, false);
    assert.equal(checkWorkspaceAccess({ role: 'Guest', policy: { ...DEFAULT_AI_POLICY, allowGuests: true }, kind: 'oauth' }).ok, true);
    assert.equal(checkWorkspaceAccess({ role: 'Member', policy: { ...DEFAULT_AI_POLICY, allowPersonalTokens: false }, kind: 'personal-token' }).ok, false);
    assert.equal(checkWorkspaceAccess({ role: 'Member', policy: { ...DEFAULT_AI_POLICY, enabled: false }, kind: 'firebase' }).ok, true);
});

test('guests only reach projects listing them in memberIds', () => {
    assert.equal(canReachProject('Guest', 'g1', { memberIds: ['g1'] }), true);
    assert.equal(canReachProject('Guest', 'g1', { memberIds: ['other'] }), false);
    assert.equal(canReachProject('Member', 'm1', { memberIds: [] }), true);
    assert.equal(canReachProject('Member', 'm1', null), false);
});

test('rate limiter: burst capacity, then retry-after, then refill', () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    const rule = { capacity: 2, refillPerSecond: 1 };
    assert.equal(limiter.take('k', rule), 0);
    assert.equal(limiter.take('k', rule), 0);
    assert.equal(limiter.take('k', rule), 1);
    assert.equal(limiter.take('other', rule), 0);
    now = 1000;
    assert.equal(limiter.take('k', rule), 0);
});

test('rate limiter evicts the oldest key at the cap', () => {
    const limiter = new RateLimiter(() => 0, 2);
    const rule = { capacity: 1, refillPerSecond: 0.001 };
    limiter.take('a', rule); limiter.take('b', rule); limiter.take('c', rule);
    assert.equal(limiter.take('a', rule), 0); // 'a' was evicted, so it starts with a full bucket
});

test('lastUsedAt is touched at most every 5 minutes', () => {
    const now = new Date('2026-10-23T12:00:00Z');
    assert.equal(shouldTouchLastUsed(null, now), true);
    assert.equal(shouldTouchLastUsed({ toDate: () => new Date('2026-10-23T11:58:00Z') }, now), false);
    assert.equal(shouldTouchLastUsed({ toDate: () => new Date('2026-10-23T11:54:00Z') }, now), true);
});
