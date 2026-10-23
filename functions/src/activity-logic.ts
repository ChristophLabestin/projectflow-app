// Pure planning for the workspace activity stream (tenants/{t}/activity, contract
// brain/plans/activity-events-contract.md). No Firestore access here so it is unit-testable.
import { addedItems, dueString, effectiveAssignees, isDone, Json, plainSnippet, sameInstant } from './task-effects';

export const ACTIVITY_SCHEMA_VERSION = 1;
export const ACTIVITY_RETENTION_DAYS = 365;

/** Known event types. Other sessions append theirs here (and in web/config/activityTypes.ts). */
export const ACTIVITY_EVENT_TYPES = [
    'task.created',
    'task.status_changed',
    'task.completed',
    'task.reopened',
    'task.assigned',
    'task.unassigned',
    'task.due_changed',
    'task.priority_changed',
    'task.renamed',
    'task.deleted',
    'subtask.created',
    'subtask.completed',
    'comment.created',
    'project.created',
    'project.status_changed',
    'project.member_added',
    'project.member_removed',
    // Reserved for the Files / Wiki / Flows sessions:
    'file.uploaded',
    'file.deleted',
    'doc.created',
    'doc.updated',
    'automation.ran',
    'automation.failed'
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number] | (string & {});

export type ActorKind = 'user' | 'ai' | 'automation' | 'system';

export interface ActivityActor {
    kind: ActorKind;
    /** User uid (for `ai`: the connecting user); null for automation / system. */
    id: string | null;
    name: string;
    photoURL?: string;
    /** AI client name ("Claude", "ChatGPT") for kind 'ai'. */
    client?: string;
    automationId?: string;
}

export interface ActivityObject {
    type: string;
    id: string;
    title: string;
    parentType?: string;
    parentId?: string;
}

export type ActivityChanges = Record<string, { from: unknown; to: unknown }>;

export interface PlannedEvent {
    type: ActivityEventType;
    object: ActivityObject;
    changes?: ActivityChanges;
    meta?: Record<string, unknown>;
}

