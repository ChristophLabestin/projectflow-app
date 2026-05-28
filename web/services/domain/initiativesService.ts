import {
    addDoc,
    collectionGroup,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where
} from 'firebase/firestore';

import type { Initiative, Task } from '../../types';
import { auth, db } from '../firebase';
import {
    ensureTenantAndUser,
    findInitiativeDoc,
    findTaskDoc,
    logActivity,
    projectSubCollection,
    resolveTenantId
} from '../internal/workspaceDataCore';
import { toMillis } from '../../utils/time';
import { addTask } from './tasksService';

const INITIATIVES = 'initiatives';
const TASKS = 'tasks';
const MILESTONES = 'milestones';

type InitiativePayload = Partial<Pick<
    Initiative,
    | 'description'
    | 'status'
    | 'priority'
    | 'startDate'
    | 'dueDate'
    | 'assigneeIds'
    | 'assignedGroupIds'
    | 'originIdeaId'
    | 'externalKey'
    | 'source'
    | 'templateId'
    | 'templateTrack'
    | 'templateSeedId'
    | 'sourceReferences'
    | 'successMetric'
    | 'outcome'
    | 'health'
    | 'completedAt'
>>;

const normalizeInitiative = (id: string, data: Record<string, unknown>): Initiative => ({
    id,
    projectId: String(data.projectId || ''),
    tenantId: String(data.tenantId || ''),
    ownerId: String(data.ownerId || ''),
    title: String(data.title || ''),
    description: typeof data.description === 'string' ? data.description : '',
    status: (data.status as Initiative['status']) || 'Planning',
    priority: data.priority as Initiative['priority'],
    startDate: typeof data.startDate === 'string' ? data.startDate : '',
    dueDate: typeof data.dueDate === 'string' ? data.dueDate : '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    assigneeIds: Array.isArray(data.assigneeIds) ? data.assigneeIds as string[] : [],
    assignedGroupIds: Array.isArray(data.assignedGroupIds) ? data.assignedGroupIds as string[] : [],
    originIdeaId: typeof data.originIdeaId === 'string' ? data.originIdeaId : '',
    externalKey: typeof data.externalKey === 'string' ? data.externalKey : '',
    source: typeof data.source === 'string' ? data.source : '',
    templateId: data.templateId as Initiative['templateId'],
    templateTrack: typeof data.templateTrack === 'string' ? data.templateTrack : '',
    templateSeedId: typeof data.templateSeedId === 'string' ? data.templateSeedId : '',
    sourceReferences: Array.isArray(data.sourceReferences) ? data.sourceReferences as Initiative['sourceReferences'] : [],
    successMetric: typeof data.successMetric === 'string' ? data.successMetric : '',
    outcome: typeof data.outcome === 'string' ? data.outcome : '',
    health: data.health as Initiative['health'],
    feedbackForm: data.feedbackForm as Initiative['feedbackForm'],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    completedAt: data.completedAt
});

