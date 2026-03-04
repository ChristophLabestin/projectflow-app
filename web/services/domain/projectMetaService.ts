import {
    collection,
    doc,
    deleteDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    updateDoc
} from 'firebase/firestore';

import { db } from '../firebase';
import { getActiveTenantId } from './authService';
import { toMillis } from '../../utils/time';
import type { Milestone, TaskCategory } from '../../types';

const MILESTONES = 'milestones';
const CATEGORIES = 'categories';

const resolveTenantId = (tenantId?: string) => tenantId || getActiveTenantId();

const projectSubCollection = (tenantId: string, projectId: string, collectionName: string) =>
    collection(db, 'tenants', tenantId, 'projects', projectId, collectionName);

export const updateMilestone = async (
    projectId: string,
    milestoneId: string,
    updates: Partial<Milestone>,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    if (!resolvedTenant) {
        throw new Error('Tenant not available');
    }

    const ref = doc(projectSubCollection(resolvedTenant, projectId, MILESTONES), milestoneId);
    await updateDoc(ref, updates);
};

export const deleteMilestone = async (
    projectId: string,
    milestoneId: string,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    if (!resolvedTenant) {
        throw new Error('Tenant not available');
    }

    const ref = doc(projectSubCollection(resolvedTenant, projectId, MILESTONES), milestoneId);
    await deleteDoc(ref);
};

export const subscribeProjectMilestones = (
    projectId: string,
    onUpdate: (milestones: Milestone[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    if (!resolvedTenant) {
        onUpdate([]);
        return () => undefined;
    }

    const milestoneQuery = query(
        projectSubCollection(resolvedTenant, projectId, MILESTONES),
        orderBy('dueDate', 'asc')
    );

    return onSnapshot(milestoneQuery, (snapshot) => {
        const milestones = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
        } as Milestone));
        onUpdate(milestones);
    });
};

export const getProjectCategories = async (projectId: string, tenantId?: string): Promise<TaskCategory[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    if (!resolvedTenant) {
        return [];
    }

    const snapshot = await getDocs(projectSubCollection(resolvedTenant, projectId, CATEGORIES));
    return snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as TaskCategory))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};
