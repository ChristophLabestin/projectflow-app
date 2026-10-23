// End-to-end check of the iOS backend triggers against the local emulators (never production).
//
//   cd functions && npm run build && npm run test:triggers
//
// `npm run test:triggers` starts Auth + Firestore + Functions emulators (ports 9731 / 8731 / 5731),
// runs this script and shuts everything down. The script writes tasks, subtasks, comments, reminders and
// user prefs like the clients do, waits for the Cloud Functions to react and asserts the results
// (activity entries, notification docs, progress, completion consistency, loop safety, reminders, nudges,
// Live Activity cleanup).
const assert = require('node:assert/strict');

process.env.GCLOUD_PROJECT = 'demo-projectflow';
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-projectflow' });
const db = admin.firestore();
const { Timestamp, FieldValue } = admin.firestore;

const { runDeliverReminders } = require('../lib/reminders');
const { runSendNudges } = require('../lib/nudges');

const T = 'ws-test';
const P = 'p1';
const base = `tenants/${T}/projects/${P}`;
const OWNER = 'u-owner';
const ANNA = 'u-anna';
const LUIS = 'u-luis';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => Timestamp.now();

const waitFor = async (label, fn, { timeout = 25000, interval = 250 } = {}) => {
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

const docs = async (path, filter) => {
    const snap = await db.collection(path).get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return filter ? all.filter(filter) : all;
};
const activities = (filter) => docs(`${base}/activities`, filter);
const notifications = (filter) => docs(`tenants/${T}/notifications`, filter);

/** Wait until `fn` returns an array with at least `min` entries. */
const waitForMany = (label, fn, min = 1) => waitFor(label, async () => {
    const items = await fn();
    return items.length >= min ? items : null;
});

const seed = async () => {
    for (const [uid, name] of [[OWNER, 'Olivia Owner'], [ANNA, 'Anna Berger'], [LUIS, 'Luis Romero']]) {
        await db.doc(`users/${uid}`).set({ uid, displayName: name, email: `${uid}@example.test`, photoURL: '' });
        await db.doc(`tenants/${T}/members/${uid}`).set({ uid, role: uid === OWNER ? 'Owner' : 'Member', displayName: name });
    }
    await db.doc(`tenants/${T}`).set({ tenantId: T, name: 'Trigger Test', ownerId: OWNER, customRoles: [] });
    await db.doc(base).set({
        title: 'Test project', tenantId: T, ownerId: OWNER, progress: 0, memberIds: [OWNER, ANNA, LUIS],
        members: [OWNER, ANNA, LUIS].map((userId) => ({ userId, role: 'Editor' })), roles: {}
    });
    await db.doc(`${base}/project_groups/g1`).set({ name: 'Design', memberIds: [LUIS] });
};

const clientWrite = (uid) => ({ updatedBy: uid, updatedAt: now() });

const run = async () => {
    await seed();

    // ---- 1. Task create ---------------------------------------------------------------------------------
    const taskRef = db.doc(`${base}/tasks/t1`);
    await taskRef.set({
        title: 'First task', ownerId: OWNER, createdBy: OWNER, isCompleted: false, status: 'Open', priority: 'Medium',
        dueDate: '', assigneeIds: [ANNA], ...clientWrite(OWNER), createdAt: now()
    });

    await check('create: tenantId / projectId are healed from the path', async () => {
        const task = await waitFor('healed task', async () => {
            const data = (await taskRef.get()).data();
            return data.tenantId === T && data.projectId === P ? data : null;
        });
        assert.ok(task.systemWriteAt);
    });
    await check('create: "Added task" activity with actor snapshot', async () => {
        const [entry] = await waitForMany('added activity', () => activities((a) => a.action === 'Added task "First task"'));
        assert.equal(entry.ownerId, OWNER);
        assert.equal(entry.user, 'Olivia Owner');
        assert.equal(entry.type, 'task');
        assert.equal(entry.relatedId, 't1');
    });
    await check('create: task_assigned notification for the assignee with actor snapshot', async () => {
        const [n] = await waitForMany('assigned notification', () => notifications((x) => x.type === 'task_assigned' && x.userId === ANNA));
        assert.equal(n.title, 'New Task Assignment');
        assert.equal(n.message, 'You\'ve been assigned to "First task"');
        assert.equal(n.actorId, OWNER);
        assert.equal(n.actorName, 'Olivia Owner');
        assert.equal(n.read, false);
        assert.equal(n.taskId, 't1');
        assert.equal(n.projectId, P);
        assert.equal(n.tenantId, T);
    });
    await check('create: project progress synced (0%)', async () => {
        await waitFor('progress 0', async () => (await db.doc(base).get()).data().progress === 0);
    });

    // ---- 2. Completion by the assignee -------------------------------------------------------------------
    await taskRef.update({ isCompleted: true, completedBy: ANNA, completedAt: now(), ...clientWrite(ANNA) });

    await check('complete: status flips to Done, completion stamped', async () => {
        const task = await waitFor('status Done', async () => {
            const data = (await taskRef.get()).data();
            return data.status === 'Done' ? data : null;
        });
        assert.equal(task.isCompleted, true);
        assert.equal(task.completedBy, ANNA);
    });
    await check('complete: activity, task_completed notification to the creator, progress 100', async () => {
        await waitForMany('completed activity', () => activities((a) => a.action === 'Completed task "First task"'));
        const [n] = await waitForMany('completed notification', () => notifications((x) => x.type === 'task_completed' && x.userId === OWNER));
        assert.equal(n.actorId, ANNA);
        await waitFor('progress 100', async () => (await db.doc(base).get()).data().progress === 100);
    });

    // ---- 3. Loop safety --------------------------------------------------------------------------------
    await check('loop safety: exactly one activity / notification per event and the doc settles', async () => {
        await sleep(3500);
        assert.equal((await activities((a) => a.action === 'Completed task "First task"')).length, 1);
        assert.equal((await notifications((x) => x.type === 'task_completed')).length, 1);
        assert.equal((await notifications((x) => x.type === 'task_assigned')).length, 1);
        const first = (await taskRef.get()).updateTime.toMillis();
        await sleep(1500);
        assert.equal((await taskRef.get()).updateTime.toMillis(), first, 'task doc kept changing');
    });

    // ---- 4. Reopen -------------------------------------------------------------------------------------
    await taskRef.update({ isCompleted: false, ...clientWrite(OWNER) });
    await check('reopen: status back to Open, completion fields removed, "Reopened" activity, progress 0', async () => {
        const task = await waitFor('reopened', async () => {
            const data = (await taskRef.get()).data();
            return data.status === 'Open' && data.completedAt === undefined ? data : null;
        });
        assert.equal(task.isCompleted, false);
        assert.equal(task.completedBy, undefined);
        await waitForMany('reopened activity', () => activities((a) => a.action === 'Reopened task "First task"'));
        await waitFor('progress 0 again', async () => (await db.doc(base).get()).data().progress === 0);
    });

    // ---- 5. Status drag to Done (no isCompleted) --------------------------------------------------------
    await taskRef.update({ status: 'Done', ...clientWrite(LUIS) });
    await check('status Done: isCompleted + completedAt/By set by the server', async () => {
        const task = await waitFor('isCompleted via status', async () => {
            const data = (await taskRef.get()).data();
            return data.isCompleted === true && data.completedAt && data.completedBy ? data : null;
        });
        assert.equal(task.completedBy, LUIS);
    });
    await taskRef.update({ status: 'In Progress', ...clientWrite(LUIS) });
    await check('status leaving Done: isCompleted false again', async () => {
        await waitFor('reopened by status', async () => {
            const data = (await taskRef.get()).data();
            return data.isCompleted === false && data.completedAt === undefined;
        });
    });

    // ---- 6. Assignment, priority, due date ---------------------------------------------------------------
    const before = (await activities()).length;
    await taskRef.update({ assigneeIds: [ANNA, LUIS], priority: 'High', dueDate: '2026-11-01', ...clientWrite(OWNER) });
    await check('field changes: assignment notification only for the new assignee, specific activities', async () => {
        await waitForMany('luis notification', () => notifications((x) => x.type === 'task_assigned' && x.userId === LUIS));
        const actions = (await activities()).map((a) => a.action);
        assert.ok(actions.includes('Changed priority of "First task" to High'));
        assert.ok(actions.includes('Assigned task "First task"'));
        assert.ok(actions.includes('Changed due date of "First task"'));
        assert.equal((await notifications((x) => x.type === 'task_assigned' && x.userId === ANNA)).length, 1);
        assert.ok((await activities()).length >= before + 3);
    });

    // ---- 7. Legacy assigneeId backfill does not notify ----------------------------------------------------
    await db.doc(`${base}/tasks/t-legacy`).set({
        title: 'Legacy task', ownerId: OWNER, createdBy: OWNER, isCompleted: false, status: 'Open', assigneeId: ANNA, assigneeIds: [],
        tenantId: T, projectId: P, ...clientWrite(OWNER), createdAt: now(), systemWriteAt: now()
    });
    await sleep(1500);
    const countBefore = (await notifications((x) => x.taskId === 't-legacy')).length;
    await db.doc(`${base}/tasks/t-legacy`).update({ assigneeIds: [ANNA], backfilledAt: FieldValue.serverTimestamp(), systemWriteAt: FieldValue.serverTimestamp() });
    await sleep(2500);
    await check('backfill: assigneeIds from legacy assigneeId creates no notification or activity', async () => {
        assert.equal((await notifications((x) => x.taskId === 't-legacy')).length, countBefore);
        assert.equal((await activities((a) => a.relatedId === 't-legacy')).length, 0);
    });

    // ---- 8. Subtasks ---------------------------------------------------------------------------------------
    const subRef = db.doc(`${base}/tasks/t1/subtasks/s1`);
    await subRef.set({ taskId: 't1', projectId: P, ownerId: OWNER, title: 'Draft outline', isCompleted: false, assigneeId: LUIS, ...clientWrite(OWNER), createdAt: now() });
    await check('subtask: added activity and subtask_assigned notification', async () => {
        const [entry] = await waitForMany('subtask activity', () => activities((a) => a.action === 'Added subtask "Draft outline"'));
        assert.equal(entry.target, 'First task');
        const [n] = await waitForMany('subtask notification', () => notifications((x) => x.type === 'subtask_assigned' && x.userId === LUIS));
        assert.equal(n.message, 'You\'ve been assigned to subtask "Draft outline" in task "First task"');
    });
    await subRef.update({ isCompleted: true, completedBy: LUIS, completedAt: now(), ...clientWrite(LUIS) });
    await check('subtask: completion activity', async () => {
        await waitForMany('subtask completed', () => activities((a) => a.action === 'Completed subtask "Draft outline"'));
    });

    // ---- 9. Comments and mentions -------------------------------------------------------------------------
    await db.doc(`${base}/comments/c1`).set({
        projectId: P, targetId: 't1', targetType: 'task', userId: OWNER, userDisplayName: 'Olivia Owner',
        content: 'Please check the numbers @Anna Berger, thanks!', ...clientWrite(OWNER), createdAt: now()
    });
    await check('comment: activity, mention notification and comment_added for the other assignee only', async () => {
        const [entry] = await waitForMany('comment activity', () => activities((a) => a.type === 'comment'));
        assert.equal(entry.action, 'Commented on task "First task"');
        assert.ok(entry.details.includes('Please check the numbers'));
        const [mention] = await waitForMany('mention', () => notifications((x) => x.type === 'comment_mention'));
        assert.equal(mention.userId, ANNA);
        assert.equal(mention.commentId, 'c1');
        assert.equal(mention.message, 'You were mentioned in a comment on task "First task"');
        await waitForMany('comment_added', () => notifications((x) => x.type === 'comment_added'));
        const added = await notifications((x) => x.type === 'comment_added');
        assert.deepEqual(added.map((x) => x.userId), [LUIS]); // author (creator) excluded, Anna got the mention instead
        assert.equal(added[0].message, 'New comment on task "First task"');
    });

    await db.doc(`${base}/comments/c2`).set({
        projectId: P, targetId: 't1', targetType: 'task', userId: ANNA, userDisplayName: 'Anna Berger',
        content: 'cc @Design and @Olivia Owner', mentionedUserIds: [LUIS, 'not-a-member'], ...clientWrite(ANNA), createdAt: now()
    });
    await check('comment: group mention, explicit mentionedUserIds, non-members ignored', async () => {
        await waitFor('c2 mentions', async () => (await notifications((x) => x.type === 'comment_mention' && x.commentId === 'c2')).length >= 2);
        const mentions = await notifications((x) => x.type === 'comment_mention' && x.commentId === 'c2');
        assert.deepEqual(mentions.map((x) => x.userId).sort(), [OWNER, LUIS].sort());
    });

    // ---- 10. Reminders ---------------------------------------------------------------------------------------
    const nowMs = Date.now();
    const iso = (ms) => new Date(ms).toISOString();
    const remRef = db.doc(`${base}/tasks/t-rem`);
    await remRef.set({
        title: 'Reminder task', ownerId: OWNER, createdBy: OWNER, isCompleted: false, status: 'Open', assigneeIds: [ANNA],
        tenantId: T, projectId: P, ...clientWrite(OWNER), createdAt: now(),
        reminders: [
            { id: 'r1', title: 'Ping everyone', remindAt: iso(nowMs - 60 * 1000), createdBy: OWNER, recipientIds: [OWNER], notifyAssignees: true },
            { id: 'r2', title: 'Ancient legacy', remindAt: iso(nowMs - 3 * 24 * 3600 * 1000) },
            { id: 'r3', title: 'Later', remindAt: iso(nowMs + 5 * 3600 * 1000), createdBy: OWNER }
        ]
    });
    await check('reminders: nextReminderAt is the earliest pending reminder', async () => {
        const task = await waitFor('nextReminderAt', async () => (await remRef.get()).data().nextReminderAt ? (await remRef.get()).data() : null);
        assert.equal(task.nextReminderAt, iso(nowMs - 3 * 24 * 3600 * 1000));
    });
    await check('reminders: delivery sends to recipients + assignees, closes stale legacy ones silently', async () => {
        const stats = await runDeliverReminders(Date.now());
        assert.ok(stats.scanned >= 1);
        const sent = await notifications((x) => x.type === 'reminder' && x.taskId === 't-rem');
        assert.deepEqual(sent.map((x) => x.userId).sort(), [ANNA, OWNER].sort());
        assert.equal(sent[0].title, 'Ping everyone');
        assert.equal(sent[0].message, 'Task: "Reminder task"');
        assert.equal(sent[0].deepLink, `/project/${P}/tasks/t-rem`);
        const task = (await remRef.get()).data();
        const byId = Object.fromEntries(task.reminders.map((r) => [r.id, r]));
        assert.ok(byId.r1.sentAt);
        assert.ok(byId.r2.sentAt);
        assert.equal(byId.r3.sentAt, undefined);
        assert.equal(task.nextReminderAt, byId.r3.remindAt);
    });
    await check('reminders: a second run does not send again', async () => {
        await runDeliverReminders(Date.now());
        assert.equal((await notifications((x) => x.type === 'reminder' && x.taskId === 't-rem')).length, 2);
    });
    await check('reminders: completed reminders and done tasks are not scheduled', async () => {
        await sleep(2500); // let the trigger react to the delivery write
        const task = (await remRef.get()).data();
        assert.equal(typeof task.nextReminderAt, 'string');
        await remRef.update({ status: 'Done', ...clientWrite(OWNER) });
        await waitFor('nextReminderAt cleared for done task', async () => (await remRef.get()).data().nextReminderAt === undefined);
    });

    await db.doc(base).update({ reminders: [{ id: 'pr1', title: 'Project check-in', remindAt: iso(Date.now() - 5 * 60 * 1000) }] });
    await check('reminders: project reminder (legacy, no createdBy) goes to the project owner', async () => {
        await waitFor('project nextReminderAt', async () => typeof (await db.doc(base).get()).data().nextReminderAt === 'string');
        await runDeliverReminders(Date.now());
        const sent = await notifications((x) => x.type === 'reminder' && x.reminderId === 'pr1');
        assert.deepEqual(sent.map((x) => x.userId), [OWNER]);
        assert.equal(sent[0].message, 'Project: "Test project"');
        assert.equal(sent[0].deepLink, `/project/${P}`);
        const project = (await db.doc(base).get()).data();
        assert.ok(project.reminders[0].sentAt);
        await waitFor('project nextReminderAt cleared', async () => (await db.doc(base).get()).data().nextReminderAt === undefined);
    });

    // ---- 11. Nudges -------------------------------------------------------------------------------------------
    await db.doc(`users/${OWNER}`).set({
        fcmTokens: ['token-1'], language: 'de',
        notificationPrefs: { timezone: 'Europe/Berlin', morningBriefing: { enabled: true, time: '08:00' }, dayClose: { enabled: true, time: '17:30' } }
    }, { merge: true });
    await db.doc(`${base}/tasks/t-od`).set({ title: 'Overdue thing', ownerId: OWNER, isCompleted: false, status: 'Open', assigneeIds: [OWNER], dueDate: '2026-10-20', tenantId: T, projectId: P, systemWriteAt: now() });
    await db.doc(`${base}/tasks/t-today`).set({ title: 'Due today thing', ownerId: OWNER, isCompleted: false, status: 'Open', assigneeIds: [OWNER], dueDate: '2026-10-22', priority: 'High', tenantId: T, projectId: P, systemWriteAt: now() });
    await db.doc(`tenants/${T}/users/${OWNER}/personalTasks/pt1`).set({ title: 'Personal errand', isCompleted: false, scheduledDate: '2026-10-22' });
    await sleep(1500);

    const morning = Date.parse('2026-10-22T06:05:00Z'); // 08:05 in Berlin
    const stats1 = await runSendNudges(morning, OWNER);
    await check('nudges: morning briefing and due-today doc created in the user language', async () => {
        assert.equal(stats1.sent, 2);
        const briefing = (await notifications((x) => x.type === 'morning_briefing' && x.userId === OWNER))[0];
        assert.equal(briefing.title, 'Heute ist in 3 Zügen erledigt — der erste brennt.');
        assert.equal(briefing.message, '1 überfällig · 2 heute');
        assert.equal(briefing.deepLink, '/');
        const due = (await notifications((x) => x.type === 'task_due_today' && x.userId === OWNER))[0];
        assert.equal(due.title, '1 Aufgabe heute fällig');
        assert.equal(due.deepLink, '/tasks');
    });
    await check('nudges: overdue pass creates one task_overdue per overdue task, once', async () => {
        assert.equal(stats1.overdue, 1);
        const overdue = await notifications((x) => x.type === 'task_overdue' && x.userId === OWNER);
        assert.equal(overdue.length, 1);
        assert.equal(overdue[0].taskId, 't-od');
        assert.equal(overdue[0].projectId, P);
        assert.equal(overdue[0].params.taskTitle, 'Overdue thing');
        assert.equal(overdue[0].params.dueDate, '2026-10-20');
        assert.equal((await runSendNudges(morning + 20 * 60 * 1000, OWNER)).overdue, 0);
    });
    await check('nudges: nudgeLog records sent types and is idempotent', async () => {
        const log = (await db.doc(`users/${OWNER}/nudgeLog/2026-10-22`).get()).data();
        assert.deepEqual([...log.sent].sort(), ['morning_briefing', 'task_due_today']);
        assert.equal(log.briefingStops, 3);
        const again = await runSendNudges(morning + 10 * 60 * 1000, OWNER);
        assert.equal(again.sent, 0);
        assert.equal((await notifications((x) => x.type === 'morning_briefing')).length, 1);
    });
    await check('nudges: day close at 17:30 local, once', async () => {
        const evening = Date.parse('2026-10-22T15:35:00Z'); // 17:35 in Berlin
        const stats = await runSendNudges(evening, OWNER);
        assert.equal(stats.sent, 1);
        const close = (await notifications((x) => x.type === 'day_close'))[0];
        assert.equal(close.title, 'Tagesabschluss');
        assert.equal(close.deepLink, '/?mode=close');
        assert.equal((await runSendNudges(evening + 60000, OWNER)).sent, 0);
    });
    await check('nudges: the next local day starts a new log', async () => {
        const nextMorning = Date.parse('2026-10-23T06:00:00Z');
        const stats = await runSendNudges(nextMorning); // full user scan (pagination path)
        assert.ok(stats.users >= 3);
        assert.ok(stats.sent >= 1);
        assert.ok((await db.doc(`users/${OWNER}/nudgeLog/2026-10-23`).get()).exists);
    });

    // ---- 12. Notification preferences in onNotificationCreated ------------------------------------------------
    await db.doc(`users/${LUIS}`).set({ fcmTokens: ['luis-token'], notificationPrefs: { push: { comments: false } } }, { merge: true });
    await db.doc(`tenants/${T}/notifications/pref-test`).set({
        userId: LUIS, tenantId: T, type: 'comment_added', title: 'New Comment', message: 'x', projectId: P, taskId: 't1', read: false, createdAt: now()
    });
    await check('prefs: push and email skipped when the category is off', async () => {
        const logs = await waitForMany('delivery logs', () => docs(`tenants/${T}/notificationDeliveryLogs`, (l) => l.notificationId === 'pref-test'), 2);
        const fcm = logs.find((l) => l.channel === 'fcm');
        const email = logs.find((l) => l.channel === 'email');
        assert.equal(fcm.status, 'skipped');
        assert.match(fcm.reason, /Push disabled in notification preferences \(comments\)/);
        assert.equal(email.status, 'skipped');
        assert.match(email.reason, /Email disabled in notification preferences \(comments\)/);
    });
    await db.doc(`tenants/${T}/notifications/pref-test-2`).set({
        userId: LUIS, tenantId: T, type: 'task_assigned', title: 'New Task Assignment', message: 'y', projectId: P, taskId: 't1', read: false, createdAt: now()
    });
    await check('prefs: push attempted for an enabled category (fails in the emulator, never skipped by prefs)', async () => {
        const logs = await waitFor('delivery logs 2', async () => {
            const found = await docs(`tenants/${T}/notificationDeliveryLogs`, (l) => l.notificationId === 'pref-test-2' && l.channel === 'fcm');
            return found.length ? found : null;
        }, { timeout: 90000 }); // the FCM call has no credentials in the emulator and may take a while to fail
        assert.notEqual(logs[0].status, 'skipped');
    });

    // ---- 13. Live Activity cleanup on focus end -------------------------------------------------------------
    await db.doc(`users/${OWNER}/devices/d1`).set({ platform: 'ios', fcmToken: 'device-fcm', liveActivityStartToken: 'start-token' });
    await db.doc(`users/${OWNER}/liveActivities/a1`).set({ deviceId: 'd1', pushToken: 'push-token', itemId: 't1', itemType: 'task' });
    await db.doc(`users/${OWNER}`).set({ focusState: { itemId: 't1', itemType: 'task', title: 'First task', projectId: P, tenantId: T, status: 'active', startedAt: iso(Date.now()), lastAction: 'started' } }, { merge: true });
    await sleep(1500);
    await db.doc(`users/${OWNER}`).set({ focusState: null }, { merge: true });
    await check('live activity: ending the focus removes the activity doc (end push attempted)', async () => {
        await waitFor('liveActivities cleared', async () => !(await db.doc(`users/${OWNER}/liveActivities/a1`).get()).exists);
    });
};

run()
    .catch((error) => {
        results.push({ label: 'test run crashed', ok: false, error: error.stack || error.message });
    })
    .finally(() => {
        const failed = results.filter((r) => !r.ok);
        results.forEach((r) => console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : `  -> ${r.error}`}`));
        console.log(`\n${results.length - failed.length}/${results.length} trigger checks passed.`);
        process.exit(failed.length ? 1 : 0);
    });
