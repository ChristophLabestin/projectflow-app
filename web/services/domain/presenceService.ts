import {
    ref,
    onValue,
    onDisconnect,
    set,
    update,
    serverTimestamp,
    type Unsubscribe
} from 'firebase/database';

import { auth, rtdb } from '../firebase';
import { resolveActiveTenantId } from './authService';

/**
 * Presence / online-state service backed by Firebase Realtime Database.
 *
 * RTDB is used instead of Firestore because it provides `onDisconnect`, which
 * reliably marks a user offline the instant their connection drops (tab close,
 * crash, network loss) — something Firestore + `beforeunload` cannot guarantee.
 *
 * Data model (single node per user, the project context is just a field):
 *   /status/{tenantId}/{uid} = {
 *     uid, displayName, photoURL, email,
 *     state: 'online' | 'idle' | 'busy' | 'offline',
 *     currentProjectId: string | null,
 *     lastChanged: <server timestamp>
 *   }
 */

export type PresenceState = 'online' | 'idle' | 'busy' | 'offline';

export interface PresenceRecord {
    uid: string;
    displayName: string;
    photoURL?: string;
    email?: string;
    state: PresenceState;
    currentProjectId?: string | null;
    lastChanged?: number;
}

export interface PresenceHandle {
    /** Update the reported state (online/idle/busy/offline). */
    setState: (state: PresenceState) => void;
    /** Update the project the user is currently viewing (or null when none). */
    setProject: (projectId: string | null) => void;
    /** Tear down listeners and mark the user offline. */
    stop: () => void;
}

export const presenceEnabled = (): boolean => !!rtdb;

const statusPath = (tenantId: string, uid: string) => `status/${tenantId}/${uid}`;

const resolveTenant = (tenantId?: string) =>
    resolveActiveTenantId(tenantId) || auth.currentUser?.uid;

/**
 * Establish presence for the current user. Returns a handle for updating state
 * and the current project, plus a `stop()` cleanup. No-op (with inert handle)
 * when RTDB is not configured so callers never need to null-check.
 */
export const connectPresence = (
    tenantId?: string,
    initial?: { state?: PresenceState; currentProjectId?: string | null }
): PresenceHandle => {
    const inert: PresenceHandle = {
        setState: () => undefined,
        setProject: () => undefined,
        stop: () => undefined
    };

    if (!rtdb) return inert;
    const user = auth.currentUser;
    const resolvedTenant = resolveTenant(tenantId);
    if (!user || !resolvedTenant) return inert;

    const userRef = ref(rtdb, statusPath(resolvedTenant, user.uid));
    const connectedRef = ref(rtdb, '.info/connected');

    let state: PresenceState = initial?.state ?? 'online';
    let currentProjectId: string | null = initial?.currentProjectId ?? null;
    let stopped = false;

    const baseProfile = () => ({
        uid: user.uid,
        displayName: user.displayName || 'User',
        photoURL: user.photoURL || '',
        email: user.email || ''
    });

    const write = (nextState: PresenceState) => {
        if (stopped || !rtdb) return;
        void set(userRef, {
            ...baseProfile(),
            state: nextState,
            currentProjectId,
            lastChanged: serverTimestamp()
        }).catch((e) => console.error('Failed to write presence', e));
    };

    // Re-arm onDisconnect and (re)write our state every time the SDK reports a
    // (re)connection. onDisconnect is registered server-side, so it fires even
    // on an unclean disconnect.
    const unsubscribe: Unsubscribe = onValue(connectedRef, (snap) => {
        if (snap.val() !== true || stopped) return;
        onDisconnect(userRef)
            .update({ state: 'offline', lastChanged: serverTimestamp() })
            .then(() => write(state))
            .catch((e) => console.error('Failed to arm presence onDisconnect', e));
    });

    return {
        setState: (next) => {
            state = next;
            write(next);
        },
        setProject: (projectId) => {
            currentProjectId = projectId;
            if (!stopped && rtdb) {
                void update(userRef, {
                    currentProjectId: projectId,
                    lastChanged: serverTimestamp()
                }).catch(() => undefined);
            }
        },
        stop: () => {
            stopped = true;
            unsubscribe();
            if (rtdb) {
                void update(userRef, {
                    state: 'offline',
                    currentProjectId: null,
                    lastChanged: serverTimestamp()
                }).catch(() => undefined);
            }
        }
    };
};

/**
 * Subscribe to every user's presence within a tenant. Returns an unsubscribe.
 * Emits the raw records; callers filter by project / staleness as needed.
 */
export const subscribeTenantPresence = (
    callback: (records: PresenceRecord[]) => void,
    tenantId?: string
): (() => void) => {
    if (!rtdb) {
        callback([]);
        return () => undefined;
    }
    const resolvedTenant = resolveTenant(tenantId);
    if (!resolvedTenant) {
        callback([]);
        return () => undefined;
    }

    const tenantRef = ref(rtdb, `status/${resolvedTenant}`);
    return onValue(tenantRef, (snap) => {
        const val = snap.val() as Record<string, PresenceRecord> | null;
        callback(val ? Object.values(val).filter((r) => r && r.uid) : []);
    });
};
