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

    for (const [tenantId, name] of [[T, 'Flows Test'], [T2, 'Limits Test']]) {
        await db.doc(`tenants/${tenantId}`).set({ tenantId, name, ownerId: owner.uid });
        await db.doc(`tenants/${tenantId}/members/${owner.uid}`).set({ uid: owner.uid, role: 'Owner', displayName: 'Olga' });
        await db.doc(`tenants/${tenantId}/members/${anna.uid}`).set({ uid: anna.uid, role: 'Member', displayName: 'Anna' });
        await db.doc(`tenants/${tenantId}/members/${guest.uid}`).set({ uid: guest.uid, role: 'Guest', displayName: 'Gast' });
    }
    for (const [uid, name] of [[owner.uid, 'Olga'], [anna.uid, 'Anna'], [guest.uid, 'Gast']]) {
        await db.doc(`users/${uid}`).set({ uid, displayName: name, email: `${name}@example.test` });
    }
    for (const projectId of ['p1', 'loop', 'self', 'delay', 'due', 'fail']) {
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
