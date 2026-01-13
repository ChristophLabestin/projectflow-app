import { useState, useEffect, useMemo, useCallback } from 'react';
import { auth } from '../services/firebase';
import { getActiveTenantId, subscribeTenantUsers } from '../services/dataService';
import { WorkspaceRole, WorkspacePermissions, Member } from '../types';
import { WORKSPACE_CAPABILITIES, getWorkspaceRole } from '../utils/permissions';
import { TenantPermissionNode, AIPermissionNode, PermissionNode, Role } from '../types/permissions';
import {
    evaluatePermission,
    SYSTEM_ROLE_DEFAULTS,
    getLegacyWorkspaceRolePermissions
} from '../services/permissionService';

/**
 * Hook for workspace-level permission checks
 * 
 * Provides both legacy capability-based checks (can()) and new granular permission checks (hasPermission())
 * 
 * @example
 * const { can, hasPermission, isOwner } = useWorkspacePermissions();
 * 
 * // Legacy capability check
 * if (can('canManageMembers')) { ... }
 * 
 * // New granular permission check
 * if (hasPermission('tenant.members.invite')) { ... }
 */
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
            setMembers(fetchedMembers as unknown as Member[]);
            setLoading(false);
        }, tenantId);

        return () => unsubscribe();
    }, [tenantId]);

    // Get legacy workspace role
    const role = useMemo((): WorkspaceRole | 'None' => {
        if (!currentUser || !tenantId) return 'None';
        if (currentUser.uid === tenantId) return 'Owner';
        return getWorkspaceRole(members, currentUser.uid);
    }, [currentUser, tenantId, members]);

    // Legacy capabilities (backward compatibility)
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

    // Build roles for new permission system
    const roles = useMemo((): Role[] => {
        if (role === 'None') return [];

        // Build role from legacy data
        const legacyRole = role as WorkspaceRole;
        const permissions = getLegacyWorkspaceRolePermissions(legacyRole);

        if (legacyRole === 'Owner') {
            return [{
                id: 'system-owner',
                name: 'Owner',
                ...SYSTEM_ROLE_DEFAULTS.OWNER,
            }];
        }

        return [{
            id: `system-${legacyRole.toLowerCase()}`,
            name: legacyRole,
            position: legacyRole === 'Admin' ? 100 : legacyRole === 'Member' ? 0 : -1,
            isSystem: true,
            permissions: {
                allow: permissions,
                deny: [],
            },
        }];
    }, [role]);

    const isOwner = role === 'Owner';
    const isAdmin = role === 'Admin';

    // Legacy capability check
    const can = useCallback((capability: keyof WorkspacePermissions) => {
        return capabilities ? capabilities[capability] : false;
    }, [capabilities]);

    // New granular permission check
    const hasPermission = useCallback((node: TenantPermissionNode | AIPermissionNode | 'user.settings.editSelf') => {
        if (!currentUser || !tenantId) return false;
        if (role === 'None') return false;

        // Owner bypass
        if (isOwner) return true;

        // Evaluate permission using roles
        return evaluatePermission({
            userId: currentUser.uid,
            tenantId,
            isTenantOwner: isOwner,
            roles,
        }, node as PermissionNode);
    }, [currentUser, tenantId, role, isOwner, roles]);

    return {
        // Legacy API
        role,
        capabilities,
        can,
        isOwner,
        isAdmin,
        loading,
        members,
        // New granular permission API
        hasPermission,
        roles,
    };
};
