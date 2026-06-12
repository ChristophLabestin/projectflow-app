import type { Locale } from 'date-fns';
import type { Initiative, Milestone, Task } from '../../../../../types';
import type { WorkItem, WorkItemGroup } from './useWorkItems';
import type { OverviewLabels } from '../../hooks/useProjectOverviewLabels';
import type { OverviewGroupBy } from '../../config/overviewConfig';

export type WorkViewContext = {
    items: WorkItem[];
    groups: WorkItemGroup[];
    groupBy: OverviewGroupBy;
    labels: OverviewLabels;
    milestones: Milestone[];
    initiatives: Initiative[];
    /** Map of initiativeId -> accent color (hex), for marking member tasks. */
    initiativeColors: Record<string, string>;
    dateFormat: string;
    dateLocale: Locale;
    canManageTasks: boolean;
    t: (key: string, fallback?: string) => string;
    onItemClick: (item: WorkItem) => void;
    onToggleComplete: (task: Task) => void;
    onUpdateItemStatus: (item: WorkItem, status: string) => void;
    onUpdateItemDates: (item: WorkItem, dates: { startDate?: string; dueDate?: string }) => void;
    /** Move an item into a group bucket for the given grouping dimension. */
    onMoveItemToGroup: (item: WorkItem, groupBy: OverviewGroupBy, groupKey: string) => void;
};
