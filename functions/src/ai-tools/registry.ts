/**
 * Tool registry for the in-app assistant (`aiAssist`). Every tool runs through the REST API in-process
 * (`callApi`) with the signed-in user's Firebase ID token, so it can never do more than the user can in
 * the app. Read tools run directly; write tools only ever produce a proposal that the user confirms
 * (brain/plans/in-app-ai-concept.md §4.2, package P3).
 */
import { z } from 'zod';

import { callApi, compact, summarizeProject, summarizeTask, type ApiResult } from './api';

export const TASK_STATUSES = ['Backlog', 'Todo', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done'] as const;
export const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'] as const;

export interface ToolContext {
    idToken: string;
    tenantId: string;
    uid: string;
}

export interface AiTool<Schema extends z.ZodObject = z.ZodObject> {
    name: string;
    description: string;
    kind: 'read' | 'write';
    input: Schema;
    run: (ctx: ToolContext, args: z.infer<Schema>) => Promise<unknown>;
}

/** Tool results go back into the model context: keep them small. */
const MAX_RESULT_CHARS = 12000;

export class ToolError extends Error {}

const api = async (ctx: ToolContext, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, options: { body?: Record<string, unknown>; query?: Record<string, string> } = {}) => {
    const result: ApiResult = await callApi(ctx.idToken, method, path, { ...options, tenantId: ctx.tenantId });
    if (result.status >= 400) {
        throw new ToolError(`ProjectFlow API error ${result.status}: ${result.payload?.error || 'Request failed.'}`);
    }
    return result.payload;
};

const projectId = z.string().min(1).describe('Project id (from search or list_projects).');

const tool = <S extends z.ZodObject>(definition: AiTool<S>): AiTool<S> => definition;

const READ_TOOLS = [
    tool({
        name: 'search',
        kind: 'read',
        description: 'Find projects and tasks by text across the projects the user can see. Start here instead of listing everything.',
        input: z.object({
            query: z.string().min(2).max(100),
            includeDone: z.boolean().optional().describe('Also completed tasks and closed projects.')
        }),
        run: async (ctx, args) => {
            const query: Record<string, string> = { q: args.query, limit: '15' };
            if (args.includeDone) query.includeDone = 'true';
            const { projects, tasks, truncated } = await api(ctx, 'GET', '/search', { query });
            return compact({ projects, tasks, truncated: truncated || undefined });
        }
    }),
    tool({
        name: 'my_today',
        kind: 'read',
        description: "The user's focus plus open assigned tasks: overdue, due today and the next 7 days.",
        input: z.object({}),
        run: async (ctx) => {
            const { success: _success, ...today } = await api(ctx, 'GET', '/me/today');
            return compact(today);
        }
    }),
    tool({
        name: 'list_projects',
        kind: 'read',
        description: 'Projects in the workspace (id, title, status, priority, due date, short description).',
        input: z.object({ includeClosed: z.boolean().optional() }),
        run: async (ctx, args) => {
            const payload = await api(ctx, 'GET', '/projects');
            const projects = (payload.projects || [])
                .filter((project: any) => args.includeClosed || !['Completed', 'Canceled'].includes(project.status))
                .map(summarizeProject);
            return { count: projects.length, projects: projects.slice(0, 60) };
        }
    }),
    tool({
        name: 'get_project',
        kind: 'read',
        description: 'Details of one project.',
        input: z.object({ projectId }),
        run: async (ctx, args) => (await api(ctx, 'GET', `/projects/${args.projectId}`)).project
    }),
    tool({
        name: 'list_tasks',
        kind: 'read',
        description: 'Tasks of a project (open only unless includeDone), optionally filtered.',
        input: z.object({
            projectId,
            status: z.enum(TASK_STATUSES).optional(),
            includeDone: z.boolean().optional(),
            assigneeId: z.string().optional(),
            search: z.string().optional(),
            limit: z.number().int().min(1).max(100).optional()
        }),
        run: async (ctx, args) => {
            const payload = await api(ctx, 'GET', `/projects/${args.projectId}/tasks`);
            const search = args.search?.toLowerCase();
            const tasks = (payload.tasks || []).filter((task: any) => {
                const done = task.isCompleted || task.status === 'Done';
                if (!args.includeDone && done && args.status !== 'Done') return false;
                if (args.status && task.status !== args.status) return false;
                if (args.assigneeId && !(task.assigneeIds || []).includes(args.assigneeId) && task.assigneeId !== args.assigneeId) return false;
                if (search && !`${task.title || ''} ${task.description || ''}`.toLowerCase().includes(search)) return false;
                return true;
            });
            const limited = tasks.slice(0, args.limit || 40).map(summarizeTask);
            return { count: tasks.length, returned: limited.length, tasks: limited };
        }
    }),
    tool({
        name: 'get_task',
        kind: 'read',
        description: 'Full task details including description and subtasks.',
        input: z.object({ projectId, taskId: z.string().min(1) }),
        run: async (ctx, args) => {
            const [task, subtasks] = await Promise.all([
                api(ctx, 'GET', `/projects/${args.projectId}/tasks/${args.taskId}`),
                api(ctx, 'GET', `/projects/${args.projectId}/tasks/${args.taskId}/subtasks`).catch(() => ({ subtasks: [] }))
            ]);
            return { ...task.task, subtasks: subtasks.subtasks || [] };
        }
    }),
    tool({
        name: 'list_comments',
        kind: 'read',
        description: 'Recent comments in a project, optionally only on one task or initiative.',
        input: z.object({ projectId, targetId: z.string().optional() }),
        run: async (ctx, args) => {
            const payload = await api(ctx, 'GET', `/projects/${args.projectId}/comments`);
            const comments = (payload.comments || []).filter((comment: any) => !args.targetId || comment.targetId === args.targetId);
            return { count: comments.length, comments: comments.slice(-25) };
        }
    }),
    tool({
        name: 'list_activity',
        kind: 'read',
        description: 'Recent activity of a project (newest first).',
        input: z.object({ projectId, limit: z.number().int().min(1).max(60).optional() }),
        run: async (ctx, args) => {
            const payload = await api(ctx, 'GET', `/projects/${args.projectId}/activities`);
            const activities = (payload.activities || []).slice(0, args.limit || 25);
            return { count: activities.length, activities };
        }
    }),
    tool({
        name: 'list_milestones',
        kind: 'read',
        description: 'Milestones of a project with due dates and status.',
        input: z.object({ projectId }),
        run: async (ctx, args) => api(ctx, 'GET', `/projects/${args.projectId}/milestones`)
    })
];

const taskFields = {
    description: z.string().max(8000).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    dueDate: z.string().optional().describe('YYYY-MM-DD, empty string clears it.'),
    assigneeIds: z.array(z.string()).optional().describe('User ids; replaces the current assignees.')
};

/** Write tools: the assistant may only propose them; `run` executes after the user confirms (P3). */
const WRITE_TOOLS = [
    tool({
        name: 'create_task',
        kind: 'write',
        description: 'Propose creating a task in a project. The user confirms before it happens.',
        input: z.object({ projectId, title: z.string().min(1).max(300), ...taskFields }),
        run: async (ctx, { projectId: id, ...fields }) => api(ctx, 'POST', `/projects/${id}/tasks`, { body: compact({ ...fields, source: 'ai' }) })
    }),
    tool({
        name: 'update_task',
        kind: 'write',
        description: 'Propose changing fields of a task. Only the given fields change. The user confirms before it happens.',
        input: z.object({ projectId, taskId: z.string().min(1), title: z.string().min(1).max(300).optional(), ...taskFields }),
        run: async (ctx, { projectId: id, taskId, ...fields }) => {
            const body: Record<string, unknown> = compact(fields);
            if (body.status) body.isCompleted = body.status === 'Done';
            return api(ctx, 'PATCH', `/projects/${id}/tasks/${taskId}`, { body });
        }
    }),
    tool({
        name: 'add_comment',
        kind: 'write',
        description: 'Propose a comment on a task. The user confirms before it is posted.',
        input: z.object({ projectId, taskId: z.string().min(1), content: z.string().min(1).max(4000) }),
        run: async (ctx, { projectId: id, taskId, content }) =>
            api(ctx, 'POST', `/projects/${id}/comments`, { body: { targetId: taskId, targetType: 'task', content } })
    }),
    tool({
        name: 'add_subtask',
        kind: 'write',
        description: 'Propose adding a subtask to a task. The user confirms before it happens.',
        input: z.object({ projectId, taskId: z.string().min(1), title: z.string().min(1).max(300) }),
        run: async (ctx, args) => api(ctx, 'POST', `/projects/${args.projectId}/tasks/${args.taskId}/subtasks`, { body: { title: args.title } })
    })
];

export const AI_TOOLS: AiTool<any>[] = [...READ_TOOLS, ...WRITE_TOOLS];

export const findTool = (name: string) => AI_TOOLS.find((entry) => entry.name === name);

/** OpenAI function-tool definitions (Responses API) for a set of tools. */
export const toOpenAiTools = (tools: AiTool<any>[]) => tools.map((entry) => {
    const { $schema: _schema, ...parameters } = z.toJSONSchema(entry.input) as Record<string, unknown>;
    return { type: 'function' as const, name: entry.name, description: entry.description, parameters, strict: false };
});

/** Validate model-supplied arguments against the tool schema. */
export const parseToolArgs = (entry: AiTool<any>, raw: string) => {
    let json: unknown;
    try {
        json = JSON.parse(raw || '{}');
    } catch {
        throw new ToolError('Tool arguments are not valid JSON.');
    }
    const parsed = entry.input.safeParse(json);
    if (!parsed.success) throw new ToolError(`Invalid arguments: ${parsed.error.issues.map((issue: { message: string }) => issue.message).join('; ')}`);
    return parsed.data;
};

export const serializeToolResult = (value: unknown) => {
    const text = JSON.stringify(value);
    return text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}…(truncated)` : text;
};
