import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    calculateProjectHealth,
    calculateWorkspaceHealth,
    isProjectActiveForGlobalSignals,
    isProjectExcludedFromHealth,
    type ProjectHealth
} from '../healthService';
import type { Activity, Idea, Initiative, Issue, Milestone, Project, Sprint, Task } from '../../types';

const baseProject = (overrides: Partial<Project> = {}): Project => ({
    id: 'project-1',
    title: 'Launch',
    description: '',
    progress: 50,
    status: 'Active',
    startDate: '2026-05-01',
    dueDate: '2026-06-15',
    ownerId: 'user-1',
    tenantId: 'tenant-1',
    modules: ['tasks', 'issues', 'milestones', 'sprints', 'initiatives', 'ideas', 'activity'],
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-05-24T08:00:00.000Z',
    ...overrides
});

const task = (overrides: Partial<Task>): Task => ({
    id: overrides.id || 'task-1',
    projectId: 'project-1',
    ownerId: 'user-1',
    title: overrides.title || 'Task',
    isCompleted: false,
    status: 'In Progress',
    createdAt: '2026-05-15T08:00:00.000Z',
    ...overrides
});

const issue = (overrides: Partial<Issue>): Issue => ({
    id: overrides.id || 'issue-1',
    projectId: 'project-1',
    tenantId: 'tenant-1',
    ownerId: 'user-1',
    title: overrides.title || 'Issue',
    description: '',
    status: 'Open',
    priority: 'Medium',
    reporter: 'Reporter',
    createdAt: '2026-05-10T08:00:00.000Z',
    ...overrides
});

const milestone = (overrides: Partial<Milestone>): Milestone => ({
    id: overrides.id || 'milestone-1',
    projectId: 'project-1',
    title: overrides.title || 'Milestone',
    status: 'Pending',
    dueDate: '2026-06-01',
    createdAt: '2026-05-01T08:00:00.000Z',
    createdBy: 'user-1',
    tenantId: 'tenant-1',
    ...overrides
});

const sprint = (overrides: Partial<Sprint>): Sprint => ({
    id: overrides.id || 'sprint-1',
    projectId: 'project-1',
    name: overrides.name || 'Sprint',
    startDate: '2026-05-01',
    endDate: '2026-06-01',
    status: 'Active',
    createdAt: '2026-05-01T08:00:00.000Z',
    createdBy: 'user-1',
    updatedAt: '2026-05-20T08:00:00.000Z',
    ...overrides
});

const initiative = (overrides: Partial<Initiative>): Initiative => ({
    id: overrides.id || 'initiative-1',
    projectId: 'project-1',
    tenantId: 'tenant-1',
    ownerId: 'user-1',
    title: overrides.title || 'Initiative',
    status: 'In Progress',
    dueDate: '2026-06-01',
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-05-20T08:00:00.000Z',
    ...overrides
});

const idea = (overrides: Partial<Idea>): Idea => ({
    id: overrides.id || 'idea-1',
    projectId: 'project-1',
    ownerId: 'user-1',
    title: overrides.title || 'Flow',
    description: '',
    type: 'Feature',
    stage: 'Review',
    votes: 0,
    comments: 0,
    createdAt: '2026-05-20T08:00:00.000Z',
    ...overrides
});

const activity = (overrides: Partial<Activity>): Activity => ({
    id: overrides.id || 'activity-1',
    projectId: 'project-1',
    ownerId: 'user-1',
    user: 'Alex',
    action: 'updated',
    target: 'Launch',
    type: 'status',
    createdAt: '2026-05-24T08:00:00.000Z',
    ...overrides
});

const workspaceHealth = (overrides: Partial<ProjectHealth> = {}): ProjectHealth => ({
    score: 80,
    status: 'healthy',
    factors: [],
    recommendations: [],
    trend: 'stable',
    lastUpdated: Date.now(),
    ...overrides
});

