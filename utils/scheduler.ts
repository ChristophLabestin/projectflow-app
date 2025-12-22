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
    assigneeIds: string[];
};

const PRIORITY_WEIGHTS = {
    'Urgent': 4,
    'High': 3,
    'Medium': 2,
    'Low': 1,
    'None': 0
};

export const distributeTasks = (
    tasks: Task[], // CURRENT user's tasks
    issues: Issue[], // CURRENT user's issues
    preferences: SchedulerPreferences = { maxItemsPerDay: 5, includeWeekends: false, prioritizeOverdue: true },
    teamTasks: Task[] = [] // Co-assignees' tasks for global optimization
): ProposedSchedule[] => {
    // 1. Pool All Items for Optimization
    const allItems: SchedulableItem[] = [];

    const processItem = (item: Task | Issue, type: 'task' | 'issue') => {
        const isCompleted = type === 'task' ? (item as Task).isCompleted : (item as Issue).status === 'Resolved' || (item as Issue).status === 'Closed';
        if (isCompleted) return;

        let weight = 1;
        if (item.priority && item.priority in PRIORITY_WEIGHTS) {
            weight = PRIORITY_WEIGHTS[item.priority as keyof typeof PRIORITY_WEIGHTS];
        }

        const dateStr = item.scheduledDate || (type === 'task' ? (item as Task).dueDate : undefined);

        let assigneeIds: string[] = [];
        if ((item as any).assigneeIds && (item as any).assigneeIds.length > 0) {
            assigneeIds = (item as any).assigneeIds;
        } else if ((item as any).assigneeId) {
            assigneeIds = [(item as any).assigneeId];
        } else if ((item as any).ownerId) {
            assigneeIds = [(item as any).ownerId];
        }

        allItems.push({
            id: item.id,
            type,
            title: item.title,
            dueDate: dateStr ? new Date(dateStr) : undefined,
            priorityWeight: weight,
            originalItem: item,
            assigneeIds
        });
    };

    tasks.forEach(t => processItem(t, 'task'));
    issues.forEach(i => processItem(i, 'issue'));
    teamTasks.forEach(tt => processItem(tt, 'task'));

    // Deduplicate pool
    const poolMap = new Map<string, SchedulableItem>();
    allItems.forEach(item => {
        if (!poolMap.has(item.id)) {
            poolMap.set(item.id, item);
        }
    });
    const pool = Array.from(poolMap.values());

    // 2. Sort pool by priority and date
    const today = startOfDay(new Date());
    pool.sort((a, b) => {
        const aOverdue = a.dueDate && isBefore(a.dueDate, today);
        const bOverdue = b.dueDate && isBefore(b.dueDate, today);

        if (preferences.prioritizeOverdue) {
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;
        }

        if (a.priorityWeight !== b.priorityWeight) {
            return b.priorityWeight - a.priorityWeight;
        }

        if (a.dueDate && b.dueDate) {
            return a.dueDate.getTime() - b.dueDate.getTime();
        }

        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;

        return 0;
    });

    // 3. Global Load Tracking
    const userDailyLoad: Record<string, Record<string, number>> = {}; // dateISO -> userId -> count

    const isAvailable = (date: Date, userId: string) => {
        const dateKey = startOfDay(date).toISOString();
        const load = (userDailyLoad[dateKey] && userDailyLoad[dateKey][userId]) || 0;
        return load < preferences.maxItemsPerDay;
    };

    const recordAssignment = (date: Date, userId: string) => {
        const dateKey = startOfDay(date).toISOString();
        if (!userDailyLoad[dateKey]) userDailyLoad[dateKey] = {};
        userDailyLoad[dateKey][userId] = (userDailyLoad[dateKey][userId] || 0) + 1;
    };

    // 4. Distribute
    const proposedChanges: ProposedSchedule[] = [];

    const findNextValidDateForAllUsers = (startDate: Date, assigneeIds: string[]): Date => {
        let candidate = startDate;
        while (true) {
            if (!preferences.includeWeekends && isWeekend(candidate)) {
                candidate = addDays(candidate, 1);
                continue;
            }

            // Check if ALL assignees are available on this day
            const everyoneAvailable = assigneeIds.every(uid => isAvailable(candidate, uid));
            if (everyoneAvailable) {
                return candidate;
            }

            candidate = addDays(candidate, 1);
        }
    };

    pool.forEach(item => {
        const targetDate = findNextValidDateForAllUsers(today, item.assigneeIds);

        // Propose change if date is different or it was unscheduled
        const originalDate = item.dueDate;
        const needsUpdate = !originalDate || !isSameDay(originalDate, targetDate);

        if (needsUpdate) {
            proposedChanges.push({
                taskId: item.id,
                type: item.type,
                newDate: targetDate,
                originalDate: originalDate,
                reason: originalDate && isBefore(originalDate, today) ? 'Overdue' : 'Global Optimization'
            });
        }

        // Record load for all assignees
        item.assigneeIds.forEach(uid => recordAssignment(targetDate, uid));
    });

    return proposedChanges;
};
