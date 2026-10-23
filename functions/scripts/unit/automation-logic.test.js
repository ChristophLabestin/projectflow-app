// Unit test: Flows engine logic (brain/plans/flows-concept.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeAutomation, matchesTrigger, loopGuard, evaluateConditions, renderTemplate, planTaskPatch, computeNextRunAt,
    checkLimits, nextFailureState, canManageAutomation, resolveLimits, subjectTaskId, dueScanDate, slotKey, AUTOMATION_LIMITS,
    AutomationValidationError, resolvePeople, statusTransition
} = require('../../lib/automation-logic');

const flow = (overrides = {}) => normalizeAutomation({
    name: 'Done → notify',
    trigger: { type: 'task.status_changed', config: { toStatus: 'Done' } },
    actions: [{ type: 'notify', config: { dynamic: ['creator'], title: 'Done: {{task.title}}' } }],
    ...overrides
});

const ctx = (task, extra = {}) => ({ task, taskId: 't1', projectId: 'p1', actorId: 'u1', commentText: '', today: '2026-10-23', ...extra });
const people = { task: null, actorId: 'u1', projectOwnerId: 'po', adminIds: ['a1'], flowOwnerId: 'fo', eventUserIds: ['n1'], today: '2026-10-23' };

test('normalize: defaults, ids, validation', () => {
    const def = flow();
    assert.equal(def.scope, 'workspace');
    assert.equal(def.projectId, null);
    assert.equal(def.enabled, true);
    assert.equal(def.allowAutomationTrigger, false);
    assert.equal(def.actions[0].id, 'a1');
    assert.deepEqual(def.actions[0].config.channels, { push: true, email: false });
    assert.throws(() => flow({ name: '' }), AutomationValidationError);
    assert.throws(() => flow({ actions: [] }), /at least one action/);
    assert.throws(() => flow({ trigger: { type: 'nope' } }), /Unknown trigger/);
    assert.throws(() => flow({ scope: 'project' }), /need a project/);
    assert.throws(() => flow({ actions: [{ type: 'set_status', config: { status: 'Done' } }, { type: 'delay', config: { minutes: 60 } }] }), /end with a delay/);
    assert.throws(() => flow({ actions: [{ type: 'delay', config: { minutes: 5 } }, { type: 'comment', config: { text: 'x' } }] }), /Delay must be/);
    assert.throws(() => flow({ actions: Array.from({ length: 11 }, () => ({ type: 'comment', config: { text: 'x' } })) }), /At most 10/);
    assert.throws(() => flow({ trigger: { type: 'schedule' }, actions: [{ type: 'set_status', config: { status: 'Done' } }] }), /no task/);
});

test('normalize: schedule and due trigger configs', () => {
    const weekly = flow({ trigger: { type: 'schedule', config: { schedule: { frequency: 'weekly', time: '9:00', weekday: 9, timezone: 'Mars/Base' } } },
        actions: [{ type: 'create_task', config: { title: 'Wochenplanung', projectId: 'p1' } }] });
    assert.deepEqual(weekly.trigger.config.schedule, { frequency: 'weekly', time: '09:00', timezone: 'Europe/Berlin', weekday: 7 });
    const due = flow({ trigger: { type: 'task.overdue', config: {} } });
    assert.deepEqual(due.trigger.config, { time: '08:00', timezone: 'Europe/Berlin' });
});

test('matchesTrigger: status transitions incl. completed/reopened', () => {
    const def = flow();
    assert.equal(matchesTrigger(def, { id: 'e', type: 'task.completed', projectId: 'p1' }), true);
    assert.equal(matchesTrigger(def, { id: 'e', type: 'task.status_changed', projectId: 'p1', changes: { status: { from: 'Open', to: 'Review' } } }), false);
    const review = flow({ trigger: { type: 'task.status_changed', config: { toStatus: 'Review', fromStatus: 'In Progress' } } });
    assert.equal(matchesTrigger(review, { type: 'task.status_changed', changes: { status: { from: 'In Progress', to: 'Review' } } }), true);
    assert.equal(matchesTrigger(review, { type: 'task.status_changed', changes: { status: { from: 'Open', to: 'Review' } } }), false);
    assert.deepEqual(statusTransition({ type: 'task.reopened' }), { from: 'Done', to: null });
    assert.equal(matchesTrigger(def, { type: 'task.created' }), false);
});

