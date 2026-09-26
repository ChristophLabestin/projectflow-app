import { describe, expect, it } from 'vitest';

import { daysFromToday, getDueBucket, hasTimeComponent, isDateOverdue, parseDateValue } from '../taskDates';
import { groupTasks, summarizeDue } from '../../components/work/workList';
import type { Task } from '../../types';

const NOW = new Date(2026, 8, 26, 15, 30); // Sat 26 Sep 2026, 15:30 local

describe('taskDates', () => {
    it('parses date-only strings as local midnight', () => {
        const date = parseDateValue('2026-09-26');
        expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 8, 26, 0]);
    });

    it('does not treat a task due today as overdue', () => {
        expect(isDateOverdue('2026-09-26', NOW)).toBe(false);
        expect(isDateOverdue('2026-09-25', NOW)).toBe(true);
    });

    it('computes whole-day distances and buckets', () => {
        expect(daysFromToday('2026-09-27', NOW)).toBe(1);
        expect(daysFromToday('', NOW)).toBeNull();
        expect(getDueBucket('2026-09-20', NOW)).toBe('overdue');
        expect(getDueBucket('2026-09-26', NOW)).toBe('today');
        expect(getDueBucket('2026-10-03', NOW)).toBe('week');
        expect(getDueBucket('2026-10-04', NOW)).toBe('later');
        expect(getDueBucket(undefined, NOW)).toBe('none');
    });

    it('detects real times of day', () => {
        expect(hasTimeComponent('2026-09-26')).toBe(false);
        expect(hasTimeComponent('2026-09-26T09:00:00.000Z')).toBe(true);
    });
});

describe('work list grouping', () => {
    const task = (id: string, extra: Partial<Task>): Task => ({
        id,
        projectId: 'p1',
        title: id,
        isCompleted: false,
        ...extra
    } as Task);
    const t = (key: string) => key;

    it('orders due groups by urgency and moves completed work last', () => {
        const today = new Date();
        const iso = (offset: number) => {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const groups = groupTasks([
            task('later', { dueDate: iso(20) }),
            task('late', { dueDate: iso(-2) }),
            task('none', {}),
            task('done', { isCompleted: true, dueDate: iso(-1) }),
            task('now', { dueDate: iso(0) })
        ], { groupBy: 'due', t });
        expect(groups.map((group) => group.key)).toEqual(['due:overdue', 'due:today', 'due:later', 'due:none', 'done']);
        expect(summarizeDue(groups.flatMap((group) => group.tasks))).toMatchObject({ overdue: 1, today: 1, open: 4 });
    });

    it('treats the legacy Todo status as Open when grouping by status', () => {
        const groups = groupTasks([task('a', { status: 'Todo' as Task['status'] }), task('b', { status: 'Open' })], { groupBy: 'status', t });
        expect(groups).toHaveLength(1);
        expect(groups[0].key).toBe('status:Open');
        expect(groups[0].tasks).toHaveLength(2);
    });

    it('lists the current user first and unassigned last when grouping by assignee', () => {
        const groups = groupTasks([
            task('x', { assigneeIds: ['zoe'] }),
            task('y', { assigneeId: 'me' }),
            task('z', {})
        ], { groupBy: 'assignee', t, currentUserId: 'me', members: [{ uid: 'zoe', displayName: 'Zoe' }] });
        expect(groups.map((group) => group.key)).toEqual(['assignee:me', 'assignee:zoe', 'assignee:none']);
    });
});
