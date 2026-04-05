const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'demo-projectflow';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

const seedData = async (testEnv) => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        await db.doc('tenants/tenantA').set({
            tenantId: 'tenantA',
            name: 'Tenant A'
        });
        await db.doc('tenants/tenantA/members/tenantA').set({
            uid: 'tenantA',
            role: 'Owner'
        });
        await db.doc('tenants/tenantA/members/memberA').set({
            uid: 'memberA',
            role: 'Member'
        });
        await db.doc('tenants/tenantA/secrets/smtp').set({
            username: 'smtp-user'
        });
        await db.doc('tenants/tenantA/api_tokens/tokenA').set({
            name: 'Token A'
        });
        await db.doc('tenants/tenantA/projects/projectA').set({
            title: 'Project A',
            tenantId: 'tenantA',
            ownerId: 'tenantA',
            memberIds: ['tenantA', 'externalA']
        });
        await db.doc('tenants/tenantA/projects/projectA/tasks/taskA').set({
            title: 'Task A',
            tenantId: 'tenantA',
            projectId: 'projectA'
        });
        await db.doc('tenants/tenantA/projects/projectA/initiatives/initiativeA').set({
            title: 'Initiative A',
            tenantId: 'tenantA',
            projectId: 'projectA'
        });
        await db.doc('tenants/tenantA/users/memberA/personalTasks/personalA').set({
            title: 'Personal Task A'
        });

        await db.doc('tenants/tenantB').set({
            tenantId: 'tenantB',
            name: 'Tenant B'
        });
        await db.doc('tenants/tenantB/members/tenantB').set({
            uid: 'tenantB',
            role: 'Owner'
        });

        await db.doc('tenants/tenantJoin').set({
            tenantId: 'tenantJoin',
            name: 'Tenant Join'
        });
        await db.doc('tenants/tenantJoin/members/tenantJoin').set({
            uid: 'tenantJoin',
            role: 'Owner'
        });
    });
};

const run = async () => {
    const testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: fs.readFileSync(RULES_PATH, 'utf8')
        }
    });

    try {
        await seedData(testEnv);

        const ownerDb = testEnv.authenticatedContext('tenantA').firestore();
        const memberDb = testEnv.authenticatedContext('memberA').firestore();
        const externalProjectDb = testEnv.authenticatedContext('externalA').firestore();
        const outsiderDb = testEnv.authenticatedContext('outsiderA').firestore();
        const joinerDb = testEnv.authenticatedContext('joinerA').firestore();

        await assertSucceeds(ownerDb.doc('tenants/tenantA').get());
        await assertSucceeds(memberDb.doc('tenants/tenantA').get());
        await assertFails(outsiderDb.doc('tenants/tenantA').get());

        await assertSucceeds(externalProjectDb.doc('tenants/tenantA/projects/projectA').get());
        await assertSucceeds(externalProjectDb.doc('tenants/tenantA/projects/projectA/tasks/taskA').get());
        await assertSucceeds(externalProjectDb.doc('tenants/tenantA/projects/projectA/initiatives/initiativeA').get());
        await assertFails(outsiderDb.doc('tenants/tenantA/projects/projectA/tasks/taskA').get());
        await assertFails(outsiderDb.doc('tenants/tenantA/projects/projectA/initiatives/initiativeA').get());

        await assertFails(ownerDb.doc('tenants/tenantA/secrets/smtp').get());
        await assertFails(ownerDb.doc('tenants/tenantA/secrets/smtp').set({ username: 'updated-user' }, { merge: true }));
        await assertFails(memberDb.doc('tenants/tenantA/secrets/smtp').get());
        await assertFails(memberDb.doc('tenants/tenantA/secrets/smtp').set({ username: 'nope' }, { merge: true }));
        await assertFails(ownerDb.doc('tenants/tenantA/api_tokens/tokenA').get());
        await assertFails(memberDb.doc('tenants/tenantA/api_tokens/tokenA').get());

        await assertSucceeds(memberDb.doc('tenants/tenantA/users/memberA/personalTasks/personalA').get());
        await assertFails(ownerDb.doc('tenants/tenantA/users/memberA/personalTasks/personalA').get());

        await assertSucceeds(joinerDb.doc('tenants/tenantJoin/members/joinerA').set({
            uid: 'joinerA',
            role: 'Member'
        }));
        await assertFails(joinerDb.doc('tenants/tenantJoin/members/joinerA').set({
            uid: 'joinerA',
            role: 'Owner'
        }));

        console.log('Firestore rules tests passed.');
    } finally {
        await testEnv.cleanup();
    }
};

run().catch((error) => {
    console.error('Firestore rules tests failed.');
    console.error(error);
    process.exitCode = 1;
});
