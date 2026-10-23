// Client-side aggregation of the precomputed insights snapshot over the selected projects / period.
import type { InsightsHealth, InsightsSnapshot, ProjectInsights } from '../services/domain/insightsService';

export interface InsightsWeekPoint {
    week: string;
    completed: number;
    created: number;
    /** Average cycle time in days, null without completions. */
    cycleDays: number | null;
    scope: number;
    done: number;
}

export interface InsightsPersonLoad {
    uid: string;
    open: number;
    overdue: number;
    dueNext7: number;
}

export interface InsightsAggregate {
    points: InsightsWeekPoint[];
    completed: number;
    completedPrev: number;
    avgCycleDays: number | null;
    open: number;
    overdue: number;
    blocked: number;
    dueNext7: number;
    /** 0..1 or null without samples. */
    onTimeRate: number | null;
    people: InsightsPersonLoad[];
    projects: ProjectInsights[];
    healthCounts: Record<InsightsHealth, number>;
}

const sumAt = (projects: ProjectInsights[], key: 'created' | 'completed' | 'cycleDaysSum' | 'cycleCount' | 'scope' | 'done', index: number) =>
    projects.reduce((total, p) => total + (p[key]?.[index] || 0), 0);

/**
 * @param projectIds null = all projects of the snapshot
 * @param weeks number of most recent weeks (≤ snapshot weeks)
 */
export const aggregateInsights = (snapshot: InsightsSnapshot, projectIds: string[] | null, weeks: number): InsightsAggregate => {
    const projects = projectIds ? snapshot.projects.filter((p) => projectIds.includes(p.id)) : snapshot.projects;
    const total = snapshot.weeks.length;
    const from = Math.max(0, total - weeks);

    const points: InsightsWeekPoint[] = [];
    for (let i = from; i < total; i += 1) {
        const cycleCount = sumAt(projects, 'cycleCount', i);
        points.push({
            week: snapshot.weeks[i],
            completed: sumAt(projects, 'completed', i),
            created: sumAt(projects, 'created', i),
            cycleDays: cycleCount ? Math.round((sumAt(projects, 'cycleDaysSum', i) / cycleCount) * 10) / 10 : null,
            scope: sumAt(projects, 'scope', i),
            done: sumAt(projects, 'done', i),
        });
    }

    // Period totals vs. the same-length period before (when the snapshot reaches back that far).
    let completed = 0;
    let completedPrev = 0;
    let cycleSum = 0;
    let cycleCount = 0;
    for (let i = from; i < total; i += 1) {
        completed += sumAt(projects, 'completed', i);
        cycleSum += sumAt(projects, 'cycleDaysSum', i);
        cycleCount += sumAt(projects, 'cycleCount', i);
    }
    for (let i = Math.max(0, from - weeks); i < from; i += 1) completedPrev += sumAt(projects, 'completed', i);

    const people = new Map<string, InsightsPersonLoad>();
    for (const project of projects) {
        for (const [uid, [open, overdue, dueNext7]] of Object.entries(project.people || {})) {
            const entry = people.get(uid) || { uid, open: 0, overdue: 0, dueNext7: 0 };
            entry.open += open;
            entry.overdue += overdue;
            entry.dueNext7 += dueNext7;
            people.set(uid, entry);
        }
    }

    const onTime = projects.reduce((n, p) => n + p.onTime, 0);
    const late = projects.reduce((n, p) => n + p.late, 0);
    const healthCounts: Record<InsightsHealth, number> = { good: 0, watch: 0, risk: 0 };
    projects.forEach((p) => { healthCounts[p.health] += 1; });
    const healthRank: Record<InsightsHealth, number> = { risk: 0, watch: 1, good: 2 };

    return {
        points,
        completed,
        completedPrev,
        avgCycleDays: cycleCount ? Math.round((cycleSum / cycleCount) * 10) / 10 : null,
        open: projects.reduce((n, p) => n + p.open, 0),
        overdue: projects.reduce((n, p) => n + p.overdue, 0),
        blocked: projects.reduce((n, p) => n + p.blocked, 0),
        dueNext7: projects.reduce((n, p) => n + p.dueNext7, 0),
        onTimeRate: onTime + late > 0 ? onTime / (onTime + late) : null,
        people: Array.from(people.values()).sort((a, b) => b.open - a.open || b.overdue - a.overdue),
        projects: projects
            .filter((p) => p.open > 0 || p.done[p.done.length - 1] > 0)
            .slice()
            .sort((a, b) => healthRank[a.health] - healthRank[b.health] || b.overdue - a.overdue || b.open - a.open),
        healthCounts,
    };
};
