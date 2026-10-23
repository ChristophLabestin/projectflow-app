// Pure computation of the workspace insights snapshot (tenants/{t}/insights_daily/{day|latest}).
// Concept: brain/plans/activity-insights-concept.md. The client aggregates the per-project series
// over the selected projects / period, so filters never need another read.
import { effectiveAssignees, isDone, Json, toMillis } from './task-effects';

export const INSIGHTS_WEEKS = 12;
export const INSIGHTS_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface InsightTask {
    projectId: string;
    createdAtMs: number | null;
    completedAtMs: number | null;
    done: boolean;
    /** YYYY-MM-DD or null. */
    due: string | null;
    status: string;
    assigneeIds: string[];
}

export interface InsightProjectInput {
    id: string;
    title: string;
    status: string;
}

export type Health = 'good' | 'watch' | 'risk';

export interface ProjectInsights {
    id: string;
    title: string;
    status: string;
    /** Per ISO week (oldest first, aligned with `weeks`). */
    created: number[];
    completed: number[];
    cycleDaysSum: number[];
    cycleCount: number[];
    /** Cumulative tasks created / completed at the end of each week (burn-up). */
    scope: number[];
    done: number[];
    open: number;
    overdue: number;
    blocked: number;
    dueNext7: number;
    /** Completed in the window with a due date: on time vs late (termintreue). */
    onTime: number;
    late: number;
    activity7d: number;
    health: Health;
    /** uid -> [open, overdue, dueNext7]. */
    people: Record<string, [number, number, number]>;
}

export interface InsightsSnapshot {
    v: number;
    day: string;
    /** Monday (YYYY-MM-DD) of each week, oldest first. */
    weeks: string[];
    projects: ProjectInsights[];
    truncated: boolean;
}

const ymd = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Monday 00:00 UTC of the week containing `ms`. */
export const weekStart = (ms: number): number => {
    const date = new Date(ms);
    const day = (date.getUTCDay() + 6) % 7; // Monday = 0
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - day * DAY_MS;
};

export const dueOf = (value: unknown): string | null => {
    if (typeof value === 'string') {
        const text = value.trim();
        return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
    }
    const ms = toMillis(value);
    return ms === null ? null : ymd(ms);
};

/** Normalise a raw task doc. */
export const toInsightTask = (projectId: string, data: Json): InsightTask => {
    const done = isDone(data);
    const completedAtMs = done ? toMillis(data.completedAt) ?? toMillis(data.updatedAt) : null;
    return {
        projectId,
        createdAtMs: toMillis(data.createdAt),
        completedAtMs,
        done,
        due: dueOf(data.dueDate),
        status: typeof data.status === 'string' ? data.status : '',
        assigneeIds: effectiveAssignees(data)
    };
};

export const healthOf = (p: Pick<ProjectInsights, 'open' | 'overdue' | 'blocked' | 'onTime' | 'late' | 'activity7d'>): Health => {
    const samples = p.onTime + p.late;
    const onTimeRate = samples > 0 ? p.onTime / samples : 1;
    const overdueShare = p.open > 0 ? p.overdue / p.open : 0;
    if (overdueShare >= 0.25 || p.blocked >= 3 || (samples >= 4 && onTimeRate < 0.5)) return 'risk';
    if (p.overdue > 0 || p.blocked > 0 || (p.open > 0 && p.activity7d === 0) || (samples >= 4 && onTimeRate < 0.8)) return 'watch';
    return 'good';
};

