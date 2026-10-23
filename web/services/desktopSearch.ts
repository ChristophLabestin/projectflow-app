import { getPersonalTasks } from './domain/personalTasksService';
import { getSharedProjects, getUserProjects } from './domain/projectsService';
import { getWorkspaceTasks } from './domain/workspaceTasksService';
import { isProjectActiveForGlobalSignals } from './healthService';
import type { Project } from '../types';

/** What the desktop command palette and the Spotlight index search: projects and my open tasks. */
export interface DesktopSearchItem {
    kind: 'project' | 'task' | 'personal-task';
    id: string;
    title: string;
    /** Project title for tasks. */
    context?: string;
    path: string;
    projectId?: string;
    tenantId: string;
    dueDate?: string;
}

/** Active projects, my open project tasks and my open personal tasks of the active workspace. */
export const loadDesktopSearchItems = async (tenantId: string): Promise<DesktopSearchItem[]> => {
    const [owned, shared] = await Promise.all([
        getUserProjects(tenantId, { hydrateAssets: false }).catch(() => [] as Project[]),
        getSharedProjects({ hydrateAssets: false }).catch(() => [] as Project[])
    ]);
    const projects = new Map<string, Project>();
    [...owned, ...shared]
        .filter((project) => (!project.tenantId || project.tenantId === tenantId) && isProjectActiveForGlobalSignals(project))
        .forEach((project) => projects.set(project.id, project));
    const [tasks, personal] = await Promise.all([
        getWorkspaceTasks([...projects.values()]).catch(() => ({ mine: [] })),
        getPersonalTasks(tenantId).catch(() => [])
    ]);
    return [
        ...[...projects.values()].map((project): DesktopSearchItem => ({
            kind: 'project', id: project.id, title: project.title, path: `/project/${project.id}`, projectId: project.id, tenantId
        })),
        ...tasks.mine.filter((task) => !task.isCompleted && projects.has(task.projectId)).map((task): DesktopSearchItem => ({
            kind: 'task',
            id: task.id,
            title: task.title,
            context: projects.get(task.projectId)?.title,
            path: `/project/${task.projectId}/tasks/${task.id}`,
            projectId: task.projectId,
            tenantId,
            dueDate: task.dueDate
        })),
        ...personal.filter((task) => !task.isCompleted).map((task): DesktopSearchItem => ({
            kind: 'personal-task', id: task.id, title: task.title, path: `/personal-tasks/${task.id}`, tenantId, dueDate: task.dueDate
        }))
    ];
};

/** Ranks items for a query: title prefix > word prefix > substring (title or context); empty query = tasks first. */
export const rankDesktopSearchItems = (items: DesktopSearchItem[], query: string, limit = 8) => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
        return [...items].sort((a, b) => Number(a.kind === 'project') - Number(b.kind === 'project')).slice(0, limit);
    }
    return items
        .map((item) => {
            const title = item.title.toLowerCase();
            const context = (item.context || '').toLowerCase();
            const score = title.startsWith(needle) ? 0
                : title.split(/[\s\-_/]+/).some((word) => word.startsWith(needle)) ? 1
                    : title.includes(needle) ? 2
                        : context.includes(needle) ? 3 : -1;
            return { item, score };
        })
        .filter(({ score }) => score >= 0)
        .sort((a, b) => a.score - b.score || a.item.title.length - b.item.title.length)
        .slice(0, limit)
        .map(({ item }) => item);
};
