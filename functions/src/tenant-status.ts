import * as functions from 'firebase-functions/v1';

import { db } from './init';
import { isValidTenantId } from './tenant-id';

/**
 * Workspace suspension (admin console, `tenants/{id}.suspendedAt`). Firestore rules close client access;
 * server paths that bypass rules (API/MCP tokens, in-app AI, flows, scheduled jobs) ask here.
 * Cached 60 s per instance — a suspension takes effect within a minute.
 */
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; suspended: boolean }>();

export const SUSPENDED_MESSAGE = 'This workspace is suspended. Contact support@getprojectflow.com.';

export const isTenantSuspended = async (tenantId: string): Promise<boolean> => {
    if (!tenantId) return false;
    // Not a single id segment (path injection, see tenant-id.ts): never an active workspace.
    if (!isValidTenantId(tenantId)) return true;
    const hit = cache.get(tenantId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.suspended;
    const snap = await db.collection('tenants').doc(tenantId).get();
    const suspended = snap.get('suspendedAt') != null;
    cache.set(tenantId, { at: Date.now(), suspended });
    if (cache.size > 5000) cache.clear();
    return suspended;
};

/** For batch jobs: ids of all suspended workspaces (one query per run). */
export const suspendedTenantIds = async (): Promise<Set<string>> => {
    const snap = await db.collection('tenants').where('suspendedAt', '!=', null).select().get();
    return new Set(snap.docs.map((d) => d.id));
};

export const clearTenantStatusCache = (tenantId?: string) => (tenantId ? cache.delete(tenantId) : cache.clear());

/** Callable guard: suspended workspaces answer `failed-precondition` / `workspace-suspended`. */
export const assertTenantActive = async (tenantId: unknown) => {
    if (typeof tenantId === 'string' && tenantId && (await isTenantSuspended(tenantId.trim()))) {
        throw new functions.https.HttpsError('failed-precondition', SUSPENDED_MESSAGE, { reason: 'workspace-suspended' });
    }
};
