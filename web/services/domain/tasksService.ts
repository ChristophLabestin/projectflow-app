import {
    addDoc,
    collection,
    deleteDoc,
    deleteField,
    doc,
    getDoc,
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
import { notifySubtaskAssignment, notifyTaskAssignment } from '../notificationService';
import {
    ensureCategory,
    ensureTenantAndUser,
    findSubtaskDoc,
    findTaskDoc,
    getProjectContextFromRef,
    logActivity,
    projectSubCollection,
    resolveTenantId,
    syncProjectProgress
} from '../internal/workspaceDataCore';
import { toMillis } from '../../utils/time';
import type { Activity, SubTask, Task } from '../../types';
import { getSharedProjects, getUserProjects } from './projectsService';

const TASKS = 'tasks';
const SUBTASKS = 'subtasks';
const ISSUES = 'issues';

const loadProjectTasks = async (projectId: string, tenantId?: string): Promise<Task[]> => {
    if (!tenantId) {
        return [];
    }

    const snapshot = await getDocs(collection(db, 'tenants', tenantId, 'projects', projectId, TASKS));
    return snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data(), path: docSnap.ref.path } as unknown as Task))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const getUserTasks = async (): Promise<Task[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    try {
        const [myProjects, sharedProjects] = await Promise.all([
            getUserProjects(),
            getSharedProjects()
        ]);

        const uniqueProjects = Array.from(
            new Map([...myProjects, ...sharedProjects].map((project) => [project.id, project])).values()
        );

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
            task.assigneeId === user.uid ||
            (task.assigneeIds && task.assigneeIds.includes(user.uid)) ||
            (task.ownerId === user.uid && !task.assigneeId && (!task.assigneeIds || task.assigneeIds.length === 0))
        );
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
    extra?: Partial<Pick<Task, 'description' | 'category' | 'status' | 'assigneeId' | 'assigneeIds' | 'assignedGroupIds' | 'linkedIssueId' | 'convertedIdeaId' | 'startDate'>>,
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
        createdBy: user.uid,
        createdAt: serverTimestamp()
    };

    if (extra?.linkedIssueId) {
        taskData.linkedIssueId = extra.linkedIssueId;
    }

    if (extra?.convertedIdeaId) {
        taskData.convertedIdeaId = extra.convertedIdeaId;
    }

    const docRef = await addDoc(projectSubCollection(resolvedTenant, projectId, TASKS), taskData);
    await ensureCategory(projectId, extra?.category, resolvedTenant);
    await logActivity(projectId, { action: `Added task "${title}"`, target: 'Tasks', type: 'task', relatedId: docRef.id }, resolvedTenant);
    await syncProjectProgress(projectId, resolvedTenant);

    const assigneeIds = extra?.assigneeIds || (extra?.assigneeId ? [extra.assigneeId] : []);
    for (const assigneeId of assigneeIds) {
        if (assigneeId && assigneeId !== user.uid) {
            await notifyTaskAssignment(assigneeId, title, projectId, docRef.id, resolvedTenant);
        }
    }

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
    const taskSnap = await getDoc(taskRef);
    const subTasksRef = collection(taskRef, SUBTASKS);

    const subTaskData = {
        taskId,
        projectId,
        ownerId: user.uid,
        title,
        isCompleted: false,
        assigneeId: assigneeId || null,
        createdAt: serverTimestamp()
    };

    const docRef = await addDoc(subTasksRef, subTaskData);

    await logActivity(
        projectId,
        { action: `Added subtask "${title}"`, target: 'Tasks', type: 'task', relatedId: taskId },
        resolvedTenant
    );

    if (assigneeId && assigneeId !== user.uid) {
        const parentTask = taskSnap.exists() ? (taskSnap.data() as Task) : null;
        await notifySubtaskAssignment(assigneeId, title, parentTask?.title || 'Task', projectId, taskId, resolvedTenant);
    }

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
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Task))
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
        await updateDoc(ref, updates);
        return;
    }

    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) throw new Error('Task not found');
    await updateDoc(taskSnap.ref, updates);
};

