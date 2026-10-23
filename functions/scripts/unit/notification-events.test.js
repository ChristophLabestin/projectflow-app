// Unit tests for the Notification Center event planning (status / due / member / overdue + params).
const test = require('node:test');
const assert = require('node:assert/strict');
const fx = require('../../lib/task-effects');
const nl = require('../../lib/nudge-logic');
const prefs = require('../../lib/notification-prefs');

const byType = (list, type) => list.filter((n) => n.type === type);
const ids = (list) => list.map((n) => n.userId).sort();

test('status change: assignees + creator minus actor, with params', () => {
    const before = { title: 'T', status: 'Open', assigneeIds: ['a', 'b'], createdBy: 'c' };
    const after = { ...before, status: 'In Progress' };
    const out = fx.planTaskNotifications(before, after, 'a', 'Ann');
    const status = byType(out, 'task_status_changed');
    assert.deepEqual(ids(status), ['b', 'c']);
    assert.deepEqual(status[0].params, { taskTitle: 'T', status: 'In Progress', previousStatus: 'Open' });
    assert.equal(status[0].message, 'Ann moved "T" to In Progress');
});

test('status change to Done: creator gets only task_completed', () => {
    const before = { title: 'T', status: 'Open', assigneeIds: ['a', 'b'], createdBy: 'c' };
    const after = { ...before, status: 'Done', isCompleted: true };
    const out = fx.planTaskNotifications(before, after, 'a', 'Ann');
    assert.deepEqual(ids(byType(out, 'task_completed')), ['c']);
    assert.deepEqual(ids(byType(out, 'task_status_changed')), ['b']);
    assert.deepEqual(byType(out, 'task_completed')[0].params, { taskTitle: 'T' });
});

test('status change: creator who is the actor of a completion gets nothing', () => {
    const before = { title: 'T', status: 'Open', assigneeIds: ['b'], createdBy: 'c' };
    const after = { ...before, status: 'Done', isCompleted: true };
    const out = fx.planTaskNotifications(before, after, 'c', 'Cy');
    assert.deepEqual(ids(out), ['b']);
});

test('status change skips newly assigned users and creates', () => {
    const before = { title: 'T', status: 'Open', assigneeIds: ['a'], createdBy: 'c' };
    const after = { ...before, status: 'Blocked', assigneeIds: ['a', 'n'] };
    const out = fx.planTaskNotifications(before, after, 'x', 'X');
    assert.deepEqual(ids(byType(out, 'task_assigned')), ['n']);
    assert.deepEqual(ids(byType(out, 'task_status_changed')), ['a', 'c']);
    assert.deepEqual(fx.planTaskNotifications(null, after, 'x', 'X').map((n) => n.type).sort(), ['task_assigned', 'task_assigned']);
});

test('due date change: assignees minus actor and newly assigned; removal keeps empty dueDate', () => {
    const before = { title: 'T', status: 'Open', dueDate: '2026-11-01', assigneeIds: ['a', 'b'], createdBy: 'c' };
    const after = { ...before, dueDate: '2026-11-05', assigneeIds: ['a', 'b', 'n'] };
    let due = byType(fx.planTaskNotifications(before, after, 'a', 'Ann'), 'task_due_changed');
    assert.deepEqual(ids(due), ['b']);
    assert.deepEqual(due[0].params, { taskTitle: 'T', dueDate: '2026-11-05', previousDueDate: '2026-11-01' });

    due = byType(fx.planTaskNotifications(before, { ...before, dueDate: '' }, 'x', 'X'), 'task_due_changed');
    assert.deepEqual(due[0].params, { taskTitle: 'T', dueDate: '', previousDueDate: '2026-11-01' });
});

