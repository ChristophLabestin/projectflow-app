import {
    addDoc,
    collection,
    deleteDoc,
    deleteField,
    getDoc,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { auth, db, functions } from '../firebase';
import { ensureTenantAndUser, logActivity, projectDocRef, resolveTenantId } from '../internal/workspaceDataCore';
import { uploadTenantFile } from '../fileStorageService';
import type { Activity, Project, ProjectRole } from '../../types';

const TENANTS = 'tenants';
const PROJECTS = 'projects';

const projectsCollection = (tenantId: string) => collection(db, TENANTS, tenantId, PROJECTS);

export const createProject = async (
    projectData: Partial<Project>,
    coverFile?: File | string,
    squareIconFile?: File | string,
    screenshotFiles?: (File | string)[],
    initialMemberIds: string[] = [],
    tenantId?: string,
    visibilityGroupIds?: string[]
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const memberIds = Array.from(new Set([user.uid, ...initialMemberIds]));
    const docRef = await addDoc(projectsCollection(resolvedTenant), {
        ...projectData,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        coverImage: '',
        squareIcon: '',
        screenshots: [],
        progress: 0,
        members: memberIds,
        memberIds,
        visibilityGroupIds: visibilityGroupIds || [],
        visibilityGroupId: visibilityGroupIds?.[0] || null,
        createdAt: serverTimestamp()
    });

    const projectId = docRef.id;
    let coverImageUrl = typeof coverFile === 'string' ? coverFile : '';
    let squareIconUrl = typeof squareIconFile === 'string' ? squareIconFile : '';
    let coverImageFileId = '';
    let squareIconFileId = '';
    const screenshotUrls: string[] = [];
    const screenshotFileIds: string[] = [];

    try {
        if (coverFile && typeof coverFile !== 'string') {
            const uploaded = await uploadTenantFile({
                tenantId: resolvedTenant,
                module: 'project',
                entityType: 'cover',
                entityId: projectId,
                projectId,
                file: coverFile,
            });
            coverImageUrl = uploaded.downloadUrl;
            coverImageFileId = uploaded.id;
        }
    } catch (error) {
        console.warn('Cover upload failed', error);
    }

    try {
        if (squareIconFile && typeof squareIconFile !== 'string') {
            const uploaded = await uploadTenantFile({
                tenantId: resolvedTenant,
                module: 'project',
                entityType: 'icon',
                entityId: projectId,
                projectId,
                file: squareIconFile,
            });
            squareIconUrl = uploaded.downloadUrl;
            squareIconFileId = uploaded.id;
        }
    } catch (error) {
        console.warn('Icon upload failed', error);
    }

    if (screenshotFiles?.length) {
        for (const file of screenshotFiles) {
            if (typeof file === 'string') {
                screenshotUrls.push(file);
                continue;
            }

            try {
                const uploaded = await uploadTenantFile({
                    tenantId: resolvedTenant,
                    module: 'project',
                    entityType: 'screenshot',
                    entityId: projectId,
                    projectId,
                    file,
                });
                screenshotUrls.push(uploaded.downloadUrl);
                screenshotFileIds.push(uploaded.id);
            } catch (error) {
                console.warn('Screenshot upload failed', file?.name, error);
            }
        }
    }

    await updateDoc(docRef, {
        coverImage: coverImageUrl || deleteField(),
        squareIcon: squareIconUrl || deleteField(),
        screenshots: screenshotUrls,
        coverImageFileId: coverImageFileId || deleteField(),
        squareIconFileId: squareIconFileId || deleteField(),
        screenshotFileIds: screenshotFileIds.length > 0 ? screenshotFileIds : deleteField(),
    });

    await logActivity(
        projectId,
        { action: `Created project "${projectData.title || 'Project'}"`, target: 'Project', type: 'status' },
        resolvedTenant
    );

    return projectId;
};

export const updateProjectFields = async (
    projectId: string,
    updates: Partial<Project>,
    activityMessage?: { action: string; target?: string; type?: Activity['type'] },
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const sanitizedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, any>);

    await updateDoc(projectDocRef(resolvedTenant, projectId), sanitizedUpdates);

    if (activityMessage?.action) {
        await logActivity(
            projectId,
            {
                action: activityMessage.action,
                target: activityMessage.target || 'Project',
                type: activityMessage.type || 'status'
            },
            resolvedTenant
        );
    }
};

export const deleteProjectById = async (projectId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(projectDocRef(resolvedTenant, projectId));
};

export const generateInviteLink = async (
    projectId: string,
    role: ProjectRole | string,
    maxUses?: number,
    expiresInHours = 24,
    tenantId?: string
): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    const projectSnap = await getDoc(projectDocRef(resolvedTenant, projectId));
    if (!projectSnap.exists()) throw new Error('Project not found');

    const project = projectSnap.data() as Project;
    if (project.ownerId !== user.uid) {
        throw new Error('Only the project owner can create invite links');
    }

    const inviteLinksRef = collection(db, `tenants/${resolvedTenant}/projects/${projectId}/inviteLinks`);
    const docRef = await addDoc(inviteLinksRef, {
        projectId,
        role,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
        maxUses: maxUses || null,
        uses: 0,
        isActive: true
    });

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/join/${docRef.id}?projectId=${projectId}&tenantId=${resolvedTenant}`;
};

export const sendTeamInvitation = async (
    email: string,
    type: 'workspace' | 'project',
    targetId: string,
    role: string,
    tenantId: string
): Promise<void> => {
    const sendInvite = httpsCallable(functions, 'sendInvitation');
    await sendInvite({
        email,
        type,
        targetId,
        role,
        tenantId
    });
};