export const toggleTaskStatus = async (taskId: string, currentStatus: boolean, projectId?: string, tenantId?: string) => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap) throw new Error('Task not found');

    const newStatus = !currentStatus;
    const user = auth.currentUser;
    const updateData: Record<string, unknown> = { isCompleted: newStatus };

    if (newStatus) {
        updateData.completedBy = user?.uid;
        updateData.completedAt = serverTimestamp();
    } else {
        updateData.completedBy = deleteField();
        updateData.completedAt = deleteField();
    }

    await updateDoc(taskSnap.ref, updateData);
    const data = taskSnap.data() as Task;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(taskSnap.ref);

    await logActivity(
        data.projectId,
        { action: `${newStatus ? 'Completed' : 'Reopened'} task "${data.title}"`, target: 'Tasks', type: 'task', relatedId: taskId },
        resolvedTenant
    );

    await syncProjectProgress(data.projectId, resolvedTenant);

    if (data.linkedIssueId) {
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

    const oldData = taskSnap.data() as Task;
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

    await updateDoc(taskSnap.ref, sanitized);

    const data = taskSnap.data() as Task;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(taskSnap.ref);
    let action = `Updated task "${data.title}"`;

    if (sanitized.isCompleted === true) {
        action = `Completed task "${data.title}"`;
    } else if (sanitized.isCompleted === false) {
        action = `Reopened task "${data.title}"`;
    }

    await logActivity(
        data.projectId,
        { action, target: 'Tasks', type: 'task', relatedId: taskId },
        resolvedTenant
    );

    if (sanitized.category) {
        await ensureCategory(data.projectId, sanitized.category as string | string[], resolvedTenant);
    }

    if (sanitized.isCompleted !== undefined || sanitized.status !== undefined) {
        await syncProjectProgress(data.projectId, resolvedTenant);
    }

    if (Array.isArray(sanitized.assigneeIds)) {
        const oldAssignees = oldData.assigneeIds || [];
        const newAssignees = sanitized.assigneeIds as string[];
        const addedAssignees = newAssignees.filter((id) => !oldAssignees.includes(id));
        for (const assigneeId of addedAssignees) {
            await notifyTaskAssignment(assigneeId, data.title, data.projectId, taskId, resolvedTenant);
        }
    } else if (typeof sanitized.assigneeId === 'string' && sanitized.assigneeId && sanitized.assigneeId !== oldData.assigneeId) {
        await notifyTaskAssignment(sanitized.assigneeId, data.title, data.projectId, taskId, resolvedTenant);
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

    await syncProjectProgress(data.projectId, resolvedTenant);
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
        createdAt: serverTimestamp()
    });

    await logActivity(
        task.projectId,
        { action: `Added subtask "${title}"`, target: task.title, type: 'task', relatedId: taskId },
        resolvedTenant
    );
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

    await updateDoc(subSnap.ref, {
        isCompleted: isNowCompleted,
        completedBy: isNowCompleted ? user?.uid : deleteField(),
        completedAt: isNowCompleted ? serverTimestamp() : deleteField()
    });

    const data = subSnap.data() as SubTask | undefined;
    if (!data) return;

    const taskSnap = await findTaskDoc(data.taskId, projectId, tenantId);
    const parentTask = taskSnap?.data() as Task | undefined;
    const { tenantId: resolvedTenant } = getProjectContextFromRef(subSnap.ref);

    if (parentTask) {
        await logActivity(
            parentTask.projectId,
            { action: `${isNowCompleted ? 'Completed' : 'Reopened'} subtask "${data.title}"`, target: parentTask.title, type: 'task', relatedId: data.taskId },
            resolvedTenant
        );
    }
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

    const oldData = subSnap.data() as SubTask;
    await updateDoc(subSnap.ref, updates);

    if (typeof updates.assigneeId === 'string' && updates.assigneeId && updates.assigneeId !== oldData.assigneeId) {
        const taskSnap = await findTaskDoc(oldData.taskId, projectId, tenantId);
        const task = taskSnap?.data() as Task | undefined;
        if (task) {
            await notifySubtaskAssignment(
                updates.assigneeId,
                oldData.title,
                task.title,
                task.projectId,
                oldData.taskId,
                tenantId
            );
        }
    }
};
