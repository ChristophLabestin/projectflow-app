// Unit tests: reminder timing, nudge windows / copy, notification prefs + push payload, Live Activity logic.
const test = require('node:test');
const assert = require('node:assert/strict');
const tz = require('../../lib/tz-utils');
const rem = require('../../lib/reminder-logic');
const nudge = require('../../lib/nudge-logic');
const prefs = require('../../lib/notification-prefs');
const focus = require('../../lib/focus-logic');

const BERLIN = 'Europe/Berlin';
const at = (iso) => Date.parse(iso);

// --- tz-utils -------------------------------------------------------------

test('zonedTimeToUtcMs handles winter, summer time and the DST gap', () => {
    assert.equal(new Date(tz.zonedTimeToUtcMs(2026, 1, 15, 8, 0, BERLIN)).toISOString(), '2026-01-15T07:00:00.000Z');
    assert.equal(new Date(tz.zonedTimeToUtcMs(2026, 7, 15, 8, 0, BERLIN)).toISOString(), '2026-07-15T06:00:00.000Z');
    // 2026-03-29 02:30 does not exist in Berlin: resolves forward to 03:30 CEST = 01:30Z
    assert.equal(new Date(tz.zonedTimeToUtcMs(2026, 3, 29, 2, 30, BERLIN)).toISOString(), '2026-03-29T01:30:00.000Z');
});

test('localDateKey / localMinutes follow the zone around midnight', () => {
    const t = at('2026-10-22T22:30:00Z'); // 00:30 next day in Berlin (CEST)
    assert.equal(tz.localDateKey(t, BERLIN), '2026-10-23');
    assert.equal(tz.localMinutes(t, BERLIN), 30);
    assert.equal(tz.localDateKey(t, 'America/Los_Angeles'), '2026-10-22');
});

test('parseClock', () => {
    assert.equal(tz.parseClock('08:00'), 480);
    assert.equal(tz.parseClock('8:05'), 485);
    assert.equal(tz.parseClock('24:00'), null);
    assert.equal(tz.parseClock('x'), null);
});

// --- reminders ------------------------------------------------------------

test('reminderInstantMs: date-only means 08:00 Berlin, timestamps are used as is', () => {
    assert.equal(new Date(rem.reminderInstantMs('2026-10-23')).toISOString(), '2026-10-23T06:00:00.000Z');
    assert.equal(new Date(rem.reminderInstantMs('2026-12-01')).toISOString(), '2026-12-01T07:00:00.000Z');
    assert.equal(new Date(rem.reminderInstantMs('2026-10-23T09:30:00.000Z')).toISOString(), '2026-10-23T09:30:00.000Z');
    assert.equal(rem.reminderInstantMs('garbage'), null);
    assert.equal(rem.reminderInstantMs(''), null);
});

test('computeNextReminderAt: earliest pending, ignores completed / sent / unreadable, absent when none', () => {
    const reminders = [
        { id: 'a', remindAt: '2026-10-25', isCompleted: false },
        { id: 'b', remindAt: '2026-10-23T12:00:00.000Z' },
        { id: 'c', remindAt: '2026-10-01', isCompleted: true },
        { id: 'd', remindAt: '2026-10-02', sentAt: '2026-10-02T06:00:00.000Z' },
        { id: 'e', remindAt: 'oops' }
    ];
    assert.equal(rem.computeNextReminderAt(reminders), '2026-10-23T12:00:00.000Z');
    assert.equal(rem.computeNextReminderAt([reminders[2], reminders[3], reminders[4]]), undefined);
    assert.equal(rem.computeNextReminderAt(undefined), undefined);
    assert.equal(rem.computeNextReminderAt([]), undefined);
    assert.equal(rem.computeNextReminderAt(reminders, { suppress: true }), undefined);
});

test('computeNextReminderAt moves on after the earliest reminder is sent', () => {
    const reminders = [{ id: 'a', remindAt: '2026-10-23' }, { id: 'b', remindAt: '2026-10-25' }];
    assert.equal(rem.computeNextReminderAt(reminders), '2026-10-23T06:00:00.000Z');
    reminders[0].sentAt = '2026-10-23T06:05:00.000Z';
    // 2026-10-25 is the day Berlin leaves summer time, so 08:00 local is 07:00Z
    assert.equal(rem.computeNextReminderAt(reminders), '2026-10-25T07:00:00.000Z');
});

