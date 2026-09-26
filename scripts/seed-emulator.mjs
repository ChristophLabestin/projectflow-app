#!/usr/bin/env node
// Seeds the local Firebase emulators (never production) with a realistic
// ProjectFlow workspace so every PM view can be reviewed with real states:
// overdue, due today, blocked, unassigned, no date, done, subtasks, etc.
//
// Usage (emulators must be running: `firebase emulators:start --only auth,firestore,storage --project demo-projectflow`):
//   NODE_PATH=functions/node_modules node scripts/seed-emulator.mjs
//
// Demo login (emulator only): demo@projectflow.test / projectflow-demo
// Signup test account (emulator only, registered through the UI, not seeded): neu@projectflow.test / pf-signup-5fb2c664
// Second signup test account (emulator only, onboarding flow): neu2@projectflow.test / pf-signup-5fb2c664
// Third signup test account (emulator only, solo onboarding): neu3@projectflow.test / pf-signup-5fb2c664

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const admin = require(require.resolve('firebase-admin', { paths: [process.cwd() + '/functions/node_modules'] }));

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

const PROJECT_ID = 'demo-projectflow';
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const auth = admin.auth();
const { Timestamp } = admin.firestore;

const OWNER = { uid: 'demo-owner', email: 'demo@projectflow.test', password: 'projectflow-demo', displayName: 'Christoph Demo' };
const TEAM = [
    { uid: 'demo-anna', email: 'anna@projectflow.test', displayName: 'Anna Berger' },
    { uid: 'demo-luis', email: 'luis@projectflow.test', displayName: 'Luis Romero' },
];
const TID = 'ws-demo-studio';

const day = (offset) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
};
const ts = (offsetDays = 0, hours = 0) => Timestamp.fromDate(new Date(Date.now() + offsetDays * 86400000 + hours * 3600000));

const upsertUser = async (u, password) => {
    try { await auth.deleteUser(u.uid); } catch { /* not present */ }
    await auth.createUser({ uid: u.uid, email: u.email, displayName: u.displayName, password: password || 'projectflow-demo', emailVerified: true });
};

const clearCollection = async () => {
    await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
};

