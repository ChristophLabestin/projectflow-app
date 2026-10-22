import {
    collection,
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

// Scoped to the active workspace; other workspaces are isolated.
export const getAllMemberProjects = async (userId: string): Promise<Project[]> => {
    const tenantId = getActiveTenantId();
    if (!tenantId) return [];
    const snapshot = await getDocs(query(
        collection(db, 'tenants', tenantId, PROJECTS),
        where('memberIds', 'array-contains', userId)
    )).catch(() => null);
    if (!snapshot) return [];

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

// Reads activity per project (project members can read these) instead of a
// collection-group query, which the security rules do not allow.
export const getUserGlobalActivities = async (tenantId?: string, limitCount = 20): Promise<Activity[]> => {
    const user = auth.currentUser;
    if (!user) {
        return [];
    }

    const resolvedTenant = tenantId || getActiveTenantId();
    if (!resolvedTenant) {
        return [];
    }

    try {
        const projectsSnap = await getDocs(query(
            tenantProjectsCollection(resolvedTenant),
            where('memberIds', 'array-contains', user.uid)
        ));

        const perProject = await Promise.all(projectsSnap.docs.slice(0, 12).map(async (projectDoc) => {
            try {
                const snapshot = await getDocs(query(
                    collection(db, 'tenants', resolvedTenant, PROJECTS, projectDoc.id, ACTIVITIES),
                    orderBy('createdAt', 'desc'),
                    limit(limitCount)
                ));
                return snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    projectId: projectDoc.id,
                    ...docSnap.data()
                } as Activity));
            } catch {
                return [] as Activity[];
            }
        }));

        const millis = (value: any) => value?.toMillis?.() ?? (value ? new Date(value).getTime() : 0);
        return perProject
            .flat()
            .sort((a, b) => millis((b as any).createdAt) - millis((a as any).createdAt))
            .slice(0, limitCount);
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
        where('memberIds', 'array-contains', uid)
    ));

    return {
        projects: projectsSnap.size,
        teams: 1
    };
};
