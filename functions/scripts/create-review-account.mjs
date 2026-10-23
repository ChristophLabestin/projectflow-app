#!/usr/bin/env node
// Creates (or refreshes) the Apple App Review / TestFlight demo account with its own, pre-filled workspace.
//
//   Production (run by the owner/orchestrator only):
//     cd functions && node scripts/create-review-account.mjs --production [--rotate-password]
//   Emulators (QA):
//     FIRESTORE_EMULATOR_HOST=127.0.0.1:8761 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9761 GCLOUD_PROJECT=demo-projectflow \
//       node scripts/create-review-account.mjs
//
// What it does (idempotent):
// 1. Auth user app-review@getprojectflow.com (email verified, "App Review"). The password is generated here and written
//    ONLY to the secret file (default ~/ProjectFlowSigning/app-review-account.txt, folder 700, file 600) — never to stdout.
//    An existing password is kept unless --rotate-password is passed (or the secret file is missing).
// 2. Workspace "Demo Studio (App Review)" owned by the review user, rebuilt from scratch on every run with dates relative
//    to today: projects, tasks (statuses, due dates, subtasks, comments), board, sprint, milestones, personal tasks.
//    Team mates are member/profile docs only — no Auth accounts, so nobody can sign in as them.
// 3. Onboarding finished and the currently published privacy/terms versions accepted (no welcome, gate or consent dialog).
// 4. User + workspace carry `isReviewAccount: true` so stats/admin views can filter them out.
// 5. No platform admin claim, no access beyond its own workspace.
// Production uses Application Default Credentials (gcloud auth application-default login).

import { createRequire } from 'node:module';
import { randomInt } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const functionsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
};

const usingEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
if (usingEmulators && !(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST)) {
    console.error('Set both FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST (or neither for production).');
    process.exit(1);
}
if (!usingEmulators && !flag('--production')) {
    console.error('No emulator hosts set. To write to production, pass --production explicitly.');
    process.exit(1);
}

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'projectflow-labestin';
admin.initializeApp(usingEmulators
    ? { projectId: PROJECT_ID }
    : { projectId: PROJECT_ID, credential: admin.credential.applicationDefault() });
const db = admin.firestore();
const auth = admin.auth();
const { Timestamp } = admin.firestore;

const EMAIL = 'app-review@getprojectflow.com';
const DISPLAY_NAME = 'App Review';
const TID = 'ws-app-review';
const WORKSPACE_NAME = 'Demo Studio (App Review)';
const SECRET_FILE = resolve(option('--secret-file')
    || join(homedir(), 'ProjectFlowSigning', usingEmulators ? 'app-review-account.emulator.txt' : 'app-review-account.txt'));

// ---------------------------------------------------------------------------
// Password (never printed)
// ---------------------------------------------------------------------------

// No look-alikes (0/O/o, 1/l/I) and nothing that needs shift tricks; 5 groups of 5 = 25 letters/digits.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generatePassword = () => Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')).join('-');

const readStoredPassword = () => {
    if (!existsSync(SECRET_FILE)) return null;
    const match = readFileSync(SECRET_FILE, 'utf8').match(/^password:\s*(\S+)\s*$/m);
    return match ? match[1] : null;
};

const writeSecretFile = (password) => {
    const dir = dirname(SECRET_FILE);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    writeFileSync(SECRET_FILE, [
        '# ProjectFlow App Review account (App Store Connect → App Review Information → Sign-in required)',
        `project: ${PROJECT_ID}${usingEmulators ? ' (emulators)' : ''}`,
        `email: ${EMAIL}`,
        `password: ${password}`,
        `updated: ${new Date().toISOString()}`,
        '',
    ].join('\n'), { mode: 0o600 });
    chmodSync(SECRET_FILE, 0o600);
};

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const day = (offset) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
};
const ts = (offsetDays = 0, hours = 0) => Timestamp.fromDate(new Date(Date.now() + offsetDays * 86400000 + hours * 3600000));
// Server triggers (activity, notifications, progress, mails) skip docs with a fresh `systemWriteAt`,
// so seeding never notifies anyone.
const SYSTEM_STAMP = () => ({ systemWriteAt: Timestamp.now() });

