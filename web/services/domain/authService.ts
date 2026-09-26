import {
    clearCachedTenantId,
    getCachedTenantId,
    setCachedTenantId
} from '../internal/workspaceDataCore';

export const getActiveTenantId = () => getCachedTenantId();

export const setActiveTenantId = (tenantId: string) => setCachedTenantId(tenantId);

export const clearActiveTenantId = () => clearCachedTenantId();

export const resolveActiveTenantId = (tenantId?: string) => tenantId || getCachedTenantId();

// The active workspace is resolved once by WorkspaceProvider after sign-in.
export const ensureActiveTenantId = async (_options?: { forceProjectBacked?: boolean }): Promise<string | undefined> => (
    getCachedTenantId()
);
