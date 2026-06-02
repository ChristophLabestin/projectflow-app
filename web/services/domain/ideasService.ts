import {
    addDoc,
    collection,
    collectionGroup,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    where,
    serverTimestamp
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { ensureTenantAndUser, findIdeaDoc, projectSubCollection, resolveTenantId } from '../internal/workspaceDataCore';
import { toMillis } from '../../utils/time';
import type { Idea } from '../../types';
import { assertPmCoreAllowsLegacyWrites } from '../../config/pmCore';

const IDEAS = 'ideas';

export const getUserIdeas = async (): Promise<Idea[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const snapshot = await getDocs(
        query(collectionGroup(db, IDEAS), where('ownerId', '==', user.uid))
    );

    return snapshot.docs
        .map((docSnap) => ({ ...docSnap.data(), id: docSnap.id } as Idea))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const saveIdea = async (idea: Partial<Idea>, tenantId?: string) => {
    assertPmCoreAllowsLegacyWrites('ideas');
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const targetCollection = idea.projectId
        ? collection(db, 'tenants', resolvedTenant, 'projects', idea.projectId, IDEAS)
        : collection(db, 'tenants', resolvedTenant, IDEAS);

    await addDoc(targetCollection, {
        ...idea,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        createdAt: serverTimestamp()
    });
};

export const updateIdea = async (ideaId: string, updates: Partial<Idea>, projectId?: string, tenantId?: string) => {
    assertPmCoreAllowsLegacyWrites('ideas');
    const ideaSnap = await findIdeaDoc(ideaId, projectId, tenantId);
    if (!ideaSnap) throw new Error('Flow not found');
    await updateDoc(ideaSnap.ref, updates);
};

export const deleteIdea = async (ideaId: string, projectId?: string, tenantId?: string) => {
    assertPmCoreAllowsLegacyWrites('ideas');
    const ideaSnap = await findIdeaDoc(ideaId, projectId, tenantId);
    if (!ideaSnap) return;
    await deleteDoc(ideaSnap.ref);
};

export const getIdeaById = async (ideaId: string, projectId?: string, tenantId?: string): Promise<Idea | null> => {
    const docSnap = await findIdeaDoc(ideaId, projectId, tenantId);
    if (docSnap?.exists()) {
        return { ...docSnap.data(), id: docSnap.id } as Idea;
    }
    return null;
};

export const subscribeToIdea = (
    ideaId: string,
    projectId: string,
    onUpdate: (idea: Idea) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ideaRef = doc(projectSubCollection(resolvedTenant, projectId, IDEAS), ideaId);

    return onSnapshot(ideaRef, (snap) => {
        if (snap.exists()) {
            onUpdate({ ...snap.data(), id: snap.id } as Idea);
        }
    });
};

export const subscribeProjectIdeas = (
    projectId: string,
    onUpdate: (ideas: Idea[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const ideasQuery = query(
        projectSubCollection(resolvedTenant, projectId, IDEAS),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(ideasQuery, (snapshot) => {
        const ideas = snapshot.docs
            .map((docSnap) => ({ ...docSnap.data(), id: docSnap.id } as Idea))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        onUpdate(ideas);
    });
};
