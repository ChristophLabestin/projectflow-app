import { useMemo } from 'react';
import { Project, ProjectRole, RoleCapabilities } from '../types';
import { getUserRole, getUserCapabilities, checkPermission } from '../utils/permissions';
import { auth } from '../services/firebase';

/**
 * Custom hook to easily check permissions in components
 * 
 * @example
 * const { can, role, isOwner } = useProjectPermissions(project);
 * 
 * {can('canManageTasks') && <Button>New Task</Button>}
 * {isOwner && <Button variant="danger">Delete Project</Button>}
 */
export function useProjectPermissions(project: Project | null) {
    const currentUser = auth.currentUser;

    const permissions = useMemo(() => {
        const userId = currentUser?.uid;
        const role = getUserRole(project, userId);
        const capabilities = getUserCapabilities(project, userId);
        const isOwner = project?.ownerId === userId;

        return {
            role,
            capabilities,
            isOwner,
            can: (capability: keyof RoleCapabilities) => checkPermission(project, userId, capability),
        };
    }, [project, currentUser?.uid]);

    return permissions;
}
