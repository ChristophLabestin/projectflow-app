// Unit test: compact AI views (my_today grouping, search matching).
const test = require('node:test');
const assert = require('node:assert/strict');
const { planToday, matchesQuery, normalizeQuery, toTaskRef } = require('../../lib/mcp-views');

const NOW = Date.parse('2026-10-23T10:00:00Z');
const task = (id, dueDate, extra = {}) => {
    const raw = { title: id, dueDate, ...extra };
    return { ref: toTaskRef(id, 'p1', raw, 'Europe/Berlin'), raw };
};

test('my_today: overdue, today, next 7 days, later, undated; done tasks ignored', () => {
    const plan = planToday([
        task('late', '2026-10-20', { priority: 'Low' }),
        task('late-urgent', '2026-10-21', { priority: 'Urgent' }),
        task('today', '2026-10-23'),
        task('soon', '2026-10-28'),
        task('later', '2026-12-01'),
        task('none', undefined),
        task('done', '2026-10-23', { isCompleted: true })
    ], NOW, 'Europe/Berlin');
    assert.equal(plan.date, '2026-10-23');
    assert.deepEqual(plan.overdue.map((t) => t.id), ['late-urgent', 'late']);
    assert.deepEqual(plan.today.map((t) => t.id), ['today']);
    assert.deepEqual(plan.upcoming.map((t) => t.id), ['soon']);
    assert.deepEqual(plan.counts, { overdue: 2, today: 1, upcoming: 1, later: 1, undated: 1 });
});

test('search matching is case-insensitive over given fields', () => {
    const q = normalizeQuery('  LOGIN ');
    assert.equal(q, 'login');
    assert.ok(matchesQuery(q, 'Fix Login bug'));
    assert.ok(matchesQuery(q, undefined, 'the login page'));
    assert.ok(!matchesQuery(q, 'Logout'));
});
