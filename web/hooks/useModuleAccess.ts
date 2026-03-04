import { useState, useEffect } from 'react';
import { getActiveTenantId } from '../services/domain/authService';
import { getTenant } from '../services/domain/workspaceService';
import { Tenant } from '../types';
import { auth } from '../services/firebase';

const RESTRICTED_MODULES = new Set(['social', 'marketing', 'accounting']);

export const useModuleAccess = (moduleId: string) => {
    const normalizedModuleId = moduleId.toLowerCase();
    const isRestrictedModule = RESTRICTED_MODULES.has(normalizedModuleId);
    const [hasAccess, setHasAccess] = useState(!isRestrictedModule);
    const [isLoading, setIsLoading] = useState(isRestrictedModule);

    useEffect(() => {
        if (!isRestrictedModule) {
            setHasAccess(true);
            setIsLoading(false);
            return;
        }

        let isActive = true;

        const checkAccess = async () => {
            try {
                let tenantId = getActiveTenantId();
                if (!tenantId) {
                    tenantId = auth.currentUser?.uid;
                }

                if (!tenantId) {
                    if (isActive) {
                        setHasAccess(false);
                        setIsLoading(false);
                    }
                    return;
                }

                const tenant = await getTenant(tenantId);
                const modules = (tenant as any)?.AccessToModules || (tenant as Tenant)?.AccessToModules;

                if (modules && Array.isArray(modules)) {
                    const hasModuleAccess = modules.some((item: string) => item.toLowerCase() === normalizedModuleId);
                    if (isActive) {
                        setHasAccess(hasModuleAccess);
                    }
                } else {
                    if (isActive) {
                        setHasAccess(false);
                    }
                }
            } catch (error) {
                console.error('Error checking module access:', error);
                if (isActive) {
                    setHasAccess(false);
                }
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        };

        checkAccess();

        return () => {
            isActive = false;
        };
    }, [isRestrictedModule, normalizedModuleId]);

    return { hasAccess, isLoading };
};
