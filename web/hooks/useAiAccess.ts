import { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { personalAiKey } from '../services/billingService';
import { useActivePlan } from './useEntitlements';

export type AiAccessStatus = 'loading' | 'enabled' | 'own-key' | 'addon-required' | 'plan-required';
export type AiAccess = { status: AiAccessStatus; canUse: boolean };

// Own OpenAI key (Free plan): asked once per user and session; the key itself never comes back.
const ownKeyChecks = new Map<string, Promise<boolean>>();
const hasOwnKey = (uid: string) => {
    if (!ownKeyChecks.has(uid)) {
        ownKeyChecks.set(uid, personalAiKey('get').then((status) => status.hasKey).catch(() => false));
    }
    return ownKeyChecks.get(uid) as Promise<boolean>;
};

/** Call after saving/removing the key in Settings → Billing so gated AI entry points update. */
export const resetOwnAiKeyCheck = () => ownKeyChecks.clear();

/**
 * Whether the current user may use server AI in the active workspace (contract: billing-entitlements-contract.md):
 * trial/beta or an assigned AI add-on → `enabled`; otherwise an own OpenAI key → `own-key`; else the reason
 * (`addon-required` on Team/Organization, `plan-required` on Free). Pair a blocked status with <AiPlanHint />.
 */
export const useAiAccess = (): AiAccess => {
    const { user } = useAuth();
    const { plan } = useActivePlan();
    const uid = user?.uid || null;
    const serverAi = plan ? plan.aiEnabledFor(uid) : null;
    const [ownKey, setOwnKey] = useState<boolean | null>(null);

    useEffect(() => {
        if (serverAi !== false || !uid) {
            setOwnKey(null);
            return undefined;
        }
        let active = true;
        hasOwnKey(uid).then((value) => { if (active) setOwnKey(value); });
        return () => { active = false; };
    }, [serverAi, uid]);

    if (!plan || serverAi === null) return { status: 'loading', canUse: false };
    if (serverAi) return { status: 'enabled', canUse: true };
    if (ownKey === null) return { status: 'loading', canUse: false };
    if (ownKey) return { status: 'own-key', canUse: true };
    return { status: plan.aiAddonAvailable ? 'addon-required' : 'plan-required', canUse: false };
};
