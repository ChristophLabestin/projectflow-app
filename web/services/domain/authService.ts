import { auth } from '../firebase';
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

export const bootstrapTenantForCurrentUser = bootstrapTenantForCurrentUserCompat;