test('planReminderRecipients: createdBy default, explicit list, notifyAssignees, legacy rules', () => {
    const task = { assigneeIds: ['anna'], assigneeId: 'luis', ownerId: 'owner', createdBy: 'creator' };
    assert.deepEqual(rem.planReminderRecipients({ createdBy: 'me' }, 'task', task), ['me']);
    assert.deepEqual(rem.planReminderRecipients({ createdBy: 'me', recipientIds: ['x', 'y'] }, 'task', task), ['x', 'y']);
    assert.deepEqual(rem.planReminderRecipients({ createdBy: 'me', notifyAssignees: true }, 'task', task), ['me', 'anna', 'luis']);
    assert.deepEqual(rem.planReminderRecipients({ createdBy: 'me', notifyAssignees: true }, 'project', { ownerId: 'o' }), ['me']);
    // legacy
    assert.deepEqual(rem.planReminderRecipients({}, 'task', task), ['anna', 'luis']);
    assert.deepEqual(rem.planReminderRecipients({}, 'task', { ownerId: 'owner', createdBy: 'creator' }), ['creator', 'owner']);
    assert.deepEqual(rem.planReminderRecipients({}, 'project', { ownerId: 'owner' }), ['owner']);
});

test('classifyReminder: legacy reminders older than 24h are closed silently', () => {
    const now = at('2026-10-25T10:00:00Z');
    assert.equal(rem.classifyReminder({ remindAt: '2026-10-25T09:00:00Z', createdBy: 'me' }, now), 'send');
    assert.equal(rem.classifyReminder({ remindAt: '2026-10-25T11:00:00Z', createdBy: 'me' }, now), 'wait');
    assert.equal(rem.classifyReminder({ remindAt: '2026-10-25T09:00:00Z' }, now), 'send'); // legacy but recent
    assert.equal(rem.classifyReminder({ remindAt: '2026-10-24T09:00:00Z' }, now), 'skip-stale');
    assert.equal(rem.classifyReminder({ remindAt: '2026-10-20T09:00:00Z', createdBy: 'me' }, now), 'send'); // not legacy: late but delivered
    assert.equal(rem.classifyReminder({ remindAt: '2026-10-25T09:00:00Z', sentAt: 'x' }, now), 'ignore');
    assert.equal(rem.classifyReminder({ remindAt: '2026-10-25T09:00:00Z', isCompleted: true }, now), 'ignore');
});

// --- notification prefs + push payload -----------------------------------

test('resolveNotificationPrefs applies the contract defaults and ignores junk', () => {
    const d = prefs.resolveNotificationPrefs(undefined);
    assert.equal(d.timezone, BERLIN);
    assert.deepEqual(d.push, { assignments: true, mentions: true, comments: true, due: true, reminders: true });
    assert.deepEqual(d.email, { assignments: true, mentions: true, comments: false, due: false, reminders: false });
    assert.deepEqual(d.morningBriefing, { enabled: false, time: '08:00' });
    assert.deepEqual(d.dayClose, { enabled: false, time: '17:30' });

    const custom = prefs.resolveNotificationPrefs({
        timezone: 'Not/AZone',
        push: { comments: false, mentions: 'yes' },
        email: { due: true },
        morningBriefing: { enabled: true, time: '07:15' },
        dayClose: { enabled: true, time: '99:99' }
    });
    assert.equal(custom.timezone, BERLIN);
    assert.equal(custom.push.comments, false);
    assert.equal(custom.push.mentions, true);
    assert.equal(custom.email.due, true);
    assert.deepEqual(custom.morningBriefing, { enabled: true, time: '07:15' });
    assert.deepEqual(custom.dayClose, { enabled: true, time: '17:30' });
});

test('decideChannels per category, nudges and transactional types', () => {
    const p = prefs.resolveNotificationPrefs({ push: { comments: false }, email: { comments: true } });
    assert.deepEqual(prefs.decideChannels('comment_added', p), { push: false, email: true, category: 'comments' });
    assert.deepEqual(prefs.decideChannels('task_assigned', p), { push: true, email: true, category: 'assignments' });
    assert.deepEqual(prefs.decideChannels('task_due_today', p), { push: true, email: false, category: 'due' });
    assert.deepEqual(prefs.decideChannels('morning_briefing', p), { push: true, email: false, category: 'nudge' });
    assert.deepEqual(prefs.decideChannels('project_invite', p), { push: true, email: true, category: 'transactional' });
});

test('apns category table', () => {
    const expected = {
        task_assigned: 'PF_ASSIGNMENT', subtask_assigned: 'PF_ASSIGNMENT', comment_mention: 'PF_MENTION',
        comment_added: 'PF_COMMENT', task_due_today: 'PF_DUE', reminder: 'PF_REMINDER',
        morning_briefing: 'PF_BRIEFING', day_close: 'PF_DAYCLOSE', project_invite: 'PF_GENERIC', task_completed: 'PF_GENERIC'
    };
    Object.entries(expected).forEach(([type, category]) => assert.equal(prefs.apnsCategoryForType(type), category, type));
});