export const createInitiative = async (
    projectId: string,
    title: string,
    payload: InitiativePayload = {},
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const initiativeData = {
        projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        createdBy: user.uid,
        title,
        description: payload.description || '',
        status: payload.status || 'Planning',
        priority: payload.priority || 'Medium',
        startDate: payload.startDate || '',
        dueDate: payload.dueDate || '',
        assigneeIds: payload.assigneeIds || [],
        assignedGroupIds: payload.assignedGroupIds || [],
        originIdeaId: payload.originIdeaId || '',
        externalKey: payload.externalKey || '',
        source: payload.source || '',
        templateId: payload.templateId || '',
        templateTrack: payload.templateTrack || '',
        templateSeedId: payload.templateSeedId || '',
        sourceReferences: payload.sourceReferences || [],
        successMetric: payload.successMetric || '',
        outcome: payload.outcome || '',
        completedAt: payload.completedAt || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    if (payload.health) {
        Object.assign(initiativeData, { health: payload.health });
    }

    const ref = await addDoc(projectSubCollection(resolvedTenant, projectId, INITIATIVES), initiativeData);
    await logActivity(
        projectId,
        { action: `Created initiative "${title}"`, target: 'Initiatives', type: 'initiative', relatedId: ref.id },
        resolvedTenant
    );
    return ref.id;
};

export const updateInitiative = async (
    initiativeId: string,
    updates: Partial<Initiative>,
    projectId?: string,
    tenantId?: string
) => {
    const initiativeSnap = await findInitiativeDoc(initiativeId, projectId, tenantId);
    if (!initiativeSnap?.exists()) throw new Error('Initiative not found');

    await updateDoc(initiativeSnap.ref, {
        ...updates,
        updatedAt: serverTimestamp()
    });

    const data = initiativeSnap.data() as Initiative;
    await logActivity(
        data.projectId,
        { action: `Updated initiative "${data.title || initiativeId}"`, target: 'Initiatives', type: 'initiative', relatedId: initiativeId },
        data.tenantId
    );
};

export const deleteInitiative = async (
    initiativeId: string,
    projectId?: string,
    tenantId?: string
) => {
    const initiativeSnap = await findInitiativeDoc(initiativeId, projectId, tenantId);
    if (!initiativeSnap?.exists()) throw new Error('Initiative not found');

    const data = initiativeSnap.data() as Initiative;
    const childTasks = await getInitiativeTasks(data.projectId, initiativeId, data.tenantId);
    await Promise.all(childTasks.map(async (task) => {
        const taskSnap = await findTaskDoc(task.id, data.projectId, data.tenantId);
        if (!taskSnap?.exists()) return;

        const updates: Record<string, unknown> = {
            initiativeId: null,
            legacyInitiativeRoot: false,
            updatedAt: serverTimestamp()
        };

        if (task.legacyInitiativeRoot === true || task.convertedIdeaId || task.originIdeaId) {
            updates.initiativeMigrationDismissed = true;
        }

        await updateDoc(taskSnap.ref, updates);
    }));
    await deleteDoc(initiativeSnap.ref);
    await logActivity(
        data.projectId,
        { action: `Deleted initiative "${data.title || initiativeId}"`, target: 'Initiatives', type: 'initiative', relatedId: initiativeId },
        data.tenantId
    );
};

export const getInitiativeById = async (
    initiativeId: string,
    projectId?: string,
    tenantId?: string
): Promise<Initiative | null> => {
    const snap = await findInitiativeDoc(initiativeId, projectId, tenantId);
    if (!snap?.exists()) return null;

    return normalizeInitiative(snap.id, snap.data() as Record<string, unknown>);
};

export const getProjectInitiatives = async (
    projectId: string,
    tenantId?: string
): Promise<Initiative[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureProjectInitiativesMigrated(projectId, resolvedTenant);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, INITIATIVES));
    return snapshot.docs
        .map((docSnap) => normalizeInitiative(docSnap.id, docSnap.data() as Record<string, unknown>))
        .sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
};

export const getWorkspaceInitiatives = async (
    tenantId?: string
): Promise<Initiative[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const snapshot = await getDocs(
        query(
            collectionGroup(db, INITIATIVES),
            where('tenantId', '==', resolvedTenant)
        )
    );

    return snapshot.docs
        .map((docSnap) => normalizeInitiative(docSnap.id, docSnap.data() as Record<string, unknown>))
        .sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
};

