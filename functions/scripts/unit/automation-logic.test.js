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

test('AI condition: normalize, three-valued evaluation, verdicts', () => {
    const { evaluateConditionsTri, aiRulesOf, aiQuestionFor, aiVerdictFor } = require('../../lib/automation-logic');
    const def = normalizeAutomation({
        name: 'Blocker', trigger: { type: 'comment.created' },
        conditions: { op: 'and', groups: [{ op: 'and', rules: [
            { field: 'task.priority', operator: 'in', value: ['High'] },
            { field: 'ai', operator: 'ai', ai: { kind: 'predicate', question: 'Beschreibt der Kommentar einen Blocker?', threshold: 1.5 } }
        ] }] },
        actions: [{ type: 'set_status', config: { status: 'Blocked' } }]
    });
    const rule = def.conditions.groups[0].rules[1];
    assert.deepEqual(rule.ai, { kind: 'predicate', question: 'Beschreibt der Kommentar einen Blocker?', threshold: 0.99 });
    // cheap rule false → decided without AI
    assert.equal(evaluateConditionsTri(def.conditions, ctx({ priority: 'Low' })), false);
    // cheap rule true → depends on AI
    assert.equal(evaluateConditionsTri(def.conditions, ctx({ priority: 'High' })), null);
    assert.equal(evaluateConditionsTri(def.conditions, ctx({ priority: 'High' }), { c0_1: true }), true);
    assert.equal(evaluateConditions(def.conditions, ctx({ priority: 'High' })), false, 'unknown counts as not passed');
    const [ai] = aiRulesOf(def.conditions);
    assert.equal(ai.key, 'c0_1');
    assert.equal(aiQuestionFor(ai.key, ai.ai).type, 'predicate');
    assert.equal(aiVerdictFor('c0_1', { kind: 'predicate', question: 'q', threshold: 0.8 }, { type: 'predicate', probability: 0.92 }).passed, true);
    assert.equal(aiVerdictFor('c0_1', { kind: 'predicate', question: 'q', threshold: 0.8 }, { type: 'predicate', probability: 0.5 }).passed, false);
    assert.equal(aiVerdictFor('c0_1', { kind: 'predicate', question: 'q' }, { type: 'refusal' }).refused, true);
    const choice = { kind: 'choice', question: 'Kategorie?', choices: ['Bug', 'Feature', 'Frage'], accept: ['Bug'], minConfidence: 0.6 };
    assert.equal(aiVerdictFor('k', choice, { type: 'choice', choice: 'Bug', confidence: 0.9 }).passed, true);
    assert.equal(aiVerdictFor('k', choice, { type: 'choice', choice: 'Bug', confidence: 0.4 }).passed, false);
    assert.equal(aiVerdictFor('k', choice, { type: 'choice', choice: 'Frage', confidence: 0.9 }).passed, false);
    const score = { kind: 'score', question: 'Dringlichkeit?', levels: 5, minScore: 4 };
    assert.equal(aiQuestionFor('s', score).levels.length, 5);
    // API score is a 0-based weighted index: 3.2 → 4.2 on the 1..5 scale
    assert.deepEqual(aiVerdictFor('s', score, { type: 'score', score: 3.2, confidence: 0.7 }), { key: 's', kind: 'score', question: 'Dringlichkeit?', passed: true, score: 4.2, confidence: 0.7 });
    assert.equal(aiVerdictFor('s', score, { type: 'score', score: 2.1, confidence: 0.7 }).passed, false);
    assert.throws(() => normalizeAutomation({ ...def, conditions: { op: 'and', groups: [{ op: 'and', rules: [{ field: 'ai', ai: { kind: 'choice', question: 'Kategorie?', choices: ['A'] } }] }] } }), /two answers/);
    assert.throws(() => normalizeAutomation({ ...def, conditions: { op: 'and', groups: [{ op: 'and', rules: Array.from({ length: 4 }, () => ({ field: 'ai', ai: { kind: 'predicate', question: 'Frage?' } })) }] } }), /At most 3 AI/);
});

test('AI action modes normalize', () => {
    const ai = (config) => normalizeAutomation({ ...flow(), trigger: { type: 'task.created' }, actions: [{ type: 'ai', config }] }).actions[0].config;
    assert.deepEqual(ai({ mode: 'draft_task', asSubtask: true }), { mode: 'draft_task', instructions: '', asSubtask: true, projectId: null });
    assert.deepEqual(ai({ mode: 'classify_priority' }), { mode: 'classify_priority', instructions: '', minConfidence: 0.5 });
    assert.throws(() => ai({ mode: 'classify_label', options: ['only'] }), /two label options/);
    assert.deepEqual(ai({ mode: 'draft_comment', instructions: 'freundlich' }), { mode: 'draft_comment', instructions: 'freundlich' });
});

