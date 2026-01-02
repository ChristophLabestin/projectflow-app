import { useState, useEffect } from 'react';
import { getActiveTenantId, getTenant } from '../services/dataService';
import { Tenant } from '../types';
import { auth } from '../services/firebase';

export const useModuleAccess = (moduleId: string) => {
    const [hasAccess, setHasAccess] = useState(true); // Default to true to prevent flickering/blocking valid access while loading, but strictly ideally false. User said "only allow... if they have...", so default should be false? Or maybe fetch first. Let's default false to be safe, or true if we assume legacy?
    // User request: "only allow ... if they have ... in the 'AccessToModules' Array"
    // This implies default is BLOCKED if array exists but doesn't have it, or if logic is enforced.
    // However, for existing tenants without the array, what should happen? 
    // "if they have in their firestore ... the "AccessToModules" Array"
    // Usually means if the array is missing, do they have access? The request implies a restriction system.
    // Let's assume: 
    // If AccessToModules is defined, check it.
    // If AccessToModules is UNDEFINED (legacy), maybe allow all? Or block restricted ones?
    // "release... in steps". "only allow ... IF they have ...". This suggests it's a feature flag.
    // So if the array is missing, they DON'T have it.

    // BUT: "Social" and "Marketing" are already there. If I block them for everyone who doesn't have this new array, I break the app for everyone.
    // I should probably check if the array exists. 
    // If the array is missing, I should probably allow current modules (Social/Marketing) OR assume the user will migrate data.
    // Given "release ... in steps", it sounds like rolling out to specific tenants.
    // I will implementation strict check: Must exist in array.

    // WAIT: The user said "Notice: The accounting module does not exists yet but implement it for that preamtivly"
    // And "release the social, marketing ... in steps".
    // This implies these modules are now RESTRICTED.
    // So default should be FALSE for these specific modules.

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAccess = async () => {
            try {
                let tenantId = getActiveTenantId();
                if (!tenantId) {
                    tenantId = auth.currentUser?.uid;
                }

                if (!tenantId) {
                    setHasAccess(false);
                    setIsLoading(false);
                    return;
                }

                const tenant = await getTenant(tenantId);
                const modules = (tenant as any)?.AccessToModules || (tenant as Tenant)?.AccessToModules;

                // RESTRICTED MODULES LIST
                const restrictedModules = ['social', 'marketing', 'accounting'];

                // If it's not a restricted module, allow it (e.g. tasks, ideas)
                if (!restrictedModules.includes(moduleId.toLowerCase())) {
                    setHasAccess(true);
                    setIsLoading(false);
                    return;
                }

                if (modules && Array.isArray(modules)) {
                    // Check case-insensitive
                    const hasIt = modules.some((m: string) => m.toLowerCase() === moduleId.toLowerCase());
                    setHasAccess(hasIt);
                } else {
                    // Array not present -> Deny access to restricted modules
                    setHasAccess(false);
                }
            } catch (error) {
                console.error("Error checking module access:", error);
                setHasAccess(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkAccess();
    }, [moduleId]);

    return { hasAccess, isLoading };
};
