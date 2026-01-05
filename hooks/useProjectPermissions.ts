import { useMemo, useCallback } from 'react';
import { Project, RoleCapabilities } from '../types';
import { getUserRole, getUserCapabilities, checkPermission, hasPermission as legacyHasPermission } from '../utils/permissions';
import { auth } from '../services/firebase';
import { getActiveTenantId } from '../services/dataService';
import { ProjectPermissionNode, Role, LegacyProjectRole } from '../types/permissions';
import { evaluatePermission, getLegacyProjectRolePermissions, ALL_PROJECT_PERMISSIONS } from '../services/permissionService';

/**
 * Hook for project-level permission checks
 * 
 * Provides both legacy capability-based checks (can()) and new granular permission checks (hasPermission())
 * 
 * @example
 * const { can, hasPermission, isOwner } = useProjectPermissions(project);
 * 
 * // Legacy capability check  
 * if (can('canManageTasks')) { ... }
 * 
 * // New granular permission check
 * if (hasPermission('project.tasks.create')) { ... }
 */
export function useProjectPermissions(project: Project | null) {
    const currentUser = auth.currentUser;
    const tenantId = getActiveTenantId();

    const permissions = useMemo(() => {
        const userId = currentUser?.uid;
        const legacyRole = getUserRole(project, userId);
        const capabilities = getUserCapabilities(project, userId);
        const isOwner = project?.ownerId === userId;
        const isProjectOwner = legacyRole === 'Owner';

        // Build role for new permission system
        const buildRoles = (): Role[] => {
            if (!legacyRole) return [];

            if (isProjectOwner) {
                return [{
                    id: 'project-owner',
                    name: 'Project Owner',
                    position: Number.MAX_SAFE_INTEGER - 1,
                    isSystem: true,
                    systemKey: 'PROJECT_OWNER',
                    permissionsMode: 'ALL_PROJECT_PERMISSIONS',
                    permissions: {
                        allow: ALL_PROJECT_PERMISSIONS,
                        deny: [],
                    },
                }];
            }

            const projectPerms = getLegacyProjectRolePermissions(legacyRole);
            return [{
                id: `project-${legacyRole.toLowerCase()}`,
                name: legacyRole,
                position: legacyRole === 'Editor' ? 50 : 10,
                isSystem: false,
                permissions: {
                    allow: projectPerms,
                    deny: [],
                },
            }];
        };

        const roles = buildRoles();

        // New granular permission check
        const hasPermission = (node: ProjectPermissionNode): boolean => {
            if (!userId || !project || !tenantId) return false;

            // Project Owner bypass
            if (isProjectOwner) return true;

            return evaluatePermission({
                userId,
                tenantId,
                projectId: project.id,
                isTenantOwner: false, // Tenant owner check is separate
                roles,
            }, node);
        };

        return {
            // Legacy API
            role: legacyRole,
            capabilities,
            isOwner,
            isProjectOwner,
            can: (capability: keyof RoleCapabilities) => checkPermission(project, userId, capability),
            // New granular permission API
            hasPermission,
            roles,
        };
    }, [project, currentUser?.uid, tenantId]);

    return permissions;
}
