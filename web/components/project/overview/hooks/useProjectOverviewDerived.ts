import { useMemo } from 'react';
import { addDays, isWithinInterval, startOfToday } from 'date-fns';
import type { Initiative, Milestone, Task } from '../../../../types';

export type AttentionKind = 'overdue' | 'blocked' | 'dueSoon' | 'atRisk';

export type AttentionItem = {
    id: string;
    kind: AttentionKind;
    title: string;
    entity: 'task' | 'initiative' | 'milestone';
    dueDate?: string;
};

export type OverviewDerived = {
    openTaskCount: number;
    completedTaskCount: number;
    totalTaskCount: number;
    completionPct: number;
    overdueCount: number;
    dueSoonCount: number;
    blockedCount: number;
    activeInitiativeCount: number;
    attention: AttentionItem[];
    /** Single most pressing item, if any. */
    nextItem: AttentionItem | null;
};

const isOpen = (task: Task) => !task.isCompleted && task.status !== 'Done';

export const useProjectOverviewDerived = (
    tasks: Task[],
    initiatives: Initiative[],
    milestones: Milestone[]
): OverviewDerived => {
    return useMemo(() => {
        const today = startOfToday();
        const soon = addDays(today, 3);

        const openTasks = tasks.filter(isOpen);
        const completedTaskCount = tasks.length - openTasks.length;
        const totalTaskCount = tasks.length;
        const completionPct = totalTaskCount === 0 ? 0 : Math.round((completedTaskCount / totalTaskCount) * 100);

        const parseDue = (value?: string) => (value ? new Date(value) : null);

        const overdue: AttentionItem[] = [];
        const dueSoon: AttentionItem[] = [];
        const blocked: AttentionItem[] = [];

        for (const task of openTasks) {
            const due = parseDue(task.dueDate);
            if (task.status === 'Blocked') {
                blocked.push({ id: task.id, kind: 'blocked', title: task.title, entity: 'task', dueDate: task.dueDate });
            }
            if (due && due < today) {
                overdue.push({ id: task.id, kind: 'overdue', title: task.title, entity: 'task', dueDate: task.dueDate });
            } else if (due && isWithinInterval(due, { start: today, end: soon })) {
                dueSoon.push({ id: task.id, kind: 'dueSoon', title: task.title, entity: 'task', dueDate: task.dueDate });
            }
        }

        const atRisk: AttentionItem[] = initiatives
            .filter((i) => i.status !== 'Done' && (i.health === 'At Risk' || i.health === 'Off Track'))
            .map((i) => ({ id: i.id, kind: 'atRisk' as const, title: i.title, entity: 'initiative' as const, dueDate: i.dueDate }));

        for (const milestone of milestones) {
            const due = parseDue(milestone.dueDate);
            if (milestone.status === 'Pending' && due && due < today) {
                overdue.push({ id: milestone.id, kind: 'overdue', title: milestone.title, entity: 'milestone', dueDate: milestone.dueDate });
            }
        }

        // Priority order for the attention queue.
        const attention = [...overdue, ...blocked, ...atRisk, ...dueSoon];

        const activeInitiativeCount = initiatives.filter((i) => i.status !== 'Done').length;

        return {
            openTaskCount: openTasks.length,
            completedTaskCount,
            totalTaskCount,
            completionPct,
            overdueCount: overdue.length,
            dueSoonCount: dueSoon.length,
            blockedCount: blocked.length,
            activeInitiativeCount,
            attention,
            nextItem: attention[0] ?? null
        };
    }, [tasks, initiatives, milestones]);
};