test('matchesTrigger: project scope, assignee filter, comment parent', () => {
    const scoped = flow({ scope: 'project', projectId: 'p1' });
    assert.equal(matchesTrigger(scoped, { type: 'task.completed', projectId: 'p2' }), false);
    assert.equal(matchesTrigger(scoped, { type: 'task.completed', projectId: 'p1' }), true);
    const assigned = flow({ trigger: { type: 'task.assigned', config: { assigneeId: 'u9' } } });
    assert.equal(matchesTrigger(assigned, { type: 'task.assigned', meta: { assigneeIds: ['u1'] } }), false);
    assert.equal(matchesTrigger(assigned, { type: 'task.assigned', meta: { assigneeIds: ['u9'] } }), true);
    const comment = flow({ trigger: { type: 'comment.created' } });
    assert.equal(matchesTrigger(comment, { type: 'comment.created', object: { parentType: 'initiative' } }), false);
    assert.equal(subjectTaskId({ object: { type: 'comment', id: 'c', parentType: 'task', parentId: 't9' } }), 't9');
    assert.equal(subjectTaskId({ object: { type: 'task', id: 't1' } }), 't1');
});

test('loopGuard: self, opt-in chains, max depth', () => {
    const def = flow();
    assert.deepEqual(loopGuard('A', def, null), { ok: true, depth: 1 });
    assert.deepEqual(loopGuard('A', def, { kind: 'user', id: 'u1', depth: 0 }), { ok: true, depth: 1 });
    assert.deepEqual(loopGuard('A', def, { kind: 'automation', id: 'A', depth: 1 }), { ok: false, reason: 'self' });
    assert.deepEqual(loopGuard('A', def, { kind: 'automation', id: 'B', depth: 1 }), { ok: false, reason: 'chain_disabled' });
    const chain = { ...def, allowAutomationTrigger: true };
    assert.deepEqual(loopGuard('A', chain, { kind: 'automation', id: 'B', depth: 1 }), { ok: true, depth: 2 });
    assert.deepEqual(loopGuard('A', chain, { kind: 'automation', id: 'B', depth: 2 }), { ok: true, depth: 3 });
    assert.deepEqual(loopGuard('A', chain, { kind: 'automation', id: 'B', depth: 3 }), { ok: false, reason: 'depth' });
    // A → B → A: A ignores B's write once depth is exhausted, and its own writes always.
    assert.equal(loopGuard('A', chain, { kind: 'automation', id: 'A', depth: 2 }).ok, false);
});

