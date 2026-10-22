import type { Task } from '../../types';
import {
    compareWork as compareDueWork,
    groupByDueBucket,
    normalizeStatus as normalizeTaskStatus,
    summarizeDue as summarizeDueTasks,
    type DueBucket,
    type DueGroupKey
} from '../../utils/dueBuckets';
import { dateSortKey, resolveTimeZone } from '../../utils/zonedDate';

export type WorkGroupBy = 'due' | 'status' | 'assignee';
export type WorkGroupTone = 'danger' | 'warning' | 'accent' | 'neutral' | 'muted';

export interface WorkMember {
    uid: string;
    displayName: string;
    photoURL?: string;
}

export interface WorkGroup {
    key: string;
    label: string;
    tone: WorkGroupTone;
    tasks: Task[];
}

export const WORK_STATUSES = ['Backlog', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done'] as const;
export const WORK_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'] as const;

/** `Todo` is a legacy alias of `Open`; completed tasks always read as `Done`. */
export const normalizeStatus = (task: Task): string => normalizeTaskStatus(task);

export const getAssigneeIds = (task: Task): string[] => {
    if (task.assigneeIds && task.assigneeIds.length) return task.assigneeIds;
    return task.assigneeId ? [task.assigneeId] : [];
};

const dueTime = (task: Task) => dateSortKey(task.dueDate, resolveTimeZone());

/** Earliest due first, then higher priority, then title (shared with iOS, see utils/dueBuckets.ts). */
export const compareWork = (a: Task, b: Task) => compareDueWork(a, b);

const DUE_TONE: Record<DueBucket, WorkGroupTone> = {
    overdue: 'danger',
    today: 'warning',
    week: 'accent',
    later: 'neutral',
    none: 'muted'
};

const STATUS_TONE: Record<string, WorkGroupTone> = {
    Blocked: 'danger',
    'In Progress': 'accent',
    Review: 'warning',
    Open: 'neutral',
    'On Hold': 'muted',
    Backlog: 'muted',
    Done: 'muted'
};

interface GroupOptions {
    groupBy: WorkGroupBy;
    t: (key: string) => string;
    members?: WorkMember[];
    currentUserId?: string | null;
}

/** Splits tasks into ordered, non-empty groups. Completed tasks form a trailing "Done" group. */
export const groupTasks = (tasks: Task[], { groupBy, t, members = [], currentUserId }: GroupOptions): WorkGroup[] => {
    const open = tasks.filter((task) => !task.isCompleted).sort(compareWork);
    const done = tasks.filter((task) => task.isCompleted);
    let groups: WorkGroup[] = [];

    if (groupBy === 'due') {
        // Overdue → Today → Next 7 days → Later → No date → Completed (the trailing
        // completed group is added below for every grouping).
        groups = groupByDueBucket(tasks, { now: Date.now() })
            .filter((group): group is { key: Exclude<DueGroupKey, 'done'>; tasks: Task[] } => group.key !== 'done')
            .map((group) => ({
                key: `due:${group.key}`,
                label: t(`work.group.due.${group.key}`),
                tone: DUE_TONE[group.key],
                tasks: group.tasks
            }));
    } else if (groupBy === 'status') {
        groups = WORK_STATUSES.filter((status) => status !== 'Done').map((status) => ({
            key: `status:${status}`,
            label: t(`work.status.${status}`),
            tone: STATUS_TONE[status] || 'neutral',
            tasks: open.filter((task) => normalizeStatus(task) === status)
        }));
    } else {
        const byUid = new Map<string, Task[]>();
        const unassigned: Task[] = [];
        open.forEach((task) => {
            const ids = getAssigneeIds(task);
            if (!ids.length) unassigned.push(task);
            ids.forEach((uid) => byUid.set(uid, [...(byUid.get(uid) || []), task]));
        });
        const nameOf = (uid: string) => members.find((member) => member.uid === uid)?.displayName || t('work.assignee.unknown');
        const uids = [...byUid.keys()].sort((a, b) => {
            if (a === currentUserId) return -1;
            if (b === currentUserId) return 1;
            return nameOf(a).localeCompare(nameOf(b));
        });
        groups = [
            ...uids.map((uid) => ({
                key: `assignee:${uid}`,
                label: uid === currentUserId ? t('work.assignee.me') : nameOf(uid),
                tone: 'neutral' as WorkGroupTone,
                tasks: byUid.get(uid) || []
            })),
            { key: 'assignee:none', label: t('work.assignee.unassigned'), tone: 'muted', tasks: unassigned }
        ];
    }

    if (done.length) {
        groups.push({
            key: 'done',
            label: t('work.group.done'),
            tone: 'muted',
            tasks: [...done].sort((a, b) => dueTime(b) - dueTime(a))
        });
    }
    return groups.filter((group) => group.tasks.length > 0);
};

/** Summary counts for the page header ("2 overdue · 1 today · 4 this week"). */
export const summarizeDue = (tasks: Task[]) => summarizeDueTasks(tasks, { now: Date.now() });
