import { describe, expect, it } from 'vitest';

import type { InsightsSnapshot, ProjectInsights } from '../../services/domain/insightsService';
import { aggregateInsights } from '../insightsAggregate';

const project = (id: string, over: Partial<ProjectInsights> = {}): ProjectInsights => ({
    id, title: id.toUpperCase(), status: '',
    created: [1, 1, 1, 1], completed: [1, 2, 3, 4], cycleDaysSum: [0, 0, 6, 8], cycleCount: [0, 0, 3, 4],
    scope: [5, 6, 7, 8], done: [1, 3, 6, 10], open: 4, overdue: 1, blocked: 0, dueNext7: 1, onTime: 3, late: 1,
    activity7d: 2, health: 'watch', people: { a: [2, 1, 0] }, ...over,
});

const snapshot: InsightsSnapshot = {
    day: '2026-10-23', weeks: ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'], computedAtMs: 1,
    projects: [project('p1'), project('p2', { health: 'risk', people: { a: [1, 0, 1], b: [3, 0, 0] } })],
};

describe('aggregateInsights', () => {
    it('sums the period and compares with the previous one', () => {
        const agg = aggregateInsights(snapshot, null, 2);
        expect(agg.points.map((p) => p.completed)).toEqual([6, 8]);
        expect(agg.completed).toBe(14);
        expect(agg.completedPrev).toBe(6);
        expect(agg.avgCycleDays).toBe(2);
        expect(agg.onTimeRate).toBe(0.75);
        expect(agg.projects[0].id).toBe('p2');
        expect(agg.healthCounts).toEqual({ good: 0, watch: 1, risk: 1 });
    });

    it('filters by project and merges people', () => {
        expect(aggregateInsights(snapshot, ['p1'], 4).completed).toBe(10);
        const people = aggregateInsights(snapshot, null, 4).people;
        expect(people[0]).toEqual({ uid: 'a', open: 3, overdue: 1, dueNext7: 1 });
        expect(people[1].uid).toBe('b');
    });
});
