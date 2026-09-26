/**
 * Migration Script: Move users from tenant subcollection to top-level
 * 
 * Run from the functions directory:
 *   cd functions && npx ts-node src/migrateUsers.ts
 */

import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

interface OldUserDoc {
    uid: string;
    email?: string;
    displayName?: string;
    photoURL?: string;
    role?: string;
    joinedAt?: Timestamp;
    updatedAt?: Timestamp;
    aiUsage?: {
        tokensUsed: number;
        tokenLimit: number;
        imagesUsed: number;
        imageLimit: number;
        lastReset: Timestamp;
    };
    title?: string;
    bio?: string;
    address?: string;
    skills?: string[];
    coverURL?: string;
    privacySettings?: any;
    geminiConfig?: any;
    pinnedProjectId?: string;
    groupIds?: string[];
    preferences?: any;
}

async function migrateUsers() {
    console.log('🚀 Starting user migration...\n');

    const tenantsSnapshot = await db.collection('tenants').get();
    console.log(`Found ${tenantsSnapshot.size} tenants to process\n`);

    let totalUsers = 0;
    let migratedUsers = 0;
    let skippedUsers = 0;
    const errors: string[] = [];

    for (const tenantDoc of tenantsSnapshot.docs) {
        const tenantId = tenantDoc.id;
        console.log(`\n📁 Processing tenant: ${tenantId}`);

        const usersSnapshot = await db.collection(`tenants/${tenantId}/users`).get();
        console.log(`   Found ${usersSnapshot.size} users`);

        for (const userDoc of usersSnapshot.docs) {
            totalUsers++;
            const userId = userDoc.id;
            const userData = userDoc.data() as OldUserDoc;

            try {
                // 1. Create/update top-level user profile
                const globalUserRef = db.collection('users').doc(userId);
                const existingGlobalUser = await globalUserRef.get();

                const profileData: any = {
                    uid: userId,
                    email: userData.email || '',
                    displayName: userData.displayName || 'User',
                    photoURL: userData.photoURL || '',
                    updatedAt: FieldValue.serverTimestamp(),
                };

                if (userData.title) profileData.title = userData.title;
                if (userData.bio) profileData.bio = userData.bio;
                if (userData.address) profileData.address = userData.address;
                if (userData.skills) profileData.skills = userData.skills;
                if (userData.coverURL) profileData.coverURL = userData.coverURL;
                if (userData.privacySettings) profileData.privacySettings = userData.privacySettings;
                if (userData.geminiConfig) profileData.geminiConfig = userData.geminiConfig;
                if (userData.preferences) profileData.preferences = userData.preferences;

                if (userData.aiUsage && (!existingGlobalUser.exists || !existingGlobalUser.data()?.aiUsage)) {
                    profileData.aiUsage = userData.aiUsage;
                }

                if (!existingGlobalUser.exists) {
                    profileData.createdAt = userData.joinedAt || FieldValue.serverTimestamp();
                }

                await globalUserRef.set(profileData, { merge: true });

                // 2. Create membership record
                const memberRef = db.collection(`tenants/${tenantId}/members`).doc(userId);
                const memberData: any = {
                    uid: userId,
                    role: userData.role || 'Member',
                    joinedAt: userData.joinedAt || FieldValue.serverTimestamp(),
                };

                if (userData.pinnedProjectId) memberData.pinnedProjectId = userData.pinnedProjectId;
                if (userData.groupIds) memberData.groupIds = userData.groupIds;

                await memberRef.set(memberData, { merge: true });

                migratedUsers++;
                console.log(`   ✅ Migrated: ${userId} (${userData.displayName || 'Unknown'})`);

            } catch (error: any) {
                skippedUsers++;
                errors.push(`${userId}: ${error.message}`);
                console.log(`   ❌ Failed: ${userId}`);
            }
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Total: ${totalUsers} | Migrated: ${migratedUsers} | Errors: ${skippedUsers}`);

    if (errors.length > 0) {
        console.log('\nErrors:', errors.join('\n  '));
    }

    console.log('\n✨ Done! Verify in Firebase Console, then delete old data.');
}

migrateUsers()
    .catch(console.error)
    .finally(() => process.exit());
