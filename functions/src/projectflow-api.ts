import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

import { getAuthToken, type ApiPermission, validateAPIToken } from './authUtils';
import { db } from './init';
import { sendPmCoreDeprecated } from './pmCore';

type ApiContext = {
    tenantId: string;
    tokenData: Record<string, any>;
    actorId: string;
    actorLabel: string;
};

const PROJECTS = 'projects';
const TASKS = 'tasks';
const INITIATIVES = 'initiatives';
const ACTIVITIES = 'activities';
const SUBTASKS = 'subtasks';
const ISSUES = 'issues';
const IDEAS = 'ideas';
const MILESTONES = 'milestones';
const SPRINTS = 'sprints';
const CATEGORIES = 'categories';
const PROJECT_GROUPS = 'project_groups';
const COMMENTS = 'comments';
const CODEX = 'codex';
const CODEX_SESSIONS = 'codex_sessions';
const CODEX_CHECKPOINTS = 'checkpoints';
const CODEX_FOLLOWUPS = 'codex_followups';

const PROJECT_WRITE_FIELDS = [
    'title',
    'description',
    'status',
    'projectState',
    'projectType',
    'projectCategory',
    'templateId',
    'companyProjectId',
    'companyProjectRole',
    'operatingMode',
    'dateConfidence',
    'brief',
    'operatingModel',
    'riskRegister',
    'healthSnapshot',
    'startupProfile',
    'startupReadiness',
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
    'initiativeId',
    'legacyInitiativeRoot',
    'externalKey',
    'source',
    'templateId',
    'templateTrack',
    'templateSeedId',
    'sourceReferences'
] as const;

const INITIATIVE_WRITE_FIELDS = [
    'title',
    'description',
    'status',
    'priority',
    'dueDate',
    'startDate',
    'assigneeIds',
    'assignedGroupIds',
    'originIdeaId',
    'externalKey',
    'source',
    'templateId',
    'templateTrack',
    'templateSeedId',
    'sourceReferences',
    'successMetric',
    'outcome',
    'health',
    'completedAt'
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

const getRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    return value as Record<string, unknown>;
};

const getCommandList = (value: unknown): Array<string | Record<string, unknown>> => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => {
            if (typeof item === 'string') {
                return item.trim();
            }
            if (item && typeof item === 'object' && !Array.isArray(item)) {
                return item as Record<string, unknown>;
            }
            return '';
        })
        .filter((item): item is string | Record<string, unknown> => (
            typeof item === 'string' ? item.length > 0 : true
        ));
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

const initiativeCollectionRef = (tenantId: string, projectId: string) =>
    projectRef(tenantId, projectId).collection(INITIATIVES);

const projectCollectionRef = (tenantId: string, projectId: string, collectionName: string) =>
    projectRef(tenantId, projectId).collection(collectionName);

const projectActivityRef = (tenantId: string, projectId: string) =>
    projectRef(tenantId, projectId).collection(ACTIVITIES);

const codexSessionCollectionRef = (tenantId: string, projectId: string) =>
    projectRef(tenantId, projectId).collection(CODEX_SESSIONS);

const codexFollowupCollectionRef = (tenantId: string, projectId: string) =>
    projectRef(tenantId, projectId).collection(CODEX_FOLLOWUPS);

