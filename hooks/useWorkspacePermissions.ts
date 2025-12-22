import { useState, useEffect, useMemo } from 'react';
import { auth } from '../services/firebase';
import { getActiveTenantId, subscribeTenantUsers } from '../services/dataService';
import { WorkspaceRole, WorkspacePermissions, Member } from '../types';
import { WORKSPACE_CAPABILITIES, getWorkspaceRole } from '../utils/permissions';

export const useWorkspacePermissions = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const tenantId = getActiveTenantId();
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeTenantUsers((fetchedMembers) => {
            // fetchedMembers are typed as any in dataService but usually conform to Member
            // We map them to ensure type safety if needed, or cast
            setMembers(fetchedMembers as unknown as Member[]);
            setLoading(false);
        }, tenantId);

        return () => unsubscribe();
    }, [tenantId]);

    const role = useMemo((): WorkspaceRole | 'None' => {
        if (!currentUser || !tenantId) return 'None';
        // If current user is the tenant ID (personal workspace), they are Owner
        if (currentUser.uid === tenantId) return 'Owner';
        return getWorkspaceRole(members, currentUser.uid);
    }, [currentUser, tenantId, members]);

    const capabilities = useMemo((): WorkspacePermissions => {
        if (role === 'None') {
            return {
                canManageWorkspace: false,
                canManageMembers: false,
                canManageGroups: false,
                canCreateProjects: false,
                canDeleteProjects: false,
                canViewAllProjects: false,
            };
        }
        return WORKSPACE_CAPABILITIES[role];
    }, [role]);

    const can = (capability: keyof WorkspacePermissions) => {
        return capabilities ? capabilities[capability] : false;
    };

    const isOwner = role === 'Owner';
    const isAdmin = role === 'Admin';

    return {
        role,
        capabilities,
        can,
        isOwner,
        isAdmin,
        loading,
        members // Expose members so components don't need to double-fetch
    };
};
