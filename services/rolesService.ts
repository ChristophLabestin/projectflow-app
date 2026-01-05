import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { CustomRole, Permission, Project, ProjectRole, Tenant } from '../types';
import { getActiveTenantId, getTenant } from './dataService';
import { RoleCapabilities } from '../types';

/**
 * Legacy static role permissions - used for backward compatibility
 * MOVED from types.ts to service layer to keep types clean
 */
const ROLE_PERMISSIONS: Record<ProjectRole, Permission[]> = {
    Owner: [
        'project.read', 'project.update', 'project.delete', 'project.invite', 'project.view_settings',
        'task.create', 'task.update', 'task.delete', 'task.view', 'task.assign', 'task.comment',
        'issue.create', 'issue.update', 'issue.delete', 'issue.view',
        'idea.create', 'idea.update', 'idea.delete', 'idea.view',
        'group.create', 'group.update', 'group.delete'
    ],
    Editor: [
        'project.read', 'project.invite', 'project.view_settings',
        'task.create', 'task.update', 'task.delete', 'task.view', 'task.assign', 'task.comment',
        'issue.create', 'issue.update', 'issue.delete', 'issue.view',
        'idea.create', 'idea.update', 'idea.delete', 'idea.view',
        'group.create', 'group.update', 'group.delete'
    ],
    Viewer: [
        'project.read',
        'task.view', 'task.comment',
        'issue.view',
        'idea.view'
    ]
};

/**
 * All available permissions grouped by category for the UI
 */
export const PERMISSION_CATEGORIES: Record<string, { label: string; permissions: { key: Permission; label: string }[] }> = {
    project: {
        label: 'Project',
        permissions: [
            { key: 'project.read', label: 'View project' },
            { key: 'project.update', label: 'Edit project settings' },
            { key: 'project.delete', label: 'Delete project' },
            { key: 'project.invite', label: 'Invite members' },
            { key: 'project.view_settings', label: 'View project settings' },
        ]
    },
    tasks: {
        label: 'Tasks',
        permissions: [
            { key: 'task.view', label: 'View tasks' },
            { key: 'task.create', label: 'Create tasks' },
            { key: 'task.update', label: 'Edit tasks' },
            { key: 'task.delete', label: 'Delete tasks' },
            { key: 'task.assign', label: 'Assign tasks' },
            { key: 'task.comment', label: 'Comment on tasks' },
        ]
    },
    issues: {
        label: 'Issues',
        permissions: [
            { key: 'issue.view', label: 'View issues' },
            { key: 'issue.create', label: 'Report issues' },
            { key: 'issue.update', label: 'Edit issues' },
            { key: 'issue.delete', label: 'Delete issues' },
        ]
    },
    ideas: {
        label: 'Flows / Ideas',
        permissions: [
            { key: 'idea.view', label: 'View flows' },
            { key: 'idea.create', label: 'Create flows' },
            { key: 'idea.update', label: 'Edit flows' },
            { key: 'idea.delete', label: 'Delete flows' },
        ]
    },
    groups: {
        label: 'Groups',
        permissions: [
            { key: 'group.create', label: 'Create groups' },
            { key: 'group.update', label: 'Edit groups' },
            { key: 'group.delete', label: 'Delete groups' },
        ]
    },
    roles: {
        label: 'Roles',
        permissions: [
            { key: 'role.manage', label: 'Manage roles' },
        ]
    }
};

/**
 * Get all permissions as a flat array
 */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSION_CATEGORIES)
    .flatMap(cat => cat.permissions.map(p => p.key));

/**
 * Generate a unique ID for a new role
 */
