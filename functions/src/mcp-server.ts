/**
 * ProjectFlow MCP server (Model Context Protocol, Streamable HTTP, stateless).
 *
 * Claude Code, Codex and other MCP clients connect with a workspace API token:
 *   URL:    https://app.getprojectflow.com/mcp
 *   Header: Authorization: Bearer <api token>
 *
 * Every tool is a thin wrapper around the public ProjectFlow REST API
 * (`handleProjectflowApiRoute`), called in-process with the caller's token.
 * Authentication, token permissions, project scope, workspace isolation,
 * validation and activity logging therefore behave exactly like the API.
 */
import * as functions from 'firebase-functions/v1';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

import { db } from './init';
import { findApiToken } from './authUtils';
import { handleProjectflowApiRoute } from './projectflow-api';

const REGION = 'europe-west3';
const SERVER_VERSION = '1.0.0';

const TASK_STATUSES = ['Backlog', 'Todo', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done'] as const;
const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'] as const;
const INITIATIVE_STATUSES = ['Planning', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done'] as const;

const INSTRUCTIONS = `ProjectFlow is a project management workspace. This server acts with the permissions of the API token it was connected with.

Typical flow:
1. Call whoami to see the workspace, token permissions and (if any) the single project this token is limited to.
2. Call list_projects and pick a projectId.
3. Read with list_tasks / get_task / list_initiatives / list_milestones before changing things.
4. Prefer upsert_task with a stable externalKey when syncing work from code, issues or plans — repeated calls update instead of duplicating.
5. For coding sessions use codex_start_session → codex_checkpoint (optional, repeatable) → codex_finish_session; this links the work to a task and records it in the project's activity log.

Dates are ISO strings (YYYY-MM-DD). Task statuses: ${TASK_STATUSES.join(', ')}. Priorities: ${PRIORITIES.join(', ')}.`;

// ---------------------------------------------------------------------------
// In-process API calls
// ---------------------------------------------------------------------------

type ApiResult = { status: number; payload: any };

/** Run a REST API route in-process with the caller's token and capture the JSON response. */
const callApi = async (
    token: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    options: { body?: Record<string, unknown>; query?: Record<string, string> } = {}
): Promise<ApiResult> => {
    let status = 200;
    let payload: any = null;
    const req = {
        method,
        path: `/projectflow${path}`,
        headers: { authorization: `Bearer ${token}` },
        body: options.body || {},
        query: options.query || {}
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

const textResult = (value: unknown, isError = false) => ({
    content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {})
});

const apiError = (result: ApiResult) =>
    textResult(`ProjectFlow API error ${result.status}: ${result.payload?.error || 'Request failed.'}`, true);

/** Drop undefined values so PATCH bodies only contain what the agent actually set. */
const compact = <T extends Record<string, unknown>>(value: T): Partial<T> =>
    Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const summarizeTask = (task: any) => compact({
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

const summarizeProject = (project: any) => compact({
    id: project.id,
    title: project.title,
    status: project.status,
    priority: project.priority,
    dueDate: project.dueDate || undefined,
    description: typeof project.description === 'string' && project.description ? project.description.slice(0, 240) : undefined
});

const summarizeInitiative = (initiative: any) => compact({
    id: initiative.id,
    title: initiative.title,
    status: initiative.status,
    priority: initiative.priority,
    health: initiative.health || undefined,
    startDate: initiative.startDate || undefined,
    dueDate: initiative.dueDate || undefined,
    externalKey: initiative.externalKey || undefined
});

// ---------------------------------------------------------------------------
// Server definition
// ---------------------------------------------------------------------------

type TokenInfo = { tenantId: string; tokenData: any; permissions: Set<string> };

const buildServer = (token: string, info: TokenInfo) => {
    const server = new McpServer(
        { name: 'projectflow', title: 'ProjectFlow', version: SERVER_VERSION },
        { instructions: INSTRUCTIONS }
    );
    const can = (permission: string) => info.permissions.has(permission);
    const projectId = z.string().min(1).describe('Project id (from list_projects).');

    // --- Workspace -----------------------------------------------------------
    server.registerTool('whoami', {
        title: 'Who am I',
        description: 'Workspace, token name, permissions and project scope of the connected API token.',
        inputSchema: {},
        annotations: { readOnlyHint: true }
    }, async () => {
        const tenant = await db.doc(`tenants/${info.tenantId}`).get().catch(() => null);
        return textResult(compact({
            workspaceId: info.tenantId,
            workspaceName: tenant?.data()?.name,
            tokenName: info.tokenData.name,
            permissions: [...info.permissions].sort(),
            projectScope: info.tokenData.projectScope || undefined
        }));
    });

    // --- Projects ------------------------------------------------------------
    if (can('projects:read')) {
        server.registerTool('list_projects', {
            title: 'List projects',
            description: 'List projects in the workspace (id, title, status, priority, due date, short description).',
            inputSchema: {
                includeClosed: z.boolean().optional().describe('Include completed and canceled projects. Default false.')
            },
            annotations: { readOnlyHint: true }
        }, async ({ includeClosed }) => {
            const result = await callApi(token, 'GET', '/projects');
            if (result.status >= 400) return apiError(result);
            const projects = (result.payload.projects || [])
                .filter((project: any) => includeClosed || !['Completed', 'Canceled'].includes(project.status))
                .map(summarizeProject);
            return textResult({ count: projects.length, projects });
        });

        server.registerTool('get_project', {
            title: 'Get project',
            description: 'Full details of one project, including brief, modules and links.',
            inputSchema: { projectId },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}`);
            return result.status >= 400 ? apiError(result) : textResult(result.payload.project);
        });

        server.registerTool('list_milestones', {
            title: 'List milestones',
            description: 'Milestones of a project with due dates and status.',
            inputSchema: { projectId },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/milestones`);
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('list_comments', {
            title: 'List comments',
            description: 'Comments in a project, optionally only those on one task or initiative.',
            inputSchema: {
                projectId,
                targetId: z.string().optional().describe('Only comments on this task or initiative id.')
            },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/comments`);
            if (result.status >= 400) return apiError(result);
            const comments = (result.payload.comments || []).filter((comment: any) => !args.targetId || comment.targetId === args.targetId);
            return textResult({ count: comments.length, comments });
        });

        server.registerTool('list_activity', {
            title: 'List activity',
            description: 'Recent activity log of a project (newest first).',
            inputSchema: {
                projectId,
                limit: z.number().int().min(1).max(200).optional().describe('Max entries, default 30.')
            },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/activities`);
            if (result.status >= 400) return apiError(result);
            const activities = (result.payload.activities || []).slice(0, args.limit || 30);
            return textResult({ count: activities.length, activities });
        });
    }

    if (can('projects:write')) {
        server.registerTool('create_milestone', {
            title: 'Create milestone',
            description: 'Add a milestone to a project.',
            inputSchema: {
                projectId,
                title: z.string().min(1),
                dueDate: z.string().optional().describe('YYYY-MM-DD'),
                description: z.string().optional(),
                linkedInitiativeId: z.string().optional()
            }
        }, async ({ projectId: id, ...fields }) => {
            const result = await callApi(token, 'POST', `/projects/${id}/milestones`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('update_milestone', {
            title: 'Update milestone',
            description: 'Change a milestone (title, due date, status, description).',
            inputSchema: {
                projectId,
                milestoneId: z.string().min(1),
                title: z.string().optional(),
                dueDate: z.string().optional().describe('YYYY-MM-DD'),
                status: z.enum(['Pending', 'Achieved', 'Missed']).optional(),
                description: z.string().optional()
            }
        }, async ({ projectId: id, milestoneId, ...fields }) => {
            const result = await callApi(token, 'PATCH', `/projects/${id}/milestones/${milestoneId}`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('add_comment', {
            title: 'Add comment',
            description: 'Comment on a task or initiative.',
            inputSchema: {
                projectId,
                targetId: z.string().min(1).describe('Task or initiative id.'),
                targetType: z.enum(['task', 'initiative']),
                content: z.string().min(1)
            }
        }, async ({ projectId: id, ...fields }) => {
            const result = await callApi(token, 'POST', `/projects/${id}/comments`, { body: fields });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
    }

    // --- Tasks ---------------------------------------------------------------
    if (can('tasks:read')) {
        server.registerTool('list_tasks', {
            title: 'List tasks',
            description: 'Tasks of a project, filtered and trimmed to the essentials. Open tasks only unless includeDone is set.',
            inputSchema: {
                projectId,
                status: z.enum(TASK_STATUSES).optional(),
                includeDone: z.boolean().optional().describe('Include completed tasks. Default false.'),
                assigneeId: z.string().optional().describe('Only tasks assigned to this user id.'),
                initiativeId: z.string().optional(),
                search: z.string().optional().describe('Case-insensitive match on title and description.'),
                limit: z.number().int().min(1).max(500).optional().describe('Default 50.')
            },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/tasks`);
            if (result.status >= 400) return apiError(result);
            const search = args.search?.toLowerCase();
            const tasks = (result.payload.tasks || []).filter((task: any) => {
                const done = task.isCompleted || task.status === 'Done';
                if (!args.includeDone && done && args.status !== 'Done') return false;
                if (args.status && task.status !== args.status) return false;
                if (args.assigneeId && !(task.assigneeIds || []).includes(args.assigneeId) && task.assigneeId !== args.assigneeId) return false;
                if (args.initiativeId && task.initiativeId !== args.initiativeId) return false;
                if (search && !`${task.title || ''} ${task.description || ''}`.toLowerCase().includes(search)) return false;
                return true;
            });
            const limited = tasks.slice(0, args.limit || 50).map(summarizeTask);
            return textResult({ count: tasks.length, returned: limited.length, tasks: limited });
        });

        server.registerTool('get_task', {
            title: 'Get task',
            description: 'Full task details including description and subtasks.',
            inputSchema: { projectId, taskId: z.string().min(1) },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            const [task, subtasks] = await Promise.all([
                callApi(token, 'GET', `/projects/${args.projectId}/tasks/${args.taskId}`),
                callApi(token, 'GET', `/projects/${args.projectId}/tasks/${args.taskId}/subtasks`)
            ]);
            if (task.status >= 400) return apiError(task);
            return textResult({ ...task.payload.task, subtasks: subtasks.payload?.subtasks || [] });
        });

        server.registerTool('list_codex_sessions', {
            title: 'List Codex sessions',
            description: 'Recent coding sessions recorded for a project.',
            inputSchema: { projectId },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/codex/sessions`);
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
    }

    if (can('tasks:write')) {
        const taskFields = {
            title: z.string().min(1).optional(),
            description: z.string().optional(),
            status: z.enum(TASK_STATUSES).optional(),
            priority: z.enum(PRIORITIES).optional(),
            dueDate: z.string().optional().describe('YYYY-MM-DD, empty string clears it.'),
            startDate: z.string().optional().describe('YYYY-MM-DD'),
            assigneeIds: z.array(z.string()).optional().describe('User ids; replaces the current assignees.'),
            initiativeId: z.string().optional(),
            sprintId: z.string().optional()
        };

        server.registerTool('create_task', {
            title: 'Create task',
            description: 'Create a task in a project.',
            inputSchema: { projectId, ...taskFields, title: z.string().min(1) }
        }, async ({ projectId: id, ...fields }) => {
            const result = await callApi(token, 'POST', `/projects/${id}/tasks`, { body: compact({ ...fields, source: 'mcp' }) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('update_task', {
            title: 'Update task',
            description: 'Change fields of a task. Only the fields you pass are updated.',
            inputSchema: { projectId, taskId: z.string().min(1), ...taskFields }
        }, async ({ projectId: id, taskId, ...fields }) => {
            const body = compact(fields);
            if (body.status) (body as any).isCompleted = body.status === 'Done';
            const result = await callApi(token, 'PATCH', `/projects/${id}/tasks/${taskId}`, { body });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('complete_task', {
            title: 'Complete task',
            description: 'Mark a task as done.',
            inputSchema: { projectId, taskId: z.string().min(1) },
            annotations: { idempotentHint: true }
        }, async (args) => {
            const result = await callApi(token, 'PATCH', `/projects/${args.projectId}/tasks/${args.taskId}`, { body: { status: 'Done', isCompleted: true } });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('upsert_task', {
            title: 'Create or update task by external key',
            description: 'Idempotent task sync: creates the task the first time and updates it on later calls with the same externalKey (e.g. "github:owner/repo#12" or "plan:auth-refactor/step-3").',
            inputSchema: { projectId, externalKey: z.string().min(1), ...taskFields },
            annotations: { idempotentHint: true }
        }, async ({ projectId: id, ...fields }) => {
            const result = await callApi(token, 'POST', `/projects/${id}/tasks/upsert-by-external-key`, { body: compact({ ...fields, source: 'mcp' }) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('add_subtask', {
            title: 'Add subtask',
            description: 'Add a checklist item to a task.',
            inputSchema: { projectId, taskId: z.string().min(1), title: z.string().min(1) }
        }, async (args) => {
            const result = await callApi(token, 'POST', `/projects/${args.projectId}/tasks/${args.taskId}/subtasks`, { body: { title: args.title } });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('update_subtask', {
            title: 'Update subtask',
            description: 'Rename or tick off a subtask.',
            inputSchema: {
                projectId,
                taskId: z.string().min(1),
                subtaskId: z.string().min(1),
                title: z.string().optional(),
                isCompleted: z.boolean().optional()
            }
        }, async ({ projectId: id, taskId, subtaskId, ...fields }) => {
            const result = await callApi(token, 'PATCH', `/projects/${id}/tasks/${taskId}/subtasks/${subtaskId}`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        // --- Codex / coding sessions ---------------------------------------------
        const repoFields = {
            repoName: z.string().optional(),
            branch: z.string().optional(),
            commitSha: z.string().optional(),
            filesTouched: z.array(z.string()).optional(),
            validationStatus: z.string().optional().describe('e.g. "tests passed", "build failed".')
        };

        server.registerTool('codex_start_session', {
            title: 'Start coding session',
            description: 'Record the start of a coding session. Creates or reuses the linked task (by externalKey, derived from repo/branch/title when omitted) and returns the sessionId.',
            inputSchema: {
                projectId,
                title: z.string().min(1).describe('What this session is about.'),
                request: z.string().optional().describe('The original request or goal.'),
                summary: z.string().optional(),
                externalKey: z.string().optional().describe('Stable key so a resumed session reuses the same task.'),
                taskId: z.string().optional().describe('Attach to an existing task instead of creating one.'),
                ...repoFields
            }
        }, async ({ projectId: id, ...fields }) => {
            const result = await callApi(token, 'POST', `/projects/${id}/codex/sessions/start`, { body: compact({ ...fields, entity: 'task' }) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('codex_checkpoint', {
            title: 'Coding session checkpoint',
            description: 'Record progress in a running coding session (phase, summary, files, validation).',
            inputSchema: {
                projectId,
                sessionId: z.string().min(1),
                phase: z.string().optional().describe('e.g. "implementing", "testing".'),
                summary: z.string().optional(),
                ...repoFields
            }
        }, async ({ projectId: id, sessionId, ...fields }) => {
            const result = await callApi(token, 'POST', `/projects/${id}/codex/sessions/${sessionId}/checkpoint`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('codex_finish_session', {
            title: 'Finish coding session',
            description: 'Close a coding session with its outcome; completed sessions complete the linked task.',
            inputSchema: {
                projectId,
                sessionId: z.string().min(1),
                status: z.enum(['completed', 'partial', 'blocked']).optional().describe('Default completed.'),
                summary: z.string().optional().describe('What was done, for the task history.'),
                ...repoFields
            }
        }, async ({ projectId: id, sessionId, ...fields }) => {
            const result = await callApi(token, 'POST', `/projects/${id}/codex/sessions/${sessionId}/finish`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('create_followups', {
            title: 'Create follow-up tasks',
            description: 'Create follow-up tasks from a coding session (e.g. TODOs or deferred work). Idempotent per session and title.',
            inputSchema: {
                projectId,
                sessionId: z.string().optional(),
                followUps: z.array(z.object({
                    title: z.string().min(1),
                    description: z.string().optional(),
                    priority: z.enum(PRIORITIES).optional()
                })).min(1)
            }
        }, async ({ projectId: id, ...fields }) => {
            const result = await callApi(token, 'POST', `/projects/${id}/codex/followups/bulk-create`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
    }

    if (can('tasks:delete')) {
        server.registerTool('delete_task', {
            title: 'Delete task',
            description: 'Permanently delete a task. Prefer complete_task unless the task was created by mistake.',
            inputSchema: { projectId, taskId: z.string().min(1) },
            annotations: { destructiveHint: true }
        }, async (args) => {
            const result = await callApi(token, 'DELETE', `/projects/${args.projectId}/tasks/${args.taskId}`);
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
    }

    // --- Initiatives ---------------------------------------------------------
    if (can('initiatives:read')) {
        server.registerTool('list_initiatives', {
            title: 'List initiatives',
            description: 'Initiatives (larger bodies of work grouping tasks) of a project.',
            inputSchema: { projectId },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/initiatives`);
            if (result.status >= 400) return apiError(result);
            const initiatives = (result.payload.initiatives || []).map(summarizeInitiative);
            return textResult({ count: initiatives.length, initiatives });
        });

        server.registerTool('get_initiative', {
            title: 'Get initiative',
            description: 'Full details of one initiative.',
            inputSchema: { projectId, initiativeId: z.string().min(1) },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/initiatives/${args.initiativeId}`);
            return result.status >= 400 ? apiError(result) : textResult(result.payload.initiative);
        });
    }

    if (can('initiatives:write')) {
        const initiativeFields = {
            title: z.string().min(1).optional(),
            description: z.string().optional(),
            status: z.enum(INITIATIVE_STATUSES).optional(),
            priority: z.enum(PRIORITIES).optional(),
            startDate: z.string().optional().describe('YYYY-MM-DD'),
            dueDate: z.string().optional().describe('YYYY-MM-DD'),
            health: z.enum(['On Track', 'At Risk', 'Off Track']).optional()
        };

        server.registerTool('create_initiative', {
            title: 'Create initiative',
            description: 'Create an initiative in a project.',
            inputSchema: { projectId, ...initiativeFields, title: z.string().min(1) }
        }, async ({ projectId: id, ...fields }) => {
            const result = await callApi(token, 'POST', `/projects/${id}/initiatives`, { body: compact({ ...fields, source: 'mcp' }) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('update_initiative', {
            title: 'Update initiative',
            description: 'Change fields of an initiative. Only the fields you pass are updated.',
            inputSchema: { projectId, initiativeId: z.string().min(1), ...initiativeFields }
        }, async ({ projectId: id, initiativeId, ...fields }) => {
            const result = await callApi(token, 'PATCH', `/projects/${id}/initiatives/${initiativeId}`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
    }

    return server;
};

// ---------------------------------------------------------------------------
// HTTP endpoint
// ---------------------------------------------------------------------------

const jsonRpcError = (res: any, status: number, message: string, headers: Record<string, string> = {}) => {
    Object.entries(headers).forEach(([key, value]) => res.set(key, value));
    res.status(status).json({ jsonrpc: '2.0', error: { code: status === 401 ? -32001 : -32000, message }, id: null });
};

export const mcp = functions.region(REGION).runWith({ memory: '512MB', timeoutSeconds: 120 }).https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version');
    res.set('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.status(204).send('');
        return;
    }
    // Stateless server: no server-initiated streams and no sessions to delete.
    if (req.method !== 'POST') {
        res.set('Allow', 'POST, OPTIONS');
        jsonRpcError(res, 405, 'Method not allowed. Send MCP JSON-RPC requests with POST.');
        return;
    }

    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const unauthorizedHeaders = { 'WWW-Authenticate': 'Bearer realm="ProjectFlow", error="invalid_token"' };
    if (!token) {
        jsonRpcError(res, 401, 'Missing API token. Create one in ProjectFlow → Settings → API and send it as "Authorization: Bearer <token>".', unauthorizedHeaders);
        return;
    }

    const found = await findApiToken(token).catch(() => null);
    const expiresAt = found?.tokenData?.expiresAt?.toDate?.();
    if (!found || (expiresAt && expiresAt < new Date())) {
        jsonRpcError(res, 401, found ? 'API token expired.' : 'Invalid API token.', unauthorizedHeaders);
        return;
    }

    const server = buildServer(token, {
        tenantId: found.tenantId,
        tokenData: found.tokenData,
        permissions: new Set<string>(Array.isArray(found.tokenData.permissions) ? found.tokenData.permissions : [])
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
        void transport.close();
        void server.close();
    });

    try {
        await server.connect(transport);
        await transport.handleRequest(req as any, res as any, req.body);
    } catch (error) {
        console.error('MCP request failed', error);
        if (!res.headersSent) jsonRpcError(res, 500, 'Internal server error.');
    }
});