const PROJECTS = [
    {
        id: 'p-website',
        title: 'Website Relaunch',
        description: 'New marketing site with CMS, faster pages and a clearer signup path.',
        status: 'Active', priority: 'High', startDate: day(-30), dueDate: day(21), progress: 42,
        modules: ['tasks', 'initiatives', 'sprints', 'milestones', 'activity'],
        initiatives: [
            { id: 'i-cms', title: 'CMS migration', health: 'At Risk', status: 'In Progress', priority: 'High', dueDate: day(10) },
            { id: 'i-signup', title: 'Signup conversion', health: 'On Track', status: 'Planning', priority: 'Medium', dueDate: day(28) },
        ],
        sprint: { id: 's-12', name: 'Sprint 12', goal: 'Ship CMS content model + homepage', startDate: day(-5), endDate: day(9), status: 'Active' },
        milestones: [
            { id: 'm-beta', title: 'Beta on staging', dueDate: day(7), status: 'Pending', riskRating: 'Medium' },
            { id: 'm-launch', title: 'Public launch', dueDate: day(21), status: 'Pending', riskRating: 'High' },
            { id: 'm-design', title: 'Design sign-off', dueDate: day(-10), status: 'Achieved', riskRating: 'Low' },
        ],
        tasks: [
            { id: 't-hero', title: 'Finalize homepage hero copy', status: 'In Progress', priority: 'High', dueDate: day(0), assignee: OWNER.uid, initiativeId: 'i-signup', nextStep: 'Send two variants to Anna for review', subtasks: ['Draft variant A', 'Draft variant B', 'Collect feedback'], subtasksDone: 1 },
            { id: 't-cms-schema', title: 'Define CMS content schema', status: 'Review', priority: 'Urgent', dueDate: day(-2), assignee: 'demo-anna', initiativeId: 'i-cms', sprint: true },
            { id: 't-cms-import', title: 'Import legacy blog posts', status: 'Blocked', priority: 'High', dueDate: day(3), assignee: 'demo-luis', initiativeId: 'i-cms', dependencies: ['t-cms-schema'], blockerNote: 'Waiting for final schema', sprint: true },
            { id: 't-redirects', title: 'Set up 301 redirects for old URLs', status: 'Open', priority: 'Medium', dueDate: day(-4), assignee: OWNER.uid, sprint: true },
            { id: 't-perf', title: 'Lighthouse performance pass', status: 'Open', priority: 'Medium', dueDate: day(5) },
            { id: 't-analytics', title: 'Wire up analytics events', status: 'Backlog', priority: 'Low' },
            { id: 't-a11y', title: 'Accessibility audit of templates', status: 'Open', priority: 'High', assignee: 'demo-anna' },
            { id: 't-forms', title: 'Rebuild contact form with spam protection', status: 'In Progress', priority: 'Medium', dueDate: day(1), assignee: 'demo-luis', sprint: true },
            { id: 't-og', title: 'Social preview images', status: 'Done', priority: 'Low', dueDate: day(-6), assignee: 'demo-anna', done: true },
            { id: 't-nav', title: 'New navigation structure', status: 'Done', priority: 'Medium', dueDate: day(-8), assignee: OWNER.uid, done: true },
            { id: 't-legal', title: 'Update imprint & privacy pages', status: 'Open', priority: 'Urgent', dueDate: day(2) },
        ],
    },
    {
        id: 'p-app',
        title: 'Mobile App v2',
        description: 'iOS companion app: offline tasks, widgets and push notifications.',
        status: 'Active', priority: 'Medium', startDate: day(-60), dueDate: day(45), progress: 65,
        modules: ['tasks', 'initiatives', 'milestones', 'activity'],
        initiatives: [{ id: 'i-offline', title: 'Offline mode', health: 'On Track', status: 'In Progress', priority: 'High', dueDate: day(20) }],
        milestones: [{ id: 'm-testflight', title: 'TestFlight build', dueDate: day(12), status: 'Pending', riskRating: 'Low' }],
        tasks: [
            { id: 't-sync', title: 'Conflict resolution for offline edits', status: 'In Progress', priority: 'Urgent', dueDate: day(-1), assignee: OWNER.uid, initiativeId: 'i-offline', nextStep: 'Write test for concurrent title edit' },
            { id: 't-widget', title: 'Focus widget: show next task', status: 'Open', priority: 'Medium', dueDate: day(6), assignee: 'demo-luis' },
            { id: 't-push', title: 'APNs production certificate', status: 'On Hold', priority: 'High', dueDate: day(4), assignee: OWNER.uid, blockerNote: 'Needs Apple developer account access' },
            { id: 't-icons', title: 'App icon variants', status: 'Done', priority: 'Low', done: true, assignee: 'demo-anna', dueDate: day(-3) },
            { id: 't-onboard', title: 'Onboarding screens', status: 'Open', priority: 'Medium', dueDate: day(0), assignee: OWNER.uid },
        ],
    },
    {
        id: 'p-q4',
        title: 'Q4 Planning',
        description: 'Budget, hiring plan and goals for next quarter.',
        status: 'Planning', priority: 'Low', startDate: day(3), dueDate: day(40), progress: 5,
        modules: ['tasks', 'activity'],
        tasks: [
            { id: 't-budget', title: 'Draft Q4 budget', status: 'Open', priority: 'Medium', dueDate: day(8), assignee: OWNER.uid },
            { id: 't-hiring', title: 'Hiring plan for design role', status: 'Backlog', priority: 'Low' },
        ],
    },
    {
        id: 'p-old',
        title: 'Brand Refresh 2025',
        description: 'Completed rebrand project.',
        status: 'Completed', priority: 'Low', startDate: day(-200), dueDate: day(-90), progress: 100,
        modules: ['tasks', 'activity'],
        tasks: [{ id: 't-logo', title: 'Final logo files', status: 'Done', priority: 'Medium', done: true, assignee: OWNER.uid, dueDate: day(-95) }],
    },
];

const people = [OWNER, ...TEAM];
const nameOf = (uid) => people.find((p) => p.uid === uid)?.displayName || '';

