import { ProjectGroup } from '../types';
import { db } from './firebase';
import { resolveTenantId, projectSubCollection } from './dataService';
import {
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    orderBy,
    getDocs
} from 'firebase/firestore';

// Listener Type
type Listener<T> = (data: T) => void;

// Collection Names
const PROJECT_GROUPS = 'project_groups';

// Helper to get subcollection refs
const groupsCollection = (tenantId: string, projectId: string) =>
    projectSubCollection(tenantId, projectId, PROJECT_GROUPS);

export const subscribeProjectGroups = (projectId: string, onUpdate: Listener<ProjectGroup[]>, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        groupsCollection(resolvedTenant, projectId),
        orderBy('name', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
        const groups = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ProjectGroup));
        onUpdate(groups);
    }, (error) => {
        console.error('Error subscribing to project groups:', error);
        onUpdate([]);
    });
};

export const getProjectGroups = async (projectId: string, tenantId?: string): Promise<ProjectGroup[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        groupsCollection(resolvedTenant, projectId),
        orderBy('name', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as ProjectGroup));
};


export const createProjectGroup = async (
    projectId: string,
    group: Omit<ProjectGroup, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const colRef = groupsCollection(resolvedTenant, projectId);
    const docRef = await addDoc(colRef, {
        ...group,
        projectId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
};

export const updateProjectGroup = async (
    projectId: string,
    groupId: string,
    updates: Partial<ProjectGroup>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(groupsCollection(resolvedTenant, projectId), groupId);
    await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

export const deleteProjectGroup = async (projectId: string, groupId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(groupsCollection(resolvedTenant, projectId), groupId);
    await deleteDoc(ref);
};
