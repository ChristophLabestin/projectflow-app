/**
 * Permission Context
 * 
 * React context for permission state management.
 * Provides easy access to permission checks throughout the app.
 * 
 * Usage:
 * ```tsx
 * const { hasPermission, isTenantOwner } = usePermissions();
 * 
 * // Check tenant permission
 * if (hasPermission('tenant.members.invite')) { ... }
 * 
 * // Check project permission
 * if (hasPermission('project.tasks.create', projectId)) { ... }
 * ```
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { auth } from '../services/firebase';
import { getActiveTenantId, subscribeTenantUsers } from '../services/dataService';
import {
    PermissionNode,
    TenantPermissionNode,
    ProjectPermissionNode,
    AIPermissionNode,
    Role,
    PermissionEvaluationContext,
    LegacyWorkspaceRole,
    LegacyProjectRole,
    DEFAULT_MEMBER_PERMISSIONS,
    ALL_TENANT_PERMISSIONS,
    ALL_AI_PERMISSIONS,
} from '../types/permissions';
import {
    evaluatePermission,
    evaluatePermissions,
    hasAllPermissions,
    hasAnyPermission,
    canManageRole,
    getHighestPosition,
    SYSTEM_ROLE_DEFAULTS,
    getLegacyWorkspaceRolePermissions,
} from '../services/permissionService';

// =============================================================================
// TYPES
// =============================================================================

interface PermissionContextValue {
    // Loading state
    loading: boolean;

    // Current user info
    userId: string | null;
    tenantId: string | null;

    // Quick permission checks
    hasPermission: (node: PermissionNode, projectId?: string) => boolean;
    hasAllPermissions: (nodes: PermissionNode[], projectId?: string) => boolean;
    hasAnyPermission: (nodes: PermissionNode[], projectId?: string) => boolean;

    // Role info
    tenantRoles: Role[];
    isTenantOwner: boolean;

    // Hierarchy checks for role management
    canManageRole: (targetRole: Role) => boolean;
    highestPosition: number;

    // Legacy compatibility
    legacyWorkspaceRole: LegacyWorkspaceRole | null;

    // Raw evaluation context (for advanced use)
    getEvaluationContext: (projectId?: string) => PermissionEvaluationContext | null;
}

// =============================================================================
// CONTEXT
// =============================================================================

const PermissionContext = createContext<PermissionContextValue | null>(null);

// =============================================================================
// HELPER: BUILD ROLES FROM LEGACY DATA
// =============================================================================

/**
 * Build Role objects from legacy workspace role
 * This is a compatibility layer until full role objects are stored in Firestore
 */
function buildRolesFromLegacyWorkspaceRole(
    legacyRole: LegacyWorkspaceRole,
    tenantOwnerId?: string,
    currentUserId?: string
): Role[] {
    const roles: Role[] = [];

    // If user is the tenant owner, add Owner role
    if (tenantOwnerId && currentUserId && tenantOwnerId === currentUserId) {
        roles.push({
            id: 'system-owner',
            name: 'Owner',
            ...SYSTEM_ROLE_DEFAULTS.OWNER,
        });
        return roles; // Owner already has everything
    }

    // Add role based on legacy role
    switch (legacyRole) {
        case 'Owner':
            roles.push({
                id: 'system-owner',
                name: 'Owner',
                ...SYSTEM_ROLE_DEFAULTS.OWNER,
            });
            break;
        case 'Admin':
            roles.push({
                id: 'system-admin',
                name: 'Admin',
                position: 100,
                isSystem: false,
                permissions: {
                    allow: getLegacyWorkspaceRolePermissions('Admin'),
                    deny: [],
                },
            });
            break;
        case 'Member':
            // Member is implicit, just use defaults
            roles.push({
                id: 'system-member',
                name: 'Member',
                ...SYSTEM_ROLE_DEFAULTS.MEMBER,
            });
            break;
        case 'Guest':
            roles.push({
                id: 'system-guest',
                name: 'Guest',
                ...SYSTEM_ROLE_DEFAULTS.GUEST,
            });
            break;
    }

    // Always add implicit Member permissions if not Owner or Guest
    if (legacyRole !== 'Owner' && legacyRole !== 'Guest') {
        // Member role is implicit - already added above for 'Member' case
        // For Admin, we still include Member baseline through the SYSTEM_ROLE_DEFAULTS
    }

    return roles;
}

// =============================================================================
// PROVIDER
// =============================================================================

interface PermissionProviderProps {
    children: ReactNode;
}

