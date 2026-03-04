import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';

import { db } from '../firebase';
import type { WorkspaceGroup } from '../../types';
import { getActiveTenantId } from './authService';

const groupCollection = (tenantId: string) => collection(db, 'tenants', tenantId, 'groups');
const groupDocRef = (tenantId: string, groupId: string) => doc(db, 'tenants', tenantId, 'groups', groupId);
const tenantMemberDocRef = (tenantId: string, userId: string) => doc(db, 'tenants', tenantId, 'members', userId);
const tenantUserDocRef = (tenantId: string, userId: string) => doc(db, 'tenants', tenantId, 'users', userId);

const resolveTenantId = (tenantId?: string) => {
    const resolvedTenant = tenantId || getActiveTenantId();
    if (!resolvedTenant) {
        throw new Error('Tenant not available');
    }
    return resolvedTenant;
};

export const subscribeWorkspaceGroups = (
    callback: (groups: WorkspaceGroup[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    return onSnapshot(groupCollection(resolvedTenant), (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        } as WorkspaceGroup));
        callback(items);
    });
};

export const getWorkspaceGroups = async (tenantId?: string): Promise<WorkspaceGroup[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snapshot = await getDocs(groupCollection(resolvedTenant));
    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
    } as WorkspaceGroup));
};

export const createWorkspaceGroup = async (
    name: string,
    color?: string,
    description?: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await addDoc(groupCollection(resolvedTenant), {
        tenantId: resolvedTenant,
        name,
        color: color || '#3b82f6',
        description: description || '',
        memberIds: [],
        createdAt: serverTimestamp()
    });
};

export const updateWorkspaceGroup = async (
    groupId: string,
    data: Partial<WorkspaceGroup>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await updateDoc(groupDocRef(resolvedTenant, groupId), data);
};

export const deleteWorkspaceGroup = async (
    groupId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(groupDocRef(resolvedTenant, groupId));
};

export const addUserToGroup = async (
    userId: string,
    groupId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);

    await updateDoc(groupDocRef(resolvedTenant, groupId), {
        memberIds: arrayUnion(userId)
    });

    const [memberSnap, tenantUserSnap] = await Promise.all([
        getDoc(tenantMemberDocRef(resolvedTenant, userId)),
        getDoc(tenantUserDocRef(resolvedTenant, userId))
    ]);

    if (memberSnap.exists()) {
        await updateDoc(tenantMemberDocRef(resolvedTenant, userId), {
            groupIds: arrayUnion(groupId)
        });
    }

    if (tenantUserSnap.exists()) {
        await updateDoc(tenantUserDocRef(resolvedTenant, userId), {
            groupIds: arrayUnion(groupId)
        });
    }
};

export const removeUserFromGroup = async (
    userId: string,
    groupId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);

    await updateDoc(groupDocRef(resolvedTenant, groupId), {
        memberIds: arrayRemove(userId)
    });

    const [memberSnap, tenantUserSnap] = await Promise.all([
        getDoc(tenantMemberDocRef(resolvedTenant, userId)),
        getDoc(tenantUserDocRef(resolvedTenant, userId))
    ]);

    if (memberSnap.exists()) {
        await updateDoc(tenantMemberDocRef(resolvedTenant, userId), {
            groupIds: arrayRemove(groupId)
        });
    }

    if (tenantUserSnap.exists()) {
        await updateDoc(tenantUserDocRef(resolvedTenant, userId), {
            groupIds: arrayRemove(groupId)
        });
    }
};
