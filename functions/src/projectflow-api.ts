import * as admin from 'firebase-admin';

import { getAuthToken, type ApiPermission, validateAPIToken } from './authUtils';
import { db } from './init';

type ApiContext = {
    tenantId: string;
    tokenData: Record<string, any>;
    actorId: string;
    actorLabel: string;
};

const PROJECTS = 'projects';
const TASKS = 'tasks';
const ACTIVITIES = 'activities';
const SUBTASKS = 'subtasks';
const ISSUES = 'issues';
const IDEAS = 'ideas';
const MILESTONES = 'milestones';
const SPRINTS = 'sprints';
const CATEGORIES = 'categories';
const MINDMAPS = 'mindmaps';
const PROJECT_GROUPS = 'project_groups';
const COMMENTS = 'comments';

const PROJECT_WRITE_FIELDS = [
    'title',
    'description',
    'status',
    'projectState',
    'dueDate',
    'startDate',
    'priority',
    'isPrivate',
    'modules',
    'links',
    'externalResources',
    'visibilityGroupIds',
    'visibilityGroupId',
    'coverImage',
    'squareIcon',
    'screenshots',
    'githubRepo',
    'githubToken',
    'githubIssueSync',
    'overviewLayout',
    'members',
    'memberIds',
    'roles'
] as const;

const TASK_WRITE_FIELDS = [
    'title',
    'description',
    'status',
    'priority',
    'dueDate',
    'startDate',
    'isCompleted',
    'assignee',
    'assigneeId',
    'assigneeIds',
    'assignedGroupIds',
    'category',
    'dependencies',
    'sprintId',
    'linkedIssueId',
    'convertedIdeaId',
    'externalKey'
] as const;

const SUBTASK_WRITE_FIELDS = [
    'title',
    'isCompleted',
    'assigneeId',
    'completedBy',
    'completedAt'
] as const;

const getString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const getStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

const compactObject = <T extends Record<string, unknown>>(payload: T): Partial<T> =>
    Object.entries(payload).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key as keyof T] = value as T[keyof T];
        }
        return acc;
    }, {} as Partial<T>);

const serializeValue = (value: any): any => {
    if (value instanceof admin.firestore.Timestamp) {
        return value.toDate().toISOString();
    }

    if (Array.isArray(value)) {
        return value.map((item) => serializeValue(item));
    }

    if (value && typeof value === 'object') {
        return Object.entries(value).reduce((acc, [key, nestedValue]) => {
            acc[key] = serializeValue(nestedValue);
            return acc;
        }, {} as Record<string, any>);
    }

    return value;
};

const parseTenantId = (req: any, fallbackTenantId?: string): string => {
    const fromQuery = getString(req.query?.tenantId);
    const fromBody = getString(req.body?.tenantId);
    return fallbackTenantId || fromQuery || fromBody;
};

const projectRef = (tenantId: string, projectId: string) =>
    db.collection('tenants').doc(tenantId).collection(PROJECTS).doc(projectId);

const taskCollectionRef = (tenantId: string, projectId: string) =>
    projectRef(tenantId, projectId).collection(TASKS);

const projectCollectionRef = (tenantId: string, projectId: string, collectionName: string) =>
    projectRef(tenantId, projectId).collection(collectionName);

const projectActivityRef = (tenantId: string, projectId: string) =>
    projectRef(tenantId, projectId).collection(ACTIVITIES);

const writeProjectActivity = async (
    tenantId: string,
    projectId: string,
    action: string,
    target: string,
    relatedId: string | null,
    actorId: string,
    actorLabel: string
) => {
    await projectActivityRef(tenantId, projectId).add({
        projectId,
        tenantId,
        ownerId: actorId,
        user: actorLabel,
        action,
        target,
        type: 'status',
        relatedId,
        actorType: 'api-token',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
};

const syncProjectProgress = async (tenantId: string, projectId: string) => {
    const tasksSnapshot = await taskCollectionRef(tenantId, projectId).get();

    const totalTasks = tasksSnapshot.size;
    const completedTasks = tasksSnapshot.docs.filter((docSnap) => {
        const task = docSnap.data() as Record<string, unknown>;
        return task.isCompleted === true || task.status === 'Done';
    }).length;

    const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    await projectRef(tenantId, projectId).set(
        {
            progress,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
    );
};

const extractWritableFields = (body: Record<string, unknown>, allowedFields: readonly string[]) =>
    compactObject(
        allowedFields.reduce((acc, field) => {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                acc[field] = body[field];
            }
            return acc;
        }, {} as Record<string, unknown>)
    );

const extractMutableFields = (
    body: Record<string, unknown>,
    blockedFields: readonly string[] = []
) =>
    compactObject(
        Object.entries(body).reduce((acc, [key, value]) => {
            if (
                value !== undefined &&
                key !== 'id' &&
                key !== 'tenantId' &&
                key !== 'projectId' &&
                key !== 'ownerId' &&
                key !== 'createdBy' &&
                key !== 'createdAt' &&
                !blockedFields.includes(key)
            ) {
                acc[key] = value;
            }
            return acc;
        }, {} as Record<string, unknown>)
    );

const unauthorized = (res: any, message: string) => {
    res.status(401).json({ success: false, error: message });
};

const forbidden = (res: any, message: string) => {
    res.status(403).json({ success: false, error: message });
};

const badRequest = (res: any, message: string) => {
    res.status(400).json({ success: false, error: message });
};

const notFound = (res: any, message: string) => {
    res.status(404).json({ success: false, error: message });
};

const authRequest = async (
    req: any,
    res: any,
    permission: ApiPermission,
    projectId?: string,
    allowScopedList = false
): Promise<ApiContext | null> => {
    const token = getAuthToken(req);
    if (!token) {
        unauthorized(res, 'Missing API token.');
        return null;
    }

    const validation = await validateAPIToken(token, permission);
    if (!validation.valid || !validation.tokenData) {
        if (validation.error === 'Insufficient permissions') {
            forbidden(res, validation.error);
            return null;
        }
        unauthorized(res, validation.error || 'Invalid API token.');
        return null;
    }

    const tenantId = parseTenantId(req, validation.tenantId);
    if (!tenantId) {
        badRequest(res, 'tenantId is required.');
        return null;
    }

    if (validation.tenantId && validation.tenantId !== tenantId) {
        forbidden(res, 'Token tenant mismatch.');
        return null;
    }

    const scopedProjectId = getString(validation.tokenData.projectScope);
    if (scopedProjectId) {
        if (projectId && scopedProjectId !== projectId) {
            forbidden(res, 'Token is not authorized for this project.');
            return null;
        }

        if (!projectId && !allowScopedList) {
            forbidden(res, 'Project scope token requires a project-specific endpoint.');
            return null;
        }
    }

    const actorId =
        getString(validation.tokenData.createdBy) ||
        getString(validation.tokenData.uid) ||
        tenantId;

    const actorLabel =
        getString(validation.tokenData.name) ||
        getString(validation.tokenData.tokenPrefix) ||
        actorId;

    return {
        tenantId,
        tokenData: validation.tokenData,
        actorId,
        actorLabel
    };
};

const ensureProjectExists = async (tenantId: string, projectId: string, res: any): Promise<boolean> => {
    const snapshot = await projectRef(tenantId, projectId).get();
    if (!snapshot.exists) {
        notFound(res, 'Project not found.');
        return false;
    }
    return true;
};

const listProjects = async (req: any, res: any) => {
    const context = await authRequest(req, res, 'projects:read', undefined, true);
    if (!context) {
        return;
    }

    const scopedProjectId = getString(context.tokenData.projectScope);
    if (scopedProjectId) {
        const projectSnapshot = await projectRef(context.tenantId, scopedProjectId).get();
        if (!projectSnapshot.exists) {
            res.status(200).json({ success: true, projects: [] });
            return;
        }

        res.status(200).json({
            success: true,
            projects: [
                {
                    id: projectSnapshot.id,
                    ...serializeValue(projectSnapshot.data())
                }
            ]
        });
        return;
    }

    const snapshot = await db
        .collection('tenants')
        .doc(context.tenantId)
        .collection(PROJECTS)
        .orderBy('createdAt', 'desc')
        .get();

    const projects = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...serializeValue(docSnap.data())
    }));

    res.status(200).json({ success: true, projects });
};