// Team mates without Auth accounts (example.com is reserved, nothing is ever delivered there).
const TEAM = [
    { uid: 'review-mia', email: 'mia.keller@example.com', displayName: 'Mia Keller', role: 'Admin' },
    { uid: 'review-jonas', email: 'jonas.wagner@example.com', displayName: 'Jonas Wagner', role: 'Member' },
    { uid: 'review-sofia', email: 'sofia.reyes@example.com', displayName: 'Sofia Reyes', role: 'Member' },
];

const buildProjects = (me) => [
    {
        id: 'p-website',
        title: 'Website Relaunch',
        description: 'New marketing site with a CMS, faster pages and a clearer signup path.',
        status: 'Active', priority: 'High', startDate: day(-30), dueDate: day(21),
        modules: ['tasks', 'initiatives', 'sprints', 'milestones', 'activity'],
        initiatives: [
            { id: 'i-cms', title: 'CMS migration', health: 'At Risk', status: 'In Progress', priority: 'High', dueDate: day(10) },
            { id: 'i-signup', title: 'Signup conversion', health: 'On Track', status: 'Planning', priority: 'Medium', dueDate: day(28) },
        ],
        sprint: { id: 's-7', name: 'Sprint 7', goal: 'Ship the CMS content model and the new homepage', startDate: day(-5), endDate: day(9), status: 'Active' },
        milestones: [
            { id: 'm-design', title: 'Design sign-off', dueDate: day(-10), status: 'Achieved', riskRating: 'Low' },
            { id: 'm-beta', title: 'Beta on staging', dueDate: day(7), status: 'Pending', riskRating: 'Medium' },
            { id: 'm-launch', title: 'Public launch', dueDate: day(21), status: 'Pending', riskRating: 'High' },
        ],
        tasks: [
            { id: 't-hero', title: 'Finalize homepage hero copy', status: 'In Progress', priority: 'High', dueDate: day(0), assignee: me, initiativeId: 'i-signup', sprint: true,
              nextStep: 'Send both variants to Mia for review', subtasks: ['Draft variant A', 'Draft variant B', 'Collect feedback'], subtasksDone: 2 },
            { id: 't-schema', title: 'Define CMS content schema', status: 'Review', priority: 'Urgent', dueDate: day(-1), assignee: 'review-mia', initiativeId: 'i-cms', sprint: true },
            { id: 't-import', title: 'Import existing blog posts', status: 'Blocked', priority: 'High', dueDate: day(3), assignee: 'review-jonas', initiativeId: 'i-cms', sprint: true,
              dependencies: ['t-schema'], blockerNote: 'Waiting for the final content schema' },
            { id: 't-redirects', title: 'Set up redirects for old URLs', status: 'Open', priority: 'Medium', dueDate: day(2), assignee: me, sprint: true },
            { id: 't-perf', title: 'Performance pass on all templates', status: 'Open', priority: 'Medium', dueDate: day(5), assignee: 'review-sofia' },
            { id: 't-analytics', title: 'Wire up analytics events', status: 'Backlog', priority: 'Low' },
            { id: 't-forms', title: 'Contact form with spam protection', status: 'In Progress', priority: 'Medium', dueDate: day(1), assignee: 'review-jonas', sprint: true },
            { id: 't-nav', title: 'New navigation structure', status: 'Done', priority: 'Medium', dueDate: day(-8), assignee: me, done: true },
            { id: 't-og', title: 'Social preview images', status: 'Done', priority: 'Low', dueDate: day(-6), assignee: 'review-sofia', done: true },
        ],
    },
    {
        id: 'p-app',
        title: 'Mobile App Launch',
        description: 'iOS app with offline tasks, widgets and push notifications.',
        status: 'Active', priority: 'Medium', startDate: day(-45), dueDate: day(35),
        modules: ['tasks', 'initiatives', 'milestones', 'activity'],
        initiatives: [{ id: 'i-offline', title: 'Offline mode', health: 'On Track', status: 'In Progress', priority: 'High', dueDate: day(18) }],
        milestones: [{ id: 'm-testflight', title: 'TestFlight beta', dueDate: day(10), status: 'Pending', riskRating: 'Low' }],
        tasks: [
            { id: 't-sync', title: 'Resolve conflicts for offline edits', status: 'In Progress', priority: 'Urgent', dueDate: day(0), assignee: me, initiativeId: 'i-offline',
              nextStep: 'Write a test for two concurrent title edits', subtasks: ['Reproduce the conflict', 'Merge strategy', 'Tests'], subtasksDone: 1 },
            { id: 't-widget', title: 'Home screen widget: next task', status: 'Open', priority: 'Medium', dueDate: day(6), assignee: 'review-sofia' },
            { id: 't-screens', title: 'App Store screenshots', status: 'Open', priority: 'High', dueDate: day(4), assignee: me },
            { id: 't-icons', title: 'App icon variants', status: 'Done', priority: 'Low', dueDate: day(-3), assignee: 'review-sofia', done: true },
        ],
    },
    {
        id: 'p-kundenportal',
        title: 'Kundenportal Relaunch',
        description: 'Neues Kundenportal mit Self-Service für Rechnungen und Supportanfragen.',
        status: 'Active', priority: 'High', startDate: day(-20), dueDate: day(40),
        modules: ['tasks', 'milestones', 'activity'],
        milestones: [{ id: 'm-pilot', title: 'Pilot mit drei Kunden', dueDate: day(14), status: 'Pending', riskRating: 'Medium' }],
        tasks: [
            { id: 't-login', title: 'Login mit Passkeys umsetzen', status: 'In Progress', priority: 'High', dueDate: day(3), assignee: 'review-jonas',
              subtasks: ['Registrierung', 'Anmeldung', 'Fallback per E-Mail'], subtasksDone: 1 },
            { id: 't-rechnungen', title: 'Rechnungsübersicht mit PDF-Download', status: 'Open', priority: 'Medium', dueDate: day(7), assignee: me },
            { id: 't-texte', title: 'Texte für die Startseite abstimmen', status: 'Review', priority: 'Medium', dueDate: day(1), assignee: 'review-mia' },
            { id: 't-dsgvo', title: 'Datenschutzhinweise prüfen', status: 'Open', priority: 'Urgent', dueDate: day(-2), assignee: me },
            { id: 't-kickoff', title: 'Kick-off mit dem Kundenteam', status: 'Done', priority: 'Low', dueDate: day(-12), assignee: me, done: true },
        ],
    },
    {
        id: 'p-q-plan',
        title: 'Next Quarter Planning',
        description: 'Goals, budget and hiring plan for the next quarter.',
        status: 'Planning', priority: 'Low', startDate: day(3), dueDate: day(45),
        modules: ['tasks', 'activity'],
        tasks: [
            { id: 't-goals', title: 'Draft quarterly goals', status: 'Open', priority: 'Medium', dueDate: day(8), assignee: me },
            { id: 't-hiring', title: 'Hiring plan for a product designer', status: 'Backlog', priority: 'Low' },
        ],
    },
];