async function main() {
    await clearCollection();
    await upsertUser(OWNER, OWNER.password);
    for (const m of TEAM) await upsertUser(m);

    const batch = db.batch();
    for (const u of people) {
        batch.set(db.doc(`users/${u.uid}`), { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: '', createdAt: ts(-90), updatedAt: ts(-1) });
    }
    batch.set(db.doc(`tenants/${TID}`), { tenantId: TID, name: 'Demo Studio', ownerId: OWNER.uid, createdBy: OWNER.uid, createdAt: ts(-90), updatedAt: ts(-1), AccessToModules: [] });
    for (const u of people) {
        batch.set(db.doc(`tenants/${TID}/members/${u.uid}`), { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: '', joinedAt: ts(-80), role: u.uid === OWNER.uid ? 'Owner' : (u.uid === 'demo-anna' ? 'Admin' : 'Member'), roleIds: [] });
    }
    batch.set(db.doc(`users/${OWNER.uid}`), { lastTenantId: TID }, { merge: true });

    // Cross-tenant: Anna's agency workspace where the demo user is a Guest on one project.
    const AGENCY = 'ws-berger-agency';
    batch.set(db.doc(`tenants/${AGENCY}`), { tenantId: AGENCY, name: 'Berger Agency', ownerId: 'demo-anna', createdBy: 'demo-anna', createdAt: ts(-60), updatedAt: ts(-2) });
    batch.set(db.doc(`tenants/${AGENCY}/members/demo-anna`), { uid: 'demo-anna', email: 'anna@projectflow.test', displayName: 'Anna Berger', photoURL: '', role: 'Owner', roleIds: [], joinedAt: ts(-60) });
    batch.set(db.doc(`tenants/${AGENCY}/members/${OWNER.uid}`), { uid: OWNER.uid, email: OWNER.email, displayName: OWNER.displayName, photoURL: '', role: 'Guest', roleIds: [], joinedAt: ts(-10), invitedBy: 'demo-anna' });
    const agencyMembers = ['demo-anna', OWNER.uid];
    batch.set(db.doc(`tenants/${AGENCY}/projects/p-client-shop`), {
        title: 'Client Shop Redesign', description: 'Shared with Demo Studio as guest.', status: 'Active', priority: 'Medium',
        startDate: day(-14), dueDate: day(30), progress: 30, modules: ['tasks', 'activity'], ownerId: 'demo-anna', tenantId: AGENCY,
        memberIds: agencyMembers, members: agencyMembers.map((uid) => ({ userId: uid, role: uid === 'demo-anna' ? 'Owner' : 'Editor', joinedAt: ts(-10), invitedBy: 'demo-anna' })),
        roles: { 'demo-anna': 'Owner', [OWNER.uid]: 'Editor' }, projectType: 'standard', createdAt: ts(-14), updatedAt: ts(-1)
    });
    batch.set(db.doc(`tenants/${AGENCY}/projects/p-client-shop/tasks/t-shop-copy`), {
        projectId: 'p-client-shop', tenantId: AGENCY, ownerId: 'demo-anna', createdBy: 'demo-anna', title: 'Review product page copy',
        description: '', isCompleted: false, status: 'Open', priority: 'High', dueDate: day(1), startDate: '', assigneeId: OWNER.uid,
        assigneeIds: [OWNER.uid], assignedGroupIds: [], category: [], dependencies: [], createdAt: ts(-3), updatedAt: ts(-1)
    });
    batch.set(db.doc(`tenants/${AGENCY}/projects/p-internal`), {
        title: 'Agency Internal', description: 'Not visible to guests.', status: 'Active', priority: 'Low', progress: 10,
        modules: ['tasks'], ownerId: 'demo-anna', tenantId: AGENCY, memberIds: ['demo-anna'], members: [], roles: { 'demo-anna': 'Owner' },
        projectType: 'standard', createdAt: ts(-30), updatedAt: ts(-3)
    });

    // Pending email invitation from Luis' workspace to the demo user.
    const LUIS_WS = 'ws-romero-labs';
    batch.set(db.doc(`tenants/${LUIS_WS}`), { tenantId: LUIS_WS, name: 'Romero Labs', ownerId: 'demo-luis', createdBy: 'demo-luis', createdAt: ts(-20), updatedAt: ts(-2) });
    batch.set(db.doc(`tenants/${LUIS_WS}/members/demo-luis`), { uid: 'demo-luis', email: 'luis@projectflow.test', displayName: 'Luis Romero', photoURL: '', role: 'Owner', roleIds: [], joinedAt: ts(-20) });
    batch.set(db.doc(`tenants/${LUIS_WS}/invitations/inv-demo-romero`), {
        tenantId: LUIS_WS, tenantName: 'Romero Labs', kind: 'email', email: OWNER.email, role: 'Member', projectIds: [],
        status: 'pending', invitedBy: 'demo-luis', invitedByName: 'Luis Romero', createdAt: ts(-1),
        expiresAt: new Date(Date.now() + 10 * 86400000).toISOString(), maxUses: 1, uses: 0
    });
    await batch.commit();

    for (const [pi, p] of PROJECTS.entries()) {
        const base = `tenants/${TID}/projects/${p.id}`;
        const memberIds = people.map((u) => u.uid);
        await db.doc(base).set({
            title: p.title, description: p.description, status: p.status, priority: p.priority,
            startDate: p.startDate, dueDate: p.dueDate, progress: p.progress, modules: p.modules,
            ownerId: OWNER.uid, tenantId: TID, memberIds,
            members: people.map((u) => ({ userId: u.uid, role: u.uid === OWNER.uid ? 'Owner' : 'Editor', joinedAt: ts(-70), invitedBy: OWNER.uid })),
            roles: Object.fromEntries(people.map((u) => [u.uid, u.uid === OWNER.uid ? 'Owner' : 'Editor'])),
            projectType: 'standard', createdAt: ts(-70 + pi), updatedAt: ts(-pi),
            reminders: pi === 0 ? [{ id: 'r-1', title: 'Check launch checklist with Anna', remindAt: day(1), linkedType: 'project', linkedId: p.id, linkedTitle: p.title, isCompleted: false, createdAt: day(-2) }] : [],
        });
        for (const i of p.initiatives || []) {
            await db.doc(`${base}/initiatives/${i.id}`).set({ projectId: p.id, tenantId: TID, ownerId: OWNER.uid, title: i.title, status: i.status, priority: i.priority, health: i.health, successMetric: '', outcome: '', color: '', assigneeIds: [OWNER.uid], startDate: p.startDate, dueDate: i.dueDate, createdAt: ts(-40), updatedAt: ts(-2) });
        }
        if (p.sprint) {
            const s = p.sprint;
            await db.doc(`${base}/sprints/${s.id}`).set({ projectId: p.id, name: s.name, goal: s.goal, startDate: s.startDate, endDate: s.endDate, status: s.status, createdAt: ts(-6), createdBy: OWNER.uid, updatedAt: ts(-1), memberIds, autoStart: false });
        }
        for (const m of p.milestones || []) {
            await db.doc(`${base}/milestones/${m.id}`).set({ projectId: p.id, tenantId: TID, title: m.title, description: '', dueDate: m.dueDate, status: m.status, createdAt: ts(-30), createdBy: OWNER.uid, linkedTaskIds: [], riskRating: m.riskRating });
        }
        for (const [ti, t] of p.tasks.entries()) {
            const assigneeIds = t.assignee ? [t.assignee] : [];
            await db.doc(`${base}/tasks/${t.id}`).set({
                projectId: p.id, tenantId: TID, ownerId: OWNER.uid, createdBy: OWNER.uid,
                title: t.title, description: '', isCompleted: !!t.done, status: t.status, priority: t.priority,
                dueDate: t.dueDate || '', startDate: '', assigneeId: t.assignee || '', assigneeIds, assignedGroupIds: [], category: [],
                initiativeId: t.initiativeId || null, sprintId: t.sprint ? p.sprint.id : null,
                dependencies: t.dependencies || [], nextStep: t.nextStep || '', blockerNote: t.blockerNote || '',
                createdAt: ts(-20 + ti), updatedAt: ts(-1, -ti),
                ...(t.done ? { completedAt: ts(-3).toDate().toISOString(), completedBy: t.assignee || OWNER.uid } : {}),
            });
            for (const [si, title] of (t.subtasks || []).entries()) {
                await db.doc(`${base}/tasks/${t.id}/subtasks/st-${t.id}-${si}`).set({ taskId: t.id, projectId: p.id, ownerId: OWNER.uid, title, isCompleted: si < (t.subtasksDone || 0), createdAt: ts(-5 + si) });
            }
        }
        const acts = p.tasks.slice(0, 4).map((t, ai) => ({ user: nameOf(t.assignee || OWNER.uid) || OWNER.displayName, action: ai % 2 ? 'updated status of' : 'created task', target: t.title, relatedId: t.id, type: 'task', createdAt: ts(0, -(ai + 1) * 5) }));
        for (const [ai, a] of acts.entries()) {
            await db.doc(`${base}/activities/a-${p.id}-${ai}`).set({ projectId: p.id, tenantId: TID, ownerId: OWNER.uid, userAvatar: '', details: '', ...a });
        }
    }
    console.log(`Seeded ${PROJECTS.length} projects. Login: ${OWNER.email} / ${OWNER.password}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
