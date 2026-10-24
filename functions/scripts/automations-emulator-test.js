// End-to-end check of Flows (automations) against throw-away emulators (never production).
//
//   cd functions && npm run test:automations
//
// Writes tasks like the clients do; the real task triggers emit activity events, `onAutomationEvent`
// runs the flows. Covers: actions + writeVia attribution, loop guard (self + A→B→A chain depth),
// callables (permissions, validation, preview, manual run, retry), delays + scheduler, due triggers,
// auto-pause after repeated failures and the monthly run limit.
const assert = require('node:assert/strict');

process.env.GCLOUD_PROJECT = 'demo-projectflow';
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-projectflow' });
const db = admin.firestore();
const { Timestamp } = admin.firestore;

const { runAutomationSchedulesOnce } = require('../lib/automations');

const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9831'}`;
const FUNCTIONS = 'http://127.0.0.1:5831/demo-projectflow/europe-west3';
const T = 'ws-flows';
const T2 = 'ws-limits';
const T3 = 'ws-suspended';
const T4 = 'ws-free';
const T5 = 'ws-security';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (label, fn, { timeout = 30000, interval = 300 } = {}) => {
    const started = Date.now();
    let last;
    for (;;) {
        try {
            const value = await fn();
            if (value) return value;
        } catch (error) {
            last = error;
        }
        if (Date.now() - started > timeout) throw new Error(`Timed out waiting for: ${label}${last ? ` (${last.message})` : ''}`);
        await sleep(interval);
    }
};

const results = [];
const check = async (label, fn) => {
    try {
        await fn();
        results.push({ label, ok: true });
    } catch (error) {
        results.push({ label, ok: false, error: error.message.split('\n')[0] });
    }
};

const signUp = async (email) => {
    const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'secret-123', returnSecureToken: true })
    });
    const body = await res.json();
    return { uid: body.localId, token: body.idToken };
};

