import { useState, useEffect } from 'react';
import { CustomRole } from '../types';
import { getWorkspaceRoles } from '../services/rolesService';

export function useWorkspaceRoles(tenantId?: string) {
    const [roles, setRoles] = useState<CustomRole[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenantId) {
            setRoles([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        getWorkspaceRoles(tenantId).then(fetchedRoles => {
            setRoles(fetchedRoles);
            setLoading(false);
        }).catch(err => {
            console.error('Failed to fetch workspace roles', err);
            setLoading(false);
        });
    }, [tenantId]);

    return { roles, loading };
}
