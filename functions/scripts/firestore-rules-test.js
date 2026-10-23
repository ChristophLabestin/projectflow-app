const fs = require('node:fs');
const path = require('node:path');
const {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails
} = require('@firebase/rules-unit-testing');

// Run: npm run test:rules (from functions/). Every check runs even if an
// earlier one fails, so a single run shows the full picture.
const PROJECT_ID = 'demo-projectflow';
const RULES_PATH = process.env.RULES_PATH || path.resolve(__dirname, '../../firestore.rules');

const T = 'tenants/tenantA';
const PROJECT = `${T}/projects/projectA`;
const MEMBER_PROJECT = `${T}/projects/memberProject`;

// File manager doc shape (brain/plans/files-concept.md).
const fileDoc = (projectId, extra = {}) => ({
    tenantId: 'tenantA', module: 'files', listed: true, status: 'ready', projectId,
    parent: { type: projectId ? 'task' : 'workspace', id: projectId ? 'taskA' : 'workspace', projectId, rootId: projectId ? 'taskA' : 'workspace' },
    name: 'a.pdf', createdBy: 'ownerA', ...extra
});

const seedData = async (testEnv) => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const set = (docPath, data) => db.doc(docPath).set(data);

        await set(T, { tenantId: 'tenantA', name: 'Tenant A', ownerId: 'ownerA' });
        await set(`${T}/members/ownerA`, { uid: 'ownerA', role: 'Owner' });
        await set(`${T}/members/adminA`, { uid: 'adminA', role: 'Admin' });
        await set(`${T}/members/memberA`, { uid: 'memberA', role: 'Member' });
        await set(`${T}/members/guestA`, { uid: 'guestA', role: 'Guest' });
        await set(`${T}/secrets/smtp`, { username: 'smtp-user' });
        await set(`${T}/api_tokens/tokenA`, { name: 'Token A' });
        await set(`${T}/ai_audit/entryA`, { tool: 'create_task', actorId: 'ownerA' });
        await set(`${T}/ai_config/policy`, { enabled: true });
        await set(`${T}/entitlements/plan`, { plan: 'free', seats: 3 });
        await set(PROJECT, {
            title: 'Project A',
            tenantId: 'tenantA',
            ownerId: 'ownerA',
            memberIds: ['ownerA', 'guestA'],
        });
        await set(`${PROJECT}/tasks/taskA`, { title: 'Task A', tenantId: 'tenantA', projectId: 'projectA' });
        await set(`${PROJECT}/tasks/taskMine`, {
            title: 'Assigned to member',
            tenantId: 'tenantA',
            projectId: 'projectA',
            assigneeIds: ['memberA'],
            isCompleted: false,
            nextReminderAt: '2026-10-23T06:00:00.000Z',
        });
        await set(`${PROJECT}/tasks/taskGuestMine`, {
            title: 'Assigned to guest',
            tenantId: 'tenantA',
            projectId: 'projectA',
            assigneeIds: ['guestA'],
            isCompleted: false,
        });
        await set(`${PROJECT}/social_integrations/instagram`, { platform: 'Instagram', accessToken: 'secret' });
        await set(MEMBER_PROJECT, {
            title: 'Member project',
            tenantId: 'tenantA',
            ownerId: 'memberA',
            memberIds: ['memberA'],
        });
        await set(`${T}/users/memberA/personalTasks/personalA`, { title: 'Personal Task A' });
        await set('users/memberA', { uid: 'memberA', displayName: 'Member A' });
        await set('users/memberA/devices/deviceA', { platform: 'ios', fcmToken: 'token' });
        await set('users/memberA/liveActivities/activityA', { deviceId: 'deviceA', pushToken: 'push', itemId: 'taskA' });
        await set('users/memberA/nudgeLog/2026-10-22', { sent: ['morning_briefing'] });

        // File manager docs: project file (projectA has guestA), member-only project, workspace file.
        await set(`${T}/files/fileProject`, fileDoc('projectA'));
        await set(`${T}/files/fileMemberProject`, fileDoc('memberProject'));
        await set(`${T}/files/fileWorkspace`, fileDoc(null));
        await set(`${T}/files/legacyMedia`, { tenantId: 'tenantA', module: 'media', projectId: null, status: 'ready' });

        const notification = (userId, extra = {}) => ({
            userId, tenantId: 'tenantA', type: 'task_assigned', title: 'New Task Assignment',
            message: 'You have been assigned', read: false, actorId: 'ownerA', ...extra
        });
        await set(`${T}/notifications/nMember`, notification('memberA', { taskId: 'taskMine', projectId: 'projectA' }));
        await set(`${T}/notifications/nOwner`, notification('ownerA', { actorId: 'memberA' }));
        await set(`${T}/notifications/nGuest`, notification('guestA'));
        await set(`${T}/notifications/nFormer`, notification('outsiderA'));
        await set(`${T}/notificationDeliveryLogs/logMember`, { notificationId: 'nMember', userId: 'memberA', channel: 'fcm', status: 'sent' });
        await set(`${T}/notificationDeliveryLogs/logOwner`, { notificationId: 'nOwner', userId: 'ownerA', channel: 'fcm', status: 'sent' });

        await set('legal_documents/terms', { type: 'terms', currentVersion: 1, versions: [] });
        await set('legal_documents/terms/versions/1', { type: 'terms', version: 1, status: 'published' });
        await set('legal_documents/terms/drafts/current', { type: 'terms', title: { de: 'Entwurf', en: 'Draft' } });
        await set('legal_acceptances/memberA', { uid: 'memberA', docs: { terms: { version: 1 } } });
        await set('legal_acceptances/memberA/events/e1', { type: 'terms', version: 1, decision: 'accepted' });
        await set('legal_mail_jobs/terms_v1', { type: 'terms', version: 1, open: false });

        const event = (projectId, extra = {}) => ({
            v: 1, type: 'task.created', domain: 'task', actorId: 'ownerA', projectId,
            actor: { kind: 'user', id: 'ownerA', name: 'Owner' }, object: { type: 'task', id: 'taskA', title: 'Task A' }, ...extra
        });
        await set(`${T}/activity/evA`, event('projectA'));
        await set(`${T}/activity/evMember`, event('memberProject'));
        await set(`${T}/activity/evWorkspace`, event(null, { type: 'project.created', domain: 'project' }));
        await set(`${T}/insights_daily/latest`, { day: '2026-10-23' });
        await set(`${T}/insights_reports/2026-W43`, { markdown: 'Report' });

        await set('tenants/tenantB', { tenantId: 'tenantB', name: 'Tenant B', ownerId: 'ownerB' });
        await set('tenants/tenantB/members/ownerB', { uid: 'ownerB', role: 'Owner' });
    });
};

