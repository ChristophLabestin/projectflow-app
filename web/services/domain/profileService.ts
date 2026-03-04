import {
    collection,
    collectionGroup,
    getDocs,
    limit,
    orderBy,
    query,
    where
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { getActiveTenantId } from './authService';
import type { Activity, Project } from '../../types';

const PROJECTS = 'projects';
const ACTIVITIES = 'activities';

const tenantProjectsCollection = (tenantId: string) => collection(db, 'tenants', tenantId, PROJECTS);

const getTenantIdFromRef = (refPath: string) => {
    const parts = refPath.split('/');
    const tenantIndex = parts.indexOf('tenants');
    return tenantIndex >= 0 ? parts[tenantIndex + 1] : undefined;
};

export const getAllMemberProjects = async (userId: string): Promise<Project[]> => {
    const snapshot = await getDocs(query(
        collectionGroup(db, PROJECTS),
        where('memberIds', 'array-contains', userId)
    ));

    return snapshot.docs
        .map((docSnap) => ({
            id: docSnap.id,
            tenantId: getTenantIdFromRef(docSnap.ref.path),
            ...docSnap.data()
        } as Project))
        .sort((a, b) => {
            const aTime = (a.createdAt as any)?.toMillis?.() || new Date(a.createdAt as any).getTime() || 0;
            const bTime = (b.createdAt as any)?.toMillis?.() || new Date(b.createdAt as any).getTime() || 0;
            return bTime - aTime;
        });
};

export const getUserGlobalActivities = async (tenantId?: string, limitCount = 20): Promise<Activity[]> => {
    const user = auth.currentUser;
    if (!user) {
        return [];
    }

    const resolvedTenant = tenantId || getActiveTenantId() || user.uid;

    try {
        const snapshot = await getDocs(query(
            collectionGroup(db, ACTIVITIES),
            where('tenantId', '==', resolvedTenant),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        ));

        return snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        } as Activity));
    } catch (error) {
        console.error('Error fetching global activities:', error);
        return [];
    }
};

export const getUserProfileStats = async (uid: string, tenantId?: string) => {
    const resolvedTenant = tenantId || getActiveTenantId();
    if (!resolvedTenant) {
        return { projects: 0, teams: 1 };
    }

    const projectsSnap = await getDocs(query(
        tenantProjectsCollection(resolvedTenant),
        where('members', 'array_contains', uid)
    ));

    return {
        projects: projectsSnap.size,
        teams: 1
    };
};
