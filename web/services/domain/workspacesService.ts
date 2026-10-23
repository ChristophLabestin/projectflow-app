import {
    collection,
    collectionGroup,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { readLastTenantId, writeLastTenantId, writeOnboarding } from './userPrivateData';
import { httpsCallable } from 'firebase/functions';

import { auth, db, functions } from '../firebase';
import { assertPlanAllows } from '../billingService';
import {
    clearCachedTenantId,
    ensureTenantAndUser,
    getCachedTenantId,
    setCachedTenantId,
    setCachedWorkspaceRole
} from '../internal/workspaceDataCore';
import type { WorkspaceRole } from '../../types';

/*
 * Workspace (tenant) model
 * ------------------------
 * tenants/{tenantId}                     { name, ownerId, createdAt, createdBy }
 * tenants/{tenantId}/members/{uid}       { uid, role, roleIds, joinedAt, invitedBy?, inviteId?, displayName, email, photoURL }
 * tenants/{tenantId}/invitations/{id}    { kind, email?, role, projectIds, status, invitedBy, ... }
 *
 * Tenant ids are random. Access is decided only by the members doc; a user can
 * belong to any number of workspaces and switches between them.
 */

export type InvitableRole = 'Admin' | 'Member' | 'Guest';
export type InvitationKind = 'email' | 'link';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export interface WorkspaceSummary {
    id: string;
    name: string;
    ownerId?: string;
    role: WorkspaceRole;
}

export interface WorkspaceInvitation {
    id: string;
    tenantId: string;
    tenantName: string;
    kind: InvitationKind;
    email: string | null;
    role: InvitableRole;
    projectIds: string[];
    status: InvitationStatus;
    invitedBy: string;
    invitedByName: string;
    createdAt?: any;
    expiresAt?: string | null;
    maxUses?: number | null;
    uses?: number;
}

const TENANTS = 'tenants';
const tenantRef = (tenantId: string) => doc(db, TENANTS, tenantId);
const memberRef = (tenantId: string, uid: string) => doc(db, TENANTS, tenantId, 'members', uid);
const invitationsCol = (tenantId: string) => collection(db, TENANTS, tenantId, 'invitations');

const requireUser = () => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return user;
};

const memberProfile = (user: NonNullable<typeof auth.currentUser>) => ({
    displayName: user.displayName || (user.email || '').split('@')[0] || 'User',
    email: (user.email || '').toLowerCase(),
    photoURL: user.photoURL || ''
});

