import {
    addDoc,
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import type { Activity, Idea, SubTask, Task, WorkspaceRole } from '../../types';

const TENANTS = 'tenants';
const USERS = 'users';
const PROJECTS = 'projects';
const TASKS = 'tasks';
const INITIATIVES = 'initiatives';
const SUBTASKS = 'subtasks';
const ISSUES = 'issues';
const IDEAS = 'ideas';
const ACTIVITIES = 'activities';
const CATEGORIES = 'taskCategories';
const LEGACY_TENANT_CACHE_KEY = 'activeTenantId';
const tenantCacheKey = (uid: string) => `projectflow.activeTenant.${uid}`;
const ensureUserProfileCache = new Map<string, Promise<void>>();
let activeTenantMemory: { uid: string; tenantId: string } | null = null;

// The active workspace is stored per user so a different account on the same
// browser never inherits someone else's workspace. It is resolved and
// validated against the user's memberships by WorkspaceProvider on login.
export const getCachedTenantId = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return undefined;
    if (activeTenantMemory?.uid === uid) return activeTenantMemory.tenantId;
    try {
        if (typeof localStorage === 'undefined') return undefined;
        return localStorage.getItem(tenantCacheKey(uid)) || undefined;
    } catch {
        return undefined;
    }
};

export const setCachedTenantId = (tenantId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    activeTenantMemory = { uid, tenantId };
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(tenantCacheKey(uid), tenantId);
            localStorage.removeItem(LEGACY_TENANT_CACHE_KEY);
        }
    } catch {
        // best-effort; ignore storage failures
    }
};

// Role of the current user in the active workspace (set by WorkspaceProvider).
let activeWorkspaceRole: WorkspaceRole | null = null;
export const setCachedWorkspaceRole = (role: WorkspaceRole | null) => { activeWorkspaceRole = role; };
export const getCachedWorkspaceRole = () => activeWorkspaceRole;
export const isGuestInActiveWorkspace = () => activeWorkspaceRole === 'Guest';

export const clearCachedTenantId = () => {
    const uid = auth.currentUser?.uid;
    activeTenantMemory = null;
    try {
        if (typeof localStorage === 'undefined') return;
        if (uid) localStorage.removeItem(tenantCacheKey(uid));
        localStorage.removeItem(LEGACY_TENANT_CACHE_KEY);
    } catch {
        // ignore
    }
};

export const resolveTenantId = (tenantId?: string) => {
    if (!auth.currentUser) {
        throw new Error('User not authenticated');
    }
    const resolved = tenantId || getCachedTenantId();
    if (!resolved) {
        throw new Error('No active workspace');
    }
    return resolved;
};

const tenantDocRef = (tenantId: string) => doc(db, TENANTS, tenantId);
const userDocRef = (userId: string) => doc(db, USERS, userId);

export const projectDocRef = (tenantId: string, projectId: string) => doc(tenantDocRef(tenantId), PROJECTS, projectId);

export const projectSubCollection = (tenantId: string, projectId: string, subCollectionName: string) => (
    collection(db, TENANTS, tenantId, PROJECTS, projectId, subCollectionName)
);

// Ensures the global users/{uid} profile exists. Workspace membership is no
// longer created implicitly: members are added by workspace creation or by
// accepting an invitation (see workspacesService). The tenant argument is kept
// for the many existing call sites.
export const ensureTenantAndUser = async (_tenantId?: string, _role?: WorkspaceRole) => {
    const user = auth.currentUser;
    if (!user) return;

    const cached = ensureUserProfileCache.get(user.uid);
    if (cached) return cached;

    const ensurePromise = (async () => {
        const globalUserRef = userDocRef(user.uid);
        const globalUserSnap = await getDoc(globalUserRef);
        const existing = globalUserSnap.exists() ? globalUserSnap.data() : null;

        await setDoc(globalUserRef, {
            uid: user.uid,
            email: (user.email || '').toLowerCase(),
            displayName: user.displayName || existing?.displayName || (user.email || 'User').split('@')[0],
            photoURL: existing?.photoURL || user.photoURL || '',
            updatedAt: serverTimestamp(),
            ...(!existing ? { createdAt: serverTimestamp() } : {}),
            ...(!existing?.aiUsage ? {
                aiUsage: {
                    tokensUsed: 0,
                    tokenLimit: 1000000,
                    imagesUsed: 0,
                    imageLimit: 50,
                    lastReset: serverTimestamp()
                }
            } : {})
        }, { merge: true });
    })().catch((error) => {
        ensureUserProfileCache.delete(user.uid);
        throw error;
    });

    ensureUserProfileCache.set(user.uid, ensurePromise);
    return ensurePromise;
};

export const refreshCurrentUserProfile = async () => {
    const uid = auth.currentUser?.uid;
    if (uid) ensureUserProfileCache.delete(uid);
    await ensureTenantAndUser();
};

