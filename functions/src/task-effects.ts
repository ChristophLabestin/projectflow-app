// Pure planning logic for the task/subtask/comment triggers (contract C1).
// No Firebase imports: everything here is deterministic and unit tested
// (functions/scripts/unit/task-effects.test.js).

export type Json = Record<string, any>;

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/** Millis of a Firestore Timestamp, `{seconds}`, Date, ISO string or number; null when unreadable. */
export const toMillis = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof value === 'object') {
        const v = value as Json;
        if (typeof v.toMillis === 'function') return v.toMillis();
        const seconds = v.seconds ?? v._seconds;
        if (typeof seconds === 'number') {
            const nanos = v.nanoseconds ?? v._nanoseconds ?? 0;
            return seconds * 1000 + Math.floor(Number(nanos) / 1e6);
        }
    }
    return null;
};

export const sameInstant = (a: unknown, b: unknown): boolean => {
    const left = toMillis(a);
    const right = toMillis(b);
    if (left === null || right === null) return left === right;
    return left === right;
};

const cleanId = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Union of `assigneeIds` and the legacy single `assigneeId` (order preserved, de-duplicated). */
export const effectiveAssignees = (task: Json | null | undefined): string[] => {
    if (!task) return [];
    const out: string[] = [];
    const push = (value: unknown) => {
        const id = cleanId(value);
        if (id && !out.includes(id)) out.push(id);
    };
    if (Array.isArray(task.assigneeIds)) task.assigneeIds.forEach(push);
    push(task.assigneeId);
    return out;
};

export const addedItems = (before: string[], after: string[]): string[] => after.filter((id) => !before.includes(id));

export const isDone = (task: Json | null | undefined): boolean =>
    !!task && (task.isCompleted === true || task.status === 'Done');

/** Truncate and strip markup for activity details / notification text. */
export const plainSnippet = (value: unknown, max = 140): string => {
    const text = typeof value === 'string' ? value : '';
    const stripped = text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    return stripped.length > max ? `${stripped.slice(0, max - 1)}…` : stripped;
};

// ---------------------------------------------------------------------------
// Actor
// ---------------------------------------------------------------------------

/**
 * Who made this write (contract C1: `updatedBy`, fallback `ownerId`).
 * `updatedBy` only counts when this write refreshed it (value or `updatedAt` changed); otherwise it is a
 * stale value left by an earlier client and the writer did not follow the contract (API, script...).
 * On create the doc's own creator fields are used before `ownerId`.
 */
export const resolveActorId = (before: Json | null, after: Json, createFallbacks: string[] = ['createdBy']): string => {
    const updatedBy = cleanId(after.updatedBy);
    const refreshed = !before || before.updatedBy !== after.updatedBy || !sameInstant(before.updatedAt, after.updatedAt);
    if (updatedBy && refreshed) return updatedBy;
    if (!before) {
        for (const key of createFallbacks) {
            const id = cleanId(after[key]);
            if (id) return id;
        }
    }
    return cleanId(after.ownerId);
};

/** True when a server script / trigger stamped `systemWriteAt` in this write (skip activity + notifications). */
export const isSystemWrite = (before: Json | null, after: Json, nowMs: number = Date.now()): boolean => {
    if (after.systemWriteAt === undefined || after.systemWriteAt === null) return false;
    if (before) return !sameInstant(before.systemWriteAt, after.systemWriteAt);
    // Create: only a fresh stamp counts, so a duplicated doc that still carries an old marker notifies normally.
    const stamped = toMillis(after.systemWriteAt);
    return stamped !== null && Math.abs(nowMs - stamped) < 15 * 60 * 1000;
};

// ---------------------------------------------------------------------------
// isCompleted <-> status consistency
// ---------------------------------------------------------------------------

export interface ConsistencyPlan {
    status?: string;
    isCompleted?: boolean;
    /** Write `completedAt` (server timestamp). */
    stampCompletedAt?: boolean;
    /** Write `completedBy` (actor uid). */
    stampCompletedBy?: boolean;
    /** Remove `completedAt` / `completedBy`. */
    clearCompleted?: boolean;
}

export interface ConsistencyResult {
    plan: ConsistencyPlan;
    /** Effective done state after the plan. */
    done: boolean;
    wasDone: boolean;
}

/**
 * Keep `status: 'Done'` <=> `isCompleted: true`.
 * Direction follows the field that changed in this write; when both changed and
 * disagree, `status` wins. If neither changed (legacy disagreement) nothing is rewritten.
 * Legacy `Todo` is left alone.
 */
