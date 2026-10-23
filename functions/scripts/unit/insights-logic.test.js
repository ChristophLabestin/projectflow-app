// Unit test: workspace insights snapshot (throughput, cycle time, burn-up, overdue, workload, health).
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeInsights, healthOf, weekStart, toInsightTask, INSIGHTS_WEEKS } = require('../../lib/insights-logic');

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 23, 12); // Friday
const task = (over) => ({ projectId: 'p', createdAtMs: NOW - 20 * DAY, completedAtMs: null, done: false, due: null, status: 'Open', assigneeIds: [], ...over });

test('weekStart is Monday UTC', () => {
    assert.equal(new Date(weekStart(NOW)).toISOString().slice(0, 10), '2026-10-19');
});

test('throughput, cycle time, burn-up and termintreue', () => {
    const snap = computeInsights([{ id: 'p', title: 'P', status: 'Active' }], [
        task({ done: true, completedAtMs: NOW - DAY, createdAtMs: NOW - 5 * DAY, due: '2026-10-25' }),
        task({ done: true, completedAtMs: NOW - 8 * DAY, createdAtMs: NOW - 10 * DAY, due: '2026-10-10' }),
        task({ createdAtMs: NOW - 200 * DAY }),
    ], { p: 4 }, NOW);
    const p = snap.projects[0];
    const last = INSIGHTS_WEEKS - 1;
    assert.equal(snap.weeks.length, INSIGHTS_WEEKS);
    assert.equal(snap.weeks[last], '2026-10-19');
    assert.equal(p.completed[last], 1);
    assert.equal(p.completed[last - 1], 1);
    assert.equal(p.cycleDaysSum[last], 4);
    assert.equal(p.cycleCount[last], 1);
    assert.equal(p.scope[last], 3);
    assert.equal(p.scope[0], 1);
    assert.equal(p.done[last], 2);
    assert.equal(p.onTime, 1);
    assert.equal(p.late, 1);
    assert.equal(p.activity7d, 4);
});

test('open work: overdue, due soon, blocked and per-person load', () => {
    const snap = computeInsights([{ id: 'p', title: 'P', status: '' }], [
        task({ due: '2026-10-20', assigneeIds: ['a'] }),
        task({ due: '2026-10-26', assigneeIds: ['a', 'b'] }),
        task({ status: 'Blocked' }),
        task({ projectId: 'unknown' }),
    ], {}, NOW);
    const p = snap.projects[0];
    assert.equal(p.open, 3);
    assert.equal(p.overdue, 1);
    assert.equal(p.dueNext7, 1);
    assert.equal(p.blocked, 1);
    assert.deepEqual(p.people.a, [2, 1, 1]);
    assert.deepEqual(p.people.b, [1, 0, 1]);
    assert.equal(p.health, 'risk'); // 1 of 3 open overdue
});

test('health levels', () => {
    const base = { open: 10, overdue: 0, blocked: 0, onTime: 5, late: 0, activity7d: 3 };
    assert.equal(healthOf(base), 'good');
    assert.equal(healthOf({ ...base, blocked: 1 }), 'watch');
    assert.equal(healthOf({ ...base, activity7d: 0 }), 'watch');
    assert.equal(healthOf({ ...base, blocked: 3 }), 'risk');
    assert.equal(healthOf({ ...base, onTime: 1, late: 4 }), 'risk');
});

test('toInsightTask reads done, completion and due', () => {
    const t = toInsightTask('p', { status: 'Done', completedAt: '2026-10-22T10:00:00.000Z', createdAt: '2026-10-01T10:00:00.000Z', dueDate: '2026-10-30T00:00:00Z', assigneeId: 'a' });
    assert.equal(t.done, true);
    assert.equal(t.completedAtMs, Date.parse('2026-10-22T10:00:00.000Z'));
    assert.equal(t.due, '2026-10-30');
    assert.deepEqual(t.assigneeIds, ['a']);
});
