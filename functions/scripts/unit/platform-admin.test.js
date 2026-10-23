// Unit test: global blog writes are platform-admin only (Firebase login or token created by an admin).
const test = require('node:test');
const assert = require('node:assert/strict');
const { authorizePlatformAdmin } = require('../../lib/platform-admin');

const ADMIN = 'admin-uid';
const OWNER = 'owner-uid';
const future = { toDate: () => new Date('2099-01-01') };
const past = { toDate: () => new Date('2000-01-01') };

const deps = ({ idTokens = {}, apiTokens = {} } = {}) => {
    const used = [];
    return {
        used,
        verifyIdToken: async (token) => idTokens[token] || null,
        findApiToken: async (token) => apiTokens[token]
            ? { tokenData: apiTokens[token], markUsed: async () => used.push(token) }
            : null,
        isPlatformAdminUid: async (uid) => uid === ADMIN,
        now: () => new Date('2026-10-23')
    };
};

test('allowed: signed-in platform admin', async () => {
    const result = await authorizePlatformAdmin('id-admin', 'blog:write', deps({ idTokens: { 'id-admin': { uid: ADMIN, platformAdmin: true } } }));
    assert.deepEqual(result, { ok: true, uid: ADMIN, via: 'firebase' });
});

test('allowed: token with the permission created by a platform admin', async () => {
    const d = deps({ apiTokens: { 'pf_admin': { createdBy: ADMIN, permissions: ['blog:write'], expiresAt: future } } });
    const result = await authorizePlatformAdmin('pf_admin', 'blog:write', d);
    assert.deepEqual(result, { ok: true, uid: ADMIN, via: 'token' });
    assert.deepEqual(d.used, ['pf_admin']);
});

test('denied: signed-in workspace owner without the claim', async () => {
    const result = await authorizePlatformAdmin('id-owner', 'blog:write', deps({ idTokens: { 'id-owner': { uid: OWNER } } }));
    assert.deepEqual(result, { ok: false, status: 403, error: 'Platform admin only' });
});

test('denied: workspace owner token that carries blog permissions', async () => {
    const d = deps({ apiTokens: { 'pf_owner': { createdBy: OWNER, permissions: ['blog:write', 'blog:categories:write'] } } });
    for (const permission of ['blog:write', 'blog:categories:write']) {
        assert.deepEqual(await authorizePlatformAdmin('pf_owner', permission, d), { ok: false, status: 403, error: 'Platform admin only' });
    }
    assert.deepEqual(d.used, []);
});

test('denied: admin token without the permission, expired, legacy without creator, unknown, missing', async () => {
    const d = deps({ apiTokens: {
        'pf_noperm': { createdBy: ADMIN, permissions: ['tasks:read'] },
        'pf_expired': { createdBy: ADMIN, permissions: ['blog:write'], expiresAt: past },
        'pf_legacy': { permissions: ['blog:write'] }
    } });
    assert.equal((await authorizePlatformAdmin('pf_noperm', 'blog:write', d)).status, 403);
    assert.equal((await authorizePlatformAdmin('pf_expired', 'blog:write', d)).error, 'Token expired');
    assert.equal((await authorizePlatformAdmin('pf_legacy', 'blog:write', d)).error, 'Platform admin only');
    assert.equal((await authorizePlatformAdmin('pf_unknown', 'blog:write', d)).error, 'Invalid token');
    assert.equal((await authorizePlatformAdmin('', 'blog:write', d)).status, 401);
});
