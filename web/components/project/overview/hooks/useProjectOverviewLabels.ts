import { useMemo } from 'react';
import type { OverviewMember } from './useProjectMembers';

export type OverviewLabels = {
    statusLabels: Record<string, string>;
    priorityLabels: Record<string, string>;
    assigneeLabels: Record<string, string>;
};

/**
 * Builds the status/priority/assignee label maps the work views and grouping
 * pipeline rely on, sourced from translations and loaded member profiles.
 */
export const useProjectOverviewLabels = (
    t: (key: string, fallback?: string) => string,
    members: OverviewMember[]
): OverviewLabels => {
    return useMemo(() => {
        const statusLabels: Record<string, string> = {
            Backlog: t('tasks.status.backlog', 'Backlog'),
            Todo: t('tasks.status.open', 'To do'),
            Open: t('tasks.status.open', 'Open'),
            Planning: t('initiatives.status.planning', 'Planning'),
            'In Progress': t('tasks.status.inProgress', 'In progress'),
            Review: t('tasks.status.review', 'Review'),
            'On Hold': t('tasks.status.onHold', 'On hold'),
            Blocked: t('tasks.status.blocked', 'Blocked'),
            Done: t('tasks.status.done', 'Done')
        };

        const priorityLabels: Record<string, string> = {
            Urgent: t('tasks.priority.urgent', 'Urgent'),
            High: t('tasks.priority.high', 'High'),
            Medium: t('tasks.priority.medium', 'Medium'),
            Low: t('tasks.priority.low', 'Low')
        };

        const assigneeLabels: Record<string, string> = {};
        for (const member of members) {
            assigneeLabels[member.id] = member.displayName;
        }

        return { statusLabels, priorityLabels, assigneeLabels };
    }, [t, members]);
};