test('Flow aus Satz: draft conversion drops unknown refs and broken parts', () => {
    const { draftFromModel, FLOW_DRAFT_SCHEMA } = require('../../lib/automation-draft');
    // strict schema: every object lists all properties as required and forbids extras
    const strictOk = (node) => {
        if (node && typeof node === 'object') {
            if (node.type === 'object') {
                assert.equal(node.additionalProperties, false);
                assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort());
            }
            Object.values(node).forEach(strictOk);
        }
    };
    strictOk(FLOW_DRAFT_SCHEMA.schema);
    const nulls = { status: null, field: null, priority: null, relativeDays: null, assignMode: null, userIds: [], dynamic: [], text: null, title: null,
        message: null, label: null, projectId: null, asSubtask: null, dueInDays: null, minutes: null, aiMode: null, options: null, email: null };
    const draftCtx = { members: [{ uid: 'u1', name: 'Anna' }], projects: [{ id: 'p1', title: 'Web' }], defaultProjectId: null, timezone: 'Europe/Berlin', today: '2026-10-23' };
    const { draft, warnings } = draftFromModel({
        name: 'Blocker melden', description: '', projectId: 'p1',
        trigger: { type: 'comment.created', fromStatus: null, toStatus: null, assigneeId: null, frequency: null, weekday: null, time: null },
        conditionsOp: 'and',
        conditions: [{ field: 'task.assigneeIds', operator: 'contains', values: ['ghost'], number: null }],
        aiCondition: { kind: 'predicate', question: 'Beschreibt der Kommentar einen Blocker?', threshold: 0.8, choices: null, accept: null, levels: null, minScore: null },
        actions: [
            { ...nulls, type: 'set_status', status: 'Blocked' },
            { ...nulls, type: 'notify', userIds: ['u1', 'ghost'], title: '{{task.title}} blockiert' },
            { ...nulls, type: 'move', projectId: 'nope' },
            { ...nulls, type: 'delay', minutes: 60 }
        ]
    }, draftCtx);
    assert.equal(draft.enabled, false);
    assert.equal(draft.scope, 'project');
    assert.equal(draft.projectId, 'p1');
    assert.deepEqual(draft.conditions.groups[0].rules.map((r) => r.field), ['ai']);
    assert.deepEqual(draft.actions.map((a) => a.type), ['set_status', 'notify']);
    assert.deepEqual(draft.actions[1].config.userIds, ['u1']);
    assert.deepEqual(warnings.sort(), ['dropped_action', 'unknown_person', 'unknown_project']);
});

test('AI condition defaults when the model sends null', () => {
    const def = normalizeAutomation({ ...flow(), conditions: { op: 'and', groups: [{ op: 'and', rules: [{ field: 'ai', ai: { kind: 'predicate', question: 'Blocker?', threshold: null } }] }] } });
    assert.equal(def.conditions.groups[0].rules[0].ai.threshold, 0.8);
});

test('flow quota per plan (billing entitlements)', () => {
    const { flowQuotaFor } = require('../../lib/automation-logic');
    assert.deepEqual(flowQuotaFor(null, null), { runsPerMonth: 2000, aiStepsPerMonth: 200, activeFlowsPerWorkspace: 50, tier: 'legacy' });
    assert.deepEqual(flowQuotaFor({ plan: 'free', flowsQuota: 'free' }, {}), { runsPerMonth: 200, aiStepsPerMonth: 0, activeFlowsPerWorkspace: 3, tier: 'free' });
    assert.equal(flowQuotaFor({ plan: 'free' }, {}).tier, 'free', 'plan free without flowsQuota');
    assert.deepEqual(flowQuotaFor({ plan: 'personal', flowsQuota: 'seat', seats: 1 }, {}), { runsPerMonth: 2000, aiStepsPerMonth: 200, activeFlowsPerWorkspace: 50, tier: 'seat' });
    assert.deepEqual(flowQuotaFor({ plan: 'team', flowsQuota: 'seat', seats: 4 }, {}), { runsPerMonth: 8000, aiStepsPerMonth: 800, activeFlowsPerWorkspace: 80, tier: 'seat' });
    assert.equal(flowQuotaFor({ plan: 'team', flowsQuota: 'seat', seats: 40 }, {}).activeFlowsPerWorkspace, 200);
    assert.equal(flowQuotaFor({ plan: 'team', status: 'exempt', flowsQuota: 'seat', seats: 0 }, {}).runsPerMonth, 2000, 'exempt without seats = one seat');
    assert.equal(flowQuotaFor({ plan: 'free', flowsQuota: 'free' }, { limits: { automations: { runsPerMonth: 999 } } }).runsPerMonth, 999, 'admin override wins');
});

test('security review M5/M6: runtime owner check and locked projects', () => {
    const { ownerMayRun, lockedProjectsOf } = require('../../lib/automation-logic');
    const project = { ownerId: 'po' };
    assert.equal(ownerMayRun({ role: 'Admin', uid: 'a', scope: 'workspace', project: null, allowMemberFlows: true }), true);
    assert.equal(ownerMayRun({ role: 'Member', uid: 'm', scope: 'workspace', project: null, allowMemberFlows: true }), false, 'demoted admin: workspace flow');
    assert.equal(ownerMayRun({ role: 'Member', uid: 'm', scope: 'project', project, allowMemberFlows: true }), true);
    assert.equal(ownerMayRun({ role: 'Member', uid: 'm', scope: 'project', project, allowMemberFlows: false }), false, 'member policy switched off');
    assert.equal(ownerMayRun({ role: 'Member', uid: 'po', scope: 'project', project, allowMemberFlows: false }), true, 'project owner keeps it');
    assert.equal(ownerMayRun({ role: 'Admin', uid: 'a', scope: 'project', project: null, allowMemberFlows: true }), false, 'project deleted');
    assert.equal(ownerMayRun({ role: 'Guest', uid: 'g', scope: 'project', project, allowMemberFlows: true }), false);
    assert.deepEqual([...lockedProjectsOf({ lockedProjectIds: ['p4', 7, 'p5'] })], ['p4', 'p5']);
    assert.equal(lockedProjectsOf(null).size, 0);
});
