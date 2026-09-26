"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcp = void 0;
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
const functions = require("firebase-functions/v1");
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const zod_1 = require("zod");
const init_1 = require("./init");
const authUtils_1 = require("./authUtils");
const projectflow_api_1 = require("./projectflow-api");
const REGION = 'europe-west3';
const SERVER_VERSION = '1.0.0';
const TASK_STATUSES = ['Backlog', 'Todo', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done'];
const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];
const INITIATIVE_STATUSES = ['Planning', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done'];
const INSTRUCTIONS = `ProjectFlow is a project management workspace. This server acts with the permissions of the API token it was connected with.

Typical flow:
1. Call whoami to see the workspace, token permissions and (if any) the single project this token is limited to.
2. Call list_projects and pick a projectId.
3. Read with list_tasks / get_task / list_initiatives / list_milestones before changing things.
4. Prefer upsert_task with a stable externalKey when syncing work from code, issues or plans — repeated calls update instead of duplicating.
5. For coding sessions use codex_start_session → codex_checkpoint (optional, repeatable) → codex_finish_session; this links the work to a task and records it in the project's activity log.

Dates are ISO strings (YYYY-MM-DD). Task statuses: ${TASK_STATUSES.join(', ')}. Priorities: ${PRIORITIES.join(', ')}.`;
/** Run a REST API route in-process with the caller's token and capture the JSON response. */
const callApi = async (token, method, path, options = {}) => {
    let status = 200;
    let payload = null;
    const req = {
        method,
        path: `/projectflow${path}`,
        headers: { authorization: `Bearer ${token}` },
        body: options.body || {},
        query: options.query || {}
    };
    const res = {
        headersSent: false,
        statusCode: 200,
        status(code) { status = code; this.statusCode = code; return this; },
        json(value) { payload = value; this.headersSent = true; return this; },
        send(value) { payload = value; this.headersSent = true; return this; },
        end() { this.headersSent = true; return this; },
        set() { return this; },
        setHeader() { return this; }
    };
    const handled = await (0, projectflow_api_1.handleProjectflowApiRoute)(req, res, `/projectflow${path}`);
    if (!handled)
        return { status: 404, payload: { success: false, error: `No API route for ${method} ${path}` } };
    return { status, payload };
};
const textResult = (value, isError = false) => (Object.assign({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] }, (isError ? { isError: true } : {})));
const apiError = (result) => { var _a; return textResult(`ProjectFlow API error ${result.status}: ${((_a = result.payload) === null || _a === void 0 ? void 0 : _a.error) || 'Request failed.'}`, true); };
/** Drop undefined values so PATCH bodies only contain what the agent actually set. */
const compact = (value) => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
const summarizeTask = (task) => compact({
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
const summarizeProject = (project) => compact({
    id: project.id,
    title: project.title,
    status: project.status,
    priority: project.priority,
    dueDate: project.dueDate || undefined,
    description: typeof project.description === 'string' && project.description ? project.description.slice(0, 240) : undefined
});
const summarizeInitiative = (initiative) => compact({
    id: initiative.id,
    title: initiative.title,
    status: initiative.status,
    priority: initiative.priority,
    health: initiative.health || undefined,
    startDate: initiative.startDate || undefined,
    dueDate: initiative.dueDate || undefined,
    externalKey: initiative.externalKey || undefined
});
const buildServer = (token, info) => {
    const server = new mcp_js_1.McpServer({ name: 'projectflow', title: 'ProjectFlow', version: SERVER_VERSION }, { instructions: INSTRUCTIONS });
    const can = (permission) => info.permissions.has(permission);
    const projectId = zod_1.z.string().min(1).describe('Project id (from list_projects).');
    // --- Workspace -----------------------------------------------------------
    server.registerTool('whoami', {
        title: 'Who am I',
        description: 'Workspace, token name, permissions and project scope of the connected API token.',
        inputSchema: {},
        annotations: { readOnlyHint: true }
    }, async () => {
        var _a;
        const tenant = await init_1.db.doc(`tenants/${info.tenantId}`).get().catch(() => null);
        return textResult(compact({
            workspaceId: info.tenantId,
            workspaceName: (_a = tenant === null || tenant === void 0 ? void 0 : tenant.data()) === null || _a === void 0 ? void 0 : _a.name,
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
                includeClosed: zod_1.z.boolean().optional().describe('Include completed and canceled projects. Default false.')
            },
            annotations: { readOnlyHint: true }
        }, async ({ includeClosed }) => {
            const result = await callApi(token, 'GET', '/projects');
            if (result.status >= 400)
                return apiError(result);
            const projects = (result.payload.projects || [])
                .filter((project) => includeClosed || !['Completed', 'Canceled'].includes(project.status))
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
                targetId: zod_1.z.string().optional().describe('Only comments on this task or initiative id.')
            },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/comments`);
            if (result.status >= 400)
                return apiError(result);
            const comments = (result.payload.comments || []).filter((comment) => !args.targetId || comment.targetId === args.targetId);
            return textResult({ count: comments.length, comments });
        });
        server.registerTool('list_activity', {
            title: 'List activity',
            description: 'Recent activity log of a project (newest first).',
            inputSchema: {
                projectId,
                limit: zod_1.z.number().int().min(1).max(200).optional().describe('Max entries, default 30.')
            },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/activities`);
            if (result.status >= 400)
                return apiError(result);
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
                title: zod_1.z.string().min(1),
                dueDate: zod_1.z.string().optional().describe('YYYY-MM-DD'),
                description: zod_1.z.string().optional(),
                linkedInitiativeId: zod_1.z.string().optional()
            }
        }, async (_a) => {
            var { projectId: id } = _a, fields = __rest(_a, ["projectId"]);
            const result = await callApi(token, 'POST', `/projects/${id}/milestones`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
        server.registerTool('update_milestone', {
            title: 'Update milestone',
            description: 'Change a milestone (title, due date, status, description).',
            inputSchema: {
                projectId,
                milestoneId: zod_1.z.string().min(1),
                title: zod_1.z.string().optional(),
                dueDate: zod_1.z.string().optional().describe('YYYY-MM-DD'),
                status: zod_1.z.enum(['Pending', 'Achieved', 'Missed']).optional(),
                description: zod_1.z.string().optional()
            }
        }, async (_a) => {
            var { projectId: id, milestoneId } = _a, fields = __rest(_a, ["projectId", "milestoneId"]);
            const result = await callApi(token, 'PATCH', `/projects/${id}/milestones/${milestoneId}`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
        server.registerTool('add_comment', {
            title: 'Add comment',
            description: 'Comment on a task or initiative.',
            inputSchema: {
                projectId,
                targetId: zod_1.z.string().min(1).describe('Task or initiative id.'),
                targetType: zod_1.z.enum(['task', 'initiative']),
                content: zod_1.z.string().min(1)
            }
        }, async (_a) => {
            var { projectId: id } = _a, fields = __rest(_a, ["projectId"]);
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
                status: zod_1.z.enum(TASK_STATUSES).optional(),
                includeDone: zod_1.z.boolean().optional().describe('Include completed tasks. Default false.'),
                assigneeId: zod_1.z.string().optional().describe('Only tasks assigned to this user id.'),
                initiativeId: zod_1.z.string().optional(),
                search: zod_1.z.string().optional().describe('Case-insensitive match on title and description.'),
                limit: zod_1.z.number().int().min(1).max(500).optional().describe('Default 50.')
            },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            var _a;
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/tasks`);
            if (result.status >= 400)
                return apiError(result);
            const search = (_a = args.search) === null || _a === void 0 ? void 0 : _a.toLowerCase();
            const tasks = (result.payload.tasks || []).filter((task) => {
                const done = task.isCompleted || task.status === 'Done';
                if (!args.includeDone && done && args.status !== 'Done')
                    return false;
                if (args.status && task.status !== args.status)
                    return false;
                if (args.assigneeId && !(task.assigneeIds || []).includes(args.assigneeId) && task.assigneeId !== args.assigneeId)
                    return false;
                if (args.initiativeId && task.initiativeId !== args.initiativeId)
                    return false;
                if (search && !`${task.title || ''} ${task.description || ''}`.toLowerCase().includes(search))
                    return false;
                return true;
            });
            const limited = tasks.slice(0, args.limit || 50).map(summarizeTask);
            return textResult({ count: tasks.length, returned: limited.length, tasks: limited });
        });
        server.registerTool('get_task', {
            title: 'Get task',
            description: 'Full task details including description and subtasks.',
            inputSchema: { projectId, taskId: zod_1.z.string().min(1) },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            var _a;
            const [task, subtasks] = await Promise.all([
                callApi(token, 'GET', `/projects/${args.projectId}/tasks/${args.taskId}`),
                callApi(token, 'GET', `/projects/${args.projectId}/tasks/${args.taskId}/subtasks`)
            ]);
            if (task.status >= 400)
                return apiError(task);
            return textResult(Object.assign(Object.assign({}, task.payload.task), { subtasks: ((_a = subtasks.payload) === null || _a === void 0 ? void 0 : _a.subtasks) || [] }));
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
            title: zod_1.z.string().min(1).optional(),
            description: zod_1.z.string().optional(),
            status: zod_1.z.enum(TASK_STATUSES).optional(),
            priority: zod_1.z.enum(PRIORITIES).optional(),
            dueDate: zod_1.z.string().optional().describe('YYYY-MM-DD, empty string clears it.'),
            startDate: zod_1.z.string().optional().describe('YYYY-MM-DD'),
            assigneeIds: zod_1.z.array(zod_1.z.string()).optional().describe('User ids; replaces the current assignees.'),
            initiativeId: zod_1.z.string().optional(),
            sprintId: zod_1.z.string().optional()
        };
        server.registerTool('create_task', {
            title: 'Create task',
            description: 'Create a task in a project.',
            inputSchema: Object.assign(Object.assign({ projectId }, taskFields), { title: zod_1.z.string().min(1) })
        }, async (_a) => {
            var { projectId: id } = _a, fields = __rest(_a, ["projectId"]);
            const result = await callApi(token, 'POST', `/projects/${id}/tasks`, { body: compact(Object.assign(Object.assign({}, fields), { source: 'mcp' })) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
        server.registerTool('update_task', {
            title: 'Update task',
            description: 'Change fields of a task. Only the fields you pass are updated.',
            inputSchema: Object.assign({ projectId, taskId: zod_1.z.string().min(1) }, taskFields)
        }, async (_a) => {
            var { projectId: id, taskId } = _a, fields = __rest(_a, ["projectId", "taskId"]);
            const body = compact(fields);
            if (body.status)
                body.isCompleted = body.status === 'Done';
            const result = await callApi(token, 'PATCH', `/projects/${id}/tasks/${taskId}`, { body });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
        server.registerTool('complete_task', {
            title: 'Complete task',
            description: 'Mark a task as done.',
            inputSchema: { projectId, taskId: zod_1.z.string().min(1) },
            annotations: { idempotentHint: true }
        }, async (args) => {
            const result = await callApi(token, 'PATCH', `/projects/${args.projectId}/tasks/${args.taskId}`, { body: { status: 'Done', isCompleted: true } });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
        server.registerTool('upsert_task', {
            title: 'Create or update task by external key',
            description: 'Idempotent task sync: creates the task the first time and updates it on later calls with the same externalKey (e.g. "github:owner/repo#12" or "plan:auth-refactor/step-3").',
            inputSchema: Object.assign({ projectId, externalKey: zod_1.z.string().min(1) }, taskFields),
            annotations: { idempotentHint: true }
        }, async (_a) => {
            var { projectId: id } = _a, fields = __rest(_a, ["projectId"]);
            const result = await callApi(token, 'POST', `/projects/${id}/tasks/upsert-by-external-key`, { body: compact(Object.assign(Object.assign({}, fields), { source: 'mcp' })) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
        server.registerTool('add_subtask', {
            title: 'Add subtask',
            description: 'Add a checklist item to a task.',
            inputSchema: { projectId, taskId: zod_1.z.string().min(1), title: zod_1.z.string().min(1) }
        }, async (args) => {
            const result = await callApi(token, 'POST', `/projects/${args.projectId}/tasks/${args.taskId}/subtasks`, { body: { title: args.title } });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
        server.registerTool('update_subtask', {
            title: 'Update subtask',
            description: 'Rename or tick off a subtask.',
            inputSchema: {
                projectId,
                taskId: zod_1.z.string().min(1),
                subtaskId: zod_1.z.string().min(1),
                title: zod_1.z.string().optional(),
                isCompleted: zod_1.z.boolean().optional()
            }
        }, async (_a) => {
            var { projectId: id, taskId, subtaskId } = _a, fields = __rest(_a, ["projectId", "taskId", "subtaskId"]);
            const result = await callApi(token, 'PATCH', `/projects/${id}/tasks/${taskId}/subtasks/${subtaskId}`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
        // --- Codex / coding sessions ---------------------------------------------
        const repoFields = {
            repoName: zod_1.z.string().optional(),
            branch: zod_1.z.string().optional(),
            commitSha: zod_1.z.string().optional(),
            filesTouched: zod_1.z.array(zod_1.z.string()).optional(),
            validationStatus: zod_1.z.string().optional().describe('e.g. "tests passed", "build failed".')
        };
        server.registerTool('codex_start_session', {
            title: 'Start coding session',
            description: 'Record the start of a coding session. Creates or reuses the linked task (by externalKey, derived from repo/branch/title when omitted) and returns the sessionId.',
            inputSchema: Object.assign({ projectId, title: zod_1.z.string().min(1).describe('What this session is about.'), request: zod_1.z.string().optional().describe('The original request or goal.'), summary: zod_1.z.string().optional(), externalKey: zod_1.z.string().optional().describe('Stable key so a resumed session reuses the same task.'), taskId: zod_1.z.string().optional().describe('Attach to an existing task instead of creating one.') }, repoFields)
        }, async (_a) => {
            var { projectId: id } = _a, fields = __rest(_a, ["projectId"]);
            const result = await callApi(token, 'POST', `/projects/${id}/codex/sessions/start`, { body: compact(Object.assign(Object.assign({}, fields), { entity: 'task' })) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
        server.registerTool('codex_checkpoint', {
            title: 'Coding session checkpoint',
            description: 'Record progress in a running coding session (phase, summary, files, validation).',
            inputSchema: Object.assign({ projectId, sessionId: zod_1.z.string().min(1), phase: zod_1.z.string().optional().describe('e.g. "implementing", "testing".'), summary: zod_1.z.string().optional() }, repoFields)
        }, async (_a) => {
            var { projectId: id, sessionId } = _a, fields = __rest(_a, ["projectId", "sessionId"]);
            const result = await callApi(token, 'POST', `/projects/${id}/codex/sessions/${sessionId}/checkpoint`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
        server.registerTool('codex_finish_session', {
            title: 'Finish coding session',
            description: 'Close a coding session with its outcome; completed sessions complete the linked task.',
            inputSchema: Object.assign({ projectId, sessionId: zod_1.z.string().min(1), status: zod_1.z.enum(['completed', 'partial', 'blocked']).optional().describe('Default completed.'), summary: zod_1.z.string().optional().describe('What was done, for the task history.') }, repoFields)
        }, async (_a) => {
            var { projectId: id, sessionId } = _a, fields = __rest(_a, ["projectId", "sessionId"]);
            const result = await callApi(token, 'POST', `/projects/${id}/codex/sessions/${sessionId}/finish`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
        server.registerTool('create_followups', {
            title: 'Create follow-up tasks',
            description: 'Create follow-up tasks from a coding session (e.g. TODOs or deferred work). Idempotent per session and title.',
            inputSchema: {
                projectId,
                sessionId: zod_1.z.string().optional(),
                followUps: zod_1.z.array(zod_1.z.object({
                    title: zod_1.z.string().min(1),
                    description: zod_1.z.string().optional(),
                    priority: zod_1.z.enum(PRIORITIES).optional()
                })).min(1)
            }
        }, async (_a) => {
            var { projectId: id } = _a, fields = __rest(_a, ["projectId"]);
            const result = await callApi(token, 'POST', `/projects/${id}/codex/followups/bulk-create`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
    }
    if (can('tasks:delete')) {
        server.registerTool('delete_task', {
            title: 'Delete task',
            description: 'Permanently delete a task. Prefer complete_task unless the task was created by mistake.',
            inputSchema: { projectId, taskId: zod_1.z.string().min(1) },
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
            if (result.status >= 400)
                return apiError(result);
            const initiatives = (result.payload.initiatives || []).map(summarizeInitiative);
            return textResult({ count: initiatives.length, initiatives });
        });
        server.registerTool('get_initiative', {
            title: 'Get initiative',
            description: 'Full details of one initiative.',
            inputSchema: { projectId, initiativeId: zod_1.z.string().min(1) },
            annotations: { readOnlyHint: true }
        }, async (args) => {
            const result = await callApi(token, 'GET', `/projects/${args.projectId}/initiatives/${args.initiativeId}`);
            return result.status >= 400 ? apiError(result) : textResult(result.payload.initiative);
        });
    }
    if (can('initiatives:write')) {
        const initiativeFields = {
            title: zod_1.z.string().min(1).optional(),
            description: zod_1.z.string().optional(),
            status: zod_1.z.enum(INITIATIVE_STATUSES).optional(),
            priority: zod_1.z.enum(PRIORITIES).optional(),
            startDate: zod_1.z.string().optional().describe('YYYY-MM-DD'),
            dueDate: zod_1.z.string().optional().describe('YYYY-MM-DD'),
            health: zod_1.z.enum(['On Track', 'At Risk', 'Off Track']).optional()
        };
        server.registerTool('create_initiative', {
            title: 'Create initiative',
            description: 'Create an initiative in a project.',
            inputSchema: Object.assign(Object.assign({ projectId }, initiativeFields), { title: zod_1.z.string().min(1) })
        }, async (_a) => {
            var { projectId: id } = _a, fields = __rest(_a, ["projectId"]);
            const result = await callApi(token, 'POST', `/projects/${id}/initiatives`, { body: compact(Object.assign(Object.assign({}, fields), { source: 'mcp' })) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
        server.registerTool('update_initiative', {
            title: 'Update initiative',
            description: 'Change fields of an initiative. Only the fields you pass are updated.',
            inputSchema: Object.assign({ projectId, initiativeId: zod_1.z.string().min(1) }, initiativeFields)
        }, async (_a) => {
            var { projectId: id, initiativeId } = _a, fields = __rest(_a, ["projectId", "initiativeId"]);
            const result = await callApi(token, 'PATCH', `/projects/${id}/initiatives/${initiativeId}`, { body: compact(fields) });
            return result.status >= 400 ? apiError(result) : textResult(result.payload);
        });
    }
    return server;
};
// ---------------------------------------------------------------------------
// HTTP endpoint
// ---------------------------------------------------------------------------
const jsonRpcError = (res, status, message, headers = {}) => {
    Object.entries(headers).forEach(([key, value]) => res.set(key, value));
    res.status(status).json({ jsonrpc: '2.0', error: { code: status === 401 ? -32001 : -32000, message }, id: null });
};
exports.mcp = functions.region(REGION).runWith({ memory: '512MB', timeoutSeconds: 120 }).https.onRequest(async (req, res) => {
    var _a, _b, _c;
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
    const found = await (0, authUtils_1.findApiToken)(token).catch(() => null);
    const expiresAt = (_c = (_b = (_a = found === null || found === void 0 ? void 0 : found.tokenData) === null || _a === void 0 ? void 0 : _a.expiresAt) === null || _b === void 0 ? void 0 : _b.toDate) === null || _c === void 0 ? void 0 : _c.call(_b);
    if (!found || (expiresAt && expiresAt < new Date())) {
        jsonRpcError(res, 401, found ? 'API token expired.' : 'Invalid API token.', unauthorizedHeaders);
        return;
    }
    const server = buildServer(token, {
        tenantId: found.tenantId,
        tokenData: found.tokenData,
        permissions: new Set(Array.isArray(found.tokenData.permissions) ? found.tokenData.permissions : [])
    });
    const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
        void transport.close();
        void server.close();
    });
    try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    }
    catch (error) {
        console.error('MCP request failed', error);
        if (!res.headersSent)
            jsonRpcError(res, 500, 'Internal server error.');
    }
});
//# sourceMappingURL=mcp-server.js.map