test('due date change: none when equal, done, or create', () => {
    const before = { title: 'T', dueDate: '2026-11-01', assigneeIds: ['a'] };
    assert.equal(byType(fx.planTaskNotifications(before, { ...before }, 'x', 'X'), 'task_due_changed').length, 0);
    assert.equal(byType(fx.planTaskNotifications(before, { ...before, dueDate: '2026-12-01', status: 'Done', isCompleted: true }, 'x', 'X'), 'task_due_changed').length, 0);
    assert.equal(byType(fx.planTaskNotifications(null, before, 'x', 'X'), 'task_due_changed').length, 0);
});

test('params: assigned/subtask contain only non-empty values', () => {
    const out = fx.planTaskNotifications(null, { title: 'T', assigneeIds: ['a'] }, 'x', 'X');
    assert.deepEqual(out[0].params, { taskTitle: 'T' });
    const sub = fx.planSubtaskNotifications(null, { title: 'S', assigneeId: 'a' }, 'Parent', 'x');
    assert.deepEqual(sub[0].params, { subtaskTitle: 'S', taskTitle: 'Parent' });
    assert.deepEqual(fx.compactParams({ a: '', b: 'x', c: undefined }), { b: 'x' });
});

const project = (extra) => ({ title: 'P', ownerId: 'o', memberIds: ['o'], members: [], ...extra });

test('member diff: admin add notifies added member with actor from invitedBy', () => {
    const before = project();
    const after = project({
        memberIds: ['o', 'm'],
        members: [{ userId: 'm', invitedBy: 'o', displayName: 'Mia', email: 'm@x' }]
    });
    assert.deepEqual(fx.diffProjectMembers(before, after), [{ userId: 'm', actorId: 'o' }]);
    const out = fx.planProjectMemberNotifications(before, after, (uid) => (uid === 'o' ? 'Olga' : uid));
    assert.equal(out.length, 1);
    assert.equal(out[0].type, 'project_member_added');
    assert.equal(out[0].userId, 'm');
    assert.equal(out[0].actorId, 'o');
    assert.deepEqual(out[0].params, { projectTitle: 'P' });
    assert.equal(out[0].message, 'Olga added you to "P"');
});

test('member diff: self-join notifies the owner only', () => {
    const before = project();
    const after = project({ memberIds: ['o', 'm'], members: [{ userId: 'm', invitedBy: 'o', role: 'Member' }] });
    const out = fx.planProjectMemberNotifications(before, after);
    assert.deepEqual(out.map((n) => [n.type, n.userId, n.actorId]), [['project_member_joined', 'o', 'm']]);
    assert.deepEqual(out[0].params, { projectTitle: 'P' });
});

test('member diff: owner joining themselves, creates, unchanged, unknown actor', () => {
    const joined = project({ memberIds: ['o', 'o2'], members: [{ userId: 'o2', invitedBy: 'o' }], ownerId: 'o2' });
    assert.equal(fx.planProjectMemberNotifications(project(), joined).length, 0);
    assert.equal(fx.planProjectMemberNotifications(null, joined).length, 0);
    assert.equal(fx.planProjectMemberNotifications(project(), project()).length, 0);
    const unknown = project({ memberIds: ['o', 'z'] });
    const out = fx.planProjectMemberNotifications(project(), unknown);
    assert.equal(out[0].type, 'project_member_added');
    assert.equal(out[0].actorId, '');
    assert.equal(out[0].message, 'You were added to "P"');
});

test('member diff: refreshed updatedBy wins and skips the actor', () => {
    const before = project({ updatedBy: 'o' });
    const after = project({ memberIds: ['o', 'm', 'k'], updatedBy: 'm', updatedAt: { seconds: 5 } });
    const out = fx.planProjectMemberNotifications(before, after);
    assert.deepEqual(out.map((n) => [n.type, n.userId]), [['project_member_joined', 'o'], ['project_member_added', 'k']]);
});

