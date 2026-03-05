import { collectionGroup, getDocs, limit, query, where } from 'firebase/firestore';

import { auth, db } from '../firebase';
import { bootstrapTenantForCurrentUser as bootstrapTenantForCurrentUserCompat } from '../dataService';

const TENANT_CACHE_KEY = 'activeTenantId';

export const getActiveTenantId = () => {
    try {
        if (typeof localStorage === 'undefined') return undefined;
        return localStorage.getItem(TENANT_CACHE_KEY) || undefined;
    } catch {
        return undefined;
    }
};

export const setActiveTenantId = (tenantId: string) => {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(TENANT_CACHE_KEY, tenantId);
        }
    } catch {
        // ignore storage failures
    }
};

export const clearActiveTenantId = () => {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(TENANT_CACHE_KEY);
        }
    } catch {
        // ignore storage failures
    }
};

export const resolveActiveTenantId = (tenantId?: string) => {
    return tenantId || getActiveTenantId() || auth.currentUser?.uid;
};

const extractTenantIdFromPath = (path: string): string | undefined => {
    const parts = path.split('/');
    const tenantIndex = parts.indexOf('tenants');
    if (tenantIndex < 0) return undefined;
    return parts[tenantIndex + 1];
};

const toMillis = (value: any): number => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') {
        try {
            return value.toMillis();
        } catch {
            return 0;
        }
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? 0 : parsed;
};

const pickMostRecentTenant = async (queryPromise: Promise<any>): Promise<string | undefined> => {
    const snapshot = await queryPromise;
    if (!snapshot?.docs?.length) return undefined;

    const bestDoc = snapshot.docs.reduce((latestDoc: any, currentDoc: any) => {
        const latestData = latestDoc?.data?.() || {};
        const currentData = currentDoc?.data?.() || {};
        const latestTs = toMillis(latestData.updatedAt) || toMillis(latestData.createdAt);
        const currentTs = toMillis(currentData.updatedAt) || toMillis(currentData.createdAt);
        return currentTs > latestTs ? currentDoc : latestDoc;
    }, snapshot.docs[0]);

    return extractTenantIdFromPath(bestDoc.ref.path);
};

export const ensureActiveTenantId = async (options?: { forceProjectBacked?: boolean }): Promise<string | undefined> => {
    const user = auth.currentUser;
    if (!user) return undefined;

    const cachedTenantId = getActiveTenantId();
    if (cachedTenantId && !options?.forceProjectBacked) {
        return cachedTenantId;
    }

    let resolvedTenantId: string | undefined;

    try {
        resolvedTenantId = await pickMostRecentTenant(
            getDocs(
                query(
                    collectionGroup(db, 'projects'),
                    where('ownerId', '==', user.uid),
                    limit(50)
                )
            )
        );
    } catch (error) {
        console.warn('Failed to auto-detect tenant from owned projects', error);
    }

    if (!resolvedTenantId) {
        try {
            resolvedTenantId = await pickMostRecentTenant(
                getDocs(
                    query(
                        collectionGroup(db, 'projects'),
                        where('memberIds', 'array-contains', user.uid),
                        limit(50)
                    )
                )
            );
        } catch (error) {
            console.warn('Failed to auto-detect tenant from member projects', error);
        }
    }

    if (!resolvedTenantId) {
        resolvedTenantId = cachedTenantId || user.uid;
    }

    if (resolvedTenantId) {
        setActiveTenantId(resolvedTenantId);
    }

    return resolvedTenantId;
};

export const bootstrapTenantForCurrentUser = bootstrapTenantForCurrentUserCompat;
