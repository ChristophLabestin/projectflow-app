import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '../services/firebase';
import { type Entitlements, parseEntitlements } from '../utils/billingPlans';

/** Live plan entitlements of a workspace (tenants/{id}/entitlements/plan, server-written). */
export const useEntitlements = (tenantId: string | null | undefined) => {
    const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
    useEffect(() => {
        if (!tenantId) {
            setEntitlements(null);
            return undefined;
        }
        return onSnapshot(
            doc(db, 'tenants', tenantId, 'entitlements', 'plan'),
            (snap) => setEntitlements(parseEntitlements(snap.exists() ? snap.data() : undefined)),
            () => setEntitlements(parseEntitlements(undefined)),
        );
    }, [tenantId]);
    return entitlements;
};
