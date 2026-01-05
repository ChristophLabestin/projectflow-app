import { useMemo, useState, useEffect } from 'react';
import { Project, ProjectRole, RoleCapabilities, CustomRole } from '../types';
import { getUserRole, getUserCapabilities, checkPermission, hasPermission } from '../utils/permissions';
import { auth } from '../services/firebase';
import { getWorkspaceRoles } from '../services/rolesService';

/**
 * Custom hook to easily check permissions in components
 * 
 * @example
 * const { can, role, isOwner } = useProjectPermissions(project);
 * 
 * {can('canManageTasks') && <Button>New Task</Button>}
 * {isOwner && <Button variant="danger">Delete Project</Button>}
 */
export function useProjectPermissions(project: Project | null, initialCustomRoles?: CustomRole[]) {
    const currentUser = auth.currentUser;
    const [fetchedRoles, setFetchedRoles] = useState<CustomRole[] | undefined>(initialCustomRoles);

    useEffect(() => {
        if (initialCustomRoles) {
            setFetchedRoles(initialCustomRoles);
            return;
        }

        if (project?.tenantId) {
            getWorkspaceRoles(project.tenantId).then(setFetchedRoles);
        }
    }, [project?.tenantId, initialCustomRoles]);

    const permissions = useMemo(() => {
        const userId = currentUser?.uid;
        const role = getUserRole(project, userId);
        const capabilities = getUserCapabilities(project, userId); // This still uses legacy ROLE_CAPABILITIES
        const isOwner = project?.ownerId === userId;
        const customRoles = fetchedRoles;

        return {
            role,
            capabilities,
            isOwner,
            can: (capability: keyof RoleCapabilities) => checkPermission(project, userId, capability, customRoles),
            hasPermission: (permission: import('../types').Permission) => hasPermission(project, userId, permission, customRoles),
        };
    }, [project, currentUser?.uid, fetchedRoles]);

    return permissions;
}
