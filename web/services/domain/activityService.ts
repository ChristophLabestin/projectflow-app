import {
    collection,
    collectionGroup,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    where
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import type { Activity } from '../../types';
import { resolveActiveTenantId } from './authService';

const projectActivitiesCollection = (tenantId: string, projectId: string) =>
    collection(db, 'tenants', tenantId, 'projects', projectId, 'activities');

export const getUserGlobalActivities = async (tenantId?: string, limitCount = 20): Promise<Activity[]> => {
    const user = auth.currentUser;
    const resolvedTenant = resolveActiveTenantId(tenantId);
    if (!user || !resolvedTenant) return [];

    try {
        const snapshot = await getDocs(
            query(
                collectionGroup(db, 'activities'),
                where('tenantId', '==', resolvedTenant),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            )
        );

        return snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        } as Activity));
    } catch (error) {
        console.error('Error fetching global activities:', error);
        return [];
    }
};

export const subscribeProjectActivity = (
    projectId: string,
    callback: (activity: Activity[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveActiveTenantId(tenantId);
    if (!resolvedTenant) {
        callback([]);
        return () => undefined;
    }

    const activityQuery = query(
        projectActivitiesCollection(resolvedTenant, projectId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(activityQuery, (snapshot) => {
        const activity = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        } as Activity));
        callback(activity);
    });
};
