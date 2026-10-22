import {
    addDoc,
    collection,
    deleteDoc,
    deleteField,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { isPmCoreOnly } from '../../config/pmCore';
import {
    ensureCategory,
    ensureTenantAndUser,
    findSubtaskDoc,
    findTaskDoc,
    getProjectContextFromRef,
    logActivity,
    projectSubCollection,
    resolveTenantId
} from '../internal/workspaceDataCore';
import { toMillis } from '../../utils/time';
import { isProjectIncludedInImportantSignals } from '../healthService';
import type { Activity, Project, SubTask, Task } from '../../types';
import { getSharedProjects, getUserProjects } from './projectsService';

const TASKS = 'tasks';
const SUBTASKS = 'subtasks';
const ISSUES = 'issues';

/**
 * Every client write to a task / subtask carries who made it (contract C1). The `onTaskWritten` /
 * `onSubtaskWritten` Cloud Functions use it as the actor for activity entries and notifications, and
 * own the side effects (activity, project progress, notifications, isCompleted <-> status).
 */
const writeMeta = () => {
    const user = auth.currentUser;
    return user ? { updatedBy: user.uid, updatedAt: serverTimestamp() } : { updatedAt: serverTimestamp() };
};

const loadProjectTasks = async (projectId: string, tenantId?: string): Promise<Task[]> => {
    if (!tenantId) {
        return [];
    }

    const snapshot = await getDocs(collection(db, 'tenants', tenantId, 'projects', projectId, TASKS));
    return snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data(), path: docSnap.ref.path } as unknown as Task))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

const getUserTasksFromProjects = async (projects: Project[], userId: string): Promise<Task[]> => {
    const uniqueProjects = Array.from(
        new Map(projects.map((project) => [`${project.tenantId || 'none'}:${project.id}`, project])).values()
    ).filter(isProjectIncludedInImportantSignals);

    const results = await Promise.all(uniqueProjects.map(async (project) => {
        try {
            const projectTasks = await loadProjectTasks(project.id, project.tenantId);
            return projectTasks.map((task) => ({ ...task, tenantId: project.tenantId }));
        } catch (error) {
            console.warn(`Failed to fetch tasks for project ${project.id}`, error);
            return [] as Task[];
        }
    }));

    const allTasks = results.flat();
    return allTasks.filter((task) =>
        task.assigneeId === userId ||
        (task.assigneeIds && task.assigneeIds.includes(userId)) ||
        (task.ownerId === userId && !task.assigneeId && (!task.assigneeIds || task.assigneeIds.length === 0))
    );
};

export const getUserTasksForProjects = async (projects: Project[]): Promise<Task[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    return getUserTasksFromProjects(projects, user.uid);
};

export const getUserTasks = async (): Promise<Task[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    try {
        const [myProjects, sharedProjects] = await Promise.all([
            getUserProjects(undefined, { hydrateAssets: false }),
            getSharedProjects({ hydrateAssets: false })
        ]);

        return getUserTasksFromProjects([...myProjects, ...sharedProjects], user.uid);
    } catch (error) {
        console.error('getUserTasks failed', error);
        return [];
    }
};

export const addTask = async (
    projectId: string,
    title: string,
    dueDate?: string,
    assignee?: string,
    priority: Task['priority'] = 'Medium',
    extra?: Partial<Pick<Task, 'description' | 'category' | 'status' | 'assigneeId' | 'assigneeIds' | 'assignedGroupIds' | 'linkedIssueId' | 'convertedIdeaId' | 'initiativeId' | 'legacyInitiativeRoot' | 'startDate' | 'source' | 'templateId' | 'templateTrack' | 'templateSeedId' | 'sourceReferences' | 'externalKey'>>,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const taskData: Record<string, unknown> = {
        projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        title,
        isCompleted: false,
        dueDate: dueDate || '',
        startDate: extra?.startDate || '',
        assignee: assignee || '',
        priority,
        description: extra?.description || '',
        category: extra?.category || [],
        status: extra?.status || 'Open',
        assigneeId: extra?.assigneeId || (user.uid === assignee ? user.uid : null),
        assigneeIds: extra?.assigneeIds || (extra?.assigneeId ? [extra.assigneeId] : []),
        assignedGroupIds: extra?.assignedGroupIds || [],
        legacyInitiativeRoot: extra?.legacyInitiativeRoot === true,
        source: extra?.source || '',
        templateId: extra?.templateId || '',
        templateTrack: extra?.templateTrack || '',
        templateSeedId: extra?.templateSeedId || '',
        sourceReferences: extra?.sourceReferences || [],
        externalKey: extra?.externalKey || '',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        ...writeMeta()
    };

    if (!isPmCoreOnly() && extra?.linkedIssueId) {
        taskData.linkedIssueId = extra.linkedIssueId;
    }

    if (!isPmCoreOnly() && extra?.convertedIdeaId) {
        taskData.convertedIdeaId = extra.convertedIdeaId;
    }

    if (extra?.initiativeId) {
        taskData.initiativeId = extra.initiativeId;
    }

    // Activity entry, project progress and assignee notifications are written by onTaskWritten.
    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, TASKS), taskData);
    await ensureCategory(projectId, extra?.category, resolvedTenant);

    return docRef.id;
};

