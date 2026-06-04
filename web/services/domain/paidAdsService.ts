import {
    addDoc,
    collectionGroup,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    where,
    serverTimestamp
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { ensureTenantAndUser, getCachedTenantId, projectSubCollection, resolveTenantId } from '../internal/workspaceDataCore';
import { toMillis } from '../../utils/time';
import type { PaidAd } from '../../types';

const PAID_ADS = 'paidAds';

const findPaidAdDoc = async (paidAdId: string, projectId?: string, tenantId?: string) => {
    const preferredTenant = tenantId || getCachedTenantId();
    if (projectId && preferredTenant) {
        const directRef = doc(projectSubCollection(preferredTenant, projectId, PAID_ADS), paidAdId);
        const snap = await getDoc(directRef);
        if (snap.exists()) return snap;
    }

    const snapshot = await getDocs(collectionGroup(db, PAID_ADS));
    return snapshot.docs.find((docSnap) => docSnap.id === paidAdId) || null;
};

export const getUserPaidAds = async (): Promise<PaidAd[]> => {
    const user = auth.currentUser;
    if (!user) return [];

    const snapshot = await getDocs(
        query(collectionGroup(db, PAID_ADS), where('ownerId', '==', user.uid))
    );

    return snapshot.docs
        .map((docSnap) => ({ ...docSnap.data(), id: docSnap.id } as PaidAd))
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

export const createPaidAd = async (projectId: string, paidAd: Partial<PaidAd>, tenantId?: string): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const resolvedTenant = resolveTenantId(tenantId);
    await ensureTenantAndUser(resolvedTenant);

    const ref = await addDoc(projectSubCollection(resolvedTenant, projectId, PAID_ADS), {
        ...paidAd,
        projectId,
        tenantId: resolvedTenant,
        ownerId: user.uid,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return ref.id;
};

export const updatePaidAd = async (paidAdId: string, updates: Partial<PaidAd>, projectId?: string, tenantId?: string) => {
    const snap = await findPaidAdDoc(paidAdId, projectId, tenantId);
    if (!snap) throw new Error('Paid ad not found');
    await updateDoc(snap.ref, { ...updates, updatedAt: serverTimestamp() });
};

export const deletePaidAd = async (paidAdId: string, projectId?: string, tenantId?: string) => {
    const snap = await findPaidAdDoc(paidAdId, projectId, tenantId);
    if (!snap) return;
    await deleteDoc(snap.ref);
};

export const getPaidAdById = async (paidAdId: string, projectId?: string, tenantId?: string): Promise<PaidAd | null> => {
    const snap = await findPaidAdDoc(paidAdId, projectId, tenantId);
    if (snap?.exists()) {
        return { ...snap.data(), id: snap.id } as PaidAd;
    }
    return null;
};

export const subscribeProjectPaidAds = (
    projectId: string,
    onUpdate: (paidAds: PaidAd[]) => void,
    tenantId?: string
) => {
    const resolvedTenant = resolveTenantId(tenantId);
    const paidAdsQuery = query(
        projectSubCollection(resolvedTenant, projectId, PAID_ADS),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(paidAdsQuery, (snapshot) => {
        const paidAds = snapshot.docs
            .map((docSnap) => ({ ...docSnap.data(), id: docSnap.id } as PaidAd))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        onUpdate(paidAds);
    });
};