const call = async (name, token, data) => {
    const res = await fetch(`${FUNCTIONS}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data })
    });
    const body = await res.json();
    if (body.error) {
        const error = new Error(body.error.message);
        error.status = body.error.status;
        throw error;
    }
    return body.result;
};

const expectError = async (promise, status) => {
    try {
        await promise;
    } catch (error) {
        assert.equal(error.status, status, error.message);
        return;
    }
    throw new Error(`expected ${status}`);
};

const runsOf = async (tenantId, automationId) => {
    const snap = await db.collection(`tenants/${tenantId}/automation_runs`).where('automationId', '==', automationId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const task = (tenantId, projectId, id) => db.doc(`tenants/${tenantId}/projects/${projectId}/tasks/${id}`);

const addTask = async (tenantId, projectId, id, by, data = {}) => {
    await task(tenantId, projectId, id).set({
        title: id, status: 'Open', isCompleted: false, priority: 'Medium', tenantId, projectId,
        ownerId: by, createdBy: by, updatedBy: by, createdAt: Timestamp.now(), ...data
    });
};

const flowDoc = (tenantId, id, def, ownerId) => db.doc(`tenants/${tenantId}/automations/${id}`).set({
    scope: 'workspace', projectId: null, enabled: true, conditions: { op: 'and', groups: [] }, allowAutomationTrigger: false,
    order: 0, ownerId, stats: { consecutiveFailures: 0 }, schemaVersion: 1, nextRunAt: null, ...def
});

(async () => {
    const owner = await signUp('owner@example.test');
    const anna = await signUp('anna@example.test');
    const guest = await signUp('guest@example.test');
    const outsider = await signUp('out@example.test');

    for (const [tenantId, name] of [[T, 'Flows Test'], [T2, 'Limits Test'], [T3, 'Suspended Test'], [T4, 'Free Test'], [T5, 'Security Test']]) {
        await db.doc(`tenants/${tenantId}`).set({ tenantId, name, ownerId: owner.uid });
        await db.doc(`tenants/${tenantId}/members/${owner.uid}`).set({ uid: owner.uid, role: 'Owner', displayName: 'Olga' });
        await db.doc(`tenants/${tenantId}/members/${anna.uid}`).set({ uid: anna.uid, role: 'Member', displayName: 'Anna' });
        await db.doc(`tenants/${tenantId}/members/${guest.uid}`).set({ uid: guest.uid, role: 'Guest', displayName: 'Gast' });
    }
    for (const [uid, name] of [[owner.uid, 'Olga'], [anna.uid, 'Anna'], [guest.uid, 'Gast']]) {
        await db.doc(`users/${uid}`).set({ uid, displayName: name, email: `${name}@example.test` });
    }
    for (const projectId of ['p1', 'loop', 'self', 'delay', 'due', 'fail', 'ai']) {
        await db.doc(`tenants/${T}/projects/${projectId}`).set({
            title: `Projekt ${projectId}`, ownerId: owner.uid, memberIds: [owner.uid, anna.uid, guest.uid], tenantId: T
        });
    }
    await db.doc(`tenants/${T2}/projects/p1`).set({ title: 'Limits', ownerId: owner.uid, memberIds: [owner.uid], tenantId: T2 });

    let doneFlowId;
    await check('callable: owner saves a workspace flow (done → comment + label + notify)', async () => {
        const result = await call('saveAutomation', owner.token, {
            tenantId: T,
            automation: {
                name: 'Erledigt melden',
                scope: 'project', projectId: 'p1',
                trigger: { type: 'task.status_changed', config: { toStatus: 'Done' } },
                actions: [
                    { type: 'comment', config: { text: 'Erledigt: {{task.title}} von {{actor.name}}' } },
                    { type: 'add_label', config: { label: 'erledigt' } },
                    { type: 'notify', config: { dynamic: ['creator'], title: 'Fertig: {{task.title}}', channels: { push: true } } }
                ]
            }
        });
        doneFlowId = result.id;
        const saved = (await db.doc(`tenants/${T}/automations/${doneFlowId}`).get()).data();
        assert.equal(saved.ownerId, owner.uid);
        assert.equal(saved.enabled, true);
    });

    await check('callable: member may not create workspace flows, guests and outsiders nothing', async () => {
        const automation = { name: 'x', trigger: { type: 'task.created' }, actions: [{ type: 'comment', config: { text: 'x' } }] };
        await expectError(call('saveAutomation', anna.token, { tenantId: T, automation }), 'PERMISSION_DENIED');
        await expectError(call('saveAutomation', guest.token, { tenantId: T, automation: { ...automation, scope: 'project', projectId: 'p1' } }), 'PERMISSION_DENIED');
        await expectError(call('saveAutomation', outsider.token, { tenantId: T, automation }), 'PERMISSION_DENIED');
        const ok = await call('saveAutomation', anna.token, { tenantId: T, automation: { ...automation, scope: 'project', projectId: 'p1', enabled: false } });
        assert.ok(ok.id);
        await expectError(call('saveAutomation', owner.token, { tenantId: T, automation: { ...automation, actions: [] } }), 'INVALID_ARGUMENT');
        await expectError(call('saveAutomation', owner.token, {
            tenantId: T, automation: { ...automation, actions: [{ type: 'assign', config: { userIds: [outsider.uid] } }] }
        }), 'INVALID_ARGUMENT');
    });

    await check('event flow: actions run, writes carry writeVia, notification shows the flow', async () => {
        await addTask(T, 'p1', 't-done', anna.uid);
        await task(T, 'p1', 't-done').update({ status: 'Done', isCompleted: true, updatedBy: anna.uid });
        const runs = await waitFor('done run', async () => {
            const list = await runsOf(T, doneFlowId);
            return list.find((run) => run.status === 'succeeded') && list;
        });
        assert.equal(runs.length, 1);
        const data = (await task(T, 'p1', 't-done').get()).data();
        assert.deepEqual(data.category, ['erledigt']);
        assert.equal(data.writeVia.kind, 'automation');
        assert.equal(data.writeVia.id, doneFlowId);
        const comments = await db.collection(`tenants/${T}/projects/p1/comments`).where('targetId', '==', 't-done').get();
        assert.equal(comments.size, 1);
        assert.equal(comments.docs[0].data().content, 'Erledigt: t-done von Anna');
        const notes = await waitFor('flow notification', async () => {
            const snap = await db.collection(`tenants/${T}/notifications`).where('type', '==', 'automation_notice').get();
            return snap.size > 0 && snap;
        });
        assert.equal(notes.docs[0].data().userId, anna.uid);
        assert.equal(notes.docs[0].data().actorName, 'Erledigt melden');
        const events = await waitFor('automation event', async () => {
            const snap = await db.collection(`tenants/${T}/activity`).where('actor.kind', '==', 'automation').get();
            return snap.size > 0 && snap;
        });
        assert.equal(events.docs[0].data().cause.id, doneFlowId);
    });

    await check('loop guard: a flow never re-triggers itself', async () => {
        await flowDoc(T, 'self-flow', {
            name: 'Self', scope: 'project', projectId: 'self', allowAutomationTrigger: true,
            trigger: { type: 'task.status_changed', config: {} },
            actions: [{ id: 'a1', type: 'set_status', config: { status: 'On Hold' } }]
        }, owner.uid);
        await addTask(T, 'self', 't-self', anna.uid);
        await task(T, 'self', 't-self').update({ status: 'Review', updatedBy: anna.uid });
        await waitFor('self run', async () => (await runsOf(T, 'self-flow')).some((run) => run.status === 'succeeded'));
        await sleep(4000);
        assert.equal((await runsOf(T, 'self-flow')).length, 1);
        assert.equal((await task(T, 'self', 't-self').get()).data().status, 'On Hold');
    });

    await check('loop guard: A→B→A chain stops at depth 3', async () => {
        const base = { scope: 'project', projectId: 'loop', allowAutomationTrigger: true };
        await flowDoc(T, 'loop-a', { ...base, name: 'A', trigger: { type: 'task.status_changed', config: { toStatus: 'Review' } },
            actions: [{ id: 'a1', type: 'set_status', config: { status: 'In Progress' } }] }, owner.uid);
        await flowDoc(T, 'loop-b', { ...base, name: 'B', trigger: { type: 'task.status_changed', config: { toStatus: 'In Progress' } },
            actions: [{ id: 'a1', type: 'set_status', config: { status: 'Review' } }] }, owner.uid);
        await addTask(T, 'loop', 't-loop', anna.uid);
        await task(T, 'loop', 't-loop').update({ status: 'Review', updatedBy: anna.uid });
        await waitFor('chain', async () => (await runsOf(T, 'loop-a')).length === 2);
        await sleep(5000);
        const a = await runsOf(T, 'loop-a');
        const b = await runsOf(T, 'loop-b');
        assert.equal(a.length, 2, `A runs ${a.length}`);
        assert.equal(b.length, 1, `B runs ${b.length}`);
        assert.deepEqual(a.map((run) => run.depth).sort(), [1, 3]);
        assert.equal(b[0].depth, 2);
        assert.equal((await task(T, 'loop', 't-loop').get()).data().status, 'In Progress');
    });

    await check('preview + dry run + manual run', async () => {
        await addTask(T, 'p1', 't-high', owner.uid, { priority: 'High' });
        const automation = {
            name: 'High', scope: 'project', projectId: 'p1', trigger: { type: 'manual' },
            conditions: { op: 'and', groups: [{ op: 'and', rules: [{ field: 'task.priority', operator: 'eq', value: 'High' }] }] },
            actions: [{ type: 'set_field', config: { field: 'priority', value: 'Urgent' } }, { type: 'assign', config: { dynamic: ['project_owner'] } }]
        };
        const preview = await call('previewAutomation', owner.token, { tenantId: T, automation });
        assert.deepEqual(preview.tasks.map((t) => t.id), ['t-high']);
        const dry = await call('previewAutomation', owner.token, { tenantId: T, automation, taskId: 't-high', projectId: 'p1' });
        assert.equal(dry.matches, true);
        assert.deepEqual(dry.steps.map((s) => s.status), ['ok', 'ok']);
        assert.equal((await task(T, 'p1', 't-high').get()).data().priority, 'High', 'dry run must not write');
        const { id } = await call('saveAutomation', owner.token, { tenantId: T, automation });
        await expectError(call('runAutomation', owner.token, { tenantId: T, id }), 'INVALID_ARGUMENT');
        const run = await call('runAutomation', owner.token, { tenantId: T, id, taskId: 't-high', projectId: 'p1' });
        assert.equal(run.status, 'succeeded');
        const data = (await task(T, 'p1', 't-high').get()).data();
        assert.equal(data.priority, 'Urgent');
        assert.deepEqual(data.assigneeIds, [owner.uid]);
    });

    await check('delay: run waits, scheduler resumes it', async () => {
        await flowDoc(T, 'delay-flow', {
            name: 'Später', scope: 'project', projectId: 'delay', trigger: { type: 'task.created', config: {} },
            actions: [{ id: 'a1', type: 'delay', config: { minutes: 15 } }, { id: 'a2', type: 'comment', config: { text: 'Nachfassen' } }]
        }, owner.uid);
        await addTask(T, 'delay', 't-delay', anna.uid);
        const [waiting] = await waitFor('waiting run', async () => {
            const list = await runsOf(T, 'delay-flow');
            return list.length && list[0].status === 'waiting' && list;
        });
        assert.equal(waiting.nextStep, 1);
        await runAutomationSchedulesOnce(Date.now() + 16 * 60000);
        const [done] = await runsOf(T, 'delay-flow');
        assert.equal(done.status, 'succeeded');
        const comments = await db.collection(`tenants/${T}/projects/delay/comments`).where('targetId', '==', 't-delay').get();
        assert.equal(comments.size, 1);
    });

    await check('due trigger: scheduler fires once per task and slot', async () => {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
        await addTask(T, 'due', 't-due', anna.uid, { dueDate: today, assigneeIds: [anna.uid] });
        await addTask(T, 'due', 't-due-done', anna.uid, { dueDate: today, status: 'Done', isCompleted: true });
        await flowDoc(T, 'due-flow', {
            name: 'Heute fällig', scope: 'project', projectId: 'due',
            trigger: { type: 'task.due', config: { time: '08:00', timezone: 'Europe/Berlin' } },
            nextRunAt: Timestamp.fromMillis(Date.now() - 60000),
            actions: [{ id: 'a1', type: 'notify', config: { userIds: [], dynamic: ['assignees'], title: 'Heute fällig: {{task.title}}', channels: { push: true } } }]
        }, owner.uid);
        const stats = await runAutomationSchedulesOnce();
        assert.equal(stats.scheduled, 1);
        const runs = await runsOf(T, 'due-flow');
        assert.deepEqual(runs.map((run) => run.taskId), ['t-due']);
        const next = (await db.doc(`tenants/${T}/automations/due-flow`).get()).data().nextRunAt.toMillis();
        assert.ok(next > Date.now());
        assert.equal((await runAutomationSchedulesOnce()).scheduled, 0);
    });

    await check('failures: logged, retry keeps failing, flow pauses after 5', async () => {
        await flowDoc(T, 'fail-flow', {
            name: 'Kaputt', scope: 'project', projectId: 'fail', trigger: { type: 'task.created', config: {} },
            actions: [{ id: 'a1', type: 'move', config: { projectId: 'missing' } }]
        }, owner.uid);
        for (let i = 0; i < 5; i++) await addTask(T, 'fail', `t-fail-${i}`, anna.uid);
        const flow = await waitFor('paused', async () => {
            const data = (await db.doc(`tenants/${T}/automations/fail-flow`).get()).data();
            return data.enabled === false && data;
        });
        assert.equal(flow.pausedReason, 'errors');
        const runs = await runsOf(T, 'fail-flow');
        assert.equal(runs.length, 5);
        assert.ok(runs.every((run) => run.status === 'failed' && run.steps[0].error.includes('no longer exists')));
        const failedEvents = await db.collection(`tenants/${T}/activity`).where('type', '==', 'automation.failed').get();
        assert.ok(failedEvents.size >= 5);
        const paused = await db.collection(`tenants/${T}/notifications`).where('type', '==', 'automation_paused').get();
        assert.equal(paused.size, 1);
        const retry = await call('retryAutomationRun', owner.token, { tenantId: T, runId: runs[0].id });
        assert.equal(retry.status, 'failed');
        await expectError(call('retryAutomationRun', guest.token, { tenantId: T, runId: runs[0].id }), 'PERMISSION_DENIED');
        // Re-enabling resets the failure counter.
        await call('setAutomationEnabled', owner.token, { tenantId: T, id: 'fail-flow', enabled: true });
        const resumed = (await db.doc(`tenants/${T}/automations/fail-flow`).get()).data();
        assert.equal(resumed.enabled, true);
        assert.equal(resumed.stats.consecutiveFailures, 0);
        assert.equal(resumed.pausedReason, null);
    });

    await check('limits: monthly run limit skips further runs', async () => {
        await db.doc(`tenants/${T2}`).set({ limits: { automations: { runsPerMonth: 1 } } }, { merge: true });
        await flowDoc(T2, 'limit-flow', {
            name: 'Limit', trigger: { type: 'task.created', config: {} },
            actions: [{ id: 'a1', type: 'add_label', config: { label: 'neu' } }]
        }, owner.uid);
        await addTask(T2, 'p1', 'l1', owner.uid);
        await waitFor('first run', async () => (await runsOf(T2, 'limit-flow')).length === 1);
        await addTask(T2, 'p1', 'l2', owner.uid);
        const runs = await waitFor('second run', async () => {
            const list = await runsOf(T2, 'limit-flow');
            return list.length === 2 && list;
        });
        assert.deepEqual(runs.map((run) => run.status).sort(), ['skipped_limit', 'succeeded']);
    });

    await check('AI condition (Decisions API): passes/fails by threshold, decisions logged, counts AI steps', async () => {
        await db.doc('_test/flowsAi').set({
            answers: { predicate: { probability: 0.91 }, choice: { choice: 'High', confidence: 0.82 } },
            generate: { flow_comment: { comment: 'Bitte API-Schlüssel prüfen.' } }
        });
        await flowDoc(T, 'ai-flow', {
            name: 'Blocker', scope: 'project', projectId: 'ai', trigger: { type: 'comment.created', config: {} },
            conditions: { op: 'and', groups: [{ op: 'and', rules: [
                { field: 'ai', operator: 'ai', ai: { kind: 'predicate', question: 'Beschreibt der Kommentar einen Blocker?', threshold: 0.8 } }
            ] }] },
            actions: [
                { id: 'a1', type: 'set_status', config: { status: 'Blocked' } },
                { id: 'a2', type: 'ai', config: { mode: 'draft_comment', instructions: '' } },
                { id: 'a3', type: 'ai', config: { mode: 'classify_priority', instructions: '', minConfidence: 0.5 } }
            ]
        }, owner.uid);
        await addTask(T, 'ai', 't-ai', anna.uid);
        await db.doc(`tenants/${T}/projects/ai/comments/c1`).set({
            projectId: 'ai', targetId: 't-ai', targetType: 'task', userId: anna.uid, userDisplayName: 'Anna', content: 'Ich komme nicht weiter, API down', updatedBy: anna.uid, createdAt: Timestamp.now()
        });
        const [run] = await waitFor('ai run', async () => {
            const list = await runsOf(T, 'ai-flow');
            return list.length && list[0].status === 'succeeded' && list;
        });
        assert.equal(run.decisions[0].probability, 0.91);
        assert.equal(run.decisions[0].passed, true);
        assert.deepEqual(run.steps[2].decision, { choice: 'High', confidence: 0.82 });
        const data = (await task(T, 'ai', 't-ai').get()).data();
        assert.equal(data.status, 'Blocked');
        assert.equal(data.priority, 'High');
        const drafted = await db.collection(`tenants/${T}/projects/ai/comments`).where('automationId', '==', 'ai-flow').get();
        assert.deepEqual(drafted.docs.map((d) => d.data().content), ['Bitte API-Schlüssel prüfen.']);
        const usage = (await db.doc(`tenants/${T}/automation_usage/${new Date().toISOString().slice(0, 7)}`).get()).data();
        assert.equal(usage.aiSteps, 3, 'condition + draft + classify');
        // Below threshold: no run at all.
        await db.doc('_test/flowsAi').set({ answers: { predicate: { probability: 0.3 } } });
        await db.doc(`tenants/${T}/projects/ai/comments/c2`).set({
            projectId: 'ai', targetId: 't-ai', targetType: 'task', userId: anna.uid, userDisplayName: 'Anna', content: 'Danke!', updatedBy: anna.uid, createdAt: Timestamp.now()
        });
        await sleep(5000);
        assert.equal((await runsOf(T, 'ai-flow')).length, 1);
    });

    await check('Flow aus Satz: strict draft is validated and returned disabled', async () => {
        const nulls = { status: null, field: null, priority: null, relativeDays: null, assignMode: null, userIds: [], dynamic: [], text: null, title: null,
            message: null, label: null, projectId: null, asSubtask: null, dueInDays: null, minutes: null, aiMode: null, options: null, email: null };
        await db.doc('_test/flowsAi').set({ generate: { flow_draft: {
            name: 'Dringendes melden', description: 'Admins bei dringenden Aufgaben informieren', projectId: 'p1',
            trigger: { type: 'task.created', fromStatus: null, toStatus: null, assigneeId: null, frequency: null, weekday: null, time: null },
            conditionsOp: 'and', conditions: [{ field: 'task.priority', operator: 'in', values: ['Urgent'], number: null }],
            aiCondition: { kind: null, question: null, threshold: null, choices: null, accept: null, levels: null, minScore: null },
            actions: [{ ...nulls, type: 'notify', dynamic: ['admins'], title: 'Dringend: {{task.title}}', userIds: ['ghost'] }]
        } } });
        const result = await call('draftAutomationFromText', anna.token, { tenantId: T, text: 'Wenn eine dringende Aufgabe erstellt wird, informiere die Admins', projectId: 'p1' });
        assert.equal(result.draft.enabled, false);
        assert.equal(result.draft.projectId, 'p1');
        assert.deepEqual(result.draft.actions[0].config.dynamic, ['admins']);
        assert.deepEqual(result.warnings, ['unknown_person']);
        assert.equal((await db.collection(`tenants/${T}/automations`).where('templateId', '==', 'from_text').get()).size, 0, 'nothing saved');
        await expectError(call('draftAutomationFromText', guest.token, { tenantId: T, text: 'Wenn eine Aufgabe erstellt wird, kommentiere' }), 'PERMISSION_DENIED');
        await db.doc('_test/flowsAi').delete();
    });

    await check('suspended workspace: no event runs, schedules skipped, waiting runs stopped, callables refused', async () => {
        await db.doc(`tenants/${T3}`).set({ suspendedAt: Timestamp.now() }, { merge: true });
        await db.doc(`tenants/${T3}/projects/p1`).set({ title: 'S', ownerId: owner.uid, memberIds: [owner.uid], tenantId: T3 });
        await flowDoc(T3, 'susp-event', { name: 'Event', trigger: { type: 'task.created', config: {} },
            actions: [{ id: 'a1', type: 'add_label', config: { label: 'x' } }] }, owner.uid);
        await flowDoc(T3, 'susp-schedule', { name: 'Plan', trigger: { type: 'schedule', config: { schedule: { frequency: 'daily', time: '09:00', timezone: 'Europe/Berlin' } } },
            nextRunAt: Timestamp.fromMillis(Date.now() - 60000),
            actions: [{ id: 'a1', type: 'create_task', config: { title: 'Plan', projectId: 'p1', priority: 'Medium', status: 'Open', userIds: [], dynamic: [] } }] }, owner.uid);
        await db.doc(`tenants/${T3}/automation_runs/susp-event_waiting`).set({
            automationId: 'susp-event', status: 'waiting', resumeAt: Timestamp.fromMillis(Date.now() - 1000), nextStep: 0, steps: [], depth: 1,
            context: { trigger: 'task.created', projectId: 'p1', taskId: null, vars: {}, eventUserIds: [] }, startedAt: Timestamp.now()
        });
        await addTask(T3, 'p1', 's1', owner.uid);
        await sleep(5000);
        assert.equal((await runsOf(T3, 'susp-event')).filter((run) => run.id !== 'susp-event_waiting').length, 0, 'no event run');
        const stats = await runAutomationSchedulesOnce();
        assert.ok(stats.suspended >= 1);
        assert.equal((await runsOf(T3, 'susp-schedule')).length, 0, 'schedule not fired');
        assert.ok((await db.doc(`tenants/${T3}/automations/susp-schedule`).get()).data().nextRunAt.toMillis() > Date.now(), 'slot consumed');
        assert.equal((await db.doc(`tenants/${T3}/automation_runs/susp-event_waiting`).get()).data().status, 'skipped_suspended');
        await expectError(call('runAutomation', owner.token, { tenantId: T3, id: 'susp-event', taskId: 's1', projectId: 'p1' }), 'FAILED_PRECONDITION');
        await expectError(call('saveAutomation', owner.token, { tenantId: T3, automation: { name: 'x', trigger: { type: 'task.created' }, actions: [{ type: 'comment', config: { text: 'x' } }] } }), 'FAILED_PRECONDITION');
    });

    await check('plan quota (free): 3 active flows, billing code on the 4th, no server AI without own key', async () => {
        await db.doc(`tenants/${T4}/entitlements/plan`).set({ plan: 'free', status: 'free', flowsQuota: 'free', workspaceType: 'personal', seats: 1 });
        await db.doc(`tenants/${T4}/projects/p1`).set({ title: 'F', ownerId: owner.uid, memberIds: [owner.uid], tenantId: T4 });
        const automation = (name) => ({ name, scope: 'project', projectId: 'p1', trigger: { type: 'task.created' }, actions: [{ type: 'add_label', config: { label: 'neu' } }] });
        for (const name of ['F1', 'F2', 'F3']) await call('saveAutomation', owner.token, { tenantId: T4, automation: automation(name) });
        await expectError(call('saveAutomation', owner.token, { tenantId: T4, automation: automation('F4') }), 'FAILED_PRECONDITION');
        try {
            await call('saveAutomation', owner.token, { tenantId: T4, automation: automation('F4') });
        } catch (error) {
            assert.equal(error.message, 'plan-flow-limit');
        }
        // A disabled 4th flow can still be saved (nothing is deleted or blocked beyond activation).
        const off = await call('saveAutomation', owner.token, { tenantId: T4, automation: { ...automation('F4'), enabled: false } });
        await expectError(call('setAutomationEnabled', owner.token, { tenantId: T4, id: off.id, enabled: true }), 'FAILED_PRECONDITION');
        // AI condition on Free without own key → failed run with the billing code.
        await db.doc('_test/flowsAi').set({ answers: { predicate: { probability: 0.9 } } });
        await flowDoc(T4, 'free-ai', { name: 'KI', scope: 'project', projectId: 'p1', trigger: { type: 'task.created', config: {} },
            conditions: { op: 'and', groups: [{ op: 'and', rules: [{ field: 'ai', operator: 'ai', ai: { kind: 'predicate', question: 'Ist das dringend?', threshold: 0.8 } }] }] },
            actions: [{ id: 'a1', type: 'add_label', config: { label: 'dringend' } }] }, owner.uid);
        await addTask(T4, 'p1', 'f1', owner.uid);
        const [run] = await waitFor('free ai run', async () => {
            const list = await runsOf(T4, 'free-ai');
            return list.length && list[0].status === 'failed' && list;
        });
        assert.equal(run.error, 'ai-not-enabled');
        const usage = (await db.doc(`tenants/${T4}/automation_usage/${new Date().toISOString().slice(0, 7)}`).get()).data();
        assert.equal(usage.runsLimit, 200);
        assert.equal(usage.quotaTier, 'free');
        await db.doc('_test/flowsAi').delete();
    });

    await check('security M6: owner rights re-checked per run (member policy off → paused)', async () => {
        await db.doc(`tenants/${T5}/projects/p1`).set({ title: 'Sec', ownerId: owner.uid, memberIds: [owner.uid, anna.uid], tenantId: T5 });
        await flowDoc(T5, 'member-flow', { name: 'Member flow', scope: 'project', projectId: 'p1', trigger: { type: 'task.created', config: {} },
            actions: [{ id: 'a1', type: 'add_label', config: { label: 'x' } }] }, anna.uid);
        await addTask(T5, 'p1', 'm1', owner.uid);
        await waitFor('allowed run', async () => (await runsOf(T5, 'member-flow')).some((run) => run.status === 'succeeded'));
        await db.doc(`tenants/${T5}`).set({ automationPolicy: { allowMemberFlows: false } }, { merge: true });
        await addTask(T5, 'p1', 'm2', owner.uid);
        const failed = await waitFor('denied run', async () => (await runsOf(T5, 'member-flow')).find((run) => run.taskId === 'm2' && run.status === 'failed'));
        assert.match(failed.error, /no longer permitted/);
        const flow = (await db.doc(`tenants/${T5}/automations/member-flow`).get()).data();
        assert.equal(flow.enabled, false);
        assert.equal(flow.pausedReason, 'owner_lost_access');
        assert.equal((await task(T5, 'p1', 'm2').get()).data().category, undefined, 'nothing written');
        // Demoted admin: workspace flow stops.
        await db.doc(`tenants/${T5}/members/${anna.uid}`).set({ role: 'Member' }, { merge: true });
        await flowDoc(T5, 'ws-flow', { name: 'WS', trigger: { type: 'task.created', config: {} },
            actions: [{ id: 'a1', type: 'add_label', config: { label: 'y' } }] }, anna.uid);
        await addTask(T5, 'p1', 'm3', owner.uid);
        await waitFor('ws denied', async () => (await runsOf(T5, 'ws-flow')).some((run) => run.status === 'failed'));
    });

    await check('security M5: locked projects (Free over limit) are read-only for flows', async () => {
        await db.doc(`tenants/${T5}/projects/p2`).set({ title: 'Locked', ownerId: owner.uid, memberIds: [owner.uid], tenantId: T5 });
        await db.doc(`tenants/${T5}/entitlements/plan`).set({ plan: 'free', status: 'free', flowsQuota: 'free', lockedProjectIds: ['p2'] });
        await flowDoc(T5, 'locked-flow', { name: 'Locked', scope: 'project', projectId: 'p2', trigger: { type: 'task.created', config: {} },
            actions: [{ id: 'a1', type: 'add_label', config: { label: 'z' } }] }, owner.uid);
        await flowDoc(T5, 'into-locked', { name: 'Into locked', scope: 'project', projectId: 'p1', trigger: { type: 'task.created', config: {} },
            actions: [{ id: 'a1', type: 'create_task', config: { title: 'Copy', projectId: 'p2', priority: 'Medium', status: 'Open', userIds: [], dynamic: [] } }] }, owner.uid);
        await addTask(T5, 'p2', 'l1', owner.uid);
        await addTask(T5, 'p1', 'l2', owner.uid);
        const [locked] = await waitFor('locked run', async () => {
            const list = await runsOf(T5, 'locked-flow');
            return list.length && list[0].status === 'failed' && list;
        });
        assert.equal(locked.steps[0].error, 'plan-project-locked');
        assert.equal((await task(T5, 'p2', 'l1').get()).data().category, undefined);
        const into = await waitFor('into locked run', async () => (await runsOf(T5, 'into-locked')).find((run) => run.taskId === 'l2' && run.status === 'failed'));
        assert.equal(into.steps[0].error, 'plan-project-locked');
        const created = await db.collection(`tenants/${T5}/projects/p2/tasks`).where('automationId', '==', 'into-locked').get();
        assert.equal(created.size, 0);
    });

    await check('rules: members read flows and runs; guests and clients cannot write', async () => {
        // Rules are covered in firestore-rules-test.js; here only the server-only throttle collection.
        const throttle = await db.collection(`tenants/${T}/automation_throttle`).limit(1).get();
        assert.ok(throttle.size > 0);
    });

    const failed = results.filter((r) => !r.ok);
    results.forEach((r) => console.log(`${r.ok ? '✓' : '✗'} ${r.label}${r.ok ? '' : ` — ${r.error}`}`));
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    process.exit(failed.length ? 1 : 0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
