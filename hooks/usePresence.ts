import { useEffect, useRef, useCallback, useState } from 'react';
import { auth } from '../services/firebase';
import { updatePresence, subscribeProjectPresence } from '../services/dataService';

export type PresenceState = 'online' | 'idle' | 'busy' | 'offline';

interface PresenceData {
    uid: string;
    displayName: string;
    photoURL?: string;
    email?: string;
    state: PresenceState;
    lastChanged: any;
    isOnline: boolean;
    isIdle: boolean;
}

interface UsePresenceOptions {
    projectId: string;
    tenantId?: string;
    /** Heartbeat interval in ms (default: 30000 - 30 seconds) */
    heartbeatInterval?: number;
    /** Time before marking user as idle in ms (default: 600000 - 10 minutes) */
    idleTimeout?: number;
    /** Whether to enable the presence tracking (default: true) */
    enabled?: boolean;
    /** Manual status selection (e.g. from user profile) */
    manualStatus?: PresenceState;
}

/**
 * Custom hook for managing user presence in a project
 * - Tracks online/idle/offline states
 * - Detects tab visibility changes
 * - Detects user activity (mouse movement, keyboard, scroll)
 * - Handles beforeunload cleanup
 */
export const usePresence = ({
    projectId,
    tenantId,
    heartbeatInterval = 30000, // 30 seconds
    idleTimeout = 600000, // 10 minutes of no activity
    enabled = true,
    manualStatus
}: UsePresenceOptions) => {
    const lastActivityRef = useRef<number>(Date.now());
    const currentStateRef = useRef<PresenceState>('online');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const idleCheckRef = useRef<NodeJS.Timeout | null>(null);

    // Update presence with current state
    const sendPresenceUpdate = useCallback(async (state: PresenceState) => {
        if (!projectId || !auth.currentUser) return;

        // If manualStatus is set and NOT 'online', fixate that status
        // manualStatus === 'online' means automatic mode
        const targetState = manualStatus && manualStatus !== 'online' && state !== 'offline' ? manualStatus : state;
        currentStateRef.current = targetState;

        try {
            await updatePresence(projectId, targetState === 'offline' ? 'offline' : 'online', tenantId);
        } catch (e) {
            console.error('Failed to send presence update', e);
        }
    }, [projectId, tenantId, manualStatus]);

    // Mark user as having activity
    const markActivity = useCallback(() => {
        lastActivityRef.current = Date.now();

        // If was idle, mark as online again (only if in auto mode)
        if (currentStateRef.current === 'idle' && (!manualStatus || manualStatus === 'online')) {
            sendPresenceUpdate('online');
        }
    }, [sendPresenceUpdate, manualStatus]);

    // Check if user has been idle
    const checkIdleState = useCallback(() => {
        // Skip idle check if manual status is set (Busy, Away, Offline)
        if (manualStatus && manualStatus !== 'online') return;

        const timeSinceActivity = Date.now() - lastActivityRef.current;

        if (timeSinceActivity > idleTimeout && currentStateRef.current === 'online') {
            sendPresenceUpdate('idle');
        }
    }, [idleTimeout, sendPresenceUpdate, manualStatus]);

    // Handle visibility change
    const handleVisibilityChange = useCallback(() => {
        if (document.hidden) {
            // Tab is hidden - mark as idle immediately (unless manual status set to Busy/Away/Offline)
            if (!manualStatus || manualStatus === 'online') sendPresenceUpdate('idle');
        } else {
            // Tab is visible again - mark as online (or restored manual status)
            lastActivityRef.current = Date.now();
            const restorationStatus = (manualStatus && manualStatus !== 'online') ? manualStatus : 'online';
            sendPresenceUpdate(restorationStatus);
        }
    }, [sendPresenceUpdate, manualStatus]);

    // Handle before unload
    const handleBeforeUnload = useCallback(() => {
        // Use sendBeacon for reliable offline update
        if (projectId && auth.currentUser) {
            // Note: We can't use async/await here, so we do a best-effort sync call
            // The backend timeout will handle cases where this doesn't fire
            sendPresenceUpdate('offline');
        }
    }, [projectId, sendPresenceUpdate]);

    useEffect(() => {
        if (!enabled || !projectId) return;

        // Initial online update
        sendPresenceUpdate('online');

        // Set up heartbeat
        intervalRef.current = setInterval(() => {
            if (currentStateRef.current !== 'offline') {
                sendPresenceUpdate(currentStateRef.current);
            }
        }, heartbeatInterval);

        // Set up idle check
        idleCheckRef.current = setInterval(checkIdleState, 10000); // Check every 10 seconds

        // Activity listeners
        const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
        activityEvents.forEach(event => {
            window.addEventListener(event, markActivity, { passive: true });
        });

        // Visibility change listener
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Before unload listener
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Also handle page hide for mobile browsers
        window.addEventListener('pagehide', handleBeforeUnload);

        // Cleanup
        return () => {
            // Clear intervals
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (idleCheckRef.current) clearInterval(idleCheckRef.current);

            // Remove event listeners
            activityEvents.forEach(event => {
                window.removeEventListener(event, markActivity);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handleBeforeUnload);

            // Send offline status
            sendPresenceUpdate('offline');
        };
    }, [enabled, projectId, heartbeatInterval, sendPresenceUpdate, markActivity, checkIdleState, handleVisibilityChange, handleBeforeUnload]);

    return {
        markActivity,
        goOnline: () => sendPresenceUpdate('online'),
        goOffline: () => sendPresenceUpdate('offline'),
        goIdle: () => sendPresenceUpdate('idle')
    };
};

/**
 * Custom hook for subscribing to project presence data
 * Returns enhanced presence data with proper online/idle/offline detection
 */
export const useProjectPresence = (
    projectId: string,
    tenantId?: string,
    /** Timeout in ms after which a user is considered offline (default: 120000 - 2 minutes) */
    offlineTimeout: number = 120000
) => {
    const [activeUsers, setActiveUsers] = useState<PresenceData[]>([]);

    useEffect(() => {
        if (!projectId) {
            setActiveUsers([]);
            return;
        }

        const unsubscribe = subscribeProjectPresence(projectId, (users) => {
            const now = Date.now();

            // Process presence data with timeout checks
            const processedUsers = users
                .filter(u => u && u.uid)
                .map(u => {
                    const lastChangedMs = u.lastChanged ?
                        (typeof u.lastChanged.toMillis === 'function' ? u.lastChanged.toMillis() : u.lastChanged)
                        : 0;

                    const timeSinceUpdate = now - lastChangedMs;

                    // Determine actual state based on time and reported state
                    let isOnline = false;
                    let isIdle = false;
                    let isBusy = false;

                    if (timeSinceUpdate < offlineTimeout) {
                        if (u.state === 'online') {
                            isOnline = true;
                        } else if (u.state === 'idle') {
                            isIdle = true;
                        } else if (u.state === 'busy') {
                            isBusy = true;
                        }
                    }
                    // If time since update exceeds timeout, user is offline regardless of reported state

                    return {
                        uid: u.uid,
                        displayName: u.displayName || 'User',
                        photoURL: u.photoURL,
                        email: u.email,
                        state: (isOnline ? 'online' : isIdle ? 'idle' : isBusy ? 'busy' : 'offline') as PresenceState,
                        lastChanged: u.lastChanged,
                        isOnline,
                        isIdle,
                        isBusy
                    };
                })
                // Only include users who are online, idle, or busy
                .filter(u => u.isOnline || u.isIdle || u.isBusy);

            setActiveUsers(processedUsers);
        }, tenantId);

        return () => unsubscribe();
    }, [projectId, tenantId, offlineTimeout]);

    return activeUsers;
};

// Import workspace presence functions
import { updateWorkspacePresence, subscribeWorkspacePresence, subscribeWorkspaceMembers } from '../services/dataService';

interface UseWorkspacePresenceOptions {
    tenantId?: string;
    /** Heartbeat interval in ms (default: 30000 - 30 seconds) */
    heartbeatInterval?: number;
    /** Time before marking user as idle in ms (default: 600000 - 10 minutes) */
    idleTimeout?: number;
    /** Whether to enable the presence tracking (default: true) */
    enabled?: boolean;
    /** Manual status selection */
    manualStatus?: 'online' | 'busy' | 'idle' | 'offline';
}

/**
 * Custom hook for managing user presence at the workspace level
 * Similar to usePresence but for workspace-wide tracking
 */
export const useWorkspacePresence = ({
    tenantId,
    heartbeatInterval = 30000,
    idleTimeout = 600000, // 10 minutes
    enabled = true,
    manualStatus
}: UseWorkspacePresenceOptions) => {
    const lastActivityRef = useRef<number>(Date.now());
    const currentStateRef = useRef<PresenceState>('online');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const idleCheckRef = useRef<NodeJS.Timeout | null>(null);

    const sendPresenceUpdate = useCallback(async (state: PresenceState) => {
        if (!auth.currentUser) return;

        // Respect manual status if provided
        // If manualStatus is 'online', it means "Auto Online/Idle"
        const targetState = manualStatus && manualStatus !== 'online' && state !== 'offline' ? manualStatus : state;
        currentStateRef.current = targetState;

        try {
            // If manual status is offline, we force offline, but we still heartbeat the state 
            // to ensure it doesn't get cleared by backend timeout (or just send offline once and stop)
            // For "Appear Offline", we send 'offline' to the DB.
            await updateWorkspacePresence(targetState, tenantId);
        } catch (e) {
            console.error('Failed to send workspace presence update', e);
        }
    }, [tenantId, manualStatus]);

    const markActivity = useCallback(() => {
        lastActivityRef.current = Date.now();
        // Only auto-restore to online if not in a manual fixed state (Busy/Away/Offline)
        // 'online' preference is the only one that allows auto-transitions
        if (currentStateRef.current === 'idle' && (!manualStatus || manualStatus === 'online')) {
            sendPresenceUpdate('online');
        }
    }, [sendPresenceUpdate, manualStatus]);

    const checkIdleState = useCallback(() => {
        // Skip auto-idle if manual status set (Busy, Away, Offline)
        if (manualStatus && manualStatus !== 'online') return;

        const timeSinceActivity = Date.now() - lastActivityRef.current;
        if (timeSinceActivity > idleTimeout && currentStateRef.current === 'online') {
            sendPresenceUpdate('idle');
        }
    }, [idleTimeout, sendPresenceUpdate, manualStatus]);

    const handleVisibilityChange = useCallback(() => {
        if (document.hidden) {
            // Tab is hidden - mark as idle immediately (unless manual status set to Busy/Away/Offline)
            if (!manualStatus || manualStatus === 'online') sendPresenceUpdate('idle');
        } else {
            lastActivityRef.current = Date.now();
            const restorationStatus = (manualStatus && manualStatus !== 'online') ? manualStatus : 'online';
            sendPresenceUpdate(restorationStatus);
        }
    }, [sendPresenceUpdate, manualStatus]);

    const handleBeforeUnload = useCallback(() => {
        if (auth.currentUser) {
            sendPresenceUpdate('offline');
        }
    }, [sendPresenceUpdate]);

    useEffect(() => {
        if (!enabled) return;

        sendPresenceUpdate('online');

        intervalRef.current = setInterval(() => {
            if (currentStateRef.current !== 'offline') {
                sendPresenceUpdate(currentStateRef.current);
            }
        }, heartbeatInterval);

        idleCheckRef.current = setInterval(checkIdleState, 10000);

        const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
        activityEvents.forEach(event => {
            window.addEventListener(event, markActivity, { passive: true });
        });

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handleBeforeUnload);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (idleCheckRef.current) clearInterval(idleCheckRef.current);

            activityEvents.forEach(event => {
                window.removeEventListener(event, markActivity);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handleBeforeUnload);

            sendPresenceUpdate('offline');
        };
    }, [enabled, heartbeatInterval, sendPresenceUpdate, markActivity, checkIdleState, handleVisibilityChange, handleBeforeUnload]);

    return { markActivity };
};

