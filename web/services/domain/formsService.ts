// Forms (brain/plans/forms-concept.md). Package 1: plan quota and workspace legal details.
// Forms themselves are written only through Cloud Functions (package 2).

import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

import { db } from '../firebase';
import type { TenantLegal } from '../../types/forms';
import { formQuotaFor, type FormQuota } from '../../utils/formsLogic';

/** Live forms quota of a workspace (server enforces the same `formQuotaFor`). */
export const subscribeFormQuota = (tenantId: string, callback: (quota: FormQuota) => void) => {
    let entitlement: Record<string, any> | null | undefined;
    let tenant: Record<string, any> | null | undefined;
    const emit = () => {
        if (entitlement !== undefined && tenant !== undefined) callback(formQuotaFor(entitlement, tenant));
    };
    const offEnt = onSnapshot(doc(db, 'tenants', tenantId, 'entitlements', 'plan'),
        (snap) => { entitlement = snap.exists() ? snap.data() : null; emit(); },
        () => { entitlement = null; emit(); });
    const offTenant = onSnapshot(doc(db, 'tenants', tenantId),
        (snap) => { tenant = snap.exists() ? snap.data() : null; emit(); },
        () => { tenant = null; emit(); });
    return () => { offEnt(); offTenant(); };
};

const trimLegal = (legal: TenantLegal): TenantLegal => {
    const out: TenantLegal = {};
    (['controllerName', 'privacyPolicyUrl', 'imprintUrl', 'contactEmail'] as const).forEach((key) => {
        const value = (legal[key] || '').trim();
        if (value) out[key] = value;
    });
    return out;
};

/** Owner/Admin only (rules validate keys, lengths and https URLs). */
export const saveTenantLegal = (tenantId: string, legal: TenantLegal) =>
    updateDoc(doc(db, 'tenants', tenantId), { legal: trimLegal(legal) });

/** Public forms need a controller and a privacy policy (§10); the imprint is strongly recommended. */
export const isTenantLegalComplete = (legal: TenantLegal | null | undefined) =>
    !!legal && !!legal.controllerName?.trim() && !!legal.privacyPolicyUrl?.trim();
