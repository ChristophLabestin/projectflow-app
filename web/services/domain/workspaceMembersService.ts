import { arrayRemove, collection, deleteDoc, deleteField, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';

import { db } from '../firebase';
import { getActiveTenantId } from './authService';
import type { Member, WorkspaceRole } from '../../types';

const tenantMembersCollection = (tenantId: string) => collection(db, 'tenants', tenantId, 'members');
const tenantMemberDocRef = (tenantId: string, userId: string) => doc(db, 'tenants', tenantId, 'members', userId);
const groupDocRef = (tenantId: string, groupId: string) => doc(db, 'tenants', tenantId, 'groups', groupId);
const userDocRef = (userId: string) => doc(db, 'users', userId);

export const getUserTenantMembership = async (userId: string, tenantId: string) => {
    const snap = await getDoc(tenantMemberDocRef(tenantId, userId));
    return snap.exists() ? snap.data() : null;
};

export const getWorkspaceMembers = async (tenantId?: string): Promise<Member[]> => {
    const resolvedTenant = tenantId || getActiveTenantId();
    if (!resolvedTenant) {
        return [];
    }

    const memberRefs = await getDocs(tenantMembersCollection(resolvedTenant));

    const members = await Promise.all(
        memberRefs.docs.map(async (memberDoc) => {
            const membership = memberDoc.data();
            const userSnap = await getDoc(userDocRef(memberDoc.id));
            const userData = userSnap.exists() ? userSnap.data() : {};
            return {
                ...userData,
                uid: memberDoc.id,
                role: membership.role,
                roleIds: membership.roleIds || [],
                joinedAt: membership.joinedAt,
                groupIds: membership.groupIds,
                pinnedProjectId: membership.pinnedProjectId,
            } as Member;
        })
    );

    return members;
};

export const updateUserMembership = async (
    userId: string,
    tenantId: string,
    data: Partial<any>
) => {
    await setDoc(tenantMemberDocRef(tenantId, userId), data, { merge: true });
};

export const subscribeTenantUsers = (
    callback: (users: {
        id: string;
        email?: string;
        displayName?: string;
        photoURL?: string;
        joinedAt?: any;
        role?: WorkspaceRole;
        roleIds?: string[];
        groupIds?: string[];
        title?: string;
        bio?: string;
        address?: string;
        skills?: string[];
        coverURL?: string;
        privacySettings?: any;
    }[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = tenantId || getActiveTenantId();
    if (!resolvedTenant) {
        callback([]);
        return () => undefined;
    }

    return onSnapshot(tenantMembersCollection(resolvedTenant), async (snap) => {
        const userPromises = snap.docs.map(async (memberDoc) => {
            const membership = memberDoc.data();
            const userSnap = await getDoc(userDocRef(memberDoc.id));
            const userData = userSnap.exists() ? userSnap.data() : {};
            return {
                id: memberDoc.id,
                ...userData,
                joinedAt: membership.joinedAt,
                role: membership.role,
                roleIds: membership.roleIds || [],
                groupIds: membership.groupIds,
            };
        });

        const items = await Promise.all(userPromises);
        callback(items);
    });
};

export const subscribeWorkspaceMembers = (
    callback: (members: { uid: string; displayName: string; photoURL?: string; email?: string; role?: string }[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = tenantId || getActiveTenantId();
    if (!resolvedTenant) {
        callback([]);
        return () => undefined;
    }

    return onSnapshot(tenantMembersCollection(resolvedTenant), async (snap) => {
        const memberPromises = snap.docs.map(async (memberDoc) => {
            const membership = memberDoc.data();
            const userSnap = await getDoc(userDocRef(memberDoc.id));
            const userData = userSnap.exists() ? userSnap.data() : {};
            return {
                uid: memberDoc.id,
                displayName: userData.displayName || 'Unknown User',
                photoURL: userData.photoURL,
                email: userData.email,
                role: membership.role
            };
        });

        const members = await Promise.all(memberPromises);
        callback(members);
    });
};

export const updateUserRole = async (
    targetUserId: string,
    newRole: WorkspaceRole,
    tenantId?: string
) => {
    const resolvedTenant = tenantId || getActiveTenantId();
    if (!resolvedTenant) {
        throw new Error('Tenant not available');
    }

    await updateDoc(tenantMemberDocRef(resolvedTenant, targetUserId), { role: newRole });
};

/**
 * Assign the set of custom role IDs to a workspace member (Discord-style role
 * stacking). System roles (Owner/Member/Guest) are NOT stored here — Member is
 * implicit and Owner is derived from tenant ownership. Only custom role doc IDs
 * belong in `roleIds`.
 */
export const setMemberRoleIds = async (
    targetUserId: string,
    roleIds: string[],
    tenantId?: string
) => {
    const resolvedTenant = tenantId || getActiveTenantId();
    if (!resolvedTenant) {
        throw new Error('Tenant not available');
    }
    await updateDoc(tenantMemberDocRef(resolvedTenant, targetUserId), { roleIds });
};

export const removeUserFromWorkspace = async (userId: string, tenantId?: string) => {
    const resolvedTenant = tenantId || getActiveTenantId();
    if (!resolvedTenant) {
        throw new Error('Tenant not available');
    }

    const memberRef = tenantMemberDocRef(resolvedTenant, userId);
    const memberSnap = await getDoc(memberRef);
    const groupIds: string[] = (memberSnap.exists() ? memberSnap.data().groupIds : []) || [];

    await Promise.all(groupIds.map(async (groupId) => {
        try {
            await updateDoc(groupDocRef(resolvedTenant, groupId), {
                memberIds: arrayRemove(userId)
            });
        } catch (error) {
            console.warn('Failed to remove user from workspace group', error);
        }
    }));

    // Revoke project-level access too (guests are scoped via project memberIds).
    const projectSnaps = await getDocs(query(
        collection(db, 'tenants', resolvedTenant, 'projects'),
        where('memberIds', 'array-contains', userId)
    ));
    await Promise.all(projectSnaps.docs.map((projectSnap) => updateDoc(projectSnap.ref, {
        memberIds: arrayRemove(userId),
        [`roles.${userId}`]: deleteField()
    }).catch((error) => console.warn('Failed to remove user from project', error))));

    await deleteDoc(memberRef);
};
