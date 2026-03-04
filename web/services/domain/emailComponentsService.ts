import {
    addDoc,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp
} from 'firebase/firestore';

import { auth } from '../firebase';
import { projectSubCollection, resolveTenantId } from '../internal/workspaceDataCore';
import type { EmailBlock, EmailComponent } from '../../types';

const EMAIL_COMPONENTS = 'email_components';

export const saveEmailComponent = async (projectId: string, name: string, block: EmailBlock, tenantId?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);

    await addDoc(projectSubCollection(resolvedTenant, projectId, EMAIL_COMPONENTS), {
        projectId,
        name,
        block,
        createdBy: user.uid,
        createdAt: serverTimestamp()
    });
};

export const getEmailComponents = async (projectId: string, tenantId?: string): Promise<EmailComponent[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const componentsQuery = query(
        projectSubCollection(resolvedTenant, projectId, EMAIL_COMPONENTS),
        orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(componentsQuery);

    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
    } as EmailComponent));
};

export const deleteEmailComponent = async (projectId: string, componentId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(projectSubCollection(resolvedTenant, projectId, EMAIL_COMPONENTS), componentId));
};
