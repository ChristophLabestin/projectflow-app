// Unit tests: plan limits, Stripe status mapping, seat counting, project locking on Free.
const test = require('node:test');
const assert = require('node:assert/strict');
const billing = require('../../lib/billing-logic');

test('missing entitlement doc is treated as Team (legacy grace)', () => {
    assert.deepEqual(billing.limitsFor(undefined), { ...billing.PLAN_LIMITS.team, aiIncluded: true });
    assert.equal(billing.limitsFor({ plan: 'free' }).projectLimit, 3);
    assert.equal(billing.limitsFor({ plan: 'free' }).aiIncluded, false);
});

test('AI: trial/grace for everyone, paid Team only via the per-user add-on, never on Free', () => {
    assert.equal(billing.aiEnabledFor(undefined, 'u1'), true);
    assert.equal(billing.aiEnabledFor({ plan: 'team', status: 'trialing' }, 'u1'), true);
    assert.equal(billing.aiEnabledFor({ plan: 'team', status: 'grace' }, 'u1'), true);
    assert.equal(billing.aiEnabledFor({ plan: 'team', status: 'active', aiMemberIds: ['u2'] }, 'u1'), false);
    assert.equal(billing.aiEnabledFor({ plan: 'team', status: 'active', aiMemberIds: ['u1'] }, 'u1'), true);
    assert.equal(billing.aiEnabledFor({ plan: 'free', status: 'free', aiMemberIds: ['u1'] }, 'u1'), false);
    assert.equal(billing.isAiAddonLookupKey('ai_addon_yearly'), true);
    assert.equal(billing.isAiAddonLookupKey('team_yearly'), false);
});

test('maps Stripe statuses', () => {
    assert.deepEqual(billing.mapStripeStatus('active'), { status: 'active', plan: 'team' });
    assert.deepEqual(billing.mapStripeStatus('past_due'), { status: 'past_due', plan: 'team' });
    assert.equal(billing.mapStripeStatus('canceled').plan, 'free');
    assert.equal(billing.mapStripeStatus('unpaid').plan, 'free');
});

test('guests are free seats and the minimum quantity is 1', () => {
    assert.equal(billing.countSeats(['Owner', 'Guest', 'Member', 'Guest']), 2);
    assert.equal(billing.seatQuantity(['Guest']), 1);
    assert.equal(billing.memberLimitAllows(billing.PLAN_LIMITS.free, 1), false);
    assert.equal(billing.memberLimitAllows(billing.PLAN_LIMITS.team, 49), true);
    assert.equal(billing.memberLimitAllows(billing.PLAN_LIMITS.team, 50), false);
});

test('locks all but the most recently updated projects', () => {
    const projects = [{ id: 'a', updatedAtMs: 1 }, { id: 'b', updatedAtMs: 5 }, { id: 'c', updatedAtMs: 3 }, { id: 'd', updatedAtMs: 4 }, { id: 'e', updatedAtMs: 2 }];
    assert.deepEqual(billing.projectsToLock(projects, 3).sort(), ['a', 'e']);
    assert.deepEqual(billing.projectsToLock(projects, null), []);
});

test('existing workspaces start in grace, new ones in a 14-day trial', () => {
    assert.equal(billing.initialEntitlement(Date.parse('2026-01-01'), Date.now()).status, 'grace');
    const created = Date.parse('2026-11-01T00:00:00Z');
    const trial = billing.initialEntitlement(created, created);
    assert.equal(trial.status, 'trialing');
    assert.equal(trial.trialEndsAtMs - created, 14 * 86400000);
    assert.equal(billing.periodExpired(created, created), true);
    assert.equal(billing.periodExpired(null, created), false);
});

test('only test keys are accepted', () => {
    assert.equal(billing.isTestKey('sk_test_123'), true);
    assert.equal(billing.isTestKey('sk_live_123'), false);
});
