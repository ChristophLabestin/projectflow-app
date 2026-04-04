import {
    collection,
    collectionGroup,
    doc,
    documentId,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    where
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { getTenantFileDownloadUrl } from '../fileStorageService';
import { toMillis } from '../../utils/time';
import type { Project, ProjectMember } from '../../types';
import { resolveActiveTenantId } from './authService';

const TENANTS = 'tenants';
const PROJECTS = 'projects';

const projectDocRef = (tenantId: string, projectId: string) => doc(db, TENANTS, tenantId, PROJECTS, projectId);

const resolveProjectDoc = async (projectId: string, tenantId?: string) => {
    const resolvedTenant = resolveActiveTenantId(tenantId);
    if (resolvedTenant) {
        const directSnap = await getDoc(projectDocRef(resolvedTenant, projectId));
        if (directSnap.exists()) {
            return directSnap;
        }
    }

    const snapshot = await getDocs(
        query(collectionGroup(db, PROJECTS), where(documentId(), '==', projectId))
    );

    return snapshot.docs[0] || null;
};

const getTenantIdFromRef = (ref: { path: string }) => {
    const parts = ref.path.split('/');
    const tenantIndex = parts.indexOf(TENANTS);
    return tenantIndex >= 0 ? parts[tenantIndex + 1] : '';
};

const hydrateProjectAssetUrls = async (project: Project): Promise<Project> => {
    const tenantId = project.tenantId || '';
    if (!tenantId) {
        return project;
    }

    const next = { ...project };

    if (project.coverImageFileId) {
        try {
            const signed = await getTenantFileDownloadUrl({ tenantId, fileId: project.coverImageFileId });
            next.coverImage = signed.downloadUrl;
        } catch (error) {
            console.warn('Failed to refresh project cover image URL', error);
        }
    }

    if (project.squareIconFileId) {
        try {
            const signed = await getTenantFileDownloadUrl({ tenantId, fileId: project.squareIconFileId });
            next.squareIcon = signed.downloadUrl;
        } catch (error) {
            console.warn('Failed to refresh project square icon URL', error);
        }
    }

    if (Array.isArray(project.screenshotFileIds) && project.screenshotFileIds.length > 0) {
        const nextScreenshots = await Promise.all(project.screenshotFileIds.map(async (fileId) => {
            try {
                const signed = await getTenantFileDownloadUrl({ tenantId, fileId });
                return signed.downloadUrl;
            } catch (error) {
                console.warn('Failed to refresh project screenshot URL', error);
                return '';
            }
        }));

        next.screenshots = nextScreenshots.filter(Boolean);
    }

    return next;
};

export const getUserProjects = async (tenantId?: string): Promise<Project[]> => {
    const user = auth.currentUser;
    const resolvedTenant = resolveActiveTenantId(tenantId);
    if (!user || !resolvedTenant) return [];

    const snapshot = await getDocs(
        query(collection(db, TENANTS, resolvedTenant, PROJECTS), where('ownerId', '==', user.uid))
    );

    const projects = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, tenantId: resolvedTenant, ...docSnap.data() } as Project))
        .filter((project) => !project.isPersonal)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    return Promise.all(projects.map((project) => hydrateProjectAssetUrls(project)));
};

export const getSharedProjects = async (): Promise<Project[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const snapshot = await getDocs(
        query(collectionGroup(db, PROJECTS), where('memberIds', 'array-contains', user.uid))
    );

    const projects = snapshot.docs
        .map((docSnap) => ({
            id: docSnap.id,
            tenantId: getTenantIdFromRef(docSnap.ref),
            ...docSnap.data()
        } as Project))
        .filter((project) => project.ownerId !== user.uid)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    return Promise.all(projects.map((project) => hydrateProjectAssetUrls(project)));
};

export const getProjectMembers = async (projectId: string, tenantId?: string): Promise<string[]> => {
    const projectDoc = await resolveProjectDoc(projectId, tenantId);
    if (!projectDoc?.exists()) {
        return [];
    }

    const project = projectDoc.data() as Project;
    if (!project.members) {
        return [];
    }

    return project.members
        .filter((member: any) => member !== null && member !== undefined)
        .map((member: string | ProjectMember) => typeof member === 'string' ? member : member.userId);
};

export const getProjectById = async (projectId: string, tenantId?: string): Promise<Project | null> => {
    const projectDoc = await resolveProjectDoc(projectId, tenantId);
    if (!projectDoc?.exists()) {
        return null;
    }

    return hydrateProjectAssetUrls({
        id: projectDoc.id,
        tenantId: getTenantIdFromRef(projectDoc.ref),
        ...projectDoc.data()
    } as Project);
};

export const subscribeTenantProjects = (
    callback: (projects: Project[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveActiveTenantId(tenantId);
    if (!resolvedTenant) {
        callback([]);
        return () => undefined;
    }

    return onSnapshot(collection(db, TENANTS, resolvedTenant, PROJECTS), (snapshot) => {
        void Promise.all(snapshot.docs.map(async (docSnap) => (
            hydrateProjectAssetUrls({
                id: docSnap.id,
                tenantId: resolvedTenant,
                ...docSnap.data()
            } as Project)
        ))).then((projects) => callback(projects))
            .catch((error) => {
                console.error('Failed to hydrate tenant project asset URLs', error);
                callback(snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    tenantId: resolvedTenant,
                    ...docSnap.data()
                } as Project)));
            });
    });
};

export const subscribeProject = (
    projectId: string,
    callback: (project: Project | null) => void,
    tenantId?: string
) => {
    if (tenantId) {
        return onSnapshot(projectDocRef(tenantId, projectId), (snapshot) => {
            if (snapshot.exists()) {
                void hydrateProjectAssetUrls({ id: snapshot.id, tenantId, ...snapshot.data() } as Project)
                    .then((project) => callback(project))
                    .catch((error) => {
                        console.error('Failed to hydrate project asset URLs', error);
                        callback({ id: snapshot.id, tenantId, ...snapshot.data() } as Project);
                    });
            } else {
                callback(null);
            }
        });
    }

    let unsubscribe = () => undefined;
    let isCancelled = false;

    void getProjectById(projectId, tenantId)
        .then((project) => {
            if (isCancelled) {
                return;
            }

            if (!project?.tenantId) {
                callback(null);
                return;
            }

            unsubscribe = onSnapshot(projectDocRef(project.tenantId, projectId), (snapshot) => {
                if (snapshot.exists()) {
                    void hydrateProjectAssetUrls({ id: snapshot.id, tenantId: project.tenantId, ...snapshot.data() } as Project)
                        .then((hydrated) => callback(hydrated))
                        .catch((error) => {
                            console.error('Failed to hydrate project asset URLs', error);
                            callback({ id: snapshot.id, tenantId: project.tenantId, ...snapshot.data() } as Project);
                        });
                } else {
                    callback(null);
                }
            });
        })
        .catch((error) => {
            console.error('Failed to subscribe to project', error);
            callback(null);
        });

    return () => {
        isCancelled = true;
        unsubscribe();
    };
};
