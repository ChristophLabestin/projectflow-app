import {
    addDoc,
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    setDoc,
    updateDoc
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
const TENANT_CACHE_KEY = 'activeTenantId';
const ensureTenantAndUserCache = new Map<string, Promise<void>>();

export const getCachedTenantId = () => {
    try {
        if (typeof localStorage === 'undefined') return undefined;
        return localStorage.getItem(TENANT_CACHE_KEY) || undefined;
    } catch {
        return undefined;
    }
};

export const resolveTenantId = (tenantId?: string) => {
    const user = auth.currentUser;
    const resolved = tenantId || getCachedTenantId() || user?.uid;
    if (!resolved) {
        throw new Error('User not authenticated');
    }
    return resolved;
};

const tenantDocRef = (tenantId: string) => doc(db, TENANTS, tenantId);
const userDocRef = (userId: string) => doc(db, USERS, userId);
const tenantMemberDocRef = (tenantId: string, userId: string) => doc(db, TENANTS, tenantId, 'members', userId);

export const projectDocRef = (tenantId: string, projectId: string) => doc(tenantDocRef(tenantId), PROJECTS, projectId);

export const projectSubCollection = (tenantId: string, projectId: string, subCollectionName: string) => (
    collection(db, TENANTS, tenantId, PROJECTS, projectId, subCollectionName)
);

export const ensureTenantAndUser = async (tenantId: string, role?: WorkspaceRole) => {
    const user = auth.currentUser;
    if (!user) return;

    const cacheKey = `${tenantId}:${user.uid}:${role || 'default'}`;
    const cachedEnsure = ensureTenantAndUserCache.get(cacheKey);
    if (cachedEnsure) {
        return cachedEnsure;
    }

    const ensurePromise = (async () => {
        const isOwner = user.uid === tenantId;
        const globalUserRef = userDocRef(user.uid);
        const globalUserSnap = await getDoc(globalUserRef);

        await setDoc(globalUserRef, {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'User',
            photoURL: user.photoURL || '',
            updatedAt: serverTimestamp(),
            ...(!globalUserSnap.exists() ? { createdAt: serverTimestamp() } : {})
        }, { merge: true });

        if (!globalUserSnap.exists() || !globalUserSnap.data()?.aiUsage) {
            await setDoc(globalUserRef, {
                aiUsage: {
                    tokensUsed: 0,
                    tokenLimit: 1000000,
                    imagesUsed: 0,
                    imageLimit: 50,
                    lastReset: serverTimestamp()
                }
            }, { merge: true });
        }

        if (isOwner) {
            await setDoc(
                tenantDocRef(tenantId),
                {
                    tenantId,
                    name: user.displayName || 'Workspace',
                    updatedAt: serverTimestamp()
                },
                { merge: true }
            );
        }

        const tenantSnap = await getDoc(tenantDocRef(tenantId));
        if (!tenantSnap.exists() && !isOwner) {
            console.warn(`ensureTenantAndUser: Tenant ${tenantId} does not exist and user is not owner. Skipping.`);
            return;
        }

        await setDoc(tenantMemberDocRef(tenantId, user.uid), {
            uid: user.uid,
            joinedAt: serverTimestamp(),
            role: role || (isOwner ? 'Owner' : 'Member')
        }, { merge: true });
    })().catch((error) => {
        ensureTenantAndUserCache.delete(cacheKey);
        throw error;
    });

    ensureTenantAndUserCache.set(cacheKey, ensurePromise);
    return ensurePromise;
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

    const snapshot = await getDocs(collectionGroup(db, TASKS));
    return snapshot.docs.find((docSnap) => docSnap.id === taskId) || null;
};

export const findInitiativeDoc = async (initiativeId: string, projectId?: string, tenantId?: string) => {
    const preferredTenant = tenantId || getCachedTenantId();
    if (projectId && preferredTenant) {
        const directRef = doc(projectSubCollection(preferredTenant, projectId, INITIATIVES), initiativeId);
        const snap = await getDoc(directRef);
        if (snap.exists()) return snap;
    }

    const snapshot = await getDocs(collectionGroup(db, INITIATIVES));
    return snapshot.docs.find((docSnap) => docSnap.id === initiativeId) || null;
};

export const findIdeaDoc = async (ideaId: string, projectId?: string, tenantId?: string) => {
    const preferredTenant = tenantId || getCachedTenantId();
    if (projectId && preferredTenant) {
        const directRef = doc(projectSubCollection(preferredTenant, projectId, IDEAS), ideaId);
        const snap = await getDoc(directRef);
        if (snap.exists()) return snap;
    }

    const snapshot = await getDocs(collectionGroup(db, IDEAS));
    return snapshot.docs.find((docSnap) => docSnap.id === ideaId) || null;
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

    const snapshot = await getDocs(collectionGroup(db, SUBTASKS));
    return snapshot.docs.find((docSnap) => docSnap.id === subTaskId) || null;
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

    const snapshot = await getDocs(collectionGroup(db, ISSUES));
    return snapshot.docs.find((docSnap) => docSnap.id === issueId) || null;
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
