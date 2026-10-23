import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { completeItem } from '../services/desktopActions';
import { ensureActiveTenantId } from '../services/domain/authService';
import { getPersonalTasks, updatePersonalTask } from '../services/domain/personalTasksService';
import { getSharedProjects, getUserProjects } from '../services/domain/projectsService';
import { updateTaskFields } from '../services/domain/tasksService';
import { getWorkspaceTasks } from '../services/domain/workspaceTasksService';
import { isProjectActiveForGlobalSignals } from '../services/healthService';
import type { PersonalTask, Project, Task } from '../types';
import { buildDayPlan, type DayPlanMessage, type DayPlanStop } from '../utils/dayPlan';
import { addDaysFromToday, toIsoDate } from '../utils/taskDates';
import { browserTimeZone } from '../utils/zonedDate';

const fill = (template: string, params: Record<string, string | number>) => (
    Object.entries(params).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template)
);

/** In-app path of a plan stop. */
export const dayPlanStopPath = (stop: DayPlanStop) => (stop.isPersonal
    ? `/personal-tasks/${stop.taskId}`
    : stop.projectId ? `/project/${stop.projectId}/${stop.itemType === 'initiative' ? 'initiatives' : 'tasks'}/${stop.taskId}` : '/tasks');

/**
 * Desktop utility windows (day start/close, menu bar panel): loads my projects and tasks and builds the same
 * day plan as the Dashboard (utils/dayPlan). Exposes optimistic complete / move-to-tomorrow per stop.
 */
export const useDesktopDayPlan = () => {
    const { user } = useAuth();
    const { t, loadDashboardTranslations } = useLanguage();
    const { focusItem, focusState } = usePinnedTasks();
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [otherTasks, setOtherTasks] = useState<Task[]>([]);
    const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [handled, setHandled] = useState<Record<string, 'done' | 'moved'>>({});
    const timeZone = useMemo(() => browserTimeZone(), []);

    const reload = useCallback(async () => {
        if (!user) return;
        setLoading((current) => current && projects.length === 0);
        try {
            const tenantId = await ensureActiveTenantId();
            const [owned, shared] = await Promise.all([
                getUserProjects(undefined, { hydrateAssets: false }).catch(() => []),
                getSharedProjects({ hydrateAssets: false }).catch(() => [])
            ]);
            const unique = new Map<string, Project>();
            [...owned, ...shared].forEach((project) => unique.set(`${project.tenantId || 'none'}:${project.id}`, project));
            const allProjects = [...unique.values()];
            const [workspaceTasks, personal] = await Promise.all([
                getWorkspaceTasks(allProjects).catch(() => ({ mine: [] as Task[], others: [] as Task[] })),
                getPersonalTasks(tenantId).catch(() => [] as PersonalTask[])
            ]);
            setProjects(allProjects);
            setTasks(workspaceTasks.mine);
            setOtherTasks(workspaceTasks.others);
            setPersonalTasks(personal);
            setHandled({});
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    useEffect(() => { void reload(); }, [reload]);
    // Plan reasons come from the Dashboard's lazy translation bundle.
    useEffect(() => { void loadDashboardTranslations(); }, [loadDashboardTranslations]);

    const activeProjects = useMemo(() => projects.filter(isProjectActiveForGlobalSignals), [projects]);

    const plan = useMemo(() => buildDayPlan({
        now: Date.now(),
        timeZone,
        projects: activeProjects.map((project) => ({ id: project.id, title: project.title, dueDate: project.dueDate })),
        tasks,
        personalTasks,
        otherTasks,
        focus: focusItem ? {
            id: focusItem.id,
            type: focusItem.type,
            title: focusItem.title,
            projectId: focusItem.projectId,
            tenantId: focusItem.tenantId,
            isCompleted: focusItem.isCompleted,
            status: focusState?.status,
            snoozedUntil: focusState?.snoozedUntil
        } : null
    }), [activeProjects, focusItem, focusState?.snoozedUntil, focusState?.status, otherTasks, personalTasks, tasks, timeZone]);

    const message = useCallback((value: DayPlanMessage) => (value.key ? fill(t(value.key), value.params) : value.text || ''), [t]);

    const complete = useCallback(async (stop: DayPlanStop) => {
        setHandled((current) => ({ ...current, [stop.id]: 'done' }));
        try {
            await completeItem({
                id: stop.taskId,
                type: stop.isPersonal ? 'personal-task' : stop.itemType === 'initiative' ? 'initiative' : 'task',
                projectId: stop.projectId || undefined,
                tenantId: stop.tenantId || undefined
            });
            return true;
        } catch {
            setHandled(({ [stop.id]: _removed, ...rest }) => rest);
            return false;
        }
    }, []);

    const moveToTomorrow = useCallback(async (stop: DayPlanStop) => {
        const dueDate = toIsoDate(addDaysFromToday(1));
        setHandled((current) => ({ ...current, [stop.id]: 'moved' }));
        try {
            if (stop.isPersonal) await updatePersonalTask(stop.taskId, { dueDate }, stop.tenantId || undefined);
            else await updateTaskFields(stop.taskId, { dueDate }, stop.projectId || undefined, stop.tenantId || undefined);
            return true;
        } catch {
            setHandled(({ [stop.id]: _removed, ...rest }) => rest);
            return false;
        }
    }, []);

    return { plan, loading, handled, reload, complete, moveToTomorrow, message, projects: activeProjects };
};
