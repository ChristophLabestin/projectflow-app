import { useEffect, useRef, useState } from 'react';
import {
    connectPresence,
    subscribeTenantPresence,
    presenceEnabled,
    type PresenceState,
    type PresenceRecord,
    type PresenceHandle
} from '../services/domain/presenceService';
import { subscribeWorkspaceMembers } from '../services/domain/workspaceMembersService';

export type { PresenceState } from '../services/domain/presenceService';

export interface PresenceData {
    uid: string;
    displayName: string;
    photoURL?: string;
    email?: string;
    state: PresenceState;
    currentProjectId?: string | null;
    lastChanged?: number;
    isOnline: boolean;
    isIdle: boolean;
    isBusy: boolean;
}

/**
 * Records older than this (no `lastChanged` refresh) are treated as offline even
 * if their stored state says otherwise. onDisconnect normally handles offline
 * instantly; this is a safety net for frozen tabs / clock skew.
 */
const STALE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * The single active presence owner for the current user. `useWorkspacePresence`
 * owns the RTDB write (state + onDisconnect); `usePresence` only annotates which
 * project the user is currently viewing on that same node.
 */
let activeOwner: PresenceHandle | null = null;

const toPresenceData = (record: PresenceRecord, now: number): PresenceData => {
    const lastChanged = typeof record.lastChanged === 'number' ? record.lastChanged : 0;
    const fresh = lastChanged > 0 && now - lastChanged < STALE_TIMEOUT;
    const state: PresenceState = fresh ? record.state : 'offline';
    return {
        uid: record.uid,
        displayName: record.displayName || 'User',
        photoURL: record.photoURL,
        email: record.email,
        state,
        currentProjectId: record.currentProjectId ?? null,
        lastChanged,
        isOnline: state === 'online',
        isIdle: state === 'idle',
        isBusy: state === 'busy'
    };
};

interface UseWorkspacePresenceOptions {
    tenantId?: string;
    /** Time before marking user as idle in ms (default: 600000 - 10 minutes) */
    idleTimeout?: number;
    /** Whether to enable presence tracking (default: true) */
    enabled?: boolean;
    /** Manual status from the user profile ('online' means automatic mode) */
    manualStatus?: PresenceState;
}

/**
 * Owns the current user's presence for the whole session. Mount once near the
 * app root. Handles idle detection, tab visibility, and the manual status
 * override; reliable offline is handled server-side via onDisconnect.
 */
export const useWorkspacePresence = ({
    tenantId,
    idleTimeout = 600000,
    enabled = true,
    manualStatus
}: UseWorkspacePresenceOptions) => {
    const handleRef = useRef<PresenceHandle | null>(null);
    const lastActivityRef = useRef<number>(Date.now());
    const stateRef = useRef<PresenceState>('online');
    const manualRef = useRef<PresenceState | undefined>(manualStatus);
    manualRef.current = manualStatus;

    // Apply manual status changes without re-establishing the connection.
    useEffect(() => {
        if (!handleRef.current) return;
        const fixed = manualStatus && manualStatus !== 'online' ? manualStatus : 'online';
        stateRef.current = fixed;
        handleRef.current.setState(fixed);
    }, [manualStatus]);

    useEffect(() => {
        if (!enabled || !presenceEnabled()) return;

        const desired = (): PresenceState =>
            manualRef.current && manualRef.current !== 'online' ? manualRef.current : 'online';

        const handle = connectPresence(tenantId, { state: desired() });
        handleRef.current = handle;
        activeOwner = handle;
        stateRef.current = desired();

        const setState = (next: PresenceState) => {
            stateRef.current = next;
            handle.setState(next);
        };

        const markActivity = () => {
            lastActivityRef.current = Date.now();
            const manual = manualRef.current;
            if (stateRef.current === 'idle' && (!manual || manual === 'online')) {
                setState('online');
            }
        };

        const checkIdle = () => {
            const manual = manualRef.current;
            if (manual && manual !== 'online') return; // fixed manual state
            if (
                stateRef.current === 'online' &&
                Date.now() - lastActivityRef.current > idleTimeout
            ) {
                setState('idle');
            }
        };

        const handleVisibility = () => {
            const manual = manualRef.current;
            if (document.hidden) {
                if (!manual || manual === 'online') setState('idle');
            } else {
                lastActivityRef.current = Date.now();
                setState(manual && manual !== 'online' ? manual : 'online');
            }
        };

        const idleInterval = setInterval(checkIdle, 10000);
        const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
        activityEvents.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(idleInterval);
            activityEvents.forEach((e) => window.removeEventListener(e, markActivity));
            document.removeEventListener('visibilitychange', handleVisibility);
            handle.stop();
            if (activeOwner === handle) activeOwner = null;
            handleRef.current = null;
        };
    }, [enabled, tenantId, idleTimeout]);

    return { markActivity: () => (lastActivityRef.current = Date.now()) };
};

