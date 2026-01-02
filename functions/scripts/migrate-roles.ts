
import * as admin from 'firebase-admin';
import * as path from 'path';

// --- Initialization ---

// Try to find service account
const serviceAccountPath = path.resolve(__dirname, '../service-account.json');
try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Initialized with service account');
} catch (e) {
    console.log('Service account not found or invalid, trying default credentials...');
    admin.initializeApp();
}

const db = admin.firestore();

// --- Types (Inline to avoid import issues) ---
type ProjectRole = 'Owner' | 'Editor' | 'Viewer';
type WorkspaceRole = 'Owner' | 'Admin' | 'Member' | 'Guest';

// --- Migration Logic ---

async function migrateProjects() {
    console.log('Migrating Projects...');
    const snapshot = await db.collection('projects').get();
    let batch = db.batch();
    let count = 0;
    let totalUpdated = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        // Skip if roles already exist and look populated (unless we want to force update)
        // For safety, let's only update if missing or if we want to ensure sync.
        // Let's assume we want to populate it based on members.

        const roles: Record<string, ProjectRole> = data.roles || {};
        let needsUpdate = false;

        // 1. Ensure Owner
        if (data.ownerId && !roles[data.ownerId]) {
            roles[data.ownerId] = 'Owner';
            needsUpdate = true;
        }

        // 2. Map Members
        if (Array.isArray(data.members)) {
            for (const member of data.members) {
                let uid: string | undefined;
                let role: ProjectRole = 'Editor';

                if (typeof member === 'string') {
                    uid = member;
                } else if (typeof member === 'object' && member.userId) {
                    uid = member.userId;
                    role = member.role || 'Editor';
                }

                if (uid && uid !== data.ownerId) {
                    if (!roles[uid]) {
                        roles[uid] = role;
                        needsUpdate = true;
                    }
                }
            }
        }

        if (needsUpdate || !data.roles) {
            batch.update(doc.ref, { roles });
            count++;
            totalUpdated++;
        }

        if (count >= 400) {
            await batch.commit();
            console.log(`Committed batch of ${count} projects`);
            batch = db.batch();
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${count} projects`);
    }
    console.log(`Total projects updated: ${totalUpdated}`);
}

async function migrateTenants() {
    console.log('Migrating Tenants...');
    const snapshot = await db.collection('tenants').get();
    let batch = db.batch();
    let count = 0;
    let totalUpdated = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const roles: Record<string, WorkspaceRole> = data.roles || {};
        let needsUpdate = false;

        if (Array.isArray(data.members)) {
            for (const member of data.members) {
                // Member object: { uid, role, ... }
                if (member.uid) {
                    let role: WorkspaceRole = 'Member';
                    // Handle legacy roles map from types.ts logic
                    if (member.role === 'Editor') role = 'Member';
                    else if (member.role === 'Viewer') role = 'Guest';
                    else role = member.role as WorkspaceRole;

                    if (!roles[member.uid]) {
                        roles[member.uid] = role;
                        needsUpdate = true;
                    }
                }
            }
        }

        if (needsUpdate || !data.roles) {
            batch.update(doc.ref, { roles });
            count++;
            totalUpdated++;
        }

        if (count >= 400) {
            await batch.commit();
            console.log(`Committed batch of ${count} tenants`);
            batch = db.batch();
            count = 0;
        }
    }

    if (count > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${count} tenants`);
    }
    console.log(`Total tenants updated: ${totalUpdated}`);
}

async function run() {
    try {
        await migrateProjects();
        await migrateTenants();
        console.log('Migration Complete');
        process.exit(0);
    } catch (error) {
        console.error('Migration Failed:', error);
        process.exit(1);
    }
}

run();
