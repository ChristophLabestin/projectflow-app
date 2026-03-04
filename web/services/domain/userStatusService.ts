import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';

import { auth, db } from '../firebase';
import { resolveActiveTenantId } from './authService';

const TENANTS = 'tenants';
const USERS = 'users';

const resolveStatusDoc = (userId: string, tenantId?: string) => {
    const resolvedTenant = resolveActiveTenantId(tenantId) || auth.currentUser?.uid;
    if (!resolvedTenant) {
        throw new Error('User not authenticated');
    }

    return doc(db, TENANTS, resolvedTenant, USERS, userId);
};

export const updateUserStatusPreference = async (
    userId: string,
    status: 'online' | 'busy' | 'idle' | 'offline',
    tenantId?: string
) => {
    await setDoc(resolveStatusDoc(userId, tenantId), { statusPreference: status }, { merge: true });
};

export const subscribeUserStatusPreference = (
    userId: string,
    onUpdate: (status: 'online' | 'busy' | 'idle' | 'offline') => void,
    tenantId?: string
): Unsubscribe => {
    return onSnapshot(resolveStatusDoc(userId, tenantId), (snap) => {
        if (snap.exists()) {
            onUpdate(snap.data().statusPreference || 'online');
        } else {
            onUpdate('online');
        }
    });
};