const generateRoleId = (): string => {
    return `role_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Create a new custom role for a workspace (tenant)
 */
export const createCustomRole = async (
    name: string,
    color: string,
    permissions: Permission[],
    tenantId?: string
): Promise<CustomRole> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Authentication required');

    const tid = tenantId || getActiveTenantId() || user.uid;
    const tenantRef = doc(db, 'tenants', tid);

    // Get current roles
    const tenantSnap = await getDoc(tenantRef);
    const currentRoles: CustomRole[] = tenantSnap.data()?.customRoles || [];

    const newRole: CustomRole = {
        id: generateRoleId(),
        name,
        color,
        position: Date.now(), // New roles go to the bottom
        permissions,
        isDefault: false,
        createdAt: new Date().toISOString(), // Use ISO string instead of serverTimestamp
        createdBy: user.uid
    };

    await updateDoc(tenantRef, {
        customRoles: [...currentRoles, newRole],
        updatedAt: serverTimestamp()
    });

    return newRole;
};

/**
 * Update an existing custom role in a workspace
 */
export const updateCustomRole = async (
    roleId: string,
    updates: Partial<Pick<CustomRole, 'name' | 'color' | 'permissions' | 'isDefault' | 'position'>>,
    currentRoles: CustomRole[],
    tenantId?: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Authentication required');

    const tid = tenantId || getActiveTenantId() || user.uid;
    const tenantRef = doc(db, 'tenants', tid);

    // Find and update the role
    const updatedRoles = currentRoles.map(role => {
        if (role.id === roleId) {
            return { ...role, ...updates };
        }
        // If this role is being set as default, unset others
        if (updates.isDefault && role.isDefault) {
            return { ...role, isDefault: false };
        }
        return role;
    });

    await updateDoc(tenantRef, {
        customRoles: updatedRoles,
        updatedAt: serverTimestamp()
    });
};

/**
 * Delete a custom role from a workspace
 */
export const deleteCustomRole = async (
    roleId: string,
    currentRoles: CustomRole[],
    tenantId?: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Authentication required');

    const tid = tenantId || getActiveTenantId() || user.uid;
    const tenantRef = doc(db, 'tenants', tid);

    const roleToDelete = currentRoles.find(r => r.id === roleId);
    if (!roleToDelete) throw new Error('Role not found');

    await updateDoc(tenantRef, {
        customRoles: arrayRemove(roleToDelete),
        updatedAt: serverTimestamp()
    });
};

/**
 * Reorder custom roles in a workspace
 */
export const reorderCustomRoles = async (
    orderedRoleIds: string[],
    currentRoles: CustomRole[],
    tenantId?: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Authentication required');

    const tid = tenantId || getActiveTenantId() || user.uid;
    const tenantRef = doc(db, 'tenants', tid);

    // Update positions based on new order
    const updatedRoles = currentRoles.map(role => {
        const newPosition = orderedRoleIds.indexOf(role.id);
        return { ...role, position: newPosition >= 0 ? newPosition : role.position };
    }).sort((a, b) => a.position - b.position);

    await updateDoc(tenantRef, {
        customRoles: updatedRoles,
        updatedAt: serverTimestamp()
    });
};

/**
 * Set the default role for new members in a workspace
 */
export const setDefaultRole = async (
    roleId: string | null,
    tenantId?: string
): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Authentication required');

    const tid = tenantId || getActiveTenantId() || user.uid;
    const tenantRef = doc(db, 'tenants', tid);

    await updateDoc(tenantRef, {
        defaultRoleId: roleId,
        updatedAt: serverTimestamp()
    });
};

/**
 * Get permissions for a user's role
 * Handles both legacy ProjectRole and custom role IDs
 * Now looks up roles from tenant instead of project
 */
export const getRolePermissions = (
    customRoles: CustomRole[] | undefined,
    roleValue: ProjectRole | string
): Permission[] => {
    // Check if it's a legacy ProjectRole
    if (['Owner', 'Editor', 'Viewer'].includes(roleValue)) {
        return ROLE_PERMISSIONS[roleValue as ProjectRole];
    }

    // Look up custom role
    const customRole = customRoles?.find(r => r.id === roleValue);
    if (customRole) {
        return customRole.permissions;
    }

    // Fallback to Viewer permissions
    return ROLE_PERMISSIONS.Viewer;
};

/**
 * Check if a user has a specific permission in a project
 */
export const hasProjectPermission = (
    customRoles: CustomRole[] | undefined,
    project: Project | null,
    userId: string | undefined,
    permission: Permission
): boolean => {
    if (!project || !userId) return false;

    // Owner always has all permissions
    if (project.ownerId === userId) return true;

    // Get user's role
    const userRole = project.roles?.[userId];
    if (!userRole) {
        // Check legacy members array
        const member = project.members?.find(m =>
            typeof m === 'string' ? m === userId : m.userId === userId
        );
        if (!member) return false;

        const memberRole = typeof member === 'string' ? 'Editor' : member.role;
        return getRolePermissions(customRoles, memberRole).includes(permission);
    }

    return getRolePermissions(customRoles, userRole).includes(permission);
};

/**
 * Get the default permissions preset for a new "Editor" role
 */
export const getEditorPreset = (): Permission[] => ROLE_PERMISSIONS.Editor;

/**
 * Get the default permissions preset for a new "Viewer" role
 */
export const getViewerPreset = (): Permission[] => ROLE_PERMISSIONS.Viewer;

/**
 * Convert a list of permissions to RoleCapabilities object
 */
export const getRoleCapabilities = (permissions: Permission[]): RoleCapabilities => {
    return {
        canEdit: permissions.includes('project.update'),
        canDelete: permissions.includes('project.delete'),
        canInvite: permissions.includes('project.invite'),
        canManageTasks: permissions.includes('task.create') || permissions.includes('task.update') || permissions.includes('task.delete'),
        canManageIdeas: permissions.includes('idea.create') || permissions.includes('idea.update') || permissions.includes('idea.delete'),
        canManageIssues: permissions.includes('issue.create') || permissions.includes('issue.update') || permissions.includes('issue.delete'),
        canComment: permissions.includes('task.comment'),
        canView: permissions.includes('project.read'),
        canManageGroups: permissions.includes('group.create') || permissions.includes('group.update') || permissions.includes('group.delete'),
    };
};

/**
 * Get role display info (name, color) for a role value
 * Now accepts customRoles array from tenant
 */
export const getRoleDisplayInfo = (
    customRoles: CustomRole[] | undefined,
    roleValue: ProjectRole | string
): { name: string; color: string } => {
    // Legacy roles
    if (roleValue === 'Owner') return { name: 'Owner', color: '#f59e0b' }; // Amber
    if (roleValue === 'Editor') return { name: 'Editor', color: '#3b82f6' }; // Blue
    if (roleValue === 'Viewer') return { name: 'Viewer', color: '#6b7280' }; // Gray

    // Custom role
    const customRole = customRoles?.find(r => r.id === roleValue);
    if (customRole) {
        return { name: customRole.name, color: customRole.color };
    }

    return { name: 'Unknown', color: '#6b7280' };
};

/**
 * Get workspace custom roles
 */
export const getWorkspaceRoles = async (tenantId?: string): Promise<CustomRole[]> => {
    const tid = tenantId || getActiveTenantId();
    if (!tid) return [];

    const tenant = await getTenant(tid);
    return tenant?.customRoles || [];
};
