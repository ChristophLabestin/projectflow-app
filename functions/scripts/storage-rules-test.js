const fs = require('node:fs');
const path = require('node:path');
const {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'demo-projectflow';
const ROOT = path.resolve(__dirname, '../..');

const parseHostPort = (value, fallback) => {
    const [host, port] = (value || fallback).split(':');
    return { host, port: Number(port) };
};

const main = async () => {
    const testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8'),
            ...parseHostPort(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080')
        },
        storage: {
            rules: fs.readFileSync(path.join(ROOT, 'storage.rules'), 'utf8'),
            ...parseHostPort(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199')
        }
    });

    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc('tenants/tenantA/members/ownerA').set({ uid: 'ownerA', role: 'Owner' });
        await db.doc('tenants/tenantA/members/memberA').set({ uid: 'memberA', role: 'Member' });
        await db.doc('tenants/tenantA/members/guestA').set({ uid: 'guestA', role: 'Guest' });
    });

    const png = new Uint8Array([137, 80, 78, 71]);
    const results = [];
    const check = async (name, fn) => {
        try {
            await fn();
            results.push([name, true]);
            console.log(`ok   - ${name}`);
        } catch (error) {
            results.push([name, false]);
            console.error(`FAIL - ${name}: ${error.message}`);
        }
    };

    const st = (uid) => testEnv.authenticatedContext(uid).storage();
    const anon = () => testEnv.unauthenticatedContext().storage();
    const file = (s, p) => s.ref(p);
    const upload = (s, p, data, contentType) => file(s, p).put(data, { contentType });

    // Seed objects via admin context.
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.storage().ref('tenants/tenantA/projects/p1/seed.png').put(png, { contentType: 'image/png' });
    });

    const seedPath = 'tenants/tenantA/projects/p1/seed.png';

    await check('anonymous cannot read tenant file', () => assertFails(file(anon(), seedPath).getMetadata()));
    await check('outsider cannot read tenant file', () => assertFails(file(st('outsider'), seedPath).getMetadata()));
    await check('outsider cannot write tenant file', () =>
        assertFails(upload(st('outsider'), 'tenants/tenantA/projects/p1/o.png', png, 'image/png')));
    await check('guest cannot read tenant file', () => assertFails(file(st('guestA'), seedPath).getMetadata()));
    await check('guest cannot write tenant file', () =>
        assertFails(upload(st('guestA'), 'tenants/tenantA/projects/p1/g.png', png, 'image/png')));
    await check('member can read tenant file', () => assertSucceeds(file(st('memberA'), seedPath).getMetadata()));
    await check('member can upload png', () =>
        assertSucceeds(upload(st('memberA'), 'tenants/tenantA/projects/p1/m.png', png, 'image/png')));
    await check('member can upload pdf', () =>
        assertSucceeds(upload(st('memberA'), 'tenants/tenantA/projects/p1/m.pdf', png, 'application/pdf')));
    await check('owner can read tenant file', () => assertSucceeds(file(st('ownerA'), seedPath).getMetadata()));
    await check('owner can upload png', () =>
        assertSucceeds(upload(st('ownerA'), 'tenants/tenantA/projects/p1/ow.png', png, 'image/png')));
    await check('member cannot access other tenant', () =>
        assertFails(file(st('memberA'), 'tenants/tenantB/projects/p1/x.png').getMetadata()));
    await check('html upload rejected', () =>
        assertFails(upload(st('memberA'), 'tenants/tenantA/projects/p1/x.html', new Uint8Array([60, 104]), 'text/html')));
    await check('svg upload rejected', () =>
        assertFails(upload(st('memberA'), 'tenants/tenantA/projects/p1/x.svg', new Uint8Array([60, 115]), 'image/svg+xml')));
    await check('javascript upload rejected', () =>
        assertFails(upload(st('memberA'), 'tenants/tenantA/projects/p1/x.js', new Uint8Array([1]), 'application/javascript')));
    await check('oversize upload rejected', () =>
        assertFails(upload(st('memberA'), 'tenants/tenantA/projects/p1/big.png', new Uint8Array(26 * 1024 * 1024), 'image/png')));
    await check('member can delete', () => assertSucceeds(file(st('memberA'), 'tenants/tenantA/projects/p1/m.png').delete()));
    await check('guest cannot delete', () => assertFails(file(st('guestA'), seedPath).delete()));
    await check('outsider cannot delete', () => assertFails(file(st('outsider'), seedPath).delete()));

    await check('user can upload own avatar', () =>
        assertSucceeds(upload(st('u1'), 'users/u1/avatar.png', png, 'image/png')));
    await check('user can read own avatar', () => assertSucceeds(file(st('u1'), 'users/u1/avatar.png').getMetadata()));
    await check('other user cannot read avatar', () => assertFails(file(st('u2'), 'users/u1/avatar.png').getMetadata()));
    await check('avatar non-image rejected', () =>
        assertFails(upload(st('u1'), 'users/u1/a.pdf', png, 'application/pdf')));
    await check('avatar oversize rejected', () =>
        assertFails(upload(st('u1'), 'users/u1/big.png', new Uint8Array(6 * 1024 * 1024), 'image/png')));

    await testEnv.cleanup();
    const failed = results.filter(([, ok]) => !ok);
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    if (failed.length) process.exit(1);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