test('conditions: AND/OR groups and operators', () => {
    const task = { status: 'Open', priority: 'High', category: ['Bug'], assigneeIds: [], createdBy: 'c1', dueDate: '2026-10-25', title: 'Fix login' };
    const run = (groups, op = 'and') => evaluateConditions(normalizeAutomation({ ...flow(), conditions: { op, groups } }).conditions, ctx(task));
    assert.equal(run([]), true);
    assert.equal(run([{ rules: [{ field: 'task.priority', operator: 'in', value: ['High', 'Urgent'] }] }]), true);
    assert.equal(run([{ rules: [{ field: 'task.assigneeIds', operator: 'empty' }, { field: 'task.labels', operator: 'contains', value: 'bug' }] }]), true);
    assert.equal(run([{ op: 'or', rules: [{ field: 'task.status', operator: 'eq', value: 'Done' }, { field: 'task.title', operator: 'contains', value: 'login' }] }]), true);
    assert.equal(run([{ rules: [{ field: 'task.status', operator: 'eq', value: 'Done' }] }, { rules: [{ field: 'task.priority', operator: 'eq', value: 'High' }] }], 'or'), true);
    assert.equal(run([{ rules: [{ field: 'task.status', operator: 'eq', value: 'Done' }] }, { rules: [{ field: 'task.priority', operator: 'eq', value: 'High' }] }], 'and'), false);
    assert.equal(run([{ rules: [{ field: 'task.dueDate', operator: 'due_within_days', value: 3 }] }]), true);
    assert.equal(run([{ rules: [{ field: 'task.dueDate', operator: 'lt', value: '2026-10-24' }] }]), false);
    assert.equal(run([{ rules: [{ field: 'task.labels', operator: 'not_contains', value: 'Feature' }] }]), true);
    assert.equal(run([{ rules: [{ field: 'task.isSubtask', operator: 'eq', value: true }] }]), false);
    assert.equal(run([{ rules: [{ field: 'project.id', operator: 'eq', value: 'p1' }] }]), true);
    assert.equal(evaluateConditions({ op: 'and', groups: [{ op: 'and', rules: [{ field: 'comment.text', operator: 'contains', value: 'blockiert' }] }] },
        ctx(task, { commentText: 'Ich bin BLOCKIERT wegen API' })), true);
});

test('renderTemplate: known and unknown variables', () => {
    assert.deepEqual(renderTemplate('Done: {{ task.title }} by {{actor.name}}{{nope}}', { 'task.title': 'A', 'actor.name': 'Bo' }),
        { text: 'Done: A by Bo', unknown: ['nope'] });
});

test('planTaskPatch: no-ops produce no write', () => {
    const task = { status: 'Review', priority: 'High', category: ['urgent'], assigneeIds: ['u1'], dueDate: '2026-10-26' };
    const plan = (type, config) => planTaskPatch({ id: 'a', type, config }, task, { ...people, task });
    assert.equal(plan('set_status', { status: 'Review' }), null);
    assert.deepEqual(plan('set_status', { status: 'Done' }), { status: 'Done', isCompleted: true });
    assert.equal(plan('set_field', { field: 'priority', value: 'High' }), null);
    assert.equal(plan('set_field', { field: 'dueDate', relativeDays: 3 }), null);
    assert.deepEqual(plan('set_field', { field: 'dueDate', relativeDays: 1 }), { dueDate: '2026-10-24' });
    assert.equal(plan('add_label', { label: 'URGENT' }), null);
    assert.deepEqual(plan('add_label', { label: 'qa' }), { category: ['urgent', 'qa'] });
    assert.deepEqual(plan('remove_label', { label: 'urgent' }), { category: [] });
    assert.equal(plan('assign', { mode: 'add', userIds: ['u1'], dynamic: [] }), null);
    assert.deepEqual(plan('assign', { mode: 'add', userIds: [], dynamic: ['project_owner'] }), { assigneeIds: ['u1', 'po'], assigneeId: 'u1' });
    assert.deepEqual(plan('assign', { mode: 'clear', userIds: [], dynamic: [] }), { assigneeIds: [], assigneeId: null });
});

test('resolvePeople: dynamic roles', () => {
    const task = { assigneeIds: ['x'], assigneeId: 'y', createdBy: 'c' };
    assert.deepEqual(resolvePeople({ userIds: ['z'], dynamic: ['assignees', 'creator', 'admins', 'event_users'] }, { ...people, task }).sort(),
        ['a1', 'c', 'n1', 'x', 'y', 'z']);
});

