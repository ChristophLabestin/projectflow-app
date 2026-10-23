/**
 * Pure helpers for the compact AI views `search` and `my_today` (/api/projectflow/search, /me/today).
 * Small payloads on purpose: AI clients pay for every token they read.
 */
import { isOpenTask, localDayOf } from './nudge-logic';
import { localDateKey } from './tz-utils';

type Json = Record<string, any>;

export type TaskRef = { id: string; projectId: string; projectTitle?: string; title: string; status?: string; priority?: string; dueDate?: string };

const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const byPriorityThenDue = (a: TaskRef, b: TaskRef) =>
    (PRIORITY_RANK[a.priority || 'Medium'] ?? 2) - (PRIORITY_RANK[b.priority || 'Medium'] ?? 2) ||
    String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));

export const toTaskRef = (id: string, projectId: string, data: Json, timeZone: string, projectTitle?: string): TaskRef => {
    const due = localDayOf(data.dueDate, timeZone);
    return {
        id,
        projectId,
        ...(projectTitle ? { projectTitle } : {}),
        title: String(data.title || ''),
        ...(data.status ? { status: String(data.status) } : {}),
        ...(data.priority ? { priority: String(data.priority) } : {}),
        ...(due ? { dueDate: due } : {})
    };
};

/** Open assigned tasks grouped into overdue / today / next 7 days; the rest is only counted. */
export const planToday = (tasks: { ref: TaskRef; raw: Json }[], nowMs: number, timeZone: string) => {
    const today = localDateKey(nowMs, timeZone);
    const weekEnd = localDateKey(nowMs + 7 * 24 * 60 * 60 * 1000, timeZone);
    const overdue: TaskRef[] = [];
    const dueToday: TaskRef[] = [];
    const upcoming: TaskRef[] = [];
    let later = 0;
    let undated = 0;
    for (const { ref, raw } of tasks) {
        if (!isOpenTask(raw)) continue;
        if (!ref.dueDate) undated += 1;
        else if (ref.dueDate < today) overdue.push(ref);
        else if (ref.dueDate === today) dueToday.push(ref);
        else if (ref.dueDate <= weekEnd) upcoming.push(ref);
        else later += 1;
    }
    return {
        date: today,
        timeZone,
        overdue: overdue.sort(byPriorityThenDue),
        today: dueToday.sort(byPriorityThenDue),
        upcoming: upcoming.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))),
        counts: { overdue: overdue.length, today: dueToday.length, upcoming: upcoming.length, later, undated }
    };
};

export const normalizeQuery = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase().slice(0, 100) : '');

export const matchesQuery = (query: string, ...fields: unknown[]) =>
    fields.some((field) => typeof field === 'string' && field.toLowerCase().includes(query));
