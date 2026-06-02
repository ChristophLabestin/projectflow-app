import {
    addDoc,
    collectionGroup,
    deleteDoc,
    deleteField,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { createGithubIssue, updateGithubIssue } from '../githubService';
import {
    ensureTenantAndUser,
    findIssueDoc,
    getProjectContextFromRef,
    logActivity,
    projectSubCollection,
    resolveTenantId,
    syncProjectProgress
} from '../internal/workspaceDataCore';
import { toMillis } from '../../utils/time';
import type { Issue, Task } from '../../types';
import { assertPmCoreAllowsLegacyWrites } from '../../config/pmCore';
import { getProjectById } from './projectsService';
import { getUserProfile } from './usersService';

const ISSUES = 'issues';
const TASKS = 'tasks';

const mapIssue = (docSnap: any): Issue => {
    const data = docSnap.data();
    const pathParts = docSnap.ref.path.split('/');
    const derivedTenantId = pathParts.length >= 2 && pathParts[0] === 'tenants' ? pathParts[1] : undefined;
    const derivedProjectId = pathParts.length >= 4 && pathParts[2] === 'projects' ? pathParts[3] : undefined;

    return {
        id: docSnap.id,
        ...data,
        tenantId: data.tenantId || derivedTenantId,
        projectId: data.projectId || derivedProjectId,
        path: docSnap.ref.path
    } as unknown as Issue;
};

export const getUserIssues = async (): Promise<Issue[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const [singleAssigneeSnapshot, multiAssigneeSnapshot] = await Promise.all([
        getDocs(query(collectionGroup(db, ISSUES), where('assigneeId', '==', user.uid))),
        getDocs(query(collectionGroup(db, ISSUES), where('assigneeIds', 'array-contains', user.uid)))
    ]);

    const issues = singleAssigneeSnapshot.docs.map(mapIssue);
    for (const issue of multiAssigneeSnapshot.docs.map(mapIssue)) {
        if (!issues.find((existing) => existing.id === issue.id)) {
            issues.push(issue);
        }
    }

    return issues.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const createIssue = async (projectId: string, issue: Partial<Issue>, tenantId?: string) => {
    assertPmCoreAllowsLegacyWrites('issues');
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const issueData: Record<string, unknown> = {
        projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        title: issue.title || 'Untitled Issue',
        description: issue.description || '',
        status: issue.status || 'Open',
        priority: issue.priority || 'Medium',
        reporter: user.displayName || 'User',
        assignee: issue.assignee || '',
        assigneeId: issue.assigneeId || null,
        assigneeIds: issue.assigneeIds || (issue.assigneeId ? [issue.assigneeId] : []),
        assignedGroupIds: issue.assignedGroupIds || [],
        reporterId: user.uid,
        createdBy: user.uid,
        createdAt: serverTimestamp()
    };

    try {
        const project = await getProjectById(projectId, resolvedTenant);
        if (project?.githubIssueSync && project.githubRepo) {
            let githubToken = project.githubToken;
            if (!githubToken) {
                const profile = await getUserProfile(user.uid, resolvedTenant);
                githubToken = profile?.githubToken;
            }

            if (githubToken) {
                const ghIssue = await createGithubIssue(
                    project.githubRepo,
                    githubToken,
                    String(issueData.title),
                    String(issueData.description || 'Created via ProjectFlow')
                );
                issueData.githubIssueUrl = ghIssue.url;
                issueData.githubIssueNumber = ghIssue.number;
            }
        }
    } catch (error) {
        console.warn('GitHub issue sync failed', error);
    }

    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, ISSUES), issueData);
    await logActivity(projectId, { action: `Reported issue "${issue.title}"`, target: 'Issues', type: 'report' }, resolvedTenant);
    return docRef.id;
};

export const getIssueById = async (issueId: string, projectId?: string, tenantId?: string): Promise<Issue | null> => {
    const issueSnap = await findIssueDoc(issueId, projectId, tenantId);
    if (!issueSnap?.exists()) {
        return null;
    }

    const { tenantId: extractedTenantId, projectId: extractedProjectId } = getProjectContextFromRef(issueSnap.ref);
    return {
        id: issueSnap.id,
        tenantId: extractedTenantId,
        projectId: extractedProjectId,
        ...issueSnap.data()
    } as Issue;
};