export const getProjectContextFromRef = (ref: { parent?: any }) => {
    const projectRef = ref.parent?.parent;
    const tenantRef = projectRef?.parent?.parent;
    return {
        projectId: projectRef?.id as string | undefined,
        tenantId: tenantRef?.id as string | undefined,
        projectRef
    };
};

export const findTaskDoc = async (taskId: string, projectId?: string, tenantId?: string) => {
    const preferredTenant = tenantId || getCachedTenantId();
    if (projectId && preferredTenant) {
        const directRef = doc(projectSubCollection(preferredTenant, projectId, TASKS), taskId);
        const snap = await getDoc(directRef);
        if (snap.exists()) return snap;
    }

    if (!preferredTenant) return null;
    const snapshot = await getDocs(query(collectionGroup(db, TASKS), where('tenantId', '==', preferredTenant)));
    return snapshot.docs.find((docSnap) => docSnap.id === taskId) || null;
};

export const findInitiativeDoc = async (initiativeId: string, projectId?: string, tenantId?: string) => {
    const preferredTenant = tenantId || getCachedTenantId();
    if (projectId && preferredTenant) {
        const directRef = doc(projectSubCollection(preferredTenant, projectId, INITIATIVES), initiativeId);
        const snap = await getDoc(directRef);
        if (snap.exists()) return snap;
    }

    if (!preferredTenant) return null;
    const snapshot = await getDocs(query(collectionGroup(db, INITIATIVES), where('tenantId', '==', preferredTenant)));
    return snapshot.docs.find((docSnap) => docSnap.id === initiativeId) || null;
};

export const findIdeaDoc = async (ideaId: string, projectId?: string, tenantId?: string) => {
    const preferredTenant = tenantId || getCachedTenantId();
    if (projectId && preferredTenant) {
        const directRef = doc(projectSubCollection(preferredTenant, projectId, IDEAS), ideaId);
        const snap = await getDoc(directRef);
        if (snap.exists()) return snap;
    }

    return null;
};

export const findSubtaskDoc = async (subTaskId: string, taskId?: string, projectId?: string, tenantId?: string) => {
    if (taskId) {
        const taskSnap = await findTaskDoc(taskId, projectId, tenantId);
        if (taskSnap) {
            const ref = doc(collection(taskSnap.ref, SUBTASKS), subTaskId);
            const snap = await getDoc(ref);
            if (snap.exists()) return snap;
        }
    }

    return null;
};

export const findIssueDoc = async (issueId: string, projectId?: string, tenantId?: string, path?: string) => {
    if (path) {
        const ref = doc(db, path);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap;
    }

    const preferredTenant = tenantId || getCachedTenantId();
    if (projectId && preferredTenant) {
        const ref = doc(projectSubCollection(preferredTenant, projectId, ISSUES), issueId);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap;
    }

    return null;
};

export const logActivity = async (
    projectId: string,
    payload: Omit<Activity, 'id' | 'projectId' | 'createdAt' | 'user' | 'userAvatar' | 'ownerId'> & Partial<Activity>,
    tenantId?: string
) => {
    const user = auth.currentUser;
    if (!user) return;

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    await addDoc(projectSubCollection(resolvedTenant, projectId, ACTIVITIES), {
        projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        user: payload.user || user.displayName || 'User',
        userAvatar: payload.userAvatar || user.photoURL || '',
        action: payload.action,
        target: payload.target || 'Unknown',
        details: payload.details || '',
        relatedId: payload.relatedId || null,
        type: payload.type || 'task',
        createdAt: serverTimestamp()
    });
};

export const ensureCategory = async (projectId: string, name?: string | string[], tenantId?: string, color?: string) => {
    const user = auth.currentUser;
    const names = (Array.isArray(name) ? name : [name || '']).map((entry) => entry.trim()).filter(Boolean);
    if (!names.length) return;

    const resolvedTenant = resolveTenantId(tenantId);
    const categoriesRef = projectSubCollection(resolvedTenant, projectId, CATEGORIES);
    const snapshot = await getDocs(categoriesRef);
    const existing = snapshot.docs.map((docSnap) => (docSnap.data().normalized || docSnap.data().name || '').toLowerCase());

    for (const entry of names) {
        const normalized = entry.toLowerCase();
        if (existing.includes(normalized)) continue;

        await addDoc(categoriesRef, {
            projectId,
            tenantId: resolvedTenant,
            ownerId: user?.uid || '',
            name: entry,
            normalized,
            color: color || '#64748b',
            createdAt: serverTimestamp()
        });
    }
};

export const syncProjectProgress = async (projectId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, TASKS));
    const tasks = snapshot.docs.map((docSnap) => docSnap.data() as Task);

    if (tasks.length === 0) {
        await updateDoc(projectDocRef(resolvedTenant, projectId), { progress: 0 });
        return;
    }

    const completedCount = tasks.filter((task) => task.isCompleted || task.status === 'Done').length;
    const progress = Math.round((completedCount / tasks.length) * 100);

    await updateDoc(projectDocRef(resolvedTenant, projectId), {
        progress,
        updatedAt: serverTimestamp()
    });
};
