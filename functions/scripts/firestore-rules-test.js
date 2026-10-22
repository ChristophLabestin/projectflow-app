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
        await set(`${T}/entitlements/plan`, { plan: 'free', seats: 3 });
        await set(PROJECT, {
            title: 'Project A',
            tenantId: 'tenantA',
            ownerId: 'ownerA',
            memberIds: ['ownerA', 'guestA'],
        });
        await set(`${PROJECT}/tasks/taskA`, { title: 'Task A', tenantId: 'tenantA', projectId: 'projectA' });
        await set(MEMBER_PROJECT, {
            title: 'Member project',
            tenantId: 'tenantA',
            ownerId: 'memberA',
            memberIds: ['memberA'],
        });
        await set(`${T}/users/memberA/personalTasks/personalA`, { title: 'Personal Task A' });

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
