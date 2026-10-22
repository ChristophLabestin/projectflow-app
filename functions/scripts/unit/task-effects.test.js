// Unit tests for the pure trigger logic. Run: cd functions && npm run test:unit
const test = require('node:test');
const assert = require('node:assert/strict');
const fx = require('../../lib/task-effects');

test('effectiveAssignees unions assigneeIds and legacy assigneeId', () => {
    assert.deepEqual(fx.effectiveAssignees({ assigneeIds: ['a'], assigneeId: 'b' }), ['a', 'b']);
    assert.deepEqual(fx.effectiveAssignees({ assigneeIds: ['a'], assigneeId: 'a' }), ['a']);
    assert.deepEqual(fx.effectiveAssignees({ assigneeId: '' }), []);
    assert.deepEqual(fx.effectiveAssignees(null), []);
});

test('backfilling assigneeIds from assigneeId adds no new assignee', () => {
    const before = { assigneeId: 'anna' };
    const after = { assigneeId: 'anna', assigneeIds: ['anna'] };
    assert.deepEqual(fx.addedItems(fx.effectiveAssignees(before), fx.effectiveAssignees(after)), []);
});

test('consistency: isCompleted true flips status to Done and stamps completion', () => {
    const before = { isCompleted: false, status: 'Open' };
    const after = { isCompleted: true, status: 'Open' };
    const { plan, done, wasDone } = fx.planCompletionConsistency(before, after);
    assert.equal(plan.status, 'Done');
    assert.equal(plan.stampCompletedAt, true);
    assert.equal(plan.stampCompletedBy, true);
    assert.equal(done, true);
    assert.equal(wasDone, false);
});

test('consistency: status Done sets isCompleted', () => {
    const { plan } = fx.planCompletionConsistency({ isCompleted: false, status: 'Review' }, { isCompleted: false, status: 'Done' });
    assert.equal(plan.isCompleted, true);
    assert.equal(plan.status, undefined);
});

test('consistency: reopening via isCompleted false resets Done to Open and clears completion', () => {
    const before = { isCompleted: true, status: 'Done', completedAt: 'x', completedBy: 'u' };
    const after = { isCompleted: false, status: 'Done', completedAt: 'x', completedBy: 'u' };
    const { plan, done } = fx.planCompletionConsistency(before, after);
    assert.equal(plan.status, 'Open');
    assert.equal(plan.clearCompleted, true);
    assert.equal(done, false);
});

test('consistency: status leaving Done clears isCompleted', () => {
    const { plan } = fx.planCompletionConsistency(
        { isCompleted: true, status: 'Done', completedAt: 'x' },
        { isCompleted: true, status: 'In Progress', completedAt: 'x' }
    );
    assert.equal(plan.isCompleted, false);
    assert.equal(plan.clearCompleted, true);
});

test('consistency: nothing changed -> legacy disagreement is not rewritten', () => {
    const doc = { isCompleted: false, status: 'Done', title: 'a' };
    const { plan } = fx.planCompletionConsistency(doc, { ...doc, title: 'b' });
    assert.deepEqual(plan, {});
});

test('consistency: legacy Todo is left alone and consistent create needs no patch', () => {
    assert.deepEqual(fx.planCompletionConsistency(null, { isCompleted: false, status: 'Todo' }).plan, {});
    assert.deepEqual(fx.planCompletionConsistency({ isCompleted: false, status: 'Todo' }, { isCompleted: false, status: 'Todo', title: 'x' }).plan, {});
});

test('consistency: create Done without isCompleted', () => {
    const { plan, done } = fx.planCompletionConsistency(null, { status: 'Done' });
    assert.equal(plan.isCompleted, true);
    assert.equal(plan.stampCompletedAt, true);
    assert.equal(done, true);
});

test('consistency is idempotent on the patched result (loop guard)', () => {
    const before = { isCompleted: false, status: 'Open' };
    const after = { isCompleted: true, status: 'Open' };
    const { plan } = fx.planCompletionConsistency(before, after);
    const patched = { ...fx.applyConsistency(after, plan), completedAt: 'now', completedBy: 'u' };
    const second = fx.planCompletionConsistency(after, patched);
    assert.deepEqual(second.plan, {});
});

