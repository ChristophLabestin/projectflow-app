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
import { onRequest } from 'firebase-functions/v2/https';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { db } from './init';
import { checkWorkspaceAccess, effectiveScopes, normalizeRole, type PrincipalKind, RATE_LIMITS } from './ai-access';
import { aiRateLimiter, loadAiPolicy } from './ai-store';
import { isAiToken, resolveAiToken } from './ai-tokens';
import { issuerFor, mcpResourceFor, protectedResourceMetadataUrl } from './oauth-config';
import { audienceMatches, DEFAULT_OAUTH_SCOPES, OAUTH_SCOPES } from './oauth-core';
import { checkApiTokenUsable, findApiToken } from './authUtils';
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

/**
 * Full MCP tool annotations. Unset hints default to the cautious side (destructive, open world),
 * so every tool states all four explicitly. ProjectFlow tools never reach outside the workspace.
 */
const ANNOTATIONS = {
    read: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    create: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    update: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    destroy: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
} as const;

type TokenInfo = { tenantId: string; tokenData: any; role: string; permissions: Set<string> };

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
        annotations: ANNOTATIONS.read,
        description: 'Workspace, token name, permissions and project scope of the connected API token.',
        inputSchema: {},
    }, async () => {
        const tenant = await db.doc(`tenants/${info.tenantId}`).get().catch(() => null);
        return textResult(compact({
            workspaceId: info.tenantId,
            workspaceName: tenant?.data()?.name,
            tokenName: info.tokenData.name,
            role: info.role,
            permissions: [...info.permissions].sort(),
            projectScope: info.tokenData.projectScope || undefined
        }));
    });

    // --- Projects ------------------------------------------------------------
    if (can('projects:read')) {
        server.registerTool('list_projects', {
            title: 'List projects',
            annotations: ANNOTATIONS.read,
            description: 'List projects in the workspace (id, title, status, priority, due date, short description).',
            inputSchema: {
                includeClosed: z.boolean().optional().describe('Include completed and canceled projects. Default false.')
            },
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
            annotations: ANNOTATIONS.read,
            description: 'Full details of one project, including brief, modules and links.',
            inputSchema: { projectId },
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}`);
            return result.status >= 400 ? apiError(result) : textResult(result.payload.project);
        });

        server.registerTool('list_milestones', {
            title: 'List milestones',
            annotations: ANNOTATIONS.read,
            description: 'Milestones of a project with due dates and status.',
            inputSchema: { projectId },
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/milestones`);
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('list_comments', {
            title: 'List comments',
            annotations: ANNOTATIONS.read,
            description: 'Comments in a project, optionally only those on one task or initiative.',
            inputSchema: {
                projectId,
                targetId: z.string().optional().describe('Only comments on this task or initiative id.')
            },
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/comments`);
            if (result.status >= 400) return apiError(result);
            const comments = (result.payload.comments || []).filter((comment: any) => !args.targetId || comment.targetId === args.targetId);
            return textResult({ count: comments.length, comments });
        });

        server.registerTool('list_activity', {
            title: 'List activity',
            annotations: ANNOTATIONS.read,
            description: 'Recent activity log of a project (newest first).',
            inputSchema: {
                projectId,
                limit: z.number().int().min(1).max(200).optional().describe('Max entries, default 30.')
            },
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
            annotations: ANNOTATIONS.create,
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
            annotations: ANNOTATIONS.update,
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
            annotations: ANNOTATIONS.create,
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
            annotations: ANNOTATIONS.read,
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
            annotations: ANNOTATIONS.read,
            description: 'Full task details including description and subtasks.',
            inputSchema: { projectId, taskId: z.string().min(1) },
        }, async (args) => {
            const [task, subtasks] = await Promise.all([
                callApi(token, 'GET', `/projects/${args.projectId}/tasks/${args.taskId}`),
                callApi(token, 'GET', `/projects/${args.projectId}/tasks/${args.taskId}/subtasks`)
            ]);
            if (task.status >= 400) return apiError(task);
            return textResult({ ...task.payload.task, subtasks: subtasks.payload?.subtasks || [] });
        });

        server.registerTool('search', {
            title: 'Search workspace',
            annotations: ANNOTATIONS.read,
            description: 'Find projects and open tasks by text (title/description) across the projects you can see. Start here instead of listing everything.',
            inputSchema: {
                query: z.string().min(2).max(100).describe('Search text, at least 2 characters.'),
                includeDone: z.boolean().optional().describe('Also search completed tasks and closed projects. Default false.'),
                limit: z.number().int().min(1).max(50).optional().describe('Max hits per kind, default 20.')
            }
        }, async (args) => {
            const query: Record<string, string> = { q: args.query, limit: String(args.limit || 20) };
            if (args.includeDone) query.includeDone = 'true';
            const result = await callApi(token, 'GET', '/search', { query });
            if (result.status >= 400) return apiError(result);
            const { projects, tasks, truncated } = result.payload;
            return textResult(compact({ projects, tasks, truncated: truncated || undefined }));
        });

        server.registerTool('my_today', {
            title: 'My day',
            annotations: ANNOTATIONS.read,
            description: 'Your current focus plus your open assigned tasks: overdue, due today and the next 7 days (in your time zone).',
            inputSchema: {}
        }, async () => {
            const result = await callApi(token, 'GET', '/me/today');
            if (result.status >= 400) return apiError(result);
            const { success: _success, ...today } = result.payload;
            return textResult(compact(today));
        });

        server.registerTool('list_codex_sessions', {
            title: 'List Codex sessions',
            annotations: ANNOTATIONS.read,
            description: 'Recent coding sessions recorded for a project.',
            inputSchema: { projectId },
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
            annotations: ANNOTATIONS.create,
            description: 'Create a task in a project.',
            inputSchema: { projectId, ...taskFields, title: z.string().min(1) }
        }, async ({ projectId: id, ...fields }) => {
            const result = await callApi(token, 'POST', `/projects/${id}/tasks`, { body: compact({ ...fields, source: 'mcp' }) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('update_task', {
            title: 'Update task',
            annotations: ANNOTATIONS.update,
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
            annotations: ANNOTATIONS.update,
            description: 'Mark a task as done.',
            inputSchema: { projectId, taskId: z.string().min(1) },
        }, async (args) => {
            const result = await callApi(token, 'PATCH', `/projects/${args.projectId}/tasks/${args.taskId}`, { body: { status: 'Done', isCompleted: true } });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('upsert_task', {
            title: 'Create or update task by external key',
            annotations: ANNOTATIONS.update,
            description: 'Idempotent task sync: creates the task the first time and updates it on later calls with the same externalKey (e.g. "github:owner/repo#12" or "plan:auth-refactor/step-3").',
            inputSchema: { projectId, externalKey: z.string().min(1), ...taskFields },
        }, async ({ projectId: id, ...fields }) => {
            const result = await callApi(token, 'POST', `/projects/${id}/tasks/upsert-by-external-key`, { body: compact({ ...fields, source: 'mcp' }) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('add_subtask', {
            title: 'Add subtask',
            annotations: ANNOTATIONS.create,
            description: 'Add a checklist item to a task.',
            inputSchema: { projectId, taskId: z.string().min(1), title: z.string().min(1) }
        }, async (args) => {
            const result = await callApi(token, 'POST', `/projects/${args.projectId}/tasks/${args.taskId}/subtasks`, { body: { title: args.title } });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('update_subtask', {
            title: 'Update subtask',
            annotations: ANNOTATIONS.update,
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
            annotations: ANNOTATIONS.create,
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
            annotations: ANNOTATIONS.create,
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
            annotations: ANNOTATIONS.update,
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
            annotations: ANNOTATIONS.create,
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
            annotations: ANNOTATIONS.destroy,
            description: 'Permanently delete a task. Prefer complete_task unless the task was created by mistake.',
            inputSchema: { projectId, taskId: z.string().min(1) },
        }, async (args) => {
            const result = await callApi(token, 'DELETE', `/projects/${args.projectId}/tasks/${args.taskId}`);
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
    }

    // --- Initiatives ---------------------------------------------------------
    if (can('initiatives:read')) {
        server.registerTool('list_initiatives', {
            title: 'List initiatives',
            annotations: ANNOTATIONS.read,
            description: 'Initiatives (larger bodies of work grouping tasks) of a project.',
            inputSchema: { projectId },
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/initiatives`);
            if (result.status >= 400) return apiError(result);
            const initiatives = (result.payload.initiatives || []).map(summarizeInitiative);
            return textResult({ count: initiatives.length, initiatives });
        });

        server.registerTool('get_initiative', {
            title: 'Get initiative',
            annotations: ANNOTATIONS.read,
            description: 'Full details of one initiative.',
            inputSchema: { projectId, initiativeId: z.string().min(1) },
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
            annotations: ANNOTATIONS.create,
            description: 'Create an initiative in a project.',
            inputSchema: { projectId, ...initiativeFields, title: z.string().min(1) }
        }, async ({ projectId: id, ...fields }) => {
            const result = await callApi(token, 'POST', `/projects/${id}/initiatives`, { body: compact({ ...fields, source: 'mcp' }) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });

        server.registerTool('update_initiative', {
            title: 'Update initiative',
            annotations: ANNOTATIONS.update,
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

type McpCaller = { tenantId: string; tokenData: any; role: string; kind: PrincipalKind; credentialId: string; resource: string | null };

/** Workspace API tokens (`pfat_`) and user-bound AI tokens (`pfo_` OAuth, `pfp_` personal). */
const resolveMcpCaller = async (token: string): Promise<McpCaller | { error: string; status?: 403 }> => {
    if (isAiToken(token)) {
        const resolved = await resolveAiToken(token).catch((error) => {
            console.error('MCP AI token lookup failed', error);
            return null;
        });
        if (!resolved) return { error: 'Invalid or expired access token.' };
        if ('error' in resolved) return { error: resolved.error, status: resolved.status };
        return {
            tenantId: resolved.tenantId,
            tokenData: resolved.tokenData,
            role: resolved.memberRole,
            kind: resolved.tokenData.kind,
            credentialId: resolved.tokenId,
            resource: resolved.tokenData.resource
        };
    }
    const found = await findApiToken(token).catch((error) => {
        console.error('MCP token lookup failed', error);
        return null;
    });
    if (!found) return { error: 'Invalid API token.' };
    const usable = await checkApiTokenUsable(found.tokenData, found.tenantId);
    if (!usable.ok) return { error: usable.error, status: usable.status };
    return { tenantId: found.tenantId, tokenData: found.tokenData, role: usable.role, kind: 'workspace-token', credentialId: found.tokenRef.id, resource: null };
};

export const protectedResourceMetadata = (req: any) => ({
    resource: mcpResourceFor(req),
    authorization_servers: [issuerFor(req)],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'ProjectFlow',
    resource_documentation: 'https://getprojectflow.com/docs/mcp'
});

const mcpHandler = toNodeHandler(createMcpHandler((ctx: any) => {
    const context = ctx?.authInfo?.extra?.projectflow as { token: string; info: TokenInfo } | undefined;
    if (!context) throw new Error('MCP request without resolved caller');
    return buildServer(context.token, context.info);
}, { responseMode: 'json', onerror: (error: unknown) => console.error('MCP handler error', error) }));

const handleMcpRequest = async (req: any, res: any) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version');
    res.set('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.status(204).send('');
        return;
    }
    // RFC 9728 protected resource metadata (OAuth discovery for MCP clients).
    if (req.method === 'GET' && /\/\.well-known\/oauth-protected-resource(\/mcp)?\/?$/.test(String(req.path || ''))) {
        res.set('Cache-Control', 'public, max-age=300');
        res.status(200).json(protectedResourceMetadata(req));
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
    const challenge = `Bearer realm="ProjectFlow", resource_metadata="${protectedResourceMetadataUrl(req)}", scope="${DEFAULT_OAUTH_SCOPES.join(' ')}"`;
    if (!token) {
        jsonRpcError(res, 401, 'Sign in to ProjectFlow (OAuth) or send a ProjectFlow token as "Authorization: Bearer <token>".', { 'WWW-Authenticate': challenge });
        return;
    }

    const caller = await resolveMcpCaller(token);
    if ('error' in caller) {
        if (caller.status === 403) { jsonRpcError(res, 403, caller.error); return; } // legal consent missing
        jsonRpcError(res, 401, caller.error, { 'WWW-Authenticate': `${challenge}, error="invalid_token"` });
        return;
    }
    if (!audienceMatches(caller.resource, mcpResourceFor(req))) {
        jsonRpcError(res, 401, 'This token was issued for a different resource.', { 'WWW-Authenticate': `${challenge}, error="invalid_token"` });
        return;
    }

    const role = normalizeRole(caller.role);
    const kind = caller.kind;
    const policy = await loadAiPolicy(caller.tenantId);
    const access = role ? checkWorkspaceAccess({ role, policy, kind }) : { ok: false as const, error: 'Not a member of this workspace.' };
    if (!role || !access.ok) {
        jsonRpcError(res, 403, access.ok ? 'Not a member of this workspace.' : access.error);
        return;
    }
    const retryAfter = aiRateLimiter.take(`mcp:${caller.credentialId}`, RATE_LIMITS.request);
    if (retryAfter > 0) {
        res.set('Retry-After', String(retryAfter));
        jsonRpcError(res, 429, `Rate limit exceeded. Retry in ${retryAfter}s.`);
        return;
    }

    // tools/list only shows what the token may actually do: scopes ∩ role ceiling ∩ workspace AI policy.
    const tokenScopes = Array.isArray(caller.tokenData.permissions) ? caller.tokenData.permissions : [];
    const info: TokenInfo = {
        tenantId: caller.tenantId,
        tokenData: caller.tokenData,
        role,
        permissions: new Set<string>(effectiveScopes({ tokenScopes, role, policy, kind }))
    };
    // The SDK builds one McpServer per request (stateless, 2026-07-28 + legacy `initialize` fallback);
    // the resolved caller travels in authInfo.extra.
    (req as any).auth = { token, clientId: caller.credentialId, scopes: [...info.permissions], extra: { projectflow: { token, info } } };

    try {
        await mcpHandler(req as any, res as any, req.body);
    } catch (error) {
        console.error('MCP request failed', error);
        if (!res.headersSent) jsonRpcError(res, 500, 'Internal server error.');
    }
};

/** Legacy Gen1 endpoint (direct cloudfunctions.net URL); Hosting `/mcp` points to `mcpServer`. */
export const mcp = functions.region(REGION).runWith({ memory: '512MB', timeoutSeconds: 120 }).https.onRequest(handleMcpRequest);

/** Gen2 (Cloud Run): one instance serves up to 80 concurrent requests, so the in-memory rate limiter and warm caches hold. */
export const mcpServer = onRequest({ region: REGION, memory: '512MiB', timeoutSeconds: 120, concurrency: 80 }, handleMcpRequest);

