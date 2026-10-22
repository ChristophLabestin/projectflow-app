import { doc, getDoc, updateDoc } from 'firebase/firestore';

import { db } from '../firebase';
import type { Tenant } from '../../types';

const TENANTS = 'tenants';

export const getTenant = async (tenantId: string) => {
    const snap = await getDoc(doc(db, TENANTS, tenantId));
    if (snap.exists()) {
        return { id: snap.id, ...(snap.data() as Omit<Tenant, 'id'>) } as Tenant;
    }
    return null;
};

export const updateTenant = async (tenantId: string, updates: Record<string, any>) => {
    await updateDoc(doc(db, TENANTS, tenantId), updates);
};
