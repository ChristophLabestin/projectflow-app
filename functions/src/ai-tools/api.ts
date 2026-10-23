/**
 * In-process access to the ProjectFlow REST API (`handleProjectflowApiRoute`) for AI tool layers.
 * MCP (API/OAuth tokens) and the in-app assistant (Firebase ID token + tenantId) both go through here,
 * so authentication, permissions, project scope, validation and activity logging match the API exactly.
 */
import { handleProjectflowApiRoute } from '../projectflow-api';

export type ApiResult = { status: number; payload: any };

/** Run a REST API route in-process with the caller's token and capture the JSON response. */
export const callApi = async (
    token: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    options: { body?: Record<string, unknown>; query?: Record<string, string>; tenantId?: string } = {}
): Promise<ApiResult> => {
    let status = 200;
    let payload: any = null;
    const req = {
        method,
        path: `/projectflow${path}`,
        headers: { authorization: `Bearer ${token}` },
        // Firebase ID tokens carry no workspace: the API reads tenantId from query/body.
        body: options.tenantId ? { ...(options.body || {}), tenantId: options.tenantId } : options.body || {},
        query: options.tenantId ? { ...(options.query || {}), tenantId: options.tenantId } : options.query || {}
    };
    const res: any = {
        headersSent: false,
        statusCode: 200,
        status(code: number) { status = code; this.statusCode = code; return this; },
        json(value: unknown) { payload = value; this.headersSent = true; return this; },
        send(value: unknown) { payload = value; this.headersSent = true; return this; },
        end() { this.headersSent = true; return this; },
        set() { return this; },
        setHeader() { return this; }
    };
    const handled = await handleProjectflowApiRoute(req, res, `/projectflow${path}`);
    if (!handled) return { status: 404, payload: { success: false, error: `No API route for ${method} ${path}` } };
    return { status, payload };
};

/** Drop undefined values so PATCH bodies only contain what the agent actually set. */
export const compact = <T extends Record<string, unknown>>(value: T): Partial<T> =>
    Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

export const summarizeTask = (task: any) => compact({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate || undefined,
    startDate: task.startDate || undefined,
    isCompleted: task.isCompleted || undefined,
    assigneeIds: Array.isArray(task.assigneeIds) && task.assigneeIds.length ? task.assigneeIds : undefined,
    initiativeId: task.initiativeId || undefined,
    externalKey: task.externalKey || undefined,
    updatedAt: task.updatedAt || undefined
});

export const summarizeProject = (project: any) => compact({
    id: project.id,
    title: project.title,
    status: project.status,
    priority: project.priority,
    dueDate: project.dueDate || undefined,
    description: typeof project.description === 'string' && project.description ? project.description.slice(0, 240) : undefined
});

export const summarizeInitiative = (initiative: any) => compact({
    id: initiative.id,
    title: initiative.title,
    status: initiative.status,
    priority: initiative.priority,
    health: initiative.health || undefined,
    startDate: initiative.startDate || undefined,
    dueDate: initiative.dueDate || undefined,
    externalKey: initiative.externalKey || undefined
});
