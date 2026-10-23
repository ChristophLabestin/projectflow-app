// Unit test: activity stream planning (contract brain/plans/activity-events-contract.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    planTaskEvents, planProjectEvents, causeOf, planSubtaskEvents, planCommentEvent, freshWriteVia, buildActor, domainOf, sanitizeValue
} = require('../../lib/activity-logic');

const types = (events) => events.map((e) => e.type);

test('task create emits created + assigned', () => {
    const events = planTaskEvents(null, { title: 'A', assigneeIds: ['u1'] }, 't1');
    assert.deepEqual(types(events), ['task.created', 'task.assigned']);
    assert.deepEqual(events[1].meta.assigneeIds, ['u1']);
    assert.deepEqual(events[0].object, { type: 'task', id: 't1', title: 'A' });
});

test('completion wins over status change; reopen', () => {
    assert.deepEqual(types(planTaskEvents({ title: 'A', status: 'Open' }, { title: 'A', status: 'Done', isCompleted: true }, 't')), ['task.completed']);
    assert.deepEqual(types(planTaskEvents({ title: 'A', status: 'Done', isCompleted: true }, { title: 'A', status: 'Open' }, 't')), ['task.reopened']);
});

test('field changes carry from/to', () => {
    const events = planTaskEvents(
        { title: 'A', status: 'Open', dueDate: '2026-10-01', priority: 'Low', assigneeIds: ['u1'] },
        { title: 'B', status: 'In Progress', dueDate: '2026-10-05T00:00:00.000Z', priority: 'High', assigneeIds: ['u2'] },
        't'
    );
    assert.deepEqual(types(events), ['task.status_changed', 'task.renamed', 'task.due_changed', 'task.priority_changed', 'task.assigned', 'task.unassigned']);
    assert.deepEqual(events[0].changes.status, { from: 'Open', to: 'In Progress' });
    assert.deepEqual(events[2].changes.dueDate, { from: '2026-10-01', to: '2026-10-05' });
});

test('unchanged write emits nothing; delete emits task.deleted', () => {
    assert.deepEqual(planTaskEvents({ title: 'A', status: 'Open' }, { title: 'A', status: 'Open', description: 'x' }, 't'), []);
    assert.deepEqual(types(planTaskEvents({ title: 'A' }, null, 't')), ['task.deleted']);
});

test('project events: created, status, members (owner ignored)', () => {
    assert.deepEqual(types(planProjectEvents(null, { title: 'P' }, 'p')), ['project.created']);
    const events = planProjectEvents({ title: 'P', status: 'Active', ownerId: 'o', memberIds: ['o', 'a'] },
        { title: 'P', status: 'On Hold', ownerId: 'o', memberIds: ['o', 'b'] }, 'p');
    assert.deepEqual(types(events), ['project.status_changed', 'project.member_added', 'project.member_removed']);
    assert.deepEqual(events[1].meta.userIds, ['b']);
    assert.deepEqual(events[2].meta.userIds, ['a']);
});

test('subtask + comment events reference their parent', () => {
    assert.deepEqual(types(planSubtaskEvents(null, { title: 's' }, 's1', 't1', 'Task')), ['subtask.created']);
    assert.deepEqual(types(planSubtaskEvents({ isCompleted: false }, { isCompleted: true }, 's1', 't1', 'Task')), ['subtask.completed']);
    const comment = planCommentEvent({ content: 'Hello **world**' }, 'c1', 'task', 't1', 'Task');
    assert.equal(comment.object.parentId, 't1');
    assert.ok(comment.meta.snippet.includes('Hello'));
});

test('writeVia only counts when re-stamped in this write', () => {
    const via = { kind: 'ai', client: 'Claude', at: { seconds: 10, nanoseconds: 0 } };
    assert.deepEqual(freshWriteVia(null, { writeVia: via }), { kind: 'ai', client: 'Claude' });
    assert.equal(freshWriteVia({ writeVia: via }, { writeVia: via }), null);
    assert.equal(freshWriteVia(null, { writeVia: { kind: 'bogus' } }), null);
});

test('actor kinds', () => {
    const user = { id: 'u1', name: 'Ann', photoURL: '' };
    assert.deepEqual(buildActor(user, null), { kind: 'user', id: 'u1', name: 'Ann' });
    assert.deepEqual(buildActor(user, { kind: 'ai', client: 'Claude' }), { kind: 'ai', id: 'u1', name: 'Ann', client: 'Claude' });
    assert.deepEqual(buildActor(null, { kind: 'automation', id: 'f1', name: 'Flow' }), { kind: 'automation', id: null, name: 'Flow', automationId: 'f1' });
    assert.equal(buildActor(null, null).kind, 'system');
});

test('domainOf and sanitizeValue', () => {
    assert.equal(domainOf('task.created'), 'task');
    assert.equal(sanitizeValue(undefined), null);
    assert.equal(sanitizeValue('x'.repeat(600)).length, 500);
    assert.equal(sanitizeValue(new Array(40).fill(1)).length, 25);
});

test('automation run id and depth flow into actor and cause', () => {
    const via = freshWriteVia(null, { writeVia: { kind: 'automation', id: 'f1', name: 'Flow', runId: 'r1', depth: 2, at: { seconds: 1, nanoseconds: 0 } } });
    assert.deepEqual(via, { kind: 'automation', id: 'f1', name: 'Flow', runId: 'r1', depth: 2 });
    const actor = buildActor(null, via);
    assert.equal(actor.automationRunId, 'r1');
    assert.equal(actor.automationDepth, 2);
    assert.deepEqual(causeOf(actor), { kind: 'automation', id: 'f1', automationRunId: 'r1', depth: 2 });
    assert.deepEqual(causeOf(buildActor({ id: 'u1', name: 'A' }, null)), { kind: 'user', id: 'u1', depth: 0 });
});