test('computeNextRunAt: daily, weekly, due checks in zone', () => {
    const now = Date.parse('2026-10-23T10:00:00Z'); // Friday, 12:00 Berlin (CEST)
    const daily = flow({ trigger: { type: 'schedule', config: { schedule: { frequency: 'daily', time: '09:00' } } }, actions: [{ type: 'notify', config: { dynamic: ['admins'], title: 'x' } }] });
    assert.equal(new Date(computeNextRunAt(daily.trigger, now)).toISOString(), '2026-10-24T07:00:00.000Z');
    const monday = flow({ trigger: { type: 'schedule', config: { schedule: { frequency: 'weekly', time: '09:00', weekday: 1 } } }, actions: [{ type: 'notify', config: { dynamic: ['admins'], title: 'x' } }] });
    // 2026-10-25 is the DST switch: Monday 26th 09:00 CET = 08:00Z.
    assert.equal(new Date(computeNextRunAt(monday.trigger, now)).toISOString(), '2026-10-26T08:00:00.000Z');
    assert.equal(computeNextRunAt(flow().trigger, now), null);
    const overdue = flow({ trigger: { type: 'task.overdue' } });
    assert.equal(dueScanDate(overdue.trigger, now), '2026-10-22');
    assert.equal(slotKey(overdue.trigger, Date.parse('2026-10-23T06:00:00Z')), '2026-10-23T0800');
});

test('limits, failures, permissions', () => {
    const limits = resolveLimits({ limits: { automations: { runsPerMonth: 10 } } });
    assert.equal(limits.runsPerMonth, 10);
    assert.equal(limits.aiStepsPerMonth, AUTOMATION_LIMITS.aiStepsPerMonth);
    assert.deepEqual(checkLimits({ monthRuns: 10, minuteRuns: 0, entityHourRuns: 0, limits }), { ok: false, reason: 'month' });
    assert.deepEqual(checkLimits({ monthRuns: 0, minuteRuns: 60, entityHourRuns: 0, limits }), { ok: false, reason: 'minute' });
    assert.deepEqual(checkLimits({ monthRuns: 0, minuteRuns: 0, entityHourRuns: 5, limits }), { ok: false, reason: 'entity' });
    assert.deepEqual(checkLimits({ monthRuns: 0, minuteRuns: 0, entityHourRuns: 4, limits }), { ok: true });
    assert.deepEqual(nextFailureState(3, true), { consecutiveFailures: 4, pause: false });
    assert.deepEqual(nextFailureState(4, true), { consecutiveFailures: 5, pause: true });
    assert.deepEqual(nextFailureState(4, false), { consecutiveFailures: 0, pause: false });
    const base = { uid: 'u', allowMemberFlows: true };
    assert.equal(canManageAutomation({ ...base, role: 'Admin', scope: 'workspace' }), true);
    assert.equal(canManageAutomation({ ...base, role: 'Member', scope: 'workspace' }), false);
    assert.equal(canManageAutomation({ ...base, role: 'Member', scope: 'project', project: { ownerId: 'x' } }), true);
    assert.equal(canManageAutomation({ ...base, allowMemberFlows: false, role: 'Member', scope: 'project', project: { ownerId: 'x' } }), false);
    assert.equal(canManageAutomation({ ...base, allowMemberFlows: false, role: 'Member', scope: 'project', project: { ownerId: 'u' } }), true);
    assert.equal(canManageAutomation({ ...base, role: 'Guest', scope: 'project', project: { ownerId: 'u' } }), false);
});

test('flow notifications use the channels chosen in the flow', () => {
    const { decideChannels, resolveNotificationPrefs } = require('../../lib/notification-prefs');
    const prefs = resolveNotificationPrefs({});
    assert.deepEqual(decideChannels('automation_notice', prefs, { push: true, email: true }), { push: true, email: true, category: 'automation' });
    assert.deepEqual(decideChannels('automation_notice', prefs, { push: false }), { push: false, email: false, category: 'automation' });
    assert.deepEqual(decideChannels('automation_notice', prefs, undefined), { push: true, email: false, category: 'automation' });
});
