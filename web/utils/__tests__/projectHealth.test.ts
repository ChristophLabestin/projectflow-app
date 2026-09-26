import { describe, expect, it } from 'vitest';

import { applyCategorizedImpacts, calculateProjectHealth, type HealthFactor } from '../../services/healthService';
import type { Project, Task } from '../../types';
import { addDaysFromToday, toIsoDate } from '../taskDates';

const day = (offset: number) => toIsoDate(addDaysFromToday(offset));

const project = (extra: Partial<Project> = {}): Project => ({
    id: 'p1',
    title: 'Project',
    description: 'A clear goal for the project.',
    progress: 0,
    status: 'Active',
    ownerId: 'u1',
    startDate: day(-20),
    dueDate: day(40),
    modules: ['tasks'],
    ...extra
} as Project);

let seq = 0;
const task = (extra: Partial<Task> = {}): Task => ({
    id: `t${seq += 1}`,
    projectId: 'p1',
    title: `Task ${seq}`,
    isCompleted: false,
    status: 'Open',
    priority: 'Medium',
    assigneeId: 'u1',
    assigneeIds: ['u1'],
    dueDate: day(10),
    createdAt: { toMillis: () => Date.now() - 10 * 86400000 },
    ...extra
} as unknown as Task);

const done = (extra: Partial<Task> = {}) => task({
    isCompleted: true,
    status: 'Done',
    dueDate: day(-5),
    completedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    ...extra
} as Partial<Task>);

const health = (p: Project, tasks: Task[]) => calculateProjectHealth(p, tasks, [], [], [], [], [], [], []);

describe('project health calibration', () => {
    it('rates a well-run active project as healthy', () => {
        const tasks = [
            ...Array.from({ length: 6 }, () => done()),
            ...Array.from({ length: 6 }, (_, index) => task({ dueDate: day(5 + index) }))
        ];
        expect(health(project(), tasks).score).toBeGreaterThanOrEqual(74);
    });

    it('keeps a single slipped task out of the warning zone', () => {
        const tasks = [
            ...Array.from({ length: 8 }, () => done()),
            ...Array.from({ length: 10 }, (_, index) => task({ dueDate: day(3 + index) })),
            task({ dueDate: day(-1) })
        ];
        const result = health(project(), tasks);
        expect(result.score).toBeGreaterThanOrEqual(55);
        expect(['normal', 'healthy', 'excellent']).toContain(result.status);
    });

    it('flags a project past its own deadline with open work as critical', () => {
        const tasks = [task({ dueDate: day(-10) }), task({ dueDate: day(-8) }), task({ isCompleted: true, status: 'Done' })];
        const result = health(project({ startDate: day(-90), dueDate: day(-5) }), tasks);
        expect(result.score).toBeLessThan(35);
        expect(result.status).toBe('critical');
    });

    it('does not collapse to zero when several related problems stack up', () => {
        const tasks = [
            task({ dueDate: day(-4), priority: 'Urgent' }),
            task({ dueDate: day(-2) }),
            task({ status: 'Blocked', dueDate: day(3), dependencies: ['t-x'] } as Partial<Task>),
            ...Array.from({ length: 6 }, () => task({ dueDate: day(6), assigneeId: '', assigneeIds: [] })),
            task({ isCompleted: true, status: 'Done' })
        ];
        const result = health(project({ startDate: day(-40), dueDate: day(20) }), tasks);
        expect(result.score).toBeGreaterThan(20);
        expect(result.score).toBeLessThan(55);
    });
});

describe('applyCategorizedImpacts', () => {
    const factor = (id: string, impact: number): HealthFactor => ({
        id, label: id, description: '', impact, type: impact < 0 ? 'negative' : 'positive'
    });

    it('saturates related penalties and keeps explanations consistent with the total', () => {
        const factors = [factor('tasks_overdue', -30), factor('schedule_behind', -20), factor('missed_milestones', -24)];
        const total = applyCategorizedImpacts(factors);
        expect(total).toBeGreaterThan(-35);
        expect(total).toBeLessThan(-30);
        const shown = factors.reduce((sum, entry) => sum + entry.impact, 0);
        expect(Math.abs(shown - total)).toBeLessThanOrEqual(2);
    });

    it('caps each category independently', () => {
        const total = applyCategorizedImpacts([factor('tasks_overdue', -60), factor('blocked_tasks', -60), factor('tasks_without_owner', -60)]);
        expect(total).toBeGreaterThan(-(35 + 25 + 10));
    });
});
