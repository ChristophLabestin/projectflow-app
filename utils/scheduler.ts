import { addDays, isBefore, isSameDay, startOfDay, isWeekend, isAfter } from 'date-fns';
import { Task, Issue, TaskStatus } from '../types';

export interface SchedulerPreferences {
    maxItemsPerDay: number;
    includeWeekends: boolean;
    prioritizeOverdue: boolean;
}

export interface ProposedSchedule {
    taskId: string;
    type: 'task' | 'issue';
    newDate: Date;
    originalDate?: Date;
    reason: string;
}

type SchedulableItem = {
    id: string;
    type: 'task' | 'issue';
    title: string;
    dueDate?: Date;
    priorityWeight: number;
    originalItem: Task | Issue;
};

const PRIORITY_WEIGHTS = {
    'Urgent': 4,
    'High': 3,
    'Medium': 2,
    'Low': 1,
    'None': 0
};

export const distributeTasks = (
    tasks: Task[],
    issues: Issue[],
    preferences: SchedulerPreferences = { maxItemsPerDay: 5, includeWeekends: false, prioritizeOverdue: true }
): ProposedSchedule[] => {
    // 1. Normalize and Filter Items
    const itemsToSchedule: SchedulableItem[] = [];

    // Process Tasks
    tasks.forEach(task => {
        if (task.isCompleted || task.status === 'Done') return;

        let weight = 1;
        if (task.priority && task.priority in PRIORITY_WEIGHTS) {
            weight = PRIORITY_WEIGHTS[task.priority as keyof typeof PRIORITY_WEIGHTS];
        }

        // Use scheduledDate if exists, else dueDate
        const dateStr = task.scheduledDate || task.dueDate;

        itemsToSchedule.push({
            id: task.id,
            type: 'task',
            title: task.title,
            dueDate: dateStr ? new Date(dateStr) : undefined,
            priorityWeight: weight,
            originalItem: task
        });
    });

    // Process Issues
    issues.forEach(issue => {
        if (issue.status === 'Resolved' || issue.status === 'Closed') return;

        let weight = 1;
        if (issue.priority && issue.priority in PRIORITY_WEIGHTS) {
            weight = PRIORITY_WEIGHTS[issue.priority as keyof typeof PRIORITY_WEIGHTS];
        }

        // Issues rely on scheduledDate primarily
        const dateStr = issue.scheduledDate;

        itemsToSchedule.push({
            id: issue.id,
            type: 'issue',
            title: issue.title,
            dueDate: dateStr ? new Date(dateStr) : undefined,
            priorityWeight: weight,
            originalItem: issue
        });
    });

    // 2. Sort Items
    // Priority:
    // 1. Overdue (if enabled)
    // 2. Priority Weight (Highest first)
    // 3. Existing Due Date (Earliest first)

    const today = startOfDay(new Date());

    itemsToSchedule.sort((a, b) => {
        const aOverdue = a.dueDate && isBefore(a.dueDate, today);
        const bOverdue = b.dueDate && isBefore(b.dueDate, today);

        if (preferences.prioritizeOverdue) {
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;
        }

        if (a.priorityWeight !== b.priorityWeight) {
            return b.priorityWeight - a.priorityWeight; // Higher priority first
        }

        // If both have due dates, sort by date
        if (a.dueDate && b.dueDate) {
            return a.dueDate.getTime() - b.dueDate.getTime();
        }

        // Prefer items with due dates over those without (or vice versa? Usually items with deadlines come first)
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;

        return 0;
    });

    // 3. Distribute
    const proposedChanges: ProposedSchedule[] = [];
    let currentDay = today;

    // Track load per day
    // We might want to respect existing valid future assignments, but the request implies re-distribution.
    // However, moving a task that is comfortably in the future to Today might be annoying.
    // Strategy: 
    // - If a task is overdue, it MUST be rescheduled to Today+.
    // - If a task has no date, it gets scheduled.
    // - If a task has a future date, we check if that day is overloaded. If so, move it? 
    // For V1 "Reset/Optimize", let's try to fill days sequentially starting today.

    const dailyLoad: Record<string, number> = {};
    const getLoad = (d: Date) => dailyLoad[d.toISOString()] || 0;
    const incLoad = (d: Date) => dailyLoad[d.toISOString()] = getLoad(d) + 1;

    // Helper to find next valid slot
    const findNextSlot = (startDate: Date): Date => {
        let candidate = startDate;
        while (true) {
            // Skip weekends if requested
            if (!preferences.includeWeekends && isWeekend(candidate)) {
                candidate = addDays(candidate, 1);
                continue;
            }

            // Check capacity
            if (getLoad(candidate) < preferences.maxItemsPerDay) {
                return candidate;
            }

            candidate = addDays(candidate, 1);
        }
    };

    itemsToSchedule.forEach(item => {
        // If item is already scheduled for a valid future date and that day isn't full, keep it?
        // Or strictly strictly repack?
        // Let's go with a hybrid: 
        // If overdue or undated -> Reschedule.
        // If valid future -> Keep unless the user explicitly wants a full repack.
        // For this implementation: "Stress Free" implies smoothing out spikes.
        // Let's treat ALL items as a pool to get the optimal flow.

        const targetDate = findNextSlot(currentDay);

        // Only propose a change if the date is different
        // OR if we are just defining the schedule for everything.
        // We return the proposed schedule for ALL items passed effectively.

        proposedChanges.push({
            taskId: item.id,
            type: item.type,
            newDate: targetDate,
            originalDate: item.dueDate,
            reason: item.dueDate && isBefore(item.dueDate, today) ? 'Overdue' : 'Optimized'
        });

        incLoad(targetDate);

        // Optimization: If we filled today, advance currentDay pointer to avoid re-checking full days
        if (getLoad(currentDay) >= preferences.maxItemsPerDay) {
            currentDay = addDays(currentDay, 1);
        }
    });

    return proposedChanges;
};