test('activities: create, completion, status, priority, assignment, due date', () => {
    const create = fx.planTaskActivities(null, { title: 'T', initiativeId: 'i1' }, 't1');
    assert.equal(create[0].action, 'Added task "T" to initiative');
    assert.equal(create[0].type, 'initiative');
    assert.equal(create[0].relatedId, 'i1');

    const before = { title: 'T', status: 'Open', isCompleted: false, priority: 'Low', dueDate: '2026-10-22', assigneeIds: ['a'] };
    const done = fx.planTaskActivities(before, { ...before, status: 'Done', isCompleted: true }, 't1');
    assert.deepEqual(done.map((a) => a.action), ['Completed task "T"']);

    const many = fx.planTaskActivities(before, { ...before, status: 'In Progress', priority: 'High', dueDate: '2026-10-25', assigneeIds: ['a', 'b'] }, 't1', (u) => u.toUpperCase());
    assert.deepEqual(many.map((a) => a.action), [
        'Changed status of "T" to In Progress',
        'Changed priority of "T" to High',
        'Assigned task "T"',
        'Changed due date of "T"'
    ]);
    assert.equal(many[0].type, 'status');
    assert.equal(many[1].type, 'priority');
    assert.equal(many[2].details, 'Assigned to: B');
    assert.equal(many[3].details, '2026-10-22 → 2026-10-25');

    assert.deepEqual(fx.planTaskActivities(before, { ...before, title: 'renamed', description: 'x' }, 't1'), []);
});

test('notifications: assignment skips the actor, backfill and legacy fields', () => {
    const out = fx.planTaskNotifications(null, { title: 'T', assigneeIds: ['me', 'anna'], assigneeId: 'luis', createdBy: 'me' }, 'me', 'Me');
    assert.deepEqual(out.map((n) => [n.type, n.userId]), [['task_assigned', 'anna'], ['task_assigned', 'luis']]);
    assert.equal(out[0].title, 'New Task Assignment');
    assert.equal(out[0].message, 'You\'ve been assigned to "T"');
});

test('notifications: task_completed goes to the creator unless they completed it', () => {
    const before = { title: 'T', isCompleted: false, createdBy: 'boss', assigneeIds: ['a'] };
    const after = { ...before, isCompleted: true, status: 'Done' };
    assert.deepEqual(fx.planTaskNotifications(before, after, 'a', 'Anna').map((n) => [n.type, n.userId]), [['task_completed', 'boss']]);
    assert.deepEqual(fx.planTaskNotifications(before, after, 'boss', 'Boss'), []);
    assert.deepEqual(fx.planTaskNotifications(after, after, 'a', 'Anna'), []);
});

test('subtask notifications and activities', () => {
    const n = fx.planSubtaskNotifications({ assigneeId: '' }, { title: 'S', assigneeId: 'anna' }, 'Parent', 'me');
    assert.equal(n[0].type, 'subtask_assigned');
    assert.equal(n[0].message, 'You\'ve been assigned to subtask "S" in task "Parent"');
    assert.deepEqual(fx.planSubtaskNotifications({ assigneeId: 'anna' }, { title: 'S', assigneeId: 'anna' }, 'P', 'me'), []);
    assert.deepEqual(fx.planSubtaskNotifications(null, { title: 'S', assigneeId: 'me' }, 'P', 'me'), []);

    const acts = fx.planSubtaskActivities({ title: 'S', isCompleted: false }, { title: 'S', isCompleted: true }, 'Parent', 't1');
    assert.equal(acts[0].action, 'Completed subtask "S"');
    assert.equal(acts[0].target, 'Parent');
});

