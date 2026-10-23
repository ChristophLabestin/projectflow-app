// Unit test: workspace API tokens stop working when expired or when their creator left / became a guest.
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkApiTokenUsable } = require('../../lib/authUtils');

const roles = { 't1/owner': 'Owner', 't1/member': 'Member', 't1/guest': 'Guest' };
const deps = {
    getMemberRole: async (tenantId, uid) => roles[`${tenantId}/${uid}`] || null,
    now: () => new Date('2026-10-23')
};
const at = (iso) => ({ toDate: () => new Date(iso) });

test('allowed: creator is owner or member, not expired', async () => {
    assert.deepEqual(await checkApiTokenUsable({ createdBy: 'owner' }, 't1', deps), { ok: true, role: 'Owner' });
    assert.deepEqual(await checkApiTokenUsable({ createdBy: 'member', expiresAt: at('2099-01-01') }, 't1', deps), { ok: true, role: 'Member' });
});

test('denied: expired token', async () => {
    const result = await checkApiTokenUsable({ createdBy: 'owner', expiresAt: at('2000-01-01') }, 't1', deps);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Token expired');
});

test('denied: creator removed, demoted to guest, or member of another tenant only', async () => {
    assert.equal((await checkApiTokenUsable({ createdBy: 'gone' }, 't1', deps)).ok, false);
    assert.equal((await checkApiTokenUsable({ createdBy: 'guest' }, 't1', deps)).ok, false);
    assert.equal((await checkApiTokenUsable({ createdBy: 'owner' }, 't2', deps)).ok, false);
});

test('denied: token without creator', async () => {
    assert.equal((await checkApiTokenUsable({}, 't1', deps)).ok, false);
});
