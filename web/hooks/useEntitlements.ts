import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '../services/firebase';
import { type PlanState, parseEntitlements, toPlanState } from '../utils/billingPlans';

/**
 * Live plan entitlements of a workspace (tenants/{id}/entitlements/plan, server-written); null while loading.
 * Contract: brain/plans/billing-entitlements-contract.md.
 */
export const useEntitlements = (tenantId: string | null | undefined) => {
    const [entitlements, setEntitlements] = useState<PlanState | null>(null);
    useEffect(() => {
        if (!tenantId) {
            setEntitlements(null);
            return undefined;
        }
        return onSnapshot(
            doc(db, 'tenants', tenantId, 'entitlements', 'plan'),
            (snap) => setEntitlements(toPlanState(parseEntitlements(snap.exists() ? snap.data() : undefined))),
            () => setEntitlements(toPlanState(parseEntitlements(undefined))),
        );
    }, [tenantId]);
    return entitlements;
};

/**
 * Is Stripe checkout live? `billing_public/config.checkoutAvailable` (server-written); missing doc = false.
 * Upgrade/add-on buttons stay disabled ("coming soon") until then.
 */
export const useCheckoutAvailable = () => {
    const [available, setAvailable] = useState(false);
    useEffect(() => onSnapshot(
        doc(db, 'billing_public', 'config'),
        (snap) => setAvailable(snap.exists() && snap.data()?.checkoutAvailable === true),
        () => setAvailable(false),
    ), []);
    return available;
};