test('buildPushPayload: data keys, thread-id fallback, mutable-content, badge, deep links', () => {
    const payload = prefs.buildPushPayload('t1', 'n1', {
        type: 'task_assigned', title: 'New Task Assignment', message: 'x', projectId: 'p1', taskId: 'k1'
    }, 7);
    assert.deepEqual(payload.data, {
        notificationId: 'n1', tenantId: 't1', title: 'New Task Assignment', message: 'x', type: 'task_assigned',
        projectId: 'p1', taskId: 'k1', deepLink: '/project/p1/tasks/k1', threadId: 'p1'
    });
    assert.deepEqual(payload.apns.payload.aps, { sound: 'default', 'mutable-content': 1, 'thread-id': 'p1', category: 'PF_ASSIGNMENT', badge: 7 });
    assert.equal(payload.webpush.fcmOptions.link, '/project/p1/tasks/k1');

    const briefing = prefs.buildPushPayload('t1', 'n2', { type: 'morning_briefing', title: 'T', message: 'M', deepLink: '/' });
    assert.equal(briefing.apns.payload.aps['thread-id'], 't1');
    assert.equal(briefing.apns.payload.aps.badge, undefined);
    assert.equal(briefing.data.deepLink, '/');
    assert.equal(briefing.data.projectId, undefined);

    assert.equal(prefs.buildDeepLink({ projectId: 'p', initiativeId: 'i' }), '/project/p/initiatives/i');
    assert.equal(prefs.buildDeepLink({ projectId: 'p' }), '/project/p');
    assert.equal(prefs.buildDeepLink({}), '/notifications');
    assert.equal(prefs.buildDeepLink({ deepLink: 'https://evil.example', projectId: 'p' }), '/project/p');
});

// --- nudges ---------------------------------------------------------------

const enabled = (extra = {}) => prefs.resolveNotificationPrefs({
    morningBriefing: { enabled: true, time: '08:00' },
    dayClose: { enabled: true, time: '17:30' },
    ...extra
});

test('nudge windows: open at/after the time, closed before and after the grace period', () => {
    const p = enabled();
    const types = (iso, hasPushToken = false) => nudge.dueNudgeTypes(at(iso), { prefs: p, hasPushToken });
    // 07:59 Berlin (CEST) = 05:59Z
    assert.deepEqual(types('2026-10-22T05:59:00Z'), []);
    assert.deepEqual(types('2026-10-22T06:00:00Z'), ['morning_briefing']);
    assert.deepEqual(types('2026-10-22T06:00:00Z', true), ['morning_briefing', 'task_due_today']);
    assert.deepEqual(types('2026-10-22T07:29:00Z'), ['morning_briefing']); // 09:29 local, inside the 90 min grace
    assert.deepEqual(types('2026-10-22T07:31:00Z'), []); // 09:31 local, too late
    assert.deepEqual(types('2026-10-22T15:30:00Z'), ['day_close']); // 17:30 local
});

test('nudge windows use the per-user zone (Los Angeles at 08:00 local)', () => {
    const p = enabled({ timezone: 'America/Los_Angeles' });
    assert.deepEqual(nudge.dueNudgeTypes(at('2026-10-22T15:00:00Z'), { prefs: p, hasPushToken: false }), ['morning_briefing']);
    assert.deepEqual(nudge.dueNudgeTypes(at('2026-10-22T06:00:00Z'), { prefs: p, hasPushToken: false }), []);
});

test('task_due_today needs a channel; uses 08:00 when no briefing; opt-outs respected', () => {
    const plain = prefs.resolveNotificationPrefs({});
    const t = (p, hasPushToken) => nudge.dueNudgeTypes(at('2026-10-22T06:00:00Z'), { prefs: p, hasPushToken });
    assert.deepEqual(t(plain, false), []);
    assert.deepEqual(t(plain, true), ['task_due_today']);
    assert.deepEqual(t(prefs.resolveNotificationPrefs({ push: { due: false } }), true), []);
    assert.deepEqual(t(prefs.resolveNotificationPrefs({ push: { due: false }, email: { due: true } }), false), ['task_due_today']);
    // briefing at 09:00: due-today follows the briefing time
    const late = prefs.resolveNotificationPrefs({ morningBriefing: { enabled: true, time: '09:00' } });
    assert.deepEqual(nudge.dueNudgeTypes(at('2026-10-22T06:00:00Z'), { prefs: late, hasPushToken: true }), []);
    assert.deepEqual(nudge.dueNudgeTypes(at('2026-10-22T07:00:00Z'), { prefs: late, hasPushToken: true }), ['morning_briefing', 'task_due_today']);
});