export const listMyWorkspaces = async (): Promise<WorkspaceSummary[]> => {
    const user = requireUser();
    const memberships = await getDocs(query(collectionGroup(db, 'members'), where('uid', '==', user.uid)));
    const results = await Promise.all(memberships.docs.map(async (memberDoc) => {
        const tenantDoc = memberDoc.ref.parent.parent;
        if (!tenantDoc || tenantDoc.parent.id !== TENANTS) return null;
        try {
            const snap = await getDoc(tenantDoc);
            if (!snap.exists()) return null;
            const data = snap.data();
            return {
                id: tenantDoc.id,
                name: data.name || 'Workspace',
                ownerId: data.ownerId,
                role: (memberDoc.data().role || 'Member') as WorkspaceRole
            } as WorkspaceSummary;
        } catch {
            return null;
        }
    }));
    return results
        .filter((workspace): workspace is WorkspaceSummary => workspace !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const createWorkspace = async (name: string): Promise<string> => {
    const user = requireUser();
    await ensureTenantAndUser();
    const newTenant = doc(collection(db, TENANTS));
    const batch = writeBatch(db);
    batch.set(newTenant, {
        tenantId: newTenant.id,
        name: name.trim() || 'Workspace',
        ownerId: user.uid,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    batch.set(memberRef(newTenant.id, user.uid), {
        uid: user.uid,
        role: 'Owner',
        roleIds: [],
        joinedAt: serverTimestamp(),
        ...memberProfile(user)
    });
    await batch.commit();
    return newTenant.id;
};

export const renameWorkspace = async (tenantId: string, name: string) => {
    await updateDoc(tenantRef(tenantId), { name: name.trim(), updatedAt: serverTimestamp() });
};

const rememberWorkspace = async (tenantId: string) => {
    setCachedTenantId(tenantId);
    const user = auth.currentUser;
    if (user) {
        await writeLastTenantId(user.uid, tenantId).catch(() => undefined);
    }
};

/**
 * Resolves the workspace to open after sign-in: the last used one if the user
 * is still a member, otherwise their own workspace. Every account owns at
 * least one workspace; it is created on first sign-in.
 */
export const resolveWorkspaceForCurrentUser = async (defaultWorkspaceName: string) => {
    const user = requireUser();
    await ensureTenantAndUser();

    let workspaces = await listMyWorkspaces();
    if (!workspaces.some((workspace) => workspace.role === 'Owner')) {
        await createWorkspace(defaultWorkspaceName);
        // First sign-in: show the welcome step and the getting-started checklist.
        await writeOnboarding(user.uid, { welcomePending: true, checklistDismissed: false }).catch(() => undefined);
        workspaces = await listMyWorkspaces();
    }

    const ids = new Set(workspaces.map((workspace) => workspace.id));
    let lastTenantId: string | undefined;
    try {
        lastTenantId = await readLastTenantId(user.uid);
    } catch {
        lastTenantId = undefined;
    }
    const cached = getCachedTenantId();
    // Deep links (?tenant=<id>) switch to that workspace when the user is a member of it.
    let linkedTenantId: string | undefined;
    try {
        const fromUrl = new URLSearchParams(window.location.search).get('tenant');
        linkedTenantId = fromUrl && ids.has(fromUrl) ? fromUrl : undefined;
    } catch {
        linkedTenantId = undefined;
    }
    const activeId = [linkedTenantId, cached, lastTenantId].find((id): id is string => Boolean(id && ids.has(id)))
        || workspaces.find((workspace) => workspace.role === 'Owner')?.id
        || workspaces[0]?.id;

    if (!activeId) {
        clearCachedTenantId();
        throw new Error('No workspace available');
    }
    if (activeId !== cached || activeId !== lastTenantId) {
        await rememberWorkspace(activeId);
    }
    setCachedWorkspaceRole(workspaces.find((workspace) => workspace.id === activeId)?.role || null);
    return { activeId, workspaces };
};

/** Switches workspace and reloads so every screen starts from a clean state. */
export const switchWorkspace = async (tenantId: string, redirectTo = '/') => {
    await rememberWorkspace(tenantId);
    window.location.assign(redirectTo);
};

export const leaveWorkspace = async (tenantId: string) => {
    const user = requireUser();
    await deleteDoc(memberRef(tenantId, user.uid));
    if (getCachedTenantId() === tenantId) clearCachedTenantId();
};

// ---- Invitations ------------------------------------------------------------

const INVITE_TTL_DAYS = 14;

export const buildInviteUrl = (tenantId: string, inviteId: string) => (
    `${window.location.origin}/invite/${tenantId}/${inviteId}`
);

export const createInvitation = async (input: {
    tenantId: string;
    tenantName: string;
    kind: InvitationKind;
    email?: string;
    role: InvitableRole;
    projectIds?: string[];
    maxUses?: number | null;
}): Promise<WorkspaceInvitation> => {
    const user = requireUser();
    await assertPlanAllows(input.tenantId, 'invite');
    const ref = doc(invitationsCol(input.tenantId));
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400000).toISOString();
    const invitation = {
        tenantId: input.tenantId,
        tenantName: input.tenantName,
        kind: input.kind,
        email: input.kind === 'email' ? (input.email || '').trim().toLowerCase() : null,
        role: input.role,
        projectIds: input.projectIds || [],
        status: 'pending' as const,
        invitedBy: user.uid,
        invitedByName: user.displayName || user.email || '',
        createdAt: serverTimestamp(),
        expiresAt,
        maxUses: input.kind === 'link' ? (input.maxUses ?? null) : 1,
        uses: 0
    };
    await setDoc(ref, invitation);

    if (input.kind === 'email') {
        // Email delivery is best-effort; the invite link works regardless.
        try {
            await httpsCallable(functions, 'sendInvitation')({
                tenantId: input.tenantId,
                inviteId: ref.id,
                origin: window.location.origin,
                language: document.documentElement.lang || undefined
            });
        } catch (error) {
            console.warn('Invitation email could not be sent', error);
        }
    }
    return { id: ref.id, ...invitation } as WorkspaceInvitation;
};

export const listInvitations = async (tenantId: string): Promise<WorkspaceInvitation[]> => {
    const snap = await getDocs(query(invitationsCol(tenantId), where('status', '==', 'pending')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkspaceInvitation));
};

export const revokeInvitation = async (tenantId: string, inviteId: string) => {
    await updateDoc(doc(invitationsCol(tenantId), inviteId), {
        status: 'revoked',
        revokedAt: new Date().toISOString(),
        revokedBy: auth.currentUser?.uid || ''
    });
};

export const getInvitation = async (tenantId: string, inviteId: string): Promise<WorkspaceInvitation | null> => {
    const snap = await getDoc(doc(invitationsCol(tenantId), inviteId));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as WorkspaceInvitation) : null;
};

export const isInvitationUsable = (invitation: WorkspaceInvitation | null) => {
    if (!invitation || invitation.status !== 'pending') return false;
    if (invitation.expiresAt && Date.parse(invitation.expiresAt) < Date.now()) return false;
    if (invitation.maxUses && (invitation.uses || 0) >= invitation.maxUses) return false;
    return true;
};

/** Pending invitations addressed to the signed-in user's verified email. */
export const listMyPendingInvitations = async (): Promise<WorkspaceInvitation[]> => {
    const user = auth.currentUser;
    if (!user?.email || !user.emailVerified) return [];
    try {
        const snap = await getDocs(query(
            collectionGroup(db, 'invitations'),
            where('email', '==', user.email.toLowerCase()),
            where('status', '==', 'pending')
        ));
        return snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as WorkspaceInvitation))
            .filter(isInvitationUsable);
    } catch (error) {
        console.warn('Could not load pending invitations', error);
        return [];
    }
};

export const acceptInvitation = async (tenantId: string, inviteId: string) => {
    await ensureTenantAndUser();
    const result = await httpsCallable<{ tenantId: string; inviteId: string }, { tenantId: string; role: WorkspaceRole }>(
        functions,
        'acceptWorkspaceInvite'
    )({ tenantId, inviteId });
    await rememberWorkspace(result.data.tenantId);
    return result.data;
};

// ---- Workspace lifecycle (owner actions, run server-side) --------------------

/** Make another member the owner; the current owner stays on as Admin. */
export const transferWorkspaceOwnership = async (tenantId: string, newOwnerId: string) => {
    await httpsCallable(functions, 'transferWorkspaceOwnership')({ tenantId, newOwnerId });
};

/** Permanently delete the workspace and everything in it. `confirmName` must equal its name. */
export const deleteWorkspace = async (tenantId: string, confirmName: string) => {
    await httpsCallable(functions, 'deleteWorkspace')({ tenantId, confirmName });
    if (getCachedTenantId() === tenantId) clearCachedTenantId();
};
