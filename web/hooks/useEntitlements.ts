import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '../services/firebase';
import { useWorkspace } from '../context/WorkspaceContext';
import { type PlanState, parseEntitlements, toPlanState } from '../utils/billingPlans';

// One Firestore listener per workspace, shared by every component that asks for its plan
// (banner, guards, settings, AI hints mount many consumers at once).
type Entry = { state: PlanState | null; listeners: Set<(state: PlanState) => void>; unsubscribe: () => void };
const entries = new Map<string, Entry>();

const subscribe = (tenantId: string, listener: (state: PlanState) => void) => {
    let entry = entries.get(tenantId);
    if (!entry) {
        const created: Entry = { state: null, listeners: new Set(), unsubscribe: () => undefined };
        const publish = (state: PlanState) => {
            created.state = state;
            created.listeners.forEach((notify) => notify(state));
        };
        created.unsubscribe = onSnapshot(
            doc(db, 'tenants', tenantId, 'entitlements', 'plan'),
            (snap) => publish(toPlanState(parseEntitlements(snap.exists() ? snap.data() : undefined))),
            () => publish(toPlanState(parseEntitlements(undefined))),
        );
        entries.set(tenantId, created);
        entry = created;
    }
    entry.listeners.add(listener);
    if (entry.state) listener(entry.state);
    return () => {
        const current = entries.get(tenantId);
        if (!current) return;
        current.listeners.delete(listener);
        if (current.listeners.size === 0) {
            current.unsubscribe();
            entries.delete(tenantId);
        }
    };
};

/**
 * Live plan entitlements of a workspace (tenants/{id}/entitlements/plan, server-written); null while loading.
 * Contract: brain/plans/billing-entitlements-contract.md.
 */
export const useEntitlements = (tenantId: string | null | undefined) => {
    const [entitlements, setEntitlements] = useState<PlanState | null>(() => (tenantId ? entries.get(tenantId)?.state ?? null : null));
    useEffect(() => {
        if (!tenantId) {
            setEntitlements(null);
            return undefined;
        }
        setEntitlements(entries.get(tenantId)?.state ?? null);
        return subscribe(tenantId, setEntitlements);
    }, [tenantId]);
    return entitlements;
};

/** Plan of the active workspace plus whether the current user may change it (owner). */
export const useActivePlan = () => {
    const { activeWorkspaceId, activeWorkspace } = useWorkspace();
    const plan = useEntitlements(activeWorkspaceId);
    return { plan, tenantId: activeWorkspaceId, isOwner: activeWorkspace?.role === 'Owner' };
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