test('category / apns mapping for new types', () => {
    assert.equal(prefs.categoryForType('task_status_changed'), 'comments');
    assert.equal(prefs.categoryForType('task_due_changed'), 'due');
    assert.equal(prefs.categoryForType('task_overdue'), 'due');
    assert.equal(prefs.categoryForType('project_member_added'), 'assignments');
    assert.equal(prefs.categoryForType('project_member_joined'), 'comments');
    assert.equal(prefs.buildDeepLink({ projectId: 'p' }), '/project/p');
});

// 2026-10-23 09:00 in Europe/Berlin (UTC+2) = 07:00Z; Berlin local day is 2026-10-23.
const NOW = Date.parse('2026-10-23T07:00:00Z');
const dt = (o) => ({ id: 'x', title: 'T', taskId: 't1', projectId: 'p1', tenantId: 'ten', ...o });

test('overdue: local-day logic and deterministic id', () => {
    const tz = 'Europe/Berlin';
    const out = nl.planOverdueNotifications([
        dt({ dueDate: '2026-10-22' }),
        dt({ taskId: 't2', dueDate: '2026-10-23' }),
        dt({ taskId: 't3', dueDate: '2026-10-24' }),
        dt({ taskId: 't4', dueDate: '2026-10-20', status: 'Done' }),
        dt({ taskId: 't5', dueDate: '2026-10-01', isCompleted: true }),
        dt({ taskId: undefined, dueDate: '2026-10-01' }),
        dt({ taskId: 't6', dueDate: '' })
    ], NOW, tz, 'u1');
    assert.equal(out.length, 1);
    assert.equal(out[0].docId, 'overdue-t1-2026-10-22-u1');
    assert.equal(out[0].dueDate, '2026-10-22');
    // Same instant is "yesterday" in Berlin but still "today" in Los Angeles for a timestamp due.
    const ts = '2026-10-23T01:00:00Z'; // Berlin 03:00 on the 23rd, LA 18:00 on the 22nd
    const late = Date.parse('2026-10-23T22:30:00Z'); // Berlin 00:30 on the 24th, LA 15:30 on the 23rd
    assert.equal(nl.planOverdueNotifications([dt({ dueDate: ts })], late, 'Europe/Berlin', 'u').length, 1);
    assert.equal(nl.planOverdueNotifications([dt({ dueDate: ts })], late, 'America/Los_Angeles', 'u').length, 1);
    assert.equal(nl.planOverdueNotifications([dt({ dueDate: ts })], Date.parse('2026-10-23T05:00:00Z'), 'America/Los_Angeles', 'u').length, 0);
});

test('overdue: changed due date yields a new id, same date the same id', () => {
    const a = nl.planOverdueNotifications([dt({ dueDate: '2026-10-20' })], NOW, 'Europe/Berlin', 'u')[0].docId;
    const b = nl.planOverdueNotifications([dt({ dueDate: '2026-10-21' })], NOW, 'Europe/Berlin', 'u')[0].docId;
    const a2 = nl.planOverdueNotifications([dt({ dueDate: '2026-10-20' })], NOW + 86400000, 'Europe/Berlin', 'u')[0].docId;
    assert.notEqual(a, b);
    assert.equal(a, a2);
});

test('overdue check gate: independent of toggles, starts at 08:00 local or briefing time', () => {
    const base = prefs.resolveNotificationPrefs({ timezone: 'Europe/Berlin' });
    assert.equal(nl.isOverdueCheckDue(Date.parse('2026-10-23T05:30:00Z'), base), false); // 07:30 local
    assert.equal(nl.isOverdueCheckDue(Date.parse('2026-10-23T06:00:00Z'), base), true); // 08:00 local
    const briefing = prefs.resolveNotificationPrefs({ timezone: 'Europe/Berlin', morningBriefing: { enabled: true, time: '09:30' } });
    assert.equal(nl.isOverdueCheckDue(Date.parse('2026-10-23T06:00:00Z'), briefing), false);
    assert.equal(nl.isOverdueCheckDue(Date.parse('2026-10-23T07:30:00Z'), briefing), true);
});