const createProject = async (req: any, res: any) => {
    const context = await authRequest(req, res, 'projects:write');
    if (!context) {
        return;
    }

    const scopedProjectId = getString(context.tokenData.projectScope);
    if (scopedProjectId) {
        forbidden(res, 'Project-scoped tokens cannot create new projects.');
        return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const title = getString(body.title);
    if (!title) {
        badRequest(res, 'title is required.');
        return;
    }

    const memberIds = Array.from(new Set([context.actorId, ...getStringArray(body.memberIds)]));

    const payload = compactObject({
        title,
        description: getString(body.description),
        status: getString(body.status) || 'Planning',
        projectState: getString(body.projectState) || 'not specified',
        dueDate: getString(body.dueDate),
        startDate: getString(body.startDate),
        priority: getString(body.priority) || 'Medium',
        ownerId: context.actorId,
        tenantId: context.tenantId,
        progress: typeof body.progress === 'number' ? body.progress : 0,
        members: memberIds,
        memberIds,
        modules: getStringArray(body.modules),
        visibilityGroupIds: getStringArray(body.visibilityGroupIds),
        visibilityGroupId: getString(body.visibilityGroupId) || null,
        isPrivate: Boolean(body.isPrivate),
        links: Array.isArray(body.links) ? body.links : [],
        externalResources: Array.isArray(body.externalResources) ? body.externalResources : [],
        coverImage: getString(body.coverImage),
        squareIcon: getString(body.squareIcon),
        screenshots: Array.isArray(body.screenshots) ? body.screenshots : [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const created = await db.collection('tenants').doc(context.tenantId).collection(PROJECTS).add(payload);

    await writeProjectActivity(
        context.tenantId,
        created.id,
        `Created project \"${title}\" via API token ${context.actorLabel}`,
        'Project',
        created.id,
        context.actorId,
        context.actorLabel
    );

    const projectSnapshot = await created.get();

    res.status(201).json({
        success: true,
        project: {
            id: created.id,
            ...serializeValue(projectSnapshot.data())
        }
    });
};

const updateProject = async (req: any, res: any, projectId: string) => {
    const context = await authRequest(req, res, 'projects:write', projectId);
    if (!context) {
        return;
    }

    const projectSnapshot = await projectRef(context.tenantId, projectId).get();
    if (!projectSnapshot.exists) {
        notFound(res, 'Project not found.');
        return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const updates = extractWritableFields(body, PROJECT_WRITE_FIELDS);

    if (Object.keys(updates).length === 0) {
        badRequest(res, 'No writable fields provided for update.');
        return;
    }

    await projectRef(context.tenantId, projectId).update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Updated project \"${projectSnapshot.data()?.title || projectId}\" via API token ${context.actorLabel}`,
        'Project',
        projectId,
        context.actorId,
        context.actorLabel
    );

    const updatedSnapshot = await projectRef(context.tenantId, projectId).get();

    res.status(200).json({
        success: true,
        project: {
            id: projectId,
            ...serializeValue(updatedSnapshot.data())
        }
    });
};

const deleteProject = async (req: any, res: any, projectId: string) => {
    const context = await authRequest(req, res, 'projects:delete', projectId);
    if (!context) {
        return;
    }

    const projectSnapshot = await projectRef(context.tenantId, projectId).get();
    if (!projectSnapshot.exists) {
        notFound(res, 'Project not found.');
        return;
    }

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Deleted project \"${projectSnapshot.data()?.title || projectId}\" via API token ${context.actorLabel}`,
        'Project',
        projectId,
        context.actorId,
        context.actorLabel
    );

    await projectRef(context.tenantId, projectId).delete();

    res.status(200).json({
        success: true,
        deletedProjectId: projectId
    });
};

const listTasks = async (req: any, res: any, projectId: string) => {
    const context = await authRequest(req, res, 'tasks:read', projectId);
    if (!context) {
        return;
    }

    const projectSnapshot = await projectRef(context.tenantId, projectId).get();
    if (!projectSnapshot.exists) {
        notFound(res, 'Project not found.');
        return;
    }

    const snapshot = await taskCollectionRef(context.tenantId, projectId).orderBy('createdAt', 'desc').get();

    const tasks = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...serializeValue(docSnap.data())
    }));

    res.status(200).json({ success: true, tasks });
};

