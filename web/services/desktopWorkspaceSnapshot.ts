import { hasDesktopCapability } from './desktop';
import { getCachedTenantId, setCachedWorkspaceRole } from './internal/workspaceDataCore';
import type { WorkspaceSummary } from './domain/workspacesService';

/**
 * Desktop instant start (shell capability 'offline-cache'): the last resolved workspace per user, so the app can
 * render at once from the on-disk Firestore cache while the real resolution runs in the background (or offline).
 */
const KEY = 'pf_desktop_workspace_snapshot';

interface Snapshot {
    uid: string;
    activeId: string;
    workspaces: WorkspaceSummary[];
}

export const readWorkspaceSnapshot = (uid: string): Snapshot | null => {
    if (!hasDesktopCapability('offline-cache')) return null;
    try {
        const snapshot = JSON.parse(localStorage.getItem(KEY) || 'null') as Snapshot | null;
        // Only when the tenant every tenant-scoped read uses is still the snapshot's one.
        if (!snapshot || snapshot.uid !== uid || snapshot.activeId !== getCachedTenantId()) return null;
        const active = snapshot.workspaces.find((workspace) => workspace.id === snapshot.activeId);
        if (!active) return null;
        setCachedWorkspaceRole(active.role);
        return snapshot;
    } catch {
        return null;
    }
};

export const writeWorkspaceSnapshot = (snapshot: Snapshot) => {
    if (!hasDesktopCapability('offline-cache')) return;
    try {
        localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch {
        // storage unavailable: no instant start next time
    }
};

export const clearWorkspaceSnapshot = () => {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // ignore
    }
};