export const createSubTask = async (
    projectId: string,
    taskId: string,
    title: string,
    assigneeId?: string,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    const taskRef = doc(projectSubCollection(resolvedTenant, projectId, TASKS), taskId);
    const subTasksRef = collection(taskRef, SUBTASKS);

    const subTaskData = {
        taskId,
        projectId,
        ownerId: user.uid,
        title,
        isCompleted: false,
        assigneeId: assigneeId || null,
        createdAt: serverTimestamp(),
        ...writeMeta()
    };

    // Activity entry and the subtask_assigned notification are written by onSubtaskWritten.
    const docRef = await addDoc(subTasksRef, subTaskData);

    return docRef.id;
};

export const getProjectTasks = async (projectId: string, tenantId?: string): Promise<Task[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, TASKS));
    return snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data(), path: docSnap.ref.path } as unknown as Task))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const subscribeProjectTasks = (
    projectId: string,
    callback: (tasks: Task[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    return onSnapshot(projectSubCollection(resolvedTenant, projectId, TASKS), (snapshot) => {
        const tasks = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, tenantId: resolvedTenant, path: docSnap.ref.path, ...docSnap.data() } as Task))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        callback(tasks);
    });
};

export const getTaskById = async (taskId: string, projectId?: string, tenantId?: string): Promise<Task | null> => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap?.exists()) {
        return null;
    }

    const { tenantId: extractedTenantId, projectId: extractedProjectId } = getProjectContextFromRef(taskSnap.ref);
    return {
        id: taskSnap.id,
        tenantId: extractedTenantId,
        projectId: extractedProjectId,
        ...taskSnap.data()
    } as Task;
};

export const subscribeTaskActivity = (
    projectId: string,
    taskId: string,
    callback: (activities: Activity[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const activityQuery = query(
        projectSubCollection(resolvedTenant, projectId, 'activities'),
        where('relatedId', '==', taskId),
        orderBy('createdAt', 'desc'),
        limit(20)
    );

    return onSnapshot(activityQuery, (snapshot) => {
        const activities = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Activity));
        callback(activities);
    });
};

export const updateTask = async (
    taskId: string,
    updates: Partial<Task>,
    projectId?: string,
    tenantId?: string,
    path?: string
) => {
    if (path) {
        const ref = doc(db, path);
        await updateDoc(ref, { ...updates, ...writeMeta() });
        return;
    }

    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) throw new Error('Task not found');
    await updateDoc(taskSnap.ref, { ...updates, ...writeMeta() });
};

export const toggleTaskStatus = async (taskId: string, currentStatus: boolean, projectId?: string, tenantId?: string) => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) throw new Error('Task not found');

    const newStatus = !currentStatus;
    const user = auth.currentUser;
    const updateData: Record<string, unknown> = { isCompleted: newStatus, ...writeMeta() };

    if (newStatus) {
        updateData.completedBy = user?.uid;
        updateData.completedAt = serverTimestamp();
    } else {
        updateData.completedBy = deleteField();
        updateData.completedAt = deleteField();
    }

    // Status <-> isCompleted consistency, the "Completed/Reopened" activity, project progress and the
    // task_completed notification are handled by onTaskWritten.
    await updateDoc(taskSnap.ref, updateData);
    const data = taskSnap.data() as Task;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(taskSnap.ref);

    if (!isPmCoreOnly() && data.linkedIssueId) {
        try {
            const issueRef = doc(projectSubCollection(resolvedTenant || resolveTenantId(), data.projectId, ISSUES), data.linkedIssueId);
            await updateDoc(issueRef, { status: newStatus ? 'Resolved' : 'Open' });
            await logActivity(
                data.projectId,
                { action: `Auto-${newStatus ? 'resolved' : 'reopened'} linked issue`, target: 'Issues', type: 'status' },
                resolvedTenant
            );
        } catch (error) {
            console.warn('Failed to sync linked issue status', error);
        }
    }
};

