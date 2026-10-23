// Pure helpers for rendering activity-stream events (tenants/{t}/activity).
import type { ActivityEvent } from '../services/domain/activityStreamService';
import { ACTIVITY_TYPES } from '../config/activityTypes';

type Translate = (key: string, fallback?: string) => string;

export interface ActivityTextPart {
    kind: 'text' | 'actor' | 'object';
    value: string;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value));

const names = (event: ActivityEvent, key: 'assigneeNames' | 'userNames'): string => {
    const list = event.meta?.[key];
    return Array.isArray(list) ? list.map(str).filter(Boolean).join(', ') : '';
};

/** Template key for an event; some types switch variant by payload. */
export const activityTemplateKey = (event: ActivityEvent): string => {
    if (event.type === 'task.due_changed' && !event.changes?.dueDate?.to) return 'activity.types.task.due_cleared';
    if (ACTIVITY_TYPES[event.type]) return `activity.types.${event.type}`;
    return 'activity.types.fallback';
};

export const actorLabel = (event: ActivityEvent, t: Translate): string => {
    const { actor } = event;
    if (actor.kind === 'system') return t('activity.actor.system', 'ProjectFlow');
    if (actor.kind === 'ai') {
        return t('activity.actor.via', '{name} via {client}')
            .replace('{name}', actor.name || '')
            .replace('{client}', actor.client || 'AI');
    }
    return actor.name || t('activity.actor.someone', 'Someone');
};

/**
 * Split the localized sentence into text / actor / object parts so the view can render the actor
 * bold and the object as a link. `formatDate` turns `YYYY-MM-DD` values into the user's format.
 */
export const activitySentence = (
    event: ActivityEvent,
    t: Translate,
    formatDate: (value: string) => string = (value) => value
): ActivityTextPart[] => {
    const change = event.changes ? Object.values(event.changes)[0] : undefined;
    const dateValue = (value: unknown) => {
        const text = str(value);
        return /^\d{4}-\d{2}-\d{2}/.test(text) ? formatDate(text.slice(0, 10)) : text;
    };
    const params: Record<string, string> = {
        from: dateValue(change?.from),
        to: dateValue(change?.to),
        names: names(event, 'assigneeNames') || names(event, 'userNames'),
        parent: str(event.meta?.taskTitle),
    };
    const template = t(activityTemplateKey(event), '{actor} · {object}');

    const parts: ActivityTextPart[] = [];
    const pattern = /\{(actor|object|from|to|names|parent)\}/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(template))) {
        if (match.index > last) parts.push({ kind: 'text', value: template.slice(last, match.index) });
        const token = match[1];
        if (token === 'actor') parts.push({ kind: 'actor', value: actorLabel(event, t) });
        else if (token === 'object') parts.push({ kind: 'object', value: event.object.title || t('activity.untitled', 'Untitled') });
        else parts.push({ kind: 'text', value: params[token] || '' });
        last = match.index + match[0].length;
    }
    if (last < template.length) parts.push({ kind: 'text', value: template.slice(last) });
    return parts;
};

/** In-app route of the event's object, or null when there is nothing to open. */
export const activityTargetPath = (event: ActivityEvent): string | null => {
    const metaPath = str(event.meta?.path);
    if (metaPath.startsWith('/')) return metaPath;
    const { object, projectId } = event;
    if (!projectId) return null;
    const base = `/project/${projectId}`;
    if (event.type === 'task.deleted') return base;
    if (object.type === 'task') return `${base}/tasks/${object.id}`;
    if (object.type === 'subtask' && object.parentId) return `${base}/tasks/${object.parentId}`;
    if (object.type === 'comment' && object.parentId) {
        if (object.parentType === 'task') return `${base}/tasks/${object.parentId}`;
        if (object.parentType === 'initiative') return `${base}/initiatives/${object.parentId}`;
        return base;
    }
    if (object.type === 'project') return base;
    return base;
};

/** Local calendar day key (YYYY-MM-DD) used for grouping. */
export const dayKey = (ms: number): string => {
    const date = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export interface ActivityDayGroup {
    key: string;
    events: ActivityEvent[];
}

/** Events are expected newest first; keeps that order inside and across groups. */
export const groupEventsByDay = (events: ActivityEvent[]): ActivityDayGroup[] => {
    const groups: ActivityDayGroup[] = [];
    for (const event of events) {
        const key = dayKey(event.createdAtMs);
        const current = groups[groups.length - 1];
        if (current && current.key === key) current.events.push(event);
        else groups.push({ key, events: [event] });
    }
    return groups;
};

/** Merge the live first page with older pages: dedupe by id, newest first. */
export const mergeEventPages = (live: ActivityEvent[], older: ActivityEvent[]): ActivityEvent[] => {
    const seen = new Set<string>();
    const out: ActivityEvent[] = [];
    for (const event of [...live, ...older]) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        out.push(event);
    }
    return out.sort((a, b) => b.createdAtMs - a.createdAtMs);
};