interface UsePresenceOptions {
    projectId: string;
    tenantId?: string;
    enabled?: boolean;
}

/**
 * Annotates the active presence node with the project the user is currently
 * viewing. Does not own the connection — `useWorkspacePresence` must be mounted.
 */
export const usePresence = ({ projectId, enabled = true }: UsePresenceOptions) => {
    useEffect(() => {
        if (!enabled || !projectId || !presenceEnabled()) return;
        activeOwner?.setProject(projectId);
        return () => {
            activeOwner?.setProject(null);
        };
    }, [enabled, projectId]);

    return {};
};

/**
 * Subscribe to the users currently active in a given project. Returns only
 * online/idle/busy users whose presence is fresh.
 */
export const useProjectPresence = (projectId: string, tenantId?: string): PresenceData[] => {
    const [activeUsers, setActiveUsers] = useState<PresenceData[]>([]);

    useEffect(() => {
        if (!projectId) {
            setActiveUsers([]);
            return;
        }
        const unsubscribe = subscribeTenantPresence((records) => {
            const now = Date.now();
            const users = records
                .map((r) => toPresenceData(r, now))
                .filter((u) => u.currentProjectId === projectId && (u.isOnline || u.isIdle || u.isBusy));
            setActiveUsers(users);
        }, tenantId);
        return () => unsubscribe();
    }, [projectId, tenantId]);

    return activeUsers;
};

interface WorkspaceTeamMember extends PresenceData {
    role?: string;
    isWorkspaceMember: boolean;
}

/**
 * Workspace team members joined with their presence status (guests excluded).
 */
export const useWorkspaceTeamPresence = (tenantId?: string): {
    members: WorkspaceTeamMember[];
    onlineMembers: WorkspaceTeamMember[];
    idleMembers: WorkspaceTeamMember[];
    busyMembers: WorkspaceTeamMember[];
    offlineMembers: WorkspaceTeamMember[];
    totalCount: number;
    onlineCount: number;
    busyCount: number;
} => {
    const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
    const [presenceByUid, setPresenceByUid] = useState<Record<string, PresenceData>>({});

    useEffect(() => {
        const unsubscribe = subscribeWorkspaceMembers((members) => {
            setWorkspaceMembers(members);
        }, tenantId);
        return () => unsubscribe();
    }, [tenantId]);

    useEffect(() => {
        const unsubscribe = subscribeTenantPresence((records) => {
            const now = Date.now();
            const map: Record<string, PresenceData> = {};
            records.forEach((r) => {
                map[r.uid] = toPresenceData(r, now);
            });
            setPresenceByUid(map);
        }, tenantId);
        return () => unsubscribe();
    }, [tenantId]);

    const combinedMembers: WorkspaceTeamMember[] = workspaceMembers
        .filter((member) => {
            const role = (member.role || '').toLowerCase();
            return role !== 'guest' && role !== 'viewer';
        })
        .map((member) => {
            const presence = presenceByUid[member.uid];
            return {
                uid: member.uid,
                displayName: member.displayName || 'User',
                photoURL: member.photoURL,
                email: member.email,
                role: member.role,
                state: presence?.state || 'offline',
                currentProjectId: presence?.currentProjectId ?? null,
                lastChanged: presence?.lastChanged,
                isOnline: presence?.isOnline || false,
                isIdle: presence?.isIdle || false,
                isBusy: presence?.isBusy || false,
                isWorkspaceMember: true
            };
        });

    const onlineMembers = combinedMembers.filter((m) => m.isOnline);
    const idleMembers = combinedMembers.filter((m) => m.isIdle);
    const busyMembers = combinedMembers.filter((m) => m.isBusy);
    const offlineMembers = combinedMembers.filter((m) => !m.isOnline && !m.isIdle && !m.isBusy);

    return {
        members: combinedMembers,
        onlineMembers,
        idleMembers,
        busyMembers,
        offlineMembers,
        totalCount: combinedMembers.length,
        onlineCount: onlineMembers.length,
        busyCount: busyMembers.length
    };
};