export function PermissionProvider({ children }: PermissionProviderProps) {
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<any[]>([]);

    const tenantId = getActiveTenantId();
    const currentUser = auth.currentUser;
    const userId = currentUser?.uid ?? null;

    // Subscribe to tenant members for role information
    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeTenantUsers((fetchedMembers) => {
            setMembers(fetchedMembers as any[]);
            setLoading(false);
        }, tenantId);

        return () => unsubscribe();
    }, [tenantId]);

    // Derive current user's legacy role
    const legacyWorkspaceRole = useMemo((): LegacyWorkspaceRole | null => {
        if (!userId || !tenantId) return null;

        // Personal workspace - user is owner
        if (userId === tenantId) return 'Owner';

        // Find member record
        const member = members.find((m: any) => m.uid === userId);
        if (!member) return null;

        // Map legacy roles
        const role = member.role as string;
        if (role === 'Editor') return 'Member';
        if (role === 'Viewer') return 'Guest';

        return role as LegacyWorkspaceRole;
    }, [members, userId, tenantId]);

    // Check if current user is tenant owner
    const isTenantOwner = useMemo(() => {
        if (!userId || !tenantId) return false;
        // Personal workspace
        if (userId === tenantId) return true;
        // Check role
        return legacyWorkspaceRole === 'Owner';
    }, [userId, tenantId, legacyWorkspaceRole]);

    // Build roles from legacy data
    const tenantRoles = useMemo((): Role[] => {
        if (!legacyWorkspaceRole) return [];
        return buildRolesFromLegacyWorkspaceRole(legacyWorkspaceRole, tenantId ?? undefined, userId ?? undefined);
    }, [legacyWorkspaceRole, tenantId, userId]);

    // Get highest position for hierarchy checks
    const highestPosition = useMemo(() => {
        return getHighestPosition(tenantRoles);
    }, [tenantRoles]);

    // Build evaluation context
    const getEvaluationContext = useCallback((projectId?: string): PermissionEvaluationContext | null => {
        if (!userId || !tenantId) return null;

        return {
            userId,
            tenantId,
            projectId,
            isTenantOwner,
            roles: tenantRoles,
            isExternal: legacyWorkspaceRole === 'Guest',
        };
    }, [userId, tenantId, isTenantOwner, tenantRoles, legacyWorkspaceRole]);

    // Permission check functions
    const hasPermissionFn = useCallback((node: PermissionNode, projectId?: string): boolean => {
        const context = getEvaluationContext(projectId);
        if (!context) return false;
        return evaluatePermission(context, node);
    }, [getEvaluationContext]);

    const hasAllPermissionsFn = useCallback((nodes: PermissionNode[], projectId?: string): boolean => {
        const context = getEvaluationContext(projectId);
        if (!context) return false;
        return hasAllPermissions(context, nodes);
    }, [getEvaluationContext]);

    const hasAnyPermissionFn = useCallback((nodes: PermissionNode[], projectId?: string): boolean => {
        const context = getEvaluationContext(projectId);
        if (!context) return false;
        return hasAnyPermission(context, nodes);
    }, [getEvaluationContext]);

    const canManageRoleFn = useCallback((targetRole: Role): boolean => {
        return canManageRole(tenantRoles, targetRole);
    }, [tenantRoles]);

    // Context value
    const value = useMemo((): PermissionContextValue => ({
        loading,
        userId,
        tenantId,
        hasPermission: hasPermissionFn,
        hasAllPermissions: hasAllPermissionsFn,
        hasAnyPermission: hasAnyPermissionFn,
        tenantRoles,
        isTenantOwner,
        canManageRole: canManageRoleFn,
        highestPosition,
        legacyWorkspaceRole,
        getEvaluationContext,
    }), [
        loading,
        userId,
        tenantId,
        hasPermissionFn,
        hasAllPermissionsFn,
        hasAnyPermissionFn,
        tenantRoles,
        isTenantOwner,
        canManageRoleFn,
        highestPosition,
        legacyWorkspaceRole,
        getEvaluationContext,
    ]);

    return (
        <PermissionContext.Provider value={value}>
            {children}
        </PermissionContext.Provider>
    );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Main hook for accessing permission context
 */
export function usePermissions(): PermissionContextValue {
    const context = useContext(PermissionContext);
    if (!context) {
        throw new Error('usePermissions must be used within a PermissionProvider');
    }
    return context;
}

/**
 * Simple hook for checking a single permission
 * 
 * @example
 * const canInvite = usePermission('tenant.members.invite');
 * const canCreateTask = usePermission('project.tasks.create', projectId);
 */
export function usePermission(node: PermissionNode, projectId?: string): boolean {
    const { hasPermission, loading } = usePermissions();
    return useMemo(() => {
        if (loading) return false;
        return hasPermission(node, projectId);
    }, [hasPermission, node, projectId, loading]);
}

/**
 * Hook for checking multiple permissions at once
 * Returns an object mapping each permission to its result
 * 
 * @example
 * const perms = usePermissionMap(['project.tasks.create', 'project.tasks.delete'], projectId);
 * if (perms['project.tasks.create']) { ... }
 */
export function usePermissionMap(
    nodes: PermissionNode[],
    projectId?: string
): Record<PermissionNode, boolean> {
    const { getEvaluationContext, loading } = usePermissions();

    return useMemo(() => {
        const result: Record<string, boolean> = {};

        if (loading) {
            nodes.forEach(n => result[n] = false);
            return result as Record<PermissionNode, boolean>;
        }

        const context = getEvaluationContext(projectId);
        if (!context) {
            nodes.forEach(n => result[n] = false);
            return result as Record<PermissionNode, boolean>;
        }

        return evaluatePermissions(context, nodes);
    }, [getEvaluationContext, nodes, projectId, loading]);
}

/**
 * Hook for checking if user has ALL specified permissions
 */
export function useHasAllPermissions(nodes: PermissionNode[], projectId?: string): boolean {
    const { hasAllPermissions, loading } = usePermissions();
    return useMemo(() => {
        if (loading) return false;
        return hasAllPermissions(nodes, projectId);
    }, [hasAllPermissions, nodes, projectId, loading]);
}

/**
 * Hook for checking if user has ANY of the specified permissions
 */
export function useHasAnyPermission(nodes: PermissionNode[], projectId?: string): boolean {
    const { hasAnyPermission, loading } = usePermissions();
    return useMemo(() => {
        if (loading) return false;
        return hasAnyPermission(nodes, projectId);
    }, [hasAnyPermission, nodes, projectId, loading]);
}

// =============================================================================
// EXPORTS
// =============================================================================

export { PermissionContext };
export type { PermissionContextValue };