export const updateTaskFields = async (taskId: string, updates: Partial<Task>, projectId?: string, tenantId?: string) => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) throw new Error('Task not found');

    const sanitized: Record<string, unknown> = {};

    Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
            sanitized[key] = deleteField();
        } else if (value !== undefined) {
            sanitized[key] = value;
        }
    });

    if (sanitized.isCompleted !== undefined) {
        const user = auth.currentUser;
        if (sanitized.isCompleted === true) {
            sanitized.completedBy = user?.uid;
            sanitized.completedAt = serverTimestamp();
        } else {
            sanitized.completedBy = deleteField();
            sanitized.completedAt = deleteField();
        }
    }

    if (Object.keys(sanitized).length === 0) return;

    // Activity entries, project progress, assignment notifications and status <-> isCompleted consistency
    // are handled by onTaskWritten.
    await updateDoc(taskSnap.ref, { ...sanitized, ...writeMeta() });

    const data = taskSnap.data() as Task;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(taskSnap.ref);

    if (sanitized.category) {
        await ensureCategory(data.projectId, sanitized.category as string | string[], resolvedTenant);
    }
};

export const deleteTask = async (taskId: string, projectId?: string, tenantId?: string) => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) return;

    const data = taskSnap.data() as Task;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(taskSnap.ref);
    await deleteDoc(taskSnap.ref);

    await logActivity(
        data.projectId,
        { action: `Deleted task "${data.title}"`, target: 'Tasks', type: 'task', relatedId: taskId },
        resolvedTenant
    );
    // Project progress is re-synced by onTaskWritten (delete event). The deleted-activity stays here:
    // only the deleting client knows who it was.
};

export const addSubTask = async (taskId: string, title: string, projectId?: string, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) throw new Error('Parent task not found');

    const task = taskSnap.data() as Task;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(taskSnap.ref);

    await addDoc(collection(taskSnap.ref, SUBTASKS), {
        taskId,
        projectId: task.projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        title,
        isCompleted: false,
        createdAt: serverTimestamp(),
        ...writeMeta()
    });
    // The "Added subtask" activity is written by onSubtaskWritten.
};

export const getSubTasks = async (taskId: string, projectId?: string, tenantId?: string): Promise<SubTask[]> => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) return [];

    const snapshot = await getDocs(collection(taskSnap.ref, SUBTASKS));
    return snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as SubTask))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const toggleSubTaskStatus = async (
    subTaskId: string,
    currentStatus: boolean,
    taskId?: string,
    projectId?: string,
    tenantId?: string
) => {
    const subSnap = await findSubtaskDoc(subTaskId, taskId, projectId, tenantId);
    if (!subSnap) return;

    const user = auth.currentUser;
    const isNowCompleted = !currentStatus;

    // The Completed/Reopened subtask activity is written by onSubtaskWritten.
    await updateDoc(subSnap.ref, {
        isCompleted: isNowCompleted,
        completedBy: isNowCompleted ? user?.uid : deleteField(),
        completedAt: isNowCompleted ? serverTimestamp() : deleteField(),
        ...writeMeta()
    });
};

export const deleteSubTask = async (subTaskId: string, taskId: string, projectId?: string, tenantId?: string) => {
    const subSnap = await findSubtaskDoc(subTaskId, taskId, projectId, tenantId);
    if (!subSnap) return;

    const data = subSnap.data() as SubTask;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(subSnap.ref);
    await deleteDoc(subSnap.ref);

    await logActivity(
        data.projectId,
        { action: `Deleted subtask "${data.title}"`, target: 'Tasks', type: 'task', relatedId: data.taskId },
        resolvedTenant
    );
};

export const updateSubtaskFields = async (
    subTaskId: string,
    updates: Partial<SubTask>,
    taskId?: string,
    projectId?: string,
    tenantId?: string
) => {
    const subSnap = await findSubtaskDoc(subTaskId, taskId, projectId, tenantId);
    if (!subSnap) throw new Error('Subtask not found');

    // subtask_assigned notifications are created by onSubtaskWritten.
    await updateDoc(subSnap.ref, { ...updates, ...writeMeta() });
};
