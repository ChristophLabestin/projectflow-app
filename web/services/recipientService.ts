import { Recipient, RecipientColumn } from '../types';
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
    writeBatch,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';

// Listener Type
type Listener<T> = (data: T) => void;

// Collection Names
const MARKETING_RECIPIENTS = 'marketing_recipients';
const MARKETING_RECIPIENT_COLUMNS = 'marketing_recipient_columns';

// Helper to get subcollection refs
const recipientsCollection = (tenantId: string, projectId: string) =>
    projectSubCollection(tenantId, projectId, MARKETING_RECIPIENTS);

const recipientColumnsCollection = (tenantId: string, projectId: string) =>
    projectSubCollection(tenantId, projectId, MARKETING_RECIPIENT_COLUMNS);

// --- Recipients ---

export const subscribeRecipients = (projectId: string, onUpdate: Listener<Recipient[]>, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(
        recipientsCollection(resolvedTenant, projectId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const recipients = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Recipient));
        onUpdate(recipients);
    });
};

export const subscribeRecipientColumns = (projectId: string, onUpdate: Listener<RecipientColumn[]>, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(recipientColumnsCollection(resolvedTenant, projectId));

    return onSnapshot(q, (snapshot) => {
        const columns = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as RecipientColumn));
        onUpdate(columns);
    });
};

// CRUD Operations

export const createRecipient = async (
    projectId: string,
    recipient: Omit<Recipient, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const colRef = recipientsCollection(resolvedTenant, projectId);
    const docRef = await addDoc(colRef, {
        ...recipient,
        projectId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
};

export const updateRecipient = async (
    projectId: string,
    recipientId: string,
    updates: Partial<Recipient>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(recipientsCollection(resolvedTenant, projectId), recipientId);
    await updateDoc(ref, {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

export const deleteRecipient = async (projectId: string, recipientId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(recipientsCollection(resolvedTenant, projectId), recipientId);
    await deleteDoc(ref);
};

export const batchImportRecipients = async (
    projectId: string,
    newRecipients: Omit<Recipient, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[],
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const colRef = recipientsCollection(resolvedTenant, projectId);

    // Use batch writes for better performance (limit 500 per batch)
    const batch = writeBatch(db);
    newRecipients.forEach(r => {
        const newDocRef = doc(colRef);
        batch.set(newDocRef, {
            ...r,
            projectId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    });

    await batch.commit();
    return newRecipients.length;
};

export const addRecipientColumn = async (
    projectId: string,
    column: Omit<RecipientColumn, 'id' | 'projectId' | 'createdAt'>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const colRef = recipientColumnsCollection(resolvedTenant, projectId);
    const docRef = await addDoc(colRef, {
        ...column,
        projectId,
        createdAt: serverTimestamp()
    });
    return docRef.id;
};

export const deleteRecipientColumn = async (
    projectId: string,
    columnId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(recipientColumnsCollection(resolvedTenant, projectId), columnId);
    await deleteDoc(ref);
};

// --- Group Membership ---

export const addRecipientToGroups = async (
    projectId: string,
    recipientId: string,
    groupIds: string[],
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(recipientsCollection(resolvedTenant, projectId), recipientId);
    await updateDoc(ref, {
        groupIds: arrayUnion(...groupIds),
        updatedAt: serverTimestamp()
    });
};

export const removeRecipientFromGroups = async (
    projectId: string,
    recipientId: string,
    groupIds: string[],
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(recipientsCollection(resolvedTenant, projectId), recipientId);
    await updateDoc(ref, {
        groupIds: arrayRemove(...groupIds),
        updatedAt: serverTimestamp()
    });
};

export const setRecipientGroups = async (
    projectId: string,
    recipientId: string,
    groupIds: string[],
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = doc(recipientsCollection(resolvedTenant, projectId), recipientId);
    await updateDoc(ref, {
        groupIds,
        updatedAt: serverTimestamp()
    });
};