export const planCompletionConsistency = (before: Json | null, after: Json): ConsistencyResult => {
    const wasDone = isDone(before);
    const isCompletedChanged = !before || before.isCompleted !== after.isCompleted;
    const statusChanged = !before || before.status !== after.status;
    const hasStatus = typeof after.status === 'string' && after.status.length > 0;

    let target: boolean | null = null;
    if (!before) {
        target = after.status === 'Done' || after.isCompleted === true;
    } else if (isCompletedChanged && statusChanged) {
        target = hasStatus ? after.status === 'Done' : after.isCompleted === true;
    } else if (isCompletedChanged) {
        target = after.isCompleted === true;
    } else if (statusChanged) {
        target = after.status === 'Done';
    }

    const plan: ConsistencyPlan = {};
    if (target === null) {
        return { plan, done: isDone(after), wasDone };
    }

    if (target) {
        if (after.isCompleted !== true) plan.isCompleted = true;
        if (after.status !== 'Done') plan.status = 'Done';
    } else {
        if (after.isCompleted !== false) plan.isCompleted = false;
        if (after.status === 'Done') plan.status = 'Open';
    }

    if (target) {
        // A client toggle already stamps both; a status drag / API write does not. Restamp when the
        // value was not refreshed by this write (missing, or identical to the previous completion).
        const needAt = !after.completedAt || (!wasDone && !!before && sameInstant(before.completedAt, after.completedAt));
        const needBy = !after.completedBy || (needAt && !!before && before.completedBy === after.completedBy);
        if (needAt) plan.stampCompletedAt = true;
        if (needBy) plan.stampCompletedBy = true;
    } else if (after.completedAt || after.completedBy) {
        plan.clearCompleted = true;
    }

    return { plan, done: target, wasDone };
};

/** Final field values after applying the consistency plan to the written doc. */
export const applyConsistency = (after: Json, plan: ConsistencyPlan): Json => {
    const out: Json = { ...after };
    if (plan.status !== undefined) out.status = plan.status;
    if (plan.isCompleted !== undefined) out.isCompleted = plan.isCompleted;
    return out;
};

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export interface PlannedActivity {
    action: string;
    target: string;
    type: 'task' | 'initiative' | 'status' | 'priority' | 'comment';
    relatedId: string | null;
    details: string;
}

const titleOf = (task: Json): string => (typeof task.title === 'string' && task.title.trim() ? task.title : 'Untitled');

const dateLabel = (value: unknown): string => {
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 10);
    const millis = toMillis(value);
    return millis === null ? 'none' : new Date(millis).toISOString().slice(0, 10);
};

/**
 * Activity entries for a task write (same shapes as the former web client).
 * `before` null = create. `names` maps uid -> display name for the assignment entry.
 */
export const planTaskActivities = (
    before: Json | null,
    after: Json,
    taskId: string,
    names: (uid: string) => string = (uid) => uid
): PlannedActivity[] => {
    const title = titleOf(after);
    const out: PlannedActivity[] = [];

    if (!before) {
        const initiativeId = cleanId(after.initiativeId);
        out.push({
            action: `Added task "${title}"${initiativeId ? ' to initiative' : ''}`,
            target: initiativeId ? 'Initiatives' : 'Tasks',
            type: initiativeId ? 'initiative' : 'task',
            relatedId: initiativeId || taskId,
            details: ''
        });
        return out;
    }

    const nowDone = isDone(after);
    const wasDone = isDone(before);
    if (nowDone !== wasDone) {
        out.push({
            action: `${nowDone ? 'Completed' : 'Reopened'} task "${title}"`,
            target: 'Tasks',
            type: 'task',
            relatedId: taskId,
            details: ''
        });
    } else if (before.status !== after.status && typeof after.status === 'string' && after.status) {
        out.push({
            action: `Changed status of "${title}" to ${after.status}`,
            target: 'Tasks',
            type: 'status',
            relatedId: taskId,
            details: typeof before.status === 'string' ? `${before.status} → ${after.status}` : ''
        });
    }

    if (before.priority !== after.priority && typeof after.priority === 'string' && after.priority) {
        out.push({
            action: `Changed priority of "${title}" to ${after.priority}`,
            target: 'Tasks',
            type: 'priority',
            relatedId: taskId,
            details: typeof before.priority === 'string' ? `${before.priority} → ${after.priority}` : ''
        });
    }

    const added = addedItems(effectiveAssignees(before), effectiveAssignees(after));
    if (added.length > 0) {
        out.push({
            action: `Assigned task "${title}"`,
            target: 'Tasks',
            type: 'task',
            relatedId: taskId,
            details: `Assigned to: ${added.map(names).join(', ')}`
        });
    }

    const beforeDue = dateLabel(before.dueDate);
    const afterDue = dateLabel(after.dueDate);
    if (beforeDue !== afterDue) {
        out.push({
            action: `Changed due date of "${title}"`,
            target: 'Tasks',
            type: 'task',
            relatedId: taskId,
            details: `${beforeDue} → ${afterDue}`
        });
    }

    return out;
};