const comments = (me, myName) => [
    { id: 'c-hero-1', projectId: 'p-website', targetId: 't-hero', userId: 'review-mia', name: 'Mia Keller', created: ts(-1, -3), mentions: [me],
      content: `@${myName} I left notes on both hero variants — B reads clearer to me. Can you pick one today?` },
    { id: 'c-hero-2', projectId: 'p-website', targetId: 't-hero', userId: me, name: myName, created: ts(-1, -1),
      content: 'Agreed, going with B. I will update the copy this afternoon.' },
    { id: 'c-schema-1', projectId: 'p-website', targetId: 't-schema', userId: me, name: myName, created: ts(-2),
      content: 'Could you share the schema draft? The blog import is waiting for it.' },
    { id: 'c-login-1', projectId: 'p-kundenportal', targetId: 't-login', userId: 'review-jonas', name: 'Jonas Wagner', created: ts(-1, -5),
      content: 'Registrierung läuft, als Nächstes kommt die Anmeldung mit Passkey.' },
];

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

const ensureAuthUser = async () => {
    let user = null;
    try {
        user = await auth.getUserByEmail(EMAIL);
    } catch (error) {
        if (error?.code !== 'auth/user-not-found') throw error;
    }
    const stored = readStoredPassword();
    const rotate = flag('--rotate-password') || !user || !stored;
    const password = rotate ? generatePassword() : stored;
    if (user) {
        user = await auth.updateUser(user.uid, { displayName: DISPLAY_NAME, emailVerified: true, disabled: false, ...(rotate ? { password } : {}) });
    } else {
        user = await auth.createUser({ email: EMAIL, displayName: DISPLAY_NAME, emailVerified: true, password });
    }
    // Never a platform admin; keep a marker claim for server-side filters.
    const claims = { ...(user.customClaims || {}) };
    delete claims.platformAdmin;
    await auth.setCustomUserClaims(user.uid, { ...claims, reviewAccount: true });
    if (rotate) writeSecretFile(password);
    return { uid: user.uid, rotated: rotate };
};