export interface WriteVia {
    kind: 'ai' | 'automation';
    client?: string;
    id?: string;
    name?: string;
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const domainOf = (type: string): string => {
    const dot = type.indexOf('.');
    return dot > 0 ? type.slice(0, dot) : type;
};

const titleOf = (data: Json | null | undefined, fallback = 'Untitled'): string =>
    str(data?.title) || str(data?.name) || fallback;

/**
 * Machine attribution stamped on a doc (`writeVia`), only when it was (re)stamped in this write —
 * a later plain user write leaves the old stamp in place and must not inherit it.
 */
export const freshWriteVia = (before: Json | null, after: Json): WriteVia | null => {
    const via = after?.writeVia;
    if (!via || typeof via !== 'object') return null;
    if (before?.writeVia && sameInstant(before.writeVia.at, via.at)) return null;
    const kind = via.kind === 'ai' || via.kind === 'automation' ? via.kind : null;
    if (!kind) return null;
    return {
        kind,
        ...(str(via.client) ? { client: str(via.client) } : {}),
        ...(str(via.id) ? { id: str(via.id) } : {}),
        ...(str(via.name) ? { name: str(via.name) } : {})
    };
};

/** Combine the resolved user (may be empty) with a `writeVia` stamp into the event actor. */
export const buildActor = (user: { id: string; name: string; photoURL?: string } | null, via: WriteVia | null): ActivityActor => {
    if (via?.kind === 'automation') {
        return { kind: 'automation', id: null, name: via.name || 'Automation', ...(via.id ? { automationId: via.id } : {}) };
    }
    if (via?.kind === 'ai') {
        return {
            kind: 'ai',
            id: user?.id || null,
            name: user?.name || via.client || 'AI',
            ...(user?.photoURL ? { photoURL: user.photoURL } : {}),
            client: via.client || 'AI'
        };
    }
    if (!user || !user.id) return { kind: 'system', id: null, name: 'ProjectFlow' };
    return { kind: 'user', id: user.id, name: user.name, ...(user.photoURL ? { photoURL: user.photoURL } : {}) };
};

const dateOnly = (value: unknown): string | null => {
    const text = dueString(value);
    if (!text) return null;
    return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
};

/** Task events for one write (`after` null = delete). */
export const planTaskEvents = (before: Json | null, after: Json | null, taskId: string): PlannedEvent[] => {
    const subject = after || before;
    if (!subject) return [];
    const object: ActivityObject = { type: 'task', id: taskId, title: titleOf(subject) };
    const initiativeId = str(subject.initiativeId);
    if (initiativeId) {
        object.parentType = 'initiative';
        object.parentId = initiativeId;
    }

    if (!after) return [{ type: 'task.deleted', object }];
    if (!before) {
        const out: PlannedEvent[] = [{ type: 'task.created', object, ...(initiativeId ? { meta: { initiativeId } } : {}) }];
        const assignees = effectiveAssignees(after);
        if (assignees.length) out.push({ type: 'task.assigned', object, meta: { assigneeIds: assignees } });
        return out;
    }

    const out: PlannedEvent[] = [];
    const nowDone = isDone(after);
    const wasDone = isDone(before);
    if (nowDone !== wasDone) {
        out.push({ type: nowDone ? 'task.completed' : 'task.reopened', object });
    } else if (str(before.status) !== str(after.status) && str(after.status)) {
        out.push({ type: 'task.status_changed', object, changes: { status: { from: str(before.status) || null, to: str(after.status) } } });
    }

    const beforeTitle = str(before.title);
    const afterTitle = str(after.title);
    if (beforeTitle && afterTitle && beforeTitle !== afterTitle) {
        out.push({ type: 'task.renamed', object, changes: { title: { from: beforeTitle, to: afterTitle } } });
    }

    const beforeDue = dateOnly(before.dueDate);
    const afterDue = dateOnly(after.dueDate);
    if (beforeDue !== afterDue) {
        out.push({ type: 'task.due_changed', object, changes: { dueDate: { from: beforeDue, to: afterDue } } });
    }

    if (str(before.priority) !== str(after.priority) && str(after.priority)) {
        out.push({ type: 'task.priority_changed', object, changes: { priority: { from: str(before.priority) || null, to: str(after.priority) } } });
    }

    const prev = effectiveAssignees(before);
    const next = effectiveAssignees(after);
    const added = addedItems(prev, next);
    const removed = addedItems(next, prev);
    if (added.length) out.push({ type: 'task.assigned', object, meta: { assigneeIds: added } });
    if (removed.length) out.push({ type: 'task.unassigned', object, meta: { assigneeIds: removed } });
    return out;
};

export const planSubtaskEvents = (
    before: Json | null,
    after: Json | null,
    subtaskId: string,
    taskId: string,
    taskTitle: string
): PlannedEvent[] => {
    if (!after) return [];
    const object: ActivityObject = { type: 'subtask', id: subtaskId, title: titleOf(after), parentType: 'task', parentId: taskId };
    const meta = { taskTitle };
    if (!before) return [{ type: 'subtask.created', object, meta }];
    if (before.isCompleted !== true && after.isCompleted === true) return [{ type: 'subtask.completed', object, meta }];
    return [];
};

export const planCommentEvent = (
    comment: Json,
    commentId: string,
    targetType: string,
    targetId: string,
    targetTitle: string
): PlannedEvent => ({
    type: 'comment.created',
    object: { type: 'comment', id: commentId, title: targetTitle, parentType: targetType, parentId: targetId },
    meta: { snippet: plainSnippet(comment.content, 140) }
});

const memberIdsOf = (project: Json | null): string[] => {
    if (!project) return [];
    const ids = Array.isArray(project.memberIds) ? project.memberIds.map(str).filter(Boolean) : [];
    return Array.from(new Set(ids));
};

/** Project events (creation, status, membership). Deletion is not tracked (the feed scope is gone). */
export const planProjectEvents = (before: Json | null, after: Json | null, projectId: string): PlannedEvent[] => {
    if (!after) return [];
    const object: ActivityObject = { type: 'project', id: projectId, title: titleOf(after) };
    if (!before) return [{ type: 'project.created', object }];

    const out: PlannedEvent[] = [];
    if (str(before.status) !== str(after.status) && str(after.status)) {
        out.push({ type: 'project.status_changed', object, changes: { status: { from: str(before.status) || null, to: str(after.status) } } });
    }
    const prev = memberIdsOf(before);
    const next = memberIdsOf(after);
    const owner = str(after.ownerId);
    const added = addedItems(prev, next).filter((id) => id !== owner);
    const removed = addedItems(next, prev);
    if (added.length) out.push({ type: 'project.member_added', object, meta: { userIds: added } });
    if (removed.length) out.push({ type: 'project.member_removed', object, meta: { userIds: removed } });
    return out;
};

/** JSON-safe, size-bounded copy of `meta` / `changes` values (no Timestamps, no nested blobs). */
export const sanitizeValue = (value: unknown, depth = 0): unknown => {
    if (value === undefined) return null;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 497)}...` : value;
    if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeValue(item, depth + 1));
    if (typeof value === 'object' && depth < 3) {
        const out: Record<string, unknown> = {};
        for (const [key, inner] of Object.entries(value as Record<string, unknown>).slice(0, 25)) {
            out[key] = sanitizeValue(inner, depth + 1);
        }
        return out;
    }
    return String(value);
};
