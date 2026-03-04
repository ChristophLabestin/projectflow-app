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

export const getUserProjects = async (tenantId?: string): Promise<Project[]> => {
    const user = auth.currentUser;
    const resolvedTenant = resolveActiveTenantId(tenantId);
    if (!user || !resolvedTenant) return [];

    const snapshot = await getDocs(
        query(collection(db, TENANTS, resolvedTenant, PROJECTS), where('ownerId', '==', user.uid))
    );

    return snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Project))
        .filter((project) => !project.isPersonal)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const getSharedProjects = async (): Promise<Project[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const snapshot = await getDocs(
        query(collectionGroup(db, PROJECTS), where('memberIds', 'array-contains', user.uid))
    );

    return snapshot.docs
        .map((docSnap) => ({
            id: docSnap.id,
            tenantId: getTenantIdFromRef(docSnap.ref),
            ...docSnap.data()
        } as Project))
        .filter((project) => project.ownerId !== user.uid)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
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

    return {
        id: projectDoc.id,
        tenantId: getTenantIdFromRef(projectDoc.ref),
        ...projectDoc.data()
    } as Project;
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
        const projects = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            tenantId: resolvedTenant,
            ...docSnap.data()
        } as Project));
        callback(projects);
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
                callback({ id: snapshot.id, tenantId, ...snapshot.data() } as Project);
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
                    callback({ id: snapshot.id, tenantId: project.tenantId, ...snapshot.data() } as Project);
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