const run = async () => {
    const testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: { rules: fs.readFileSync(RULES_PATH, 'utf8') }
    });

    const results = [];
    const check = async (label, expectation, operation) => {
        try {
            await (expectation === 'allow' ? assertSucceeds(operation()) : assertFails(operation()));
            results.push({ label, ok: true });
        } catch (error) {
            results.push({ label, ok: false, error: error.message.split('\n')[0] });
        }
    };
    // Each write check starts from fresh seed data.
    const fresh = async () => {
        await testEnv.clearFirestore();
        await seedData(testEnv);
    };

    try {
        await fresh();
        const as = (uid) => testEnv.authenticatedContext(uid).firestore();
        const owner = as('ownerA');
        const admin = as('adminA');
        const member = as('memberA');
        const guest = as('guestA');
        const outsider = as('outsiderA');

        // Tenant isolation
        await check('member reads own tenant', 'allow', () => member.doc(T).get());
        await check('outsider cannot read tenant', 'deny', () => outsider.doc(T).get());
        await check('outsider cannot read project', 'deny', () => outsider.doc(PROJECT).get());
        await check('outsider cannot read task', 'deny', () => outsider.doc(`${PROJECT}/tasks/taskA`).get());
        await check('outsider cannot self-join as Member', 'deny', () =>
            outsider.doc(`${T}/members/outsiderA`).set({ uid: 'outsiderA', role: 'Member' }));
        await check('outsider cannot self-join without role', 'deny', () =>
            outsider.doc(`${T}/members/outsiderA`).set({ uid: 'outsiderA' }));
        await check('owner of tenant B cannot read tenant A project', 'deny', () =>
            as('ownerB').doc(PROJECT).get());

        // Server-only collections
        await check('owner cannot read secrets', 'deny', () => owner.doc(`${T}/secrets/smtp`).get());
        await check('member cannot write secrets', 'deny', () =>
            member.doc(`${T}/secrets/smtp`).set({ username: 'x' }, { merge: true }));
        await check('owner cannot read api tokens', 'deny', () => owner.doc(`${T}/api_tokens/tokenA`).get());
        await check('owner cannot read ai audit directly', 'deny', () => owner.doc(`${T}/ai_audit/entryA`).get());
        await check('owner cannot forge ai audit', 'deny', () => owner.doc(`${T}/ai_audit/x`).set({ tool: 'x' }));
        await check('owner cannot write ai policy directly', 'deny', () =>
            owner.doc(`${T}/ai_config/policy`).set({ enabled: false }));
        await check('member cannot read ai policy directly', 'deny', () => member.doc(`${T}/ai_config/policy`).get());
        await check('owner cannot reset ai usage', 'deny', () => owner.doc(`${T}/ai_usage/2026-10-23`).set({ writes: 0 }));
        for (const collection of ['ai_grants', 'ai_tokens', 'oauth_clients', 'oauth_codes', 'oauth_requests']) {
            await check(`owner cannot read ${collection}`, 'deny', () => owner.doc(`${collection}/x`).get());
            await check(`owner cannot write ${collection}`, 'deny', () => owner.doc(`${collection}/x`).set({ uid: 'ownerA' }));
        }
        await check('member reads entitlements', 'allow', () => member.doc(`${T}/entitlements/plan`).get());
        await check('owner cannot self-grant entitlements', 'deny', () =>
            owner.doc(`${T}/entitlements/plan`).set({ plan: 'enterprise', seats: 999 }));

        // Personal data
        await check('member reads own personal task', 'allow', () =>
            member.doc(`${T}/users/memberA/personalTasks/personalA`).get());
        await check('owner cannot read member personal task', 'deny', () =>
            owner.doc(`${T}/users/memberA/personalTasks/personalA`).get());

        // Project content
        await check('guest in memberIds reads project', 'allow', () => guest.doc(PROJECT).get());
        await check('guest in memberIds reads task', 'allow', () => guest.doc(`${PROJECT}/tasks/taskA`).get());
        await check('guest not in memberIds cannot read member project', 'deny', () => guest.doc(MEMBER_PROJECT).get());
        await check('member creates task', 'allow', () =>
            member.doc(`${PROJECT}/tasks/newTask`).set({ title: 'New', tenantId: 'tenantA', projectId: 'projectA' }));
        await check('member updates project title', 'allow', () => member.doc(PROJECT).update({ title: 'Renamed' }));
        await fresh();
        await check('member deletes a task', 'allow', () => member.doc(`${PROJECT}/tasks/taskA`).delete());
        await check('member adds a project member', 'allow', () =>
            member.doc(PROJECT).update({ memberIds: ['ownerA', 'guestA', 'memberA'] }));

        // Retired Social/Marketing data stays in Firestore but is closed to clients
        await check('owner cannot read retired social tokens', 'deny', () =>
            owner.doc(`${PROJECT}/social_integrations/instagram`).get());
        await check('member cannot write retired marketing recipients', 'deny', () =>
            member.doc(`${PROJECT}/marketing_recipients/r1`).set({ email: 'a@example.com' }));

        // Project ownership and deletion (regression: the project-level
        // wildcard used to match the project doc itself)
        await fresh();
        await check('member cannot delete project owned by someone else', 'deny', () => member.doc(PROJECT).delete());
        await check('guest cannot delete project', 'deny', () => guest.doc(PROJECT).delete());
        await check('member cannot take over project ownerId', 'deny', () => member.doc(PROJECT).update({ ownerId: 'memberA' }));
        await check('guest cannot take over project ownerId', 'deny', () => guest.doc(PROJECT).update({ ownerId: 'guestA' }));
        await check('guest cannot change project memberIds', 'deny', () =>
            guest.doc(PROJECT).update({ memberIds: ['ownerA', 'guestA', 'outsiderA'] }));
        await check('nobody can move a project to another tenant', 'deny', () => owner.doc(PROJECT).update({ tenantId: 'tenantB' }));
        await check('guest edits project content', 'allow', () => guest.doc(PROJECT).update({ title: 'Guest edit' }));
        await check('project owner transfers ownership', 'allow', () => member.doc(MEMBER_PROJECT).update({ ownerId: 'adminA' }));
        await fresh();
        await check('admin transfers ownership', 'allow', () => admin.doc(PROJECT).update({ ownerId: 'memberA' }));
        await check('project owner deletes own project', 'allow', () => member.doc(MEMBER_PROJECT).delete());
        await check('admin deletes any project', 'allow', () => admin.doc(PROJECT).delete());
        await check('no writes below a deleted project', 'deny', () =>
            member.doc(`${PROJECT}/healthSnapshots/today`).set({ score: 1 }));

        // C7: "my tasks" collection-group query, nextReminderAt scan, iOS device docs
        await fresh();
        const myTasks = (ctx, uid) => ctx.collectionGroup('tasks')
            .where('tenantId', '==', 'tenantA')
            .where('assigneeIds', 'array-contains', uid)
            .where('isCompleted', '==', false)
            .get();
        await check('member runs the "my tasks" collection-group query', 'allow', () => myTasks(member, 'memberA'));
        await check('admin runs the "my tasks" collection-group query', 'allow', () => myTasks(admin, 'adminA'));
        await check('"my tasks" without tenantId is rejected', 'deny', () =>
            member.collectionGroup('tasks').where('assigneeIds', 'array-contains', 'memberA').get());
        await check('outsider cannot run the "my tasks" query for tenant A', 'deny', () => myTasks(outsider, 'memberA'));
        await check('guest cannot run the tenant-wide "my tasks" query', 'deny', () => myTasks(guest, 'guestA'));
        await check('guest reads own tasks per project', 'allow', () =>
            guest.collection(`${PROJECT}/tasks`).where('assigneeIds', 'array-contains', 'guestA').get());
        await check('member reads tasks by nextReminderAt', 'allow', () =>
            member.collectionGroup('tasks').where('tenantId', '==', 'tenantA').where('nextReminderAt', '<=', '2026-12-31T00:00:00.000Z').get());

        await check('owner reads own device doc', 'allow', () => as('memberA').doc('users/memberA/devices/deviceA').get());
        await check('owner writes own device doc', 'allow', () =>
            as('memberA').doc('users/memberA/devices/deviceB').set({ platform: 'ios', fcmToken: 't2', liveActivityStartToken: 's' }));
        await check('other user cannot read device docs', 'deny', () => admin.doc('users/memberA/devices/deviceA').get());
        await check('other user cannot write device docs', 'deny', () => admin.doc('users/memberA/devices/deviceA').set({ fcmToken: 'x' }));
        await check('owner writes own live activity doc', 'allow', () =>
            as('memberA').doc('users/memberA/liveActivities/activityB').set({ deviceId: 'deviceA', pushToken: 'p', itemId: 'taskA', itemType: 'task' }));
        await check('other user cannot read live activity docs', 'deny', () => admin.doc('users/memberA/liveActivities/activityA').get());
        await check('owner cannot read nudgeLog (server only)', 'deny', () => as('memberA').doc('users/memberA/nudgeLog/2026-10-22').get());
        await check('owner cannot write nudgeLog (server only)', 'deny', () => as('memberA').doc('users/memberA/nudgeLog/2026-10-23').set({ sent: [] }));
        await check('owner writes notificationPrefs on the profile', 'allow', () =>
            as('memberA').doc('users/memberA').set({ notificationPrefs: { timezone: 'Europe/Berlin' } }, { merge: true }));

        // Notification Center: recipient-only read / mark read / delete, server-only create
        await fresh();
        const N = `${T}/notifications`;
        const inbox = (ctx, uid) => ctx.collection(N).where('userId', '==', uid).get();
        await check('member reads own notification', 'allow', () => member.doc(`${N}/nMember`).get());
        await check('member runs own inbox query', 'allow', () => inbox(member, 'memberA'));
        await check('member runs own unread-count query', 'allow', () =>
            member.collection(N).where('userId', '==', 'memberA').where('read', '==', false).get());
        await check('guest runs own inbox query', 'allow', () => inbox(guest, 'guestA'));
        await check('member cannot read another user\'s notification', 'deny', () => member.doc(`${N}/nOwner`).get());
        await check('owner cannot read a member\'s notification', 'deny', () => owner.doc(`${N}/nMember`).get());
        await check('member cannot query someone else\'s inbox', 'deny', () => inbox(member, 'ownerA'));
        await check('member cannot list all tenant notifications', 'deny', () => member.collection(N).get());
        await check('outsider cannot read notifications addressed to them in a foreign tenant', 'deny', () =>
            outsider.doc(`${N}/nFormer`).get());
        await check('member marks own notification read', 'allow', () => member.doc(`${N}/nMember`).update({ read: true }));
        await check('guest marks own notification read', 'allow', () => guest.doc(`${N}/nGuest`).update({ read: true }));
        await check('member marks own notification unread again', 'allow', () => member.doc(`${N}/nMember`).update({ read: false }));
        await check('member cannot rewrite own notification content', 'deny', () =>
            member.doc(`${N}/nMember`).update({ title: 'Forged', read: true }));
        await check('member cannot re-address own notification', 'deny', () => member.doc(`${N}/nMember`).update({ userId: 'ownerA' }));
        await check('member cannot mark someone else\'s notification read', 'deny', () => member.doc(`${N}/nOwner`).update({ read: true }));
        await check('member cannot create a notification for someone else', 'deny', () =>
            member.doc(`${N}/forged`).set({ userId: 'ownerA', tenantId: 'tenantA', type: 'task_assigned', title: 'x', message: 'x', read: false, actorId: 'adminA' }));
        await check('member cannot create a notification for themself', 'deny', () =>
            member.collection(N).add({ userId: 'memberA', tenantId: 'tenantA', type: 'task_assigned', title: 'x', message: 'x', read: false }));
        await check('admin cannot delete a member\'s notification', 'deny', () => admin.doc(`${N}/nMember`).delete());
        await check('member deletes own notification', 'allow', () => member.doc(`${N}/nMember`).delete());
        await check('member reads own delivery log', 'allow', () =>
            member.collection(`${T}/notificationDeliveryLogs`).where('userId', '==', 'memberA').get());
        await check('member cannot read someone else\'s delivery log', 'deny', () =>
            member.doc(`${T}/notificationDeliveryLogs/logOwner`).get());
        await check('member cannot write delivery logs', 'deny', () =>
            member.doc(`${T}/notificationDeliveryLogs/logMember`).update({ status: 'failed' }));

        // Files inherit their object's access; writes only via Callables.
        const F = `${T}/files`;
        await check('member reads project file', 'allow', () => member.doc(`${F}/fileProject`).get());
        await check('member reads workspace file', 'allow', () => member.doc(`${F}/fileWorkspace`).get());
        await check('member lists listed files', 'allow', () => member.collection(F).where('listed', '==', true).get());
        await check('guest reads file in own project', 'allow', () => guest.doc(`${F}/fileProject`).get());
        await check('guest queries own project files', 'allow', () =>
            guest.collection(F).where('projectId', '==', 'projectA').where('listed', '==', true).get());
        await check('guest queries task files by root', 'allow', () =>
            guest.collection(F).where('projectId', '==', 'projectA').where('parent.rootId', '==', 'taskA').get());
        await check('guest cannot read file of foreign project', 'deny', () => guest.doc(`${F}/fileMemberProject`).get());
        await check('guest cannot read workspace file', 'deny', () => guest.doc(`${F}/fileWorkspace`).get());
        await check('guest cannot read legacy media', 'deny', () => guest.doc(`${F}/legacyMedia`).get());
        await check('guest cannot list all files', 'deny', () => guest.collection(F).where('listed', '==', true).get());
        await check('guest cannot query foreign project files', 'deny', () =>
            guest.collection(F).where('projectId', '==', 'memberProject').get());
        await check('outsider cannot read project file', 'deny', () => outsider.doc(`${F}/fileProject`).get());
        await check('member cannot create file doc', 'deny', () => member.collection(F).add(fileDoc('projectA')));
        await check('owner cannot rename file directly', 'deny', () => owner.doc(`${F}/fileProject`).update({ name: 'b.pdf' }));
        await check('uploader cannot delete file doc directly', 'deny', () => owner.doc(`${F}/fileProject`).delete());

        // Legal documents + consent (writes only via Cloud Functions).
        const anon = testEnv.unauthenticatedContext().firestore();
        const platformAdmin = testEnv.authenticatedContext('platformAdminA', { platformAdmin: true }).firestore();
        await check('signed-out reads legal index', 'allow', () => anon.doc('legal_documents/terms').get());
        await check('signed-out reads published version', 'allow', () => anon.doc('legal_documents/terms/versions/1').get());
        await check('signed-out lists versions', 'allow', () => anon.collection('legal_documents/terms/versions').get());
        await check('signed-out cannot read draft', 'deny', () => anon.doc('legal_documents/terms/drafts/current').get());
        await check('member cannot read draft', 'deny', () => member.doc('legal_documents/terms/drafts/current').get());
        await check('platform admin cannot read draft (admin console only)', 'deny', () => platformAdmin.doc('legal_documents/terms/drafts/current').get());
        await check('platform admin cannot write draft directly', 'deny', () =>
            platformAdmin.doc('legal_documents/terms/drafts/current').set({ type: 'terms' }));
        await check('platform admin cannot publish directly', 'deny', () =>
            platformAdmin.doc('legal_documents/terms/versions/2').set({ type: 'terms', version: 2 }));
        await check('member cannot change published version', 'deny', () =>
            member.doc('legal_documents/terms/versions/1').update({ status: 'draft' }));
        await check('member cannot move currentVersion', 'deny', () => member.doc('legal_documents/terms').update({ currentVersion: 9 }));
        await check('member reads own consent', 'allow', () => member.doc('legal_acceptances/memberA').get());
        await check('member reads own consent events', 'allow', () => member.collection('legal_acceptances/memberA/events').get());
        await check('owner cannot read member consent', 'deny', () => owner.doc('legal_acceptances/memberA').get());
        await check('nobody lists consents', 'deny', () => platformAdmin.collection('legal_acceptances').get());
        await check('member cannot write own consent', 'deny', () =>
            member.doc('legal_acceptances/memberA').set({ uid: 'memberA', docs: { terms: { version: 99 } } }));
        await check('new user cannot create consent', 'deny', () =>
            outsider.doc('legal_acceptances/outsiderA').set({ uid: 'outsiderA', docs: { terms: { version: 1 } } }));
        await check('member cannot forge consent event', 'deny', () =>
            member.collection('legal_acceptances/memberA/events').add({ type: 'terms', version: 1, decision: 'accepted' }));
        await check('platform admin cannot read mail jobs', 'deny', () => platformAdmin.doc('legal_mail_jobs/terms_v1').get());
        // Activity stream (server-written; guests only for their projects, filtered by projectId)
        const activity = (db) => db.collection(`${T}/activity`);
        await check('member lists workspace activity', 'allow', () => activity(member).orderBy('createdAt', 'desc').limit(30).get());
        await check('member reads workspace-level event', 'allow', () => member.doc(`${T}/activity/evWorkspace`).get());
        await check('guest reads event of own project', 'allow', () => guest.doc(`${T}/activity/evA`).get());
        await check('guest lists own project activity', 'allow', () => activity(guest).where('projectId', '==', 'projectA').get());
        await check('guest lists own projects via in', 'allow', () => activity(guest).where('projectId', 'in', ['projectA']).get());
        await check('guest cannot read other project event', 'deny', () => guest.doc(`${T}/activity/evMember`).get());
        await check('guest cannot read workspace-level event', 'deny', () => guest.doc(`${T}/activity/evWorkspace`).get());
        await check('guest cannot list unfiltered activity', 'deny', () => activity(guest).limit(30).get());
        await check('guest cannot list other project activity', 'deny', () => activity(guest).where('projectId', '==', 'memberProject').get());
        await check('outsider cannot read activity', 'deny', () => outsider.doc(`${T}/activity/evA`).get());
        await check('owner cannot write activity', 'deny', () => owner.doc(`${T}/activity/forged`).set({ type: 'task.created', projectId: 'projectA' }));
        await check('member cannot update activity', 'deny', () => member.doc(`${T}/activity/evA`).update({ type: 'x' }));
        await check('admin cannot delete activity', 'deny', () => admin.doc(`${T}/activity/evA`).delete());
        await check('member reads insights', 'allow', () => member.doc(`${T}/insights_daily/latest`).get());
        await check('member reads insights report', 'allow', () => member.doc(`${T}/insights_reports/2026-W43`).get());
        await check('guest cannot read insights', 'deny', () => guest.doc(`${T}/insights_daily/latest`).get());
        await check('guest cannot read insights report', 'deny', () => guest.doc(`${T}/insights_reports/2026-W43`).get());
        await check('owner cannot write insights', 'deny', () => owner.doc(`${T}/insights_daily/latest`).set({ day: 'x' }));

        // Admin console collections: closed to every client, platform admin included (adminApi only).
        for (const path of ['platform_admins/platformAdminA', 'admin_sessions/platformAdminA', 'admin_audit/a1']) {
            await check(`platform admin cannot read ${path}`, 'deny', () => platformAdmin.doc(path).get());
            await check(`platform admin cannot write ${path}`, 'deny', () => platformAdmin.doc(path).set({ email: 'x' }));
            await check(`member cannot write ${path}`, 'deny', () => member.doc(path).set({ email: 'x' }));
        }
        await check('platform admin cannot list audit log', 'deny', () => platformAdmin.collection('admin_audit').get());
        await check('platform admin cannot read crash issue (adminApi only)', 'deny', () => platformAdmin.doc('crashIssues/fp1').get());
        await check('platform admin cannot triage crash issue directly', 'deny', () => platformAdmin.doc('crashIssues/fp1').set({ status: 'resolved' }));
        await check('member cannot read crash events', 'deny', () => member.collection('crashIssues/fp1/crashEvents').get());

        // Removed Finance V2 module: its data stays in Firestore but is closed to clients.
        await check('owner cannot read legacy finance data', 'deny', () => owner.doc(`${T}/finance_accounts/acc1`).get());
        await check('member cannot write legacy finance data', 'deny', () => member.doc(`${T}/finance_journal/j1`).set({ amount: 1 }));
    } finally {
        await testEnv.cleanup();
    }

    const failed = results.filter((result) => !result.ok);
    results.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.label}${result.ok ? '' : `  -> ${result.error}`}`));
    console.log(`\n${results.length - failed.length}/${results.length} Firestore rules checks passed.`);
    if (failed.length) process.exitCode = 1;
};

run().catch((error) => {
    console.error('Firestore rules tests crashed.');
    console.error(error);
    process.exitCode = 1;
});
