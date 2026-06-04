import { useEffect, useMemo, useState } from 'react';
import {
    subscribeProjectTasks,
    subscribeProjectActivity,
    subscribeProjectInitiatives
} from '../../../../services/dataService';
import { subscribeProjectGroups } from '../../../../services/projectGroupService';
import { subscribeProjectMilestones } from '../../../../services/domain/projectMetaService';
import { subscribeProjectSprints } from '../../../../services/sprintService';
import { getProjectById } from '../../../../services/domain/projectsService';
import { getSubTasks } from '../../../../services/domain/tasksService';
import { getUserProfile } from '../../../../services/domain/usersService';
import { getLatestGeminiReport, saveHealthSnapshot } from '../../../../services/domain/projectInsightsService';
import { getWorkspaceRoles } from '../../../../services/rolesService';
import { calculateProjectHealth, isProjectExcludedFromHealth, type ProjectHealth } from '../../../../services/healthService';
import { auth } from '../../../../services/firebase';
import type {
    Activity,
    CustomRole,
    GeminiReport,
    Initiative,
    Milestone,
    Project,
    ProjectGroup,
    Sprint,
    Task
} from '../../../../types';

export type SubtaskStats = Record<string, { done: number; total: number }>;

export type ProjectOverviewData = {
    loading: boolean;
    error: string | null;
    unauthorized: boolean;
    project: Project | null;
    setProject: React.Dispatch<React.SetStateAction<Project | null>>;
    tasks: Task[];
    initiatives: Initiative[];
    projectGroups: ProjectGroup[];
    activity: Activity[];
    ideas: [];
    issues: [];
    milestones: Milestone[];
    sprints: Sprint[];
    workspaceRoles: CustomRole[];
    subtaskStats: SubtaskStats;
    latestReport: GeminiReport | null;
    health: ProjectHealth | null;
};

/**
 * Single source of truth for the redesigned project overview.
 *
 * Owns the project load + authorization gate, all real-time subscriptions
 * (tasks, initiatives, groups, activity, milestones, sprints),
 * the derived subtask stats, the latest pinned report, and the daily health
 * snapshot. Everything downstream of this hook is pure/derived.
 */
export const useProjectOverviewData = (
    projectId: string | undefined,
    t: (key: string, fallback?: string) => string
): ProjectOverviewData => {
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [initiatives, setInitiatives] = useState<Initiative[]>([]);
    const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [workspaceRoles, setWorkspaceRoles] = useState<CustomRole[]>([]);
    const [subtaskStats, setSubtaskStats] = useState<SubtaskStats>({});
    const [latestReport, setLatestReport] = useState<GeminiReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [unauthorized, setUnauthorized] = useState(false);

    // Project load + authorization gate + real-time subscriptions.
    useEffect(() => {
        let cleanup: (() => void) | undefined;
        let active = true;

        const run = async () => {
            if (!projectId) {
                setLoading(false);
                return;
            }
            setError(null);
            setUnauthorized(false);
            try {
                const projData = await getProjectById(projectId);
                if (!active) return;
                if (!projData) {
                    setError(t('projectOverview.error.notFound'));
                    setProject(null);
                    setLoading(false);
                    return;
                }
                setProject(projData);

                if (auth.currentUser) {
                    const tenantProfile = await getUserProfile(auth.currentUser.uid, projData.tenantId);
                    const projectMembers = projData.members || [];
                    const isProjectMember = projectMembers.some((m) =>
                        (typeof m === 'string' ? m : m.userId) === auth.currentUser?.uid
                    ) || projData.ownerId === auth.currentUser?.uid;

                    if (!tenantProfile && !isProjectMember) {
                        if (!active) return;
                        setUnauthorized(true);
                        setLoading(false);
                        return;
                    }
                    if (projData.isPrivate && !isProjectMember) {
                        if (!active) return;
                        setUnauthorized(true);
                        setLoading(false);
                        return;
                    }
                }

                getLatestGeminiReport(projectId).then((latest) => {
                    if (active) setLatestReport(latest);
                }).catch(() => undefined);

                const unsubTasks = subscribeProjectTasks(projectId, setTasks, projData.tenantId);
                const unsubInitiatives = subscribeProjectInitiatives(projectId, setInitiatives, projData.tenantId);
                const unsubGroups = subscribeProjectGroups(projectId, setProjectGroups, projData.tenantId);
                const unsubActivity = subscribeProjectActivity(projectId, setActivity, projData.tenantId);
                const unsubMilestones = subscribeProjectMilestones(projectId, setMilestones, projData.tenantId);
                const unsubSprints = subscribeProjectSprints(projectId, setSprints, projData.tenantId);

                getWorkspaceRoles(projData.tenantId).then((roles) => {
                    if (active) setWorkspaceRoles(roles);
                }).catch(() => undefined);

                cleanup = () => {
                    unsubTasks();
                    unsubInitiatives();
                    unsubGroups();
                    unsubActivity();
                    unsubMilestones();
                    unsubSprints();
                };
            } catch (err) {
                console.error(err);
                if (active) setError(t('projectOverview.error.load'));
            } finally {
                if (active) setLoading(false);
            }
        };

        void run();
        return () => {
            active = false;
            cleanup?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    // Subtask roll-up for progress indicators.
    useEffect(() => {
        let active = true;
        const load = async () => {
            if (!tasks.length) {
                setSubtaskStats({});
                return;
            }
            try {
                const entries = await Promise.all(tasks.map(async (task) => {
                    const subs = await getSubTasks(task.id, project?.id, project?.tenantId);
                    const done = subs.filter((s) => s.isCompleted).length;
                    return [task.id, { done, total: subs.length }] as const;
                }));
                if (active) setSubtaskStats(Object.fromEntries(entries));
            } catch (err) {
                console.warn('Failed to load subtask stats', err);
            }
        };
        void load();
        return () => { active = false; };
    }, [tasks, project?.id, project?.tenantId]);

    // Project health (memoized) + daily snapshot.
    const health = useMemo<ProjectHealth | null>(() => {
        if (!project || isProjectExcludedFromHealth(project)) return null;
        return calculateProjectHealth(project, tasks, milestones, [], sprints, activity, [], initiatives, []);
    }, [project, tasks, milestones, sprints, activity, initiatives]);

    useEffect(() => {
        if (!projectId || !project?.tenantId || !health) return;
        saveHealthSnapshot(projectId, health.score, health.status, health.trend, project.tenantId)
            .catch((err) => console.warn('Failed to save health snapshot:', err));
    }, [projectId, project?.tenantId, health]);

    return {
        loading,
        error,
        unauthorized,
        project,
        setProject,
        tasks,
        initiatives,
        projectGroups,
        activity,
        ideas: [],
        issues: [],
        milestones,
        sprints,
        workspaceRoles,
        subtaskStats,
        latestReport,
        health
    };
};