export const computeInsights = (
    projects: InsightProjectInput[],
    tasks: InsightTask[],
    activity7dByProject: Record<string, number>,
    nowMs: number,
    maxProjects = 300
): InsightsSnapshot => {
    const currentWeek = weekStart(nowMs);
    const weekStarts = Array.from({ length: INSIGHTS_WEEKS }, (_, i) => currentWeek - (INSIGHTS_WEEKS - 1 - i) * 7 * DAY_MS);
    const windowStart = weekStarts[0];
    const today = ymd(nowMs);
    const in7 = ymd(nowMs + 7 * DAY_MS);
    const weekIndex = (ms: number) => Math.floor((weekStart(ms) - windowStart) / (7 * DAY_MS));

    const byProject = new Map<string, ProjectInsights>();
    for (const project of projects.slice(0, maxProjects)) {
        const zeros = () => new Array(INSIGHTS_WEEKS).fill(0);
        byProject.set(project.id, {
            id: project.id,
            title: project.title,
            status: project.status,
            created: zeros(),
            completed: zeros(),
            cycleDaysSum: zeros(),
            cycleCount: zeros(),
            scope: zeros(),
            done: zeros(),
            open: 0,
            overdue: 0,
            blocked: 0,
            dueNext7: 0,
            onTime: 0,
            late: 0,
            activity7d: activity7dByProject[project.id] || 0,
            health: 'good',
            people: {}
        });
    }

    for (const task of tasks) {
        const p = byProject.get(task.projectId);
        if (!p) continue;
        const created = task.createdAtMs ?? 0;
        const createdIdx = created >= windowStart ? weekIndex(created) : -1;
        if (createdIdx >= 0 && createdIdx < INSIGHTS_WEEKS) p.created[createdIdx] += 1;
        // Burn-up: counts from the week the task existed / was completed onwards.
        const scopeFrom = created < windowStart ? 0 : createdIdx;
        if (scopeFrom >= 0) for (let i = scopeFrom; i < INSIGHTS_WEEKS; i += 1) p.scope[i] += 1;

        if (task.done) {
            const completed = task.completedAtMs;
            if (completed !== null) {
                const doneFrom = completed < windowStart ? 0 : weekIndex(completed);
                for (let i = Math.max(0, doneFrom); i < INSIGHTS_WEEKS; i += 1) p.done[i] += 1;
                if (completed >= windowStart) {
                    const idx = weekIndex(completed);
                    if (idx >= 0 && idx < INSIGHTS_WEEKS) {
                        p.completed[idx] += 1;
                        if (task.createdAtMs !== null && completed >= task.createdAtMs) {
                            p.cycleDaysSum[idx] += Math.round(((completed - task.createdAtMs) / DAY_MS) * 10) / 10;
                            p.cycleCount[idx] += 1;
                        }
                    }
                    if (task.due) {
                        if (ymd(completed) <= task.due) p.onTime += 1;
                        else p.late += 1;
                    }
                }
            } else {
                for (let i = 0; i < INSIGHTS_WEEKS; i += 1) p.done[i] += 1;
            }
            continue;
        }

        p.open += 1;
        const overdue = Boolean(task.due && task.due < today);
        const dueSoon = Boolean(task.due && task.due >= today && task.due <= in7);
        if (overdue) p.overdue += 1;
        if (dueSoon) p.dueNext7 += 1;
        if (task.status === 'Blocked') p.blocked += 1;
        for (const uid of task.assigneeIds) {
            const load = p.people[uid] || (p.people[uid] = [0, 0, 0]);
            load[0] += 1;
            if (overdue) load[1] += 1;
            if (dueSoon) load[2] += 1;
        }
    }

    for (const p of byProject.values()) {
        p.cycleDaysSum = p.cycleDaysSum.map((v) => Math.round(v * 10) / 10);
        p.health = healthOf(p);
    }

    return {
        v: INSIGHTS_VERSION,
        day: today,
        weeks: weekStarts.map(ymd),
        projects: Array.from(byProject.values()),
        truncated: projects.length > maxProjects
    };
};

/** Compact text digest of a snapshot for the AI weekly report (current week vs. previous). */
export const insightsDigest = (snapshot: InsightsSnapshot): string => {
    const last = INSIGHTS_WEEKS - 1;
    const lines = snapshot.projects
        .filter((p) => p.open > 0 || p.completed[last] > 0 || p.completed[last - 1] > 0)
        .slice(0, 40)
        .map((p) => `- ${p.title}: completed this week ${p.completed[last]}, last week ${p.completed[last - 1]}, `
            + `open ${p.open}, overdue ${p.overdue}, blocked ${p.blocked}, due next 7 days ${p.dueNext7}, `
            + `on-time ${p.onTime}/${p.onTime + p.late}, activity 7d ${p.activity7d}, health ${p.health}`);
    return lines.join('\n');
};
