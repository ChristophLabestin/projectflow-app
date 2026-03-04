import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc
} from 'firebase/firestore';

import { auth } from '../firebase';
import { projectSubCollection, resolveTenantId } from '../internal/workspaceDataCore';
import type { EmailBlock, EmailTemplate, TemplateVariable } from '../../types';

const EMAIL_TEMPLATES = 'emailTemplates';

export const saveEmailTemplateDraft = async (
    projectId: string,
    blocks: EmailBlock[],
    variables: TemplateVariable[],
    tenantId?: string,
    name?: string,
    status: 'draft' | 'published' = 'draft',
    templateId?: string
) => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    const templateCollection = projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES);
    const docData = {
        projectId,
        name: name || 'Unnamed Template',
        blocks,
        variables,
        status,
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        ...(templateId ? {} : { createdAt: serverTimestamp() })
    };

    let savedTemplateId = templateId;

    if (templateId) {
        await setDoc(doc(templateCollection, templateId), docData, { merge: true });
    } else {
        const docRef = await addDoc(templateCollection, docData);
        savedTemplateId = docRef.id;
    }

    if (savedTemplateId) {
        try {
            const templateRef = doc(templateCollection, savedTemplateId);
            await addDoc(collection(templateRef, 'versions'), {
                ...docData,
                versionCreatedAt: serverTimestamp(),
                savedBy: user.uid
            });
        } catch (error) {
            console.error('Failed to save version snapshot', error);
        }
    }

    return savedTemplateId;
};

export const getTemplateVersions = async (
    projectId: string,
    templateId: string,
    tenantId?: string
): Promise<EmailTemplate[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const templateRef = doc(projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES), templateId);
    const versionsQuery = query(collection(templateRef, 'versions'), orderBy('versionCreatedAt', 'desc'), limit(25));
    const snapshot = await getDocs(versionsQuery);

    return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        updatedAt: docSnap.data().versionCreatedAt || docSnap.data().updatedAt
    } as EmailTemplate));
};

export const getLatestEmailTemplateDraft = async (projectId: string, tenantId?: string): Promise<EmailTemplate | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snapshot = await getDocs(
        query(projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES), orderBy('updatedAt', 'desc'), limit(1))
    );

    if (snapshot.empty) {
        return null;
    }

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as EmailTemplate;
};

export const getProjectTemplates = async (projectId: string, tenantId?: string): Promise<EmailTemplate[]> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    const snapshot = await getDocs(
        query(projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES), orderBy('updatedAt', 'desc'))
    );

    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as EmailTemplate));
};

export const getEmailTemplateDrafts = async (projectId: string, tenantId?: string): Promise<EmailTemplate[]> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snapshot = await getDocs(
        query(projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES), orderBy('updatedAt', 'desc'), limit(25))
    );

    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as EmailTemplate));
};

export const deleteEmailTemplate = async (projectId: string, templateId: string, tenantId?: string) => {
    const resolvedTenant = resolveTenantId(tenantId);
    await deleteDoc(doc(projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES), templateId));
};

export const getEmailTemplateById = async (
    projectId: string,
    templateId: string,
    tenantId?: string
): Promise<EmailTemplate | null> => {
    const resolvedTenant = resolveTenantId(tenantId);
    const snap = await getDoc(doc(projectSubCollection(resolvedTenant, projectId, EMAIL_TEMPLATES), templateId));

    if (!snap.exists()) {
        return null;
    }

    return { id: snap.id, ...snap.data() } as EmailTemplate;
};
