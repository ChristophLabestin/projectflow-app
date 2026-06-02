import { Project, Task, Milestone, Issue, Activity, Comment, Sprint, Initiative, Idea } from '../types';
import { isPmCoreOnly } from '../config/pmCore';
import { toMillis } from '../utils/time';

export type HealthStatus = 'excellent' | 'healthy' | 'normal' | 'warning' | 'critical' | 'stalemate';

export interface HealthFactor {
    id: string;
    label: string;
    description: string;
    impact: number; // Positive or negative
    type: 'positive' | 'negative' | 'neutral';
    labelKey?: string;
    descriptionKey?: string;
    meta?: Record<string, number | string>;
}

export interface ProjectHealth {
    score: number; // 0-100
    status: HealthStatus;
    factors: HealthFactor[];
    recommendations: string[];
    recommendationKeys?: string[];
    trend: 'improving' | 'declining' | 'stable';
    lastUpdated: number;
}

export interface InitiativeHealthSummary {
    score: number;
    status: NonNullable<Initiative['health']>;
    factors: HealthFactor[];
    trend: 'improving' | 'declining' | 'stable';
    lastUpdated: number;
}

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

const isTaskDone = (task: Task) => task.isCompleted || task.status === 'Done';

const getDaysUntil = (value?: string) => {
    if (!value) return null;

    const targetDate = new Date(value);
    if (Number.isNaN(targetDate.getTime())) {
        return null;
    }

    targetDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (targetDate.getTime() - today.getTime()) / DAY;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const isIssueOpen = (issue: Issue) => issue.status !== 'Resolved' && issue.status !== 'Closed';

export const isProjectCanceled = (project?: Pick<Project, 'status'> | null) => project?.status === 'Canceled';

export const isProjectExcludedFromHealth = (project?: Pick<Project, 'status'> | null) => isProjectCanceled(project);

export const isProjectIncludedInImportantSignals = (project: Pick<Project, 'status'>) => !isProjectCanceled(project);

const ACTIVE_GLOBAL_PROJECT_STATUSES: Project['status'][] = ['Active', 'In Testing'];
const ACTIVELY_MANAGED_PROJECT_STATUSES: Project['status'][] = ['Active', 'In Testing', 'Review'];

export const isProjectActiveForGlobalSignals = (project: Project) => (
    ACTIVE_GLOBAL_PROJECT_STATUSES.includes(project.status) && isProjectIncludedInImportantSignals(project)
);

const isProjectActivelyManaged = (project: Project) => (
    ACTIVELY_MANAGED_PROJECT_STATUSES.includes(project.status)
);

const priorityWeight = (priority?: string) => {
    if (priority === 'Urgent') return 2.2;
    if (priority === 'High') return 1.6;
    if (priority === 'Medium') return 1.15;
    return 1;
};

const hasAssignee = (item: {
    assigneeId?: string;
    assigneeIds?: string[];
    assignedGroupIds?: string[];
    assignee?: string;
}) => Boolean(
    item.assigneeId
    || (item.assigneeIds && item.assigneeIds.length > 0)
    || (item.assignedGroupIds && item.assignedGroupIds.length > 0)
    || item.assignee
);

const createdRecently = (value: any, now: number, windowMs = WEEK) => {
    const millis = toMillis(value);
    return millis > 0 && (now - millis) <= windowMs;
};

export const calculateInitiativeHealth = (
    initiative: Initiative,
    tasks: Task[] = [],
    activities: Activity[] = [],
    milestones: Milestone[] = []
): InitiativeHealthSummary => {
    let score = 72;
    const factors: HealthFactor[] = [];
    const now = Date.now();
    const incompleteTasks = tasks.filter((task) => !isTaskDone(task));
    const completedTasks = tasks.length - incompleteTasks.length;
    const blockedTasks = incompleteTasks.filter((task) => task.status === 'Blocked').length;
    const recentCompletions = tasks.filter((task) => {
        if (!isTaskDone(task)) return false;
        const completedAt = toMillis(task.completedAt || task.createdAt);
        return completedAt > 0 && (now - completedAt) < WEEK;
    }).length;

    const dueDays = getDaysUntil(initiative.dueDate);
    if (dueDays !== null) {
        if (dueDays < 0) {
            const overdueDays = Math.abs(Math.floor(dueDays));
            const impact = 24 + Math.min(18, overdueDays * 2);
            score -= impact;
            factors.push({
                id: 'initiative_deadline_overdue',
                label: 'Initiative Deadline Overdue',
                description: `The initiative is ${overdueDays} day(s) past its target date.`,
                impact: -impact,
                type: 'negative',
                meta: { days: overdueDays }
            });
        } else if (dueDays <= 3) {
            score -= 18;
            factors.push({
                id: 'initiative_deadline_imminent',
                label: 'Initiative Deadline Imminent',
                description: 'The initiative is due within the next 72 hours.',
                impact: -18,
                type: 'negative'
            });
        } else if (dueDays <= 14) {
            score -= 6;
            factors.push({
                id: 'initiative_deadline_approaching',
                label: 'Initiative Deadline Approaching',
                description: 'The initiative is due within the next two weeks.',
                impact: -6,
                type: 'neutral'
            });
        }
    }

    const overdueTasks = incompleteTasks.filter((task) => {
        const daysUntil = getDaysUntil(task.dueDate);
        return daysUntil !== null && daysUntil < 0;
    }).length;
    const dueSoonTasks = incompleteTasks.filter((task) => {
        const daysUntil = getDaysUntil(task.dueDate);
        return daysUntil !== null && daysUntil >= 0 && daysUntil <= 3;
    }).length;

    if (blockedTasks > 0) {
        const impact = Math.min(24, blockedTasks * 6);
        score -= impact;
        factors.push({
            id: 'initiative_blocked_tasks',
            label: 'Blocked Work',
            description: `${blockedTasks} linked task(s) are blocked.`,
            impact: -impact,
            type: 'negative',
            meta: { count: blockedTasks }
        });
    }

    if (overdueTasks > 0) {
        const impact = Math.min(26, overdueTasks * 7);
        score -= impact;
        factors.push({
            id: 'initiative_overdue_tasks',
            label: 'Overdue Tasks',
            description: `${overdueTasks} linked task(s) are overdue.`,
            impact: -impact,
            type: 'negative',
            meta: { count: overdueTasks }
        });
    } else if (dueSoonTasks > 0) {
        const impact = Math.min(12, dueSoonTasks * 4);
        score -= impact;
        factors.push({
            id: 'initiative_due_soon_tasks',
            label: 'Tasks Due Soon',
            description: `${dueSoonTasks} linked task(s) are due soon.`,
            impact: -impact,
            type: 'neutral',
            meta: { count: dueSoonTasks }
        });
    }

    if (tasks.length > 0) {
        const progress = (completedTasks / tasks.length) * 100;

        if (progress >= 80 && blockedTasks === 0) {
            score += 10;
            factors.push({
                id: 'initiative_high_progress',
                label: 'Strong Progress',
                description: 'Most linked tasks are already completed.',
                impact: 10,
                type: 'positive'
            });
        } else if (progress >= 40) {
            score += 4;
            factors.push({
                id: 'initiative_progressing',
                label: 'Visible Progress',
                description: 'The initiative is moving forward across linked tasks.',
                impact: 4,
                type: 'positive'
            });
        } else if (tasks.length >= 3 && recentCompletions === 0 && incompleteTasks.length > 0) {
            score -= 8;
            factors.push({
                id: 'initiative_stalled_progress',
                label: 'Stalled Progress',
                description: 'Linked work exists but nothing finished recently.',
                impact: -8,
                type: 'negative'
            });
        }
    } else if (initiative.status !== 'Planning') {
        score -= 10;
        factors.push({
            id: 'initiative_missing_work',
            label: 'No Linked Tasks',
            description: 'The initiative has no linked execution tasks yet.',
            impact: -10,
            type: 'neutral'
        });
    }

    const missedMilestones = milestones.filter((milestone) => (
        milestone.status === 'Missed'
        || (milestone.status === 'Pending' && milestone.dueDate && new Date(milestone.dueDate).getTime() < now)
    )).length;

    if (missedMilestones > 0) {
        const impact = Math.min(18, missedMilestones * 9);
        score -= impact;
        factors.push({
            id: 'initiative_missed_milestones',
            label: 'Milestone Slippage',
            description: `${missedMilestones} linked milestone(s) are missed or overdue.`,
            impact: -impact,
            type: 'negative',
            meta: { count: missedMilestones }
        });
    }

    const lastActivityAt = Math.max(
        toMillis(initiative.updatedAt || initiative.createdAt),
        ...tasks.map((task) => toMillis(task.completedAt || task.createdAt)),
        ...activities.map((activity) => toMillis(activity.createdAt))
    );
    const idleDays = lastActivityAt > 0 ? (now - lastActivityAt) / DAY : 999;

    if (initiative.status !== 'Done') {
        if (idleDays > 14) {
            score -= 16;
            factors.push({
                id: 'initiative_stale',
                label: 'Stale Initiative',
                description: `No meaningful progress was recorded for ${Math.floor(idleDays)} days.`,
                impact: -16,
                type: 'negative',
                meta: { days: Math.floor(idleDays) }
            });
        } else if (idleDays > 7) {
            score -= 7;
            factors.push({
                id: 'initiative_recently_idle',
                label: 'Recent Inactivity',
                description: 'The initiative has been quiet for over a week.',
                impact: -7,
                type: 'neutral'
            });
        } else if (tasks.length > 0 || activities.length > 0) {
            score += 3;
            factors.push({
                id: 'initiative_active',
                label: 'Active Initiative',
                description: 'There has been recent work or activity on this initiative.',
                impact: 3,
                type: 'positive'
            });
        }
    }

    if (initiative.status === 'Blocked') {
        score -= 14;
        factors.push({
            id: 'initiative_blocked_status',
            label: 'Blocked Status',
            description: 'The initiative itself is marked as blocked.',
            impact: -14,
            type: 'negative'
        });
    } else if (initiative.status === 'On Hold') {
        score -= 8;
        factors.push({
            id: 'initiative_on_hold_status',
            label: 'On Hold',
            description: 'The initiative is paused for now.',
            impact: -8,
            type: 'neutral'
        });
    } else if (initiative.status === 'Done') {
        score = Math.max(score, incompleteTasks.length === 0 ? 90 : 62);
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    let status: NonNullable<Initiative['health']> = 'On Track';
    if (score < 40) status = 'Off Track';
    else if (score < 68) status = 'At Risk';

    if (status === 'On Track' && (blockedTasks > 0 || overdueTasks > 0 || initiative.status === 'Blocked')) {
        status = 'At Risk';
    }

    if (status !== 'Off Track' && (
        (initiative.status === 'Blocked' && blockedTasks > 0)
        || overdueTasks >= 2
        || (dueDays !== null && dueDays < 0 && incompleteTasks.length > 0)
    )) {
        status = 'Off Track';
        score = Math.min(score, 38);
    }

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentCompletions > 0 && status === 'On Track') trend = 'improving';
    if (status !== 'On Track' && (blockedTasks > 0 || overdueTasks > 0 || idleDays > 14)) trend = 'declining';

    factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    return {
        score,
        status,
        factors,
        trend,
        lastUpdated: now
    };
};

export const calculateProjectHealth = (
    project: Project,
    tasks: Task[] = [],
    milestones: Milestone[] = [],
    issues: Issue[] = [],
    sprints: Sprint[] = [],
    activities: Activity[] = [],
    comments: Comment[] = [],
    initiatives: Initiative[] = [],
    ideas: Idea[] = []
): ProjectHealth => {
    const now = Date.now();

    if (isPmCoreOnly()) {
        issues = [];
        ideas = [];
    }

    if (isProjectExcludedFromHealth(project)) {
        return {
            score: 0,
            status: 'normal',
            factors: [],
            recommendations: [],
            recommendationKeys: [],
            trend: 'stable',
            lastUpdated: now
        };
    }

    const isTerminalProject = project.status === 'Completed';
    const isPausedProject = project.status === 'On Hold';

    let score = project.status === 'Completed'
        ? 82
        : project.status === 'On Hold'
            ? 54
            : project.status === 'Planning' || project.status === 'Brainstorming' || project.status === 'Backlog'
                ? 60
                : 70;
    const factors: HealthFactor[] = [];
    const recommendationEntries: { key: string; text: string }[] = [];
    const addRecommendation = (key: string, text: string) => {
        recommendationEntries.push({ key, text });
    };
    const addFactor = (factor: HealthFactor) => {
        score += factor.impact;
        factors.push(factor);
    };

    const modules = project.modules || [];
    const moduleEnabled = (moduleId: string) => modules.length === 0 || modules.includes(moduleId as any);
    const activelyManaged = isProjectActivelyManaged(project);
    const incompleteTasks = tasks.filter((task) => !isTaskDone(task));
    const completedTasks = tasks.length - incompleteTasks.length;
    const taskProgress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : (project.progress || 0);
    const openIssues = issues.filter(isIssueOpen);
    const pendingMilestones = milestones.filter((milestone) => milestone.status !== 'Achieved');
    const activeInitiatives = initiatives.filter((initiative) => initiative.status !== 'Done');
    const activeIdeas = ideas.filter((idea) => (
        !idea.convertedTaskId
        && !idea.convertedInitiativeId
        && !idea.convertedCampaignId
    ));
    const openWorkCount = incompleteTasks.length + openIssues.length + pendingMilestones.length + activeInitiatives.length;
    const hasTrackedWork = (
        tasks.length
        + issues.length
        + milestones.length
        + sprints.length
        + initiatives.length
        + ideas.length
        + activities.length
        + comments.length
    ) > 0;

    let recentCompletions = tasks.filter((task) => {
        if (!isTaskDone(task)) return false;
        const completedAt = toMillis(task.completedAt) || toMillis(task.createdAt);
        return completedAt > 0 && (now - completedAt) <= WEEK;
    }).length;
    let overdueTaskCount = 0;
    let urgentOverdueTaskCount = 0;
    let dueSoonTaskCount = 0;
    let urgentDueSoonTaskCount = 0;
    let overdueIssueCount = 0;
    let missedMilestones = 0;
    let blockedTasks = 0;
    let urgentIssues = 0;
    let idleDays = 0;

    if (project.status === 'Completed') {
        if (openWorkCount === 0) {
            addFactor({
                id: 'project_completed_clean',
                label: 'Completed Cleanly',
                labelKey: 'health.factors.project_completed_clean.label',
                description: 'The project is completed without visible open work.',
                descriptionKey: 'health.factors.project_completed_clean.description',
                impact: 8,
                type: 'positive'
            });
        } else {
            addFactor({
                id: 'project_completed_with_open_work',
                label: 'Completed With Open Work',
                labelKey: 'health.factors.project_completed_with_open_work.label',
                description: 'The project is marked completed while work is still open.',
                descriptionKey: 'health.factors.project_completed_with_open_work.description',
                meta: { count: openWorkCount },
                impact: -18,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.closeOpenWork',
                'Close, move, or re-scope the open work before treating the project as fully complete.'
            );
        }
    } else if (isPausedProject) {
        addFactor({
            id: 'project_on_hold',
            label: 'Project On Hold',
            labelKey: 'health.factors.project_on_hold.label',
            description: 'Paused projects are treated as lower momentum until they are reactivated.',
            descriptionKey: 'health.factors.project_on_hold.description',
            impact: -6,
            type: 'neutral'
        });
    }

    // 1. DELIVERY TIMELINE
    const dueDays = getDaysUntil(project.dueDate);
    if (dueDays !== null && !isTerminalProject) {
        if (dueDays < 0) {
            const overdueDays = Math.abs(Math.floor(dueDays));
            const urgency = Math.min(24, overdueDays * 2);
            const impact = -(18 + urgency + Math.min(8, openWorkCount));
            addFactor({
                id: 'deadline_overdue',
                label: 'Deadline Overdue',
                labelKey: 'health.factors.deadline_overdue.label',
                description: `The project passed its deadline ${overdueDays} days ago.`,
                descriptionKey: 'health.factors.deadline_overdue.description',
                meta: { days: overdueDays },
                impact,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.updateDeadline',
                'Update project deadline or complete outstanding core milestones.'
            );
        } else if (dueDays <= 3 && openWorkCount > 0) {
            const impact = -(18 + Math.round((priorityWeight(project.priority) - 1) * 6));
            addFactor({
                id: 'deadline_imminent',
                label: 'Deadline Imminent',
                labelKey: 'health.factors.deadline_imminent.label',
                description: 'The project deadline is less than 3 days away.',
                descriptionKey: 'health.factors.deadline_imminent.description',
                impact,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.prioritizeTasks',
                'Prioritize remaining high-priority tasks to meet the deadline.'
            );
        } else if (dueDays <= 14 && openWorkCount > 0) {
            addFactor({
                id: 'deadline_approaching',
                label: 'Deadline Approaching',
                labelKey: 'health.factors.deadline_approaching.label',
                description: 'The project is due within 2 weeks.',
                descriptionKey: 'health.factors.deadline_approaching.description',
                impact: -5,
                type: 'neutral'
            });
        }
    }

    if (project.startDate && project.dueDate && !isTerminalProject) {
        const startTime = new Date(project.startDate).getTime();
        const dueTime = new Date(project.dueDate).getTime();
        const totalDuration = dueTime - startTime;
        const elapsed = now - startTime;

        if (Number.isFinite(totalDuration) && totalDuration > 0 && elapsed > 0) {
            const expectedProgress = Math.min(100, (elapsed / totalDuration) * 100);
            const progressGap = expectedProgress - taskProgress;

            if (progressGap > 25 && activelyManaged) {
                const impact = -Math.min(20, Math.round(6 + (progressGap / 3)));
                addFactor({
                    id: 'schedule_behind',
                    label: 'Behind Expected Progress',
                    labelKey: 'health.factors.schedule_behind.label',
                    description: `Progress is ${Math.round(progressGap)} points behind the timeline.`,
                    descriptionKey: 'health.factors.schedule_behind.description',
                    meta: {
                        gap: Math.round(progressGap),
                        expected: Math.round(expectedProgress),
                        actual: Math.round(taskProgress)
                    },
                    impact,
                    type: 'negative'
                });
                addRecommendation(
                    'health.recommendations.updateProgress',
                    'Update progress, reduce scope, or pull the next milestone forward so the timeline reflects reality.'
                );
            } else if (progressGap < -20 && taskProgress >= 40) {
                addFactor({
                    id: 'schedule_ahead',
                    label: 'Ahead of Schedule',
                    labelKey: 'health.factors.schedule_ahead.label',
                    description: 'Progress is ahead of the expected timeline.',
                    descriptionKey: 'health.factors.schedule_ahead.description',
                    impact: 5,
                    type: 'positive',
                    meta: {
                        expected: Math.round(expectedProgress),
                        actual: Math.round(taskProgress)
                    }
                });
            }
        }
    }

    // 2. TASK EXECUTION
    if (tasks.length > 0) {
        const completionRate = completedTasks / tasks.length;
        const activeTasks = incompleteTasks.filter((task) => task.status !== 'Backlog' && task.status !== 'On Hold');
        const recentNewTasks = tasks.filter((task) => createdRecently(task.createdAt, now)).length;
        const taskById = new Map(tasks.map((task) => [task.id, task]));
        let overduePressure = 0;
        let dueSoonPressure = 0;

        incompleteTasks.forEach((task) => {
            if (task.status === 'Blocked') {
                blockedTasks += 1;
            }

            const daysUntilTask = getDaysUntil(task.dueDate);
            if (daysUntilTask === null) return;

            const weight = priorityWeight(task.priority);
            if (daysUntilTask < 0) {
                overdueTaskCount += 1;
                overduePressure += weight;
                if (task.priority === 'Urgent' || task.priority === 'High') {
                    urgentOverdueTaskCount += 1;
                }
            } else if (daysUntilTask <= 3) {
                dueSoonTaskCount += 1;
                dueSoonPressure += weight;
                if (task.priority === 'Urgent' || task.priority === 'High') {
                    urgentDueSoonTaskCount += 1;
                }
            }
        });

        if (completionRate >= 0.8 && blockedTasks === 0 && overdueTaskCount === 0) {
            addFactor({
                id: 'strong_task_completion',
                label: 'Strong Task Completion',
                labelKey: 'health.factors.strong_task_completion.label',
                description: 'Most planned tasks are complete without visible blockers.',
                descriptionKey: 'health.factors.strong_task_completion.description',
                impact: 9,
                type: 'positive',
                meta: { percent: Math.round(completionRate * 100) }
            });
        } else if (completionRate < 0.25 && tasks.length >= 4 && activelyManaged) {
            addFactor({
                id: 'low_task_completion',
                label: 'Low Task Completion',
                labelKey: 'health.factors.low_task_completion.label',
                description: 'The project has a substantial task list but little completed work.',
                descriptionKey: 'health.factors.low_task_completion.description',
                impact: -8,
                type: 'negative',
                meta: { percent: Math.round(completionRate * 100) }
            });
        }

        if (recentCompletions >= Math.max(3, Math.ceil(tasks.length * 0.15))) {
            addFactor({
                id: 'high_velocity',
                label: 'High Velocity',
                labelKey: 'health.factors.high_velocity.label',
                description: `${recentCompletions} tasks completed in the last week. Great momentum!`,
                descriptionKey: 'health.factors.high_velocity.description',
                meta: { count: recentCompletions },
                impact: 10,
                type: 'positive'
            });
        } else if (recentCompletions > 0) {
            addFactor({
                id: 'steady_progress',
                label: 'Steady Progress',
                labelKey: 'health.factors.steady_progress.label',
                description: 'Active progress is being made on project tasks.',
                descriptionKey: 'health.factors.steady_progress.description',
                impact: 5,
                type: 'positive'
            });
        } else if (tasks.length > 5 && taskProgress < 90 && activelyManaged) {
            addFactor({
                id: 'stalled_velocity',
                label: 'Stalled Velocity',
                labelKey: 'health.factors.stalled_velocity.label',
                description: 'No tasks completed in the last 7 days.',
                descriptionKey: 'health.factors.stalled_velocity.description',
                impact: -9,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.breakdownTasks',
                'Consider breaking down large tasks to regain momentum.'
            );
        }

        if (recentNewTasks > recentCompletions + Math.max(4, Math.ceil(tasks.length * 0.2)) && tasks.length > 10) {
            addFactor({
                id: 'scope_creep',
                label: 'Scope Creep',
                labelKey: 'health.factors.scope_creep.label',
                description: 'Tasks are being added faster than they are being completed.',
                descriptionKey: 'health.factors.scope_creep.description',
                meta: {
                    added: recentNewTasks,
                    completed: recentCompletions
                },
                impact: -10,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.reviewScope',
                'Review project scope and prioritize essential features.'
            );
        }

        if (overdueTaskCount > 0) {
            const impact = -Math.min(38, Math.round(6 + (overduePressure * 5)));
            addFactor({
                id: 'tasks_overdue',
                label: 'Overdue Tasks',
                labelKey: 'health.factors.tasks_overdue.label',
                description: `${overdueTaskCount} tasks are past their deadline.`,
                descriptionKey: 'health.factors.tasks_overdue.description',
                meta: { count: overdueTaskCount, urgent: urgentOverdueTaskCount },
                impact,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.rescheduleOverdue',
                'Complete or reschedule overdue tasks immediately.'
            );
        } else if (dueSoonTaskCount > 0) {
            const impact = -Math.min(20, Math.round(4 + (dueSoonPressure * 3.5)));
            addFactor({
                id: 'tasks_due_soon',
                label: 'Tasks Due Soon',
                labelKey: 'health.factors.tasks_due_soon.label',
                description: `${dueSoonTaskCount} tasks are due within 72 hours.`,
                descriptionKey: 'health.factors.tasks_due_soon.description',
                meta: { count: dueSoonTaskCount, urgent: urgentDueSoonTaskCount },
                impact,
                type: 'negative'
            });
        }

        if (blockedTasks > 0) {
            const impact = -Math.min(32, 8 + (blockedTasks * 6));
            addFactor({
                id: 'blocked_tasks',
                label: 'Task Blockers',
                labelKey: 'health.factors.blocked_tasks.label',
                description: `${blockedTasks} task(s) are currently blocked.`,
                descriptionKey: 'health.factors.blocked_tasks.description',
                meta: { count: blockedTasks },
                impact,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.resolveBlockers',
                'Resolve dependencies or clear blockers for the restricted tasks.'
            );
        }

        const dependencyBlockedTasks = incompleteTasks.filter((task) => (
            (task.dependencies || []).some((dependencyId) => {
                const dependency = taskById.get(dependencyId);
                return dependency && !isTaskDone(dependency);
            })
        )).length;

        if (dependencyBlockedTasks > 0) {
            const impact = -Math.min(16, 4 + (dependencyBlockedTasks * 4));
            addFactor({
                id: 'dependency_pressure',
                label: 'Dependency Pressure',
                labelKey: 'health.factors.dependency_pressure.label',
                description: `${dependencyBlockedTasks} task(s) are waiting on unfinished dependencies.`,
                descriptionKey: 'health.factors.dependency_pressure.description',
                meta: { count: dependencyBlockedTasks },
                impact,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.clearDependencies',
                'Clear blocking dependencies before starting dependent work.'
            );
        }

        const unassignedPriorityTasks = activeTasks.filter((task) => (
            (task.priority === 'Urgent' || task.priority === 'High')
            && !hasAssignee(task)
        )).length;

        if (unassignedPriorityTasks > 0) {
            addFactor({
                id: 'tasks_without_owner',
                label: 'High-Priority Work Unowned',
                labelKey: 'health.factors.tasks_without_owner.label',
                description: `${unassignedPriorityTasks} high-priority task(s) have no clear owner.`,
                descriptionKey: 'health.factors.tasks_without_owner.description',
                meta: { count: unassignedPriorityTasks },
                impact: -Math.min(12, unassignedPriorityTasks * 4),
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.reassignOwners',
                'Assign owners to the highest-priority open work.'
            );
        }

        const unscheduledPriorityTasks = activeTasks.filter((task) => (
            !task.dueDate
            && (task.priority === 'Urgent' || task.priority === 'High')
            && dueDays !== null
            && dueDays <= 30
        )).length;

        if (unscheduledPriorityTasks > 0) {
            addFactor({
                id: 'tasks_without_due_dates',
                label: 'Priority Work Unscheduled',
                labelKey: 'health.factors.tasks_without_due_dates.label',
                description: `${unscheduledPriorityTasks} high-priority task(s) need a due date.`,
                descriptionKey: 'health.factors.tasks_without_due_dates.description',
                meta: { count: unscheduledPriorityTasks },
                impact: -Math.min(10, unscheduledPriorityTasks * 3),
                type: 'neutral'
            });
            addRecommendation(
                'health.recommendations.scheduleHighPriorityWork',
                'Schedule the highest-priority open work against the project deadline.'
            );
        }
    } else if (moduleEnabled('tasks') && activelyManaged) {
        addFactor({
            id: 'empty_execution_plan',
            label: 'No Execution Tasks',
            labelKey: 'health.factors.empty_execution_plan.label',
            description: 'An active project needs at least a lightweight execution task list.',
            descriptionKey: 'health.factors.empty_execution_plan.description',
            impact: -10,
            type: 'negative'
        });
        addRecommendation(
            'health.recommendations.addExecutionPlan',
            'Add a short task list so project health can track actual execution.'
        );
    }

    // 3. ISSUES AND BLOCKERS
    if (openIssues.length > 0) {
        urgentIssues = openIssues.filter((issue) => issue.priority === 'Urgent' || issue.priority === 'High').length;
        const issuePressure = openIssues.reduce((total, issue) => total + priorityWeight(issue.priority), 0);

        openIssues.forEach((issue) => {
            const daysUntilIssue = getDaysUntil(issue.dueDate || issue.scheduledDate);
            if (daysUntilIssue !== null && daysUntilIssue < 0) {
                overdueIssueCount += 1;
            }
        });

        if (urgentIssues > 0) {
            const impact = -Math.min(30, Math.round(6 + (issuePressure * 4)));
            addFactor({
                id: 'unresolved_issues',
                label: 'Critical Issues',
                labelKey: 'health.factors.unresolved_issues.label',
                description: `${urgentIssues} high-priority issue(s) remain unresolved.`,
                descriptionKey: 'health.factors.unresolved_issues.description',
                meta: { count: urgentIssues },
                impact,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.addressIssues',
                'Address critical issues to stabilize project health.'
            );
        } else {
            addFactor({
                id: 'issue_backlog',
                label: 'Open Issue Backlog',
                labelKey: 'health.factors.issue_backlog.label',
                description: `${openIssues.length} issue(s) are still open.`,
                descriptionKey: 'health.factors.issue_backlog.description',
                meta: { count: openIssues.length },
                impact: -Math.min(14, openIssues.length * 2),
                type: 'neutral'
            });
        }

        if (overdueIssueCount > 0) {
            addFactor({
                id: 'issue_deadlines',
                label: 'Overdue Issues',
                labelKey: 'health.factors.issue_deadlines.label',
                description: `${overdueIssueCount} issue(s) are past their due date.`,
                descriptionKey: 'health.factors.issue_deadlines.description',
                meta: { count: overdueIssueCount },
                impact: -Math.min(22, 6 + (overdueIssueCount * 5)),
                type: 'negative'
            });
        }
    } else if (issues.length > 0) {
        addFactor({
            id: 'no_open_issues',
            label: 'Issue Backlog Clear',
            labelKey: 'health.factors.no_open_issues.label',
            description: 'All tracked issues are resolved or closed.',
            descriptionKey: 'health.factors.no_open_issues.description',
            impact: 4,
            type: 'positive'
        });
    }

    // 4. INITIATIVE HEALTH
    if (initiatives.length > 0) {
        const initiativeHealth = initiatives.map((initiative) => {
            const linkedTasks = tasks.filter((task) => task.initiativeId === initiative.id);
            const linkedMilestones = milestones.filter((milestone) => (
                milestone.linkedInitiativeId === initiative.id
                || (initiative.originIdeaId && milestone.linkedInitiativeId === initiative.originIdeaId)
            ));
            const linkedActivities = activities.filter((activity) => (
                activity.relatedId === initiative.id
                || activity.target === initiative.title
            ));

            return calculateInitiativeHealth(initiative, linkedTasks, linkedActivities, linkedMilestones);
        });

        const offTrackCount = initiativeHealth.filter((item) => item.status === 'Off Track').length;
        const atRiskCount = initiativeHealth.filter((item) => item.status === 'At Risk').length;
        const onTrackCount = initiativeHealth.filter((item) => item.status === 'On Track').length;

        if (offTrackCount > 0 || atRiskCount > 0) {
            const impact = Math.min(26, (offTrackCount * 12) + (atRiskCount * 5));
            addFactor({
                id: 'initiative_health_risk',
                label: 'Initiatives Under Pressure',
                labelKey: 'health.factors.initiative_health_risk.label',
                description: `${offTrackCount + atRiskCount} initiative(s) need attention.`,
                descriptionKey: 'health.factors.initiative_health_risk.description',
                impact: -impact,
                type: 'negative',
                meta: {
                    count: offTrackCount + atRiskCount,
                    offTrack: offTrackCount,
                    atRisk: atRiskCount
                }
            });
            addRecommendation(
                'health.recommendations.reviewInitiatives',
                'Review at-risk initiatives and unblock their linked work before project health slips further.'
            );
        } else if (onTrackCount > 0) {
            const impact = Math.min(8, onTrackCount * 2);
            addFactor({
                id: 'initiative_health_strength',
                label: 'Initiatives On Track',
                labelKey: 'health.factors.initiative_health_strength.label',
                description: `${onTrackCount} initiative(s) are progressing well.`,
                descriptionKey: 'health.factors.initiative_health_strength.description',
                impact,
                type: 'positive',
                meta: { count: onTrackCount }
            });
        }
    }

    // 5. MILESTONES
    missedMilestones = milestones.filter((milestone) => {
        const daysUntilMilestone = getDaysUntil(milestone.dueDate);
        return milestone.status === 'Missed' || (milestone.status === 'Pending' && daysUntilMilestone !== null && daysUntilMilestone < 0);
    }).length;

    if (missedMilestones > 0) {
        const impact = Math.min(30, missedMilestones * 12);
        addFactor({
            id: 'missed_milestones',
            label: 'Milestone Delays',
            labelKey: 'health.factors.missed_milestones.label',
            description: `${missedMilestones} milestone(s) have been missed or are overdue.`,
            descriptionKey: 'health.factors.missed_milestones.description',
            meta: { count: missedMilestones },
            impact: -impact,
            type: 'negative'
        });
        addRecommendation(
            'health.recommendations.replanMilestones',
            'Replan missed milestones to provide a realistic project timeline.'
        );
    }

    if (milestones.length > 0) {
        const achievedMilestones = milestones.filter((milestone) => milestone.status === 'Achieved').length;
        const highRiskMilestones = milestones.filter((milestone) => (
            milestone.status === 'Pending' && milestone.riskRating === 'High'
        )).length;
        const dueSoonMilestones = milestones.filter((milestone) => {
            if (milestone.status !== 'Pending') return false;
            const days = getDaysUntil(milestone.dueDate);
            return days !== null && days >= 0 && days <= 7;
        }).length;

        if (highRiskMilestones > 0) {
            addFactor({
                id: 'high_risk_milestones',
                label: 'High-Risk Milestones',
                labelKey: 'health.factors.high_risk_milestones.label',
                description: `${highRiskMilestones} pending milestone(s) are marked high risk.`,
                descriptionKey: 'health.factors.high_risk_milestones.description',
                meta: { count: highRiskMilestones },
                impact: -Math.min(16, highRiskMilestones * 6),
                type: 'negative'
            });
        } else if (dueSoonMilestones > 0 && missedMilestones === 0) {
            addFactor({
                id: 'milestones_due_soon',
                label: 'Milestones Due Soon',
                labelKey: 'health.factors.milestones_due_soon.label',
                description: `${dueSoonMilestones} milestone(s) are due this week.`,
                descriptionKey: 'health.factors.milestones_due_soon.description',
                meta: { count: dueSoonMilestones },
                impact: -Math.min(10, dueSoonMilestones * 4),
                type: 'neutral'
            });
        }

        if (achievedMilestones > 0 && achievedMilestones / milestones.length >= 0.75 && missedMilestones === 0) {
            addFactor({
                id: 'milestone_progress',
                label: 'Milestones Progressing',
                labelKey: 'health.factors.milestone_progress.label',
                description: 'Most project milestones are already achieved.',
                descriptionKey: 'health.factors.milestone_progress.description',
                meta: { percent: Math.round((achievedMilestones / milestones.length) * 100) },
                impact: 5,
                type: 'positive'
            });
        }
    } else if (moduleEnabled('milestones') && activelyManaged && project.dueDate) {
        addFactor({
            id: 'milestone_plan_missing',
            label: 'No Milestone Plan',
            labelKey: 'health.factors.milestone_plan_missing.label',
            description: 'The project has a delivery deadline but no tracked milestones.',
            descriptionKey: 'health.factors.milestone_plan_missing.description',
            impact: -5,
            type: 'neutral'
        });
    }

    // 6. SPRINTS
    if (sprints.length > 0) {
        const activeSprints = sprints.filter((sprint) => sprint.status === 'Active');
        const overdueSprints = activeSprints.filter((sprint) => {
            const days = getDaysUntil(sprint.endDate);
            return days !== null && days < 0;
        });
        const stalePlanningSprints = sprints.filter((sprint) => {
            const days = getDaysUntil(sprint.startDate);
            return sprint.status === 'Planning' && days !== null && days < 0;
        });

        if (overdueSprints.length > 0) {
            addFactor({
                id: 'sprint_overdue',
                label: 'Overdue Sprint',
                labelKey: 'health.factors.sprint_overdue.label',
                description: `${overdueSprints.length} active sprint(s) passed their end date.`,
                descriptionKey: 'health.factors.sprint_overdue.description',
                meta: { count: overdueSprints.length },
                impact: -Math.min(24, 10 + (overdueSprints.length * 7)),
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.reviewSprint',
                'Close, extend, or re-plan the active sprint.'
            );
        }

        if (stalePlanningSprints.length > 0) {
            addFactor({
                id: 'sprint_not_started',
                label: 'Sprint Not Started',
                labelKey: 'health.factors.sprint_not_started.label',
                description: `${stalePlanningSprints.length} sprint(s) should have started already.`,
                descriptionKey: 'health.factors.sprint_not_started.description',
                meta: { count: stalePlanningSprints.length },
                impact: -Math.min(12, stalePlanningSprints.length * 4),
                type: 'neutral'
            });
        }

        activeSprints.forEach((sprint) => {
            const sprintTasks = tasks.filter((task) => task.sprintId === sprint.id);
            if (sprintTasks.length === 0) {
                addFactor({
                    id: 'sprint_without_work',
                    label: 'Active Sprint Without Work',
                    labelKey: 'health.factors.sprint_without_work.label',
                    description: 'An active sprint has no linked tasks.',
                    descriptionKey: 'health.factors.sprint_without_work.description',
                    impact: -6,
                    type: 'neutral'
                });
                return;
            }

            const sprintDone = sprintTasks.filter(isTaskDone).length;
            const sprintProgress = sprintDone / sprintTasks.length;
            const sprintStart = new Date(sprint.startDate).getTime();
            const sprintEnd = new Date(sprint.endDate).getTime();
            const sprintDuration = sprintEnd - sprintStart;
            const sprintElapsed = sprintDuration > 0 ? (now - sprintStart) / sprintDuration : 0;

            if (sprintElapsed > 0.7 && sprintProgress < 0.5 && overdueSprints.length === 0) {
                addFactor({
                    id: 'sprint_at_risk',
                    label: 'Sprint At Risk',
                    labelKey: 'health.factors.sprint_at_risk.label',
                    description: 'The active sprint is late in its window with less than half the work complete.',
                    descriptionKey: 'health.factors.sprint_at_risk.description',
                    meta: { percent: Math.round(sprintProgress * 100) },
                    impact: -12,
                    type: 'negative'
                });
            } else if (sprintProgress >= 0.5) {
                addFactor({
                    id: 'active_sprint_progress',
                    label: 'Active Sprint Progress',
                    labelKey: 'health.factors.active_sprint_progress.label',
                    description: 'The active sprint has visible linked task progress.',
                    descriptionKey: 'health.factors.active_sprint_progress.description',
                    meta: { percent: Math.round(sprintProgress * 100) },
                    impact: 3,
                    type: 'positive'
                });
            }
        });
    }

    // 7. FLOWS / IDEAS
    if (ideas.length > 0) {
        const reviewQueue = activeIdeas.filter((idea) => idea.stage === 'Review' || idea.stage === 'Submit');
        const approvedUnconverted = ideas.filter((idea) => (
            (idea.stage === 'Approved' || idea.approvedAt)
            && !idea.convertedTaskId
            && !idea.convertedInitiativeId
            && !idea.convertedCampaignId
        ));
        const convertedIdeas = ideas.filter((idea) => (
            idea.convertedTaskId || idea.convertedInitiativeId || idea.convertedCampaignId
        ));
        const highRiskIdeas = activeIdeas.filter((idea) => {
            const analysis = idea.riskWinAnalysis;
            if (!analysis) return false;
            return analysis.successProbability < 45 || analysis.risks.some((risk) => risk.severity === 'High');
        });
        const recentIdeas = ideas.filter((idea) => createdRecently(idea.createdAt || idea.approvedAt, now));

        if (highRiskIdeas.length > 0) {
            addFactor({
                id: 'flow_risk',
                label: 'Flow Risk Detected',
                labelKey: 'health.factors.flow_risk.label',
                description: `${highRiskIdeas.length} active flow(s) carry high risk or low success probability.`,
                descriptionKey: 'health.factors.flow_risk.description',
                meta: { count: highRiskIdeas.length },
                impact: -Math.min(16, 5 + (highRiskIdeas.length * 4)),
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.triageFlowRisks',
                'Triage high-risk flows before converting them into execution work.'
            );
        }

        if (reviewQueue.length > 3) {
            addFactor({
                id: 'flow_review_queue',
                label: 'Flow Review Queue',
                labelKey: 'health.factors.flow_review_queue.label',
                description: `${reviewQueue.length} flows are waiting in review or submit stages.`,
                descriptionKey: 'health.factors.flow_review_queue.description',
                meta: { count: reviewQueue.length },
                impact: -Math.min(12, (reviewQueue.length - 2) * 3),
                type: 'neutral'
            });
            addRecommendation(
                'health.recommendations.focusReviewQueue',
                'Reduce the flow review queue before adding more exploratory work.'
            );
        }

        if (approvedUnconverted.length > 2) {
            addFactor({
                id: 'flow_conversion_gap',
                label: 'Approved Flows Not Executed',
                labelKey: 'health.factors.flow_conversion_gap.label',
                description: `${approvedUnconverted.length} approved flow(s) have not been converted into execution yet.`,
                descriptionKey: 'health.factors.flow_conversion_gap.description',
                meta: { count: approvedUnconverted.length },
                impact: -Math.min(12, approvedUnconverted.length * 3),
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.convertApprovedFlows',
                'Convert approved flows into initiatives, tasks, or campaigns.'
            );
        }

        if (convertedIdeas.length > 0) {
            addFactor({
                id: 'flow_conversion_strength',
                label: 'Flows Reaching Execution',
                labelKey: 'health.factors.flow_conversion_strength.label',
                description: 'Some flows have been converted into executable work.',
                descriptionKey: 'health.factors.flow_conversion_strength.description',
                meta: { count: convertedIdeas.length },
                impact: Math.min(6, convertedIdeas.length * 2),
                type: 'positive'
            });
        }

        if (recentIdeas.length > 0 && activeIdeas.length > 0) {
            addFactor({
                id: 'flow_momentum',
                label: 'Recent Flow Momentum',
                labelKey: 'health.factors.flow_momentum.label',
                description: 'New or recently approved flows show active planning momentum.',
                descriptionKey: 'health.factors.flow_momentum.description',
                meta: { count: recentIdeas.length },
                impact: Math.min(4, recentIdeas.length),
                type: 'positive'
            });
        }
    }

    // 8. ENGAGEMENT AND RECENCY
    const activityMillis = [
        toMillis(project.updatedAt),
        toMillis(project.createdAt),
        ...tasks.flatMap((task) => [toMillis(task.createdAt), toMillis(task.completedAt)]),
        ...issues.flatMap((issue) => [toMillis(issue.createdAt), toMillis(issue.completedAt)]),
        ...milestones.map((milestone) => toMillis(milestone.createdAt)),
        ...sprints.map((sprint) => toMillis(sprint.updatedAt || sprint.createdAt)),
        ...initiatives.flatMap((initiative) => [toMillis(initiative.updatedAt), toMillis(initiative.completedAt), toMillis(initiative.createdAt)]),
        ...ideas.flatMap((idea) => [toMillis(idea.approvedAt), toMillis(idea.convertedAt), toMillis(idea.createdAt)]),
        ...activities.map((activity) => toMillis(activity.createdAt)),
        ...comments.map((comment) => toMillis(comment.createdAt))
    ].filter((millis) => millis > 0);
    const lastActivity = activityMillis.length > 0 ? Math.max(...activityMillis) : 0;
    idleDays = lastActivity > 0 ? (now - lastActivity) / DAY : 999;

    if (!isTerminalProject && project.status !== 'On Hold') {
        if (idleDays > 30) {
            addFactor({
                id: 'stale_project',
                label: 'Stale Project',
                labelKey: 'health.factors.stale_project.label',
                description: `No activity recorded for over ${Math.floor(idleDays)} days.`,
                descriptionKey: 'health.factors.stale_project.description',
                meta: { days: Math.floor(idleDays) },
                impact: -24,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.reactivateProject',
                'Reactivate the project with a status update or team meeting.'
            );
        } else if (idleDays > 10) {
            addFactor({
                id: 'inactive_recent',
                label: 'Recent Inactivity',
                labelKey: 'health.factors.inactive_recent.label',
                description: 'No activity in the last 7 days.',
                descriptionKey: 'health.factors.inactive_recent.description',
                impact: -8,
                type: 'neutral'
            });
        } else if (hasTrackedWork) {
            addFactor({
                id: 'active_engagement',
                label: 'Highly Engaged',
                labelKey: 'health.factors.active_engagement.label',
                description: 'The project has seen recent activity and team engagement.',
                descriptionKey: 'health.factors.active_engagement.description',
                impact: 3,
                type: 'positive'
            });
        }
    }

    const recentComments = comments.filter((comment) => createdRecently(comment.createdAt, now)).length
        + activities.filter((activity) => activity.type === 'comment' && createdRecently(activity.createdAt, now)).length;
    const recentCollaborators = new Set(
        activities
            .filter((activity) => createdRecently(activity.createdAt, now) && activity.user)
            .map((activity) => activity.user)
    ).size;

    if (recentComments >= 3 || recentCollaborators >= 2) {
        addFactor({
            id: 'comment_engagement',
            label: 'Team Engagement',
            labelKey: 'health.factors.comment_engagement.label',
            description: 'Recent comments or multiple contributors show active collaboration.',
            descriptionKey: 'health.factors.comment_engagement.description',
            meta: {
                comments: recentComments,
                collaborators: recentCollaborators
            },
            impact: 4,
            type: 'positive'
        });
    }

    const brief = project.brief || {};
    const hasProjectPurpose = Boolean(
        (typeof project.description === 'string' && project.description.trim())
        || (typeof brief.objective === 'string' && brief.objective.trim())
    );
    const missingBriefFields = [
        hasProjectPurpose ? null : 'purpose',
        Array.isArray(brief.successCriteria) && brief.successCriteria.some((item) => typeof item === 'string' && item.trim()) ? null : 'successCriteria',
        typeof brief.scope === 'string' && brief.scope.trim() ? null : 'scope',
        typeof brief.decisionOwner === 'string' && brief.decisionOwner.trim() ? null : 'decisionOwner',
        brief.cadence ? null : 'cadence'
    ].filter(Boolean);
    const needsProjectBrief = !isTerminalProject && project.status !== 'On Hold';

    if (needsProjectBrief && missingBriefFields.length > 0) {
        addFactor({
            id: 'project_brief_gap',
            label: 'Delivery Setup Incomplete',
            labelKey: 'health.factors.project_brief_gap.label',
            description: 'The project is missing purpose, success criteria, scope, owner, or cadence.',
            descriptionKey: 'health.factors.project_brief_gap.description',
            meta: { count: missingBriefFields.length },
            impact: -Math.min(7, 2 + missingBriefFields.length),
            type: 'neutral'
        });
        addRecommendation(
            'health.recommendations.completeProjectBrief',
            'Complete delivery setup so ProjectFlow can judge health against the real project contract.'
        );
    } else if (needsProjectBrief) {
        addFactor({
            id: 'project_brief_ready',
            label: 'Delivery Setup Ready',
            labelKey: 'health.factors.project_brief_ready.label',
            description: 'The project has a clear purpose, success criteria, scope, owner, and cadence.',
            descriptionKey: 'health.factors.project_brief_ready.description',
            impact: 4,
            type: 'positive'
        });
    }

    if (!hasTrackedWork && activelyManaged) {
        addFactor({
            id: 'project_setup_gap',
            label: 'Project Setup Gap',
            labelKey: 'health.factors.project_setup_gap.label',
            description: 'No tracked work, milestones, flows, activity, or issues are available yet.',
            descriptionKey: 'health.factors.project_setup_gap.description',
            impact: -8,
            type: 'negative'
        });
    }

    const isStartupCompanyProject = project.projectCategory === 'startup_company' || project.templateId === 'startup_company_formation';
    if (isStartupCompanyProject && !isTerminalProject) {
        const startupProfile = project.startupProfile || {};
        const startupReadiness = project.startupReadiness || {};
        const selectedTracks = startupProfile.selectedTrackIds || [];
        const startupTasks = tasks.filter(task => (
            task.templateId === 'startup_company_formation'
            || typeof task.templateTrack === 'string'
            || (Array.isArray(task.category) && task.category.includes('Startup' as any))
        ));
        const legalTrackSelected = selectedTracks.includes('legal_formation');
        const financeTrackSelected = selectedTracks.includes('finance_accounting');
        const complianceTrackSelected = selectedTracks.includes('compliance');
        const validationTrackSelected = selectedTracks.includes('validation');
        const marketingTrackSelected = selectedTracks.includes('marketing_sales');
        const restrictedAdvisorResources = (project.externalResources || []).filter(resource => (
            resource.advisorReviewRequired
            || resource.type === 'advisor'
            || resource.type === 'legal'
            || resource.type === 'finance'
        ));

        if (!startupProfile.jurisdictionCountry && (legalTrackSelected || complianceTrackSelected)) {
            addFactor({
                id: 'startup_jurisdiction_missing',
                label: 'Startup Jurisdiction Missing',
                labelKey: 'health.factors.startup_jurisdiction_missing.label',
                description: 'Formation or compliance work is selected without a jurisdiction country.',
                descriptionKey: 'health.factors.startup_jurisdiction_missing.description',
                impact: -10,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.startupSetJurisdiction',
                'Set the startup jurisdiction before relying on legal, tax, or compliance work.'
            );
        }

        if (startupProfile.jurisdictionCountry && !startupProfile.jurisdictionTemplateId) {
            addFactor({
                id: 'startup_jurisdiction_template_missing',
                label: 'Jurisdiction Template Missing',
                labelKey: 'health.factors.startup_jurisdiction_template_missing.label',
                description: 'The startup has a jurisdiction country but no source-backed template metadata.',
                descriptionKey: 'health.factors.startup_jurisdiction_template_missing.description',
                impact: -5,
                type: 'neutral'
            });
            addRecommendation(
                'health.recommendations.startupRefreshJurisdictionTemplate',
                'Refresh the startup profile so official source metadata is attached.'
            );
        }

        if (startupProfile.regulatedIndustryStatus === 'unknown' || (startupProfile.regulatedIndustryStatus === undefined && startupProfile.regulatedIndustry === undefined)) {
            addFactor({
                id: 'startup_compliance_unknown',
                label: 'Compliance Unknown',
                labelKey: 'health.factors.startup_compliance_unknown.label',
                description: 'The regulated-industry risk is not classified yet.',
                descriptionKey: 'health.factors.startup_compliance_unknown.description',
                impact: -7,
                type: 'neutral'
            });
            addRecommendation(
                'health.recommendations.startupClassifyRegulatoryRisk',
                'Classify whether the startup operates in a regulated area before launch.'
            );
        }

        if (startupProfile.hasCoFounders && !startupReadiness.founderAgreementReady) {
            addFactor({
                id: 'startup_founder_agreement_gap',
                label: 'Founder Decision Needed',
                labelKey: 'health.factors.startup_founder_agreement_gap.label',
                description: 'Co-founder setup exists but founder agreement readiness is not marked complete.',
                descriptionKey: 'health.factors.startup_founder_agreement_gap.description',
                impact: -9,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.startupFounderAgreement',
                'Track founder agreement and IP assignment readiness before formation or launch decisions.'
            );
        }

        if (financeTrackSelected && (!startupReadiness.taxSetupReady || !startupReadiness.bankAccountReady || !startupReadiness.bookkeepingReady)) {
            addFactor({
                id: 'startup_finance_setup_missing',
                label: 'Finance Setup Missing',
                labelKey: 'health.factors.startup_finance_setup_missing.label',
                description: 'Tax, bank, or bookkeeping readiness is still incomplete.',
                descriptionKey: 'health.factors.startup_finance_setup_missing.description',
                impact: -8,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.startupFinanceSetup',
                'Complete the finance/accounting setup before treating the company as operationally ready.'
            );
        }

        if ((legalTrackSelected || financeTrackSelected || complianceTrackSelected) && restrictedAdvisorResources.length === 0) {
            addFactor({
                id: 'startup_advisor_resource_missing',
                label: 'Advisor Resource Missing',
                labelKey: 'health.factors.startup_advisor_resource_missing.label',
                description: 'Sensitive legal, finance, or compliance work has no classified advisor resource.',
                descriptionKey: 'health.factors.startup_advisor_resource_missing.description',
                impact: -5,
                type: 'neutral'
            });
            addRecommendation(
                'health.recommendations.startupAddAdvisorResource',
                'Add a restricted advisor, legal, or finance resource in project settings before relying on sensitive decisions.'
            );
        }

        if (complianceTrackSelected && (!startupReadiness.privacyDocsReady || !startupReadiness.requiredPermitsKnown)) {
            addFactor({
                id: 'startup_launch_gate_blocked',
                label: 'Launch Gate Blocked',
                labelKey: 'health.factors.startup_launch_gate_blocked.label',
                description: 'Compliance, privacy, or permit readiness is not complete.',
                descriptionKey: 'health.factors.startup_launch_gate_blocked.description',
                impact: -8,
                type: 'negative'
            });
            addRecommendation(
                'health.recommendations.startupReviewLaunchGate',
                'Review launch-critical compliance, privacy, and permit tasks before shipping publicly.'
            );
        }

        if (validationTrackSelected && !startupTasks.some(task => task.templateTrack === 'validation' && isTaskDone(task))) {
            addFactor({
                id: 'startup_validation_evidence_stale',
                label: 'Validation Evidence Missing',
                labelKey: 'health.factors.startup_validation_evidence_stale.label',
                description: 'No completed validation task is visible yet.',
                descriptionKey: 'health.factors.startup_validation_evidence_stale.description',
                impact: -6,
                type: 'neutral'
            });
        }

        if (marketingTrackSelected && !startupReadiness.firstChannelReady) {
            addFactor({
                id: 'startup_gtm_channel_missing',
                label: 'Go-To-Market Channel Missing',
                labelKey: 'health.factors.startup_gtm_channel_missing.label',
                description: 'The first sales or marketing channel is not marked ready.',
                descriptionKey: 'health.factors.startup_gtm_channel_missing.description',
                impact: -5,
                type: 'neutral'
            });
        }

        if (startupTasks.length >= 8) {
            addFactor({
                id: 'startup_operating_workflow_ready',
                label: 'Startup Workflow Ready',
                labelKey: 'health.factors.startup_operating_workflow_ready.label',
                description: 'Startup formation work is tracked as editable ProjectFlow tasks.',
                descriptionKey: 'health.factors.startup_operating_workflow_ready.description',
                impact: 5,
                type: 'positive'
            });
        }
    }

    // Guardrails keep severe live risks from being hidden by unrelated positives.
    score = clampScore(score);
    if (!isTerminalProject && dueDays !== null && dueDays < 0 && openWorkCount > 0) score = Math.min(score, 34);
    if (!isTerminalProject && (urgentOverdueTaskCount > 0 || overdueIssueCount > 0)) score = Math.min(score, 42);
    if (!isTerminalProject && (blockedTasks >= 3 || urgentIssues >= 3)) score = Math.min(score, 50);
    if (!isTerminalProject && urgentDueSoonTaskCount > 0 && score > 58) score = 58;
    if (!hasTrackedWork && activelyManaged) score = Math.min(score, 62);
    if (project.status === 'Completed' && openWorkCount === 0 && missedMilestones === 0) score = Math.max(score, 88);
    score = clampScore(score);

    let status: HealthStatus = 'normal';
    if (score >= 88) status = 'excellent';
    else if (score >= 74) status = 'healthy';
    else if (score >= 55) status = 'normal';
    else if (score >= 35) status = 'warning';
    else status = 'critical';

    if (taskProgress < 100 && idleDays > 30 && status !== 'critical' && !isPausedProject && project.status !== 'Completed') {
        status = 'stalemate';
    }

    const negativeImpact = factors
        .filter((factor) => factor.type === 'negative')
        .reduce((total, factor) => total + Math.abs(factor.impact), 0);
    const positiveImpact = factors
        .filter((factor) => factor.type === 'positive')
        .reduce((total, factor) => total + factor.impact, 0);

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (
        recentCompletions > 0
        && score >= 60
        && positiveImpact >= Math.max(4, negativeImpact * 0.65)
        && blockedTasks === 0
        && overdueTaskCount === 0
    ) {
        trend = 'improving';
    }
    if (
        score < 55
        || overdueTaskCount > 0
        || blockedTasks > 0
        || urgentIssues > 0
        || idleDays > 21
    ) {
        trend = 'declining';
    }

    // Sort factors by impact magnitude logic:
    // 1. If status is critical/warning, prioritize negative factors
    // 2. Otherwise sort by absolute impact
    factors.sort((a, b) => {
        if (status === 'critical' || status === 'warning') {
            if (a.type === 'negative' && b.type !== 'negative') return -1;
            if (b.type === 'negative' && a.type !== 'negative') return 1;
        }
        return Math.abs(b.impact) - Math.abs(a.impact);
    });

    const uniqueRecommendations: { key: string; text: string }[] = [];
    const seenRecommendations = new Set<string>();
    recommendationEntries.forEach(recommendation => {
        if (seenRecommendations.has(recommendation.key)) return;
        seenRecommendations.add(recommendation.key);
        uniqueRecommendations.push(recommendation);
    });

    return {
        score,
        status,
        factors,
        recommendations: uniqueRecommendations.map(recommendation => recommendation.text),
        recommendationKeys: uniqueRecommendations.map(recommendation => recommendation.key),
        trend,
        lastUpdated: now
    };
};

export interface SpotlightReason {
    key: string;
    text: string;
    weight: number;
    meta?: Record<string, number | string>;
}

export interface SpotlightScore {
    score: number;
    reasons: SpotlightReason[];  // All contributing reasons with weights
    primaryReason: string;       // Main reason text for display
    primaryReasonKey?: string;   // i18n key for primary reason
    primaryReasonMeta?: Record<string, number | string>;
    // Legacy fields for backwards compatibility
    reason: string;
    reasonKey?: string;
    reasonMeta?: Record<string, number | string>;
}

export const calculateSpotlightScore = (
    project: Project,
    tasks: Task[] = [],
    milestones: Milestone[] = [],
    issues: Issue[] = [],
    sprints: Sprint[] = [],
    activities: Activity[] = []
): SpotlightScore => {
    if (isProjectExcludedFromHealth(project)) {
        const reason = {
            key: 'health.spotlight.excludedCanceled',
            text: 'Canceled projects are excluded from spotlight',
            weight: 0
        };
        return {
            score: -10000,
            reasons: [reason],
            primaryReason: reason.text,
            primaryReasonKey: reason.key,
            reason: reason.text,
            reasonKey: reason.key
        };
    }

    let score = 0;
    const reasons: SpotlightReason[] = [];
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const WEEK = 7 * DAY;

    const addReason = (key: string, text: string, weight: number, meta?: Record<string, number | string>) => {
        reasons.push({ key, text, weight, meta });
        score += weight;
    };

    // 1. PROJECT DEADLINE URGENCY (Highest Priority Factor)
    if (project.dueDate) {
        const dueTime = new Date(project.dueDate).getTime();
        const daysUntilDue = (dueTime - now) / DAY;

        if (daysUntilDue < 0) {
            const overdueDays = Math.abs(Math.floor(daysUntilDue));
            addReason(
                'health.spotlight.projectOverdue',
                `Project is ${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue`,
                100,
                { days: overdueDays }
            );
        } else if (daysUntilDue <= 1) {
            addReason('health.spotlight.projectDueToday', 'Project due today/tomorrow', 60);
        } else if (daysUntilDue <= 3) {
            addReason('health.spotlight.projectDueSoon', `Due in ${Math.ceil(daysUntilDue)} days`, 40, { days: Math.ceil(daysUntilDue) });
        } else if (daysUntilDue <= 7) {
            addReason('health.spotlight.projectDueThisWeek', 'Due this week', 20);
        }
    }

    // 2. HIGH PRIORITY PROJECT BOOST
    if (project.priority === 'Urgent') {
        addReason('health.spotlight.urgentPriority', 'Marked as urgent priority', 30);
    } else if (project.priority === 'High') {
        addReason('health.spotlight.highPriority', 'High priority project', 15);
    }

    // 3. TASK URGENCY ANALYSIS
    const incompleteTasks = tasks.filter(t => !t.isCompleted && t.status !== 'Done');
    let overdueTaskCount = 0;
    let overdueCriticalCount = 0;
    let blockedCount = 0;
    let dueTodayCount = 0;
    let dueSoonCount = 0; // Within 3 days
    let dueThisWeekCount = 0;

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    incompleteTasks.forEach(t => {
        // Count blocked tasks
        if (t.status === 'Blocked') {
            blockedCount++;
        }

        if (!t.dueDate) return;

        const taskDate = new Date(t.dueDate);
        taskDate.setHours(0, 0, 0, 0);
        const diffTime = taskDate.getTime() - todayMidnight.getTime();
        const diffDays = diffTime / DAY;

        if (diffDays < 0) {
            // OVERDUE
            overdueTaskCount++;
            if (t.priority === 'Urgent' || t.priority === 'High') {
                overdueCriticalCount++;
            }
        } else if (diffDays === 0) {
            // DUE TODAY
            dueTodayCount++;
        } else if (diffDays <= 3) {
            // DUE SOON (1-3 days)
            dueSoonCount++;
        } else if (diffDays <= 7) {
            // DUE THIS WEEK
            dueThisWeekCount++;
        }
    });

    // Add task-based reasons with weights
    if (overdueCriticalCount > 0) {
        addReason(
            'health.spotlight.criticalOverdueTasks',
            `${overdueCriticalCount} critical overdue task${overdueCriticalCount !== 1 ? 's' : ''}`,
            overdueCriticalCount * 50,
            { count: overdueCriticalCount }
        );
    } else if (overdueTaskCount > 0) {
        addReason(
            'health.spotlight.overdueTasks',
            `${overdueTaskCount} overdue task${overdueTaskCount !== 1 ? 's' : ''}`,
            overdueTaskCount * 25,
            { count: overdueTaskCount }
        );
    }

    if (dueTodayCount > 0) {
        addReason(
            'health.spotlight.tasksDueToday',
            `${dueTodayCount} task${dueTodayCount !== 1 ? 's' : ''} due today`,
            dueTodayCount * 35,
            { count: dueTodayCount }
        );
    }

    if (dueSoonCount > 0) {
        addReason(
            'health.spotlight.tasksDueSoon',
            `${dueSoonCount} task${dueSoonCount !== 1 ? 's' : ''} due in next 3 days`,
            dueSoonCount * 15,
            { count: dueSoonCount }
        );
    }

    if (blockedCount > 0) {
        addReason(
            'health.spotlight.blockedTasks',
            `${blockedCount} blocked task${blockedCount !== 1 ? 's' : ''} need attention`,
            blockedCount * 20,
            { count: blockedCount }
        );
    }

    // 4. MILESTONE URGENCY
    const pendingMilestones = milestones.filter(m => m.status === 'Pending');
    let overdueMilestones = 0;
    let imminentMilestones = 0;

    pendingMilestones.forEach(m => {
        if (m.dueDate) {
            const dueTime = new Date(m.dueDate).getTime();
            const diffDays = (dueTime - now) / DAY;

            if (dueTime < now) {
                overdueMilestones++;
            } else if (diffDays < 7) {
                imminentMilestones++;
            }
        }
    });

    if (overdueMilestones > 0) {
        addReason(
            'health.spotlight.overdueMilestones',
            `${overdueMilestones} overdue milestone${overdueMilestones !== 1 ? 's' : ''}`,
            overdueMilestones * 60,
            { count: overdueMilestones }
        );
    } else if (imminentMilestones > 0) {
        addReason(
            'health.spotlight.milestonesDueSoon',
            `${imminentMilestones} milestone${imminentMilestones !== 1 ? 's' : ''} due this week`,
            imminentMilestones * 30,
            { count: imminentMilestones }
        );
    }

    // 5. ISSUE PRESSURE
    const openIssues = issues.filter(i => i.status !== 'Resolved' && i.status !== 'Closed');
    const urgentIssues = openIssues.filter(i => i.priority === 'Urgent').length;
    const highPriorityIssues = openIssues.filter(i => i.priority === 'High').length;
    const criticalIssues = urgentIssues + highPriorityIssues;

    if (urgentIssues > 0) {
        addReason(
            'health.spotlight.urgentIssues',
            `${urgentIssues} urgent issue${urgentIssues !== 1 ? 's' : ''} open`,
            urgentIssues * 40,
            { count: urgentIssues }
        );
    } else if (highPriorityIssues > 0) {
        addReason(
            'health.spotlight.highPriorityIssues',
            `${highPriorityIssues} high-priority issue${highPriorityIssues !== 1 ? 's' : ''} open`,
            highPriorityIssues * 20,
            { count: highPriorityIssues }
        );
    }

    // 6. ACTIVITY & ENGAGEMENT (Recent activity indicates active work)
    if (activities.length > 0) {
        const recentActivityCount = activities.filter(a => {
            const createdAt = a.createdAt ? (typeof a.createdAt === 'object' && 'toMillis' in a.createdAt ? a.createdAt.toMillis() : toMillis(a.createdAt)) : 0;
            return (now - createdAt) < WEEK;
        }).length;

        if (recentActivityCount > 10) {
            addReason(
                'health.spotlight.highlyActive',
                'Highly active with recent updates',
                15,
                { activityCount: recentActivityCount }
            );
        } else if (recentActivityCount > 0) {
            addReason(
                'health.spotlight.recentActivity',
                'Recent project activity',
                5,
                { activityCount: recentActivityCount }
            );
        }
    }

    // 7. PROGRESS VS DEADLINE TRACKING
    if (project.dueDate && project.startDate) {
        const startTime = new Date(project.startDate).getTime();
        const dueTime = new Date(project.dueDate).getTime();
        const totalDuration = dueTime - startTime;
        const elapsed = now - startTime;

        if (totalDuration > 0 && elapsed > 0) {
            const expectedProgress = Math.min(100, (elapsed / totalDuration) * 100);
            const actualProgress = project.progress || 0;
            const progressGap = expectedProgress - actualProgress;

            if (progressGap > 30 && actualProgress < 80) {
                addReason(
                    'health.spotlight.behindSchedule',
                    `${Math.round(progressGap)}% behind expected progress`,
                    Math.min(40, progressGap),
                    { gap: Math.round(progressGap), expected: Math.round(expectedProgress), actual: actualProgress }
                );
            }
        }
    }

    // --- SPRINT ANALYSIS ---
    const activeSprints = sprints.filter(s => s.status === 'Active');
    const overdueSprints = sprints.filter(s => s.status === 'Active' && s.endDate && new Date(s.endDate).getTime() < now);

    if (overdueSprints.length > 0) {
        addReason(
            'health.spotlight.overdueSprints',
            `${overdueSprints.length} overdue sprint${overdueSprints.length !== 1 ? 's' : ''}`,
            70,
            { count: overdueSprints.length }
        );
    } else if (activeSprints.length > 0) {
        addReason(
            'health.spotlight.activeSprint',
            'Active sprint in progress',
            10,
            { count: activeSprints.length }
        );
    }

    // 8. LOW PROGRESS WARNING
    if ((project.status === 'Active' || project.status === 'In Testing') && (project.progress || 0) < 20) {
        const progress = project.progress || 0;
        if (!reasons.some(r => r.key === 'health.spotlight.behindSchedule')) {
            addReason(
                'health.spotlight.lowProgress',
                `Only ${progress}% complete`,
                20,
                { progress }
            );
        }
    }

    // 9. STATUS WEIGHT
    if (project.status === 'Active' || project.status === 'In Testing') {
        score += 10; // Baseline boost for active projects
    } else if (project.status === 'Brainstorming' || project.status === 'Planning' || project.status === 'Backlog') {
        score -= 500; // Strong penalty for non-active projects
    } else if (project.status === 'On Hold') {
        score -= 200; // Moderate penalty for on-hold
    } else if (project.status === 'Canceled') {
        score -= 600; // Canceled projects should never win spotlight.
    }

    // Sort reasons by weight (highest first)
    reasons.sort((a, b) => b.weight - a.weight);

    // Build the primary reason - if no urgency reasons, use a fallback
    const primaryReason = reasons[0] || {
        key: 'health.spotlight.recentlyUpdated',
        text: 'Recently updated',
        weight: 0
    };

    // Ensure reasons array has at least the primary reason
    if (reasons.length === 0) {
        reasons.push({
            key: primaryReason.key,
            text: primaryReason.text,
            weight: primaryReason.weight,
        });
    }

    return {
        score,
        reasons,
        primaryReason: primaryReason.text,
        primaryReasonKey: primaryReason.key,
        primaryReasonMeta: primaryReason.meta,
        // Legacy fields
        reason: primaryReason.text,
        reasonKey: primaryReason.key,
        reasonMeta: primaryReason.meta
    };
};

// --- WORKSPACE HEALTH ---

export interface WorkspaceHealth {
    score: number;
    status: HealthStatus;
    breakdown: {
        critical: number;
        warning: number;
        healthy: number;
        excellent: number;
        normal: number;
        total: number;
    };
    trend: 'improving' | 'declining' | 'stable';
}

export const calculateWorkspaceHealth = (projects: Project[], healthMap: Record<string, ProjectHealth>): WorkspaceHealth => {
    const activeProjects = projects.filter(isProjectActiveForGlobalSignals);

    if (activeProjects.length === 0) {
        return {
            score: 0,
            status: 'normal',
            breakdown: { critical: 0, warning: 0, healthy: 0, excellent: 0, normal: 0, total: 0 },
            trend: 'stable'
        };
    }

    let totalScore = 0;
    let totalWeight = 0;
    const breakdown = { critical: 0, warning: 0, healthy: 0, excellent: 0, normal: 0, total: 0 };
    let decliningProjects = 0;
    let improvingProjects = 0;

    activeProjects.forEach(p => {
        const health = healthMap[p.id];
        if (!health) return;

        breakdown.total++;
        if (health.status === 'critical') breakdown.critical++;
        else if (health.status === 'warning') breakdown.warning++;
        else if (health.status === 'excellent') breakdown.excellent++;
        else if (health.status === 'healthy') breakdown.healthy++;
        else breakdown.normal++;

        if (health.trend === 'declining') decliningProjects++;
        if (health.trend === 'improving') improvingProjects++;

        // Weighting Logic
        let weight = 1;

        // Critical projects pull the score harder (risk awareness)
        if (health.status === 'critical') weight = 3;
        else if (health.status === 'warning') weight = 2;

        // Urgent priority projects matter more
        if (p.priority === 'Urgent') weight *= 1.5;

        totalScore += (health.score * weight);
        totalWeight += weight;
    });

    const avgScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

    let status: HealthStatus = 'normal';
    if (avgScore >= 90) status = 'excellent';
    else if (avgScore >= 75) status = 'healthy';
    else if (avgScore >= 50) status = 'normal';
    else if (avgScore >= 30) status = 'warning';
    else status = 'critical';

    // Override: If > 20% of projects are critical, workspace cannot be healthy
    if (breakdown.total > 0 && (breakdown.critical / breakdown.total) > 0.2) {
        if (avgScore > 49) status = 'warning';
    }

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (decliningProjects > improvingProjects) trend = 'declining';
    else if (improvingProjects > decliningProjects) trend = 'improving';

    return {
        score: avgScore,
        status,
        breakdown,
        trend
    };
};
