import { describe, expect, it } from 'vitest';

import type { ActivityEvent } from '../../services/domain/activityStreamService';
import {
    activitySentence,
    activityTargetPath,
    groupEventsByDay,
    mergeEventPages,
} from '../activityStreamText';

const dict: Record<string, string> = {
    'activity.types.task.status_changed': '{actor} moved {object} to {to}',
    'activity.types.task.due_cleared': '{actor} removed the due date of {object}',
    'activity.types.task.due_changed': '{actor} set the due date of {object} to {to}',
    'activity.actor.via': '{name} via {client}',
};
const t = (key: string, fallback?: string) => dict[key] || fallback || key;

const event = (overrides: Partial<ActivityEvent> = {}): ActivityEvent => ({
    id: 'e1',
    type: 'task.status_changed',
    domain: 'task',
    actor: { kind: 'user', id: 'u1', name: 'Ann' },
    actorId: 'u1',
    object: { type: 'task', id: 't1', title: 'Write brief' },
    projectId: 'p1',
    changes: { status: { from: 'Open', to: 'Review' } },
    createdAtMs: new Date(2026, 9, 23, 10).getTime(),
    ...overrides,
});

describe('activitySentence', () => {
    it('splits actor, object and params', () => {
        expect(activitySentence(event(), t)).toEqual([
            { kind: 'actor', value: 'Ann' },
            { kind: 'text', value: ' moved ' },
            { kind: 'object', value: 'Write brief' },
            { kind: 'text', value: ' to ' },
            { kind: 'text', value: 'Review' },
        ]);
    });

    it('labels AI actors with their client and formats dates', () => {
        const parts = activitySentence(event({
            type: 'task.due_changed',
            actor: { kind: 'ai', id: 'u1', name: 'Ann', client: 'Claude' },
            changes: { dueDate: { from: null, to: '2026-11-02' } },
        }), t, (value) => `D:${value}`);
        expect(parts[0]).toEqual({ kind: 'actor', value: 'Ann via Claude' });
        expect(parts[parts.length - 1]).toEqual({ kind: 'text', value: 'D:2026-11-02' });
    });

    it('uses the cleared variant when the due date was removed', () => {
        const parts = activitySentence(event({ type: 'task.due_changed', changes: { dueDate: { from: '2026-11-02', to: null } } }), t);
        expect(parts.map((p) => p.value).join('')).toBe('Ann removed the due date of Write brief');
    });
});

describe('activityTargetPath', () => {
    it('routes tasks, subtasks, comments and meta paths', () => {
        expect(activityTargetPath(event())).toBe('/project/p1/tasks/t1');
        expect(activityTargetPath(event({ object: { type: 'subtask', id: 's', title: 's', parentType: 'task', parentId: 't9' } }))).toBe('/project/p1/tasks/t9');
        expect(activityTargetPath(event({ object: { type: 'comment', id: 'c', title: 'x', parentType: 'initiative', parentId: 'i1' } }))).toBe('/project/p1/initiatives/i1');
        expect(activityTargetPath(event({ meta: { path: '/wiki/abc' } }))).toBe('/wiki/abc');
        expect(activityTargetPath(event({ projectId: null }))).toBeNull();
    });
});

describe('grouping and merging', () => {
    it('dedupes pages and groups by local day', () => {
        const day1 = new Date(2026, 9, 23, 9).getTime();
        const day0 = new Date(2026, 9, 22, 18).getTime();
        const merged = mergeEventPages(
            [event({ id: 'a', createdAtMs: day1 }), event({ id: 'b', createdAtMs: day0 })],
            [event({ id: 'b', createdAtMs: day0 }), event({ id: 'c', createdAtMs: day0 - 1000 })]
        );
        expect(merged.map((e) => e.id)).toEqual(['a', 'b', 'c']);
        expect(groupEventsByDay(merged).map((g) => [g.key, g.events.length])).toEqual([['2026-10-23', 1], ['2026-10-22', 2]]);
    });
});