describe('calculateProjectHealth', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-25T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('caps health when schedule, execution, sprint, initiative, and flow risks stack up', () => {
        const health = calculateProjectHealth(
            baseProject({ dueDate: '2026-05-22', progress: 25 }),
            [
                task({ id: 'blocked', status: 'Blocked', priority: 'Urgent', dueDate: '2026-05-20' }),
                task({ id: 'dependent', priority: 'High', dueDate: '2026-05-21', dependencies: ['blocked'] })
            ],
            [
                milestone({ status: 'Pending', dueDate: '2026-05-18', riskRating: 'High' })
            ],
            [
                issue({ priority: 'High', dueDate: '2026-05-19' })
            ],
            [
                sprint({ status: 'Active', startDate: '2026-05-01', endDate: '2026-05-20' })
            ],
            [],
            [],
            [
                initiative({ status: 'Blocked', dueDate: '2026-05-22' })
            ],
            [
                idea({
                    riskWinAnalysis: {
                        successProbability: 30,
                        marketFitScore: 4,
                        technicalFeasibilityScore: 5,
                        risks: [{ title: 'Unclear feasibility', severity: 'High' }],
                        wins: [],
                        recommendation: 'Pause'
                    }
                })
            ]
        );

        expect(health.score).toBeLessThanOrEqual(34);
        expect(health.status).toBe('critical');
        expect(health.trend).toBe('declining');
        expect(health.factors.map((factor) => factor.id)).toEqual(expect.arrayContaining([
            'deadline_overdue',
            'tasks_overdue',
            'blocked_tasks',
            'dependency_pressure',
            'issue_deadlines',
            'missed_milestones',
            'sprint_overdue',
            'initiative_health_risk',
            'flow_risk'
        ]));
    });

    it('rewards completed execution, clean issues, milestones, sprints, converted flows, and engagement', () => {
        const completedTasks = Array.from({ length: 4 }, (_, index) => task({
            id: `done-${index}`,
            isCompleted: true,
            status: 'Done',
            assigneeId: 'user-1',
            sprintId: 'sprint-1',
            completedAt: `2026-05-2${index}T08:00:00.000Z`
        }));

        const health = calculateProjectHealth(
            baseProject({ progress: 82 }),
            [
                ...completedTasks,
                task({ id: 'remaining', dueDate: '2026-06-10', assigneeId: 'user-2', sprintId: 'sprint-1' })
            ],
            [
                milestone({ status: 'Achieved', dueDate: '2026-05-10' })
            ],
            [
                issue({ status: 'Resolved', priority: 'High', completedAt: '2026-05-21T08:00:00.000Z' })
            ],
            [
                sprint({ id: 'sprint-1', status: 'Active', startDate: '2026-05-10', endDate: '2026-06-10' })
            ],
            [
                activity({ id: 'a1', user: 'Alex', type: 'comment' }),
                activity({ id: 'a2', user: 'Sam', type: 'task' })
            ],
            [],
            [
                initiative({ status: 'Done', completedAt: '2026-05-23T08:00:00.000Z' })
            ],
            [
                idea({ stage: 'Approved', convertedTaskId: 'done-1', approvedAt: '2026-05-22T08:00:00.000Z' })
            ]
        );

        expect(health.score).toBeGreaterThanOrEqual(88);
        expect(health.status).toBe('excellent');
        expect(health.trend).toBe('improving');
        expect(health.factors.map((factor) => factor.id)).toEqual(expect.arrayContaining([
            'strong_task_completion',
            'high_velocity',
            'no_open_issues',
            'milestone_progress',
            'active_sprint_progress',
            'flow_conversion_strength',
            'comment_engagement'
        ]));
    });

    it('calls out missing project brief fields as setup gaps', () => {
        const health = calculateProjectHealth(
            baseProject({
                status: 'Planning',
                brief: {
                    objective: '',
                    successCriteria: []
                }
            })
        );

        expect(health.factors.map((factor) => factor.id)).toContain('project_brief_gap');
        expect(health.recommendationKeys).toContain('health.recommendations.completeProjectBrief');
    });

    it('uses the project purpose instead of requiring a separate brief objective', () => {
        const health = calculateProjectHealth(
            baseProject({
                description: 'Launch the customer beta.',
                status: 'Planning',
                brief: {
                    successCriteria: ['Beta invite sent'],
                    scope: 'Customer beta only',
                    decisionOwner: 'Product',
                    cadence: 'weekly'
                }
            })
        );

        expect(health.factors.map((factor) => factor.id)).not.toContain('project_brief_gap');
        expect(health.factors.map((factor) => factor.id)).toContain('project_brief_ready');
    });

    it('does not calculate health signals for canceled projects', () => {
        const canceledProject = baseProject({ status: 'Canceled', dueDate: '2026-05-20', priority: 'Urgent' });

        const health = calculateProjectHealth(
            canceledProject,
            [
                task({ id: 'overdue-urgent', priority: 'Urgent', dueDate: '2026-05-18' }),
                task({ id: 'blocked', status: 'Blocked', priority: 'High', dueDate: '2026-05-19' })
            ],
            [
                milestone({ status: 'Pending', dueDate: '2026-05-18', riskRating: 'High' })
            ],
            [
                issue({ priority: 'High', dueDate: '2026-05-19' })
            ]
        );

        expect(isProjectExcludedFromHealth(canceledProject)).toBe(true);
        expect(isProjectActiveForGlobalSignals(canceledProject)).toBe(false);
        expect(health.score).toBe(0);
        expect(health.status).toBe('normal');
        expect(health.trend).toBe('stable');
        expect(health.factors).toEqual([]);
        expect(health.recommendations).toEqual([]);
        expect(health.recommendationKeys).toEqual([]);
    });
});