test('mentions: longest name first, punctuation, case-insensitive, no partial words', () => {
    const targets = [
        { id: 'u1', name: 'Anna', type: 'user' },
        { id: 'u2', name: 'Anna Berger', type: 'user' },
        { id: 'g1', name: 'Design', type: 'group', memberIds: ['u3'] }
    ];
    const hit = (text) => fx.findMentionedTargets(text, targets).map((t) => t.id).sort();
    // Same as the web editor: every target is tested independently, so "@Anna Berger" also matches "@Anna ".
    assert.deepEqual(hit('Hi @Anna Berger, bitte prüfen'), ['u1', 'u2']);
    assert.deepEqual(hit('Hi @Anna, bitte prüfen'), ['u1']);
    assert.deepEqual(hit('cc @design!'), ['g1']);
    assert.deepEqual(hit('mail@annabelle'), []);
    assert.deepEqual(hit('no mention here'), []);
    assert.deepEqual(hit('@ANNA'), ['u1']);
});

test('comment recipients: author excluded, mention beats comment, task vs other targets', () => {
    const task = fx.planCommentRecipients({ authorId: 'me', targetType: 'task', mentionedUserIds: ['anna', 'me'], assigneeIds: ['anna', 'luis', 'me'], creatorId: 'boss', ownerId: 'boss' });
    assert.deepEqual(task.mentions, ['anna']);
    assert.deepEqual(task.comments.sort(), ['boss', 'luis']);
    const idea = fx.planCommentRecipients({ authorId: 'me', targetType: 'idea', mentionedUserIds: [], assigneeIds: ['x'], creatorId: 'y', ownerId: 'owner' });
    assert.deepEqual(idea.comments, ['owner']);
});

test('actor resolution: updatedBy only when refreshed, else creator / ownerId', () => {
    assert.equal(fx.resolveActorId(null, { updatedBy: 'u', createdBy: 'c', ownerId: 'o' }), 'u');
    assert.equal(fx.resolveActorId(null, { createdBy: 'c', ownerId: 'o' }), 'c');
    assert.equal(fx.resolveActorId({ updatedBy: 'u', updatedAt: '2026-01-01T00:00:00Z' }, { updatedBy: 'u', updatedAt: '2026-01-01T00:00:00Z', ownerId: 'o' }), 'o');
    assert.equal(fx.resolveActorId({ updatedBy: 'u', updatedAt: '2026-01-01T00:00:00Z' }, { updatedBy: 'u', updatedAt: '2026-01-02T00:00:00Z', ownerId: 'o' }), 'u');
    assert.equal(fx.resolveActorId({ updatedBy: 'u', updatedAt: { seconds: 1, nanoseconds: 0 } }, { updatedBy: 'v', updatedAt: { seconds: 1, nanoseconds: 0 } }), 'v');
});

test('systemWriteAt: only a changed (or fresh on create) stamp is a system write', () => {
    const now = Date.parse('2026-10-22T10:00:00Z');
    assert.equal(fx.isSystemWrite(null, { systemWriteAt: '2026-10-22T09:59:00Z' }, now), true);
    assert.equal(fx.isSystemWrite(null, { systemWriteAt: '2026-01-01T00:00:00Z' }, now), false);
    assert.equal(fx.isSystemWrite({ systemWriteAt: 'a' }, { systemWriteAt: 'a' }, now), false);
    assert.equal(fx.isSystemWrite({}, { systemWriteAt: '2026-01-01T00:00:00Z' }, now), true);
    assert.equal(fx.isSystemWrite({}, {}, now), false);
});

test('progress rounds and handles empty projects', () => {
    assert.equal(fx.computeProgress(0, 0), 0);
    assert.equal(fx.computeProgress(3, 1), 33);
    assert.equal(fx.computeProgress(3, 2), 67);
    assert.equal(fx.computeProgress(2, 5), 100);
});

test('toMillis reads Timestamps, seconds objects, ISO strings', () => {
    assert.equal(fx.toMillis({ seconds: 10, nanoseconds: 5e6 }), 10005);
    assert.equal(fx.toMillis({ toMillis: () => 42 }), 42);
    assert.equal(fx.toMillis('2026-01-01T00:00:00Z'), Date.parse('2026-01-01T00:00:00Z'));
    assert.equal(fx.toMillis('nope'), null);
    assert.equal(fx.toMillis(''), null);
});