interface WorkspaceTeamMember extends PresenceData {
    role?: string;
    isWorkspaceMember: boolean;
}

/**
 * Hook to get workspace team members with their presence status
 * Filters out guests (users who are only in projects but not workspace members)
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
    const [presenceData, setPresenceData] = useState<PresenceData[]>([]);

    // Subscribe to workspace members
    useEffect(() => {
        const unsubscribe = subscribeWorkspaceMembers((members) => {
            setWorkspaceMembers(members);
        }, tenantId);
        return () => unsubscribe();
    }, [tenantId]);

    // Subscribe to presence
    useEffect(() => {
        const unsubscribe = subscribeWorkspacePresence((users) => {
            setPresenceData(users as PresenceData[]);
        }, tenantId);
        return () => unsubscribe();
    }, [tenantId]);

    // Combine members with presence, filtering out guests
    const combinedMembers = workspaceMembers
        // Filter out guests - only include actual workspace team members
        .filter(member => {
            const role = (member.role || '').toLowerCase();
            return role !== 'guest' && role !== 'viewer';
        })
        .map(member => {
            const presence = presenceData.find(p => p.uid === member.uid);
            return {
                uid: member.uid,
                displayName: member.displayName || 'User',
                photoURL: member.photoURL,
                email: member.email,
                role: member.role,
                state: presence?.state || 'offline' as PresenceState,
                lastChanged: presence?.lastChanged,
                isOnline: presence?.isOnline || false,
                isIdle: presence?.isIdle || false,
                isBusy: presence?.isBusy || false,
                isWorkspaceMember: true
            };
        });

    // Filter by status
    const onlineMembers = combinedMembers.filter(m => m.isOnline);
    const idleMembers = combinedMembers.filter(m => m.isIdle);
    const busyMembers = combinedMembers.filter(m => m.isBusy);
    const offlineMembers = combinedMembers.filter(m => !m.isOnline && !m.isIdle && !m.isBusy);

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