describe('calculateWorkspaceHealth', () => {
    it('includes active and testing projects while ignoring paused and non-active projects in global health', () => {
        const activeProject = baseProject({ id: 'active-project', status: 'Active' });
        const testingProject = baseProject({ id: 'testing-project', status: 'In Testing' });
        const pausedProject = baseProject({ id: 'paused-project', status: 'On Hold' });
        const canceledProject = baseProject({ id: 'canceled-project', status: 'Canceled' });
        const planningProject = baseProject({ id: 'planning-project', status: 'Planning' });
        const reviewProject = baseProject({ id: 'review-project', status: 'Review' });

        const health = calculateWorkspaceHealth(
            [activeProject, testingProject, pausedProject, canceledProject, planningProject, reviewProject],
            {
                'active-project': workspaceHealth({ score: 92, status: 'excellent' }),
                'testing-project': workspaceHealth({ score: 80, status: 'healthy' }),
                'paused-project': workspaceHealth({ score: 8, status: 'critical' }),
                'canceled-project': workspaceHealth({ score: 4, status: 'critical' }),
                'planning-project': workspaceHealth({ score: 18, status: 'critical' }),
                'review-project': workspaceHealth({ score: 25, status: 'warning' })
            }
        );

        expect(isProjectActiveForGlobalSignals(activeProject)).toBe(true);
        expect(isProjectActiveForGlobalSignals(testingProject)).toBe(true);
        expect(isProjectActiveForGlobalSignals(pausedProject)).toBe(false);
        expect(isProjectActiveForGlobalSignals(canceledProject)).toBe(false);
        expect(isProjectActiveForGlobalSignals(planningProject)).toBe(false);
        expect(isProjectActiveForGlobalSignals(reviewProject)).toBe(false);
        expect(health.score).toBe(86);
        expect(health.status).toBe('healthy');
        expect(health.breakdown.total).toBe(2);
        expect(health.breakdown.excellent).toBe(1);
        expect(health.breakdown.healthy).toBe(1);
        expect(health.breakdown.critical).toBe(0);
        expect(health.breakdown.warning).toBe(0);
    });
});
