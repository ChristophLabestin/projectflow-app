import { getPersonalTasks } from './domain/personalTasksService';
import { getSharedProjects, getUserProjects } from './domain/projectsService';
import { getWorkspaceTasks } from './domain/workspaceTasksService';
import { isProjectActiveForGlobalSignals } from './healthService';
import type { Project } from '../types';

export interface SpotlightEntry {
    id: string;
    title: string;
    subtitle?: string;
    keywords?: string[];
}

/**
 * Items for the macOS Spotlight index (desktop app): active projects, my open project tasks and my open
 * personal tasks of the active workspace. The id is the in-app path the shell opens on click.
 */
export const buildSpotlightEntries = async (tenantId: string, labels: { project: string; personalTask: string }): Promise<SpotlightEntry[]> => {
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
        ...[...projects.values()].map((project) => ({
            id: `/project/${project.id}`,
            title: project.title,
            subtitle: labels.project,
            keywords: ['ProjectFlow']
        })),
        ...tasks.mine.filter((task) => !task.isCompleted && projects.has(task.projectId)).map((task) => ({
            id: `/project/${task.projectId}/tasks/${task.id}`,
            title: task.title,
            subtitle: projects.get(task.projectId)?.title,
            keywords: ['ProjectFlow']
        })),
        ...personal.filter((task) => !task.isCompleted).map((task) => ({
            id: `/personal-tasks/${task.id}`,
            title: task.title,
            subtitle: labels.personalTask,
            keywords: ['ProjectFlow']
        }))
    ];
};
