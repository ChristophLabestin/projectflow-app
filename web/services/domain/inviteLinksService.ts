import {
    addDoc,
    arrayUnion,
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    increment,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import type { ProjectMember, ProjectRole, WorkspaceRole } from '../../types';
import { getActiveTenantId } from './authService';
import { joinTenant } from '../dataService';
import { logActivity } from '../internal/workspaceDataCore';

const resolveTenantId = (tenantId?: string) => tenantId || getActiveTenantId() || auth.currentUser?.uid;

const validateProjectInviteLink = async (
    inviteLinkId: string,
    projectId: string,
    tenantId: string
): Promise<ProjectRole> => {
    const inviteLinkRef = doc(db, `tenants/${tenantId}/projects/${projectId}/inviteLinks`, inviteLinkId);
    const inviteLinkDoc = await getDoc(inviteLinkRef);

    if (!inviteLinkDoc.exists()) {
        throw new Error('Invalid invite link');
    }

    const linkData = inviteLinkDoc.data();
    if (!linkData.isActive) {
        throw new Error('This invite link has been disabled');
    }

    const expiresAt = linkData.expiresAt?.toDate?.() || new Date(linkData.expiresAt);
    if (expiresAt < new Date()) {
        throw new Error('This invite link has expired');
    }

    if (linkData.maxUses && linkData.uses >= linkData.maxUses) {
        throw new Error('This invite link has reached its maximum number of uses');
    }

    return linkData.role as ProjectRole;
};

const validateWorkspaceInviteLink = async (
    inviteLinkId: string,
    tenantId: string
): Promise<WorkspaceRole> => {
    const inviteLinkRef = doc(db, `tenants/${tenantId}/inviteLinks`, inviteLinkId);
    const inviteLinkDoc = await getDoc(inviteLinkRef);

    if (!inviteLinkDoc.exists()) {
        throw new Error('Invalid invite link');
    }

    const linkData = inviteLinkDoc.data();
    if (!linkData.isActive) {
        throw new Error('This invite link has been disabled');
    }

    const expiresAt = linkData.expiresAt?.toDate?.() || new Date(linkData.expiresAt);
    if (expiresAt < new Date()) {
        throw new Error('This invite link has expired');
    }

    if (linkData.maxUses && linkData.uses >= linkData.maxUses) {
        throw new Error('This invite link has reached its maximum number of uses');
    }

    return (linkData.role || 'Member') as WorkspaceRole;
};

export const joinProjectViaLink = async (
    inviteLinkId: string,
    projectId: string,
    tenantId: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    const role = await validateProjectInviteLink(inviteLinkId, projectId, tenantId);
    const projectRef = doc(db, `tenants/${tenantId}/projects`, projectId);
    const projectDoc = await getDoc(projectRef);

    if (!projectDoc.exists()) {
        throw new Error('Project not found');
    }

    const data = projectDoc.data();
    const members = data.members || [];
    const isMember = typeof members[0] === 'string'
        ? members.includes(user.uid)
        : (members as ProjectMember[]).some((member: any) => member.userId === user.uid);

    if (isMember) {
        throw new Error('You are already a member of this project');
    }

    const newMember: ProjectMember = {
        userId: user.uid,
        role,
        joinedAt: new Date(),
        invitedBy: 'link'
    };

    await updateDoc(projectRef, {
        members: [...members, newMember],
        memberIds: arrayUnion(user.uid)
    });

    await setDoc(doc(db, `tenants/${tenantId}/users`, user.uid), {
        uid: user.uid,
        displayName: user.displayName || 'User',
        email: user.email,
        photoURL: user.photoURL,
        joinedAt: serverTimestamp(),
        lastActive: serverTimestamp()
    }, { merge: true });

    const inviteLinkRef = doc(db, `tenants/${tenantId}/projects/${projectId}/inviteLinks`, inviteLinkId);
    await updateDoc(inviteLinkRef, {
        uses: increment(1)
    });

    await logActivity(
        projectId,
        {
            action: `${user.displayName || 'User'} joined the project`,
            target: 'Team',
            type: 'status',
            user: user.displayName || 'User'
        },
        tenantId
    );
};

export const generateWorkspaceInviteLink = async (
    role: WorkspaceRole = 'Member',
    maxUses?: number,
    expiresInHours = 24,
    tenantId?: string
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    const resolvedTenant = resolveTenantId(tenantId);
    if (!resolvedTenant) {
        throw new Error('Tenant not available');
    }

    const inviteLink = {
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
        maxUses: maxUses || null,
        uses: 0,
        role,
        isActive: true
    };

    const docRef = await addDoc(collection(db, `tenants/${resolvedTenant}/inviteLinks`), inviteLink);
    const base = window.location.origin;
    return `${base}/join-workspace/${docRef.id}?tenantId=${resolvedTenant}`;
};

export const joinWorkspaceViaLink = async (
    inviteLinkId: string,
    tenantId: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    const role = await validateWorkspaceInviteLink(inviteLinkId, tenantId);
    await joinTenant(tenantId, role);

    const inviteLinkRef = doc(db, `tenants/${tenantId}/inviteLinks`, inviteLinkId);
    await updateDoc(inviteLinkRef, {
        uses: increment(1)
    });
};

export const getWorkspaceInviteLinks = async (tenantId?: string): Promise<any[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    if (!resolvedTenant) {
        return [];
    }

    const snapshot = await getDocs(
        query(collection(db, `tenants/${resolvedTenant}/inviteLinks`), where('isActive', '==', true))
    );

    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const getProjectInviteLinks = async (projectId: string, tenantId?: string): Promise<any[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    if (!resolvedTenant) {
        return [];
    }

    const snapshot = await getDocs(
        query(collection(db, `tenants/${resolvedTenant}/projects/${projectId}/inviteLinks`), where('isActive', '==', true))
    );

    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const getTenantProjectInviteLinks = async (tenantId?: string): Promise<any[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    if (!resolvedTenant) {
        return [];
    }

    const snapshot = await getDocs(
        query(collectionGroup(db, 'inviteLinks'), where('isActive', '==', true))
    );

    return snapshot.docs
        .filter((docSnap) => {
            const parts = docSnap.ref.path.split('/');
            return parts[0] === 'tenants'
                && parts[1] === resolvedTenant
                && parts[2] === 'projects'
                && parts[4] === 'inviteLinks';
        })
        .map((docSnap) => {
            const parts = docSnap.ref.path.split('/');
            return {
                id: docSnap.id,
                projectId: parts[3],
                ...docSnap.data()
            };
        });
};

export const revokeWorkspaceInviteLink = async (inviteLinkId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    if (!resolvedTenant) {
        throw new Error('Tenant not available');
    }

    await updateDoc(doc(db, `tenants/${resolvedTenant}/inviteLinks`, inviteLinkId), {
        isActive: false
    });
};

export const revokeProjectInviteLink = async (
    projectId: string,
    inviteLinkId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    if (!resolvedTenant) {
        throw new Error('Tenant not available');
    }

    await updateDoc(doc(db, `tenants/${resolvedTenant}/projects/${projectId}/inviteLinks`, inviteLinkId), {
        isActive: false
    });
};
