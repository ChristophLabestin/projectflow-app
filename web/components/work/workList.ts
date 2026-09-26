import type { Task } from '../../types';
import { daysFromToday, getDueBucket, parseDateValue, type DueBucket } from '../../utils/taskDates';

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

const PRIORITY_RANK: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

/** `Todo` is a legacy alias of `Open`; completed tasks always read as `Done`. */
export const normalizeStatus = (task: Task): string => {
    if (task.isCompleted) return 'Done';
    if (!task.status || task.status === 'Todo') return 'Open';
    return task.status;
};

export const getAssigneeIds = (task: Task): string[] => {
    if (task.assigneeIds && task.assigneeIds.length) return task.assigneeIds;
    return task.assigneeId ? [task.assigneeId] : [];
};

const dueTime = (task: Task) => (task.dueDate ? parseDateValue(task.dueDate).getTime() : Number.MAX_SAFE_INTEGER);

/** Earliest due first, then higher priority, then title. */
export const compareWork = (a: Task, b: Task) => (
    dueTime(a) - dueTime(b)
    || (PRIORITY_RANK[b.priority || 'Medium'] || 0) - (PRIORITY_RANK[a.priority || 'Medium'] || 0)
    || a.title.localeCompare(b.title)
);

const DUE_ORDER: { bucket: DueBucket; tone: WorkGroupTone }[] = [
    { bucket: 'overdue', tone: 'danger' },
    { bucket: 'today', tone: 'warning' },
    { bucket: 'week', tone: 'accent' },
    { bucket: 'later', tone: 'neutral' },
    { bucket: 'none', tone: 'muted' }
];

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
        groups = DUE_ORDER.map(({ bucket, tone }) => ({
            key: `due:${bucket}`,
            label: t(`work.group.due.${bucket}`),
            tone,
            tasks: open.filter((task) => getDueBucket(task.dueDate) === bucket)
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
export const summarizeDue = (tasks: Task[]) => {
    const summary = { overdue: 0, today: 0, week: 0, open: 0 };
    tasks.forEach((task) => {
        if (task.isCompleted) return;
        summary.open += 1;
        const diff = daysFromToday(task.dueDate);
        if (diff === null) return;
        if (diff < 0) summary.overdue += 1;
        else if (diff === 0) summary.today += 1;
        else if (diff <= 7) summary.week += 1;
    });
    return summary;
};
