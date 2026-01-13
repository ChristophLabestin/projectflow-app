import { RecipientGroup, GroupColumn } from '../types';
import { db } from './firebase';
import { resolveTenantId, projectSubCollection } from './dataService';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    orderBy,
    writeBatch
} from 'firebase/firestore';

// Listener Type
type Listener<T> = (data: T) => void;

// Collection Names
const MARKETING_GROUPS = 'marketing_groups';
const MARKETING_GROUP_COLUMNS = 'marketing_group_columns';

// Helper to get subcollection refs
const groupsCollection = (tenantId: string, projectId: string) =>
    projectSubCollection(tenantId, projectId, MARKETING_GROUPS);

const groupColumnsCollection = (tenantId: string, projectId: string) =>
    projectSubCollection(tenantId, projectId, MARKETING_GROUP_COLUMNS);

// --- Groups ---

export const subscribeGroups = (projectId: string, onUpdate: Listener<RecipientGroup[]>, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        groupsCollection(resolvedTenant, projectId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const groups = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as RecipientGroup));
        onUpdate(groups);
    }, (error) => {
        console.error('Error subscribing to groups:', error);
        // Return empty array on error to prevent UI issues
        onUpdate([]);
    });
};

export const subscribeGroupColumns = (projectId: string, onUpdate: Listener<GroupColumn[]>, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(groupColumnsCollection(resolvedTenant, projectId));

    return onSnapshot(q, (snapshot) => {
        const columns = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as GroupColumn));
        onUpdate(columns);
    });
};

// CRUD Operations

export const createGroup = async (
    projectId: string,
    group: Omit<RecipientGroup, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>,
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

export const updateGroup = async (
    projectId: string,
    groupId: string,
    updates: Partial<RecipientGroup>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(groupsCollection(resolvedTenant, projectId), groupId);
    await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

export const deleteGroup = async (projectId: string, groupId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(groupsCollection(resolvedTenant, projectId), groupId);
    await deleteDoc(ref);
};

export const batchImportGroups = async (
    projectId: string,
    newGroups: Omit<RecipientGroup, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[],
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const colRef = groupsCollection(resolvedTenant, projectId);

    // Use batch writes for better performance (limit 500 per batch)
    const batch = writeBatch(db);
    newGroups.forEach(g => {
        const newDocRef = doc(colRef);
        batch.set(newDocRef, {
            ...g,
            projectId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    });

    await batch.commit();
    return newGroups.length;
};

// --- Group Columns ---

export const addGroupColumn = async (
    projectId: string,
    column: Omit<GroupColumn, 'id' | 'projectId' | 'createdAt'>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const colRef = groupColumnsCollection(resolvedTenant, projectId);
    const docRef = await addDoc(colRef, {
        ...column,
        projectId,
        createdAt: serverTimestamp()
    });
    return docRef.id;
};

export const deleteGroupColumn = async (
    projectId: string,
    columnId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(groupColumnsCollection(resolvedTenant, projectId), columnId);
    await deleteDoc(ref);
};