export const planTaskDeletedActivity = (task: Json, taskId: string): PlannedActivity => ({
    action: `Deleted task "${titleOf(task)}"`,
    target: 'Tasks',
    type: 'task',
    relatedId: taskId,
    details: ''
});

export const planSubtaskActivities = (
    before: Json | null,
    after: Json | null,
    parentTitle: string,
    taskId: string
): PlannedActivity[] => {
    const make = (action: string): PlannedActivity => ({ action, target: parentTitle, type: 'task', relatedId: taskId, details: '' });
    if (!before && after) return [make(`Added subtask "${titleOf(after)}"`)];
    if (before && !after) return [make(`Deleted subtask "${titleOf(before)}"`)];
    if (before && after && (before.isCompleted === true) !== (after.isCompleted === true)) {
        return [make(`${after.isCompleted === true ? 'Completed' : 'Reopened'} subtask "${titleOf(after)}"`)];
    }
    return [];
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type EventNotificationType =
    | 'task_assigned'
    | 'subtask_assigned'
    | 'comment_added'
    | 'comment_mention'
    | 'task_completed';

export interface PlannedNotification {
    type: EventNotificationType;
    userId: string;
    title: string;
    message: string;
}

/** Same English copy the web client used for assignments. */
export const planTaskNotifications = (
    before: Json | null,
    after: Json,
    actorId: string,
    actorName: string
): PlannedNotification[] => {
    const title = titleOf(after);
    const out: PlannedNotification[] = [];

    const added = addedItems(effectiveAssignees(before), effectiveAssignees(after));
    added.forEach((userId) => {
        if (userId === actorId) return;
        out.push({
            type: 'task_assigned',
            userId,
            title: 'New Task Assignment',
            message: `You've been assigned to "${title}"`
        });
    });

    const creator = cleanId(after.createdBy) || cleanId(after.ownerId);
    if (before && !isDone(before) && isDone(after) && creator && creator !== actorId) {
        out.push({
            type: 'task_completed',
            userId: creator,
            title: 'Task Completed',
            message: `${actorName} completed "${title}"`
        });
    }
    return out;
};

export const planSubtaskNotifications = (
    before: Json | null,
    after: Json,
    parentTitle: string,
    actorId: string
): PlannedNotification[] => {
    const assignee = cleanId(after.assigneeId);
    if (!assignee || assignee === actorId || assignee === cleanId(before?.assigneeId)) return [];
    return [{
        type: 'subtask_assigned',
        userId: assignee,
        title: 'New Subtask Assignment',
        message: `You've been assigned to subtask "${titleOf(after)}" in task "${parentTitle}"`
    }];
};

// ---------------------------------------------------------------------------
// Mentions
// ---------------------------------------------------------------------------

export interface MentionTarget {
    id: string;
    name: string;
    type: 'user' | 'group' | 'role';
    memberIds?: string[];
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Same matching as the web comment editor: `@Name` followed by whitespace, punctuation or the end
 * of the text, case-insensitive, longest names first so "@Anna Berger" is not read as "@Anna".
 */
export const findMentionedTargets = (content: string, targets: MentionTarget[]): MentionTarget[] => {
    const sorted = [...targets].filter((target) => target.name).sort((a, b) => b.name.length - a.name.length);
    return sorted.filter((target) => new RegExp(`@${escapeRegExp(target.name)}(\\s|[.,!?;:]|$)`, 'i').test(content));
};

export interface CommentRecipientInput {
    authorId: string;
    targetType: string;
    mentionedUserIds: string[];
    assigneeIds: string[];
    creatorId: string;
    ownerId: string;
}

export interface CommentRecipients {
    mentions: string[];
    comments: string[];
}

/**
 * Tasks: `comment_added` -> assignees + creator. Other targets (issue / idea / initiative): the target owner,
 * as before. The author never gets a notification and a mentioned user only gets the mention.
 */
export const planCommentRecipients = (input: CommentRecipientInput): CommentRecipients => {
    const author = input.authorId;
    const mentions = Array.from(new Set(input.mentionedUserIds.filter((id) => id && id !== author)));
    const base = input.targetType === 'task' ? [...input.assigneeIds, input.creatorId] : [input.ownerId];
    const comments = Array.from(new Set(base.filter((id) => id && id !== author && !mentions.includes(id))));
    return { mentions, comments };
};

// ---------------------------------------------------------------------------
// Project progress
// ---------------------------------------------------------------------------

export const computeProgress = (total: number, done: number): number =>
    total <= 0 ? 0 : Math.round((Math.min(done, total) / total) * 100);