export const subscribeProjectInitiatives = (
    projectId: string,
    callback: (initiatives: Initiative[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    void ensureProjectInitiativesMigrated(projectId, resolvedTenant).catch((error) => {
        console.warn('Failed to migrate legacy initiatives', error);
    });

    const initiativesQuery = query(
        projectSubCollection(resolvedTenant, projectId, INITIATIVES),
        orderBy('updatedAt', 'desc')
    );

    return onSnapshot(initiativesQuery, (snapshot) => {
        const initiatives = snapshot.docs
            .map((docSnap) => normalizeInitiative(docSnap.id, docSnap.data() as Record<string, unknown>))
            .sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
        callback(initiatives);
    });
};

export const getInitiativeTasks = async (
    projectId: string,
    initiativeId: string,
    tenantId?: string
): Promise<Task[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snapshot = await getDocs(
        query(projectSubCollection(resolvedTenant, projectId, TASKS), where('initiativeId', '==', initiativeId))
    );

    return snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Task))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const subscribeInitiativeTasks = (
    projectId: string,
    initiativeId: string,
    callback: (tasks: Task[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const taskQuery = query(
        projectSubCollection(resolvedTenant, projectId, TASKS),
        where('initiativeId', '==', initiativeId)
    );

    return onSnapshot(taskQuery, (snapshot) => {
        const tasks = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Task))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        callback(tasks);
    });
};

export const updateTaskInitiative = async (
    taskId: string,
    initiativeId: string | null,
    projectId?: string,
    tenantId?: string
) => {
    const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
    if (!taskSnap?.exists()) throw new Error('Task not found');

    const task = { id: taskSnap.id, ...taskSnap.data() } as Task;
    const updates: Record<string, unknown> = {
        initiativeId: initiativeId || null,
        legacyInitiativeRoot: initiativeId ? task.legacyInitiativeRoot === true : false,
        updatedAt: serverTimestamp()
    };

    if (!initiativeId && (task.legacyInitiativeRoot === true || task.convertedIdeaId || task.originIdeaId)) {
        updates.initiativeMigrationDismissed = true;
    } else if (initiativeId && (task.convertedIdeaId || task.originIdeaId) && task.legacyInitiativeRoot !== true) {
        updates.initiativeMigrationDismissed = true;
    }

    await updateDoc(taskSnap.ref, updates);

    await logActivity(
        task.projectId,
        {
            action: initiativeId ? `Attached task "${task.title}" to initiative` : `Detached task "${task.title}" from initiative`,
            target: 'Initiatives',
            type: 'initiative',
            relatedId: initiativeId || task.initiativeId || task.id
        },
        task.tenantId
    );
};

export const createInitiativeTask = async (
    projectId: string,
    initiativeId: string,
    title: string,
    options: Partial<Pick<Task, 'description' | 'category' | 'status' | 'assigneeIds' | 'assignedGroupIds' | 'startDate' | 'source' | 'templateId' | 'templateTrack' | 'templateSeedId' | 'sourceReferences' | 'externalKey'>> & {
        dueDate?: string;
        priority?: Task['priority'];
    } = {},
    tenantId?: string
) => {
    return addTask(
        projectId,
        title,
        options.dueDate,
        undefined,
        options.priority || 'Medium',
        {
            description: options.description,
            category: options.category,
            status: options.status || 'Open',
            assigneeIds: options.assigneeIds,
            assignedGroupIds: options.assignedGroupIds,
            initiativeId,
            startDate: options.startDate,
            source: options.source,
            templateId: options.templateId,
            templateTrack: options.templateTrack,
            templateSeedId: options.templateSeedId,
            sourceReferences: options.sourceReferences,
            externalKey: options.externalKey
        },
        tenantId
    );
};

export const ensureProjectInitiativesMigrated = async (
    projectId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const tasksSnapshot = await getDocs(
        query(projectSubCollection(resolvedTenant, projectId, TASKS), where('convertedIdeaId', '!=', ''))
    );

    if (tasksSnapshot.empty) {
        return;
    }

    const milestonesSnapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, MILESTONES));
    const milestones = milestonesSnapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Record<string, unknown>));
    const existingInitiatives = await getDocs(projectSubCollection(resolvedTenant, projectId, INITIATIVES));
    const existingInitiativeIds = new Set<string>();
    const byOriginIdeaId = new Map<string, string>();
    const byExternalKey = new Map<string, string>();

    existingInitiatives.forEach((docSnap) => {
        const data = docSnap.data();
        const originIdeaId = String(data.originIdeaId || '');
        const externalKey = String(data.externalKey || '');
        existingInitiativeIds.add(docSnap.id);
        if (originIdeaId) {
            byOriginIdeaId.set(originIdeaId, docSnap.id);
        }
        if (externalKey) {
            byExternalKey.set(externalKey, docSnap.id);
        }
    });

    for (const taskDoc of tasksSnapshot.docs) {
        const task = { id: taskDoc.id, ...taskDoc.data() } as Task;
        if (task.initiativeMigrationDismissed === true) {
            continue;
        }

        const originIdeaId = task.convertedIdeaId || task.originIdeaId || '';
        const legacyExternalKey = `legacy-task:${task.id}`;

        let initiativeId = '';
        if (task.initiativeId && existingInitiativeIds.has(task.initiativeId)) {
            initiativeId = task.initiativeId;
        } else if (originIdeaId) {
            initiativeId = byOriginIdeaId.get(originIdeaId) || '';
        }
        if (!initiativeId) {
            initiativeId = byExternalKey.get(legacyExternalKey) || '';
        }
        if (!initiativeId) {
            initiativeId = await createInitiative(
                projectId,
                task.title,
                {
                    description: task.description,
                    status: (task.status as Initiative['status']) || 'Planning',
                    priority: task.priority,
                    startDate: task.startDate,
                    dueDate: task.dueDate,
                    assigneeIds: task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []),
                    assignedGroupIds: task.assignedGroupIds,
                    originIdeaId,
                    externalKey: legacyExternalKey
                },
                resolvedTenant
            );
            existingInitiativeIds.add(initiativeId);
            byExternalKey.set(legacyExternalKey, initiativeId);
            if (originIdeaId) {
                byOriginIdeaId.set(originIdeaId, initiativeId);
            }
        }

        if (!task.initiativeId || task.legacyInitiativeRoot !== true) {
            await updateDoc(taskDoc.ref, {
                initiativeId,
                legacyInitiativeRoot: true,
                updatedAt: serverTimestamp()
            });
        }

        if (originIdeaId) {
            const matchingMilestones = milestones.filter((milestone) => milestone.linkedInitiativeId === originIdeaId);
            for (const milestone of matchingMilestones) {
                await updateDoc(
                    doc(projectSubCollection(resolvedTenant, projectId, MILESTONES), String(milestone.id)),
                    { linkedInitiativeId: initiativeId }
                );
            }
        }
    }
};
