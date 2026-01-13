/**
 * Debug utility to find where a user ID appears in the database
 * Run this in the browser console or import and call it
 */
import { db } from '../services/firebase';
import { collection, collectionGroup, getDocs, query, where } from 'firebase/firestore';

export const debugFindUser = async (userId: string) => {
    console.log(`\n========== SEARCHING FOR USER: ${userId} ==========\n`);

    const results: any = {
        tenants: [],
        tenantUsers: [],
        projectMembers: [],
        projectMemberIds: [],
        taskAssignees: [],
        issueAssignees: [],
    };

    try {
        // 1. Check if user has their own tenant
        console.log('1. Checking tenants collection...');
        const tenantsSnap = await getDocs(collection(db, 'tenants'));
        for (const doc of tenantsSnap.docs) {
            if (doc.id === userId) {
                results.tenants.push({ id: doc.id, data: doc.data() });
                console.log(`   ✓ Found tenant with ID matching user: ${doc.id}`);
            }
        }

        // 2. Search tenantUsers subcollection across all tenants
        console.log('2. Checking tenantUsers across all tenants...');
        for (const tenantDoc of tenantsSnap.docs) {
            const usersSnap = await getDocs(collection(db, 'tenants', tenantDoc.id, 'users'));
            for (const userDoc of usersSnap.docs) {
                if (userDoc.id === userId) {
                    results.tenantUsers.push({
                        tenantId: tenantDoc.id,
                        userId: userDoc.id,
                        data: userDoc.data()
                    });
                    console.log(`   ✓ Found user in tenant ${tenantDoc.id}`);
                }
            }
        }

        // 3. Check project.members array
        console.log('3. Checking project members...');
        const projectsSnap = await getDocs(collectionGroup(db, 'projects'));
        for (const projectDoc of projectsSnap.docs) {
            const data = projectDoc.data();
            const members = data.members || [];

            // Check legacy string array format
            if (members.includes(userId)) {
                results.projectMembers.push({
                    projectId: projectDoc.id,
                    projectTitle: data.title,
                    path: projectDoc.ref.path
                });
                console.log(`   ✓ User is member of project: ${data.title} (${projectDoc.id})`);
            }

            // Check new ProjectMember[] format
            if (members.some((m: any) => m.userId === userId)) {
                results.projectMembers.push({
                    projectId: projectDoc.id,
                    projectTitle: data.title,
                    path: projectDoc.ref.path,
                    memberData: members.find((m: any) => m.userId === userId)
                });
                console.log(`   ✓ User is member of project (new format): ${data.title} (${projectDoc.id})`);
            }

            // Check memberIds array
            const memberIds = data.memberIds || [];
            if (memberIds.includes(userId)) {
                results.projectMemberIds.push({
                    projectId: projectDoc.id,
                    projectTitle: data.title,
                    path: projectDoc.ref.path
                });
                console.log(`   ✓ User in memberIds of project: ${data.title} (${projectDoc.id})`);
            }
        }

        // 4. Check task assignees
        console.log('4. Checking task assignees...');
        const tasksSnap = await getDocs(collectionGroup(db, 'tasks'));
        for (const taskDoc of tasksSnap.docs) {
            const data = taskDoc.data();

            if (data.assigneeId === userId) {
                results.taskAssignees.push({
                    taskId: taskDoc.id,
                    taskTitle: data.title,
                    path: taskDoc.ref.path,
                    field: 'assigneeId'
                });
                console.log(`   ✓ User assigned to task (assigneeId): ${data.title}`);
            }

            if (data.assigneeIds?.includes(userId)) {
                results.taskAssignees.push({
                    taskId: taskDoc.id,
                    taskTitle: data.title,
                    path: taskDoc.ref.path,
                    field: 'assigneeIds'
                });
                console.log(`   ✓ User assigned to task (assigneeIds): ${data.title}`);
            }
        }

        // 5. Check issue assignees
        console.log('5. Checking issue assignees...');
        const issuesSnap = await getDocs(collectionGroup(db, 'issues'));
        for (const issueDoc of issuesSnap.docs) {
            const data = issueDoc.data();

            if (data.assigneeId === userId) {
                results.issueAssignees.push({
                    issueId: issueDoc.id,
                    issueTitle: data.title,
                    path: issueDoc.ref.path
                });
                console.log(`   ✓ User assigned to issue: ${data.title}`);
            }
        }

    } catch (error) {
        console.error('Error during search:', error);
    }

    console.log('\n========== SEARCH COMPLETE ==========');
    console.log('Summary:');
    console.log(`  - Tenants: ${results.tenants.length}`);
    console.log(`  - TenantUsers: ${results.tenantUsers.length}`);
    console.log(`  - Project Members: ${results.projectMembers.length}`);
    console.log(`  - Project MemberIds: ${results.projectMemberIds.length}`);
    console.log(`  - Task Assignees: ${results.taskAssignees.length}`);
    console.log(`  - Issue Assignees: ${results.issueAssignees.length}`);
    console.log('\nFull results:', results);

    return results;
};

// Export to window for easy console access
if (typeof window !== 'undefined') {
    (window as any).debugFindUser = debugFindUser;
}