const writeProjectActivity = async (
    tenantId: string,
    projectId: string,
    action: string,
    target: string,
    relatedId: string | null,
    actorId: string,
    actorLabel: string,
    type = 'status',
    details?: string
) => {
    await projectActivityRef(tenantId, projectId).add(compactObject({
        projectId,
        tenantId,
        ownerId: actorId,
        user: actorLabel,
        action,
        target,
        type,
        relatedId,
        details,
        actorType: 'api-token',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }));
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
        projectType: getString(body.projectType),
        projectCategory: getString(body.projectCategory),
        templateId: getString(body.templateId),
        companyProjectId: getString(body.companyProjectId),
        companyProjectRole: getString(body.companyProjectRole),
        operatingMode: getString(body.operatingMode),
        dateConfidence: getString(body.dateConfidence),
        brief: body.brief && typeof body.brief === 'object' ? body.brief : undefined,
        operatingModel: body.operatingModel && typeof body.operatingModel === 'object' ? body.operatingModel : undefined,
        riskRegister: Array.isArray(body.riskRegister) ? body.riskRegister : [],
        healthSnapshot: body.healthSnapshot && typeof body.healthSnapshot === 'object' ? body.healthSnapshot : undefined,
        startupProfile: body.startupProfile && typeof body.startupProfile === 'object' ? body.startupProfile : undefined,
        startupReadiness: body.startupReadiness && typeof body.startupReadiness === 'object' ? body.startupReadiness : undefined,
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
        `Created project "${title}" via API token ${context.actorLabel}`,
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
        `Updated project "${projectSnapshot.data()?.title || projectId}" via API token ${context.actorLabel}`,
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
        `Deleted project "${projectSnapshot.data()?.title || projectId}" via API token ${context.actorLabel}`,
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
        initiativeId: getString(body.initiativeId),
        legacyInitiativeRoot: Boolean(body.legacyInitiativeRoot),
        externalKey: getString(body.externalKey),
        isCompleted: Boolean(body.isCompleted),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const created = await taskCollectionRef(context.tenantId, projectId).add(payload);

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Created task "${title}" via API token ${context.actorLabel}`,
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
        `Updated task "${latestTaskTitle || taskId}" via API token ${context.actorLabel}`,
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
        `Deleted task "${taskTitle || taskId}" via API token ${context.actorLabel}`,
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
            `Synced task "${refreshedTitle || refreshed.id}" via external key ${externalKey}`,
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
        initiativeId: getString(body.initiativeId),
        legacyInitiativeRoot: Boolean(body.legacyInitiativeRoot),
        externalKey,
        isCompleted: Boolean(body.isCompleted),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const created = await taskCollectionRef(context.tenantId, projectId).add(payload);

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Upsert-created task "${title}" via external key ${externalKey}`,
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

const listInitiatives = async (req: any, res: any, projectId: string) => {
    const context = await authRequest(req, res, 'initiatives:read', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const snapshot = await initiativeCollectionRef(context.tenantId, projectId)
        .orderBy('updatedAt', 'desc')
        .get();

    const initiatives = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...serializeValue(docSnap.data())
    }));

    res.status(200).json({ success: true, initiatives });
};

const createInitiative = async (req: any, res: any, projectId: string) => {
    const context = await authRequest(req, res, 'initiatives:write', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
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
        status: getString(body.status) || 'Planning',
        priority: getString(body.priority) || 'Medium',
        dueDate: getString(body.dueDate),
        startDate: getString(body.startDate),
        assigneeIds: getStringArray(body.assigneeIds),
        assignedGroupIds: getStringArray(body.assignedGroupIds),
        originIdeaId: getString(body.originIdeaId),
        externalKey: getString(body.externalKey),
        successMetric: getString(body.successMetric),
        outcome: getString(body.outcome),
        health: getString(body.health),
        completedAt: body.completedAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const created = await initiativeCollectionRef(context.tenantId, projectId).add(payload);
    const createdSnapshot = await created.get();

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Created initiative "${title}" via API token ${context.actorLabel}`,
        'Initiatives',
        created.id,
        context.actorId,
        context.actorLabel
    );

    res.status(201).json({
        success: true,
        initiative: {
            id: created.id,
            ...serializeValue(createdSnapshot.data())
        }
    });
};

const getInitiative = async (req: any, res: any, projectId: string, initiativeId: string) => {
    const context = await authRequest(req, res, 'initiatives:read', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const initiativeSnapshot = await initiativeCollectionRef(context.tenantId, projectId).doc(initiativeId).get();
    if (!initiativeSnapshot.exists) {
        notFound(res, 'Initiative not found.');
        return;
    }

    res.status(200).json({
        success: true,
        initiative: {
            id: initiativeSnapshot.id,
            ...serializeValue(initiativeSnapshot.data())
        }
    });
};

const updateInitiative = async (req: any, res: any, projectId: string, initiativeId: string) => {
    const context = await authRequest(req, res, 'initiatives:write', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const initiativeRef = initiativeCollectionRef(context.tenantId, projectId).doc(initiativeId);
    const initiativeSnapshot = await initiativeRef.get();
    if (!initiativeSnapshot.exists) {
        notFound(res, 'Initiative not found.');
        return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const updates = extractWritableFields(body, INITIATIVE_WRITE_FIELDS);
    if (Object.keys(updates).length === 0) {
        badRequest(res, 'No writable fields provided for update.');
        return;
    }

    await initiativeRef.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const latestSnapshot = await initiativeRef.get();
    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Updated initiative "${getString(latestSnapshot.data()?.title) || initiativeId}" via API token ${context.actorLabel}`,
        'Initiatives',
        initiativeId,
        context.actorId,
        context.actorLabel
    );

    res.status(200).json({
        success: true,
        initiative: {
            id: initiativeId,
            ...serializeValue(latestSnapshot.data())
        }
    });
};

