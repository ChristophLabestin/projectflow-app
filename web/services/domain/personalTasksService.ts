import {
    addDoc,
    collection,
    deleteDoc,
    deleteField,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { ensureTenantAndUser, resolveTenantId } from '../internal/workspaceDataCore';
import { toMillis } from '../../utils/time';
import type { PersonalTask } from '../../types';
import { addTask, toggleTaskStatus } from './tasksService';

const PERSONAL_TASKS = 'personalTasks';

const personalTasksCollection = (tenantId: string, userId: string) =>
    collection(db, `tenants/${tenantId}/users/${userId}/${PERSONAL_TASKS}`);

const personalTaskDocRef = (tenantId: string, userId: string, taskId: string) =>
    doc(db, `tenants/${tenantId}/users/${userId}/${PERSONAL_TASKS}`, taskId);

export const addPersonalTask = async (
    title: string,
    dueDate?: string,
    priority: PersonalTask['priority'] = 'Medium',
    extra?: Partial<Pick<PersonalTask, 'description' | 'scheduledDate'>>,
    tenantId?: string
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const taskData: Record<string, unknown> = {
        ownerId: user.uid,
        title,
        isCompleted: false,
        priority,
        description: extra?.description || '',
        createdAt: serverTimestamp(),
        tenantId: resolvedTenant
    };

    if (dueDate) taskData.dueDate = dueDate;
    if (extra?.scheduledDate) taskData.scheduledDate = extra.scheduledDate;

    const docRef = await addDoc(personalTasksCollection(resolvedTenant, user.uid), taskData);
    return docRef.id;
};

export const getPersonalTasks = async (tenantId?: string): Promise<PersonalTask[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const snapshot = await getDocs(personalTasksCollection(resolvedTenant, user.uid));
    return snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as PersonalTask))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const updatePersonalTask = async (
    taskId: string,
    updates: Partial<PersonalTask>,
    tenantId?: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    const taskRef = personalTaskDocRef(resolvedTenant, user.uid, taskId);
    const sanitized: Record<string, unknown> = { ...updates };

    if (sanitized.isCompleted === true) {
        sanitized.completedAt = serverTimestamp();
    } else if (sanitized.isCompleted === false) {
        sanitized.completedAt = deleteField();
    }

    await updateDoc(taskRef, sanitized);
};

export const deletePersonalTask = async (taskId: string, tenantId?: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(personalTaskDocRef(resolvedTenant, user.uid, taskId));
};

export const togglePersonalTaskStatus = async (
    taskId: string,
    currentStatus: boolean,
    tenantId?: string
): Promise<void> => {
    await updatePersonalTask(taskId, { isCompleted: !currentStatus }, tenantId);
};

export const movePersonalTaskToProject = async (
    personalTaskId: string,
    targetProjectId: string,
    tenantId?: string
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    const personalTaskRef = personalTaskDocRef(resolvedTenant, user.uid, personalTaskId);
    const personalTaskSnap = await getDoc(personalTaskRef);

    if (!personalTaskSnap.exists()) {
        throw new Error('Personal task not found');
    }

    const personalTaskData = personalTaskSnap.data() as PersonalTask;
    const newTaskId = await addTask(
        targetProjectId,
        personalTaskData.title,
        personalTaskData.dueDate,
        undefined,
        personalTaskData.priority || 'Medium',
        {
            description: personalTaskData.description,
            category: personalTaskData.category,
            status: personalTaskData.status || 'Open'
        },
        resolvedTenant
    );

    if (personalTaskData.isCompleted) {
        await toggleTaskStatus(newTaskId, false, targetProjectId, resolvedTenant);
    }

    await deleteDoc(personalTaskRef);
    return newTaskId;
};

export const getPersonalTaskById = async (
    taskId: string,
    tenantId?: string
): Promise<PersonalTask | null> => {
    const user = auth.currentUser;
    if (!user) return null;

    const resolvedTenant = resolveTenantId(tenantId);
    const taskSnap = await getDoc(personalTaskDocRef(resolvedTenant, user.uid, taskId));

    if (!taskSnap.exists()) {
        return null;
    }

    return { id: taskSnap.id, ...taskSnap.data() } as PersonalTask;
};
