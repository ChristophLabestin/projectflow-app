import { useMemo } from 'react';
import type { Initiative, Task } from '../../../../../types';
import { toMillis } from '../../../../../utils/time';
import type { OverviewFilters } from '../../hooks/useProjectOverviewViewState';
import type { OverviewGroupBy, OverviewSortBy } from '../../config/overviewConfig';

export type WorkItemKind = 'task' | 'initiative';

export type WorkItem = {
    id: string;
    kind: WorkItemKind;
    title: string;
    status: string;
    priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
    dueDate?: string;
    startDate?: string;
    assigneeIds: string[];
    initiativeId?: string;
    isCompleted: boolean;
    createdAtMs: number;
    task?: Task;
    initiative?: Initiative;
};

export type WorkItemGroup = {
    key: string;
    label: string;
    items: WorkItem[];
};

const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const STATUS_RANK: Record<string, number> = {
    Blocked: 0,
    'In Progress': 1,
    Review: 2,
    Open: 3,
    Todo: 3,
    Planning: 4,
    Backlog: 5,
    'On Hold': 6,
    Done: 7
};

const taskToWorkItem = (task: Task): WorkItem => ({
    id: task.id,
    kind: 'task',
    title: task.title,
    status: task.isCompleted ? 'Done' : (task.status || 'Open'),
    priority: task.priority,
    dueDate: task.dueDate || undefined,
    startDate: task.startDate || undefined,
    assigneeIds: task.assigneeIds?.length ? task.assigneeIds : (task.assigneeId ? [task.assigneeId] : []),
    initiativeId: task.initiativeId,
    isCompleted: task.isCompleted || task.status === 'Done',
    createdAtMs: toMillis(task.createdAt) || 0,
    task
});

const initiativeToWorkItem = (initiative: Initiative): WorkItem => ({
    id: initiative.id,
    kind: 'initiative',
    title: initiative.title,
    status: initiative.status || 'Planning',
    priority: initiative.priority,
    dueDate: initiative.dueDate || undefined,
    startDate: initiative.startDate || undefined,
    assigneeIds: initiative.assigneeIds || [],
    initiativeId: initiative.id,
    isCompleted: initiative.status === 'Done',
    createdAtMs: toMillis(initiative.createdAt) || 0,
    initiative
});

const matchesFilters = (item: WorkItem, filters: OverviewFilters): boolean => {
    if (!filters.showCompleted && item.isCompleted) return false;
    if (filters.search) {
        const needle = filters.search.trim().toLowerCase();
        if (needle && !item.title.toLowerCase().includes(needle)) return false;
    }
    if (filters.statuses.length && !filters.statuses.includes(item.status)) return false;
    if (filters.priorities.length && (!item.priority || !filters.priorities.includes(item.priority))) return false;
    if (filters.assigneeIds.length && !item.assigneeIds.some((id) => filters.assigneeIds.includes(id))) return false;
    if (filters.initiativeId && item.initiativeId !== filters.initiativeId) return false;
    return true;
};

const compareBy = (sortBy: OverviewSortBy) => (a: WorkItem, b: WorkItem): number => {
    switch (sortBy) {
        case 'priority':
            return (PRIORITY_RANK[a.priority || 'Low'] ?? 9) - (PRIORITY_RANK[b.priority || 'Low'] ?? 9);
        case 'dueDate': {
            const av = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
            const bv = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
            return av - bv;
        }
        case 'title':
            return a.title.localeCompare(b.title);
        case 'createdAt':
            return b.createdAtMs - a.createdAtMs;
        case 'manual':
        default:
            return 0;
    }
};

export type UseWorkItemsArgs = {
    tasks: Task[];
    initiatives: Initiative[];
    filters: OverviewFilters;
    sortBy: OverviewSortBy;
    groupBy: OverviewGroupBy;
    includeInitiatives?: boolean;
    /** Labels for group headers, resolved by the caller (status/priority labels, initiative titles). */
    statusLabels: Record<string, string>;
    priorityLabels: Record<string, string>;
    assigneeLabels: Record<string, string>;
    noneLabel: string;
    unassignedLabel: string;
};

export type UseWorkItemsResult = {
    items: WorkItem[];
    groups: WorkItemGroup[];
    totalCount: number;
    visibleCount: number;
};

/**
 * Single derivation pipeline shared by every work view. Maps tasks + initiatives
 * into a unified WorkItem collection, applies filters, sorts, and groups them.
 * Every view consumes this output, so switching views never re-derives.
 */
export const useWorkItems = (args: UseWorkItemsArgs): UseWorkItemsResult => {
    const {
        tasks,
        initiatives,
        filters,
        sortBy,
        groupBy,
        includeInitiatives = true,
        statusLabels,
        priorityLabels,
        assigneeLabels,
        noneLabel,
        unassignedLabel
    } = args;

    return useMemo(() => {
        const raw: WorkItem[] = [
            ...(includeInitiatives ? initiatives.map(initiativeToWorkItem) : []),
            ...tasks.map(taskToWorkItem)
        ];

        const filtered = raw.filter((item) => matchesFilters(item, filters));
        const sorted = sortBy === 'manual' ? filtered : [...filtered].sort(compareBy(sortBy));

        const groupKeyOf = (item: WorkItem): { key: string; label: string; rank: number } => {
            switch (groupBy) {
                case 'priority': {
                    const key = item.priority || '__none__';
                    return {
                        key,
                        label: item.priority ? (priorityLabels[item.priority] || item.priority) : noneLabel,
                        rank: PRIORITY_RANK[item.priority || ''] ?? 9
                    };
                }
                case 'initiative': {
                    const init = item.kind === 'task' ? item.initiativeId : item.id;
                    const key = init || '__standalone__';
                    const title = init
                        ? (initiatives.find((i) => i.id === init)?.title || noneLabel)
                        : noneLabel;
                    return { key, label: title, rank: init ? 0 : 1 };
                }
                case 'assignee': {
                    const first = item.assigneeIds[0];
                    const key = first || '__unassigned__';
                    return { key, label: first ? (assigneeLabels[first] || first) : unassignedLabel, rank: first ? 0 : 1 };
                }
                case 'none':
                    return { key: '__all__', label: noneLabel, rank: 0 };
                case 'status':
                default: {
                    const key = item.status || 'Open';
                    return { key, label: statusLabels[key] || key, rank: STATUS_RANK[key] ?? 5 };
                }
            }
        };

        const map = new Map<string, WorkItemGroup & { rank: number }>();
        for (const item of sorted) {
            const { key, label, rank } = groupKeyOf(item);
            const existing = map.get(key);
            if (existing) {
                existing.items.push(item);
            } else {
                map.set(key, { key, label, rank, items: [item] });
            }
        }

        const groups = Array.from(map.values())
            .sort((a, b) => a.rank - b.rank)
            .map(({ key, label, items }) => ({ key, label, items }));

        return {
            items: sorted,
            groups,
            totalCount: raw.length,
            visibleCount: sorted.length
        };
    }, [
        tasks,
        initiatives,
        filters,
        sortBy,
        groupBy,
        includeInitiatives,
        statusLabels,
        priorityLabels,
        assigneeLabels,
        noneLabel,
        unassignedLabel
    ]);
};