test('nudgeDateKey is the local day (idempotency key)', () => {
    assert.equal(nudge.nudgeDateKey(at('2026-10-22T22:30:00Z'), BERLIN), '2026-10-23');
    assert.equal(nudge.nudgeDateKey(at('2026-10-22T22:30:00Z'), 'UTC'), '2026-10-22');
});

const NOW = at('2026-10-22T06:00:00Z'); // 08:00 Berlin, local day 2026-10-22
const task = (id, extra = {}) => ({ id, title: `Task ${id}`, status: 'Open', isCompleted: false, ...extra });

test('computeDayStats: overdue, due today, scheduled today, waiting, dedupe, date-only literal', () => {
    const stats = nudge.computeDayStats([
        task('a', { dueDate: '2026-10-20', priority: 'Low' }),
        task('b', { dueDate: '2026-10-22T20:00:00Z', priority: 'High' }), // 22:00 local: still today
        task('c', { dueDate: '2026-10-22', priority: 'Urgent', scheduledDate: '2026-10-22' }), // counted once
        task('d', { scheduledDate: '2026-10-22' }),
        task('e', { status: 'Blocked' }),
        task('f', { status: 'Blocked', dueDate: '2026-10-22' }), // blocked but a stop, not "waiting"
        task('g', { dueDate: '2026-10-21', isCompleted: true }),
        task('h', { dueDate: '2026-10-19', status: 'Done' }),
        task('i', { dueDate: '2026-10-25' })
    ], NOW, BERLIN);
    assert.equal(stats.overdue, 1);
    assert.equal(stats.dueToday, 3);
    assert.equal(stats.scheduledToday, 1);
    assert.equal(stats.stops, 5);
    assert.equal(stats.waiting, 1);
    assert.deepEqual(stats.stopTitles, ['Task a', 'Task c', 'Task b', 'Task f', 'Task d']);
});

test('computeDayStats: more than 4 overdue items and timestamps around midnight', () => {
    const many = Array.from({ length: 6 }, (_, i) => task(`o${i}`, { dueDate: `2026-10-1${i}` }));
    assert.equal(nudge.computeDayStats(many, NOW, BERLIN).overdue, 6);
    // 23:30Z on the 21st is already the 22nd in Berlin
    const edge = nudge.computeDayStats([task('x', { dueDate: '2026-10-21T23:30:00Z' })], NOW, BERLIN);
    assert.equal(edge.dueToday, 1);
    assert.equal(edge.overdue, 0);
    const seconds = nudge.computeDayStats([task('y', { dueDate: { seconds: at('2026-10-22T10:00:00Z') / 1000, nanoseconds: 0 } })], NOW, BERLIN);
    assert.equal(seconds.dueToday, 1);
});

test('briefing headline picks the dashboard.route.statement.* key', () => {
    const base = { overdue: 0, dueToday: 0, scheduledToday: 0, stops: 0, waiting: 0, stopTitles: [], dueTodayTitles: [] };
    const de = (s) => nudge.buildBriefingCopy('de', { ...base, ...s });
    const en = (s) => nudge.buildBriefingCopy('en', { ...base, ...s });
    assert.deepEqual(de({}), { title: 'Nichts ist fällig — der Tag gehört dir.', message: 'Der ganze Tag ist frei' });
    assert.equal(en({}).title, 'Nothing is due — the day is yours.');
    assert.equal(de({ waiting: 2 }).title, '2 Aufgaben warten auf andere — heute wird nachgehakt.');
    assert.equal(en({ waiting: 1 }).title, '1 task is waiting on others — today is for following up.');
    assert.equal(en({ stops: 1, dueToday: 1, stopTitles: ['Ship it'] }).title, 'One single move today: Ship it.');
    const behind = de({ stops: 3, overdue: 1, dueToday: 2 });
    assert.equal(behind.title, 'Heute ist in 3 Zügen erledigt — der erste brennt.');
    assert.equal(behind.message, '1 überfällig · 2 heute');
    assert.equal(en({ stops: 4, dueToday: 4, waiting: 1 }).title, 'Today is 4 moves — none of them is burning.');
    assert.equal(en({ stops: 4, dueToday: 4, waiting: 1 }).message, '4 today · 1 waiting on others');
});

