import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { getActiveTenantId } from './authService';
import type { Activity, GeminiReport } from '../../types';

const HEALTH_SNAPSHOTS = 'healthSnapshots';
const GEMINI_REPORTS = 'gemini_reports';
const ACTIVITIES = 'activities';

const resolveTenantId = (tenantId?: string) => {
    const resolvedTenant = tenantId || getActiveTenantId();
    if (!resolvedTenant) {
        throw new Error('Tenant not available');
    }
    return resolvedTenant;
};

const projectSubCollection = (tenantId: string, projectId: string, collectionName: string) =>
    collection(db, 'tenants', tenantId, 'projects', projectId, collectionName);

const logProjectActivity = async (
    projectId: string,
    tenantId: string,
    payload: Omit<Activity, 'id' | 'projectId' | 'createdAt' | 'ownerId'>
) => {
    const user = auth.currentUser;
    if (!user) {
        return;
    }

    await addDoc(projectSubCollection(tenantId, projectId, ACTIVITIES), {
        projectId,
        tenantId,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        user: user.displayName || user.email || 'User',
        ...payload
    });
};

const getHealthSnapshot = async (projectId: string, date: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snapshotRef = doc(projectSubCollection(resolvedTenant, projectId, HEALTH_SNAPSHOTS), date);
    const snap = await getDoc(snapshotRef);
    if (!snap.exists()) {
        return null;
    }
    return { id: snap.id, ...snap.data() } as any;
};

export const saveHealthSnapshot = async (
    projectId: string,
    score: number,
    status: string,
    trend: string,
    tenantId?: string
): Promise<void> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const today = new Date().toISOString().split('T')[0];

    const snapshotRef = doc(projectSubCollection(resolvedTenant, projectId, HEALTH_SNAPSHOTS), today);
    await setDoc(snapshotRef, {
        projectId,
        tenantId: resolvedTenant,
        score,
        status,
        trend,
        date: today,
        timestamp: serverTimestamp()
    });
};

export const getHealthDelta = async (
    projectId: string,
    currentScore: number,
    tenantId?: string
): Promise<number | null> => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekDate = lastWeek.toISOString().split('T')[0];

    const snapshot = await getHealthSnapshot(projectId, lastWeekDate, tenantId);
    if (snapshot) {
        return currentScore - snapshot.score;
    }
    return null;
};

export const saveGeminiReport = async (projectId: string, content: string, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    const resolvedTenant = resolveTenantId(tenantId);

    await addDoc(projectSubCollection(resolvedTenant, projectId, GEMINI_REPORTS), {
        projectId,
        content,
        createdBy: user.uid,
        userName: user.displayName || 'User',
        createdAt: serverTimestamp()
    });

    await logProjectActivity(projectId, resolvedTenant, {
        action: 'Generated project report',
        target: 'CORA Report',
        details: content,
        type: 'report'
    });
};

export const getLatestGeminiReport = async (projectId: string, tenantId?: string): Promise<GeminiReport | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const reportQuery = query(
        projectSubCollection(resolvedTenant, projectId, GEMINI_REPORTS),
        orderBy('createdAt', 'desc'),
        limit(1)
    );

    const snap = await getDocs(reportQuery);
    if (snap.empty) {
        return null;
    }

    const data = snap.docs[0].data();
    return {
        id: snap.docs[0].id,
        ...data
    } as GeminiReport;
};
