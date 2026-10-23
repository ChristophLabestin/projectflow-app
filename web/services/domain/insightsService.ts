// Workspace insights (/insights): precomputed snapshot + AI weekly report (Cloud Functions write both).
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../firebase';
import { toMillis } from '../../utils/time';

export type InsightsHealth = 'good' | 'watch' | 'risk';

export interface ProjectInsights {
    id: string;
    title: string;
    status: string;
    created: number[];
    completed: number[];
    cycleDaysSum: number[];
    cycleCount: number[];
    scope: number[];
    done: number[];
    open: number;
    overdue: number;
    blocked: number;
    dueNext7: number;
    onTime: number;
    late: number;
    activity7d: number;
    health: InsightsHealth;
    people: Record<string, [number, number, number]>;
}

export interface InsightsSnapshot {
    day: string;
    weeks: string[];
    projects: ProjectInsights[];
    truncated?: boolean;
    computedAtMs: number;
}

export interface InsightsReport {
    week: string;
    language: string;
    markdown: string;
    createdAtMs: number;
}

export const subscribeLatestInsights = (
    tenantId: string,
    callback: (snapshot: InsightsSnapshot | null) => void,
    onError?: (error: Error) => void
) => onSnapshot(doc(db, 'tenants', tenantId, 'insights_daily', 'latest'), (snap) => {
    if (!snap.exists()) {
        callback(null);
        return;
    }
    const data = snap.data();
    callback({
        day: data.day,
        weeks: data.weeks || [],
        projects: data.projects || [],
        truncated: data.truncated,
        computedAtMs: toMillis(data.computedAt) || 0,
    });
}, (error) => onError?.(error));

export const refreshWorkspaceInsights = async (tenantId: string): Promise<boolean> => {
    const result = await httpsCallable<{ tenantId: string }, { refreshed: boolean }>(functions, 'refreshWorkspaceInsights')({ tenantId });
    return result.data.refreshed;
};

export const generateWeeklyInsightsReport = async (tenantId: string, language: string): Promise<InsightsReport> => {
    const result = await httpsCallable<{ tenantId: string; language: string }, { week: string; markdown: string }>(
        functions, 'generateWeeklyInsightsReport', { timeout: 120000 }
    )({ tenantId, language });
    return { ...result.data, language, createdAtMs: Date.now() };
};

export const getLatestInsightsReport = async (tenantId: string, language: string): Promise<InsightsReport | null> => {
    const snap = await getDocs(query(
        collection(db, 'tenants', tenantId, 'insights_reports'),
        where('language', '==', language),
        orderBy('createdAt', 'desc'),
        limit(1)
    ));
    const first = snap.docs[0];
    if (!first) return null;
    const data = first.data();
    return { week: data.week, language: data.language, markdown: data.markdown, createdAtMs: toMillis(data.createdAt) || 0 };
};