const deleteInitiative = async (req: any, res: any, projectId: string, initiativeId: string) => {
    const context = await authRequest(req, res, 'initiatives:delete', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const initiativeRef = initiativeCollectionRef(context.tenantId, projectId).doc(initiativeId);
    const initiativeSnapshot = await initiativeRef.get();
    if (!initiativeSnapshot.exists) {
        notFound(res, 'Initiative not found.');
        return;
    }

    const linkedTasks = await taskCollectionRef(context.tenantId, projectId)
        .where('initiativeId', '==', initiativeId)
        .get();

    await Promise.all(linkedTasks.docs.map((docSnap) => docSnap.ref.update({
        initiativeId: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })));

    const initiativeTitle = getString(initiativeSnapshot.data()?.title);
    await initiativeRef.delete();

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Deleted initiative "${initiativeTitle || initiativeId}" via API token ${context.actorLabel}`,
        'Initiatives',
        initiativeId,
        context.actorId,
        context.actorLabel
    );

    res.status(200).json({
        success: true,
        deletedInitiativeId: initiativeId
    });
};

const upsertInitiativeByExternalKey = async (req: any, res: any, projectId: string) => {
    const context = await authRequest(req, res, 'initiatives:write', projectId);
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
    const matches = await initiativeCollectionRef(context.tenantId, projectId)
        .where('externalKey', '==', externalKey)
        .limit(1)
        .get();

    if (!matches.empty) {
        const initiativeSnapshot = matches.docs[0];
        const updates = extractWritableFields(body, INITIATIVE_WRITE_FIELDS);
        const existingDescription = getString(initiativeSnapshot.data().description);

        if (appendSummary) {
            updates.description = existingDescription
                ? `${existingDescription}\n\n${appendSummary}`
                : appendSummary;
        }

        updates.externalKey = externalKey;
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        await initiativeSnapshot.ref.update(updates);
        const refreshed = await initiativeSnapshot.ref.get();

        await writeProjectActivity(
            context.tenantId,
            projectId,
            `Synced initiative "${getString(refreshed.data()?.title) || refreshed.id}" via external key ${externalKey}`,
            'Initiatives',
            refreshed.id,
            context.actorId,
            context.actorLabel
        );

        res.status(200).json({
            success: true,
            operation: 'updated',
            initiative: {
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
        status: getString(body.status) || 'Planning',
        priority: getString(body.priority) || 'Medium',
        dueDate: getString(body.dueDate),
        startDate: getString(body.startDate),
        assigneeIds: getStringArray(body.assigneeIds),
        assignedGroupIds: getStringArray(body.assignedGroupIds),
        originIdeaId: getString(body.originIdeaId),
        externalKey,
        successMetric: getString(body.successMetric),
        outcome: getString(body.outcome),
        health: getString(body.health),
        completedAt: body.completedAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const created = await initiativeCollectionRef(context.tenantId, projectId).add(payload);
    const createdSnapshot = await created.get();

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Upsert-created initiative "${title}" via external key ${externalKey}`,
        'Initiatives',
        created.id,
        context.actorId,
        context.actorLabel
    );

    res.status(201).json({
        success: true,
        operation: 'created',
        initiative: {
            id: created.id,
            ...serializeValue(createdSnapshot.data())
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
const createIssue = async (req: any, res: any, projectId: string) => {
    if (sendPmCoreDeprecated(res, 'issues')) return;
    return createProjectCollectionItem(req, res, projectId, ISSUES, 'issue', 'title', 'issue', 'Issues');
};
const getIssue = async (req: any, res: any, projectId: string, issueId: string) =>
    getProjectCollectionItem(req, res, projectId, issueId, ISSUES, 'issue', 'Issue');
const updateIssue = async (req: any, res: any, projectId: string, issueId: string) => {
    if (sendPmCoreDeprecated(res, 'issues')) return;
    return updateProjectCollectionItem(req, res, projectId, issueId, ISSUES, 'issue', 'Issue', 'Issues');
};
const deleteIssue = async (req: any, res: any, projectId: string, issueId: string) => {
    if (sendPmCoreDeprecated(res, 'issues')) return;
    return deleteProjectCollectionItem(req, res, projectId, issueId, ISSUES, 'Issue', 'deletedIssueId', 'Issues');
};

const listIdeas = async (req: any, res: any, projectId: string) =>
    listProjectCollectionItems(req, res, projectId, IDEAS, 'ideas');
const createIdea = async (req: any, res: any, projectId: string) => {
    if (sendPmCoreDeprecated(res, 'ideas')) return;
    return createProjectCollectionItem(req, res, projectId, IDEAS, 'idea', 'title', 'idea', 'Ideas');
};
const getIdea = async (req: any, res: any, projectId: string, ideaId: string) =>
    getProjectCollectionItem(req, res, projectId, ideaId, IDEAS, 'idea', 'Idea');
const updateIdea = async (req: any, res: any, projectId: string, ideaId: string) => {
    if (sendPmCoreDeprecated(res, 'ideas')) return;
    return updateProjectCollectionItem(req, res, projectId, ideaId, IDEAS, 'idea', 'Idea', 'Ideas');
};
const deleteIdea = async (req: any, res: any, projectId: string, ideaId: string) => {
    if (sendPmCoreDeprecated(res, 'ideas')) return;
    return deleteProjectCollectionItem(req, res, projectId, ideaId, IDEAS, 'Idea', 'deletedIdeaId', 'Ideas');
};

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

const normalizeCodexEntity = (value: unknown): 'task' | 'initiative' => (
    getString(value).toLowerCase() === 'initiative' ? 'initiative' : 'task'
);

const normalizeCodexSessionStatus = (value: unknown): 'running' | 'completed' | 'blocked' | 'partial' => {
    const status = getString(value).toLowerCase();
    if (['done', 'success', 'complete', 'completed'].includes(status)) {
        return 'completed';
    }
    if (['blocked', 'failure', 'failed'].includes(status)) {
        return 'blocked';
    }
    if (['partial', 'incomplete'].includes(status)) {
        return 'partial';
    }
    return 'running';
};

const codexExternalKeyForBody = (body: Record<string, unknown>, projectId: string): string => {
    const explicit =
        getString(body.externalKey) ||
        getString(body.sessionKey) ||
        getString(body.codexExternalKey);

    if (explicit) {
        return explicit;
    }

    const source = [
        projectId,
        getString(body.repoPath),
        getString(body.branch),
        getString(body.request) || getString(body.title) || getString(body.summary)
    ].join('|');

    return `codex:${crypto.createHash('sha256').update(source).digest('hex').slice(0, 24)}`;
};

const summarizeCodexCheckpoint = (body: Record<string, unknown>) =>
    getString(body.summary) ||
    getString(body.checkpointSummary) ||
    getString(body.appendSummary) ||
    getString(body.notes);

const upsertCodexLinkedEntity = async (
    context: ApiContext,
    projectId: string,
    body: Record<string, unknown>,
    externalKey: string,
    entity: 'task' | 'initiative'
) => {
    const title =
        getString(body.title) ||
        getString(body.request) ||
        `Codex session ${externalKey.slice(0, 8)}`;
    const description = getString(body.description) || getString(body.summary) || getString(body.request);
    const priority = getString(body.priority) || 'Medium';

    if (entity === 'initiative') {
        const matches = await initiativeCollectionRef(context.tenantId, projectId)
            .where('externalKey', '==', externalKey)
            .limit(1)
            .get();

        const updates = compactObject({
            title,
            description: description || undefined,
            status: getString(body.status) || 'In Progress',
            priority,
            dueDate: getString(body.dueDate),
            startDate: getString(body.startDate),
            externalKey,
            codexManaged: true,
            codexSessionExternalKey: externalKey,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (!matches.empty) {
            const match = matches.docs[0];
            await match.ref.update(updates);
            const snapshot = await match.ref.get();
            return {
                type: entity,
                operation: 'updated',
                id: snapshot.id,
                data: serializeValue(snapshot.data())
            };
        }

        const created = await initiativeCollectionRef(context.tenantId, projectId).add({
            ...updates,
            projectId,
            tenantId: context.tenantId,
            ownerId: context.actorId,
            createdBy: context.actorId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const snapshot = await created.get();
        return {
            type: entity,
            operation: 'created',
            id: created.id,
            data: serializeValue(snapshot.data())
        };
    }

    const matches = await taskCollectionRef(context.tenantId, projectId)
        .where('externalKey', '==', externalKey)
        .limit(1)
        .get();

    const updates = compactObject({
        title,
        description: description || undefined,
        status: getString(body.status) || 'In Progress',
        priority,
        dueDate: getString(body.dueDate),
        startDate: getString(body.startDate),
        assigneeId: getString(body.assigneeId) || null,
        assigneeIds: getStringArray(body.assigneeIds),
        assignedGroupIds: getStringArray(body.assignedGroupIds),
        initiativeId: getString(body.initiativeId),
        externalKey,
        isCompleted: Boolean(body.isCompleted),
        codexManaged: true,
        codexSessionExternalKey: externalKey,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (!matches.empty) {
        const match = matches.docs[0];
        await match.ref.update(updates);
        const snapshot = await match.ref.get();
        await syncProjectProgress(context.tenantId, projectId);
        return {
            type: entity,
            operation: 'updated',
            id: snapshot.id,
            data: serializeValue(snapshot.data())
        };
    }

    const created = await taskCollectionRef(context.tenantId, projectId).add({
        ...updates,
        projectId,
        tenantId: context.tenantId,
        ownerId: context.actorId,
        createdBy: context.actorId,
        category: getStringArray(body.category).length > 0 ? getStringArray(body.category) : ['Codex'],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const snapshot = await created.get();
    await syncProjectProgress(context.tenantId, projectId);

    return {
        type: entity,
        operation: 'created',
        id: created.id,
        data: serializeValue(snapshot.data())
    };
};

const writeCodexCheckpoint = async (
    context: ApiContext,
    projectId: string,
    sessionRef: admin.firestore.DocumentReference,
    phase: string,
    body: Record<string, unknown>
) => {
    const filesTouched = getStringArray(body.filesTouched);
    const validationStatus = getString(body.validationStatus);
    const summary = summarizeCodexCheckpoint(body);
    const status = getString(body.status);
    const commands = getCommandList(body.commands);

    const checkpointPayload = compactObject({
        projectId,
        tenantId: context.tenantId,
        phase,
        summary,
        status,
        validationStatus,
        filesTouched,
        commands,
        metadata: getRecord(body.metadata),
        createdBy: context.actorId,
        actorLabel: context.actorLabel,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const checkpointRef = await sessionRef.collection(CODEX_CHECKPOINTS).add(checkpointPayload);

    const sessionUpdates: Record<string, unknown> = compactObject({
        phase,
        status: normalizeCodexSessionStatus(status),
        lastCheckpointId: checkpointRef.id,
        lastCheckpointSummary: summary,
        lastValidationStatus: validationStatus,
        lastCheckpointAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (filesTouched.length > 0) {
        sessionUpdates.filesTouched = admin.firestore.FieldValue.arrayUnion(...filesTouched);
    }

    await sessionRef.set(sessionUpdates, { merge: true });

    return {
        id: checkpointRef.id,
        ...serializeValue(checkpointPayload)
    };
};

const resolveCodexSession = async (
    context: ApiContext,
    projectId: string,
    body: Record<string, unknown>,
    explicitSessionId?: string
) => {
    const requestedSessionId = explicitSessionId || getString(body.sessionId);
    if (requestedSessionId) {
        const sessionRef = codexSessionCollectionRef(context.tenantId, projectId).doc(requestedSessionId);
        const snapshot = await sessionRef.get();
        if (snapshot.exists) {
            return { ref: sessionRef, snapshot };
        }
    }

    const externalKey = codexExternalKeyForBody(body, projectId);
    const matches = await codexSessionCollectionRef(context.tenantId, projectId)
        .where('externalKey', '==', externalKey)
        .limit(1)
        .get();

    if (matches.empty) {
        return null;
    }

    return {
        ref: matches.docs[0].ref,
        snapshot: matches.docs[0]
    };
};

const createCodexFollowups = async (
    context: ApiContext,
    projectId: string,
    followUpsValue: unknown,
    sessionId?: string,
    sessionExternalKey?: string,
    inheritedInitiativeId?: string
) => {
    if (!Array.isArray(followUpsValue)) {
        return [];
    }

    const followUps = followUpsValue.slice(0, 50);
    const results = [];

    for (let index = 0; index < followUps.length; index += 1) {
        const followUp = getRecord(followUps[index]);
        if (!followUp) {
            continue;
        }

        const title = getString(followUp.title);
        if (!title) {
            continue;
        }

        const externalKey = getString(followUp.externalKey) || [
            sessionExternalKey || `codex:${projectId}`,
            'followup',
            index,
            crypto.createHash('sha256').update(title).digest('hex').slice(0, 12)
        ].join(':');

        const taskMatches = await taskCollectionRef(context.tenantId, projectId)
            .where('externalKey', '==', externalKey)
            .limit(1)
            .get();

        const taskPayload = compactObject({
            projectId,
            tenantId: context.tenantId,
            ownerId: context.actorId,
            createdBy: context.actorId,
            title,
            description: getString(followUp.description),
            status: getString(followUp.status) || 'Open',
            priority: getString(followUp.priority) || 'Medium',
            dueDate: getString(followUp.dueDate),
            startDate: getString(followUp.startDate),
            assigneeId: getString(followUp.assigneeId) || null,
            assigneeIds: getStringArray(followUp.assigneeIds),
            assignedGroupIds: getStringArray(followUp.assignedGroupIds),
            initiativeId: getString(followUp.initiativeId) || inheritedInitiativeId,
            category: getStringArray(followUp.category).length > 0 ? getStringArray(followUp.category) : ['Codex'],
            externalKey,
            isCompleted: Boolean(followUp.isCompleted),
            source: 'codex_followup',
            codexSessionId: sessionId,
            codexSessionExternalKey: sessionExternalKey,
            filesTouched: getStringArray(followUp.filesTouched),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        let taskId: string;
        let taskOperation: 'created' | 'updated';
        if (!taskMatches.empty) {
            const taskSnapshot = taskMatches.docs[0];
            await taskSnapshot.ref.update(taskPayload);
            taskId = taskSnapshot.id;
            taskOperation = 'updated';
        } else {
            const createdTask = await taskCollectionRef(context.tenantId, projectId).add({
                ...taskPayload,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            taskId = createdTask.id;
            taskOperation = 'created';
        }

        const followupPayload = compactObject({
            projectId,
            tenantId: context.tenantId,
            title,
            description: getString(followUp.description),
            status: getString(followUp.inboxStatus) || 'open',
            priority: getString(followUp.priority) || 'Medium',
            taskId,
            sessionId,
            sessionExternalKey,
            externalKey,
            source: 'codex',
            filesTouched: getStringArray(followUp.filesTouched),
            createdBy: context.actorId,
            actorLabel: context.actorLabel,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const followupMatches = await codexFollowupCollectionRef(context.tenantId, projectId)
            .where('externalKey', '==', externalKey)
            .limit(1)
            .get();

        let followupId: string;
        if (!followupMatches.empty) {
            const followupSnapshot = followupMatches.docs[0];
            await followupSnapshot.ref.update(followupPayload);
            followupId = followupSnapshot.id;
        } else {
            const createdFollowup = await codexFollowupCollectionRef(context.tenantId, projectId).add({
                ...followupPayload,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            followupId = createdFollowup.id;
        }

        results.push({
            id: followupId,
            taskId,
            taskOperation,
            title,
            externalKey
        });
    }

    if (results.length > 0) {
        await syncProjectProgress(context.tenantId, projectId);
    }

    return results;
};

const listCodexSessions = async (req: any, res: any, projectId: string) => {
    const context = await authRequest(req, res, 'tasks:read', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const snapshot = await codexSessionCollectionRef(context.tenantId, projectId)
        .orderBy('updatedAt', 'desc')
        .limit(100)
        .get();

    const sessions = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...serializeValue(docSnap.data())
    }));

    res.status(200).json({ success: true, sessions });
};

const listCodexFollowups = async (req: any, res: any, projectId: string) => {
    const context = await authRequest(req, res, 'tasks:read', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const snapshot = await codexFollowupCollectionRef(context.tenantId, projectId)
        .orderBy('updatedAt', 'desc')
        .limit(100)
        .get();

    const followups = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...serializeValue(docSnap.data())
    }));

    res.status(200).json({ success: true, followups });
};

const startCodexSession = async (req: any, res: any, projectId: string) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const entity = normalizeCodexEntity(body.entity);
    const context = await authRequest(req, res, entity === 'initiative' ? 'initiatives:write' : 'tasks:write', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const externalKey = codexExternalKeyForBody(body, projectId);
    const linkedEntity = await upsertCodexLinkedEntity(context, projectId, body, externalKey, entity);
    const title = getString(body.title) || getString(body.request) || `Codex session ${externalKey.slice(0, 8)}`;
    const summary = getString(body.summary) || getString(body.request) || getString(body.description);
    const existing = await codexSessionCollectionRef(context.tenantId, projectId)
        .where('externalKey', '==', externalKey)
        .limit(1)
        .get();

    const linkedTaskId = linkedEntity.type === 'task' ? linkedEntity.id : getString(body.taskId);
    const linkedInitiativeId = linkedEntity.type === 'initiative' ? linkedEntity.id : getString(body.initiativeId);
    const payload = compactObject({
        projectId,
        tenantId: context.tenantId,
        externalKey,
        title,
        summary,
        status: 'running',
        phase: getString(body.phase) || 'start',
        entity,
        linkedEntityType: linkedEntity.type,
        linkedEntityId: linkedEntity.id,
        taskId: linkedTaskId,
        initiativeId: linkedInitiativeId,
        repoPath: getString(body.repoPath),
        repoName: getString(body.repoName),
        branch: getString(body.branch),
        commitSha: getString(body.commitSha) || getString(body.commit),
        filesTouched: getStringArray(body.filesTouched),
        validationStatus: getString(body.validationStatus),
        actorLabel: context.actorLabel,
        createdBy: context.actorId,
        ownerId: context.actorId,
        metadata: getRecord(body.metadata),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    let sessionRef: admin.firestore.DocumentReference;
    let operation: 'created' | 'updated';
    if (!existing.empty) {
        sessionRef = existing.docs[0].ref;
        await sessionRef.update(payload);
        operation = 'updated';
    } else {
        sessionRef = await codexSessionCollectionRef(context.tenantId, projectId).add({
            ...payload,
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        operation = 'created';
    }

    const checkpoint = await writeCodexCheckpoint(
        context,
        projectId,
        sessionRef,
        getString(body.phase) || 'start',
        {
            ...body,
            status: 'running',
            summary: summary || `Started ${title}`
        }
    );

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Started Codex session "${title}"`,
        'Codex',
        sessionRef.id,
        context.actorId,
        context.actorLabel,
        CODEX,
        summary
    );

    const sessionSnapshot = await sessionRef.get();
    res.status(operation === 'created' ? 201 : 200).json({
        success: true,
        operation,
        linkedEntity,
        checkpoint,
        session: {
            id: sessionRef.id,
            ...serializeValue(sessionSnapshot.data())
        }
    });
};

const checkpointCodexSession = async (req: any, res: any, projectId: string, sessionId?: string) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const context = await authRequest(req, res, 'tasks:write', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const resolvedSession = await resolveCodexSession(context, projectId, body, sessionId);
    if (!resolvedSession) {
        notFound(res, 'Codex session not found.');
        return;
    }

    const phase = getString(body.phase) || 'checkpoint';
    const checkpoint = await writeCodexCheckpoint(context, projectId, resolvedSession.ref, phase, body);
    const sessionTitle = getString(resolvedSession.snapshot.data()?.title) || resolvedSession.ref.id;

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Recorded Codex checkpoint "${phase}"`,
        'Codex',
        resolvedSession.ref.id,
        context.actorId,
        context.actorLabel,
        CODEX,
        summarizeCodexCheckpoint(body) || sessionTitle
    );

    const sessionSnapshot = await resolvedSession.ref.get();
    res.status(200).json({
        success: true,
        checkpoint,
        session: {
            id: resolvedSession.ref.id,
            ...serializeValue(sessionSnapshot.data())
        }
    });
};

const finishCodexSession = async (req: any, res: any, projectId: string, sessionId?: string) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const context = await authRequest(req, res, 'tasks:write', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const resolvedSession = await resolveCodexSession(context, projectId, body, sessionId);
    if (!resolvedSession) {
        notFound(res, 'Codex session not found.');
        return;
    }

    const sessionData = resolvedSession.snapshot.data() || {};
    const finalStatus = normalizeCodexSessionStatus(body.status || 'completed');
    const phase = getString(body.phase) || 'finish';
    const checkpoint = await writeCodexCheckpoint(context, projectId, resolvedSession.ref, phase, {
        ...body,
        status: finalStatus
    });

    const sessionUpdates: Record<string, unknown> = {
        status: finalStatus,
        phase,
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (getString(body.commitSha) || getString(body.commit)) {
        sessionUpdates.commitSha = getString(body.commitSha) || getString(body.commit);
    }

    await resolvedSession.ref.set(sessionUpdates, { merge: true });

    const taskId = getString(sessionData.taskId);
    const initiativeId = getString(sessionData.initiativeId);
    if (taskId) {
        const taskUpdates: Record<string, unknown> = {
            status: finalStatus === 'completed' ? 'Done' : finalStatus === 'blocked' ? 'Blocked' : 'Review',
            isCompleted: finalStatus === 'completed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        if (finalStatus === 'completed') {
            taskUpdates.completedAt = admin.firestore.FieldValue.serverTimestamp();
            taskUpdates.completedBy = context.actorId;
        }
        await taskCollectionRef(context.tenantId, projectId).doc(taskId).set(taskUpdates, { merge: true });
        await syncProjectProgress(context.tenantId, projectId);
    }

    if (initiativeId) {
        await initiativeCollectionRef(context.tenantId, projectId).doc(initiativeId).set({
            status: finalStatus === 'completed' ? 'Done' : finalStatus === 'blocked' ? 'Blocked' : 'In Progress',
            completedAt: finalStatus === 'completed' ? admin.firestore.FieldValue.serverTimestamp() : admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    const followups = await createCodexFollowups(
        context,
        projectId,
        body.followUps,
        resolvedSession.ref.id,
        getString(sessionData.externalKey),
        initiativeId
    );

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Finished Codex session as ${finalStatus}`,
        'Codex',
        resolvedSession.ref.id,
        context.actorId,
        context.actorLabel,
        CODEX,
        summarizeCodexCheckpoint(body)
    );

    const sessionSnapshot = await resolvedSession.ref.get();
    res.status(200).json({
        success: true,
        checkpoint,
        followups,
        session: {
            id: resolvedSession.ref.id,
            ...serializeValue(sessionSnapshot.data())
        }
    });
};

const bulkCreateCodexFollowups = async (req: any, res: any, projectId: string) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const context = await authRequest(req, res, 'tasks:write', projectId);
    if (!context) {
        return;
    }

    if (!(await ensureProjectExists(context.tenantId, projectId, res))) {
        return;
    }

    const followups = await createCodexFollowups(
        context,
        projectId,
        body.followUps,
        getString(body.sessionId),
        getString(body.sessionExternalKey) || getString(body.externalKey),
        getString(body.initiativeId)
    );

    await writeProjectActivity(
        context.tenantId,
        projectId,
        `Created ${followups.length} Codex follow-up${followups.length === 1 ? '' : 's'}`,
        'Codex',
        getString(body.sessionId) || null,
        context.actorId,
        context.actorLabel,
        CODEX,
        getString(body.summary)
    );

    res.status(201).json({
        success: true,
        followups
    });
};

const PROJECTFLOW_SUPPORTED_ENDPOINTS = [
    'GET /api/projectflow/projects',
    'POST /api/projectflow/projects',
    'GET /api/projectflow/projects/:projectId',
    'PATCH /api/projectflow/projects/:projectId',
    'DELETE /api/projectflow/projects/:projectId',
    'GET /api/projectflow/projects/:projectId/initiatives',
    'POST /api/projectflow/projects/:projectId/initiatives',
    'GET /api/projectflow/projects/:projectId/initiatives/:initiativeId',
    'PATCH /api/projectflow/projects/:projectId/initiatives/:initiativeId',
    'DELETE /api/projectflow/projects/:projectId/initiatives/:initiativeId',
    'POST /api/projectflow/projects/:projectId/initiatives/upsert-by-external-key',
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
    'GET /api/projectflow/projects/:projectId/activities',
    'GET /api/projectflow/projects/:projectId/codex/sessions',
    'POST /api/projectflow/projects/:projectId/codex/sessions/start',
    'POST /api/projectflow/projects/:projectId/codex/sessions/checkpoint',
    'POST /api/projectflow/projects/:projectId/codex/sessions/finish',
    'POST /api/projectflow/projects/:projectId/codex/sessions/:sessionId/checkpoint',
    'POST /api/projectflow/projects/:projectId/codex/sessions/:sessionId/finish',
    'GET /api/projectflow/projects/:projectId/codex/followups',
    'POST /api/projectflow/projects/:projectId/codex/followups/bulk-create'
];

export const handleProjectflowApiRoute = async (req: any, res: any, path: string): Promise<boolean> => {
    try {
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

        if (segments.length >= 5 && segments[3] === CODEX) {
            const codexResource = segments[4];

            if (codexResource === 'sessions') {
                if (segments.length === 5 && req.method === 'GET') {
                    await listCodexSessions(req, res, projectId);
                    return true;
                }

                if (segments.length === 6) {
                    const action = segments[5];
                    if (action === 'start' && req.method === 'POST') {
                        await startCodexSession(req, res, projectId);
                        return true;
                    }
                    if (action === 'checkpoint' && req.method === 'POST') {
                        await checkpointCodexSession(req, res, projectId);
                        return true;
                    }
                    if (action === 'finish' && req.method === 'POST') {
                        await finishCodexSession(req, res, projectId);
                        return true;
                    }
                }

                if (segments.length === 7) {
                    const sessionId = segments[5];
                    const action = segments[6];
                    if (action === 'checkpoint' && req.method === 'POST') {
                        await checkpointCodexSession(req, res, projectId, sessionId);
                        return true;
                    }
                    if (action === 'finish' && req.method === 'POST') {
                        await finishCodexSession(req, res, projectId, sessionId);
                        return true;
                    }
                }
            }

            if (codexResource === 'followups') {
                if (segments.length === 5 && req.method === 'GET') {
                    await listCodexFollowups(req, res, projectId);
                    return true;
                }

                if (segments.length === 6 && segments[5] === 'bulk-create' && req.method === 'POST') {
                    await bulkCreateCodexFollowups(req, res, projectId);
                    return true;
                }
            }
        }

        if (segments.length === 4) {
            const resource = segments[3];

            if (resource === INITIATIVES) {
                if (req.method === 'GET') {
                    await listInitiatives(req, res, projectId);
                    return true;
                }
                if (req.method === 'POST') {
                    await createInitiative(req, res, projectId);
                    return true;
                }
            }

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

            if (resource === INITIATIVES) {
                if (resourceId === 'upsert-by-external-key' && req.method === 'POST') {
                    await upsertInitiativeByExternalKey(req, res, projectId);
                    return true;
                }

                if (req.method === 'GET') {
                    await getInitiative(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'PATCH') {
                    await updateInitiative(req, res, projectId, resourceId);
                    return true;
                }
                if (req.method === 'DELETE') {
                    await deleteInitiative(req, res, projectId, resourceId);
                    return true;
                }
            }

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
    } catch (error: any) {
        console.error('ProjectFlow API route error:', {
            path,
            method: req.method,
            message: error?.message,
            stack: error?.stack
        });

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'ProjectFlow API request failed.',
                code: 'projectflow_internal_error',
                message: error?.message || 'Unknown error',
                path,
                method: req.method
            });
        }

        return true;
    }
};