const createTask = async (req: any, res: any, projectId: string) => {
    const context = await authRequest(req, res, 'tasks:write', projectId);
    if (!context) {
        return;
    }

    const projectSnapshot = await projectRef(context.tenantId, projectId).get();
    if (!projectSnapshot.exists) {
        notFound(res, 'Project not found.');
        return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const title = getString(body.title);
    if (!title) {
        badRequest(res, 'title is required.');
        return;
    }

    const payload = compactObject({
        projectId,
        tenantId: context.tenantId,
        ownerId: context.actorId,
        createdBy: context.actorId,
        title,
        description: getString(body.description),
        status: getString(body.status) || 'Open',
        priority: getString(body.priority) || 'Medium',
        dueDate: getString(body.dueDate),
        startDate: getString(body.startDate),
        assignee: getString(body.assignee),
        assigneeId: getString(body.assigneeId) || null,
        assigneeIds: getStringArray(body.assigneeIds),
        assignedGroupIds: getStringArray(body.assignedGroupIds),
        category: Array.isArray(body.category) ? body.category : [],
        dependencies: getStringArray(body.dependencies),
        sprintId: getString(body.sprintId),
        linkedIssueId: getString(body.linkedIssueId),
        convertedIdeaId: getString(body.convertedIdeaId),
        externalKey: getString(body.externalKey),
        isCompleted: Boolean(body.isCompleted),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const created = await taskCollectionRef(context.tenantId, projectId).add(payload);

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Created task \"${title}\" via API token ${context.actorLabel}`,
        'Tasks',
        created.id,
        context.actorId,
        context.actorLabel
    );

    await syncProjectProgress(context.tenantId, projectId);

    const taskSnapshot = await created.get();

    res.status(201).json({
        success: true,
        task: {
            id: created.id,
            ...serializeValue(taskSnapshot.data())
        }
    });
};

const updateTask = async (req: any, res: any, projectId: string, taskId: string) => {
    const context = await authRequest(req, res, 'tasks:write', projectId);
    if (!context) {
        return;
    }

    const taskRef = taskCollectionRef(context.tenantId, projectId).doc(taskId);
    const taskSnapshot = await taskRef.get();
    if (!taskSnapshot.exists) {
        notFound(res, 'Task not found.');
        return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const updates = extractWritableFields(body, TASK_WRITE_FIELDS);

    if (Object.keys(updates).length === 0) {
        badRequest(res, 'No writable fields provided for update.');
        return;
    }

    await taskRef.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const latestTaskSnapshot = await taskRef.get();
    const latestTaskTitle = getString(latestTaskSnapshot.data()?.title);

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Updated task \"${latestTaskTitle || taskId}\" via API token ${context.actorLabel}`,
        'Tasks',
        taskId,
        context.actorId,
        context.actorLabel
    );

    await syncProjectProgress(context.tenantId, projectId);

    res.status(200).json({
        success: true,
        task: {
            id: taskId,
            ...serializeValue(latestTaskSnapshot.data())
        }
    });
};

const deleteTask = async (req: any, res: any, projectId: string, taskId: string) => {
    const context = await authRequest(req, res, 'tasks:delete', projectId);
    if (!context) {
        return;
    }

    const taskRef = taskCollectionRef(context.tenantId, projectId).doc(taskId);
    const taskSnapshot = await taskRef.get();
    if (!taskSnapshot.exists) {
        notFound(res, 'Task not found.');
        return;
    }

    const taskTitle = getString(taskSnapshot.data()?.title);

    await taskRef.delete();

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Deleted task \"${taskTitle || taskId}\" via API token ${context.actorLabel}`,
        'Tasks',
        taskId,
        context.actorId,
        context.actorLabel
    );

    await syncProjectProgress(context.tenantId, projectId);

    res.status(200).json({
        success: true,
        deletedTaskId: taskId
    });
};

const upsertTaskByExternalKey = async (req: any, res: any, projectId: string) => {
    const context = await authRequest(req, res, 'tasks:write', projectId);
    if (!context) {
        return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const externalKey = getString(body.externalKey);
    if (!externalKey) {
        badRequest(res, 'externalKey is required.');
        return;
    }

    const appendSummary = getString(body.appendSummary);

    const matches = await taskCollectionRef(context.tenantId, projectId)
        .where('externalKey', '==', externalKey)
        .limit(1)
        .get();

    if (!matches.empty) {
        const taskSnapshot = matches.docs[0];
        const updates = extractWritableFields(body, TASK_WRITE_FIELDS);
        const existingDescription = getString(taskSnapshot.data().description);

        if (appendSummary) {
            const appended = existingDescription
                ? `${existingDescription}\n\n${appendSummary}`
                : appendSummary;
            updates.description = appended;
        }

        updates.externalKey = externalKey;
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        await taskSnapshot.ref.update(updates);

        const refreshed = await taskSnapshot.ref.get();
        const refreshedTitle = getString(refreshed.data()?.title);

        await writeProjectActivity(
            context.tenantId,
            projectId,
            `Synced task \"${refreshedTitle || refreshed.id}\" via external key ${externalKey}`,
            'Tasks',
            refreshed.id,
            context.actorId,
            context.actorLabel
        );

        await syncProjectProgress(context.tenantId, projectId);

        res.status(200).json({
            success: true,
            operation: 'updated',
            task: {
                id: refreshed.id,
                ...serializeValue(refreshed.data())
            }
        });
        return;
    }

    const title = getString(body.title) || `Auto Sync ${externalKey.slice(0, 8)}`;
    const baseDescription = getString(body.description);
    const description = appendSummary
        ? (baseDescription ? `${baseDescription}\n\n${appendSummary}` : appendSummary)
        : baseDescription;

    const payload = compactObject({
        projectId,
        tenantId: context.tenantId,
        ownerId: context.actorId,
        createdBy: context.actorId,
        title,
        description,
        status: getString(body.status) || 'Open',
        priority: getString(body.priority) || 'Medium',
        dueDate: getString(body.dueDate),
        startDate: getString(body.startDate),
        assignee: getString(body.assignee),
        assigneeId: getString(body.assigneeId) || null,
        assigneeIds: getStringArray(body.assigneeIds),
        assignedGroupIds: getStringArray(body.assignedGroupIds),
        category: Array.isArray(body.category) ? body.category : [],
        dependencies: getStringArray(body.dependencies),
        sprintId: getString(body.sprintId),
        linkedIssueId: getString(body.linkedIssueId),
        convertedIdeaId: getString(body.convertedIdeaId),
        externalKey,
        isCompleted: Boolean(body.isCompleted),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const created = await taskCollectionRef(context.tenantId, projectId).add(payload);

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Upsert-created task \"${title}\" via external key ${externalKey}`,
        'Tasks',
        created.id,
        context.actorId,
        context.actorLabel
    );

    await syncProjectProgress(context.tenantId, projectId);

    const taskSnapshot = await created.get();

    res.status(201).json({
        success: true,
        operation: 'created',
        task: {
            id: created.id,
            ...serializeValue(taskSnapshot.data())
        }
    });
};

const getProject = async (req: any, res: any, projectId: string) => {
    const context = await authRequest(req, res, 'projects:read', projectId);
    if (!context) {
        return;
    }

    const snapshot = await projectRef(context.tenantId, projectId).get();
    if (!snapshot.exists) {
        notFound(res, 'Project not found.');
        return;
    }

    res.status(200).json({
        success: true,
        project: {
            id: snapshot.id,
            ...serializeValue(snapshot.data())
        }
    });
};

const getTask = async (req: any, res: any, projectId: string, taskId: string) => {
    const context = await authRequest(req, res, 'tasks:read', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const taskSnapshot = await taskCollectionRef(context.tenantId, projectId).doc(taskId).get();
    if (!taskSnapshot.exists) {
        notFound(res, 'Task not found.');
        return;
    }

    res.status(200).json({
        success: true,
        task: {
            id: taskSnapshot.id,
            ...serializeValue(taskSnapshot.data())
        }
    });
};

const listSubtasks = async (req: any, res: any, projectId: string, taskId: string) => {
    const context = await authRequest(req, res, 'tasks:read', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const taskSnapshot = await taskCollectionRef(context.tenantId, projectId).doc(taskId).get();
    if (!taskSnapshot.exists) {
        notFound(res, 'Task not found.');
        return;
    }

    const snapshot = await taskCollectionRef(context.tenantId, projectId).doc(taskId).collection(SUBTASKS).get();
    const subtasks = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...serializeValue(docSnap.data())
    }));

    res.status(200).json({ success: true, subtasks });
};

const createSubtask = async (req: any, res: any, projectId: string, taskId: string) => {
    const context = await authRequest(req, res, 'tasks:write', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const taskSnapshot = await taskCollectionRef(context.tenantId, projectId).doc(taskId).get();
    if (!taskSnapshot.exists) {
        notFound(res, 'Task not found.');
        return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const title = getString(body.title);
    if (!title) {
        badRequest(res, 'title is required.');
        return;
    }

    const payload = compactObject({
        ...extractMutableFields(body),
        taskId,
        projectId,
        tenantId: context.tenantId,
        ownerId: context.actorId,
        createdBy: context.actorId,
        title,
        isCompleted: Boolean(body.isCompleted),
        assigneeId: getString(body.assigneeId) || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const created = await taskCollectionRef(context.tenantId, projectId).doc(taskId).collection(SUBTASKS).add(payload);
    const createdSnapshot = await created.get();

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Created subtask "${title}" via API token ${context.actorLabel}`,
        'Tasks',
        taskId,
        context.actorId,
        context.actorLabel
    );

    res.status(201).json({
        success: true,
        subtask: {
            id: created.id,
            ...serializeValue(createdSnapshot.data())
        }
    });
};

const getSubtask = async (req: any, res: any, projectId: string, taskId: string, subtaskId: string) => {
    const context = await authRequest(req, res, 'tasks:read', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const subtaskSnapshot = await taskCollectionRef(context.tenantId, projectId)
        .doc(taskId)
        .collection(SUBTASKS)
        .doc(subtaskId)
        .get();

    if (!subtaskSnapshot.exists) {
        notFound(res, 'Subtask not found.');
        return;
    }

    res.status(200).json({
        success: true,
        subtask: {
            id: subtaskSnapshot.id,
            ...serializeValue(subtaskSnapshot.data())
        }
    });
};

const updateSubtask = async (req: any, res: any, projectId: string, taskId: string, subtaskId: string) => {
    const context = await authRequest(req, res, 'tasks:write', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const subtaskRef = taskCollectionRef(context.tenantId, projectId)
        .doc(taskId)
        .collection(SUBTASKS)
        .doc(subtaskId);
    const subtaskSnapshot = await subtaskRef.get();
    if (!subtaskSnapshot.exists) {
        notFound(res, 'Subtask not found.');
        return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const updates = extractWritableFields(body, SUBTASK_WRITE_FIELDS);
    if (Object.keys(updates).length === 0) {
        badRequest(res, 'No writable fields provided for update.');
        return;
    }

    await subtaskRef.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Updated subtask "${getString(subtaskSnapshot.data()?.title) || subtaskId}" via API token ${context.actorLabel}`,
        'Tasks',
        taskId,
        context.actorId,
        context.actorLabel
    );

    const latest = await subtaskRef.get();
    res.status(200).json({
        success: true,
        subtask: {
            id: latest.id,
            ...serializeValue(latest.data())
        }
    });
};

const deleteSubtask = async (req: any, res: any, projectId: string, taskId: string, subtaskId: string) => {
    const context = await authRequest(req, res, 'tasks:delete', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const subtaskRef = taskCollectionRef(context.tenantId, projectId)
        .doc(taskId)
        .collection(SUBTASKS)
        .doc(subtaskId);
    const subtaskSnapshot = await subtaskRef.get();
    if (!subtaskSnapshot.exists) {
        notFound(res, 'Subtask not found.');
        return;
    }

    const subtaskTitle = getString(subtaskSnapshot.data()?.title);
    await subtaskRef.delete();

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Deleted subtask "${subtaskTitle || subtaskId}" via API token ${context.actorLabel}`,
        'Tasks',
        taskId,
        context.actorId,
        context.actorLabel
    );

    res.status(200).json({
        success: true,
        deletedSubtaskId: subtaskId
    });
};

const listProjectCollectionItems = async (
    req: any,
    res: any,
    projectId: string,
    collectionName: string,
    responseKey: string
) => {
    const context = await authRequest(req, res, 'projects:read', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    let queryRef: any = projectCollectionRef(context.tenantId, projectId, collectionName);
    if (collectionName === COMMENTS) {
        const targetId = getString(req.query?.targetId);
        const targetType = getString(req.query?.targetType);
        if (targetId) {
            queryRef = queryRef.where('targetId', '==', targetId);
        }
        if (targetType) {
            queryRef = queryRef.where('targetType', '==', targetType);
        }
    } else if (collectionName === CATEGORIES) {
        queryRef = queryRef.orderBy('name', 'asc');
    } else {
        queryRef = queryRef.orderBy('createdAt', 'desc');
    }

    const snapshot = await queryRef.get();
    const items = snapshot.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...serializeValue(docSnap.data())
    }));

    res.status(200).json({ success: true, [responseKey]: items });
};

const createProjectCollectionItem = async (
    req: any,
    res: any,
    projectId: string,
    collectionName: string,
    responseKey: string,
    requiredField: string,
    requiredLabel: string,
    activityTarget: string
) => {
    const context = await authRequest(req, res, 'projects:write', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const requiredValue = getString(body[requiredField]);
    if (!requiredValue) {
        badRequest(res, `${requiredField} is required.`);
        return;
    }

    const payload = compactObject({
        ...extractMutableFields(body),
        projectId,
        tenantId: context.tenantId,
        ownerId: context.actorId,
        createdBy: context.actorId,
        [requiredField]: requiredValue,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (collectionName === ISSUES) {
        payload.reporter = getString(body.reporter) || context.actorLabel;
        payload.reporterId = getString(body.reporterId) || context.actorId;
        payload.status = getString(body.status) || 'Open';
        payload.priority = getString(body.priority) || 'Medium';
        payload.description = getString(body.description);
    }

    if (collectionName === IDEAS) {
        payload.description = getString(body.description);
        payload.stage = getString(body.stage) || 'Brainstorm';
        payload.type = getString(body.type) || 'Feature';
        payload.votes = typeof body.votes === 'number' ? body.votes : 0;
        payload.comments = typeof body.comments === 'number' ? body.comments : 0;
    }

    if (collectionName === MILESTONES) {
        payload.status = getString(body.status) || 'Pending';
    }

    if (collectionName === SPRINTS) {
        payload.status = getString(body.status) || 'Planning';
    }

    if (collectionName === CATEGORIES) {
        payload.normalized = requiredValue.toLowerCase();
    }

    if (collectionName === PROJECT_GROUPS) {
        payload.memberIds = getStringArray(body.memberIds);
    }

    if (collectionName === COMMENTS) {
        payload.userId = context.actorId;
        payload.userDisplayName = context.actorLabel;
        payload.userPhotoURL = getString(body.userPhotoURL);
    }

    const created = await projectCollectionRef(context.tenantId, projectId, collectionName).add(payload);
    const snapshot = await created.get();

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Created ${requiredLabel} "${requiredValue}" via API token ${context.actorLabel}`,
        activityTarget,
        created.id,
        context.actorId,
        context.actorLabel
    );

    res.status(201).json({
        success: true,
        [responseKey]: {
            id: created.id,
            ...serializeValue(snapshot.data())
        }
    });
};

const getProjectCollectionItem = async (
    req: any,
    res: any,
    projectId: string,
    itemId: string,
    collectionName: string,
    responseKey: string,
    notFoundLabel: string
) => {
    const context = await authRequest(req, res, 'projects:read', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const snapshot = await projectCollectionRef(context.tenantId, projectId, collectionName).doc(itemId).get();
    if (!snapshot.exists) {
        notFound(res, `${notFoundLabel} not found.`);
        return;
    }

    res.status(200).json({
        success: true,
        [responseKey]: {
            id: snapshot.id,
            ...serializeValue(snapshot.data())
        }
    });
};

const updateProjectCollectionItem = async (
    req: any,
    res: any,
    projectId: string,
    itemId: string,
    collectionName: string,
    responseKey: string,
    notFoundLabel: string,
    activityTarget: string
) => {
    const context = await authRequest(req, res, 'projects:write', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const itemRef = projectCollectionRef(context.tenantId, projectId, collectionName).doc(itemId);
    const itemSnapshot = await itemRef.get();
    if (!itemSnapshot.exists) {
        notFound(res, `${notFoundLabel} not found.`);
        return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const updates = extractMutableFields(body);

    if (Object.keys(updates).length === 0) {
        badRequest(res, 'No writable fields provided for update.');
        return;
    }

    if (collectionName === CATEGORIES && typeof updates.name === 'string') {
        updates.normalized = updates.name.toLowerCase();
    }

    await itemRef.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Updated ${notFoundLabel.toLowerCase()} "${getString(itemSnapshot.data()?.title) || getString(itemSnapshot.data()?.name) || itemId}" via API token ${context.actorLabel}`,
        activityTarget,
        itemId,
        context.actorId,
        context.actorLabel
    );

    const latest = await itemRef.get();
    res.status(200).json({
        success: true,
        [responseKey]: {
            id: latest.id,
            ...serializeValue(latest.data())
        }
    });
};

const deleteProjectCollectionItem = async (
    req: any,
    res: any,
    projectId: string,
    itemId: string,
    collectionName: string,
    notFoundLabel: string,
    deletedKey: string,
    activityTarget: string
) => {
    const context = await authRequest(req, res, 'projects:delete', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const itemRef = projectCollectionRef(context.tenantId, projectId, collectionName).doc(itemId);
    const itemSnapshot = await itemRef.get();
    if (!itemSnapshot.exists) {
        notFound(res, `${notFoundLabel} not found.`);
        return;
    }

    const itemTitle = getString(itemSnapshot.data()?.title) || getString(itemSnapshot.data()?.name);

    await itemRef.delete();

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Deleted ${notFoundLabel.toLowerCase()} "${itemTitle || itemId}" via API token ${context.actorLabel}`,
        activityTarget,
        itemId,
        context.actorId,
        context.actorLabel
    );

    res.status(200).json({
        success: true,
        [deletedKey]: itemId
    });
};

const listIssues = async (req: any, res: any, projectId: string) =>
    listProjectCollectionItems(req, res, projectId, ISSUES, 'issues');
const createIssue = async (req: any, res: any, projectId: string) =>
    createProjectCollectionItem(req, res, projectId, ISSUES, 'issue', 'title', 'issue', 'Issues');
const getIssue = async (req: any, res: any, projectId: string, issueId: string) =>
    getProjectCollectionItem(req, res, projectId, issueId, ISSUES, 'issue', 'Issue');
const updateIssue = async (req: any, res: any, projectId: string, issueId: string) =>
    updateProjectCollectionItem(req, res, projectId, issueId, ISSUES, 'issue', 'Issue', 'Issues');
const deleteIssue = async (req: any, res: any, projectId: string, issueId: string) =>
    deleteProjectCollectionItem(req, res, projectId, issueId, ISSUES, 'Issue', 'deletedIssueId', 'Issues');

const listIdeas = async (req: any, res: any, projectId: string) =>
    listProjectCollectionItems(req, res, projectId, IDEAS, 'ideas');
const createIdea = async (req: any, res: any, projectId: string) =>
    createProjectCollectionItem(req, res, projectId, IDEAS, 'idea', 'title', 'idea', 'Ideas');
const getIdea = async (req: any, res: any, projectId: string, ideaId: string) =>
    getProjectCollectionItem(req, res, projectId, ideaId, IDEAS, 'idea', 'Idea');
const updateIdea = async (req: any, res: any, projectId: string, ideaId: string) =>
    updateProjectCollectionItem(req, res, projectId, ideaId, IDEAS, 'idea', 'Idea', 'Ideas');
const deleteIdea = async (req: any, res: any, projectId: string, ideaId: string) =>
    deleteProjectCollectionItem(req, res, projectId, ideaId, IDEAS, 'Idea', 'deletedIdeaId', 'Ideas');

const listMilestones = async (req: any, res: any, projectId: string) =>
    listProjectCollectionItems(req, res, projectId, MILESTONES, 'milestones');
const createMilestone = async (req: any, res: any, projectId: string) =>
    createProjectCollectionItem(req, res, projectId, MILESTONES, 'milestone', 'title', 'milestone', 'Milestones');
const getMilestone = async (req: any, res: any, projectId: string, milestoneId: string) =>
    getProjectCollectionItem(req, res, projectId, milestoneId, MILESTONES, 'milestone', 'Milestone');
const updateMilestone = async (req: any, res: any, projectId: string, milestoneId: string) =>
    updateProjectCollectionItem(req, res, projectId, milestoneId, MILESTONES, 'milestone', 'Milestone', 'Milestones');
const deleteMilestone = async (req: any, res: any, projectId: string, milestoneId: string) =>
    deleteProjectCollectionItem(req, res, projectId, milestoneId, MILESTONES, 'Milestone', 'deletedMilestoneId', 'Milestones');

const listSprints = async (req: any, res: any, projectId: string) =>
    listProjectCollectionItems(req, res, projectId, SPRINTS, 'sprints');
const createSprint = async (req: any, res: any, projectId: string) =>
    createProjectCollectionItem(req, res, projectId, SPRINTS, 'sprint', 'name', 'sprint', 'Sprints');
const getSprint = async (req: any, res: any, projectId: string, sprintId: string) =>
    getProjectCollectionItem(req, res, projectId, sprintId, SPRINTS, 'sprint', 'Sprint');
const updateSprint = async (req: any, res: any, projectId: string, sprintId: string) =>
    updateProjectCollectionItem(req, res, projectId, sprintId, SPRINTS, 'sprint', 'Sprint', 'Sprints');
const deleteSprint = async (req: any, res: any, projectId: string, sprintId: string) =>
    deleteProjectCollectionItem(req, res, projectId, sprintId, SPRINTS, 'Sprint', 'deletedSprintId', 'Sprints');

const listCategories = async (req: any, res: any, projectId: string) =>
    listProjectCollectionItems(req, res, projectId, CATEGORIES, 'categories');
const createCategory = async (req: any, res: any, projectId: string) =>
    createProjectCollectionItem(req, res, projectId, CATEGORIES, 'category', 'name', 'category', 'Categories');
const getCategory = async (req: any, res: any, projectId: string, categoryId: string) =>
    getProjectCollectionItem(req, res, projectId, categoryId, CATEGORIES, 'category', 'Category');
const updateCategory = async (req: any, res: any, projectId: string, categoryId: string) =>
    updateProjectCollectionItem(req, res, projectId, categoryId, CATEGORIES, 'category', 'Category', 'Categories');
const deleteCategory = async (req: any, res: any, projectId: string, categoryId: string) =>
    deleteProjectCollectionItem(req, res, projectId, categoryId, CATEGORIES, 'Category', 'deletedCategoryId', 'Categories');

const listMindmaps = async (req: any, res: any, projectId: string) =>
    listProjectCollectionItems(req, res, projectId, MINDMAPS, 'mindmaps');
const createMindmap = async (req: any, res: any, projectId: string) =>
    createProjectCollectionItem(req, res, projectId, MINDMAPS, 'mindmap', 'name', 'mindmap', 'Mindmaps');
const getMindmap = async (req: any, res: any, projectId: string, mindmapId: string) =>
    getProjectCollectionItem(req, res, projectId, mindmapId, MINDMAPS, 'mindmap', 'Mindmap');
const updateMindmap = async (req: any, res: any, projectId: string, mindmapId: string) =>
    updateProjectCollectionItem(req, res, projectId, mindmapId, MINDMAPS, 'mindmap', 'Mindmap', 'Mindmaps');
const deleteMindmap = async (req: any, res: any, projectId: string, mindmapId: string) =>
    deleteProjectCollectionItem(req, res, projectId, mindmapId, MINDMAPS, 'Mindmap', 'deletedMindmapId', 'Mindmaps');

const listProjectGroups = async (req: any, res: any, projectId: string) =>
    listProjectCollectionItems(req, res, projectId, PROJECT_GROUPS, 'projectGroups');
const createProjectGroup = async (req: any, res: any, projectId: string) =>
    createProjectCollectionItem(req, res, projectId, PROJECT_GROUPS, 'projectGroup', 'name', 'project group', 'Groups');
const getProjectGroup = async (req: any, res: any, projectId: string, groupId: string) =>
    getProjectCollectionItem(req, res, projectId, groupId, PROJECT_GROUPS, 'projectGroup', 'Project group');
const updateProjectGroup = async (req: any, res: any, projectId: string, groupId: string) =>
    updateProjectCollectionItem(req, res, projectId, groupId, PROJECT_GROUPS, 'projectGroup', 'Project group', 'Groups');
const deleteProjectGroup = async (req: any, res: any, projectId: string, groupId: string) =>
    deleteProjectCollectionItem(req, res, projectId, groupId, PROJECT_GROUPS, 'Project group', 'deletedProjectGroupId', 'Groups');

const listComments = async (req: any, res: any, projectId: string) =>
    listProjectCollectionItems(req, res, projectId, COMMENTS, 'comments');
const createComment = async (req: any, res: any, projectId: string) => {
    const body = (req.body || {}) as Record<string, unknown>;
    if (!getString(body.targetId)) {
        badRequest(res, 'targetId is required.');
        return;
    }
    if (!getString(body.targetType)) {
        badRequest(res, 'targetType is required.');
        return;
    }
    await createProjectCollectionItem(req, res, projectId, COMMENTS, 'comment', 'content', 'comment', 'Comments');
};
const getComment = async (req: any, res: any, projectId: string, commentId: string) =>
    getProjectCollectionItem(req, res, projectId, commentId, COMMENTS, 'comment', 'Comment');
const updateComment = async (req: any, res: any, projectId: string, commentId: string) =>
    updateProjectCollectionItem(req, res, projectId, commentId, COMMENTS, 'comment', 'Comment', 'Comments');
const deleteComment = async (req: any, res: any, projectId: string, commentId: string) =>
    deleteProjectCollectionItem(req, res, projectId, commentId, COMMENTS, 'Comment', 'deletedCommentId', 'Comments');

const listActivities = async (req: any, res: any, projectId: string) =>
    listProjectCollectionItems(req, res, projectId, ACTIVITIES, 'activities');

const PROJECTFLOW_SUPPORTED_ENDPOINTS = [
    'GET /api/projectflow/projects',
    'POST /api/projectflow/projects',
    'GET /api/projectflow/projects/:projectId',
    'PATCH /api/projectflow/projects/:projectId',
    'DELETE /api/projectflow/projects/:projectId',
    'GET /api/projectflow/projects/:projectId/tasks',
    'POST /api/projectflow/projects/:projectId/tasks',
    'GET /api/projectflow/projects/:projectId/tasks/:taskId',
    'PATCH /api/projectflow/projects/:projectId/tasks/:taskId',
    'DELETE /api/projectflow/projects/:projectId/tasks/:taskId',
    'POST /api/projectflow/projects/:projectId/tasks/upsert-by-external-key',
    'GET /api/projectflow/projects/:projectId/tasks/:taskId/subtasks',
    'POST /api/projectflow/projects/:projectId/tasks/:taskId/subtasks',
    'GET /api/projectflow/projects/:projectId/tasks/:taskId/subtasks/:subtaskId',
    'PATCH /api/projectflow/projects/:projectId/tasks/:taskId/subtasks/:subtaskId',
    'DELETE /api/projectflow/projects/:projectId/tasks/:taskId/subtasks/:subtaskId',
    'GET /api/projectflow/projects/:projectId/issues',
    'POST /api/projectflow/projects/:projectId/issues',
    'GET /api/projectflow/projects/:projectId/issues/:issueId',
    'PATCH /api/projectflow/projects/:projectId/issues/:issueId',
    'DELETE /api/projectflow/projects/:projectId/issues/:issueId',
    'GET /api/projectflow/projects/:projectId/ideas',
    'POST /api/projectflow/projects/:projectId/ideas',
    'GET /api/projectflow/projects/:projectId/ideas/:ideaId',
    'PATCH /api/projectflow/projects/:projectId/ideas/:ideaId',
    'DELETE /api/projectflow/projects/:projectId/ideas/:ideaId',
    'GET /api/projectflow/projects/:projectId/milestones',
    'POST /api/projectflow/projects/:projectId/milestones',
    'GET /api/projectflow/projects/:projectId/milestones/:milestoneId',
    'PATCH /api/projectflow/projects/:projectId/milestones/:milestoneId',
    'DELETE /api/projectflow/projects/:projectId/milestones/:milestoneId',
    'GET /api/projectflow/projects/:projectId/sprints',
    'POST /api/projectflow/projects/:projectId/sprints',
    'GET /api/projectflow/projects/:projectId/sprints/:sprintId',
    'PATCH /api/projectflow/projects/:projectId/sprints/:sprintId',
    'DELETE /api/projectflow/projects/:projectId/sprints/:sprintId',
    'GET /api/projectflow/projects/:projectId/categories',
    'POST /api/projectflow/projects/:projectId/categories',
    'GET /api/projectflow/projects/:projectId/categories/:categoryId',
    'PATCH /api/projectflow/projects/:projectId/categories/:categoryId',
    'DELETE /api/projectflow/projects/:projectId/categories/:categoryId',
    'GET /api/projectflow/projects/:projectId/mindmaps',
    'POST /api/projectflow/projects/:projectId/mindmaps',
    'GET /api/projectflow/projects/:projectId/mindmaps/:mindmapId',
    'PATCH /api/projectflow/projects/:projectId/mindmaps/:mindmapId',
    'DELETE /api/projectflow/projects/:projectId/mindmaps/:mindmapId',
    'GET /api/projectflow/projects/:projectId/project-groups',
    'POST /api/projectflow/projects/:projectId/project-groups',
    'GET /api/projectflow/projects/:projectId/project-groups/:groupId',
    'PATCH /api/projectflow/projects/:projectId/project-groups/:groupId',
    'DELETE /api/projectflow/projects/:projectId/project-groups/:groupId',
    'GET /api/projectflow/projects/:projectId/comments',
    'POST /api/projectflow/projects/:projectId/comments',
    'GET /api/projectflow/projects/:projectId/comments/:commentId',
    'PATCH /api/projectflow/projects/:projectId/comments/:commentId',
    'DELETE /api/projectflow/projects/:projectId/comments/:commentId',
    'GET /api/projectflow/projects/:projectId/activities'
];

export const handleProjectflowApiRoute = async (req: any, res: any, path: string): Promise<boolean> => {
    const normalized = path.startsWith('/') ? path.slice(1) : path;
    const segments = normalized.split('/').filter(Boolean);

    if (segments[0] !== 'projectflow') {
        return false;
    }

    if (segments.length === 2 && segments[1] === PROJECTS) {
        if (req.method === 'GET') {
            await listProjects(req, res);
            return true;
        }
        if (req.method === 'POST') {
            await createProject(req, res);
            return true;
        }
    }

    if (segments.length >= 3 && segments[1] === PROJECTS) {
        const projectId = segments[2];

        if (segments.length === 3) {
            if (req.method === 'GET') {
                await getProject(req, res, projectId);
                return true;
            }
            if (req.method === 'PATCH') {
                await updateProject(req, res, projectId);
                return true;
            }
            if (req.method === 'DELETE') {
                await deleteProject(req, res, projectId);
                return true;
            }
        }

        if (segments.length === 4) {
            const resource = segments[3];

            if (resource === TASKS) {
                if (req.method === 'GET') {
                    await listTasks(req, res, projectId);
                    return true;
                }
                if (req.method === 'POST') {
                    await createTask(req, res, projectId);
                    return true;
                }
            }

            if (resource === ISSUES) {
                if (req.method === 'GET') {
                    await listIssues(req, res, projectId);
                    return true;
                }
                if (req.method === 'POST') {
                    await createIssue(req, res, projectId);
                    return true;
                }
            }

            if (resource === IDEAS) {
                if (req.method === 'GET') {
                    await listIdeas(req, res, projectId);
                    return true;
                }
                if (req.method === 'POST') {
                    await createIdea(req, res, projectId);
                    return true;
                }
            }

            if (resource === MILESTONES) {
                if (req.method === 'GET') {
                    await listMilestones(req, res, projectId);
                    return true;
                }
                if (req.method === 'POST') {
                    await createMilestone(req, res, projectId);
                    return true;
                }
            }

            if (resource === SPRINTS) {
                if (req.method === 'GET') {
                    await listSprints(req, res, projectId);
                    return true;
                }
                if (req.method === 'POST') {
                    await createSprint(req, res, projectId);
                    return true;
                }
            }

            if (resource === CATEGORIES) {
                if (req.method === 'GET') {
                    await listCategories(req, res, projectId);
                    return true;
                }
                if (req.method === 'POST') {
                    await createCategory(req, res, projectId);
                    return true;
                }
            }

            if (resource === MINDMAPS) {
                if (req.method === 'GET') {
                    await listMindmaps(req, res, projectId);
                    return true;
                }
                if (req.method === 'POST') {
                    await createMindmap(req, res, projectId);
                    return true;
                }
            }

            if (resource === 'project-groups') {
                if (req.method === 'GET') {
                    await listProjectGroups(req, res, projectId);
                    return true;
                }
                if (req.method === 'POST') {
                    await createProjectGroup(req, res, projectId);
                    return true;
                }
            }

            if (resource === COMMENTS) {
                if (req.method === 'GET') {
                    await listComments(req, res, projectId);
                    return true;
                }
                if (req.method === 'POST') {
                    await createComment(req, res, projectId);
                    return true;
                }
            }

            if (resource === ACTIVITIES && req.method === 'GET') {
                await listActivities(req, res, projectId);
                return true;
            }
        }

        if (segments.length === 5) {
            const resource = segments[3];
            const resourceId = segments[4];

            if (resource === TASKS) {
                if (resourceId === 'upsert-by-external-key' && req.method === 'POST') {
                    await upsertTaskByExternalKey(req, res, projectId);
                    return true;
                }

                if (req.method === 'GET') {
                    await getTask(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'PATCH') {
                    await updateTask(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'DELETE') {
                    await deleteTask(req, res, projectId, resourceId);
                    return true;
                }
            }

            if (resource === ISSUES) {
                if (req.method === 'GET') {
                    await getIssue(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'PATCH') {
                    await updateIssue(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'DELETE') {
                    await deleteIssue(req, res, projectId, resourceId);
                    return true;
                }
            }

            if (resource === IDEAS) {
                if (req.method === 'GET') {
                    await getIdea(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'PATCH') {
                    await updateIdea(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'DELETE') {
                    await deleteIdea(req, res, projectId, resourceId);
                    return true;
                }
            }

            if (resource === MILESTONES) {
                if (req.method === 'GET') {
                    await getMilestone(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'PATCH') {
                    await updateMilestone(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'DELETE') {
                    await deleteMilestone(req, res, projectId, resourceId);
                    return true;
                }
            }

            if (resource === SPRINTS) {
                if (req.method === 'GET') {
                    await getSprint(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'PATCH') {
                    await updateSprint(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'DELETE') {
                    await deleteSprint(req, res, projectId, resourceId);
                    return true;
                }
            }

            if (resource === CATEGORIES) {
                if (req.method === 'GET') {
                    await getCategory(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'PATCH') {
                    await updateCategory(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'DELETE') {
                    await deleteCategory(req, res, projectId, resourceId);
                    return true;
                }
            }

            if (resource === MINDMAPS) {
                if (req.method === 'GET') {
                    await getMindmap(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'PATCH') {
                    await updateMindmap(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'DELETE') {
                    await deleteMindmap(req, res, projectId, resourceId);
                    return true;
                }
            }

            if (resource === 'project-groups') {
                if (req.method === 'GET') {
                    await getProjectGroup(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'PATCH') {
                    await updateProjectGroup(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'DELETE') {
                    await deleteProjectGroup(req, res, projectId, resourceId);
                    return true;
                }
            }

            if (resource === COMMENTS) {
                if (req.method === 'GET') {
                    await getComment(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'PATCH') {
                    await updateComment(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'DELETE') {
                    await deleteComment(req, res, projectId, resourceId);
                    return true;
                }
            }
        }

        if (segments.length === 6 && segments[3] === TASKS && segments[5] === SUBTASKS) {
            const taskId = segments[4];

            if (req.method === 'GET') {
                await listSubtasks(req, res, projectId, taskId);
                return true;
            }
            if (req.method === 'POST') {
                await createSubtask(req, res, projectId, taskId);
                return true;
            }
        }

        if (segments.length === 7 && segments[3] === TASKS && segments[5] === SUBTASKS) {
            const taskId = segments[4];
            const subtaskId = segments[6];

            if (req.method === 'GET') {
                await getSubtask(req, res, projectId, taskId, subtaskId);
                return true;
            }
            if (req.method === 'PATCH') {
                await updateSubtask(req, res, projectId, taskId, subtaskId);
                return true;
            }
            if (req.method === 'DELETE') {
                await deleteSubtask(req, res, projectId, taskId, subtaskId);
                return true;
            }
        }
    }

    res.status(404).json({
        success: false,
        error: 'ProjectFlow endpoint not found.',
        path,
        supported: PROJECTFLOW_SUPPORTED_ENDPOINTS
    });

    return true;
};