test('due-today and day-close copy', () => {
    const stats = { overdue: 0, dueToday: 2, scheduledToday: 0, stops: 2, waiting: 0, stopTitles: ['A', 'B'], dueTodayTitles: ['A', 'B'] };
    assert.deepEqual(nudge.buildDueTodayCopy('de', stats), { title: '2 Aufgaben heute fällig', message: 'A · B' });
    assert.equal(nudge.buildDueTodayCopy('en', { ...stats, dueToday: 0 }), null);
    assert.equal(nudge.buildDueTodayCopy('en', { ...stats, dueToday: 1, dueTodayTitles: ['A'] }).title, '1 task due today');
    assert.equal(nudge.buildDayCloseCopy('de', stats).message, '2 Aufgaben sind noch offen. Kurz sortieren oder auf morgen schieben.');
    assert.equal(nudge.buildDayCloseCopy('en', { ...stats, stops: 0 }).message, 'Everything planned is done. Time to close the day.');
});

test('resolveNudgeLanguage', () => {
    assert.equal(nudge.resolveNudgeLanguage('de'), 'de');
    assert.equal(nudge.resolveNudgeLanguage('de-DE'), 'de');
    assert.equal(nudge.resolveNudgeLanguage(undefined), 'en');
    assert.equal(nudge.resolveNudgeLanguage('fr'), 'en');
});

// --- Live Activity --------------------------------------------------------

const f = (extra = {}) => focus.normalizeFocus({ itemId: 't1', itemType: 'task', title: 'Write', projectId: 'p1', tenantId: 'ws', status: 'active', startedAt: '2026-10-22T10:00:00.000Z', ...extra });

test('normalizeFocus drops cleared / completed / issue focus', () => {
    assert.equal(focus.normalizeFocus(null), null);
    assert.equal(focus.normalizeFocus({ itemId: 't', lastAction: 'completed' }), null);
    assert.equal(focus.normalizeFocus({ itemId: 't', itemType: 'issue' }), null);
    assert.equal(f().status, 'active');
    assert.equal(f({ status: 'weird' }).status, 'active');
});

test('focusChanged ignores updatedAt/lastAction noise but sees real changes', () => {
    assert.equal(focus.focusChanged(f(), f({ updatedAt: 'x', lastAction: 'resumed' })), false);
    assert.equal(focus.focusChanged(f(), f({ status: 'snoozed' })), true);
    assert.equal(focus.focusChanged(f(), f({ title: 'Other' })), true);
    assert.equal(focus.focusChanged(null, null), false);
    assert.equal(focus.focusChanged(null, f()), true);
    assert.equal(focus.focusChanged(f(), null), true);
});

test('content state and attributes match the Swift contract', () => {
    const state = focus.buildContentState(f({ status: 'snoozed', snoozedUntil: '2026-10-22T11:00:00.000Z' }), { projectName: 'Site', nextStep: 'Send draft' });
    assert.deepEqual(state, {
        title: 'Write', status: 'snoozed', startedAt: Math.floor(at('2026-10-22T10:00:00.000Z') / 1000),
        projectName: 'Site', nextStep: 'Send draft', snoozedUntil: Math.floor(at('2026-10-22T11:00:00.000Z') / 1000)
    });
    assert.equal(focus.buildContentState(f()).snoozedUntil, undefined);
    assert.deepEqual(focus.buildAttributes(f()), { itemId: 't1', itemType: 'task', tenantId: 'ws', projectId: 'p1' });
    assert.deepEqual(focus.buildAttributes(focus.normalizeFocus({ itemId: 'x', itemType: 'personal-task', title: 'T' }), 'fallback-ws'), { itemId: 'x', itemType: 'personal-task', tenantId: 'fallback-ws' });
});

test('planLiveActivityOps: end / update / start / item switch', () => {
    const devices = [
        { deviceId: 'd1', fcmToken: 'f1', liveActivityStartToken: 's1' },
        { deviceId: 'd2', fcmToken: 'f2' }
    ];
    const act = (id, itemId) => ({ id, deviceId: 'd1', pushToken: `p-${id}`, itemId });

    assert.deepEqual(focus.planLiveActivityOps(null, [act('a', 't1')], devices).map((o) => o.kind), ['end']);
    assert.deepEqual(focus.planLiveActivityOps(f(), [act('a', 't1')], devices).map((o) => o.kind), ['update']);
    const started = focus.planLiveActivityOps(f(), [], devices);
    assert.deepEqual(started.map((o) => [o.kind, o.device.deviceId]), [['start', 'd1']]); // d2 has no start token
    const switched = focus.planLiveActivityOps(f({ itemId: 't2' }), [act('a', 't1')], devices);
    assert.deepEqual(switched.map((o) => o.kind), ['end', 'start']);
    assert.deepEqual(focus.planLiveActivityOps(f(), [], []), []);
});