const writeProfile = async (uid) => {
    const batch = db.batch();
    batch.set(db.doc(`users/${uid}`), {
        uid, email: EMAIL, displayName: DISPLAY_NAME, photoURL: '', isReviewAccount: true,
        createdAt: ts(-60), updatedAt: Timestamp.now(),
        notificationPrefs: {
            timezone: 'America/Los_Angeles',
            push: { assignments: true, mentions: true, comments: true, due: true, reminders: true },
            email: { assignments: false, mentions: false, comments: false, due: false, reminders: false },
            morningBriefing: { enabled: false, time: '08:00' },
            dayClose: { enabled: false, time: '17:30' },
        },
    }, { merge: true });
    batch.set(db.doc(`users/${uid}/private/workspace`), { lastTenantId: TID, updatedAt: Timestamp.now() }, { merge: true });
    // Onboarding done: no welcome dialog, no getting-started checklist.
    batch.set(db.doc(`users/${uid}/private/onboarding`), { welcomePending: false, checklistDismissed: true, updatedAt: Timestamp.now() }, { merge: true });
    for (const mate of TEAM) {
        batch.set(db.doc(`users/${mate.uid}`), { uid: mate.uid, email: mate.email, displayName: mate.displayName, photoURL: '', isReviewAccount: true, createdAt: ts(-90), updatedAt: ts(-1) }, { merge: true });
    }
    await batch.commit();
};

const acceptLegalDocuments = async (uid) => {
    let logic;
    try {
        logic = require(join(functionsDir, 'lib', 'legal-logic.js'));
    } catch {
        throw new Error('functions/lib is missing — run `npm run build` in functions/ first.');
    }
    const toMs = (value) => (typeof value?.toMillis === 'function' ? value.toMillis() : Number(value) || 0);
    const now = Date.now();
    const docs = {};
    for (const type of logic.ACCEPTANCE_TYPES) {
        const snap = await db.doc(`legal_documents/${type}`).get();
        const versions = (snap.data()?.versions || []).map((raw) => ({
            version: Number(raw?.version) || 0,
            changeType: raw?.changeType === 'requiresAcceptance' ? 'requiresAcceptance' : 'notifyOnly',
            effectiveAtMs: toMs(raw?.effectiveAt),
            publishedAtMs: toMs(raw?.publishedAt),
            summary: { de: '', en: '' },
        }));
        const current = logic.currentEffective(versions, now);
        if (current) docs[type] = { version: current.version, acceptedAt: Timestamp.now(), platform: 'web', appVersion: 'review-account-script', decision: 'accepted' };
    }
    const ref = db.doc(`legal_acceptances/${uid}`);
    await ref.set({ uid, updatedAt: Timestamp.now(), docs }, { merge: true });
    for (const [type, entry] of Object.entries(docs)) {
        await ref.collection('events').doc(`review-${type}-v${entry.version}`).set({
            type, version: entry.version, decision: 'accepted', platform: 'web', appVersion: 'review-account-script', at: entry.acceptedAt,
        });
    }
    return Object.fromEntries(Object.entries(docs).map(([type, entry]) => [type, entry.version]));
};

