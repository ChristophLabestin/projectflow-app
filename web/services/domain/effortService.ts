import {
    addDoc,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    writeBatch
} from 'firebase/firestore';

import { db } from '../firebase';
import { projectSubCollection, resolveTenantId } from '../dataService';
import type { EffortEntry } from '../../types';

const EFFORT = 'effort_entries';

type Listener<T> = (data: T) => void;

const effortCollection = (tenantId: string, projectId: string) =>
    projectSubCollection(tenantId, projectId, EFFORT);

export const getProjectEffort = async (projectId: string, tenantId?: string): Promise<EffortEntry[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const q = query(effortCollection(resolvedTenant, projectId), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EffortEntry));
};

export const createEffortEntry = async (
    projectId: string,
    entry: Omit<EffortEntry, 'id' | 'projectId' | 'tenantId' | 'createdAt' | 'updatedAt'>,
    tenantId?: string
): Promise<string> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ref = await addDoc(effortCollection(resolvedTenant, projectId), {
        ...entry,
        projectId,
        tenantId: resolvedTenant,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return ref.id;
};

export const updateEffortEntry = async (
    projectId: string,
    entryId: string,
    updates: Partial<EffortEntry>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await updateDoc(doc(effortCollection(resolvedTenant, projectId), entryId), {
        ...updates,
        updatedAt: serverTimestamp()
    });
};

export const deleteEffortEntry = async (projectId: string, entryId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(effortCollection(resolvedTenant, projectId), entryId));
};

/** Bulk-create entries (used by the markdown importer). */
export const createEffortEntries = async (
    projectId: string,
    entries: Array<Omit<EffortEntry, 'id' | 'projectId' | 'tenantId' | 'createdAt' | 'updatedAt'>>,
    tenantId?: string
): Promise<number> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const col = effortCollection(resolvedTenant, projectId);
    const batch = writeBatch(db);
    entries.forEach((entry) => {
        const ref = doc(col);
        batch.set(ref, {
            ...entry,
            projectId,
            tenantId: resolvedTenant,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    });
    await batch.commit();
    return entries.length;
};
