import { collection, getDocs } from 'firebase/firestore';

import { auth, db } from '../firebase';
import { isProjectIncludedInImportantSignals } from '../healthService';
import { toMillis } from '../../utils/time';
import type { Project, Task } from '../../types';

export interface WorkspaceTasks {
    /** Tasks assigned to the current user (or owned by them while unassigned). */
    mine: Task[];
    /** Everything else in the same projects: needed for "frees up N" and "waiting on you". */
    others: Task[];
}

const loadProjectTasks = async (projectId: string, tenantId?: string): Promise<Task[]> => {
    if (!tenantId) return [];
    const snapshot = await getDocs(collection(db, 'tenants', tenantId, 'projects', projectId, 'tasks'));
    return snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data(), path: docSnap.ref.path } as unknown as Task))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

/** Same assignment rule as `getUserTasksForProjects` in tasksService. */
const isAssignedTo = (task: Task, userId: string) => (
    task.assigneeId === userId
    || Boolean(task.assigneeIds && task.assigneeIds.includes(userId))
    || (task.ownerId === userId && !task.assigneeId && (!task.assigneeIds || task.assigneeIds.length === 0))
);

/**
 * Loads every task of the given projects once and splits it into "mine" and
 * "others". The Dashboard used to read all tasks and throw the others away;
 * the day plan needs them for dependency counts and the "waiting on you" list.
 */
export const getWorkspaceTasks = async (projects: Project[]): Promise<WorkspaceTasks> => {
    const user = auth.currentUser;
    if (!user) return { mine: [], others: [] };

    const uniqueProjects = Array.from(
        new Map(projects.map((project) => [`${project.tenantId || 'none'}:${project.id}`, project])).values()
    ).filter(isProjectIncludedInImportantSignals);

    const results = await Promise.all(uniqueProjects.map(async (project) => {
        try {
            const projectTasks = await loadProjectTasks(project.id, project.tenantId);
            return projectTasks.map((task) => ({ ...task, tenantId: project.tenantId }));
        } catch (error) {
            console.warn(`Failed to fetch tasks for project ${project.id}`, error);
            return [] as Task[];
        }
    }));

    const mine: Task[] = [];
    const others: Task[] = [];
    results.flat().forEach((task) => (isAssignedTo(task, user.uid) ? mine : others).push(task));
    return { mine, others };
};