export const subscribeProjectIssues = (
    projectId: string,
    callback: (issues: Issue[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    return onSnapshot(projectSubCollection(resolvedTenant, projectId, ISSUES), (snapshot) => {
        const issues = snapshot.docs
            .map(mapIssue)
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        callback(issues);
    });
};

export const updateIssue = async (issueId: string, updates: Partial<Issue>, projectId: string, tenantId?: string, path?: string) => {
    assertPmCoreAllowsLegacyWrites('issues');
    const resolvedTenant = resolveTenantId(tenantId);
    let issueData: Issue | null = null;
    let issueRef: any = null;

    const nextUpdates: Record<string, unknown> = { ...updates };

    if (nextUpdates.status) {
        const user = auth.currentUser;
        if (nextUpdates.status === 'Resolved' || nextUpdates.status === 'Closed') {
            nextUpdates.completedBy = user?.uid;
            nextUpdates.completedAt = serverTimestamp();
        } else if (nextUpdates.status === 'Open' || nextUpdates.status === 'In Progress') {
            nextUpdates.completedBy = deleteField();
            nextUpdates.completedAt = deleteField();
        }
    }

    if (path) {
        issueRef = doc(db, path);
        const snap = await getDoc(issueRef);
        if (snap.exists()) {
            issueData = { id: snap.id, ...snap.data() } as Issue;
        }
        await updateDoc(issueRef, nextUpdates);
    } else {
        const issueSnap = await findIssueDoc(issueId, projectId, tenantId);
        if (!issueSnap) throw new Error('Issue not found or access denied');
        issueData = { id: issueSnap.id, ...issueSnap.data() } as Issue;
        issueRef = issueSnap.ref;
        await updateDoc(issueRef, nextUpdates);
    }

    if (issueData) {
        let action = `Updated issue "${issueData.title}"`;
        if (nextUpdates.status === 'Resolved' || nextUpdates.status === 'Closed') {
            action = `Resolved issue "${issueData.title}"`;
        } else if (
            (nextUpdates.status === 'Open' || nextUpdates.status === 'In Progress') &&
            (issueData.status === 'Resolved' || issueData.status === 'Closed')
        ) {
            action = `Reopened issue "${issueData.title}"`;
        }

        await logActivity(projectId, { action, target: 'Issues', type: 'issue' }, resolvedTenant);
    }

    if (issueData?.githubIssueNumber && (nextUpdates.status || nextUpdates.title || nextUpdates.description)) {
        try {
            const project = await getProjectById(projectId, resolvedTenant);
            if (project?.githubIssueSync && project.githubRepo) {
                const user = auth.currentUser;
                let githubToken = project.githubToken;
                if (!githubToken && user?.uid) {
                    const profile = await getUserProfile(user.uid, resolvedTenant);
                    githubToken = profile?.githubToken;
                }

                if (githubToken) {
                    const githubUpdates: Record<string, unknown> = {};
                    if (nextUpdates.status) {
                        githubUpdates.state = (nextUpdates.status === 'Resolved' || nextUpdates.status === 'Closed') ? 'closed' : 'open';
                    }
                    if (nextUpdates.title) {
                        githubUpdates.title = nextUpdates.title;
                    }
                    if (nextUpdates.description) {
                        githubUpdates.body = nextUpdates.description;
                    }

                    if (Object.keys(githubUpdates).length > 0) {
                        await updateGithubIssue(project.githubRepo, githubToken, issueData.githubIssueNumber, githubUpdates);
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to sync changes to GitHub', error);
        }
    }

    if (issueData?.linkedTaskId && nextUpdates.status) {
        const isClosing = nextUpdates.status === 'Resolved' || nextUpdates.status === 'Closed';
        const isReopening = nextUpdates.status === 'Open' || nextUpdates.status === 'In Progress';

        if (isClosing || isReopening) {
            try {
                const taskRef = doc(projectSubCollection(resolvedTenant, projectId, TASKS), issueData.linkedTaskId);
                const taskSnap = await getDoc(taskRef);
                if (taskSnap.exists()) {
                    const taskData = taskSnap.data() as Task;
                    const shouldComplete = isClosing && !taskData.isCompleted;
                    const shouldReopen = isReopening && taskData.isCompleted;

                    if (shouldComplete || shouldReopen) {
                        await updateDoc(taskRef, {
                            isCompleted: isClosing,
                            status: isClosing ? 'Done' : 'Open'
                        });
                        await logActivity(
                            projectId,
                            { action: `Auto-${isClosing ? 'completed' : 'reopened'} linked task`, target: 'Tasks', type: 'task' },
                            resolvedTenant
                        );
                        await syncProjectProgress(projectId, resolvedTenant);
                    }
                }
            } catch (error) {
                console.warn('Failed to sync linked task status', error);
            }
        }
    }
};

export const deleteIssue = async (issueId: string, projectId?: string, tenantId?: string, path?: string) => {
    assertPmCoreAllowsLegacyWrites('issues');
    const issueSnap = await findIssueDoc(issueId, projectId, tenantId, path);
    if (!issueSnap) return;

    const issueData = issueSnap.data() as Issue;
    const resolvedTenant = resolveTenantId(tenantId);

    if (issueData?.githubIssueNumber && projectId) {
        try {
            const project = await getProjectById(projectId, resolvedTenant);
            if (project?.githubIssueSync && project.githubRepo) {
                const user = auth.currentUser;
                let githubToken = project.githubToken;
                if (!githubToken && user?.uid) {
                    const profile = await getUserProfile(user.uid, resolvedTenant);
                    githubToken = profile?.githubToken;
                }

                if (githubToken) {
                    await updateGithubIssue(project.githubRepo, githubToken, issueData.githubIssueNumber, { state: 'closed' });
                }
            }
        } catch (error) {
            console.warn('Failed to close GitHub issue on delete', error);
        }
    }

    await deleteDoc(issueSnap.ref);
};