const rebuildWorkspace = async (uid) => {
    const tenantRef = db.doc(`tenants/${TID}`);
    const existing = await tenantRef.get();
    if (existing.exists && existing.data()?.ownerId !== uid) {
        throw new Error(`tenants/${TID} exists and belongs to someone else — refusing to touch it.`);
    }
    // Fresh demo data on every run (dates are relative to today).
    if (existing.exists) await db.recursiveDelete(tenantRef);

    const people = [{ uid, email: EMAIL, displayName: DISPLAY_NAME, role: 'Owner' }, ...TEAM];
    const nameOf = (id) => people.find((person) => person.uid === id)?.displayName || '';
    const batch = db.batch();
    batch.set(tenantRef, {
        tenantId: TID, name: WORKSPACE_NAME, ownerId: uid, createdBy: uid, createdAt: ts(-60), updatedAt: Timestamp.now(),
        AccessToModules: [], isReviewAccount: true,
    });
    for (const person of people) {
        batch.set(db.doc(`tenants/${TID}/members/${person.uid}`), {
            uid: person.uid, email: person.email, displayName: person.displayName, photoURL: '', role: person.role, roleIds: [], joinedAt: ts(-55),
        });
    }
    await batch.commit();

    const projects = buildProjects(uid);
    const memberIds = people.map((person) => person.uid);
    for (const [pi, p] of projects.entries()) {
        const base = `tenants/${TID}/projects/${p.id}`;
        await db.doc(base).set({
            title: p.title, description: p.description, status: p.status, priority: p.priority,
            startDate: p.startDate, dueDate: p.dueDate, modules: p.modules,
            progress: Math.round((p.tasks.filter((t) => t.done).length / p.tasks.length) * 100),
            ownerId: uid, tenantId: TID, memberIds,
            members: people.map((person) => ({ userId: person.uid, role: person.uid === uid ? 'Owner' : 'Editor', joinedAt: ts(-50), invitedBy: uid })),
            roles: Object.fromEntries(people.map((person) => [person.uid, person.uid === uid ? 'Owner' : 'Editor'])),
            projectType: 'standard', createdAt: ts(-50 + pi), updatedAt: ts(-pi), reminders: [], ...SYSTEM_STAMP(),
        });
        for (const i of p.initiatives || []) {
            await db.doc(`${base}/initiatives/${i.id}`).set({
                projectId: p.id, tenantId: TID, ownerId: uid, title: i.title, status: i.status, priority: i.priority, health: i.health,
                successMetric: '', outcome: '', color: '', assigneeIds: [uid], startDate: day(-14), dueDate: i.dueDate, createdAt: ts(-30), updatedAt: ts(-2),
            });
        }
        if (p.sprint) {
            const s = p.sprint;
            await db.doc(`${base}/sprints/${s.id}`).set({ projectId: p.id, name: s.name, goal: s.goal, startDate: s.startDate, endDate: s.endDate, status: s.status, createdAt: ts(-6), createdBy: uid, updatedAt: ts(-1), memberIds, autoStart: false });
        }
        for (const m of p.milestones || []) {
            await db.doc(`${base}/milestones/${m.id}`).set({ projectId: p.id, tenantId: TID, title: m.title, description: '', dueDate: m.dueDate, status: m.status, createdAt: ts(-30), createdBy: uid, linkedTaskIds: [], riskRating: m.riskRating });
        }
        for (const [ti, t] of p.tasks.entries()) {
            await db.doc(`${base}/tasks/${t.id}`).set({
                projectId: p.id, tenantId: TID, ownerId: uid, createdBy: uid,
                title: t.title, description: '', isCompleted: !!t.done, status: t.status, priority: t.priority,
                dueDate: t.dueDate || '', startDate: '', assigneeId: t.assignee || '', assigneeIds: t.assignee ? [t.assignee] : [], assignedGroupIds: [], category: [],
                initiativeId: t.initiativeId || null, sprintId: t.sprint ? p.sprint.id : null,
                dependencies: t.dependencies || [], nextStep: t.nextStep || '', blockerNote: t.blockerNote || '',
                createdAt: ts(-20 + ti), updatedAt: ts(-1, -ti), updatedBy: t.assignee || uid,
                ...(t.done ? { completedAt: ts(-3).toDate().toISOString(), completedBy: t.assignee || uid } : {}),
                ...SYSTEM_STAMP(),
            });
            for (const [si, title] of (t.subtasks || []).entries()) {
                await db.doc(`${base}/tasks/${t.id}/subtasks/st-${t.id}-${si}`).set({ taskId: t.id, projectId: p.id, ownerId: uid, title, isCompleted: si < (t.subtasksDone || 0), createdAt: ts(-5 + si), updatedBy: uid, ...SYSTEM_STAMP() });
            }
        }
        const activities = p.tasks.slice(0, 3).map((t, ai) => ({ user: nameOf(t.assignee || uid) || DISPLAY_NAME, action: ai % 2 ? 'updated status of' : 'created task', target: t.title, relatedId: t.id, type: 'task', createdAt: ts(0, -(ai + 1) * 4) }));
        for (const [ai, activity] of activities.entries()) {
            await db.doc(`${base}/activities/a-${p.id}-${ai}`).set({ projectId: p.id, tenantId: TID, ownerId: uid, userAvatar: '', details: '', ...activity });
        }
    }

    for (const c of comments(uid, DISPLAY_NAME)) {
        await db.doc(`tenants/${TID}/projects/${c.projectId}/comments/${c.id}`).set({
            projectId: c.projectId, targetId: c.targetId, targetType: 'task', userId: c.userId, userDisplayName: c.name, userPhotoURL: '',
            content: c.content, ...(c.mentions ? { mentionedUserIds: c.mentions } : {}), updatedBy: c.userId, createdAt: c.created, ...SYSTEM_STAMP(),
        });
    }

    // A few notifications (what the triggers would have produced).
    const actor = (id) => ({ actorId: id, actorName: nameOf(id), actorPhotoURL: '' });
    const notifications = [
        { id: 'n-mention', type: 'comment_mention', title: 'New Mention', message: 'You were mentioned in a comment on task "Finalize homepage hero copy"', projectId: 'p-website', taskId: 't-hero', commentId: 'c-hero-1', ...actor('review-mia'), read: false, createdAt: ts(-1, -3), params: { taskTitle: 'Finalize homepage hero copy', projectTitle: 'Website Relaunch' } },
        { id: 'n-assign', type: 'task_assigned', title: 'New Task Assignment', message: 'You\'ve been assigned to "App Store screenshots"', projectId: 'p-app', taskId: 't-screens', ...actor('review-sofia'), read: false, createdAt: ts(-1, -6), params: { taskTitle: 'App Store screenshots', projectTitle: 'Mobile App Launch' } },
        { id: 'n-done', type: 'task_completed', title: 'Task Completed', message: 'Sofia Reyes completed "App icon variants"', projectId: 'p-app', taskId: 't-icons', ...actor('review-sofia'), read: true, createdAt: ts(-3), params: { taskTitle: 'App icon variants', projectTitle: 'Mobile App Launch' } },
    ];
    for (const { id, ...data } of notifications) {
        await db.doc(`tenants/${TID}/notifications/${id}`).set({ userId: uid, tenantId: TID, ...data });
    }

    // Personal tasks for "Today".
    const personal = `tenants/${TID}/users/${uid}/personalTasks`;
    const personalTasks = [
        { id: 'pt-1', title: 'Prepare notes for the weekly sync', priority: 'Medium', dueDate: day(0), createdAt: ts(-2) },
        { id: 'pt-2', title: 'Review the beta feedback inbox', priority: 'High', scheduledDate: day(0), createdAt: ts(-1) },
        { id: 'pt-3', title: 'Book flights for the team offsite', priority: 'Low', dueDate: day(3), createdAt: ts(-4) },
    ];
    for (const { id, ...task } of personalTasks) {
        await db.doc(`${personal}/${id}`).set({ ownerId: uid, tenantId: TID, isCompleted: false, status: 'Open', ...task });
    }
    return projects.length;
};

const main = async () => {
    console.log(`Target: ${usingEmulators ? `emulators (${PROJECT_ID})` : `PRODUCTION (${PROJECT_ID})`}`);
    const { uid, rotated } = await ensureAuthUser();
    await writeProfile(uid);
    const accepted = await acceptLegalDocuments(uid);
    const projectCount = await rebuildWorkspace(uid);
    console.log(`Review account ${EMAIL} (uid ${uid}) ready: workspace "${WORKSPACE_NAME}" (${TID}) with ${projectCount} projects.`);
    console.log(`Accepted legal versions: ${JSON.stringify(accepted)}`);
    console.log(rotated
        ? `New password written to ${SECRET_FILE} (not printed).`
        : `Password unchanged (stored in ${SECRET_FILE}); pass --rotate-password to replace it.`);
};

main().then(() => process.exit(0)).catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
});
