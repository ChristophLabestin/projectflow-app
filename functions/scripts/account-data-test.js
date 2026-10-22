/* Emulator test for GDPR export/erasure core logic (functions/src/account-data.ts).
 * Run: npm run build && npm run test:account-data  (Firestore emulator on port 8801) */
const assert = require('assert');
process.env.GCLOUD_PROJECT = 'demo-projectflow';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8801';
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-projectflow' });
const db = admin.firestore();
const { buildUserExport, planAccountDeletion, eraseUserData } = require('../lib/account-data');

const U = 'user-a', OWNER = 'owner-b', OTHER = 'other-c';

(async () => {
    // Shared tenant owned by OWNER, U is a plain member
    await db.doc('tenants/shared').set({ name: 'Shared', ownerId: OWNER });
    await db.doc(`tenants/shared/members/${OWNER}`).set({ uid: OWNER, role: 'Owner' });
    await db.doc(`tenants/shared/members/${U}`).set({ uid: U, role: 'Member' });
    await db.doc(`tenants/shared/users/${U}/tasks/pt1`).set({ title: 'Personal' });
    await db.doc('tenants/shared/projects/p1').set({ title: 'P1', ownerId: U, memberIds: [U, OWNER], members: [{ userId: U }, { userId: OWNER }], roles: { [U]: 'Admin', [OWNER]: 'Owner' } });
    await db.doc('tenants/shared/projects/p1/tasks/t1').set({ title: 'T1', ownerId: U, createdBy: U, assigneeIds: [U, OWNER] });
    await db.doc('tenants/shared/projects/p1/tasks/t2').set({ title: 'T2', ownerId: OWNER, assigneeId: U });
    await db.doc('tenants/shared/projects/p1/comments/c1').set({ userId: U, userDisplayName: 'Alice', userPhotoURL: 'x', content: 'hi' });
    await db.doc('tenants/shared/projects/p1/activities/a1').set({ ownerId: U, user: 'Alice', userAvatar: 'x', action: 'did' });
    await db.doc('tenants/shared/api_tokens/tok').set({ createdBy: U, tokenHash: 'h' });
    await db.doc('tenants/shared/notifications/n1').set({ userId: U, title: 'n' });
    // Sole tenant owned by U
    await db.doc('tenants/solo').set({ name: 'Solo', ownerId: U });
    await db.doc(`tenants/solo/members/${U}`).set({ uid: U, role: 'Owner' });
    await db.doc('tenants/solo/projects/ps').set({ title: 'S' });
    // User docs
    await db.doc(`users/${U}`).set({ uid: U, displayName: 'Alice', email: 'a@x.de' });
    await db.doc(`users/${U}/private/data`).set({ phone: '1', accessToken: 'SECRET' });
    await db.doc(`users/${U}/passkeys/pk`).set({ label: 'Laptop', credentialID: Buffer.from('c'), credentialPublicKey: Buffer.from('k'), counter: 1 });

    // --- export ---
    const exp = await buildUserExport(db, U, 'a@x.de');
    const json = JSON.stringify(exp);
    assert(!json.includes('SECRET'), 'token leaked');
    assert(!json.includes('credentialPublicKey'), 'passkey credential leaked');
    assert.strictEqual(exp.passkeys[0].label, 'Laptop');
    assert.strictEqual(exp.workspaces.length, 2);
    const shared = exp.workspaces.find((w) => w.tenantId === 'shared');
    assert.strictEqual(shared.personalData.tasks.length, 1);
    assert.strictEqual(shared.notifications.length, 1);
    assert.strictEqual(shared.projects[0].tasks.length, 2);
    assert.strictEqual(shared.projects[0].comments.length, 1);
    console.log('export ok');

    // --- plan: blocked when owner of a workspace that has other members ---
    await db.doc('tenants/team').set({ name: 'Team', ownerId: U });
    await db.doc(`tenants/team/members/${U}`).set({ uid: U, role: 'Owner' });
    await db.doc(`tenants/team/members/${OTHER}`).set({ uid: OTHER, role: 'Member' });
    let plan = await planAccountDeletion(db, U);
    assert.deepStrictEqual(plan.blockers.map((b) => b.tenantId), ['team']);
    await db.recursiveDelete(db.doc('tenants/team'));

    // --- erase ---
    plan = await planAccountDeletion(db, U);
    assert.deepStrictEqual(plan.blockers, []);
    assert.deepStrictEqual(plan.soleTenants, ['solo']);
    assert.deepStrictEqual(plan.otherTenants, ['shared']);
    await eraseUserData(db, U, plan);
    assert(!(await db.doc('tenants/solo').get()).exists, 'solo tenant remains');
    assert(!(await db.doc('tenants/solo/projects/ps').get()).exists, 'solo project remains');
    assert(!(await db.doc(`users/${U}`).get()).exists, 'user doc remains');
    assert(!(await db.doc(`users/${U}/passkeys/pk`).get()).exists, 'passkey remains');
    assert(!(await db.doc(`tenants/shared/members/${U}`).get()).exists, 'membership remains');
    assert(!(await db.doc(`tenants/shared/users/${U}/tasks/pt1`).get()).exists, 'personal task remains');
    assert(!(await db.doc('tenants/shared/api_tokens/tok').get()).exists, 'api token remains');
    assert(!(await db.doc('tenants/shared/notifications/n1').get()).exists, 'notification remains');
    const p1 = (await db.doc('tenants/shared/projects/p1').get()).data();
    assert.deepStrictEqual(p1.memberIds, [OWNER]);
    assert.deepStrictEqual(p1.members, [{ userId: OWNER }]);
    assert.strictEqual(p1.ownerId, OWNER);
    assert(!(U in p1.roles));
    assert.strictEqual((await db.doc('tenants/shared/projects/p1/comments/c1').get()).data().userDisplayName, 'Deleted user');
    assert.strictEqual((await db.doc('tenants/shared/projects/p1/activities/a1').get()).data().user, 'Deleted user');
    assert.deepStrictEqual((await db.doc('tenants/shared/projects/p1/tasks/t1').get()).data().assigneeIds, [OWNER]);
    assert.strictEqual((await db.doc('tenants/shared/projects/p1/tasks/t2').get()).data().assigneeId, undefined);
    assert((await db.doc('tenants/shared/projects/p1/tasks/t1').get()).exists, 'task must be kept');
    console.log('erase ok');
})().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
